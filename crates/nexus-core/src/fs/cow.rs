//! Copy-on-Write (CoW) & Block Extent Cloning Engine.
//!
//! Leverages Windows ReFS & Microsoft Dev Drive `FSCTL_DUPLICATE_EXTENTS_TO_FILE`
//! for near-instantaneous (0.01s), zero-byte duplicate copies of multi-gigabyte files.
//! Gracefully falls back to high-throughput streaming copy when extent cloning is not supported.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;
use std::time::Instant;
use serde::{Deserialize, Serialize};

pub const FSCTL_DUPLICATE_EXTENTS_TO_FILE: u32 = 0x00098344;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneResult {
    pub source: String,
    pub destination: String,
    pub bytes: u64,
    pub is_cow_block_cloned: bool,
    pub elapsed_ms: u64,
}

#[cfg(windows)]
#[repr(C)]
struct DuplicateExtentsData {
    file_handle: windows::Win32::Foundation::HANDLE,
    source_file_offset: i64,
    target_file_offset: i64,
    byte_count: i64,
}

/// Clones a file using Copy-on-Write block cloning if supported, falling back to fast copy.
pub fn clone_file(src_path: &str, dest_path: &str) -> Result<CloneResult, String> {
    let started = Instant::now();
    let src = Path::new(src_path);
    if !src.is_file() {
        return Err("source file does not exist or is a directory".into());
    }

    let meta = fs::metadata(src).map_err(|e| format!("cannot read metadata: {e}"))?;
    let file_len = meta.len();

    // Ensure destination directory exists
    if let Some(parent) = Path::new(dest_path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("cannot create target directory: {e}"))?;
        }
    }

    if file_len == 0 {
        File::create(dest_path).map_err(|e| format!("cannot create empty target: {e}"))?;
        return Ok(CloneResult {
            source: src_path.to_string(),
            destination: dest_path.to_string(),
            bytes: 0,
            is_cow_block_cloned: true,
            elapsed_ms: started.elapsed().as_millis() as u64,
        });
    }

    #[cfg(windows)]
    {
        if let Ok(true) = try_cow_clone_windows(src, Path::new(dest_path), file_len) {
            // Copy attributes and timestamps
            let _ = crate::tools::touch::get_timestamps(src_path).map(|info| {
                let _ = crate::tools::touch::set_timestamps(
                    dest_path,
                    Some(info.created_ms),
                    Some(info.modified_ms),
                    Some(info.accessed_ms),
                );
            });

            return Ok(CloneResult {
                source: src_path.to_string(),
                destination: dest_path.to_string(),
                bytes: file_len,
                is_cow_block_cloned: true,
                elapsed_ms: started.elapsed().as_millis() as u64,
            });
        }
    }

    // Fallback: fast buffer copy
    fast_fallback_copy(src, Path::new(dest_path), file_len)?;

    Ok(CloneResult {
        source: src_path.to_string(),
        destination: dest_path.to_string(),
        bytes: file_len,
        is_cow_block_cloned: false,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(windows)]
fn try_cow_clone_windows(src: &Path, dest: &Path, len: u64) -> Result<bool, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Foundation::{CloseHandle, GENERIC_READ, GENERIC_WRITE};
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, SetFileInformationByHandle, FileEndOfFileInfo, FILE_END_OF_FILE_INFO,
        FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING, CREATE_ALWAYS,
    };
    use windows::Win32::System::IO::DeviceIoControl;

    let src_wide: Vec<u16> = src.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let dest_wide: Vec<u16> = dest.as_os_str().encode_wide().chain(std::iter::once(0)).collect();

    unsafe {
        let h_src = CreateFileW(
            windows::core::PCWSTR(src_wide.as_ptr()),
            GENERIC_READ.0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            None,
        );
        if h_src.is_err() {
            return Ok(false);
        }
        let h_src = h_src.unwrap();

        let h_dest = CreateFileW(
            windows::core::PCWSTR(dest_wide.as_ptr()),
            GENERIC_READ.0 | GENERIC_WRITE.0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            CREATE_ALWAYS,
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            None,
        );
        if h_dest.is_err() {
            let _ = CloseHandle(h_src);
            return Ok(false);
        }
        let h_dest = h_dest.unwrap();

        // Target file must be pre-allocated to the exact size of the source file
        let end_info = FILE_END_OF_FILE_INFO {
            EndOfFile: len as i64,
        };
        let set_res = SetFileInformationByHandle(
            h_dest,
            FileEndOfFileInfo,
            &end_info as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<FILE_END_OF_FILE_INFO>() as u32,
        );
        if set_res.is_err() {
            let _ = CloseHandle(h_src);
            let _ = CloseHandle(h_dest);
            return Ok(false);
        }

        // Issue FSCTL_DUPLICATE_EXTENTS_TO_FILE
        let mut dup_data = DuplicateExtentsData {
            file_handle: h_src,
            source_file_offset: 0,
            target_file_offset: 0,
            byte_count: len as i64,
        };

        let mut bytes_returned = 0u32;
        let io_res = DeviceIoControl(
            h_dest,
            FSCTL_DUPLICATE_EXTENTS_TO_FILE,
            Some(&mut dup_data as *mut _ as *mut std::ffi::c_void),
            std::mem::size_of::<DuplicateExtentsData>() as u32,
            None,
            0,
            Some(&mut bytes_returned),
            None,
        );

        let _ = CloseHandle(h_src);
        let _ = CloseHandle(h_dest);

        match io_res {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

fn fast_fallback_copy(src: &Path, dest: &Path, _len: u64) -> Result<(), String> {
    let mut reader = File::open(src).map_err(|e| format!("cannot open source: {e}"))?;
    let mut writer = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(dest)
        .map_err(|e| format!("cannot open target: {e}"))?;

    let mut buf = [0u8; 131072]; // 128 KB buffer
    loop {
        let n = reader.read(&mut buf).map_err(|e| format!("read error: {e}"))?;
        if n == 0 {
            break;
        }
        writer.write_all(&buf[..n]).map_err(|e| format!("write error: {e}"))?;
    }
    writer.flush().map_err(|e| format!("flush error: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clone_file_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("original.dat");
        let dest = dir.path().join("cloned.dat");

        let test_data = vec![0x42u8; 256 * 1024]; // 256 KB
        fs::write(&src, &test_data).unwrap();

        let res = clone_file(&src.to_string_lossy(), &dest.to_string_lossy()).unwrap();
        assert_eq!(res.bytes, 256 * 1024);
        assert!(dest.exists());
        assert_eq!(fs::read(&dest).unwrap(), test_data);
    }

    #[test]
    fn test_clone_empty_file() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("empty.dat");
        let dest = dir.path().join("empty_cloned.dat");

        fs::write(&src, b"").unwrap();
        let res = clone_file(&src.to_string_lossy(), &dest.to_string_lossy()).unwrap();
        assert_eq!(res.bytes, 0);
        assert!(dest.exists());
    }
}
