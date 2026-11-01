//! NTFS USN (Update Sequence Number) Change Journal Query and Streaming Engine.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsnJournalInfo {
    pub volume: String,
    pub journal_id: u64,
    pub lowest_valid_usn: i64,
    pub next_usn: i64,
    pub maximum_usn: i64,
    pub maximum_size: u64,
    pub allocation_delta: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsnRecordEntry {
    pub usn: i64,
    pub file_reference_number: u64,
    pub parent_file_reference_number: u64,
    pub file_name: String,
    pub reasons: Vec<String>,
    pub reason_raw: u32,
    pub timestamp: String,
    pub file_attributes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsnRecordsBatch {
    pub volume: String,
    pub next_usn: i64,
    pub records: Vec<UsnRecordEntry>,
}

pub fn parse_usn_reasons(reason: u32) -> Vec<String> {
    let mut flags = Vec::new();
    if (reason & 0x00000001) != 0 { flags.push("DATA_OVERWRITE".to_string()); }
    if (reason & 0x00000002) != 0 { flags.push("DATA_EXTEND".to_string()); }
    if (reason & 0x00000004) != 0 { flags.push("DATA_TRUNCATION".to_string()); }
    if (reason & 0x00000010) != 0 { flags.push("NAMED_DATA_OVERWRITE".to_string()); }
    if (reason & 0x00000020) != 0 { flags.push("NAMED_DATA_EXTEND".to_string()); }
    if (reason & 0x00000040) != 0 { flags.push("NAMED_DATA_TRUNCATION".to_string()); }
    if (reason & 0x00000100) != 0 { flags.push("FILE_CREATE".to_string()); }
    if (reason & 0x00000200) != 0 { flags.push("FILE_DELETE".to_string()); }
    if (reason & 0x00000400) != 0 { flags.push("EA_CHANGE".to_string()); }
    if (reason & 0x00000800) != 0 { flags.push("SECURITY_CHANGE".to_string()); }
    if (reason & 0x00001000) != 0 { flags.push("RENAME_OLD_NAME".to_string()); }
    if (reason & 0x00002000) != 0 { flags.push("RENAME_NEW_NAME".to_string()); }
    if (reason & 0x00004000) != 0 { flags.push("INDEXABLE_CHANGE".to_string()); }
    if (reason & 0x00008000) != 0 { flags.push("BASIC_INFO_CHANGE".to_string()); }
    if (reason & 0x00010000) != 0 { flags.push("HARD_LINK_CHANGE".to_string()); }
    if (reason & 0x00020000) != 0 { flags.push("COMPRESSION_CHANGE".to_string()); }
    if (reason & 0x00040000) != 0 { flags.push("ENCRYPTION_CHANGE".to_string()); }
    if (reason & 0x00080000) != 0 { flags.push("OBJECT_ID_CHANGE".to_string()); }
    if (reason & 0x00100000) != 0 { flags.push("REPARSE_POINT_CHANGE".to_string()); }
    if (reason & 0x00200000) != 0 { flags.push("STREAM_CHANGE".to_string()); }
    if (reason & 0x80000000) != 0 { flags.push("CLOSE".to_string()); }
    if flags.is_empty() {
        flags.push("UNKNOWN".to_string());
    }
    flags
}

/// Convert a 64-bit Windows FILETIME (100-nanosecond intervals since 1601-01-01 UTC)
/// to an ISO 8601 string.
pub fn filetime_to_iso(filetime: i64) -> String {
    if filetime <= 0 {
        return "1970-01-01T00:00:00Z".to_string();
    }
    // Windows epoch is 1601-01-01; UNIX epoch is 1970-01-01. Difference: 11,644,473,600 seconds.
    let intervals_per_sec = 10_000_000i64;
    let sec = (filetime / intervals_per_sec) - 11_644_473_600i64;
    if sec < 0 {
        return "1970-01-01T00:00:00Z".to_string();
    }
    chrono::DateTime::from_timestamp(sec, 0)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

/// Parse a buffer returned by DeviceIoControl(FSCTL_READ_USN_JOURNAL).
/// The first 8 bytes contain the next USN, followed by consecutive USN_RECORD_V2 entries.
pub fn parse_usn_buffer(buf: &[u8]) -> (i64, Vec<UsnRecordEntry>) {
    if buf.len() < 8 {
        return (0, Vec::new());
    }

    let next_usn = i64::from_le_bytes(buf[0..8].try_into().unwrap_or([0; 8]));
    let mut offset = 8usize;
    let mut records = Vec::new();

    // USN_RECORD_V2 header is 60 bytes minimum
    while offset + 60 <= buf.len() {
        let record_len = u32::from_le_bytes(buf[offset..offset + 4].try_into().unwrap_or([0; 4])) as usize;
        if record_len < 60 || offset + record_len > buf.len() {
            break;
        }

        let major_ver = u16::from_le_bytes(buf[offset + 4..offset + 6].try_into().unwrap_or([0; 2]));
        // Supports V2 (major == 2)
        if major_ver == 2 {
            let file_ref = u64::from_le_bytes(buf[offset + 8..offset + 16].try_into().unwrap_or([0; 8]));
            let parent_ref = u64::from_le_bytes(buf[offset + 16..offset + 24].try_into().unwrap_or([0; 8]));
            let usn = i64::from_le_bytes(buf[offset + 24..offset + 32].try_into().unwrap_or([0; 8]));
            let timestamp_raw = i64::from_le_bytes(buf[offset + 32..offset + 40].try_into().unwrap_or([0; 8]));
            let reason = u32::from_le_bytes(buf[offset + 40..offset + 44].try_into().unwrap_or([0; 4]));
            let file_attr = u32::from_le_bytes(buf[offset + 52..offset + 56].try_into().unwrap_or([0; 4]));
            let fn_len = u16::from_le_bytes(buf[offset + 56..offset + 58].try_into().unwrap_or([0; 2])) as usize;
            let fn_offset = u16::from_le_bytes(buf[offset + 58..offset + 60].try_into().unwrap_or([0; 2])) as usize;

            let file_name = if fn_len > 0 && offset + fn_offset + fn_len <= offset + record_len {
                let name_bytes = &buf[offset + fn_offset..offset + fn_offset + fn_len];
                let u16_chars: Vec<u16> = name_bytes
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|&[b0, b1]| u16::from_le_bytes([b0, b1]))
                    .collect();
                String::from_utf16_lossy(&u16_chars)
            } else {
                String::new()
            };

            records.push(UsnRecordEntry {
                usn,
                file_reference_number: file_ref,
                parent_file_reference_number: parent_ref,
                file_name,
                reasons: parse_usn_reasons(reason),
                reason_raw: reason,
                timestamp: filetime_to_iso(timestamp_raw),
                file_attributes: file_attr,
            });
        }

        offset += record_len;
    }

    (next_usn, records)
}

#[cfg(windows)]
pub fn query_usn_journal(volume_path: &str) -> Result<UsnJournalInfo, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Foundation::{CloseHandle, GENERIC_READ};
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows::Win32::System::Ioctl::{FSCTL_QUERY_USN_JOURNAL, USN_JOURNAL_DATA_V0};
    use windows::Win32::System::IO::DeviceIoControl;

    let clean = volume_path.trim_end_matches(['\\', '/']);
    let device_path = format!("\\\\.\\{clean}");

    let wide: Vec<u16> = std::ffi::OsStr::new(&device_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let handle = unsafe {
        CreateFileW(
            windows::core::PCWSTR::from_raw(wide.as_ptr()),
            GENERIC_READ.0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            None,
        )
    };

    if handle.is_err() {
        return Err(format!("cannot open handle to volume {volume_path} (requires Administrator rights)"));
    }
    let h = handle.unwrap();

    let mut usn_data = USN_JOURNAL_DATA_V0::default();
    let mut bytes_returned: u32 = 0;

    let success = unsafe {
        DeviceIoControl(
            h,
            FSCTL_QUERY_USN_JOURNAL,
            None,
            0,
            Some(&mut usn_data as *mut _ as *mut _),
            std::mem::size_of::<USN_JOURNAL_DATA_V0>() as u32,
            Some(&mut bytes_returned),
            None,
        )
    };

    let _ = unsafe { CloseHandle(h) };

    if success.is_err() {
        return Err(format!("DeviceIoControl(FSCTL_QUERY_USN_JOURNAL) failed for {volume_path}"));
    }

    Ok(UsnJournalInfo {
        volume: volume_path.to_string(),
        journal_id: usn_data.UsnJournalID,
        lowest_valid_usn: usn_data.LowestValidUsn,
        next_usn: usn_data.NextUsn,
        maximum_usn: usn_data.MaxUsn,
        maximum_size: usn_data.MaximumSize,
        allocation_delta: usn_data.AllocationDelta,
    })
}

#[cfg(windows)]
#[repr(C)]
struct ReadUsnJournalDataV0 {
    start_usn: i64,
    reason_mask: u32,
    return_only_on_close: u32,
    timeout: u64,
    bytes_to_wait_for: u64,
    usn_journal_id: u64,
}

#[cfg(windows)]
pub fn read_usn_records(
    volume_path: &str,
    start_usn: Option<i64>,
    max_records: usize,
    reason_mask: Option<u32>,
) -> Result<UsnRecordsBatch, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::Foundation::{CloseHandle, GENERIC_READ};
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows::Win32::System::IO::DeviceIoControl;

    let info = query_usn_journal(volume_path)?;
    let clean = volume_path.trim_end_matches(['\\', '/']);
    let device_path = format!("\\\\.\\{clean}");

    let wide: Vec<u16> = std::ffi::OsStr::new(&device_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let handle = unsafe {
        CreateFileW(
            windows::core::PCWSTR::from_raw(wide.as_ptr()),
            GENERIC_READ.0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
            None,
        )
    };

    if handle.is_err() {
        return Err(format!("cannot open handle to volume {volume_path} (requires Administrator rights)"));
    }
    let h = handle.unwrap();

    // Default start USN: either user specified, or recent history (lowest valid or next - 64KB approx)
    let s_usn = start_usn.unwrap_or_else(|| {
        if info.next_usn > 65536 {
            info.next_usn - 65536
        } else {
            info.lowest_valid_usn
        }
    });

    let read_data = ReadUsnJournalDataV0 {
        start_usn: s_usn,
        reason_mask: reason_mask.unwrap_or(0xFFFFFFFF),
        return_only_on_close: 0,
        timeout: 0,
        bytes_to_wait_for: 0,
        usn_journal_id: info.journal_id,
    };

    // FSCTL_READ_USN_JOURNAL = 0x000900bb
    const FSCTL_READ_USN_JOURNAL: u32 = 0x000900bb;

    let mut out_buffer = vec![0u8; 64 * 1024];
    let mut bytes_returned: u32 = 0;

    let success = unsafe {
        DeviceIoControl(
            h,
            FSCTL_READ_USN_JOURNAL,
            Some(&read_data as *const _ as *const _),
            std::mem::size_of::<ReadUsnJournalDataV0>() as u32,
            Some(out_buffer.as_mut_ptr() as *mut _),
            out_buffer.len() as u32,
            Some(&mut bytes_returned),
            None,
        )
    };

    let _ = unsafe { CloseHandle(h) };

    if success.is_err() {
        return Err(format!("FSCTL_READ_USN_JOURNAL failed for {volume_path}"));
    }

    out_buffer.truncate(bytes_returned as usize);
    let (next_usn, mut records) = parse_usn_buffer(&out_buffer);
    if records.len() > max_records && max_records > 0 {
        records.truncate(max_records);
    }

    Ok(UsnRecordsBatch {
        volume: volume_path.to_string(),
        next_usn,
        records,
    })
}

#[cfg(not(windows))]
pub fn query_usn_journal(volume_path: &str) -> Result<UsnJournalInfo, String> {
    Err(format!("USN Journal query is only supported on Windows NTFS (target: {volume_path})"))
}

#[cfg(not(windows))]
pub fn read_usn_records(
    volume_path: &str,
    _start_usn: Option<i64>,
    _max_records: usize,
    _reason_mask: Option<u32>,
) -> Result<UsnRecordsBatch, String> {
    Err(format!("USN Journal read is only supported on Windows NTFS (target: {volume_path})"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_usn_reasons() {
        let reasons = parse_usn_reasons(0x00000100 | 0x80000000);
        assert!(reasons.contains(&"FILE_CREATE".to_string()));
        assert!(reasons.contains(&"CLOSE".to_string()));
    }

    #[test]
    fn test_parse_synthetic_usn_buffer() {
        // Construct a synthetic USN buffer:
        // [0..8]: NextUSN (int64) = 123456
        // [8..]: USN_RECORD_V2
        let mut buf = Vec::new();
        buf.extend_from_slice(&123456i64.to_le_bytes()); // NextUSN

        let record_start = buf.len();
        let filename_utf16: Vec<u16> = "nexus_test.txt".encode_utf16().collect();
        let fn_bytes_len = (filename_utf16.len() * 2) as u16;
        let fn_offset = 60u16;
        let total_record_len = (fn_offset as usize + fn_bytes_len as usize) as u32;

        buf.extend_from_slice(&total_record_len.to_le_bytes()); // RecordLength
        buf.extend_from_slice(&2u16.to_le_bytes()); // MajorVersion = 2
        buf.extend_from_slice(&0u16.to_le_bytes()); // MinorVersion = 0
        buf.extend_from_slice(&1001u64.to_le_bytes()); // FileRef
        buf.extend_from_slice(&2002u64.to_le_bytes()); // ParentFileRef
        buf.extend_from_slice(&123450i64.to_le_bytes()); // Usn
        buf.extend_from_slice(&133000000000000000i64.to_le_bytes()); // TimeStamp (FILETIME)
        buf.extend_from_slice(&0x00000100u32.to_le_bytes()); // Reason (FILE_CREATE)
        buf.extend_from_slice(&0u32.to_le_bytes()); // SourceInfo
        buf.extend_from_slice(&0u32.to_le_bytes()); // SecurityId
        buf.extend_from_slice(&32u32.to_le_bytes()); // FileAttributes (FILE_ATTRIBUTE_ARCHIVE)
        buf.extend_from_slice(&fn_bytes_len.to_le_bytes()); // FileNameLength
        buf.extend_from_slice(&fn_offset.to_le_bytes()); // FileNameOffset

        for ch in filename_utf16 {
            buf.extend_from_slice(&ch.to_le_bytes());
        }

        assert_eq!(buf.len() - record_start, total_record_len as usize);

        let (next_usn, records) = parse_usn_buffer(&buf);
        assert_eq!(next_usn, 123456);
        assert_eq!(records.len(), 1);
        let rec = &records[0];
        assert_eq!(rec.usn, 123450);
        assert_eq!(rec.file_reference_number, 1001);
        assert_eq!(rec.parent_file_reference_number, 2002);
        assert_eq!(rec.file_name, "nexus_test.txt");
        assert!(rec.reasons.contains(&"FILE_CREATE".to_string()));
    }
}
