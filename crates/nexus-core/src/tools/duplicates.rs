//! Duplicate file discovery.
//!
//! Scan strategy is the same staged pipeline used by the legacy Qt tool:
//! 1. group by exact size (cheap metadata pass),
//! 2. hash only size collisions with XXH3-128 (streaming, no full read into RAM),
//! 3. group by `(size, digest)` and report reclaimable space.
//!
//! This avoids hashing the whole volume while remaining collision-safe for
//! practical duplicate cleanup.

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use serde::{Deserialize, Serialize};

use crate::fs::listing::{build_entry, system_time_to_epoch_ms};
use crate::models::FileEntry;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub size: u64,
    pub hash: String,
    pub files: Vec<DuplicateFile>,
    /// Bytes that can be recovered by keeping exactly one copy.
    pub wasted_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateReport {
    pub root: String,
    pub scanned_files: u64,
    pub groups: Vec<DuplicateGroup>,
    pub total_groups: usize,
    pub duplicate_files: usize,
    pub reclaimable_bytes: u64,
    pub elapsed_ms: u64,
}

fn hash_file_xxh3(path: &Path) -> std::io::Result<(u128, u64)> {
    let mut file = File::open(path)?;
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    let mut read_total = 0u64;
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
        read_total += n as u64;
    }
    Ok((hasher.digest128(), read_total))
}

/// Finds duplicate files under `root`.
///
/// `min_size` filters out tiny files (defaults to 1 byte); `max_depth` limits
/// recursion (0 = unlimited). Returns an error only for an invalid root — every
/// unreadable individual entry is skipped, matching Explorer behaviour.
pub fn find_duplicates<F>(
    root: &Path,
    min_size: u64,
    max_depth: Option<usize>,
    cancel: Option<Arc<AtomicBool>>,
    mut progress: F,
) -> Result<DuplicateReport, String>
where
    F: FnMut(u64, u64),
{
    let started = Instant::now();
    if !root.is_dir() {
        return Err(format!("not a directory: {}", root.display()));
    }

    let mut by_size: HashMap<u64, Vec<(PathBuf, u64)>> = HashMap::new();
    let mut scanned = 0u64;

    let mut walker = walkdir::WalkDir::new(root);
    if let Some(depth) = max_depth {
        if depth > 0 {
            walker = walker.max_depth(depth);
        }
    }

    for item in walker {
        if let Some(flag) = &cancel {
            if flag.load(Ordering::Relaxed) {
                return Err("duplicate scan cancelled".into());
            }
        }
        let Ok(entry) = item else { continue };
        if entry.file_type().is_dir() {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        let size = meta.len();
        if size < min_size {
            continue;
        }
        scanned += 1;
        by_size
            .entry(size)
            .or_default()
            .push((entry.path().to_path_buf(), system_time_to_epoch_ms(meta.modified())));
        if scanned.is_multiple_of(512) {
            progress(scanned, scanned);
        }
    }

    let candidates: u64 = by_size
        .values()
        .filter(|bucket| bucket.len() > 1)
        .map(|bucket| bucket.len() as u64)
        .sum();
    progress(scanned, candidates);

    let mut groups: Vec<DuplicateGroup> = Vec::new();
    let mut hashed = 0u64;

    for (size, bucket) in by_size.into_iter() {
        if bucket.len() < 2 {
            continue;
        }
        let mut by_hash: HashMap<u128, Vec<DuplicateFile>> = HashMap::new();
        for (path, modified_ms) in bucket {
            if let Some(flag) = &cancel {
                if flag.load(Ordering::Relaxed) {
                    return Err("duplicate scan cancelled".into());
                }
            }
            let Ok((digest, _)) = hash_file_xxh3(&path) else {
                continue;
            };
            hashed += 1;
            progress(scanned, hashed);
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.to_string_lossy().into_owned());
            by_hash.entry(digest).or_default().push(DuplicateFile {
                name,
                path: path.to_string_lossy().into_owned(),
                size,
                modified_ms,
            });
        }
        for (digest, mut files) in by_hash {
            if files.len() < 2 {
                continue;
            }
            files.sort_by(|a, b| {
                a.modified_ms
                    .cmp(&b.modified_ms)
                    .then_with(|| a.path.to_lowercase().cmp(&b.path.to_lowercase()))
            });
            let wasted = size.saturating_mul(files.len() as u64 - 1);
            groups.push(DuplicateGroup {
                size,
                hash: format!("{digest:032x}"),
                files,
                wasted_bytes: wasted,
            });
        }
    }

    groups.sort_by(|a, b| {
        b.wasted_bytes
            .cmp(&a.wasted_bytes)
            .then_with(|| b.files.len().cmp(&a.files.len()))
    });

    let duplicate_files = groups.iter().map(|g| g.files.len()).sum();
    let reclaimable_bytes = groups.iter().map(|g| g.wasted_bytes).sum();

    Ok(DuplicateReport {
        root: root.to_string_lossy().into_owned(),
        scanned_files: scanned,
        total_groups: groups.len(),
        duplicate_files,
        reclaimable_bytes,
        groups,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Converts a group member into a normal [`FileEntry`] so the UI can reuse its
/// existing row components when showing duplicate candidates.
pub fn duplicate_file_entry(file: &DuplicateFile) -> Option<FileEntry> {
    let target = Path::new(&file.path);
    let meta = std::fs::metadata(target).ok()?;
    Some(build_entry(
        file.name.clone(),
        file.path.clone(),
        target
            .parent()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default(),
        &meta,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_duplicates_by_content_and_ignores_unique() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("a.txt"), b"same payload").unwrap();
        std::fs::write(root.join("b.txt"), b"same payload").unwrap();
        std::fs::write(root.join("c.txt"), b"unique payload").unwrap();

        let report = find_duplicates(root, 1, None, None, |_, _| {}).unwrap();
        assert_eq!(report.total_groups, 1);
        assert_eq!(report.duplicate_files, 2);
        assert_eq!(report.reclaimable_bytes, 12);
        assert_eq!(report.groups[0].files.len(), 2);
        assert!(report.groups[0].files[0].name <= report.groups[0].files[1].name);
    }

    #[test]
    fn respects_min_size() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("a.txt"), b"x").unwrap();
        std::fs::write(root.join("b.txt"), b"x").unwrap();
        let report = find_duplicates(root, 1024, None, None, |_, _| {}).unwrap();
        assert_eq!(report.total_groups, 0);
    }
}
