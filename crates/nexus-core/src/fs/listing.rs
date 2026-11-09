//! Directory listing and metadata primitives.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::{CoreError, CoreResult};
use crate::models::FileEntry;

#[cfg(windows)]
use std::os::windows::fs::MetadataExt as WindowsMetadataExt;

const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;

/// Reads one directory level and returns rows sorted directories-first then
/// case-insensitively by name. This is the single listing primitive used by the
/// desktop UI, the CLI and the FFI layer.
pub fn read_dir(path: &str) -> CoreResult<Vec<FileEntry>> {
    if path.trim().is_empty() {
        return Err(CoreError::EmptyPath);
    }
    #[cfg(windows)]
    if path.starts_with("wpd://") {
        return read_wpd_dir(path);
    }
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return if root.exists() {
            Err(CoreError::NotADirectory(root))
        } else {
            Err(CoreError::NotFound(root))
        };
    }

    let read = fs::read_dir(&root).map_err(|e| CoreError::from_io(&root, e))?;
    let mut entries = Vec::new();
    for item in read {
        match item {
            Ok(de) => match dir_entry_to_file_entry(&de) {
                Ok(entry) => entries.push(entry),
                // A single unreadable row (locked cloud placeholder, …) must
                // never fail the whole folder.
                Err(_) => continue,
            },
            Err(_) => continue,
        }
    }
    sort_entries(&mut entries);
    Ok(entries)
}

/// Returns metadata for a path, or `Ok(None)` when it does not exist.
pub fn stat_path(path: &str) -> CoreResult<Option<FileEntry>> {
    if path.trim().is_empty() {
        return Err(CoreError::EmptyPath);
    }
    #[cfg(windows)]
    if path.starts_with("wpd://") {
        return stat_wpd_path(path);
    }
    let target = PathBuf::from(path);
    match fs::metadata(&target) {
        Ok(meta) => {
            let name = target
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.to_string());
            Ok(Some(build_entry(
                name,
                target.to_string_lossy().into_owned(),
                parent_of(&target),
                &meta,
            )))
        }
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(CoreError::from_io(&target, err)),
    }
}

/// Sorts rows directories-first, then case-insensitive by name.
pub fn sort_entries(entries: &mut [FileEntry]) {
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
}

fn dir_entry_to_file_entry(de: &fs::DirEntry) -> io::Result<FileEntry> {
    let metadata = de.metadata()?;
    let name = de.file_name().to_string_lossy().into_owned();
    let full_path = de.path();
    let path = full_path.to_string_lossy().into_owned();
    let parent_path = full_path
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());
    Ok(build_entry(name, path, parent_path, &metadata))
}

/// Builds a [`FileEntry`] from already-resolved metadata.
pub fn build_entry(
    name: String,
    path: String,
    parent_path: String,
    metadata: &fs::Metadata,
) -> FileEntry {
    let ext = Path::new(&name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    FileEntry {
        is_dir: metadata.is_dir(),
        size: if metadata.is_dir() { 0 } else { metadata.len() },
        modified_ms: system_time_to_epoch_ms(metadata.modified()),
        created_ms: system_time_to_epoch_ms(metadata.created()),
        is_hidden: attributes(metadata) & FILE_ATTRIBUTE_HIDDEN != 0,
        is_system: attributes(metadata) & FILE_ATTRIBUTE_SYSTEM != 0,
        is_readonly: metadata.permissions().readonly(),
        name,
        path,
        parent_path,
        ext,
    }
}

/// Windows file attribute bitfield, or `0` elsewhere.
pub fn attributes(metadata: &fs::Metadata) -> u32 {
    #[cfg(windows)]
    {
        metadata.file_attributes()
    }
    #[cfg(not(windows))]
    {
        let _ = metadata;
        0
    }
}

/// Converts a `SystemTime` into Unix epoch milliseconds, saturating at zero.
pub fn system_time_to_epoch_ms(time: io::Result<SystemTime>) -> u64 {
    time.ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Parent directory of a path as a lossy string (empty at the filesystem root).
pub fn parent_of(path: &Path) -> String {
    path.parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Re-stats an existing path and returns its entry.
pub fn stat_existing(target: &Path) -> CoreResult<FileEntry> {
    let metadata = fs::metadata(target).map_err(|e| CoreError::from_io(target, e))?;
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| CoreError::InvalidInput(format!("path has no file name: {}", target.display())))?;
    Ok(build_entry(
        name,
        target.to_string_lossy().into_owned(),
        parent_of(target),
        &metadata,
    ))
}

#[cfg(windows)]
fn read_wpd_dir(path: &str) -> CoreResult<Vec<FileEntry>> {
    use windows::core::Interface;
    use windows::Win32::Foundation::PROPERTYKEY;
    use windows::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
    };
    use windows::Win32::System::SystemServices::SFGAO_FOLDER;
    use windows::Win32::UI::Shell::{
        BHID_EnumItems, FOLDERID_ComputerFolder, IEnumShellItems, IShellItem, IShellItem2,
        KF_FLAG_DEFAULT, SHGetKnownFolderItem, SIGDN_NORMALDISPLAY,
    };
    use windows::core::GUID;

    let sub = path.strip_prefix("wpd://").unwrap_or(path);
    let segments: Vec<&str> = sub.split(['/', '\\']).filter(|s| !s.is_empty()).collect();

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

        let comp: IShellItem = match SHGetKnownFolderItem::<IShellItem>(&FOLDERID_ComputerFolder, KF_FLAG_DEFAULT, None) {
            Ok(c) => c,
            Err(_) => {
                CoUninitialize();
                return Ok(Vec::new());
            }
        };

        let mut cur_item = comp;
        for seg in &segments {
            let enum_res: Result<IEnumShellItems, _> = cur_item.BindToHandler(None, &BHID_EnumItems);
            let Ok(enum_items) = enum_res else {
                CoUninitialize();
                return Ok(Vec::new());
            };

            let mut item_buf = [None; 1];
            let mut fetched = 0u32;
            let mut next_item = None;

            while enum_items.Next(&mut item_buf, Some(&mut fetched)).is_ok() && fetched > 0 {
                if let Some(child) = item_buf[0].take() {
                    let disp = child
                        .GetDisplayName(SIGDN_NORMALDISPLAY)
                        .ok()
                        .and_then(|pw| pw.to_string().ok())
                        .unwrap_or_default();
                    if disp.eq_ignore_ascii_case(seg) {
                        next_item = Some(child);
                        break;
                    }
                }
            }

            match next_item {
                Some(it) => cur_item = it,
                None => {
                    CoUninitialize();
                    return Ok(Vec::new());
                }
            }
        }

        let f_enum_res: Result<IEnumShellItems, _> = cur_item.BindToHandler(None, &BHID_EnumItems);
        let Ok(f_enum) = f_enum_res else {
            CoUninitialize();
            return Ok(Vec::new());
        };

        let mut entries = Vec::new();
        let mut f_buf = [None; 1];
        let mut f_fetched = 0u32;

        let pkey_size = PROPERTYKEY {
            fmtid: GUID::from_u128(0xB725F130_47EF_101A_A5F1_02608C9EEBAC),
            pid: 12,
        };

        while f_enum.Next(&mut f_buf, Some(&mut f_fetched)).is_ok() && f_fetched > 0 {
            if let Some(item) = f_buf[0].take() {
                let name = item
                    .GetDisplayName(SIGDN_NORMALDISPLAY)
                    .ok()
                    .and_then(|pw| pw.to_string().ok())
                    .unwrap_or_default();
                if name.is_empty() {
                    continue;
                }
                let is_dir = item
                    .GetAttributes(SFGAO_FOLDER)
                    .map(|a| a.contains(SFGAO_FOLDER))
                    .unwrap_or(false);
                let size = if is_dir {
                    0
                } else if let Ok(i2) = item.cast::<IShellItem2>() {
                    i2.GetUInt64(&pkey_size).unwrap_or(0)
                } else {
                    0
                };
                let ext = Path::new(&name)
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();

                let clean_parent = path.trim_end_matches(['/', '\\']).to_string();
                let full_path = format!("{clean_parent}/{name}");

                entries.push(FileEntry {
                    name,
                    path: full_path,
                    parent_path: clean_parent,
                    is_dir,
                    size,
                    modified_ms: 0,
                    created_ms: 0,
                    is_hidden: false,
                    is_system: false,
                    is_readonly: false,
                    ext,
                });
            }
        }

        CoUninitialize();
        sort_entries(&mut entries);
        Ok(entries)
    }
}

#[cfg(windows)]
fn stat_wpd_path(path: &str) -> CoreResult<Option<FileEntry>> {
    let clean = path.trim_end_matches(['/', '\\']);
    let name = clean
        .split(['/', '\\'])
        .next_back()
        .unwrap_or("Portable Device")
        .to_string();
    let parent = if let Some(idx) = clean.rfind(['/', '\\']) {
        clean[..idx].to_string()
    } else {
        "wpd://".to_string()
    };
    Ok(Some(FileEntry {
        name,
        path: clean.to_string(),
        parent_path: parent,
        is_dir: true,
        size: 0,
        modified_ms: 0,
        created_ms: 0,
        is_hidden: false,
        is_system: false,
        is_readonly: false,
        ext: String::new(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_paths() {
        assert!(matches!(read_dir("  "), Err(CoreError::EmptyPath)));
    }

    #[test]
    fn missing_path_is_not_found() {
        let err = read_dir(r"C:\__nexus_definitely_missing__").unwrap_err();
        assert!(matches!(err, CoreError::NotFound(_)));
    }

    #[test]
    fn sorts_directories_before_files() {
        let row = |name: &str, is_dir: bool| FileEntry {
            name: name.into(),
            path: name.into(),
            parent_path: String::new(),
            is_dir,
            size: 0,
            modified_ms: 0,
            created_ms: 0,
            is_hidden: false,
            is_system: false,
            is_readonly: false,
            ext: String::new(),
        };
        let mut rows = vec![row("zeta", false), row("Alpha", true), row("beta", false)];
        sort_entries(&mut rows);
        assert_eq!(rows[0].name, "Alpha");
        assert_eq!(rows[1].name, "beta");
        assert_eq!(rows[2].name, "zeta");
    }
}
