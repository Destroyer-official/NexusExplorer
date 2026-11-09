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
use windows::Win32::System::Diagnostics::Debug::{SetErrorMode, SEM_FAILCRITICALERRORS};

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

        let is_removable = drive_type == "removable";
        let mut info = DriveInfo {
            path: root,
            label: String::new(),
            drive_type: drive_type.to_string(),
            filesystem: String::new(),
            free_bytes: 0,
            total_bytes: 0,
            is_ready: false,
            is_usb: is_removable,
            usb_speed: if is_removable {
                Some("USB 3.0".to_string())
            } else {
                None
            },
            is_degraded_port: false,
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
                    let p = entry.path().to_string_lossy().to_string();
                    let p_wide = to_wide(&p);
                    let mut free_available: u64 = 0;
                    let mut total_bytes: u64 = 0;
                    let mut free_bytes: u64 = 0;
                    let _ = unsafe {
                        GetDiskFreeSpaceExW(
                            PCWSTR(p_wide.as_ptr()),
                            Some(&mut free_available),
                            Some(&mut total_bytes),
                            Some(&mut free_bytes),
                        )
                    };
                    drives.push(DriveInfo {
                        path: p,
                        label: format!("WSL: {name}"),
                        drive_type: "wsl".to_string(),
                        filesystem: "ext4".to_string(),
                        free_bytes,
                        total_bytes,
                        is_ready: true,
                        is_usb: false,
                        usb_speed: None,
                        is_degraded_port: false,
                    });
                }
            }
        }
    }

    // Auto-detect Windows Portable Devices (WPD / MTP / Android / iPhone / Cameras)
    let wpd_drives = enumerate_wpd_devices();
    drives.extend(wpd_drives);

    drives
}

#[cfg(windows)]
fn enumerate_wpd_devices() -> Vec<DriveInfo> {
    use windows::core::Interface;
    use windows::core::GUID;
    use windows::Win32::Foundation::PROPERTYKEY;
    use windows::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
    };
    use windows::Win32::UI::Shell::{
        BHID_EnumItems, FOLDERID_ComputerFolder, IEnumShellItems, IShellItem, IShellItem2,
        SHGetKnownFolderItem, KF_FLAG_DEFAULT, SIGDN_NORMALDISPLAY,
    };

    let mut list = Vec::new();
    unsafe {
        let com_ok =
            CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE).is_ok();

        if let Ok(comp) =
            SHGetKnownFolderItem::<IShellItem>(&FOLDERID_ComputerFolder, KF_FLAG_DEFAULT, None)
        {
            let enum_res: Result<IEnumShellItems, _> = comp.BindToHandler(None, &BHID_EnumItems);
            if let Ok(enum_items) = enum_res {
                let mut item_buf = [None; 1];
                let mut fetched = 0u32;
                while enum_items.Next(&mut item_buf, Some(&mut fetched)).is_ok() && fetched > 0 {
                    if let Some(child) = item_buf[0].take() {
                        let disp = child
                            .GetDisplayName(SIGDN_NORMALDISPLAY)
                            .ok()
                            .and_then(|pw| pw.to_string().ok())
                            .unwrap_or_default();

                        // Skip standard drive letters (e.g. "Local Disk (C:)", "virus_testing (E:)")
                        if disp.contains("(:")
                            || disp.contains("):")
                            || (disp.len() >= 4 && disp.chars().any(|c| c == ':'))
                        {
                            continue;
                        }

                        let sub_res: Result<IEnumShellItems, _> =
                            child.BindToHandler(None, &BHID_EnumItems);
                        let mut has_substorages = false;
                        if let Ok(storage_enum) = sub_res {
                            let mut s_buf = [None; 1];
                            let mut s_fetched = 0u32;
                            while storage_enum.Next(&mut s_buf, Some(&mut s_fetched)).is_ok()
                                && s_fetched > 0
                            {
                                if let Some(s_item) = s_buf[0].take() {
                                    has_substorages = true;
                                    let s_disp = s_item
                                        .GetDisplayName(SIGDN_NORMALDISPLAY)
                                        .ok()
                                        .and_then(|pw| pw.to_string().ok())
                                        .unwrap_or_default();

                                    let mut total_bytes = 0u64;
                                    let mut free_bytes = 0u64;

                                    if let Ok(item2) = s_item.cast::<IShellItem2>() {
                                        let pkey_fmtid =
                                            GUID::from_u128(0x01A3057A_74D6_4E80_BEA7_DC4C212CE50A);
                                        let pkey_capacity = PROPERTYKEY {
                                            fmtid: pkey_fmtid,
                                            pid: 4,
                                        };
                                        let pkey_free = PROPERTYKEY {
                                            fmtid: pkey_fmtid,
                                            pid: 5,
                                        };
                                        total_bytes = item2.GetUInt64(&pkey_capacity).unwrap_or(0);
                                        free_bytes = item2.GetUInt64(&pkey_free).unwrap_or(0);
                                    }

                                    list.push(DriveInfo {
                                        path: format!("wpd://{disp}/{s_disp}"),
                                        label: format!("{disp} ({s_disp})"),
                                        drive_type: "portable".to_string(),
                                        filesystem: "MTP".to_string(),
                                        free_bytes,
                                        total_bytes,
                                        is_ready: true,
                                        is_usb: true,
                                        usb_speed: Some("USB MTP (Hi-Speed)".to_string()),
                                        is_degraded_port: false,
                                    });
                                }
                            }
                        }

                        if !has_substorages {
                            list.push(DriveInfo {
                                path: format!("wpd://{disp}"),
                                label: disp,
                                drive_type: "portable".to_string(),
                                filesystem: "MTP".to_string(),
                                free_bytes: 0,
                                total_bytes: 0,
                                is_ready: true,
                                is_usb: true,
                                usb_speed: Some("USB MTP (Hi-Speed)".to_string()),
                                is_degraded_port: false,
                            });
                        }
                    }
                }
            }
        }

        if com_ok {
            CoUninitialize();
        }
    }
    list
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enumerate_drives_returns_system_drive() {
        let drives = enumerate_drives();
        #[cfg(windows)]
        {
            assert!(
                !drives.is_empty(),
                "expected at least one Windows drive (e.g. C:\\)"
            );
            let c_drive = drives
                .iter()
                .find(|d| d.path.starts_with("C:") || d.path.starts_with("c:"));
            assert!(c_drive.is_some(), "system drive C: should be detected");
            let c = c_drive.unwrap();
            assert!(c.total_bytes > 0, "drive C: should have non-zero capacity");
            assert_eq!(c.drive_type, "fixed");
        }
    }
}
