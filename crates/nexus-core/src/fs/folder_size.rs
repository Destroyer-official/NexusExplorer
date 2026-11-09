//! Recursive, cancellable folder size calculation.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use crate::error::{CoreError, CoreResult};
use crate::models::FolderSize;

/// Progress callback: `(files, folders, bytes)`.
pub type SizeProgress<'a> = &'a mut dyn FnMut(u64, u64, u64);

/// Walks `path` recursively and totals file count, folder count and bytes.
///
/// The walk is parallel (jwalk) but cancellation is checked on every entry, so
/// closing a tab never leaves a background scan pinning a core.
pub fn calculate_folder_size(
    path: &str,
    cancel: &AtomicBool,
    progress: SizeProgress<'_>,
) -> CoreResult<FolderSize> {
    let started = Instant::now();
    let root = Path::new(path);
    if !root.is_dir() {
        return Err(CoreError::NotADirectory(root.to_path_buf()));
    }

    let mut files = 0u64;
    let mut folders = 0u64;
    let mut size = 0u64;
    let mut last_report = Instant::now();

    for entry in walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(Result::ok)
    {
        if cancel.load(Ordering::Relaxed) {
            return Err(CoreError::Cancelled);
        }
        if entry.depth() == 0 {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        if meta.is_dir() {
            folders += 1;
        } else {
            files += 1;
            size += meta.len();
        }
        if last_report.elapsed().as_millis() >= 120 {
            progress(files, folders, size);
            last_report = Instant::now();
        }
    }
    progress(files, folders, size);

    Ok(FolderSize {
        path: path.to_string(),
        size,
        files,
        folders,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn totals_nested_folders() {
        let dir = std::env::temp_dir().join(format!("nexus-size-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(dir.join("nested")).unwrap();
        fs::write(dir.join("a.txt"), b"1234").unwrap();
        fs::write(dir.join("nested/b.txt"), b"123456").unwrap();

        let cancel = AtomicBool::new(false);
        let report = calculate_folder_size(&dir.to_string_lossy(), &cancel, &mut |_, _, _| {})
            .expect("size calculation");
        assert_eq!(report.files, 2);
        assert_eq!(report.folders, 1);
        assert_eq!(report.size, 10);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_d_buildtools() {
        if Path::new(r"D:\BuildTools").is_dir() {
            let cancel = AtomicBool::new(false);
            let report = calculate_folder_size(r"D:\BuildTools", &cancel, &mut |_, _, _| {})
                .expect("size calculation for D:\\BuildTools");
            println!(
                "Report: files={}, folders={}, size={}, elapsed={}ms",
                report.files, report.folders, report.size, report.elapsed_ms
            );
        }
    }
}
