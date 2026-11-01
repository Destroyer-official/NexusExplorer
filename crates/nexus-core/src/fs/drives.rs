//! Drive and volume enumeration.
//!
//! Probing removable/optical drives can block the whole process behind a
//! hidden "insert media" dialog, so error mode is suppressed for the duration
//! of the probe and always restored.

use crate::models::DriveInfo;

#[cfg(windows)]
use windows::core::PCWSTR;
#[cfg(windows)]
use windows::Win32::Storage::FileSystem::{
    GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
};
#[cfg(windows)]
use windows::Win32::System::Diagnostics::Debug::{
    SetErrorMode, SEM_FAILCRITICALERRORS,
};

/// Enumerates every logical volume with label, filesystem and capacity.
pub fn enumerate_drives() -> Vec<DriveInfo> {
    #[cfg(windows)]
    {
        enumerate_windows_drives()
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

#[cfg(windows)]
struct ErrorModeGuard(windows::Win32::System::Diagnostics::Debug::THREAD_ERROR_MODE);

#[cfg(windows)]
impl Drop for ErrorModeGuard {
    fn drop(&mut self) {
        unsafe {
            SetErrorMode(self.0);
        }
    }
}

#[cfg(windows)]
fn enumerate_windows_drives() -> Vec<DriveInfo> {
    let mut drives = Vec::new();
    let _guard = ErrorModeGuard(unsafe { SetErrorMode(SEM_FAILCRITICALERRORS) });
    let mask = unsafe { GetLogicalDrives() };
    if mask == 0 {
        return drives;
    }

    for index in 0..26u32 {
        if mask & (1 << index) == 0 {
            continue;
        }
        let letter = (b'A' + index as u8) as char;
        let root = format!("{letter}:\\");
        let root_wide = to_wide(&root);
        let root_ptr = PCWSTR(root_wide.as_ptr());
        let Some(drive_type) = map_drive_type(unsafe { GetDriveTypeW(root_ptr) }) else {
            continue;
        };

        let mut info = DriveInfo {
            path: root,
            label: String::new(),
            drive_type: drive_type.to_string(),
            filesystem: String::new(),
            free_bytes: 0,
            total_bytes: 0,
            is_ready: false,
        };

        let mut label_buf = [0u16; 261];
        let mut fs_buf = [0u16; 65];
        let volume_ok = unsafe {
            GetVolumeInformationW(
                root_ptr,
                Some(&mut label_buf),
                None,
                None,
                None,
                Some(&mut fs_buf),
            )
        };

        if volume_ok.is_ok() {
            info.is_ready = true;
            info.label = wide_to_string(&label_buf);
            info.filesystem = wide_to_string(&fs_buf);
            let mut free_available: u64 = 0;
            let mut total_bytes: u64 = 0;
            let mut free_bytes: u64 = 0;
            let space_ok = unsafe {
                GetDiskFreeSpaceExW(
                    root_ptr,
                    Some(&mut free_available),
                    Some(&mut total_bytes),
                    Some(&mut free_bytes),
                )
            };
            if space_ok.is_ok() {
                info.free_bytes = free_bytes;
                info.total_bytes = total_bytes;
            }
        }
        drives.push(info);
    }

    // Auto-detect WSL2 and container distributions
    let wsl_base = if std::path::Path::new(r"\\wsl.localhost").is_dir() {
        Some(std::path::Path::new(r"\\wsl.localhost"))
    } else if std::path::Path::new(r"\\wsl$").is_dir() {
        Some(std::path::Path::new(r"\\wsl$"))
    } else {
        None
    };

    if let Some(base) = wsl_base {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    drives.push(DriveInfo {
                        path: entry.path().to_string_lossy().to_string(),
                        label: format!("WSL: {name}"),
                        drive_type: "wsl".to_string(),
                        filesystem: "ext4".to_string(),
                        free_bytes: 0,
                        total_bytes: 0,
                        is_ready: true,
                    });
                }
            }
        }
    }

    drives
}

#[cfg(windows)]
fn map_drive_type(kind: u32) -> Option<&'static str> {
    match kind {
        2 => Some("removable"),
        3 => Some("fixed"),
        4 => Some("network"),
        5 => Some("cdrom"),
        6 => Some("ramdisk"),
        0 | 1 => None,
        _ => Some("unknown"),
    }
}

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn wide_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}
