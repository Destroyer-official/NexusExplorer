//! Filesystem IPC: browsing, scanning, mutations and watchers.

use std::sync::atomic::Ordering;
use std::time::Instant;

use nexus_core::fs;
use nexus_core::models::{DriveInfo, FileEntry, KnownFolder, ScanEvent, ScanStart, TextPreview};
use nexus_core::state::undo::UndoAction;
use nexus_core::registry::CancellationRegistry;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::watch::WatchManager;
use crate::AppState;

const BATCH_SIZE: usize = 500;

/// Lists one directory level (directories first, then case-insensitive name).
#[tauri::command]
pub async fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || fs::read_dir(&path).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("listing task failed: {e}"))?
}

/// Starts an asynchronous directory scan, streaming sorted batches over `on_event`.
///
/// Kept alongside `read_dir` for very large folders where progressive paint
/// matters more than a single response.
#[tauri::command]
pub async fn scan_dir(
    path: String,
    on_event: Channel<ScanEvent>,
    registry: State<'_, CancellationRegistry>,
) -> Result<ScanStart, String> {
    if path.trim().is_empty() {
        return Err("path must not be empty".into());
    }
    let scan_id = Uuid::new_v4().to_string();
    let flag = registry.register(scan_id.clone());
    let reg = registry.inner().clone();
    let channel = on_event.clone();
    let root = path.clone();
    let id_for_task = scan_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let started = Instant::now();
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(err) => {
                let _ = channel.send(ScanEvent::Error {
                    message: err.to_string(),
                });
                reg.remove(&id_for_task);
                return;
            }
        };
        let total = entries.len() as u64;
        for chunk in entries.chunks(BATCH_SIZE) {
            if flag.load(Ordering::Relaxed) {
                reg.remove(&id_for_task);
                return;
            }
            if channel
                .send(ScanEvent::Batch {
                    entries: chunk.to_vec(),
                })
                .is_err()
            {
                reg.remove(&id_for_task);
                return;
            }
        }
        let _ = channel.send(ScanEvent::Done {
            total,
            duration_ms: started.elapsed().as_millis() as u64,
        });
        reg.remove(&id_for_task);
    });

    Ok(ScanStart {
        scan_id,
        root_path: path,
    })
}

/// Cancels a running scan or folder-size task by id.
#[tauri::command]
pub async fn cancel_scan(
    scan_id: String,
    registry: State<'_, CancellationRegistry>,
) -> Result<(), String> {
    if registry.cancel(&scan_id) {
        Ok(())
    } else {
        Err(format!("no active task with id '{scan_id}'"))
    }
}

/// Returns metadata for a path, or `None` when it does not exist.
#[tauri::command]
pub async fn stat_path(path: String) -> Result<Option<FileEntry>, String> {
    fs::stat_path(&path).map_err(|e| e.to_string())
}

/// Enumerates logical drives with labels, filesystems and capacity.
#[tauri::command]
pub async fn get_drives() -> Result<Vec<DriveInfo>, String> {
    tauri::async_runtime::spawn_blocking(fs::enumerate_drives)
        .await
        .map_err(|e| format!("drive probe failed: {e}"))
}

/// Returns the current user's home directory.
#[tauri::command]
pub async fn home_dir() -> Result<String, String> {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|_| "home directory not found".to_string())
}

/// Returns standard shell folders (Home, Desktop, Downloads, OneDrive, …).
#[tauri::command]
pub async fn known_folders() -> Result<Vec<KnownFolder>, String> {
    Ok(fs::known_folders())
}

/// Creates a folder and records it in undo history.
#[tauri::command]
pub async fn create_folder(
    parent: String,
    name: String,
    unique: bool,
    state: State<'_, AppState>,
) -> Result<FileEntry, String> {
    let entry = fs::create_folder(&parent, &name, unique).map_err(|e| e.to_string())?;
    state.undo.lock().push(
        UndoAction::Create {
            path: entry.path.clone(),
            is_dir: true,
        },
        format!("New folder “{}”", entry.name),
    );
    Ok(entry)
}

/// Creates an empty file and records it in undo history.
#[tauri::command]
pub async fn create_file(
    parent: String,
    name: String,
    unique: bool,
    state: State<'_, AppState>,
) -> Result<FileEntry, String> {
    let entry = fs::create_file(&parent, &name, unique).map_err(|e| e.to_string())?;
    state.undo.lock().push(
        UndoAction::Create {
            path: entry.path.clone(),
            is_dir: false,
        },
        format!("New file “{}”", entry.name),
    );
    Ok(entry)
}

/// Renames an entry and records it in undo history.
#[tauri::command]
pub async fn rename_entry(
    path: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<FileEntry, String> {
    let entry = fs::rename_entry(&path, &new_name).map_err(|e| e.to_string())?;
    state.undo.lock().push(
        UndoAction::Rename {
            from: path,
            to: entry.path.clone(),
        },
        format!("Rename to “{}”", entry.name),
    );
    Ok(entry)
}

/// Reads up to `max_bytes` of a text file for previews.
#[tauri::command]
pub async fn read_text_file(path: String, max_bytes: u32) -> Result<TextPreview, String> {
    fs::read_text_file(&path, max_bytes).map_err(|e| e.to_string())
}

/// Writes full text content to a file.
#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::write(&path, content).map_err(|e| format!("cannot write file: {e}"))
    })
    .await
    .map_err(|e| format!("task failed: {e}"))?
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexSlice {
    pub total_bytes: u64,
    pub offset: u64,
    pub bytes: Vec<u8>,
}

/// Reads a window of bytes from an arbitrary offset for virtualized hex editing.
#[tauri::command]
pub async fn read_hex_slice(path: String, offset: u64, length: usize) -> Result<HexSlice, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{Read, Seek, SeekFrom};
        let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
        let total_bytes = file.metadata().map_err(|e| e.to_string())?.len();
        file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        let to_read = length.min((total_bytes.saturating_sub(offset)) as usize);
        let mut buf = vec![0u8; to_read];
        if to_read > 0 {
            file.read_exact(&mut buf).map_err(|e| e.to_string())?;
        }
        Ok(HexSlice {
            total_bytes,
            offset,
            bytes: buf,
        })
    })
    .await
    .map_err(|e| format!("read hex failed: {e}"))?
}

/// Overwrites a byte slice at an arbitrary offset.
#[tauri::command]
pub async fn write_hex_slice(path: String, offset: u64, bytes: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{Seek, SeekFrom, Write};
        let mut file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&path)
            .map_err(|e| e.to_string())?;
        file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        file.flush().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("write hex failed: {e}"))?
}

/// Opens a path with the OS default handler.
#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    fs::open_path(&path).map_err(|e| e.to_string())
}

/// Reveals a path in Windows Explorer.
#[tauri::command]
pub async fn reveal_in_shell(path: String) -> Result<(), String> {
    fs::reveal_in_shell(&path).map_err(|e| e.to_string())
}

/// Opens a terminal at `path` (PowerShell, preferring Windows Terminal).
#[tauri::command]
pub async fn open_terminal(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || fs::open_terminal(&path).map_err(|e| e.to_string()))
        .await
        .map_err(|e| format!("terminal launch failed: {e}"))?
}

/// Starts watching a directory for changes.
#[tauri::command]
pub async fn watch_dir(
    app: AppHandle,
    path: String,
    watcher: State<'_, WatchManager>,
) -> Result<(), String> {
    watcher.watch(app, path)
}

/// Stops watching a directory.
#[tauri::command]
pub async fn unwatch_dir(path: String, watcher: State<'_, WatchManager>) -> Result<(), String> {
    watcher.unwatch(path)
}
