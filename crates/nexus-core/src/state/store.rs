//! Atomic JSON persistence for all desktop state.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use parking_lot::Mutex;
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::error::{CoreError, CoreResult};
use crate::models::{Bookmark, RecentEntry};
use crate::state::settings::{Settings, SETTINGS_VERSION};
use crate::util::{data_dir, now_ms};

const SETTINGS_FILE: &str = "settings.json";
const BOOKMARKS_FILE: &str = "bookmarks.json";
const RECENT_FILE: &str = "recent.json";

/// Thread-safe JSON store rooted at the app data directory.
///
/// Writes go through a temp file + rename so a crash mid-write can never leave
/// a truncated settings file behind.
pub struct StateStore {
    dir: PathBuf,
    lock: Mutex<()>,
}

impl Default for StateStore {
    fn default() -> Self {
        Self::new()
    }
}

impl StateStore {
    /// Opens the store at the platform data directory.
    pub fn new() -> Self {
        Self::with_dir(data_dir())
    }

    /// Opens the store at an explicit directory (tests, portable mode).
    pub fn with_dir(dir: impl Into<PathBuf>) -> Self {
        let dir = dir.into();
        let _ = fs::create_dir_all(&dir);
        Self {
            dir,
            lock: Mutex::new(()),
        }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// Loads settings, falling back to defaults for missing/corrupt files.
    pub fn load_settings(&self) -> Settings {
        let mut settings = self.load_json::<Settings>(SETTINGS_FILE).unwrap_or_default();
        settings.version = SETTINGS_VERSION;
        settings.sanitised()
    }

    /// Persists settings atomically.
    pub fn save_settings(&self, settings: &Settings) -> CoreResult<()> {
        self.write_json(SETTINGS_FILE, settings)
    }

    /// Loads the bookmark list.
    pub fn load_bookmarks(&self) -> Vec<Bookmark> {
        self.load_json::<Vec<Bookmark>>(BOOKMARKS_FILE)
            .unwrap_or_default()
    }

    /// Replaces the bookmark list.
    pub fn save_bookmarks(&self, bookmarks: &[Bookmark]) -> CoreResult<()> {
        self.write_json(BOOKMARKS_FILE, &bookmarks)
    }

    /// Loads recently visited locations (newest first).
    pub fn load_recent(&self) -> Vec<RecentEntry> {
        self.load_json::<Vec<RecentEntry>>(RECENT_FILE)
            .unwrap_or_default()
    }

    /// Records a visit, de-duplicating by path and trimming to `limit`.
    pub fn record_recent(&self, path: &str, name: &str, limit: u32) -> CoreResult<Vec<RecentEntry>> {
        let key = crate::util::normalise_key(path);
        let mut recent = self.load_recent();
        recent.retain(|entry| crate::util::normalise_key(&entry.path) != key);
        recent.insert(
            0,
            RecentEntry {
                path: path.to_string(),
                name: name.to_string(),
                visited_ms: now_ms(),
            },
        );
        recent.truncate(limit.clamp(5, 200) as usize);
        self.write_json(RECENT_FILE, &recent)?;
        Ok(recent)
    }

    /// Writes `value` as pretty JSON atomically.
    pub fn write_json<T: Serialize>(&self, file: &str, value: &T) -> CoreResult<()> {
        let _guard = self.lock.lock();
        fs::create_dir_all(&self.dir).map_err(|e| CoreError::from_io(&self.dir, e))?;
        let target = self.dir.join(file);
        let tmp = self.dir.join(format!("{file}.tmp"));
        let bytes = serde_json::to_vec_pretty(value)
            .map_err(|e| CoreError::Serialization(e.to_string()))?;
        {
            let mut handle = fs::File::create(&tmp).map_err(|e| CoreError::from_io(&tmp, e))?;
            handle
                .write_all(&bytes)
                .map_err(|e| CoreError::from_io(&tmp, e))?;
            let _ = handle.sync_all();
        }
        fs::rename(&tmp, &target).map_err(|e| CoreError::from_io(&target, e))?;
        Ok(())
    }

    /// Loads a JSON file, returning `None` when absent or invalid.
    pub fn load_json<T: DeserializeOwned>(&self, file: &str) -> Option<T> {
        let raw = fs::read(self.dir.join(file)).ok()?;
        serde_json::from_slice(&raw).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_settings_and_bookmarks() {
        let dir = std::env::temp_dir().join(format!("nexus-store-{}", uuid::Uuid::new_v4()));
        let store = StateStore::with_dir(&dir);

        let mut settings = store.load_settings();
        assert_eq!(settings.theme, "dark");
        settings.theme = "light".into();
        store.save_settings(&settings).unwrap();
        assert_eq!(store.load_settings().theme, "light");

        let bookmarks = vec![Bookmark {
            id: "b1".into(),
            name: "Work".into(),
            path: "C:\\Work".into(),
            icon: None,
            color: None,
        }];
        store.save_bookmarks(&bookmarks).unwrap();
        assert_eq!(store.load_bookmarks(), bookmarks);

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn recent_is_deduplicated() {
        let dir = std::env::temp_dir().join(format!("nexus-recent-{}", uuid::Uuid::new_v4()));
        let store = StateStore::with_dir(&dir);
        store.record_recent(r"C:\A", "A", 10).unwrap();
        store.record_recent(r"C:\B", "B", 10).unwrap();
        let recent = store.record_recent(r"C:\A", "A", 10).unwrap();
        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].path, r"C:\A");
        fs::remove_dir_all(&dir).unwrap();
    }
}
