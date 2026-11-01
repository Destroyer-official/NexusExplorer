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
