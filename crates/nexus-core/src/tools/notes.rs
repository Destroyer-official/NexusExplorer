//! Persistent File & Folder Sticky Notes & Annotations (100% Rust).
//!
//! Stores markdown notes, checklists, and metadata annotations attached to any file or directory.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAnnotation {
    pub path: String,
    pub note_markdown: String,
    pub updated_ms: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesDatabase {
    pub notes: HashMap<String, FileAnnotation>,
}

pub fn default_notes_path() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        let nexus_dir = home.join(".nexus");
        if !nexus_dir.exists() {
            let _ = fs::create_dir_all(&nexus_dir);
        }
        nexus_dir.join("notes.json")
    } else {
        PathBuf::from("nexus_notes.json")
    }
}

pub fn load_notes(custom_path: Option<&Path>) -> NotesDatabase {
    let p = custom_path.map(PathBuf::from).unwrap_or_else(default_notes_path);
    if let Ok(content) = fs::read_to_string(&p) {
        if let Ok(db) = serde_json::from_str::<NotesDatabase>(&content) {
            return db;
        }
    }
    NotesDatabase::default()
}

pub fn save_notes(db: &NotesDatabase, custom_path: Option<&Path>) -> Result<(), String> {
    let p = custom_path.map(PathBuf::from).unwrap_or_else(default_notes_path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }
    let json = serde_json::to_string_pretty(db).map_err(|e| e.to_string())?;
    fs::write(&p, json).map_err(|e| format!("cannot write notes database: {e}"))
}

/// Reads the persistent markdown annotation for a given path.
pub fn get_note(path: &str, custom_path: Option<&Path>) -> Option<FileAnnotation> {
    let db = load_notes(custom_path);
    let normalized = path.replace('/', "\\");
    db.notes.get(&normalized).cloned()
}

/// Saves or updates the markdown annotation for a given path.
pub fn set_note(
    path: &str,
    markdown: &str,
    custom_path: Option<&Path>,
) -> Result<FileAnnotation, String> {
    let mut db = load_notes(custom_path);
    let normalized = path.replace('/', "\\");

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let annotation = FileAnnotation {
        path: normalized.clone(),
        note_markdown: markdown.to_string(),
        updated_ms: now_ms,
    };

    db.notes.insert(normalized, annotation.clone());
    save_notes(&db, custom_path)?;
    Ok(annotation)
}

/// Deletes an annotation from a given path.
pub fn delete_note(path: &str, custom_path: Option<&Path>) -> Result<bool, String> {
    let mut db = load_notes(custom_path);
    let normalized = path.replace('/', "\\");
    let removed = db.notes.remove(&normalized).is_some();
    if removed {
        save_notes(&db, custom_path)?;
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notes_crud() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test_notes.json");
        let target = r"C:\code\Nexus\README.md";

        let note = set_note(target, "# Important Architecture Notes\n- Must verify 2027 compliance", Some(&db_path)).unwrap();
        assert_eq!(note.path, target);

        let read_back = get_note(target, Some(&db_path)).unwrap();
        assert!(read_back.note_markdown.contains("2027 compliance"));

        let deleted = delete_note(target, Some(&db_path)).unwrap();
        assert!(deleted);
        assert!(get_note(target, Some(&db_path)).is_none());
    }
}

