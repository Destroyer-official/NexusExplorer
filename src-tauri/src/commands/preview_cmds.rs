//! Preview, checksum and recursive-size IPC.

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use nexus_core::fs;
use nexus_core::hash;
use nexus_core::models::{EntryProperties, FileHash, FolderSizeEvent, PreviewData};
use nexus_core::registry::CancellationRegistry;
use tauri::ipc::Channel;
use tauri::State;
use uuid::Uuid;

/// Classifies a file and returns bounded text for text-like content.
#[tauri::command]
pub async fn preview_file(path: String, max_bytes: u32) -> Result<PreviewData, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fs::preview_file(&path, max_bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("preview task failed: {e}"))?
}

/// Computes a streaming checksum (`xxh3`, `sha256` or `blake3`).
#[tauri::command]
pub async fn hash_file(path: String, algorithm: String) -> Result<FileHash, String> {
    tauri::async_runtime::spawn_blocking(move || {
        hash::hash_file(&path, &algorithm).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("hash task failed: {e}"))?
}

/// Computes a recursive folder size, streaming progress over `on_event`.
#[tauri::command]
pub async fn folder_size(
    path: String,
    on_event: Channel<FolderSizeEvent>,
    registry: State<'_, CancellationRegistry>,
) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("path must not be empty".into());
    }
    let task_id = Uuid::new_v4().to_string();
    let flag: Arc<AtomicBool> = registry.register(task_id.clone());
    let reg = registry.inner().clone();
    let channel = on_event.clone();
    let id_for_task = task_id.clone();
    let root = path.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let progress_channel = channel.clone();
        let id_for_progress = id_for_task.clone();
        let result = fs::calculate_folder_size(&root, &flag, &mut |files, folders, bytes| {
            let _ = progress_channel.send(FolderSizeEvent::Progress {
                task_id: id_for_progress.clone(),
                files,
                folders,
                bytes,
            });
        });
        match result {
            Ok(size) => {
                let _ = channel.send(FolderSizeEvent::Done {
                    task_id: id_for_task.clone(),
                    size: size.size,
                    files: size.files,
                    folders: size.folders,
                    elapsed_ms: size.elapsed_ms,
                });
            }
            Err(err) => {
                let _ = channel.send(FolderSizeEvent::Error {
                    task_id: id_for_task.clone(),
                    message: err.to_string(),
                });
            }
        }
        reg.remove(&id_for_task);
    });

    Ok(task_id)
}

/// Cancels a running folder-size task.
#[tauri::command]
pub async fn cancel_folder_size(
    task_id: String,
    registry: State<'_, CancellationRegistry>,
) -> Result<(), String> {
    if registry.cancel(&task_id) {
        Ok(())
    } else {
        Err(format!("no active size task with id '{task_id}'"))
    }
}

/// Returns extended properties (attributes, link target) for one entry.
#[tauri::command]
pub async fn entry_properties(path: String) -> Result<EntryProperties, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry = fs::stat_path(&path)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("path not found: {path}"))?;
        let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
        let attributes = fs::attributes(&metadata);
        let link_target = metadata
            .is_symlink()
            .then(|| std::fs::read_link(&path).ok())
            .flatten()
            .map(|p| p.to_string_lossy().into_owned());
        Ok(EntryProperties {
            readonly: metadata.permissions().readonly(),
            hidden: entry.is_hidden,
            system: entry.is_system,
            archive: attributes & 0x20 != 0,
            attributes: Some(attributes),
            link_target,
            files: None,
            folders: None,
            total_size: None,
            entry,
        })
    })
    .await
    .map_err(|e| format!("properties task failed: {e}"))?
}
