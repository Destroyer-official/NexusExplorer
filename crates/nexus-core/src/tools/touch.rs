//! Forensic MACB file timestamps (Creation, Modification, Access) and Win32 attribute manipulation.

use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimestampInfo {
    pub path: String,
    pub filename: String,
    pub created_ms: u64,
    pub modified_ms: u64,
    pub accessed_ms: u64,
    pub attributes: u32,
    pub is_readonly: bool,
    pub is_hidden: bool,
    pub is_system: bool,
    pub is_archive: bool,
}

pub fn get_timestamps(path_str: &str) -> Result<TimestampInfo, String> {
    let p = Path::new(path_str);
    let meta = fs::metadata(p).map_err(|e| format!("cannot read metadata: {e}"))?;

    let filename = p
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let created_ms = meta
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(modified_ms);

    let accessed_ms = meta
        .accessed()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(modified_ms);

    #[cfg(windows)]
    let (attrs, is_readonly, is_hidden, is_system, is_archive) = {
        use std::os::windows::fs::MetadataExt;
        let raw = meta.file_attributes();
        (
            raw,
            (raw & 0x0001) != 0, // READONLY
            (raw & 0x0002) != 0, // HIDDEN
            (raw & 0x0004) != 0, // SYSTEM
            (raw & 0x0020) != 0, // ARCHIVE
        )
    };
    #[cfg(not(windows))]
    let (attrs, is_readonly, is_hidden, is_system, is_archive) = (0, false, false, false, false);

    Ok(TimestampInfo {
        path: path_str.to_string(),
        filename,
        created_ms,
        modified_ms,
        accessed_ms,
        attributes: attrs,
        is_readonly,
        is_hidden,
        is_system,
        is_archive,
    })
}

#[cfg(windows)]
fn ms_to_filetime(ms: u64) -> windows::Win32::Foundation::FILETIME {
    // Windows epoch is Jan 1, 1601. Unix epoch is Jan 1, 1970. Difference = 11644473600000 ms.
    let intervals = (ms + 11_644_473_600_000) * 10_000;
    windows::Win32::Foundation::FILETIME {
        dwLowDateTime: (intervals & 0xFFFF_FFFF) as u32,
        dwHighDateTime: (intervals >> 32) as u32,
    }
}

pub fn set_timestamps(
    path_str: &str,
    created_ms: Option<u64>,
    modified_ms: Option<u64>,
    accessed_ms: Option<u64>,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::Storage::FileSystem::{
            CreateFileW, SetFileTime, FILE_GENERIC_WRITE, FILE_SHARE_READ, FILE_SHARE_WRITE,
            OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS,
        };

        let wide: Vec<u16> = std::ffi::OsStr::new(path_str).encode_wide().chain(std::iter::once(0)).collect();
        let handle = unsafe {
            CreateFileW(
                windows::core::PCWSTR::from_raw(wide.as_ptr()),
                FILE_GENERIC_WRITE.0,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                None,
                OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS,
                None,
            )
        };

        if handle.is_err() {
            return Err(format!("cannot open handle for {path_str}"));
        }
        let h = handle.unwrap();

        let c_ft = created_ms.map(ms_to_filetime);
        let m_ft = modified_ms.map(ms_to_filetime);
        let a_ft = accessed_ms.map(ms_to_filetime);

        let res = unsafe {
            SetFileTime(
                h,
                c_ft.as_ref().map(|f| f as *const _),
                a_ft.as_ref().map(|f| f as *const _),
                m_ft.as_ref().map(|f| f as *const _),
            )
        };

        let _ = unsafe { CloseHandle(h) };

        if res.is_err() {
            return Err(format!("SetFileTime failed on {path_str}"));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (path_str, created_ms, modified_ms, accessed_ms);
        Err("SetFileTime only supported on Windows".into())
    }
}

pub fn set_attributes(
    path_str: &str,
    is_readonly: bool,
    is_hidden: bool,
    is_system: bool,
    is_archive: bool,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::Win32::Storage::FileSystem::{
            SetFileAttributesW, FILE_FLAGS_AND_ATTRIBUTES,
            FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM,
            FILE_ATTRIBUTE_ARCHIVE, FILE_ATTRIBUTE_NORMAL,
        };

        let mut flags: u32 = 0;
        if is_readonly { flags |= FILE_ATTRIBUTE_READONLY.0; }
        if is_hidden { flags |= FILE_ATTRIBUTE_HIDDEN.0; }
        if is_system { flags |= FILE_ATTRIBUTE_SYSTEM.0; }
        if is_archive { flags |= FILE_ATTRIBUTE_ARCHIVE.0; }
        if flags == 0 { flags = FILE_ATTRIBUTE_NORMAL.0; }

        let wide: Vec<u16> = std::ffi::OsStr::new(path_str).encode_wide().chain(std::iter::once(0)).collect();
        let res = unsafe {
            SetFileAttributesW(
                windows::core::PCWSTR::from_raw(wide.as_ptr()),
                FILE_FLAGS_AND_ATTRIBUTES(flags),
            )
        };

        if res.is_err() {
            return Err(format!("SetFileAttributesW failed on {path_str}"));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (path_str, is_readonly, is_hidden, is_system, is_archive);
        Err("SetFileAttributes only supported on Windows".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(windows)]
    fn test_set_and_get_timestamps() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("timestamp_test.txt");
        fs::write(&file, b"test").unwrap();

        let target_ms = 1_700_000_000_000u64; // ~Nov 2023
        set_timestamps(file.to_str().unwrap(), Some(target_ms), Some(target_ms), Some(target_ms)).unwrap();

        let info = get_timestamps(file.to_str().unwrap()).unwrap();
        // Allow a small discrepancy due to 100ns / ms conversions
        assert!((info.modified_ms as i64 - target_ms as i64).abs() < 50);
    }
}

