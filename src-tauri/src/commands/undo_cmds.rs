//! Undo/redo IPC.

use nexus_core::state::UndoStatus;
use tauri::State;

use crate::AppState;

/// Returns whether undo/redo are available and their labels.
#[tauri::command]
pub async fn undo_status(state: State<'_, AppState>) -> Result<UndoStatus, String> {
    Ok(state.undo.lock().status())
}

/// Reverts the most recent reversible action.
#[tauri::command]
pub async fn undo(state: State<'_, AppState>) -> Result<UndoStatus, String> {
    let mut undo = state.undo.lock();
    undo.undo().map_err(|e| e.to_string())?;
    Ok(undo.status())
}

/// Re-applies the next action in the redo branch.
#[tauri::command]
pub async fn redo(state: State<'_, AppState>) -> Result<UndoStatus, String> {
    let mut undo = state.undo.lock();
    undo.redo().map_err(|e| e.to_string())?;
    Ok(undo.status())
}
