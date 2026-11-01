//! Smart folders — persisted dynamic searches (name pattern + root + extension).
//!
//! These are the Rust counterpart of the legacy `SmartFolderManager`. Queries
//! are evaluated on demand so results always reflect the live filesystem.

use std::path::Path;
use std::time::Instant;

use regex::RegexBuilder;
use serde::{Deserialize, Serialize};

use crate::fs::listing::{build_entry, sort_entries};
use crate::models::FileEntry;
use crate::state::StateStore;
use crate::util::now_ms;

const SMART_FILE: &str = "smart_folders.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SmartFolder {
    pub id: String,
    pub name: String,
    pub root: String,
    pub query: String,
    #[serde(default)]
    pub is_regex: bool,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub extensions: Vec<String>,
    #[serde(default)]
    pub include_directories: bool,
    #[serde(default)]
    pub created_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartFolderResult {
    pub folder: SmartFolder,
    pub entries: Vec<FileEntry>,
    pub total: usize,
    pub truncated: bool,
    pub elapsed_ms: u64,
}

fn store() -> StateStore {
    StateStore::new()
}

/// Loads every saved smart folder (newest first).
pub fn list_smart_folders() -> Vec<SmartFolder> {
    let mut folders = store()
        .load_json::<Vec<SmartFolder>>(SMART_FILE)
        .unwrap_or_default();
    folders.sort_by_key(|a| std::cmp::Reverse(a.created_ms));
    folders
}

/// Inserts or replaces a smart folder, returning the resulting list.
pub fn save_smart_folder(mut folder: SmartFolder) -> Result<Vec<SmartFolder>, String> {
    if folder.name.trim().is_empty() {
        return Err("smart folder name cannot be empty".into());
    }
    if folder.root.trim().is_empty() {
        return Err("smart folder root cannot be empty".into());
    }
    if folder.id.trim().is_empty() {
        folder.id = uuid::Uuid::new_v4().to_string();
    }
    if folder.created_ms == 0 {
        folder.created_ms = now_ms();
    }
    folder.extensions = folder
        .extensions
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect();

    let mut folders = list_smart_folders();
    match folders.iter().position(|item| item.id == folder.id) {
        Some(index) => folders[index] = folder,
        None => folders.push(folder),
    }
    store()
        .write_json(SMART_FILE, &folders)
        .map_err(|e| e.to_string())?;
    Ok(list_smart_folders())
}

/// Removes a smart folder by id.
pub fn delete_smart_folder(id: &str) -> Result<Vec<SmartFolder>, String> {
    let folders: Vec<SmartFolder> = list_smart_folders()
        .into_iter()
        .filter(|item| item.id != id)
        .collect();
    store()
        .write_json(SMART_FILE, &folders)
        .map_err(|e| e.to_string())?;
    Ok(folders)
}

/// Evaluates a smart folder against the live filesystem.
pub fn run_smart_folder(folder: &SmartFolder, max_results: Option<usize>) -> Result<SmartFolderResult, String> {
    let started = Instant::now();
    let root = Path::new(&folder.root);
    if !root.is_dir() {
        return Err(format!("smart folder root is not a directory: {}", folder.root));
    }
    let limit = max_results.unwrap_or(5_000).max(1);

    let matcher = if folder.query.trim().is_empty() {
        None
    } else if folder.is_regex {
        Some(
            RegexBuilder::new(&folder.query)
                .case_insensitive(!folder.case_sensitive)
                .build()
                .map_err(|e| format!("invalid smart folder regex: {e}"))?,
        )
    } else {
        None
    };
    let needle = folder.query.to_lowercase();
    let extensions: Vec<String> = folder
        .extensions
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect();

    let mut entries = Vec::new();
    let mut truncated = false;

    for item in jwalk::WalkDir::new(root).skip_hidden(false) {
        let Ok(item) = item else { continue };
        let Ok(meta) = item.metadata() else { continue };
        if meta.is_dir() && !folder.include_directories {
            continue;
        }
        let name = item
            .path()
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        let ext = item
            .path()
            .extension()
            .map(|e| e.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default();

        if !extensions.is_empty() && (meta.is_dir() || !extensions.contains(&ext)) {
            continue;
        }
        if let Some(regex) = &matcher {
            if !regex.is_match(&name) {
                continue;
            }
        } else if !needle.is_empty() && !name.to_lowercase().contains(&needle) {
            continue;
        }

        entries.push(build_entry(
            name,
            item.path().to_string_lossy().into_owned(),
            item.path()
                .parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_default(),
            &meta,
        ));
        if entries.len() >= limit {
            truncated = true;
            break;
        }
    }

    sort_entries(&mut entries);
    let total = entries.len();
    Ok(SmartFolderResult {
        folder: folder.clone(),
        entries,
        total,
        truncated,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder(root: &Path, query: &str, extensions: &[&str]) -> SmartFolder {
        SmartFolder {
            id: "test".into(),
            name: "Test".into(),
            root: root.to_string_lossy().into_owned(),
            query: query.into(),
            is_regex: false,
            case_sensitive: false,
            extensions: extensions.iter().map(|s| s.to_string()).collect(),
            include_directories: false,
            created_ms: 1,
        }
    }

    #[test]
    fn filters_by_name_and_extension() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("report.txt"), b"a").unwrap();
        std::fs::write(root.join("report.md"), b"a").unwrap();
        std::fs::write(root.join("notes.txt"), b"a").unwrap();

        let result = run_smart_folder(&folder(root, "report", &["txt"]), None).unwrap();
        assert_eq!(result.total, 1);
        assert!(result.entries[0].name == "report.txt");
    }

    #[test]
    fn regex_mode_matches() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("IMG_2024.png"), b"a").unwrap();
        std::fs::write(root.join("notes.txt"), b"a").unwrap();
        let mut f = folder(root, r"^IMG_\d+", &[]);
        f.is_regex = true;
        let result = run_smart_folder(&f, None).unwrap();
        assert_eq!(result.total, 1);
    }
}
