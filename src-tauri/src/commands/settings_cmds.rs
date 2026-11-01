//! Persisted settings, bookmarks and recent-location IPC.

use nexus_core::models::{Bookmark, RecentEntry};
use nexus_core::state::Settings;
use tauri::State;

use crate::AppState;

/// Loads the current settings.
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    Ok(state.store.load_settings())
}

/// Persists settings and returns the sanitised value that was stored.
#[tauri::command]
pub async fn save_settings(
    settings: Settings,
    state: State<'_, AppState>,
) -> Result<Settings, String> {
    let settings = settings.sanitised();
    state
        .store
        .save_settings(&settings)
        .map_err(|e| e.to_string())?;
    Ok(settings)
}

/// Returns saved sidebar bookmarks.
#[tauri::command]
pub async fn list_bookmarks(state: State<'_, AppState>) -> Result<Vec<Bookmark>, String> {
    Ok(state.store.load_bookmarks())
}

/// Replaces the bookmark list.
#[tauri::command]
pub async fn save_bookmarks(
    bookmarks: Vec<Bookmark>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .store
        .save_bookmarks(&bookmarks)
        .map_err(|e| e.to_string())
}

/// Returns recently visited locations, newest first.
#[tauri::command]
pub async fn list_recent(state: State<'_, AppState>) -> Result<Vec<RecentEntry>, String> {
    Ok(state.store.load_recent())
}

/// Records a visit and returns the updated recent list.
#[tauri::command]
pub async fn record_recent(
    path: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<Vec<RecentEntry>, String> {
    let limit = state.store.load_settings().recent_limit;
    state
        .store
        .record_recent(&path, &name, limit)
        .map_err(|e| e.to_string())
}
