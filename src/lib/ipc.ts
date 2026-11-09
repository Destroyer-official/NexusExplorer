/** Typed IPC façade over the Rust commands. */

import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";
import type {
  AppInfo,
  Bookmark,
  DriveInfo,
  EntryProperties,
  FileEntry,
  FileHash,
  FolderSizeEvent,
  JobEvent,
  JobSummary,
  KnownFolder,
  PreviewData,
  RecentEntry,
  ScanEvent,
  ScanStart,
  SearchEvent,
  Settings,
  TextPreview,
  UndoStatus,
  SniffResult,
  BinaryDiffReport,
  AlternateDataStream,
  LinkItem,
  LockingProcess,
  TimestampInfo,
  SplitResult,
  JoinResult,
  ContentSearchReport,
  ScaffoldResult,
  ScaffoldCatalog,
  RenamePlanItem,
  RenameTransaction,
  UsnJournalInfo,
  CaseTransformation,
  ArchiveMetadata,
  ArchiveOperationResult,
  Par2ValidationReport,
  CloneResult,
  ShredAlgorithm,
  ShredReport,
  SanitizationCertificate,
  IoRingCapabilities,
  BlockDeduplicationReport,
  EntropyReport,
  MerkleTreeReport,
  MerkleProof,
  MerkleDiffReport,
  GitRepoStatus,
  GitFileDiff,
  VaultOperationResult,
  HexSlice,
  TagItem,
  FileAnnotation,
  TreemapAnalysis,
  GitBlameLine,
  GitCommitInfo,
  DocumentSummary,
  SemanticIndex,
  SemanticMatch,
  CopilotPlan,
  CopilotExecutionResult,
  MeshPeer,
  MeshTransferReport,
  UsnRecordsBatch,
  VssSnapshot,
  DevDriveReport,
  BitLockerVolumeStatus,
  ProvenanceEvent,
  ProvenanceVerification,
  MediaMetadata,
  OcrResult,
  SftpProfile,
  RemoteFileEntry,
  DuplicateReport,
  FlatListing,
  SmartFolder,
  SmartFolderResult,
  HashManifestResult,
  HashVerifyReport,
  ImageOptimizeBatch,
  TerminalStart,
  TerminalChunk,
  PluginInfo,
  PluginExecutionResult,
  VdfsSummary,
  VdfsIndexReport,
  WebDropStatus,
  JanitorScanReport,
  JanitorCleanResult,
  EmptyDirsReport,
  EmptyDirsCleanResult,
  DlpScanReport,
  VirtualMount,
  UsbDeviceDetails,
  UsbLockingProcess,
  UsbSpeedBenchmarkResult,
  UsbIntegrityResult,
  UsbFormatOptions,
  UsbDiskImageOptions,
  UsbSurfaceScanReport,
  UsbMultiBootConfig,
  UsbMultiBootIso,
  UsbBusTopology,
  UsbSanitizeReport,
  PackageCacheMigrationResult,
  UsnRecordEntry,
} from "@/types";

export function toErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
}

export function assetUrl(path: string): string {
  if (!isTauri()) {
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) {
      return path;
    }
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%2338bdf8" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

async function invokeSafe<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    return invoke<T>(cmd, args);
  }
  const { mockDispatch } = await import("./mockBackend");
  return mockDispatch<T>(cmd, args);
}

export const ipc = {
  // ── filesystem ──────────────────────────────────────────────────────────
  readDir: (path: string) => invokeSafe<FileEntry[]>("read_dir", { path }),

  statPath: (path: string) => invokeSafe<FileEntry | null>("stat_path", { path }),

  scanDir: async (path: string, onEvent: (event: ScanEvent) => void): Promise<ScanStart> => {
    if (!isTauri()) {
      const { getMockEntries } = await import("./mockBackend");
      const entries = getMockEntries(path);
      setTimeout(() => {
        onEvent({ event: "batch", data: { entries } });
        onEvent({ event: "done", data: { total: entries.length, durationMs: 12 } });
      }, 20);
      return { scanId: "mock-scan-" + Date.now(), rootPath: path };
    }
    const channel = new Channel<ScanEvent>();
    channel.onmessage = onEvent;
    return invokeSafe<ScanStart>("scan_dir", { path, onEvent: channel });
  },

  cancelScan: (scanId: string) => invokeSafe<void>("cancel_scan", { scanId }),

  getDrives: () => invokeSafe<DriveInfo[]>("get_drives"),

  homeDir: () => invokeSafe<string>("home_dir"),

  knownFolders: () => invokeSafe<KnownFolder[]>("known_folders"),

  createFolder: (parent: string, name: string, unique = false) =>
    invokeSafe<FileEntry>("create_folder", { parent, name, unique }),

  createFile: (parent: string, name: string, unique = false) =>
    invokeSafe<FileEntry>("create_file", { parent, name, unique }),

  renameEntry: (path: string, newName: string) =>
    invokeSafe<FileEntry>("rename_entry", { path, newName }),

  readTextFile: (path: string, maxBytes = 131_072) =>
    invokeSafe<TextPreview>("read_text_file", { path, maxBytes }),

  writeTextFile: (path: string, content: string) =>
    invokeSafe<void>("write_text_file", { path, content }),

  readHexSlice: (path: string, offset: number, length: number) =>
    invokeSafe<HexSlice>("read_hex_slice", { path, offset, length }),

  writeHexSlice: (path: string, offset: number, bytes: number[]) =>
    invokeSafe<void>("write_hex_slice", { path, offset, bytes }),

  openPath: async (path: string) => {
    if (isTauri()) {
      try {
        const { openPath: openerOpen } = await import("@tauri-apps/plugin-opener");
        await openerOpen(path);
        return;
      } catch {
        // Fallback to custom rust command
      }
    }
    return invokeSafe<void>("open_path", { path });
  },

  openTerminal: (path: string) => invokeSafe<void>("open_terminal", { path }),

  revealInShell: (path: string) => invokeSafe<void>("reveal_in_shell", { path }),

  watchDir: (path: string) => invokeSafe<void>("watch_dir", { path }),

  unwatchDir: (path: string) => invokeSafe<void>("unwatch_dir", { path }),

  // ── previews & metrics ──────────────────────────────────────────────────
  previewFile: (path: string, maxBytes = 131_072) =>
    invokeSafe<PreviewData>("preview_file", { path, maxBytes }),

  hashFile: (path: string, algorithm: "xxh3" | "sha256" | "blake3" = "sha256") =>
    invokeSafe<FileHash>("hash_file", { path, algorithm }),

  folderSize: async (
    path: string,
    onEvent: (event: FolderSizeEvent) => void,
  ): Promise<string> => {
    if (!isTauri()) {
      const taskId = "mock-size-" + Date.now();
      setTimeout(async () => {
        const { calculateMockFolderStats } = await import("@/lib/mockBackend");
        const stats = calculateMockFolderStats(path);
        onEvent({ event: "progress", data: { taskId, files: stats.files, folders: stats.folders, bytes: stats.size } });
        onEvent({ event: "done", data: { taskId, size: stats.size, files: stats.files, folders: stats.folders, elapsedMs: 15 } });
      }, 30);
      return taskId;
    }
    const channel = new Channel<FolderSizeEvent>();
    channel.onmessage = onEvent;
    return invokeSafe<string>("folder_size", { path, onEvent: channel });
  },

  cancelFolderSize: (taskId: string) =>
    invokeSafe<void>("cancel_folder_size", { taskId }),

  entryProperties: (path: string) => invokeSafe<EntryProperties>("entry_properties", { path }),

  // ── transfers ───────────────────────────────────────────────────────────
  copyEntries: async (
    sources: string[],
    destDir: string,
    onEvent: (event: JobEvent) => void,
  ): Promise<string> => {
    if (!isTauri()) {
      const jobId = "mock-copy-" + Date.now();
      const totalFiles = sources.length;
      const totalBytes = Math.max(1024, sources.length * 1048576);
      onEvent({ event: "started", data: { jobId, kind: "copy", totalFiles, totalBytes } });
      
      let step = 0;
      const interval = setInterval(() => {
        step += 1;
        const progressFrac = Math.min(1, step * 0.5);
        const processedBytes = Math.round(totalBytes * progressFrac);
        const processedFiles = Math.round(totalFiles * progressFrac);
        const speedBps = 850_000_000;
        const etaSecs = Math.max(0, (totalBytes - processedBytes) / speedBps);
        const currentFile = sources[(step - 1) % sources.length] || sources[0] || "file";

        onEvent({
          event: "progress",
          data: {
            jobId,
            processedBytes,
            processedFiles,
            totalBytes,
            totalFiles,
            speedBps,
            etaSecs,
            currentFile,
            accelerationMode: "nvme_direct_stream",
            iops: 12000,
            activeWorkers: 4,
          } as any,
        });

        onEvent({
          event: "fileDone",
          data: {
            jobId,
            path: `${currentFile} [Verified]`,
            ok: true,
            error: null,
          },
        });

        if (step >= 2) {
          clearInterval(interval);
          void import("./mockBackend").then(({ addMockEntryToParent }) => {
            for (const s of sources) {
              const rawName = s.split(/[\\\/]/).pop() || "copied_file";
              const dotIdx = rawName.lastIndexOf(".");
              const stem = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName;
              const ext = dotIdx > 0 ? rawName.slice(dotIdx + 1) : "";
              const isSameDir = s.replace(/[\/\\][^/\\]+$/, "").replace(/[\/\\]+$/, "").toLowerCase() === destDir.replace(/[\/\\]+$/, "").toLowerCase();
              const name = isSameDir ? `${stem} - Copy${ext ? "." + ext : ""}` : rawName;
              addMockEntryToParent(destDir, {
                name,
                path: `${destDir}\\${name}`,
                parentPath: destDir,
                isDir: !ext,
                size: 1048576,
                modifiedMs: Date.now(),
                createdMs: Date.now(),
                isHidden: false,
                isSystem: false,
                isReadonly: false,
                ext,
              });
            }
          });
          onEvent({
            event: "progress",
            data: {
              jobId,
              processedBytes: totalBytes,
              processedFiles: totalFiles,
              totalBytes,
              totalFiles,
              speedBps,
              etaSecs: 0,
              currentFile: null,
              accelerationMode: "nvme_direct_stream",
              iops: 12000,
              activeWorkers: 1,
            } as any,
          });
          onEvent({ event: "state", data: { jobId, state: "completed" } });
        }
      }, 120);

      return jobId;
    }
    const channel = new Channel<JobEvent>();
    channel.onmessage = onEvent;
    return invokeSafe<string>("copy_entries", { sources, destDir, onEvent: channel });
  },

  moveEntries: async (
    sources: string[],
    destDir: string,
    onEvent: (event: JobEvent) => void,
  ): Promise<string> => {
    if (!isTauri()) {
      const jobId = "mock-move-" + Date.now();
      const totalFiles = sources.length;
      const totalBytes = Math.max(1024, sources.length * 1048576);
      onEvent({ event: "started", data: { jobId, kind: "move", totalFiles, totalBytes } });
      
      let step = 0;
      const interval = setInterval(() => {
        step += 1;
        const progressFrac = Math.min(1, step * 0.5);
        const processedBytes = Math.round(totalBytes * progressFrac);
        const processedFiles = Math.round(totalFiles * progressFrac);
        const speedBps = 950_000_000;
        const etaSecs = Math.max(0, (totalBytes - processedBytes) / speedBps);
        const currentFile = sources[(step - 1) % sources.length] || sources[0] || "file";

        onEvent({
          event: "progress",
          data: {
            jobId,
            processedBytes,
            processedFiles,
            totalBytes,
            totalFiles,
            speedBps,
            etaSecs,
            currentFile,
            accelerationMode: "kernel_offload",
            iops: 14500,
            activeWorkers: 4,
          } as any,
        });

        onEvent({
          event: "fileDone",
          data: {
            jobId,
            path: `${currentFile} [atomic move verified]`,
            ok: true,
            error: null,
          },
        });

        if (step >= 2) {
          clearInterval(interval);
          void import("./mockBackend").then(({ addMockEntryToParent, deleteMockPaths }) => {
            for (const s of sources) {
              const name = s.split(/[\\\/]/).pop() || "moved_file";
              const ext = name.includes(".") ? name.split(".").pop() || "" : "";
              addMockEntryToParent(destDir, {
                name,
                path: `${destDir}\\${name}`,
                parentPath: destDir,
                isDir: !ext,
                size: 1048576,
                modifiedMs: Date.now(),
                createdMs: Date.now(),
                isHidden: false,
                isSystem: false,
                isReadonly: false,
                ext,
              });
            }
            deleteMockPaths(sources);
          });
          onEvent({
            event: "progress",
            data: {
              jobId,
              processedBytes: totalBytes,
              processedFiles: totalFiles,
              totalBytes,
              totalFiles,
              speedBps,
              etaSecs: 0,
              currentFile: null,
              accelerationMode: "atomic_volume_move",
              iops: 18500,
              activeWorkers: 1,
            } as any,
          });
          onEvent({ event: "state", data: { jobId, state: "completed" } });
        }
      }, 120);

      return jobId;
    }
    const channel = new Channel<JobEvent>();
    channel.onmessage = onEvent;
    return invokeSafe<string>("move_entries", { sources, destDir, onEvent: channel });
  },

  deleteEntries: async (
    paths: string[],
    toTrash: boolean,
    onEvent: (event: JobEvent) => void,
  ): Promise<string> => {
    if (!isTauri()) {
      const jobId = "mock-del-" + Date.now();
      const { deleteMockPaths } = await import("./mockBackend");
      deleteMockPaths(paths);
      setTimeout(() => {
        onEvent({ event: "started", data: { jobId, kind: "delete", totalFiles: paths.length, totalBytes: 0 } });
        onEvent({ event: "progress", data: { jobId, processedBytes: 0, processedFiles: paths.length, totalBytes: 0, totalFiles: paths.length, speedBps: 0, etaSecs: 0, currentFile: paths[0] ?? null } });
        onEvent({ event: "state", data: { jobId, state: "completed" } });
      }, 50);
      return jobId;
    }
    const channel = new Channel<JobEvent>();
    channel.onmessage = onEvent;
    return invokeSafe<string>("delete_entries", { paths, toTrash, onEvent: channel });
  },

  pauseJob: (jobId: string) => invokeSafe<JobSummary>("pause_job", { jobId }),
  resumeJob: (jobId: string) => invokeSafe<JobSummary>("resume_job", { jobId }),
  cancelJob: (jobId: string) => invokeSafe<JobSummary>("cancel_job", { jobId }),
  setRateLimit: (jobId: string, rateLimitBps: number) =>
    invokeSafe<void>("set_rate_limit", { jobId, rateLimitBps }),
  resolveConflict: (jobId: string, conflictId: string, resolution: "skip" | "overwrite" | "keepBoth", applyToAll = false) =>
    invokeSafe<void>("resolve_conflict", { jobId, conflictId, resolution, applyToAll }),
  activeJobs: () => invokeSafe<JobSummary[]>("get_active_jobs"),

  // ── search ──────────────────────────────────────────────────────────────
  searchFiles: async (
    root: string,
    query: string,
    opts: { recursive: boolean; maxResults: number; includeHidden: boolean },
    onEvent: (event: SearchEvent) => void,
  ): Promise<string> => {
    if (!isTauri()) {
      const { generateMockEntries } = await import("./mockBackend");
      const entries = generateMockEntries(root).filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase()),
      );
      setTimeout(() => {
        onEvent({ event: "batch", data: { entries } });
        onEvent({ event: "done", data: { total: entries.length, durationMs: 20 } });
      }, 20);
      return "mock-search-" + Date.now();
    }
    const channel = new Channel<SearchEvent>();
    channel.onmessage = onEvent;
    return invokeSafe<string>("search_files", { root, query, opts, onEvent: channel });
  },

  cancelSearch: (searchId: string) => invokeSafe<void>("cancel_search", { searchId }),

  // ── state ───────────────────────────────────────────────────────────────
  getSettings: () => invokeSafe<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invokeSafe<Settings>("save_settings", { settings }),
  listBookmarks: () => invokeSafe<Bookmark[]>("list_bookmarks"),
  saveBookmarks: (bookmarks: Bookmark[]) => invokeSafe<void>("save_bookmarks", { bookmarks }),
  listRecent: () => invokeSafe<RecentEntry[]>("list_recent"),
  recordRecent: (path: string, name: string) =>
    invokeSafe<RecentEntry[]>("record_recent", { path, name }),
  undoStatus: () => invokeSafe<UndoStatus>("undo_status"),
  undo: () => invokeSafe<UndoStatus>("undo"),
  redo: () => invokeSafe<UndoStatus>("redo"),
  appInfo: () => invokeSafe<AppInfo>("app_info"),

  // ── misc ────────────────────────────────────────────────────────────────
  // ── power-user & forensic tools ───────────────────────────────────────────
  toolsSniffFile: (path: string) => invokeSafe<SniffResult>("tools_sniff_file", { path }),

  toolsAuditDirectory: (root: string) =>
    invokeSafe<SniffResult[]>("tools_audit_directory", { root }),

  toolsCompareBinary: (fileA: string, fileB: string, maxChunks?: number) =>
    invokeSafe<BinaryDiffReport>("tools_compare_binary", { fileA, fileB, maxChunks }),

  toolsListAds: (path: string) => invokeSafe<AlternateDataStream[]>("tools_list_ads", { path }),

  toolsUnblockFile: (path: string) => invokeSafe<boolean>("tools_unblock_file", { path }),

  toolsDeleteAds: (path: string, streamName: string) =>
    invokeSafe<boolean>("tools_delete_ads", { path, streamName }),

  toolsGetLinkInfo: (path: string) => invokeSafe<LinkItem>("tools_get_link_info", { path }),

  toolsCreateLink: (
    linkPath: string,
    targetPath: string,
    kind: "junction" | "hardlink" | "symlink_dir" | "symlink_file",
  ) => invokeSafe<void>("tools_create_link", { linkPath, targetPath, kind }),

  toolsRemoveLink: (linkPath: string) => invokeSafe<void>("tools_remove_link", { linkPath }),

  toolsGetLockingProcesses: (path: string) =>
    invokeSafe<LockingProcess[]>("tools_get_locking_processes", { path }),

  toolsTerminateProcess: (pid: number) =>
    invokeSafe<boolean>("tools_terminate_process", { pid }),

  toolsGetTimestamps: (path: string) =>
    invokeSafe<TimestampInfo>("tools_get_timestamps", { path }),

  toolsSetTimestamps: (
    path: string,
    createdMs?: number,
    modifiedMs?: number,
    accessedMs?: number,
  ) => invokeSafe<void>("tools_set_timestamps", { path, createdMs, modifiedMs, accessedMs }),

  toolsSetAttributes: (
    path: string,
    isReadonly: boolean,
    isHidden: boolean,
    isSystem: boolean,
    isArchive: boolean,
  ) =>
    invokeSafe<void>("tools_set_attributes", {
      path,
      isReadonly,
      isHidden,
      isSystem,
      isArchive,
    }),

  toolsSplitFile: (source: string, chunkSize: number, outputDir?: string) =>
    invokeSafe<SplitResult>("tools_split_file", { source, chunkSize, outputDir }),

  toolsJoinFiles: (manifestPath: string, outputPath?: string) =>
    invokeSafe<JoinResult>("tools_join_files", { manifestPath, outputPath }),

  toolsSearchContent: (
    root: string,
    pattern: string,
    isRegex = false,
    caseSensitive = false,
    maxMatches = 200,
  ) =>
    invokeSafe<ContentSearchReport>("tools_search_content", {
      root,
      pattern,
      isRegex,
      caseSensitive,
      maxMatches,
    }),

  toolsNestedFolder: (base: string, relPath: string) =>
    invokeSafe<string>("tools_nested_folder", { base, relPath }),

  toolsNestedFile: (base: string, relPath: string, content?: string) =>
    invokeSafe<string>("tools_nested_file", { base, relPath, content }),

  toolsBatchScaffold: (base: string, spec: string) =>
    invokeSafe<ScaffoldResult>("tools_batch_scaffold", { base, spec }),

  toolsScaffoldCatalog: () =>
    invokeSafe<ScaffoldCatalog>("tools_scaffold_catalog"),

  toolsRenamePreview: (
    paths: string[],
    find: string | null,
    replace: string,
    template: string | null,
    caseStyle: CaseTransformation = "none",
  ) =>
    invokeSafe<RenamePlanItem[]>("tools_rename_preview", {
      paths,
      find,
      replace,
      template,
      case: caseStyle,
    }),

  toolsRenameExecute: (plan: RenamePlanItem[]) =>
    invokeSafe<RenameTransaction>("tools_rename_execute", { plan }),

  toolsRenameRollback: (tx: RenameTransaction) =>
    invokeSafe<number>("tools_rename_rollback", { tx }),

  toolsUsnQuery: (volume: string) =>
    invokeSafe<UsnJournalInfo>("tools_usn_query", { volume }),

  toolsArchiveList: (archivePath: string) =>
    invokeSafe<ArchiveMetadata>("tools_archive_list", { archivePath }),

  toolsArchiveExtract: (archivePath: string, destDir: string) =>
    invokeSafe<ArchiveOperationResult>("tools_archive_extract", { archivePath, destDir }),

  toolsArchiveCreate: (
    sources: string[],
    destZipPath: string,
    compressionLevel = 6,
  ) =>
    invokeSafe<ArchiveOperationResult>("tools_archive_create", {
      sources,
      destZipPath,
      compressionLevel,
    }),

  toolsArchiveFind7z: () => invokeSafe<string | null>("tools_archive_find_7z"),

  toolsPar2Inspect: (path: string) =>
    invokeSafe<Par2ValidationReport>("tools_par2_inspect", { path }),

  toolsCloneFile: (srcPath: string, destPath: string) =>
    invokeSafe<CloneResult>("tools_clone_file", { srcPath, destPath }),

  toolsIoringStatus: () =>
    invokeSafe<IoRingCapabilities>("tools_ioring_status"),

  toolsShredPaths: (paths: string[], algorithm?: ShredAlgorithm) =>
    invokeSafe<ShredReport>("tools_shred_paths", { paths, algorithm }),

  toolsGenerateSanitizationCert: (path: string, algorithm?: ShredAlgorithm, operator?: string) =>
    invokeSafe<SanitizationCertificate>("tools_generate_sanitization_cert", { path, algorithm, operator }),

  toolsFastcdcAnalyze: (paths: string[]) =>
    invokeSafe<BlockDeduplicationReport>("tools_fastcdc_analyze", { paths }),

  toolsEntropyInspect: (path: string) =>
    invokeSafe<EntropyReport>("tools_entropy_inspect", { path }),

  toolsGitStatus: (dirPath: string) =>
    invokeSafe<GitRepoStatus>("tools_git_status", { dirPath }),

  toolsGitDiff: (filePath: string) =>
    invokeSafe<GitFileDiff>("tools_git_diff", { filePath }),

  toolsGitAction: (repoRoot: string, action: "stage" | "unstage" | "discard", filePaths: string[]) =>
    invokeSafe<string>("tools_git_action", { repoRoot, action, filePaths }),

  toolsVaultEncryptFile: (srcPath: string, vaultPath: string, password: string) =>
    invokeSafe<VaultOperationResult>("tools_vault_encrypt_file", { srcPath, vaultPath, password }),

  toolsVaultDecryptFile: (vaultPath: string, destPath: string, password: string) =>
    invokeSafe<VaultOperationResult>("tools_vault_decrypt_file", { vaultPath, destPath, password }),

  toolsVaultEncryptDir: (srcDir: string, vaultPath: string, password: string) =>
    invokeSafe<VaultOperationResult>("tools_vault_encrypt_dir", { srcDir, vaultPath, password }),

  toolsVaultDecryptDir: (vaultPath: string, destDir: string, password: string) =>
    invokeSafe<VaultOperationResult>("tools_vault_decrypt_dir", { vaultPath, destDir, password }),

  toolsAssignTag: (path: string, tagName: string, color?: string) =>
    invokeSafe<TagItem>("tools_assign_tag", { path, tagName, color }),

  toolsRemoveTag: (path: string, tagName: string) =>
    invokeSafe<boolean>("tools_remove_tag", { path, tagName }),

  toolsGetTagsForPath: (path: string) =>
    invokeSafe<TagItem[]>("tools_get_tags_for_path", { path }),

  toolsListAllTags: () =>
    invokeSafe<TagItem[]>("tools_list_all_tags"),

  toolsGetNote: (path: string) =>
    invokeSafe<FileAnnotation | null>("tools_get_note", { path }),

  toolsSetNote: (path: string, markdown: string) =>
    invokeSafe<FileAnnotation>("tools_set_note", { path, markdown }),

  toolsDeleteNote: (path: string) =>
    invokeSafe<boolean>("tools_delete_note", { path }),

  toolsAnalyzeTreemap: (dirPath: string, canvasWidth = 900, canvasHeight = 550, maxDepth = 4) =>
    invokeSafe<TreemapAnalysis>("tools_analyze_treemap", { dirPath, canvasWidth, canvasHeight, maxDepth }),

  toolsGitFileHistory: (repoRoot: string, relPath: string, limit = 20) =>
    invokeSafe<GitCommitInfo[]>("tools_git_file_history", { repoRoot, relPath, limit }),

  toolsGitFileBlame: (repoRoot: string, relPath: string) =>
    invokeSafe<GitBlameLine[]>("tools_git_file_blame", { repoRoot, relPath }),

  toolsSummarizeDocument: (filePath: string, maxBullets = 5) =>
    invokeSafe<DocumentSummary>("tools_summarize_document", { filePath, maxBullets }),

  toolsSemanticIndex: (rootDir: string, maxFiles = 500) =>
    invokeSafe<SemanticIndex>("tools_semantic_index", { rootDir, maxFiles }),

  toolsSemanticSearch: (rootDir: string, query: string, limit = 25) =>
    invokeSafe<SemanticMatch[]>("tools_semantic_search", { rootDir, query, limit }),

  toolsSemanticHybridSearch: (rootDir: string, query: string, limit = 25) =>
    invokeSafe<SemanticMatch[]>("tools_semantic_hybrid_search", { rootDir, query, limit }),

  toolsCopilotPlan: (prompt: string, currentDir: string) =>
    invokeSafe<CopilotPlan>("tools_copilot_plan", { prompt, currentDir }),

  toolsCopilotExecute: (plan: CopilotPlan, currentDir: string) =>
    invokeSafe<CopilotExecutionResult>("tools_copilot_execute", { plan, currentDir }),

  toolsCopilotFeedback: (actionKind: string, reward: number) =>
    invokeSafe<void>("tools_copilot_feedback", { actionKind, reward }),

  toolsMeshStart: () =>
    invokeSafe<void>("tools_mesh_start"),

  toolsMeshGetPeers: () =>
    invokeSafe<MeshPeer[]>("tools_mesh_get_peers"),

  toolsMeshSendFiles: (targetIp: string, targetPort: number, filePaths: string[]) =>
    invokeSafe<MeshTransferReport>("tools_mesh_send_files", { targetIp, targetPort, filePaths }),

  toolsUsnRecords: (volumePath: string, startUsn?: number, maxRecords = 50, reasonMask?: number) =>
    invokeSafe<UsnRecordsBatch>("tools_usn_records", { volumePath, startUsn, maxRecords, reasonMask }),

  toolsUsnSearch: (volumePath: string, query: string, maxResults = 50) =>
    invokeSafe<UsnRecordEntry[]>("tools_usn_search", { volumePath, query, maxResults }),

  toolsVssList: (volume?: string) =>
    invokeSafe<VssSnapshot[]>("tools_vss_list", { volume }),

  toolsVssRestore: (snapshotPath: string, relativePath: string, destination: string) =>
    invokeSafe<number>("tools_vss_restore", { snapshotPath, relativePath, destination }),

  toolsDevdriveReport: () =>
    invokeSafe<DevDriveReport>("tools_devdrive_report"),

  toolsDevdriveMigrate: (ecosystem: string, targetDrive: string) =>
    invokeSafe<PackageCacheMigrationResult>("tools_devdrive_migrate", { ecosystem, targetDrive }),

  toolsBitlockerStatus: (drive?: string) =>
    invokeSafe<BitLockerVolumeStatus[]>("tools_bitlocker_status", { drive }),

  toolsBitlockerUnlock: (drive: string, password?: string, recoveryKey?: string) =>
    invokeSafe<string>("tools_bitlocker_unlock", { drive, password, recoveryKey }),

  toolsBitlockerLock: (drive: string) =>
    invokeSafe<string>("tools_bitlocker_lock", { drive }),

  toolsProvenanceLog: () =>
    invokeSafe<ProvenanceEvent[]>("tools_provenance_log"),

  toolsProvenanceVerify: () =>
    invokeSafe<ProvenanceVerification>("tools_provenance_verify"),

  toolsProvenanceRecord: (eventType: string, filePath: string, actor?: string) =>
    invokeSafe<ProvenanceEvent>("tools_provenance_record", { eventType, filePath, actor }),

  toolsMetadataRead: (path: string) =>
    invokeSafe<MediaMetadata>("tools_metadata_read", { path }),

  toolsMetadataSetId3: (
    path: string,
    tags: {
      title?: string;
      artist?: string;
      album?: string;
      year?: string;
      track?: number;
      genre?: string;
    },
  ) =>
    invokeSafe<void>("tools_metadata_set_id3", {
      path,
      title: tags.title,
      artist: tags.artist,
      album: tags.album,
      year: tags.year,
      track: tags.track,
      genre: tags.genre,
    }),

  toolsOcrImage: (path: string, lang?: string) =>
    invokeSafe<OcrResult>("tools_ocr_image", { path, lang }),

  toolsSftpListProfiles: () =>
    invokeSafe<SftpProfile[]>("tools_sftp_list_profiles"),

  toolsSftpSaveProfile: (profile: SftpProfile) =>
    invokeSafe<void>("tools_sftp_save_profile", { profile }),

  toolsSftpDeleteProfile: (id: string) =>
    invokeSafe<void>("tools_sftp_delete_profile", { id }),

  toolsSftpListDirectory: (profileId: string, remotePath?: string) =>
    invokeSafe<RemoteFileEntry[]>("tools_sftp_list_directory", { profileId, remotePath }),

  // ── parity batch: duplicates / flat / smart / manifests / images ─────────
  toolsFindDuplicates: (root: string, minSize = 1, maxDepth?: number) =>
    invokeSafe<DuplicateReport>("tools_find_duplicates", { root, minSize, maxDepth }),

  toolsFlatBranch: (root: string, maxDepth?: number, maxEntries?: number) =>
    invokeSafe<FlatListing>("tools_flat_branch", { root, maxDepth, maxEntries }),

  toolsListSmartFolders: () =>
    invokeSafe<SmartFolder[]>("tools_list_smart_folders"),

  toolsSaveSmartFolder: (folder: SmartFolder) =>
    invokeSafe<SmartFolder[]>("tools_save_smart_folder", { folder }),

  toolsDeleteSmartFolder: (id: string) =>
    invokeSafe<SmartFolder[]>("tools_delete_smart_folder", { id }),

  toolsRunSmartFolder: (folder: SmartFolder, maxResults?: number) =>
    invokeSafe<SmartFolderResult>("tools_run_smart_folder", { folder, maxResults }),

  toolsHashCreateManifest: (root: string, algorithm: string, manifestPath?: string) =>
    invokeSafe<HashManifestResult>("tools_hash_create_manifest", { root, algorithm, manifestPath }),

  toolsHashVerifyManifest: (manifestPath: string) =>
    invokeSafe<HashVerifyReport>("tools_hash_verify_manifest", { manifestPath }),

  toolsOptimizeImages: (paths: string[], format: string, quality = 85) =>
    invokeSafe<ImageOptimizeBatch>("tools_optimize_images", { paths, format, quality }),

  // ── embedded terminal ────────────────────────────────────────────────────
  toolsTerminalStart: (cwd: string, shell?: string) =>
    invokeSafe<TerminalStart>("tools_terminal_start", { cwd, shell }),

  toolsTerminalWrite: (sessionId: string, data: string) =>
    invokeSafe<void>("tools_terminal_write", { sessionId, data }),

  toolsTerminalRead: (sessionId: string) =>
    invokeSafe<TerminalChunk>("tools_terminal_read", { sessionId }),

  toolsTerminalClose: (sessionId: string) =>
    invokeSafe<void>("tools_terminal_close", { sessionId }),

  // ── plugins ──────────────────────────────────────────────────────────────
  toolsPluginsList: () =>
    invokeSafe<PluginInfo[]>("tools_plugins_list"),

  toolsPluginsSetEnabled: (pluginId: string, enabled: boolean) =>
    invokeSafe<PluginInfo[]>("tools_plugins_set_enabled", { pluginId, enabled }),

  toolsPluginsExecute: (pluginId: string, commandId: string) =>
    invokeSafe<PluginExecutionResult>("tools_plugins_execute", { pluginId, commandId }),

  toolsPluginsCreateSample: () =>
    invokeSafe<PluginInfo>("tools_plugins_create_sample"),

  toolsPluginsInstall: (sourceDir: string) =>
    invokeSafe<PluginInfo>("tools_plugins_install", { sourceDir }),

  // ── universal archives ───────────────────────────────────────────────────
  toolsArchiveListAny: (archivePath: string) =>
    invokeSafe<ArchiveMetadata>("tools_archive_list_any", { archivePath }),

  toolsArchiveExtractAny: (archivePath: string, destDir: string) =>
    invokeSafe<ArchiveOperationResult>("tools_archive_extract_any", { archivePath, destDir }),

  toolsArchiveCreateAny: (
    sources: string[],
    destPath: string,
    compressionLevel = 5,
    format?: string,
  ) =>
    invokeSafe<ArchiveOperationResult>("tools_archive_create_any", {
      sources,
      destPath,
      compressionLevel,
      format,
    }),

  // ── 2027+ Frontier Innovation IPC commands ─────────────────────────────────
  toolsVdfsSummary: () => invokeSafe<VdfsSummary>("tools_vdfs_summary"),
  toolsVdfsIndex: (path: string, nodeId = "local-node") =>
    invokeSafe<VdfsIndexReport>("tools_vdfs_index", { path, nodeId }),
  toolsVdfsAddNode: (id: string, name: string, nodeType: string, endpoint?: string) =>
    invokeSafe<void>("tools_vdfs_add_node", { id, name, nodeType, endpoint }),

  toolsWebdropStart: (paths: string[], port?: number) =>
    invokeSafe<WebDropStatus>("tools_webdrop_start", { paths, port }),
  toolsWebdropStop: () => invokeSafe<void>("tools_webdrop_stop"),
  toolsWebdropStatus: () => invokeSafe<WebDropStatus>("tools_webdrop_status"),

  toolsJanitorScan: (root: string) =>
    invokeSafe<JanitorScanReport>("tools_janitor_scan", { root }),
  toolsJanitorClean: (paths: string[]) =>
    invokeSafe<JanitorCleanResult>("tools_janitor_clean", { paths }),
  toolsJanitorScanEmpty: (root: string, maxResults?: number) =>
    invokeSafe<EmptyDirsReport>("tools_janitor_scan_empty", { root, maxResults }),
  toolsJanitorCleanEmpty: (paths: string[]) =>
    invokeSafe<EmptyDirsCleanResult>("tools_janitor_clean_empty", { paths }),

  toolsDlpScan: (paths: string[]) =>
    invokeSafe<DlpScanReport>("tools_dlp_scan", { paths }),

  toolsMounterList: () => invokeSafe<VirtualMount[]>("tools_mounter_list"),
  toolsMounterMount: (source: string, preferredLetter?: string) =>
    invokeSafe<VirtualMount>("tools_mounter_mount", { source, preferredLetter }),
  toolsMounterUnmount: (driveLetter: string) =>
    invokeSafe<void>("tools_mounter_unmount", { driveLetter: driveLetter.charAt(0) }),

  // ── USB Hardware Intelligence & Safe Operations ──────────────────────────────
  usbListDevices: () => invokeSafe<UsbDeviceDetails[]>("usb_list_devices"),
  usbGetDevice: (path: string) =>
    invokeSafe<UsbDeviceDetails>("usb_get_device", { path }),
  usbEjectDevice: (path: string, force = false) =>
    invokeSafe<{ success: boolean; message: string }>("usb_eject_device", { path, force }),
  usbGetLocks: (path: string) =>
    invokeSafe<UsbLockingProcess[]>("usb_get_locks", { path }),
  usbUnlockAndEject: (path: string) =>
    invokeSafe<{ success: boolean; terminatedCount: number; message: string }>("usb_unlock_and_eject", { path }),
  usbFormat: (path: string, options: UsbFormatOptions) =>
    invokeSafe<{ success: boolean; message: string }>("usb_format", { path, options }),
  usbBenchmark: (path: string) =>
    invokeSafe<UsbSpeedBenchmarkResult>("usb_benchmark", { path }),
  usbIntegrityTest: (path: string, quick = true) =>
    invokeSafe<UsbIntegrityResult>("usb_integrity_test", { path, quick }),
  usbSetCachePolicy: (path: string, policy: "quick_removal" | "better_performance") =>
    invokeSafe<UsbDeviceDetails>("usb_set_cache_policy", { path, policy }),
  usbCreateDiskImage: (options: UsbDiskImageOptions) =>
    invokeSafe<{ success: boolean; bytesWritten: number; path: string }>("usb_create_disk_image", { options }),
  usbBurnDiskImage: (imagePath: string, targetDrive: string) =>
    invokeSafe<{ success: boolean; bytesWritten: number }>("usb_burn_disk_image", { imagePath, targetDrive }),
  usbSurfaceScan: (path: string) =>
    invokeSafe<UsbSurfaceScanReport>("usb_surface_scan", { path }),
  usbGetMultiBoot: (path: string) =>
    invokeSafe<UsbMultiBootConfig>("usb_get_multiboot", { path }),
  usbInstallVentoy: (path: string) =>
    invokeSafe<UsbMultiBootConfig>("usb_install_ventoy", { path }),
  usbAddMultiBootIso: (path: string, isoPath: string) =>
    invokeSafe<UsbMultiBootIso>("usb_add_multiboot_iso", { path, isoPath }),
  usbGetTopology: (path: string) =>
    invokeSafe<UsbBusTopology>("usb_get_topology", { path }),
  usbForensicSanitize: (path: string, standard: string) =>
    invokeSafe<UsbSanitizeReport>("usb_forensic_sanitize", { path, standard }),

  // ── Cryptographic Merkle Tree & Verifiable Integrity (IEEE S&P / ACM CCS) ────
  toolsMerkleBuild: (dir: string) =>
    invokeSafe<MerkleTreeReport>("tools_merkle_build", { dir }),
  toolsMerkleProof: (dir: string, relPath: string) =>
    invokeSafe<MerkleProof>("tools_merkle_proof", { dir, relPath }),
  toolsMerkleVerify: (proof: MerkleProof) =>
    invokeSafe<boolean>("tools_merkle_verify", { proof }),
  toolsMerkleDiff: (treeA: MerkleTreeReport, treeB: MerkleTreeReport) =>
    invokeSafe<MerkleDiffReport>("tools_merkle_diff", { treeA, treeB }),
  toolsArchiveCreateSortEnhanced: (sources: string[], destZipPath: string, compressionLevel = 6) =>
    invokeSafe<ArchiveOperationResult>("tools_archive_create_sort_enhanced", {
      sources,
      destZipPath,
      compressionLevel,
    }),
};
