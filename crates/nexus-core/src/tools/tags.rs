//! Multi-Dimensional Dynamic Tag Spaces & Virtual Collections (100% Rust).
//!
//! Organizes files across diverse physical folders into virtual collections
//! without duplicate copies or symbolic links.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagItem {
    pub name: String,
    pub color: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagDatabase {
    pub tags: HashMap<String, TagItem>,
}

pub fn default_tags_path() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        let nexus_dir = home.join(".nexus");
        if !nexus_dir.exists() {
            let _ = fs::create_dir_all(&nexus_dir);
        }
        nexus_dir.join("tags.json")
    } else {
        PathBuf::from("nexus_tags.json")
    }
}

pub fn load_tags(custom_path: Option<&Path>) -> TagDatabase {
    let p = custom_path.map(PathBuf::from).unwrap_or_else(default_tags_path);
    if let Ok(content) = fs::read_to_string(&p) {
        if let Ok(db) = serde_json::from_str::<TagDatabase>(&content) {
            return db;
        }
    }
    TagDatabase::default()
}

pub fn save_tags(db: &TagDatabase, custom_path: Option<&Path>) -> Result<(), String> {
    let p = custom_path.map(PathBuf::from).unwrap_or_else(default_tags_path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }
    let json = serde_json::to_string_pretty(db).map_err(|e| e.to_string())?;
    fs::write(&p, json).map_err(|e| format!("cannot write tags database: {e}"))
}

/// Assigns a tag to a given file or folder path.
pub fn assign_tag(
    path: &str,
    tag_name: &str,
    color: Option<&str>,
    custom_path: Option<&Path>,
) -> Result<TagItem, String> {
    let mut db = load_tags(custom_path);
    let normalized_path = path.replace('/', "\\");
    let norm_tag = tag_name.trim();
    if norm_tag.is_empty() {
        return Err("tag name cannot be empty".into());
    }

    let default_color = "#6366f1".to_string();
    let item = db.tags.entry(norm_tag.to_string()).or_insert_with(|| TagItem {
        name: norm_tag.to_string(),
        color: color.unwrap_or(&default_color).to_string(),
        paths: Vec::new(),
    });

    if let Some(c) = color {
        item.color = c.to_string();
    }

    if !item.paths.contains(&normalized_path) {
        item.paths.push(normalized_path);
    }

    let cloned = item.clone();
    save_tags(&db, custom_path)?;
    Ok(cloned)
}

/// Removes a tag from a given path.
pub fn remove_tag(
    path: &str,
    tag_name: &str,
    custom_path: Option<&Path>,
) -> Result<bool, String> {
    let mut db = load_tags(custom_path);
    let normalized_path = path.replace('/', "\\");
    let norm_tag = tag_name.trim();

    if let Some(item) = db.tags.get_mut(norm_tag) {
        let before_len = item.paths.len();
        item.paths.retain(|p| p != &normalized_path);
        let removed = item.paths.len() < before_len;

        // If tag has no paths left, keep it as empty category or retain
        save_tags(&db, custom_path)?;
        Ok(removed)
    } else {
        Ok(false)
    }
}

/// Returns all tags assigned to a specific file or folder.
pub fn get_tags_for_path(path: &str, custom_path: Option<&Path>) -> Vec<TagItem> {
    let db = load_tags(custom_path);
    let normalized_path = path.replace('/', "\\");
    let mut result = Vec::new();

    for item in db.tags.values() {
        if item.paths.contains(&normalized_path) {
            result.push(item.clone());
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

/// Returns all defined virtual tags and their assigned paths.
pub fn list_all_tags(custom_path: Option<&Path>) -> Vec<TagItem> {
    let db = load_tags(custom_path);
    let mut list: Vec<TagItem> = db.tags.into_values().collect();
    list.sort_by(|a, b| a.name.cmp(&b.name));
    list
}

/// Returns all file paths belonging to a given virtual collection.
pub fn get_paths_by_tag(tag_name: &str, custom_path: Option<&Path>) -> Vec<String> {
    let db = load_tags(custom_path);
    db.tags.get(tag_name.trim()).map(|t| t.paths.clone()).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tag_lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test_tags.json");

        let p1 = r"C:\code\project\src\main.rs";
        let p2 = r"C:\docs\invoice_2027.pdf";

        assign_tag(p1, "Development", Some("#10b981"), Some(&db_path)).unwrap();
        assign_tag(p2, "Finance", Some("#f59e0b"), Some(&db_path)).unwrap();
        assign_tag(p1, "Finance", None, Some(&db_path)).unwrap();

        let tags_p1 = get_tags_for_path(p1, Some(&db_path));
        assert_eq!(tags_p1.len(), 2);

        let fin_paths = get_paths_by_tag("Finance", Some(&db_path));
        assert_eq!(fin_paths.len(), 2);

        let removed = remove_tag(p1, "Finance", Some(&db_path)).unwrap();
        assert!(removed);

        let tags_p1_after = get_tags_for_path(p1, Some(&db_path));
        assert_eq!(tags_p1_after.len(), 1);
        assert_eq!(tags_p1_after[0].name, "Development");
    }
}

