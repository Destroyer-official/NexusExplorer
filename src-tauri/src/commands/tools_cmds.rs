//! Native Power-User & Forensic IPC commands (100% Rust).

use nexus_core::ai::{AiAgentManager, AiAgentPlan, AiExecutionResult};
use nexus_core::tools::{
    ads::{self, AlternateDataStream},
    archive::{self, ArchiveMetadata, ArchiveOperationResult},
    automation::{self, AutomationExecutionReport, AutomationRule},
    bitlocker::{self, BitLockerVolumeStatus},
    content_search::{self, ContentSearchReport},
    devdrive::{self, DevDriveReport},
    differ::{self, BinaryDiffReport},
    dlp::{self, DlpScanReport},
    duplicates::{self, DuplicateReport},
    flat::{self, FlatListing},
    git::{self, GitBlameLine, GitCommitInfo, GitFileDiff, GitRepoStatus},
    hash_manifest::{self, HashManifestResult, HashVerifyReport},
    imageopt::{self, ImageOptimizeBatch},
    janitor::{self, JanitorCleanResult, JanitorScanReport},
    links::{self, LinkItem},
    mesh::{self, MeshPeer, MeshTransferReport},
    metadata::{self, MediaMetadata},
    mounter::{self, VirtualMount},
    notes::{self, FileAnnotation},
    ocr::{self, OcrResult},
    par2::{self, Par2ValidationReport},
    plugins::{self, PluginExecutionResult, PluginInfo},
    provenance::{self, ProvenanceEvent, ProvenanceVerification},
    renamer::{self, CaseTransformation, RenamePlanItem, RenameTransaction},
    scaffold::{self, ScaffoldResult},
    semantic::{self, SemanticIndex, SemanticMatch},
    sftp::{self, RemoteFileEntry, SftpProfile},
    shredder::{self, ShredAlgorithm, ShredReport},
    smart::{self, SmartFolder, SmartFolderResult},
    sniffer::{self, SniffResult},
    splitter::{self, JoinResult, SplitResult},
    summarizer::{self, DocumentSummary},
    tags::{self, TagItem},
    terminal::{self, TerminalChunk, TerminalStart},
    touch::{self, TimestampInfo},
    treemap::{self, TreemapAnalysis},
    unlocker::{self, LockingProcess},
    usn::{self, UsnJournalInfo, UsnRecordsBatch},
    vault::{self, VaultOperationResult},
    vdfs::{self, VdfsIndexReport, VdfsSummary},
    vss::{self, VssSnapshot},
    webdrop::{self, WebDropStatus},
};

#[tauri::command]
pub async fn tools_sniff_file(path: String) -> Result<SniffResult, String> {
    tauri::async_runtime::spawn_blocking(move || sniffer::sniff_file(&path))
        .await
        .map_err(|e| format!("sniffer task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_audit_directory(root: String) -> Result<Vec<SniffResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        sniffer::audit_directory(&root, |res| results.push(res))
            .map(|_| results)
    })
    .await
    .map_err(|e| format!("audit task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_compare_binary(
    file_a: String,
    file_b: String,
    max_chunks: Option<usize>,
) -> Result<BinaryDiffReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        differ::compare_binary_files(&file_a, &file_b, max_chunks.unwrap_or(200))
    })
    .await
    .map_err(|e| format!("differ task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_list_ads(path: String) -> Result<Vec<AlternateDataStream>, String> {
    tauri::async_runtime::spawn_blocking(move || ads::list_streams(&path))
        .await
        .map_err(|e| format!("ADS listing failed: {e}"))?
}

#[tauri::command]
pub async fn tools_unblock_file(path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || ads::unblock_file(&path))
        .await
        .map_err(|e| format!("unblock task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_delete_ads(path: String, stream_name: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || ads::delete_stream(&path, &stream_name))
        .await
        .map_err(|e| format!("delete ADS task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_get_link_info(path: String) -> Result<LinkItem, String> {
    tauri::async_runtime::spawn_blocking(move || links::get_link_info(&path))
        .await
        .map_err(|e| format!("link info failed: {e}"))?
}

#[tauri::command]
pub async fn tools_create_link(
    link_path: String,
    target_path: String,
    kind: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || match kind.as_str() {
        "junction" => links::create_junction(&link_path, &target_path),
        "hardlink" => links::create_hardlink(&link_path, &target_path),
        "symlink_dir" => links::create_symlink(&link_path, &target_path, true),
        "symlink_file" => links::create_symlink(&link_path, &target_path, false),
        _ => Err(format!("unknown link kind: {kind}")),
    })
    .await
    .map_err(|e| format!("create link failed: {e}"))?
}

#[tauri::command]
pub async fn tools_remove_link(link_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || links::remove_link(&link_path))
        .await
        .map_err(|e| format!("remove link failed: {e}"))?
}

#[tauri::command]
pub async fn tools_get_locking_processes(path: String) -> Result<Vec<LockingProcess>, String> {
    tauri::async_runtime::spawn_blocking(move || unlocker::get_locking_processes(&path))
        .await
        .map_err(|e| format!("unlocker query failed: {e}"))?
}

#[tauri::command]
pub async fn tools_terminate_process(pid: u32) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || unlocker::terminate_locking_process(pid))
        .await
        .map_err(|e| format!("terminate process failed: {e}"))?
}

#[tauri::command]
pub async fn tools_get_timestamps(path: String) -> Result<TimestampInfo, String> {
    tauri::async_runtime::spawn_blocking(move || touch::get_timestamps(&path))
        .await
        .map_err(|e| format!("get timestamps failed: {e}"))?
}

#[tauri::command]
pub async fn tools_set_timestamps(
    path: String,
    created_ms: Option<u64>,
    modified_ms: Option<u64>,
    accessed_ms: Option<u64>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        touch::set_timestamps(&path, created_ms, modified_ms, accessed_ms)
    })
    .await
    .map_err(|e| format!("set timestamps failed: {e}"))?
}

#[tauri::command]
pub async fn tools_set_attributes(
    path: String,
    is_readonly: bool,
    is_hidden: bool,
    is_system: bool,
    is_archive: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        touch::set_attributes(&path, is_readonly, is_hidden, is_system, is_archive)
    })
    .await
    .map_err(|e| format!("set attributes failed: {e}"))?
}

#[tauri::command]
pub async fn tools_split_file(
    source: String,
    chunk_size: u64,
    output_dir: Option<String>,
) -> Result<SplitResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        splitter::split_file(&source, chunk_size, output_dir.as_deref(), None, |_, _, _, _| {})
    })
    .await
    .map_err(|e| format!("split task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_join_files(
    manifest_path: String,
    output_path: Option<String>,
) -> Result<JoinResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        splitter::join_files(&manifest_path, output_path.as_deref(), None, |_, _, _, _| {})
    })
    .await
    .map_err(|e| format!("join task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_search_content(
    root: String,
    pattern: String,
    is_regex: bool,
    case_sensitive: bool,
    max_matches: Option<usize>,
) -> Result<ContentSearchReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        content_search::search_content(
            &root,
            &pattern,
            is_regex,
            case_sensitive,
            max_matches.unwrap_or(200),
            None,
            |_| {},
        )
    })
    .await
    .map_err(|e| format!("content search failed: {e}"))?
}

#[tauri::command]
pub async fn tools_nested_folder(base: String, rel_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scaffold::create_nested_folder(&base, &rel_path)
            .map(|(p, _)| p.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("nested folder creation failed: {e}"))?
}

#[tauri::command]
pub async fn tools_nested_file(
    base: String,
    rel_path: String,
    content: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scaffold::create_nested_file(&base, &rel_path, content.as_deref())
            .map(|(p, _)| p.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("nested file creation failed: {e}"))?
}

#[tauri::command]
pub async fn tools_batch_scaffold(base: String, spec: String) -> Result<ScaffoldResult, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(scaffold::batch_scaffold(&base, &spec)))
        .await
        .map_err(|e| format!("batch scaffold failed: {e}"))?
}

#[tauri::command]
pub async fn tools_scaffold_catalog() -> Result<scaffold::ScaffoldCatalog, String> {
    tauri::async_runtime::spawn_blocking(scaffold::catalog)
        .await
        .map_err(|e| format!("scaffold catalog failed: {e}"))
}

#[tauri::command]
pub async fn tools_rename_preview(
    paths: Vec<String>,
    find: Option<String>,
    replace: String,
    template: Option<String>,
    case: String,
) -> Result<Vec<RenamePlanItem>, String> {
    let transformation = match case.to_lowercase().as_str() {
        "uppercase" => CaseTransformation::Uppercase,
        "lowercase" => CaseTransformation::Lowercase,
        "titlecase" | "title" => CaseTransformation::TitleCase,
        "camelcase" | "camel" => CaseTransformation::CamelCase,
        "snakecase" | "snake" => CaseTransformation::SnakeCase,
        "kebabcase" | "kebab" => CaseTransformation::KebabCase,
        _ => CaseTransformation::None,
    };

    tauri::async_runtime::spawn_blocking(move || {
        renamer::generate_preview(
            &paths,
            find.as_deref(),
            &replace,
            template.as_deref(),
            transformation,
        )
    })
    .await
    .map_err(|e| format!("rename preview failed: {e}"))?
}

#[tauri::command]
pub async fn tools_rename_execute(plan: Vec<RenamePlanItem>) -> Result<RenameTransaction, String> {
    tauri::async_runtime::spawn_blocking(move || renamer::execute_rename_batch(&plan))
        .await
        .map_err(|e| format!("rename execute failed: {e}"))?
}

#[tauri::command]
pub async fn tools_rename_rollback(tx: RenameTransaction) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || renamer::rollback_transaction(&tx))
        .await
        .map_err(|e| format!("rename rollback failed: {e}"))?
}

#[tauri::command]
pub async fn tools_usn_query(volume: String) -> Result<UsnJournalInfo, String> {
    tauri::async_runtime::spawn_blocking(move || usn::query_usn_journal(&volume))
        .await
        .map_err(|e| format!("USN query failed: {e}"))?
}

#[tauri::command]
pub async fn tools_archive_list(archive_path: String) -> Result<ArchiveMetadata, String> {
    tauri::async_runtime::spawn_blocking(move || archive::list_zip_archive(&archive_path))
        .await
        .map_err(|e| format!("archive list failed: {e}"))?
}

#[tauri::command]
pub async fn tools_archive_extract(
    archive_path: String,
    dest_dir: String,
) -> Result<ArchiveOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        archive::extract_zip_archive(&archive_path, &dest_dir, None, |_, _, _| {})
    })
    .await
    .map_err(|e| format!("archive extract failed: {e}"))?
}

#[tauri::command]
pub async fn tools_archive_create(
    sources: Vec<String>,
    dest_zip_path: String,
    compression_level: Option<u8>,
) -> Result<ArchiveOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        archive::create_zip_archive(
            &sources,
            &dest_zip_path,
            compression_level.unwrap_or(6),
            |_, _, _| {},
        )
    })
    .await
    .map_err(|e| format!("archive create failed: {e}"))?
}

#[tauri::command]
pub async fn tools_archive_find_7z() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        Ok(archive::find_7z_binary().map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| format!("7z search failed: {e}"))?
}

#[tauri::command]
pub async fn tools_par2_inspect(path: String) -> Result<Par2ValidationReport, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(par2::inspect_par2_file(&path)))
        .await
        .map_err(|e| format!("par2 inspection failed: {e}"))?
}

#[tauri::command]
pub async fn tools_clone_file(
    src_path: String,
    dest_path: String,
) -> Result<nexus_core::fs::cow::CloneResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        nexus_core::fs::cow::clone_file(&src_path, &dest_path)
    })
    .await
    .map_err(|e| format!("cow clone task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_shred_paths(
    paths: Vec<String>,
    algorithm: Option<String>,
) -> Result<ShredReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let algo = match algorithm.as_deref() {
            Some("zero") => ShredAlgorithm::Zero,
            Some("random") => ShredAlgorithm::Random,
            Some("dod3") => ShredAlgorithm::Dod3Pass,
            Some("dod7") => ShredAlgorithm::Dod7Pass,
            Some("gutmann") => ShredAlgorithm::Gutmann35Pass,
            _ => ShredAlgorithm::Dod3Pass,
        };
        Ok(shredder::shred_paths(&paths, algo, |_| {}))
    })
    .await
    .map_err(|e| format!("shred task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_git_status(dir_path: String) -> Result<GitRepoStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(git::get_git_status(std::path::Path::new(&dir_path)))
    })
    .await
    .map_err(|e| format!("git status task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_git_diff(file_path: String) -> Result<GitFileDiff, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git::generate_file_diff(std::path::Path::new(&file_path))
    })
    .await
    .map_err(|e| format!("git diff task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_git_action(
    repo_root: String,
    action: String,
    file_paths: Vec<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git::execute_git_action(std::path::Path::new(&repo_root), &action, &file_paths)
    })
    .await
    .map_err(|e| format!("git action task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vault_encrypt_file(
    src_path: String,
    vault_path: String,
    password: String,
) -> Result<VaultOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        vault::encrypt_file(std::path::Path::new(&src_path), std::path::Path::new(&vault_path), &password)
    })
    .await
    .map_err(|e| format!("vault encrypt task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vault_decrypt_file(
    vault_path: String,
    dest_path: String,
    password: String,
) -> Result<VaultOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        vault::decrypt_file(std::path::Path::new(&vault_path), std::path::Path::new(&dest_path), &password)
    })
    .await
    .map_err(|e| format!("vault decrypt task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vault_encrypt_dir(
    src_dir: String,
    vault_path: String,
    password: String,
) -> Result<VaultOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        vault::encrypt_directory(std::path::Path::new(&src_dir), std::path::Path::new(&vault_path), &password)
    })
    .await
    .map_err(|e| format!("vault dir encrypt task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vault_decrypt_dir(
    vault_path: String,
    dest_dir: String,
    password: String,
) -> Result<VaultOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        vault::decrypt_directory(std::path::Path::new(&vault_path), std::path::Path::new(&dest_dir), &password)
    })
    .await
    .map_err(|e| format!("vault dir decrypt task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_assign_tag(
    path: String,
    tag_name: String,
    color: Option<String>,
) -> Result<TagItem, String> {
    tauri::async_runtime::spawn_blocking(move || {
        tags::assign_tag(&path, &tag_name, color.as_deref(), None)
    })
    .await
    .map_err(|e| format!("assign tag task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_remove_tag(path: String, tag_name: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        tags::remove_tag(&path, &tag_name, None)
    })
    .await
    .map_err(|e| format!("remove tag task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_get_tags_for_path(path: String) -> Result<Vec<TagItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(tags::get_tags_for_path(&path, None))
    })
    .await
    .map_err(|e| format!("get tags task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_list_all_tags() -> Result<Vec<TagItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(tags::list_all_tags(None))
    })
    .await
    .map_err(|e| format!("list tags task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_get_note(path: String) -> Result<Option<FileAnnotation>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(notes::get_note(&path, None))
    })
    .await
    .map_err(|e| format!("get note task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_set_note(path: String, markdown: String) -> Result<FileAnnotation, String> {
    tauri::async_runtime::spawn_blocking(move || {
        notes::set_note(&path, &markdown, None)
    })
    .await
    .map_err(|e| format!("set note task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_delete_note(path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        notes::delete_note(&path, None)
    })
    .await
    .map_err(|e| format!("delete note task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_run_automation(
    rules: Vec<AutomationRule>,
    target_dir: String,
) -> Result<AutomationExecutionReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        automation::evaluate_and_run_rules(&rules, std::path::Path::new(&target_dir))
    })
    .await
    .map_err(|e| format!("automation task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_analyze_treemap(
    dir_path: String,
    canvas_width: Option<f64>,
    canvas_height: Option<f64>,
    max_depth: Option<usize>,
) -> Result<TreemapAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        treemap::analyze_treemap(
            std::path::Path::new(&dir_path),
            canvas_width.unwrap_or(900.0),
            canvas_height.unwrap_or(550.0),
            max_depth,
        )
    })
    .await
    .map_err(|e| format!("treemap analysis task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_git_file_history(
    repo_root: String,
    rel_path: String,
    limit: Option<usize>,
) -> Result<Vec<GitCommitInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git::get_file_history(std::path::Path::new(&repo_root), &rel_path, limit.unwrap_or(20))
    })
    .await
    .map_err(|e| format!("git history task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_git_file_blame(
    repo_root: String,
    rel_path: String,
) -> Result<Vec<GitBlameLine>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        git::get_file_blame(std::path::Path::new(&repo_root), &rel_path)
    })
    .await
    .map_err(|e| format!("git blame task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_summarize_document(
    file_path: String,
    max_bullets: Option<usize>,
) -> Result<DocumentSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        summarizer::summarize_file(std::path::Path::new(&file_path), max_bullets.unwrap_or(5))
    })
    .await
    .map_err(|e| format!("summarize task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_semantic_index(
    root_dir: String,
    max_files: Option<usize>,
) -> Result<SemanticIndex, String> {
    tauri::async_runtime::spawn_blocking(move || {
        semantic::build_semantic_index(std::path::Path::new(&root_dir), max_files.unwrap_or(500))
    })
    .await
    .map_err(|e| format!("semantic index task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_semantic_search(
    root_dir: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SemanticMatch>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        semantic::search_semantic(std::path::Path::new(&root_dir), &query, limit.unwrap_or(25))
    })
    .await
    .map_err(|e| format!("semantic search task failed: {e}"))?
}

static AGENT_MANAGER: std::sync::LazyLock<AiAgentManager> = std::sync::LazyLock::new(AiAgentManager::new);

#[tauri::command]
pub async fn tools_copilot_plan(
    prompt: String,
    current_dir: String,
) -> Result<AiAgentPlan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        AGENT_MANAGER.formulate_plan(&prompt, std::path::Path::new(&current_dir))
    })
    .await
    .map_err(|e| format!("ai plan task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_copilot_execute(
    plan: AiAgentPlan,
    current_dir: String,
) -> Result<AiExecutionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        AGENT_MANAGER.execute_plan(&plan, std::path::Path::new(&current_dir))
    })
    .await
    .map_err(|e| format!("ai execute task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_copilot_feedback(
    action_kind: String,
    reward: f32,
) -> Result<(), String> {
    AGENT_MANAGER.record_feedback(&action_kind, reward);
    Ok(())
}

#[tauri::command]
pub async fn tools_mesh_start() -> Result<(), String> {
    mesh::start_mesh_service()
}

#[tauri::command]
pub async fn tools_mesh_get_peers() -> Result<Vec<MeshPeer>, String> {
    Ok(mesh::get_active_peers())
}

#[tauri::command]
pub async fn tools_mesh_send_files(
    target_ip: String,
    target_port: u16,
    file_paths: Vec<String>,
) -> Result<MeshTransferReport, String> {
    mesh::send_files_to_peer(&target_ip, target_port, &file_paths).await
}

#[tauri::command]
pub async fn tools_usn_records(
    volume_path: String,
    start_usn: Option<i64>,
    max_records: Option<usize>,
    reason_mask: Option<u32>,
) -> Result<UsnRecordsBatch, String> {
    tauri::async_runtime::spawn_blocking(move || {
        usn::read_usn_records(&volume_path, start_usn, max_records.unwrap_or(50), reason_mask)
    })
    .await
    .map_err(|e| format!("USN records task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vss_list(volume: Option<String>) -> Result<Vec<VssSnapshot>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        vss::list_vss_snapshots(volume.as_deref())
    })
    .await
    .map_err(|e| format!("VSS list task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vss_restore(
    snapshot_path: String,
    relative_path: String,
    destination: String,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        vss::restore_vss_file(&snapshot_path, &relative_path, std::path::Path::new(&destination))
    })
    .await
    .map_err(|e| format!("VSS restore task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_devdrive_report() -> Result<DevDriveReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(devdrive::generate_dev_drive_report())
    })
    .await
    .map_err(|e| format!("DevDrive report task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_bitlocker_status(drive: Option<String>) -> Result<Vec<BitLockerVolumeStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        bitlocker::get_bitlocker_status(drive.as_deref())
    })
    .await
    .map_err(|e| format!("BitLocker status task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_bitlocker_unlock(
    drive: String,
    password: Option<String>,
    recovery_key: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        bitlocker::unlock_bitlocker_volume(&drive, password.as_deref(), recovery_key.as_deref())
    })
    .await
    .map_err(|e| format!("BitLocker unlock task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_bitlocker_lock(drive: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        bitlocker::lock_bitlocker_volume(&drive)
    })
    .await
    .map_err(|e| format!("BitLocker lock task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_provenance_log() -> Result<Vec<ProvenanceEvent>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        provenance::read_provenance_records(None)
    })
    .await
    .map_err(|e| format!("Provenance log task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_provenance_verify() -> Result<ProvenanceVerification, String> {
    tauri::async_runtime::spawn_blocking(move || {
        provenance::verify_provenance_chain(None)
    })
    .await
    .map_err(|e| format!("Provenance verify task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_provenance_record(
    event_type: String,
    file_path: String,
    actor: Option<String>,
) -> Result<ProvenanceEvent, String> {
    tauri::async_runtime::spawn_blocking(move || {
        provenance::record_provenance_event(&event_type, std::path::Path::new(&file_path), actor.as_deref(), None)
    })
    .await
    .map_err(|e| format!("Provenance record task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_metadata_read(path: String) -> Result<MediaMetadata, String> {
    tauri::async_runtime::spawn_blocking(move || {
        metadata::read_media_metadata(std::path::Path::new(&path))
    })
    .await
    .map_err(|e| format!("Metadata read task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_metadata_set_id3(
    path: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    year: Option<String>,
    track: Option<u8>,
    genre: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        metadata::update_mp3_id3v1(
            std::path::Path::new(&path),
            title.as_deref(),
            artist.as_deref(),
            album.as_deref(),
            year.as_deref(),
            track,
            genre.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Metadata update task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_ocr_image(path: String, lang: Option<String>) -> Result<OcrResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ocr::extract_text_from_image(std::path::Path::new(&path), lang.as_deref())
    })
    .await
    .map_err(|e| format!("OCR task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_sftp_list_profiles() -> Result<Vec<SftpProfile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sftp::list_sftp_profiles(None)
    })
    .await
    .map_err(|e| format!("SFTP list profiles failed: {e}"))?
}

#[tauri::command]
pub async fn tools_sftp_save_profile(profile: SftpProfile) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        sftp::save_sftp_profile(profile, None)
    })
    .await
    .map_err(|e| format!("SFTP save profile failed: {e}"))?
}

#[tauri::command]
pub async fn tools_sftp_delete_profile(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        sftp::delete_sftp_profile(&id, None)
    })
    .await
    .map_err(|e| format!("SFTP delete profile failed: {e}"))?
}

#[tauri::command]
pub async fn tools_sftp_list_directory(
    profile_id: String,
    remote_path: Option<String>,
) -> Result<Vec<RemoteFileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let profiles = sftp::list_sftp_profiles(None)?;
        let prof = profiles
            .into_iter()
            .find(|p| p.id == profile_id)
            .ok_or_else(|| format!("SFTP Profile ID '{profile_id}' not found"))?;
        sftp::list_remote_directory(&prof, remote_path.as_deref())
    })
    .await
    .map_err(|e| format!("SFTP list directory task failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Duplicate finder / flat branch / smart folders
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_find_duplicates(
    root: String,
    min_size: Option<u64>,
    max_depth: Option<usize>,
) -> Result<DuplicateReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        duplicates::find_duplicates(
            std::path::Path::new(&root),
            min_size.unwrap_or(1),
            max_depth,
            None,
            |_, _| {},
        )
    })
    .await
    .map_err(|e| format!("duplicate scan failed: {e}"))?
}

#[tauri::command]
pub async fn tools_flat_branch(
    root: String,
    max_depth: Option<usize>,
    max_entries: Option<usize>,
) -> Result<FlatListing, String> {
    tauri::async_runtime::spawn_blocking(move || {
        flat::list_flat_branch(std::path::Path::new(&root), max_depth, max_entries)
    })
    .await
    .map_err(|e| format!("flat branch failed: {e}"))?
}

#[tauri::command]
pub async fn tools_list_smart_folders() -> Result<Vec<SmartFolder>, String> {
    tauri::async_runtime::spawn_blocking(smart::list_smart_folders)
        .await
        .map_err(|e| format!("smart folders failed: {e}"))
}

#[tauri::command]
pub async fn tools_save_smart_folder(folder: SmartFolder) -> Result<Vec<SmartFolder>, String> {
    tauri::async_runtime::spawn_blocking(move || smart::save_smart_folder(folder))
        .await
        .map_err(|e| format!("save smart folder failed: {e}"))?
}

#[tauri::command]
pub async fn tools_delete_smart_folder(id: String) -> Result<Vec<SmartFolder>, String> {
    tauri::async_runtime::spawn_blocking(move || smart::delete_smart_folder(&id))
        .await
        .map_err(|e| format!("delete smart folder failed: {e}"))?
}

#[tauri::command]
pub async fn tools_run_smart_folder(
    folder: SmartFolder,
    max_results: Option<usize>,
) -> Result<SmartFolderResult, String> {
    tauri::async_runtime::spawn_blocking(move || smart::run_smart_folder(&folder, max_results))
        .await
        .map_err(|e| format!("run smart folder failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Checksum manifests
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_hash_create_manifest(
    root: String,
    algorithm: String,
    manifest_path: Option<String>,
) -> Result<HashManifestResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        hash_manifest::create_manifest(
            std::path::Path::new(&root),
            &algorithm,
            manifest_path.as_deref().map(std::path::Path::new),
        )
    })
    .await
    .map_err(|e| format!("manifest create failed: {e}"))?
}

#[tauri::command]
pub async fn tools_hash_verify_manifest(manifest_path: String) -> Result<HashVerifyReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        hash_manifest::verify_manifest(std::path::Path::new(&manifest_path))
    })
    .await
    .map_err(|e| format!("manifest verify failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Image optimizer
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_optimize_images(
    paths: Vec<String>,
    format: String,
    quality: Option<u8>,
) -> Result<ImageOptimizeBatch, String> {
    tauri::async_runtime::spawn_blocking(move || {
        imageopt::optimize_images_batch(&paths, &format, quality.unwrap_or(85))
    })
    .await
    .map_err(|e| format!("image optimization failed: {e}"))
}

// -----------------------------------------------------------------------------
// Embedded terminal
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_terminal_start(cwd: String, shell: Option<String>) -> Result<TerminalStart, String> {
    tauri::async_runtime::spawn_blocking(move || terminal::start_session(&cwd, shell.as_deref()))
        .await
        .map_err(|e| format!("terminal start failed: {e}"))?
}

#[tauri::command]
pub async fn tools_terminal_write(session_id: String, data: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || terminal::write_session(&session_id, &data))
        .await
        .map_err(|e| format!("terminal write failed: {e}"))?
}

#[tauri::command]
pub async fn tools_terminal_read(session_id: String) -> Result<TerminalChunk, String> {
    tauri::async_runtime::spawn_blocking(move || terminal::read_session(&session_id))
        .await
        .map_err(|e| format!("terminal read failed: {e}"))?
}

#[tauri::command]
pub async fn tools_terminal_close(session_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || terminal::close_session(&session_id))
        .await
        .map_err(|e| format!("terminal close failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Declarative plugins
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_plugins_list() -> Result<Vec<PluginInfo>, String> {
    tauri::async_runtime::spawn_blocking(plugins::list_plugins)
        .await
        .map_err(|e| format!("plugin list failed: {e}"))
}

#[tauri::command]
pub async fn tools_plugins_set_enabled(
    plugin_id: String,
    enabled: bool,
) -> Result<Vec<PluginInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || plugins::set_plugin_enabled(&plugin_id, enabled))
        .await
        .map_err(|e| format!("plugin state failed: {e}"))?
}

#[tauri::command]
pub async fn tools_plugins_execute(
    plugin_id: String,
    command_id: String,
) -> Result<PluginExecutionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        plugins::execute_plugin_command(&plugin_id, &command_id)
    })
    .await
    .map_err(|e| format!("plugin execution failed: {e}"))?
}

#[tauri::command]
pub async fn tools_plugins_create_sample() -> Result<PluginInfo, String> {
    tauri::async_runtime::spawn_blocking(plugins::create_sample_plugin)
        .await
        .map_err(|e| format!("sample plugin failed: {e}"))?
}

#[tauri::command]
pub async fn tools_plugins_install(source_dir: String) -> Result<PluginInfo, String> {
    tauri::async_runtime::spawn_blocking(move || {
        plugins::install_plugin_from_dir(std::path::Path::new(&source_dir))
    })
    .await
    .map_err(|e| format!("plugin install failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Universal archive engine (ZIP native, 7z/tar via 7-Zip)
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_archive_list_any(archive_path: String) -> Result<ArchiveMetadata, String> {
    tauri::async_runtime::spawn_blocking(move || archive::list_archive(&archive_path))
        .await
        .map_err(|e| format!("archive list failed: {e}"))?
}

#[tauri::command]
pub async fn tools_archive_extract_any(
    archive_path: String,
    dest_dir: String,
) -> Result<ArchiveOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || archive::extract_archive(&archive_path, &dest_dir))
        .await
        .map_err(|e| format!("archive extract failed: {e}"))?
}

#[tauri::command]
pub async fn tools_archive_create_any(
    sources: Vec<String>,
    dest_path: String,
    compression_level: Option<u8>,
    format: Option<String>,
) -> Result<ArchiveOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        archive::create_archive(
            &sources,
            &dest_path,
            compression_level.unwrap_or(5),
            format.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("archive create failed: {e}"))?
}

// -----------------------------------------------------------------------------
// VDFS & Content-Addressed Storage (CAS)
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_vdfs_summary() -> Result<VdfsSummary, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let cat = vdfs::load_catalog();
        Ok(vdfs::get_summary(&cat))
    })
    .await
    .map_err(|e| format!("vdfs summary task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vdfs_index(path: String, node_id: String) -> Result<VdfsIndexReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cat = vdfs::load_catalog();
        let (updated, report) = vdfs::index_directory(path, &node_id, cat)
            .map_err(|e| format!("vdfs index failed: {e}"))?;
        let _ = vdfs::save_catalog(&updated);
        Ok(report)
    })
    .await
    .map_err(|e| format!("vdfs index task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_vdfs_add_node(
    id: String,
    name: String,
    node_type: String,
    endpoint: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cat = vdfs::load_catalog();
        vdfs::add_node(&mut cat, id, name, node_type, endpoint);
        vdfs::save_catalog(&cat).map_err(|e| format!("save vdfs node failed: {e}"))
    })
    .await
    .map_err(|e| format!("vdfs add node task failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Mobile QR-Code Instant AirDrop / Direct WebDrop
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_webdrop_start(
    paths: Vec<String>,
    port: Option<u16>,
) -> Result<WebDropStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        webdrop::start_webdrop(paths, port)
    })
    .await
    .map_err(|e| format!("webdrop start task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_webdrop_stop() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        webdrop::stop_webdrop();
        Ok(())
    })
    .await
    .map_err(|e| format!("webdrop stop task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_webdrop_status() -> Result<WebDropStatus, String> {
    tauri::async_runtime::spawn_blocking(|| {
        Ok(webdrop::get_webdrop_status())
    })
    .await
    .map_err(|e| format!("webdrop status task failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Developer Cache & Build Artifact Janitor
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_janitor_scan(root: String) -> Result<JanitorScanReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        janitor::scan_developer_artifacts(root).map_err(|e| format!("janitor scan failed: {e}"))
    })
    .await
    .map_err(|e| format!("janitor scan task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_janitor_clean(paths: Vec<String>) -> Result<JanitorCleanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(janitor::clean_developer_artifacts(&paths))
    })
    .await
    .map_err(|e| format!("janitor clean task failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Sensitive Data Loss Prevention (DLP) & Secret Leak Scanner
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_dlp_scan(paths: Vec<String>) -> Result<DlpScanReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(dlp::scan_paths_for_leaks(&paths))
    })
    .await
    .map_err(|e| format!("dlp scan task failed: {e}"))?
}

// -----------------------------------------------------------------------------
// Universal Virtual Drive Mounter
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn tools_mounter_list() -> Result<Vec<VirtualMount>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        Ok(mounter::list_active_mounts())
    })
    .await
    .map_err(|e| format!("mounter list task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_mounter_mount(
    source: String,
    preferred_letter: Option<char>,
) -> Result<VirtualMount, String> {
    tauri::async_runtime::spawn_blocking(move || {
        mounter::mount_virtual_drive(source, preferred_letter)
    })
    .await
    .map_err(|e| format!("mounter mount task failed: {e}"))?
}

#[tauri::command]
pub async fn tools_mounter_unmount(drive_letter: char) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        mounter::unmount_virtual_drive(drive_letter)
    })
    .await
    .map_err(|e| format!("mounter unmount task failed: {e}"))?
}
