//! NTFS Alternate Data Streams (ADS) and Zone.Identifier ("Mark of the Web") manager.

use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlternateDataStream {
    pub file_path: String,
    pub stream_full_name: String,
    pub stream_name: String,
    pub stream_type: String,
    pub size_bytes: i64,
    pub is_zone_identifier: bool,
    pub content_preview: String,
}

#[cfg(windows)]
pub fn list_streams(file_path: &str) -> Result<Vec<AlternateDataStream>, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Storage::FileSystem::{
        FindFirstStreamW, FindNextStreamW, FindStreamInfoStandard, FindClose, WIN32_FIND_STREAM_DATA,
    };

    let p = Path::new(file_path);
    if !p.exists() {
        return Err("file does not exist".into());
    }

    let mut wide: Vec<u16> = p.as_os_str().encode_wide().collect();
    wide.push(0);

    let mut find_data = WIN32_FIND_STREAM_DATA::default();
    let handle_res = unsafe {
        FindFirstStreamW(
            windows::core::PCWSTR::from_raw(wide.as_ptr()),
            FindStreamInfoStandard,
            &mut find_data as *mut _ as *mut std::ffi::c_void,
            None,
        )
    };

    let handle: HANDLE = match handle_res {
        Ok(h) if !h.is_invalid() => h,
        _ => return Ok(Vec::new()),
    };

    let mut streams = Vec::new();

    loop {
        let name_len = find_data
            .cStreamName
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(find_data.cStreamName.len());
        let raw_name = String::from_utf16_lossy(&find_data.cStreamName[..name_len]);

        // Default main data stream is "::$DATA"
        if !raw_name.is_empty() && raw_name != "::$DATA" {
            let parts: Vec<&str> = raw_name.trim_matches(':').split(':').collect();
            let stream_name = parts.first().copied().unwrap_or("").to_string();
            let stream_type = parts.get(1).copied().unwrap_or("$DATA").to_string();
            let is_zone = stream_name.eq_ignore_ascii_case("Zone.Identifier");

            let mut preview = String::new();
            if is_zone || find_data.StreamSize < 4096 {
                let stream_path = format!("{file_path}:{stream_name}");
                if let Ok(content) = std::fs::read_to_string(&stream_path) {
                    preview = content.chars().take(500).collect();
                }
            }

            streams.push(AlternateDataStream {
                file_path: file_path.to_string(),
                stream_full_name: raw_name,
                stream_name,
                stream_type,
                size_bytes: find_data.StreamSize,
                is_zone_identifier: is_zone,
                content_preview: preview,
            });
        }

        let next = unsafe { FindNextStreamW(handle, &mut find_data as *mut _ as *mut std::ffi::c_void) };
        if next.is_err() {
            break;
        }
    }

    let _ = unsafe { FindClose(handle) };
    Ok(streams)
}

#[cfg(not(windows))]
pub fn list_streams(_file_path: &str) -> Result<Vec<AlternateDataStream>, String> {
    Ok(Vec::new())
}

/// Deletes a specific alternate data stream from a file (e.g., Zone.Identifier).
pub fn delete_stream(file_path: &str, stream_name: &str) -> Result<bool, String> {
    let clean_stream = stream_name.trim_matches(':');
    let target = format!("{file_path}:{clean_stream}");

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::Win32::Storage::FileSystem::DeleteFileW;

        let wide: Vec<u16> = std::ffi::OsStr::new(&target).encode_wide().chain(std::iter::once(0)).collect();
        let res = unsafe { DeleteFileW(windows::core::PCWSTR::from_raw(wide.as_ptr())) };
        if res.is_ok() {
            Ok(true)
        } else {
            Err(format!("failed to delete stream {stream_name}"))
        }
    }

    #[cfg(not(windows))]
    {
        let _ = target;
        Err("ADS only supported on Windows NTFS".into())
    }
}

/// One-click unblocks a downloaded Windows file by deleting the "Zone.Identifier" alternate data stream.
pub fn unblock_file(file_path: &str) -> Result<bool, String> {
    delete_stream(file_path, "Zone.Identifier")
}

/// Strips all alternate data streams from a file, leaving only the primary data stream.
pub fn strip_all_streams(file_path: &str) -> Result<usize, String> {
    let streams = list_streams(file_path)?;
    let mut deleted = 0;
    for s in streams {
        if delete_stream(file_path, &s.stream_name)? {
            deleted += 1;
        }
    }
    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(windows)]
    fn test_zone_identifier_lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("downloaded.exe");
        std::fs::write(&file, b"test content").unwrap();

        // Write an ADS stream
        let stream_path = format!("{}:Zone.Identifier", file.display());
        std::fs::write(&stream_path, b"[ZoneTransfer]\r\nZoneId=3\r\n").unwrap();

        let streams = list_streams(file.to_str().unwrap()).unwrap();
        assert_eq!(streams.len(), 1);
        assert!(streams[0].is_zone_identifier);

        // Unblock
        let unblocked = unblock_file(file.to_str().unwrap()).unwrap();
        assert!(unblocked);

        let streams_after = list_streams(file.to_str().unwrap()).unwrap();
        assert_eq!(streams_after.len(), 0);
    }
}
