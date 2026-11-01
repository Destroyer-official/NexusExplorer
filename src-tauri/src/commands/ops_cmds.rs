//! Copy/move/delete IPC and transfer job control.

use std::sync::Arc;

use nexus_core::models::{JobEvent, JobSummary};
use nexus_core::transfer::{
    self, list_orphan_parts, JobControl, JobKind, JobManager, OrphanPart,
};
use tauri::ipc::Channel;
use tauri::State;
use uuid::Uuid;

fn spawn_transfer(
    kind: JobKind,
    sources: Vec<String>,
    dest_dir: String,
    on_event: Channel<JobEvent>,
    jobs: &JobManager,
) -> Result<String, String> {
    if sources.is_empty() {
        return Err("no sources provided".into());
    }
    if dest_dir.trim().is_empty() {
        return Err("destination directory required".into());
    }

    let job_id = Uuid::new_v4().to_string();
    let control = Arc::new(JobControl::new(kind.as_str()));
    jobs.register(job_id.clone(), Arc::clone(&control));

    let channel = on_event.clone();
    let sink_job_id = job_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut sink = move |event: JobEvent| {
            let _ = channel.send(event);
        };
        transfer::run_transfer_blocking(
            kind,
            sources,
            dest_dir,
            control,
            sink_job_id,
            &mut sink,
        );
    });

    Ok(job_id)
}

/// Starts a copy job for `sources` into `dest_dir`.
#[tauri::command]
pub async fn copy_entries(
    sources: Vec<String>,
    dest_dir: String,
    on_event: Channel<JobEvent>,
    jobs: State<'_, JobManager>,
) -> Result<String, String> {
    spawn_transfer(JobKind::Copy, sources, dest_dir, on_event, &jobs)
}

/// Starts a move job for `sources` into `dest_dir`.
#[tauri::command]
pub async fn move_entries(
    sources: Vec<String>,
    dest_dir: String,
    on_event: Channel<JobEvent>,
    jobs: State<'_, JobManager>,
) -> Result<String, String> {
    spawn_transfer(JobKind::Move, sources, dest_dir, on_event, &jobs)
}

/// Starts a delete job (recycle bin when `to_trash`).
#[tauri::command]
pub async fn delete_entries(
    paths: Vec<String>,
    to_trash: bool,
    on_event: Channel<JobEvent>,
    jobs: State<'_, JobManager>,
) -> Result<String, String> {
    if paths.is_empty() {
        return Err("no paths provided".into());
    }

    let job_id = Uuid::new_v4().to_string();
    let control = Arc::new(JobControl::new("delete"));
    jobs.register(job_id.clone(), Arc::clone(&control));

    let channel = on_event.clone();
    let sink_job_id = job_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut sink = move |event: JobEvent| {
            let _ = channel.send(event);
        };
        transfer::run_delete_blocking(paths, to_trash, control, sink_job_id, &mut sink);
    });

    Ok(job_id)
}

fn control_or_err(jobs: &JobManager, job_id: &str) -> Result<Arc<JobControl>, String> {
    jobs.get(job_id).ok_or_else(|| "job not found".into())
}

/// Pauses a running job and returns its snapshot.
#[tauri::command]
pub async fn pause_job(
    job_id: String,
    jobs: State<'_, JobManager>,
) -> Result<JobSummary, String> {
    let control = control_or_err(&jobs, &job_id)?;
    control.paused.store(true, std::sync::atomic::Ordering::Relaxed);
    control.set_state("paused");
    Ok(control.snapshot(&job_id))
}

/// Resumes a paused job and returns its snapshot.
#[tauri::command]
pub async fn resume_job(
    job_id: String,
    jobs: State<'_, JobManager>,
) -> Result<JobSummary, String> {
    let control = control_or_err(&jobs, &job_id)?;
    control
        .paused
        .store(false, std::sync::atomic::Ordering::Relaxed);
    control.set_state("running");
    control.resume_notify.notify_one();
    Ok(control.snapshot(&job_id))
}

/// Requests cancellation and returns the current snapshot.
#[tauri::command]
pub async fn cancel_job(
    job_id: String,
    jobs: State<'_, JobManager>,
) -> Result<JobSummary, String> {
    let control = control_or_err(&jobs, &job_id)?;
    control.cancel.store(true, std::sync::atomic::Ordering::Relaxed);
    control.resume_notify.notify_one();
    Ok(control.snapshot(&job_id))
}

/// Delivers a conflict resolution to a waiting transfer.
#[tauri::command]
pub async fn resolve_conflict(
    job_id: String,
    conflict_id: String,
    resolution: String,
    apply_to_all: bool,
    jobs: State<'_, JobManager>,
) -> Result<(), String> {
    if !matches!(resolution.as_str(), "skip" | "overwrite" | "keepBoth") {
        return Err(format!("invalid resolution: {resolution}"));
    }
    jobs.resolve(&job_id, &conflict_id, resolution, apply_to_all)
}

/// Returns snapshot summaries for every tracked job.
#[tauri::command]
pub async fn get_active_jobs(jobs: State<'_, JobManager>) -> Result<Vec<JobSummary>, String> {
    Ok(jobs.list_summaries())
}

/// Returns interrupted-transfer artifacts discovered in the journal.
#[tauri::command]
pub async fn orphan_parts() -> Result<Vec<OrphanPart>, String> {
    tauri::async_runtime::spawn_blocking(list_orphan_parts)
        .await
        .map_err(|e| format!("journal scan failed: {e}"))
}
