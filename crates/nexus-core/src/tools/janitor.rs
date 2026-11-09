//! Developer Cache & Build Artifact Janitor (Safe Deep Clean).
//!
//! Detects and safely cleans disk-hogging build directories across the entire OS:
//! - `node_modules` (npm / pnpm / yarn / bun)
//! - `target` (Rust Cargo)
//! - `.venv`, `__pycache__`, `.pytest_cache`, `.mypy_cache` (Python)
//! - `.gradle`, `.m2/repository` (Java / Kotlin / Android)
//! - `bin`, `obj`, `.vs` (C# / .NET / Visual Studio)
//! - `DerivedData` (Xcode)

use std::fs;
use std::io;
use std::path::Path;
use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JanitorTarget {
    pub category: String,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub file_count: usize,
    pub last_modified_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JanitorScanReport {
    pub root_path: String,
    pub targets: Vec<JanitorTarget>,
    pub total_reclaimable_bytes: u64,
    pub scanned_dirs: usize,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JanitorCleanResult {
    pub cleaned_targets: usize,
    pub bytes_freed: u64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmptyDirsReport {
    pub root_path: String,
    pub empty_dirs: Vec<String>,
    pub scanned_dirs: usize,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmptyDirsCleanResult {
    pub removed_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
}

fn classify_artifact(dir_name: &str) -> Option<(&'static str, &'static str)> {
    match dir_name.to_lowercase().as_str() {
        "node_modules" => Some(("Node.js / Web", "node_modules")),
        "target" => Some(("Rust Cargo", "target")),
        ".venv" | "venv" | "env" => Some(("Python VirtualEnv", ".venv")),
        "__pycache__" => Some(("Python Bytecode", "__pycache__")),
        ".pytest_cache" => Some(("Python Pytest", ".pytest_cache")),
        ".mypy_cache" => Some(("Python Mypy", ".mypy_cache")),
        ".gradle" => Some(("Java Gradle", ".gradle")),
        ".vs" => Some(("Visual Studio", ".vs")),
        "bin" => Some((".NET Build Output", "bin")),
        "obj" => Some((".NET Intermediate", "obj")),
        "deriveddata" => Some(("Xcode DerivedData", "DerivedData")),
        _ => None,
    }
}

fn calculate_dir_metrics(path: &Path) -> (u64, usize, u64) {
    let mut size = 0u64;
    let mut count = 0usize;
    let mut latest_ms = 0u64;

    for entry in jwalk::WalkDir::new(path).skip_hidden(false).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            count += 1;
            if let Ok(meta) = entry.metadata() {
                size += meta.len();
                if let Ok(mod_time) = meta.modified() {
                    if let Ok(dur) = mod_time.duration_since(std::time::UNIX_EPOCH) {
                        let ms = dur.as_millis() as u64;
                        if ms > latest_ms {
                            latest_ms = ms;
                        }
                    }
                }
            }
        }
    }
    (size, count, latest_ms)
}

/// Recursively scans root directory for developer build artifacts.
pub fn scan_developer_artifacts<P: AsRef<Path>>(root: P) -> io::Result<JanitorScanReport> {
    let root = root.as_ref();
    let start = Instant::now();
    let mut targets = Vec::new();
    let mut total_reclaimable_bytes = 0u64;
    let mut scanned_dirs = 0usize;

    // Use jwalk with manual pruning so we don't traverse inside target/node_modules once matched
    let mut dirs_to_visit = vec![root.to_path_buf()];

    while let Some(current_dir) = dirs_to_visit.pop() {
        scanned_dirs += 1;
        let read_dir = match fs::read_dir(&current_dir) {
            Ok(rd) => rd,
            Err(_) => continue,
        };

        for entry in read_dir.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let file_name = entry.file_name();
            let name_str = file_name.to_string_lossy();

            if let Some((category, label)) = classify_artifact(&name_str) {
                // If it's a known artifact, compute its size and DO NOT recurse deeper into it
                let (size, count, mod_ms) = calculate_dir_metrics(&path);
                total_reclaimable_bytes += size;
                targets.push(JanitorTarget {
                    category: category.to_string(),
                    name: label.to_string(),
                    path: path.to_string_lossy().to_string(),
                    size_bytes: size,
                    file_count: count,
                    last_modified_ms: mod_ms,
                });
            } else {
                // Continue scanning subdirectories, excluding .git
                if name_str != ".git" {
                    dirs_to_visit.push(path);
                }
            }
        }
    }

    targets.sort_by_key(|a| std::cmp::Reverse(a.size_bytes));

    Ok(JanitorScanReport {
        root_path: root.to_string_lossy().to_string(),
        targets,
        total_reclaimable_bytes,
        scanned_dirs,
        elapsed_ms: start.elapsed().as_millis() as u64,
    })
}

/// Safely cleans / removes specified artifact directories.
pub fn clean_developer_artifacts(paths: &[String]) -> JanitorCleanResult {
    let mut cleaned_targets = 0;
    let mut bytes_freed = 0;
    let mut errors = Vec::new();

    for p_str in paths {
        let p = Path::new(p_str);
        if !p.exists() || !p.is_dir() {
            continue;
        }

        // Safety verification: only allow removing known artifact names
        let file_name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if classify_artifact(&file_name).is_none() {
            errors.push(format!("Refusing to remove non-artifact folder: {p_str}"));
            continue;
        }

        let (size, _, _) = calculate_dir_metrics(p);
        match fs::remove_dir_all(p) {
            Ok(_) => {
                cleaned_targets += 1;
                bytes_freed += size;
            }
            Err(e) => {
                errors.push(format!("Failed to clean {p_str}: {e}"));
            }
        }
    }

    JanitorCleanResult {
        cleaned_targets,
        bytes_freed,
        errors,
    }
}

fn find_empty_dirs_recursive(
    dir: &Path,
    max_results: usize,
    results: &mut Vec<String>,
    scanned: &mut usize,
) -> bool {
    *scanned += 1;
    let read = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return false,
    };

    let mut is_empty = true;
    let mut subdirs = Vec::new();

    for entry in read.filter_map(|e| e.ok()) {
        let path = entry.path();
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if name.starts_with(".git") {
            is_empty = false;
            continue;
        }

        if let Ok(file_type) = entry.file_type() {
            if file_type.is_dir() {
                subdirs.push(path);
            } else {
                is_empty = false;
            }
        } else {
            is_empty = false;
        }
    }

    for subdir in subdirs {
        let child_empty = find_empty_dirs_recursive(&subdir, max_results, results, scanned);
        if !child_empty {
            is_empty = false;
        }
    }

    if is_empty && (max_results == 0 || results.len() < max_results) {
        results.push(dir.to_string_lossy().to_string());
    }

    is_empty
}

/// Recursively scans `root` for empty directories (descendant directories containing no files or subdirectories).
/// Ignores `.git` repositories and does not include `root` itself.
pub fn scan_empty_directories(root: &Path, max_results: usize) -> Result<EmptyDirsReport, String> {
    if !root.exists() || !root.is_dir() {
        return Err("root path does not exist or is not a directory".into());
    }

    let started = Instant::now();
    let mut empty_dirs = Vec::new();
    let mut scanned_dirs = 0usize;

    if let Ok(read) = fs::read_dir(root) {
        for entry in read.filter_map(|e| e.ok()) {
            if let Ok(ft) = entry.file_type() {
                if ft.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !name.starts_with(".git") {
                        find_empty_dirs_recursive(&entry.path(), max_results, &mut empty_dirs, &mut scanned_dirs);
                    }
                }
            }
        }
    }

    // Sort deeper paths first (longest path length first)
    empty_dirs.sort_by_key(|p| std::cmp::Reverse(p.len()));

    Ok(EmptyDirsReport {
        root_path: root.to_string_lossy().to_string(),
        empty_dirs,
        scanned_dirs,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Cleans the specified empty directory paths from disk.
pub fn clean_empty_directories(paths: &[String]) -> EmptyDirsCleanResult {
    let mut removed_count = 0;
    let mut failed_count = 0;
    let mut errors = Vec::new();

    let mut sorted = paths.to_vec();
    sorted.sort_by_key(|p| std::cmp::Reverse(p.len()));

    for p in sorted {
        let path = Path::new(&p);
        if path.is_dir() {
            match fs::remove_dir(path) {
                Ok(_) => removed_count += 1,
                Err(e) => {
                    failed_count += 1;
                    errors.push(format!("{p}: {e}"));
                }
            }
        }
    }

    EmptyDirsCleanResult {
        removed_count,
        failed_count,
        errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn test_empty_directories_scan_and_clean() {
        let tmp = tempfile::tempdir().unwrap();
        let empty_a = tmp.path().join("level1").join("empty_nested");
        let non_empty = tmp.path().join("has_file");
        fs::create_dir_all(&empty_a).unwrap();
        fs::create_dir_all(&non_empty).unwrap();
        let _ = File::create(non_empty.join("hello.txt")).unwrap();

        let report = scan_empty_directories(tmp.path(), 0).unwrap();
        assert_eq!(report.empty_dirs.len(), 2); // level1 and level1/empty_nested
        assert!(report.empty_dirs[0].contains("empty_nested")); // deepest first

        let clean_res = clean_empty_directories(&report.empty_dirs);
        assert_eq!(clean_res.removed_count, 2);
        assert_eq!(clean_res.failed_count, 0);

        assert!(!empty_a.exists());
        assert!(!tmp.path().join("level1").exists());
        assert!(non_empty.exists());
        assert!(non_empty.join("hello.txt").exists());
    }

    #[test]
    fn test_janitor_scan_and_clean() {
        let tmp = tempfile::tempdir().unwrap();
        let nm = tmp.path().join("node_modules");
        let target = tmp.path().join("target");
        let normal = tmp.path().join("src");

        fs::create_dir_all(&nm).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::create_dir_all(&normal).unwrap();

        let mut f1 = File::create(nm.join("pkg.js")).unwrap();
        f1.write_all(b"console.log('test')").unwrap();
        drop(f1);

        let mut f2 = File::create(target.join("output.exe")).unwrap();
        f2.write_all(b"BINARY_PAYLOAD_HERE_1234567890").unwrap();
        drop(f2);

        let report = scan_developer_artifacts(tmp.path()).unwrap();
        assert_eq!(report.targets.len(), 2);
        assert!(report.total_reclaimable_bytes > 0);

        let paths_to_clean: Vec<String> = report.targets.iter().map(|t| t.path.clone()).collect();
        let result = clean_developer_artifacts(&paths_to_clean);

        assert_eq!(result.cleaned_targets, 2);
        assert!(!nm.exists());
        assert!(!target.exists());
        assert!(normal.exists()); // normal folder was preserved!
    }
}
