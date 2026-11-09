//! Nexus Explorer desktop shell.
//!
//! This crate is deliberately thin: it wires Tauri IPC, window/plugin
//! lifecycle and OS shell integration to the reusable [`nexus_core`] engine.
//! All behaviour lives in the core crate so the CLI and FFI share it.

pub mod commands;
pub mod watch;

use nexus_core::registry::CancellationRegistry;
use nexus_core::search::SearchRegistry;
use nexus_core::state::{StateStore, UndoManager};
use nexus_core::transfer::JobManager;
use parking_lot::Mutex;
use tauri::{Emitter, Manager};

/// Long-lived application state shared by all IPC commands.
pub struct AppState {
    pub store: StateStore,
    pub undo: Mutex<UndoManager>,
}

impl AppState {
    fn new() -> Self {
        let store = StateStore::new();
        let undo = UndoManager::load(store.dir().join("undo.json"));
        Self {
            store,
            undo: Mutex::new(undo),
        }
    }
}

fn extract_paths(args: &[String]) -> Vec<String> {
    args.iter()
        .filter(|a| !a.starts_with('-') && std::path::Path::new(a).exists())
        .cloned()
        .collect()
}

fn emit_open_paths(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit("open-paths", serde_json::json!({ "paths": paths }));
    }
}

/// Builds and runs the Nexus Explorer application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // When embedded by a host app (Win32 SetParent), the host sets this so the
    // process always creates its own window instead of forwarding to an
    // existing instance.
    let singleton_enabled = std::env::var("NEXUS_NO_SINGLETON").as_deref() != Ok("1");

    let mut builder = tauri::Builder::default();
    if singleton_enabled {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            emit_open_paths(app, extract_paths(args.get(1..).unwrap_or_default()));
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .manage(JobManager::new())
        .manage(CancellationRegistry::new())
        .manage(SearchRegistry::new())
        .manage(watch::WatchManager::new())
        .setup(|app| {
            let args: Vec<String> = std::env::args().skip(1).collect();
            emit_open_paths(app.handle(), extract_paths(&args));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs_cmds::scan_dir,
            commands::fs_cmds::cancel_scan,
            commands::fs_cmds::read_dir,
            commands::fs_cmds::stat_path,
            commands::fs_cmds::get_drives,
            commands::fs_cmds::home_dir,
            commands::fs_cmds::known_folders,
            commands::fs_cmds::create_folder,
            commands::fs_cmds::create_file,
            commands::fs_cmds::rename_entry,
            commands::fs_cmds::read_text_file,
            commands::fs_cmds::write_text_file,
            commands::fs_cmds::read_hex_slice,
            commands::fs_cmds::write_hex_slice,
            commands::fs_cmds::open_path,
            commands::fs_cmds::reveal_in_shell,
            commands::fs_cmds::open_terminal,
            commands::fs_cmds::watch_dir,
            commands::fs_cmds::unwatch_dir,
            commands::preview_cmds::preview_file,
            commands::preview_cmds::hash_file,
            commands::preview_cmds::folder_size,
            commands::preview_cmds::cancel_folder_size,
            commands::preview_cmds::entry_properties,
            commands::ops_cmds::copy_entries,
            commands::ops_cmds::move_entries,
            commands::ops_cmds::delete_entries,
            commands::ops_cmds::pause_job,
            commands::ops_cmds::resume_job,
            commands::ops_cmds::cancel_job,
            commands::ops_cmds::set_rate_limit,
            commands::ops_cmds::resolve_conflict,
            commands::ops_cmds::get_active_jobs,
            commands::ops_cmds::orphan_parts,
            commands::search_cmds::search_files,
            commands::search_cmds::cancel_search,
            commands::settings_cmds::get_settings,
            commands::settings_cmds::save_settings,
            commands::settings_cmds::list_bookmarks,
            commands::settings_cmds::save_bookmarks,
            commands::settings_cmds::list_recent,
            commands::settings_cmds::record_recent,
            commands::undo_cmds::undo_status,
            commands::undo_cmds::undo,
            commands::undo_cmds::redo,
            commands::system_cmds::app_info,
            commands::system_cmds::window_minimize,
            commands::system_cmds::window_toggle_maximize,
            commands::system_cmds::window_close,
            commands::system_cmds::window_is_maximized,
            commands::tools_cmds::tools_sniff_file,
            commands::tools_cmds::tools_audit_directory,
            commands::tools_cmds::tools_compare_binary,
            commands::tools_cmds::tools_list_ads,
            commands::tools_cmds::tools_unblock_file,
            commands::tools_cmds::tools_delete_ads,
            commands::tools_cmds::tools_get_link_info,
            commands::tools_cmds::tools_create_link,
            commands::tools_cmds::tools_remove_link,
            commands::tools_cmds::tools_get_locking_processes,
            commands::tools_cmds::tools_terminate_process,
            commands::tools_cmds::tools_get_timestamps,
            commands::tools_cmds::tools_set_timestamps,
            commands::tools_cmds::tools_set_attributes,
            commands::tools_cmds::tools_split_file,
            commands::tools_cmds::tools_join_files,
            commands::tools_cmds::tools_search_content,
            commands::tools_cmds::tools_nested_folder,
            commands::tools_cmds::tools_nested_file,
            commands::tools_cmds::tools_batch_scaffold,
            commands::tools_cmds::tools_scaffold_catalog,
            commands::tools_cmds::tools_rename_preview,
            commands::tools_cmds::tools_rename_execute,
            commands::tools_cmds::tools_rename_rollback,
            commands::tools_cmds::tools_usn_query,
            commands::tools_cmds::tools_archive_list,
            commands::tools_cmds::tools_archive_extract,
            commands::tools_cmds::tools_archive_create,
            commands::tools_cmds::tools_archive_find_7z,
            commands::tools_cmds::tools_par2_inspect,
            commands::tools_cmds::tools_clone_file,
            commands::tools_cmds::tools_ioring_status,
            commands::tools_cmds::tools_shred_paths,
            commands::tools_cmds::tools_generate_sanitization_cert,
            commands::tools_cmds::tools_fastcdc_analyze,
            commands::tools_cmds::tools_entropy_inspect,
            commands::tools_cmds::tools_git_status,
            commands::tools_cmds::tools_git_diff,
            commands::tools_cmds::tools_git_action,
            commands::tools_cmds::tools_vault_encrypt_file,
            commands::tools_cmds::tools_vault_decrypt_file,
            commands::tools_cmds::tools_vault_encrypt_dir,
            commands::tools_cmds::tools_vault_decrypt_dir,
            commands::tools_cmds::tools_assign_tag,
            commands::tools_cmds::tools_remove_tag,
            commands::tools_cmds::tools_get_tags_for_path,
            commands::tools_cmds::tools_list_all_tags,
            commands::tools_cmds::tools_get_note,
            commands::tools_cmds::tools_set_note,
            commands::tools_cmds::tools_delete_note,
            commands::tools_cmds::tools_run_automation,
            commands::tools_cmds::tools_analyze_treemap,
            commands::tools_cmds::tools_git_file_history,
            commands::tools_cmds::tools_git_file_blame,
            commands::tools_cmds::tools_summarize_document,
            commands::tools_cmds::tools_semantic_index,
            commands::tools_cmds::tools_semantic_search,
            commands::tools_cmds::tools_semantic_hybrid_search,
            commands::tools_cmds::tools_copilot_plan,
            commands::tools_cmds::tools_copilot_execute,
            commands::tools_cmds::tools_copilot_feedback,
            commands::tools_cmds::tools_mesh_start,
            commands::tools_cmds::tools_mesh_get_peers,
            commands::tools_cmds::tools_mesh_send_files,
            commands::tools_cmds::tools_usn_records,
            commands::tools_cmds::tools_usn_search,
            commands::tools_cmds::tools_vss_list,
            commands::tools_cmds::tools_vss_restore,
            commands::tools_cmds::tools_devdrive_report,
            commands::tools_cmds::tools_devdrive_migrate,
            commands::tools_cmds::tools_bitlocker_status,
            commands::tools_cmds::tools_bitlocker_unlock,
            commands::tools_cmds::tools_bitlocker_lock,
            commands::tools_cmds::tools_provenance_log,
            commands::tools_cmds::tools_provenance_verify,
            commands::tools_cmds::tools_provenance_record,
            commands::tools_cmds::tools_metadata_read,
            commands::tools_cmds::tools_metadata_set_id3,
            commands::tools_cmds::tools_ocr_image,
            commands::tools_cmds::tools_sftp_list_profiles,
            commands::tools_cmds::tools_sftp_save_profile,
            commands::tools_cmds::tools_sftp_delete_profile,
            commands::tools_cmds::tools_sftp_list_directory,
            commands::tools_cmds::tools_find_duplicates,
            commands::tools_cmds::tools_flat_branch,
            commands::tools_cmds::tools_list_smart_folders,
            commands::tools_cmds::tools_save_smart_folder,
            commands::tools_cmds::tools_delete_smart_folder,
            commands::tools_cmds::tools_run_smart_folder,
            commands::tools_cmds::tools_hash_create_manifest,
            commands::tools_cmds::tools_hash_verify_manifest,
            commands::tools_cmds::tools_optimize_images,
            commands::tools_cmds::tools_terminal_start,
            commands::tools_cmds::tools_terminal_write,
            commands::tools_cmds::tools_terminal_read,
            commands::tools_cmds::tools_terminal_close,
            commands::tools_cmds::tools_plugins_list,
            commands::tools_cmds::tools_plugins_set_enabled,
            commands::tools_cmds::tools_plugins_execute,
            commands::tools_cmds::tools_plugins_create_sample,
            commands::tools_cmds::tools_plugins_install,
            commands::tools_cmds::tools_archive_list_any,
            commands::tools_cmds::tools_archive_extract_any,
            commands::tools_cmds::tools_archive_create_any,
            commands::tools_cmds::tools_vdfs_summary,
            commands::tools_cmds::tools_vdfs_index,
            commands::tools_cmds::tools_vdfs_add_node,
            commands::tools_cmds::tools_webdrop_start,
            commands::tools_cmds::tools_webdrop_stop,
            commands::tools_cmds::tools_webdrop_status,
            commands::tools_cmds::tools_janitor_scan,
            commands::tools_cmds::tools_janitor_clean,
            commands::tools_cmds::tools_janitor_scan_empty,
            commands::tools_cmds::tools_janitor_clean_empty,
            commands::tools_cmds::tools_dlp_scan,
            commands::tools_cmds::tools_mounter_list,
            commands::tools_cmds::tools_mounter_mount,
            commands::tools_cmds::tools_mounter_unmount,
            commands::tools_cmds::usb_list_devices,
            commands::tools_cmds::usb_get_device,
            commands::tools_cmds::usb_eject_device,
            commands::tools_cmds::usb_get_locks,
            commands::tools_cmds::usb_unlock_and_eject,
            commands::tools_cmds::usb_benchmark,
            commands::tools_cmds::usb_integrity_test,
            commands::tools_cmds::usb_forensic_sanitize,
            commands::tools_cmds::usb_surface_scan,
            commands::tools_cmds::usb_get_multiboot,
            commands::tools_cmds::usb_install_ventoy,
            commands::tools_cmds::usb_add_multiboot_iso,
            commands::tools_cmds::usb_get_topology,
            commands::tools_cmds::usb_set_cache_policy,
            commands::tools_cmds::usb_format,
            commands::tools_cmds::usb_create_disk_image,
            commands::tools_cmds::usb_burn_disk_image,
            commands::tools_cmds::tools_merkle_build,
            commands::tools_cmds::tools_merkle_proof,
            commands::tools_cmds::tools_merkle_verify,
            commands::tools_cmds::tools_merkle_diff,
            commands::tools_cmds::tools_archive_create_sort_enhanced,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nexus Explorer");
}
