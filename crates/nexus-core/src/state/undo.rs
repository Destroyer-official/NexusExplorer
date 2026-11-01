//! Persisted undo/redo history.
//!
//! The history is intentionally conservative: only operations that can be
//! reversed deterministically without data loss are recorded. A folder that
//! has been filled after creation cannot be "un-created"; undo reports that
//! instead of deleting user data.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, CoreResult};
use crate::util::now_ms;

const HISTORY_LIMIT: usize = 100;

/// A reversible filesystem operation.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum UndoAction {
    Rename { from: String, to: String },
    Move { from: String, to: String },
    Create { path: String, is_dir: bool },
}

/// One labelled history entry.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UndoEntry {
    pub id: String,
    pub label: String,
    pub action: UndoAction,
    pub at_ms: u64,
}

/// Serializable history state (`undo.json`).
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct UndoState {
    pub entries: Vec<UndoEntry>,
    pub cursor: usize,
}

/// Lightweight status payload for the toolbar's undo/redo buttons.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UndoStatus {
    pub can_undo: bool,
    pub can_redo: bool,
    pub undo_label: Option<String>,
    pub redo_label: Option<String>,
}

/// Undo/redo stack persisted next to the other state files.
pub struct UndoManager {
    path: PathBuf,
    state: UndoState,
}

impl UndoManager {
    /// Loads history from `path`, tolerating missing or corrupt files.
    pub fn load(path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let mut state = fs::read(&path)
            .ok()
            .and_then(|raw| serde_json::from_slice::<UndoState>(&raw).ok())
            .unwrap_or_default();
        state.cursor = state.cursor.min(state.entries.len());
        Self { path, state }
    }

    pub fn state(&self) -> &UndoState {
        &self.state
    }

    pub fn can_undo(&self) -> bool {
        self.state.cursor > 0
    }

    pub fn can_redo(&self) -> bool {
        self.state.cursor < self.state.entries.len()
    }

    pub fn undo_label(&self) -> Option<&str> {
        self.state
            .entries
            .get(self.state.cursor.saturating_sub(1))
            .map(|entry| entry.label.as_str())
    }

    pub fn redo_label(&self) -> Option<&str> {
        self.state
            .entries
            .get(self.state.cursor)
            .map(|entry| entry.label.as_str())
    }

    /// Snapshot used by the toolbar.
    pub fn status(&self) -> UndoStatus {
        UndoStatus {
            can_undo: self.can_undo(),
            can_redo: self.can_redo(),
            undo_label: self.undo_label().map(str::to_string),
            redo_label: self.redo_label().map(str::to_string),
        }
    }

    /// Records a new action, discarding any redo branch.
    pub fn push(&mut self, action: UndoAction, label: impl Into<String>) {
        if self.state.cursor < self.state.entries.len() {
            self.state.entries.truncate(self.state.cursor);
        }
        self.state.entries.push(UndoEntry {
            id: uuid::Uuid::new_v4().to_string(),
            label: label.into(),
            action,
            at_ms: now_ms(),
        });
        if self.state.entries.len() > HISTORY_LIMIT {
            let overflow = self.state.entries.len() - HISTORY_LIMIT;
            self.state.entries.drain(0..overflow);
        }
        self.state.cursor = self.state.entries.len();
        self.persist();
    }

    /// Reverts the most recent action and returns its label.
    pub fn undo(&mut self) -> CoreResult<String> {
        if !self.can_undo() {
            return Err(CoreError::InvalidInput("nothing to undo".into()));
        }
        let entry = self.state.entries[self.state.cursor - 1].clone();
        apply(&entry.action, true)?;
        self.state.cursor -= 1;
        self.persist();
        Ok(entry.label)
    }

    /// Re-applies the next action and returns its label.
    pub fn redo(&mut self) -> CoreResult<String> {
        if !self.can_redo() {
            return Err(CoreError::InvalidInput("nothing to redo".into()));
        }
        let entry = self.state.entries[self.state.cursor].clone();
        apply(&entry.action, false)?;
        self.state.cursor += 1;
        self.persist();
        Ok(entry.label)
    }

    fn persist(&self) {
        let Some(parent) = self.path.parent() else {
            return;
        };
        let _ = fs::create_dir_all(parent);
        let Ok(bytes) = serde_json::to_vec_pretty(&self.state) else {
            return;
        };
        let tmp = self.path.with_extension("json.tmp");
        if let Ok(mut handle) = fs::File::create(&tmp) {
            if handle.write_all(&bytes).is_ok() {
                let _ = handle.sync_all();
                drop(handle);
                let _ = fs::rename(&tmp, &self.path);
            }
        }
    }
}

fn apply(action: &UndoAction, inverse: bool) -> CoreResult<()> {
    match action {
        UndoAction::Rename { from, to } | UndoAction::Move { from, to } => {
            let (src, dst) = if inverse { (to, from) } else { (from, to) };
            rename(Path::new(src), Path::new(dst))
        }
        UndoAction::Create { path, is_dir } => {
            if inverse {
                let target = Path::new(path);
                if !target.exists() {
                    return Ok(());
                }
                if *is_dir {
                    fs::remove_dir(target).map_err(|_e| {
                        CoreError::InvalidInput(format!(
                            "cannot undo folder creation: '{}' is not empty",
                            target.display()
                        ))
                    })
                } else {
                    fs::remove_file(target).map_err(|e| CoreError::from_io(target, e))
                }
            } else {
                let target = Path::new(path);
                if target.exists() {
                    return Ok(());
                }
                if *is_dir {
                    fs::create_dir(target).map_err(|e| CoreError::from_io(target, e))
                } else {
                    fs::File::create(target)
                        .map(|_| ())
                        .map_err(|e| CoreError::from_io(target, e))
                }
            }
        }
    }
}

fn rename(from: &Path, to: &Path) -> CoreResult<()> {
    fs::rename(from, to).map_err(|e| CoreError::from_io(from, e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_undo_redo_round_trip() {
        let dir = std::env::temp_dir().join(format!("nexus-undo-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("new.txt");
        let mut manager = UndoManager::load(dir.join("undo.json"));
        manager.push(
            UndoAction::Create {
                path: target.to_string_lossy().into_owned(),
                is_dir: false,
            },
            "New file",
        );
        fs::File::create(&target).unwrap();
        assert!(target.exists());

        assert_eq!(manager.undo().unwrap(), "New file");
        assert!(!target.exists());
        assert_eq!(manager.redo().unwrap(), "New file");
        assert!(target.exists());

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rename_round_trip() {
        let dir = std::env::temp_dir().join(format!("nexus-undo-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let from = dir.join("a.txt");
        let to = dir.join("b.txt");
        fs::write(&from, b"x").unwrap();
        let mut manager = UndoManager::load(dir.join("undo.json"));
        manager.push(
            UndoAction::Rename {
                from: from.to_string_lossy().into_owned(),
                to: to.to_string_lossy().into_owned(),
            },
            "Rename",
        );
        fs::rename(&from, &to).unwrap();
        manager.undo().unwrap();
        assert!(from.exists());
        manager.redo().unwrap();
        assert!(to.exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn cannot_undo_empty_history() {
        let dir = std::env::temp_dir().join(format!("nexus-undo-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let mut manager = UndoManager::load(dir.join("undo.json"));
        assert!(manager.undo().is_err());
        fs::remove_dir_all(&dir).unwrap();
    }
}
