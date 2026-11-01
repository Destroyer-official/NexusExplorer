//! NTFS Links, Directory Junctions and Reparse Points manager.

use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LinkType {
    DirectoryJunction,
    DirectorySymlink,
    FileSymlink,
    Hardlink,
    Regular,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkItem {
    pub path: String,
    pub name: String,
    pub link_type: LinkType,
    pub target_path: String,
    pub is_broken: bool,
    pub is_directory: bool,
    pub hardlink_count: u32,
}

#[cfg(windows)]
pub fn get_link_info(path_str: &str) -> Result<LinkItem, String> {
    use std::os::windows::fs::MetadataExt;

    let path = Path::new(path_str);
    let meta = fs::symlink_metadata(path).map_err(|e| format!("cannot read metadata: {e}"))?;
    let is_dir = meta.is_dir();
    let attrs = meta.file_attributes();
    let is_reparse = (attrs & 0x400) != 0; // FILE_ATTRIBUTE_REPARSE_POINT

    let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();

    if is_reparse {
        if let Ok(target) = fs::read_link(path) {
            let target_str = target.to_string_lossy().to_string();
            let is_broken = !target.exists();
            let link_type = if is_dir {
                // If it's a directory reparse point that's not a symlink, it's a junction
                if meta.file_type().is_symlink() {
                    LinkType::DirectorySymlink
                } else {
                    LinkType::DirectoryJunction
                }
            } else {
                LinkType::FileSymlink
            };

            return Ok(LinkItem {
                path: path_str.to_string(),
                name,
                link_type,
                target_path: target_str,
                is_broken,
                is_directory: is_dir,
                hardlink_count: 1,
            });
        }
    }

    // Check hardlinks for files
    #[cfg(windows)]
    let hardlink_count = {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::Storage::FileSystem::{GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION};

        if !is_dir {
            if let Ok(file) = fs::File::open(path) {
                let mut info = BY_HANDLE_FILE_INFORMATION::default();
                unsafe {
                    if GetFileInformationByHandle(windows::Win32::Foundation::HANDLE(file.as_raw_handle()), &mut info).is_ok() {
                        info.nNumberOfLinks
                    } else {
                        1
                    }
                }
            } else {
                1
            }
        } else {
            1
        }
    };
    #[cfg(not(windows))]
    let hardlink_count = 1;

    let link_type = if hardlink_count > 1 {
        LinkType::Hardlink
    } else {
        LinkType::Regular
    };

    Ok(LinkItem {
        path: path_str.to_string(),
        name,
        link_type,
        target_path: String::new(),
        is_broken: false,
        is_directory: is_dir,
        hardlink_count,
    })
}

#[cfg(not(windows))]
pub fn get_link_info(path_str: &str) -> Result<LinkItem, String> {
    let path = Path::new(path_str);
    let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    Ok(LinkItem {
        path: path_str.into(),
        name: path.file_name().and_then(|s| s.to_str()).unwrap_or("").into(),
        link_type: if meta.is_symlink() { LinkType::FileSymlink } else { LinkType::Regular },
        target_path: fs::read_link(path).map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        is_broken: false,
        is_directory: meta.is_dir(),
        hardlink_count: 1,
    })
}

pub fn create_symlink(link_path: &str, target_path: &str, is_dir: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        if is_dir {
            std::os::windows::fs::symlink_dir(target_path, link_path)
                .map_err(|e| format!("cannot create dir symlink: {e}"))
        } else {
            std::os::windows::fs::symlink_file(target_path, link_path)
                .map_err(|e| format!("cannot create file symlink: {e}"))
        }
    }
    #[cfg(not(windows))]
    {
        std::os::unix::fs::symlink(target_path, link_path)
            .map_err(|e| format!("cannot create symlink: {e}"))
    }
}

pub fn create_hardlink(link_path: &str, target_path: &str) -> Result<(), String> {
    fs::hard_link(target_path, link_path).map_err(|e| format!("cannot create hard link: {e}"))
}

pub fn create_junction(link_path: &str, target_dir: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let output = std::process::Command::new("cmd")
            .args(["/c", "mklink", "/J", link_path, target_dir])
            .output()
            .map_err(|e| format!("mklink process error: {e}"))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("junction creation failed: {err}"));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        create_symlink(link_path, target_dir, true)
    }
}

/// Safely removes a symlink or junction without deleting the underlying target directory or contents.
pub fn remove_link(link_path: &str) -> Result<(), String> {
    let p = Path::new(link_path);
    let meta = fs::symlink_metadata(p).map_err(|e| format!("cannot read metadata: {e}"))?;

    if meta.is_dir() {
        // remove_dir on a junction or symlink removes the link itself, never target contents
        fs::remove_dir(p).map_err(|e| format!("cannot remove directory link: {e}"))
    } else {
        fs::remove_file(p).map_err(|e| format!("cannot remove file link: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hardlink_and_remove() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("target.txt");
        let link = dir.path().join("link.txt");
        fs::write(&target, b"test").unwrap();

        create_hardlink(link.to_str().unwrap(), target.to_str().unwrap()).unwrap();
        let info = get_link_info(link.to_str().unwrap()).unwrap();
        assert_eq!(info.hardlink_count, 2);
        assert_eq!(info.link_type, LinkType::Hardlink);

        remove_link(link.to_str().unwrap()).unwrap();
        assert!(target.exists());
        assert!(!link.exists());
    }
}
