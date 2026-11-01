//! Dev Drive (VHDX / ReFS) and Developer Package Cache Auditor.
//! Detects Windows 11 Dev Drives, ReFS partitions, and audits package caches
//! (Cargo, npm, pip, NuGet, Gradle, Bun, uv) for zero-copy CoW optimizations.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevDriveVolume {
    pub drive_letter: String,
    pub volume_label: String,
    pub filesystem: String,
    pub is_dev_drive: bool,
    pub is_refs: bool,
    pub cow_supported: bool,
    pub total_bytes: u64,
    pub free_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageCacheAudit {
    pub ecosystem: String,
    pub env_var: String,
    pub current_path: String,
    pub exists: bool,
    pub is_on_dev_drive: bool,
    pub recommended_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevDriveReport {
    pub dev_drives_detected: Vec<DevDriveVolume>,
    pub package_caches: Vec<PackageCacheAudit>,
    pub has_dev_drive: bool,
    pub recommended_actions: Vec<String>,
}

pub fn detect_dev_drives() -> Vec<DevDriveVolume> {
    let mut volumes = Vec::new();

    #[cfg(windows)]
    {
        use windows::Win32::Storage::FileSystem::{
            GetDiskFreeSpaceExW, GetLogicalDriveStringsW, GetVolumeInformationW,
        };

        let mut buffer = [0u16; 512];
        let len = unsafe { GetLogicalDriveStringsW(Some(&mut buffer)) } as usize;
        if len > 0 {
            let slice = &buffer[..len];
            for raw_drive in slice.split(|&c| c == 0) {
                if raw_drive.is_empty() {
                    continue;
                }
                let drive_str = String::from_utf16_lossy(raw_drive);
                let drive_letter = drive_str.trim_end_matches('\\').to_string();

                let mut vol_name = [0u16; 260];
                let mut fs_name = [0u16; 260];
                let mut flags = 0u32;

                let ok = unsafe {
                    GetVolumeInformationW(
                        windows::core::PCWSTR::from_raw(raw_drive.as_ptr()),
                        Some(&mut vol_name),
                        None,
                        None,
                        Some(&mut flags),
                        Some(&mut fs_name),
                    )
                };

                if ok.is_ok() {
                    let vol_label = String::from_utf16_lossy(
                        &vol_name[..vol_name.iter().position(|&c| c == 0).unwrap_or(vol_name.len())],
                    );
                    let fs = String::from_utf16_lossy(
                        &fs_name[..fs_name.iter().position(|&c| c == 0).unwrap_or(fs_name.len())],
                    );

                    let is_refs = fs.eq_ignore_ascii_case("ReFS");
                    // Dev Drive flag: FILE_VOLUME_IS_DEV_DRIVE (0x00080000 in newer SDKs) or ReFS
                    let is_dev = (flags & 0x00080000) != 0 || (is_refs && vol_label.to_lowercase().contains("dev"));
                    let cow_supported = is_refs || is_dev;

                    let mut free_bytes = 0u64;
                    let mut total_bytes = 0u64;
                    unsafe {
                        let _ = GetDiskFreeSpaceExW(
                            windows::core::PCWSTR::from_raw(raw_drive.as_ptr()),
                            None,
                            Some(&mut total_bytes),
                            Some(&mut free_bytes),
                        );
                    }

                    volumes.push(DevDriveVolume {
                        drive_letter,
                        volume_label: vol_label,
                        filesystem: fs,
                        is_dev_drive: is_dev,
                        is_refs,
                        cow_supported,
                        total_bytes,
                        free_bytes,
                    });
                }
            }
        }
    }

    volumes
}

fn path_starts_with_drive(path: &Path, drive_letter: &str) -> bool {
    let path_str = path.to_string_lossy();
    path_str.to_uppercase().starts_with(&drive_letter.to_uppercase())
}

pub fn audit_package_caches(dev_drives: &[DevDriveVolume]) -> Vec<PackageCacheAudit> {
    let first_dev = dev_drives.iter().find(|d| d.is_dev_drive || d.cow_supported);
    let dev_letter = first_dev.map(|d| d.drive_letter.as_str());

    let user_home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
    let local_app_data = dirs::data_local_dir().unwrap_or_else(|| user_home.join("AppData\\Local"));

    let checks: [(&str, &str, PathBuf, &str); 7] = [
        ("Cargo", "CARGO_HOME", std::env::var("CARGO_HOME").map(PathBuf::from).unwrap_or_else(|_| user_home.join(".cargo")), "CargoHome"),
        ("npm", "npm_config_cache", std::env::var("npm_config_cache").map(PathBuf::from).unwrap_or_else(|_| local_app_data.join("npm-cache")), "npmCache"),
        ("pip / uv", "PIP_CACHE_DIR", std::env::var("PIP_CACHE_DIR").map(PathBuf::from).unwrap_or_else(|_| local_app_data.join("pip\\cache")), "pipCache"),
        ("NuGet", "NUGET_PACKAGES", std::env::var("NUGET_PACKAGES").map(PathBuf::from).unwrap_or_else(|_| user_home.join(".nuget\\packages")), "NuGetPackages"),
        ("Gradle", "GRADLE_USER_HOME", std::env::var("GRADLE_USER_HOME").map(PathBuf::from).unwrap_or_else(|_| user_home.join(".gradle")), "GradleHome"),
        ("Maven", "M2_HOME", user_home.join(".m2\\repository"), "MavenRepo"),
        ("Bun", "BUN_INSTALL", std::env::var("BUN_INSTALL").map(PathBuf::from).unwrap_or_else(|_| user_home.join(".bun")), "BunInstall"),
    ];

    let mut results = Vec::new();

    for (eco, env_var, path, folder_name) in checks {
        let exists = path.exists();
        let is_on_dev = dev_drives.iter().any(|d| (d.is_dev_drive || d.cow_supported) && path_starts_with_drive(&path, &d.drive_letter));

        let recommended = if !is_on_dev {
            dev_letter.map(|dl| format!("{dl}\\packages\\{folder_name}"))
        } else {
            None
        };

        results.push(PackageCacheAudit {
            ecosystem: eco.to_string(),
            env_var: env_var.to_string(),
            current_path: path.to_string_lossy().to_string(),
            exists,
            is_on_dev_drive: is_on_dev,
            recommended_path: recommended,
        });
    }

    results
}

pub fn generate_dev_drive_report() -> DevDriveReport {
    let dev_drives = detect_dev_drives();
    let has_dev_drive = dev_drives.iter().any(|d| d.is_dev_drive || d.cow_supported);
    let caches = audit_package_caches(&dev_drives);

    let mut actions = Vec::new();

    if !has_dev_drive {
        actions.push("No ReFS or Windows 11 Dev Drive detected. Consider creating a VHDX Dev Drive in Windows Settings -> System -> Storage -> Disks & Volumes for up to 30% faster builds and instant zero-byte CoW cloning.".to_string());
    } else {
        let first_dev = dev_drives.iter().find(|d| d.is_dev_drive || d.cow_supported).unwrap();
        actions.push(format!("Dev Drive detected at {} (ReFS: {}). Instant block cloning is active.", first_dev.drive_letter, first_dev.is_refs));

        for c in &caches {
            if !c.is_on_dev_drive {
                if let Some(rec) = &c.recommended_path {
                    actions.push(format!("Set environment variable {}={} to utilize Dev Drive CoW acceleration.", c.env_var, rec));
                }
            }
        }
    }

    DevDriveReport {
        dev_drives_detected: dev_drives,
        package_caches: caches,
        has_dev_drive,
        recommended_actions: actions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_package_caches() {
        let mock_dev_drive = DevDriveVolume {
            drive_letter: "D:".to_string(),
            volume_label: "DevDrive".to_string(),
            filesystem: "ReFS".to_string(),
            is_dev_drive: true,
            is_refs: true,
            cow_supported: true,
            total_bytes: 1_000_000_000,
            free_bytes: 500_000_000,
        };

        let report = generate_dev_drive_report();
        assert!(!report.package_caches.is_empty());
        assert_eq!(report.package_caches[0].ecosystem, "Cargo");

        let caches = audit_package_caches(&[mock_dev_drive]);
        assert_eq!(caches[0].ecosystem, "Cargo");
        if !caches[0].is_on_dev_drive {
            assert!(caches[0].recommended_path.as_ref().unwrap().starts_with("D:\\packages\\"));
        }
    }
}

