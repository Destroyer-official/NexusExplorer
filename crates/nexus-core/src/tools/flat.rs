//! Flat branch view: one sortable list containing every nested item beneath a root.

use std::path::Path;
use std::time::Instant;

use serde::{Deserialize, Serialize};

use crate::fs::listing::build_entry;
use crate::models::FileEntry;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlatEntry {
    pub entry: FileEntry,
    /// Path relative to the scanned root, using forward slashes.
    pub relative_path: String,
    pub depth: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlatListing {
    pub root: String,
    pub entries: Vec<FlatEntry>,
    pub total_files: usize,
    pub total_directories: usize,
    pub total_bytes: u64,
    pub truncated: bool,
    pub elapsed_ms: u64,
}

/// Recursively flattens a branch.
///
/// `max_entries` caps memory use for enormous trees (defaults to 100 000) and
/// sets `truncated` when the cap is hit.
pub fn list_flat_branch(
    root: &Path,
    max_depth: Option<usize>,
    max_entries: Option<usize>,
) -> Result<FlatListing, String> {
    let started = Instant::now();
    if !root.is_dir() {
        return Err(format!("not a directory: {}", root.display()));
    }
    let limit = max_entries.unwrap_or(100_000).max(1);

    let mut walker = walkdir::WalkDir::new(root)
        .min_depth(1);
    if let Some(depth) = max_depth {
        if depth > 0 {
            walker = walker.max_depth(depth);
        }
    }

    let mut entries = Vec::new();
    let mut total_files = 0usize;
    let mut total_directories = 0usize;
    let mut total_bytes = 0u64;
    let mut truncated = false;

    for item in walker {
        let Ok(item) = item else { continue };
        if entries.len() >= limit {
            truncated = true;
            break;
        }
        let path = item.path();
        let Ok(meta) = item.metadata() else { continue };
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let relative = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");
        let depth = relative.matches('/').count() + 1;
        let entry = build_entry(
            name,
            path.to_string_lossy().into_owned(),
            path.parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default(),
            &meta,
        );
        if entry.is_dir {
            total_directories += 1;
        } else {
            total_files += 1;
            total_bytes = total_bytes.saturating_add(entry.size);
        }
        entries.push(FlatEntry {
            entry,
            relative_path: relative,
            depth,
        });
    }

    entries.sort_by(|a, b| {
        a.relative_path
            .chars()
            .map(|c| c.to_ascii_lowercase())
            .cmp(b.relative_path.chars().map(|c| c.to_ascii_lowercase()))
    });

    Ok(FlatListing {
        root: root.to_string_lossy().into_owned(),
        entries,
        total_files,
        total_directories,
        total_bytes,
        truncated,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flattens_nested_branch() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("a/b")).unwrap();
        std::fs::write(root.join("a/one.txt"), b"1").unwrap();
        std::fs::write(root.join("a/b/two.txt"), b"22").unwrap();

        let listing = list_flat_branch(root, None, None).unwrap();
        assert_eq!(listing.total_directories, 2);
        assert_eq!(listing.total_files, 2);
        assert_eq!(listing.total_bytes, 3);
        let deep = listing
            .entries
            .iter()
            .find(|e| e.relative_path == "a/b/two.txt")
            .unwrap();
        assert_eq!(deep.depth, 3);
        assert!(!listing.truncated);
    }

    #[test]
    fn honors_entry_cap() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        for i in 0..10 {
            std::fs::write(root.join(format!("f{i}.txt")), b"x").unwrap();
        }
        let listing = list_flat_branch(root, None, Some(4)).unwrap();
        assert_eq!(listing.entries.len(), 4);
        assert!(listing.truncated);
    }
}
