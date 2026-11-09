use serde::Serialize;

use super::entry::FileEntry;

/// Channel events for an async directory scan: entry batches, completion, or error.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "event", content = "data", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ScanEvent {
    Batch { entries: Vec<FileEntry> },
    Done { total: u64, duration_ms: u64 },
    Error { message: String },
}

/// Channel events for a filename search: entry batches, completion, or error/cancellation.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "event", content = "data", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum SearchEvent {
    Batch { entries: Vec<FileEntry> },
    Done { total: u64, duration_ms: u64 },
    Error { message: String },
}

/// Channel events for a copy/move/delete job: lifecycle, progress, conflicts, and errors.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "event", content = "data", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum JobEvent {
    Started { job_id: String, kind: String, total_files: u64, total_bytes: u64 },
    Progress {
        job_id: String,
        processed_bytes: u64,
        processed_files: u64,
        total_bytes: u64,
        total_files: u64,
        speed_bps: f64,
        eta_secs: f64,
        current_file: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        acceleration_mode: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        iops: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        active_workers: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        buffer_size_mb: Option<f64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        hash_algorithm: Option<String>,
    },
    FileDone { job_id: String, path: String, ok: bool, error: Option<String> },
    Conflict {
        job_id: String,
        conflict_id: String,
        source: String,
        destination: String,
        source_size: u64,
        dest_size: u64,
        source_modified_ms: u64,
        dest_modified_ms: u64,
        is_dir: bool,
    },
    State { job_id: String, state: String },
    Error { job_id: String, message: String, path: Option<String> },
}

/// Channel events for a recursive folder-size calculation.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "event", content = "data", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum FolderSizeEvent {
    Progress {
        task_id: String,
        files: u64,
        folders: u64,
        bytes: u64,
    },
    Done {
        task_id: String,
        size: u64,
        files: u64,
        folders: u64,
        elapsed_ms: u64,
    },
    Error {
        task_id: String,
        message: String,
    },
}

