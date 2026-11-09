/** Boundary types shared with the Rust engine (serde camelCase). */

export interface FileEntry {
  name: string;
  path: string;
  parentPath: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
  createdMs: number;
  isHidden: boolean;
  isSystem: boolean;
  isReadonly: boolean;
  ext: string;
}

export interface DriveInfo {
  path: string;
  label: string;
  driveType: "removable" | "fixed" | "portable" | "network" | "cdrom" | "ramdisk" | "unknown" | string;
  filesystem: string;
  freeBytes: number;
  totalBytes: number;
  isReady: boolean;
  isUsb?: boolean;
  usbSpeed?: string;
  isDegradedPort?: boolean;
}

export interface UsbDeviceDetails {
  path: string;
  label: string;
  driveLetter: string;
  vendor: string;
  model: string;
  serialNumber: string;
  vid: string;
  pid: string;
  usbProtocol: "UASP (USB Attached SCSI)" | "BOT (Bulk-Only Transport)" | "USB Mass Storage";
  usbSpeed: "USB 3.2 Gen 2 (10 Gbps)" | "USB 3.2 Gen 1 (5 Gbps)" | "USB 2.0 HighSpeed (480 Mbps)" | "USB 4 / Thunderbolt (40 Gbps)" | string;
  isDegradedPort: boolean;
  writeCachePolicy: "quick_removal" | "better_performance";
  filesystem: string;
  clusterSizeBytes: number;
  freeBytes: number;
  totalBytes: number;
  usedBytes: number;
  isRemovable: boolean;
  smartHealthScore: number;
  temperatureC: number;
  smartStatus: "healthy" | "warning" | "critical";
  partitionScheme: "GPT" | "MBR";
  partitionsCount: number;
  sustainedWriteMBps: number;
  readMBps: number;
  isLocked: boolean;
  lockingProcessesCount: number;
}

export interface UsbLockingProcess {
  pid: number;
  name: string;
  windowTitle?: string;
  lockedPath: string;
  appType: string;
  isSystem: boolean;
}

export interface UsbSpeedBenchmarkResult {
  seqReadMBps: number;
  seqWriteMBps: number;
  sustainedWriteMBps: number;
  rand4kReadIOPS: number;
  rand4kWriteIOPS: number;
  elapsedMs: number;
  bufferBurstDropRatio: number;
}

export interface UsbIntegrityResult {
  passed: boolean;
  claimedCapacityBytes: number;
  verifiedCapacityBytes: number;
  corruptedBytes: number;
  isCounterfeit: boolean;
  suspectedRealCapacityBytes: number;
  elapsedMs: number;
  speedMBps: number;
  statusMessage: string;
}

export interface UsbFormatOptions {
  filesystem: "exFAT" | "FAT32" | "NTFS" | "ReFS" | string;
  label: string;
  clusterSize: number;
  quickFormat: boolean;
}

export interface UsbDiskImageOptions {
  sourceDrive: string;
  targetImagePath: string;
  format: "raw_img" | "iso";
  compress: boolean;
}

export interface UsbSurfaceScanBlock {
  id: number;
  status: "fast" | "good" | "normal" | "slow" | "critical" | "bad";
  latencyMs: number;
  lba: number;
}

export interface UsbSurfaceScanReport {
  totalBlocks: number;
  scannedBlocks: number;
  fastCount: number;
  goodCount: number;
  normalCount: number;
  slowCount: number;
  criticalCount: number;
  badCount: number;
  blocks: UsbSurfaceScanBlock[];
  isScanning: boolean;
  elapsedMs: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
}

export interface UsbMultiBootIso {
  id: string;
  name: string;
  osFamily: "windows" | "linux" | "utility" | "bsd";
  fileName: string;
  sizeBytes: number;
  uefiCompatible: boolean;
  secureBootSigned: boolean;
  hasPersistence: boolean;
  persistenceSizeMB?: number;
  isActive: boolean;
}

export interface UsbMultiBootConfig {
  isVentoyInstalled: boolean;
  bootloaderVersion: string;
  partitionScheme: "GPT" | "MBR";
  secureBootEnabled: boolean;
  isos: UsbMultiBootIso[];
}

export interface UsbBusTopology {
  controllerName: string;
  controllerType: "xHCI (USB 3.2)" | "EHCI (USB 2.0)" | "Thunderbolt 4 / USB4" | string;
  rootHubPort: number;
  negotiatedSpeed: string;
  busPowerMa: number;
  usbPdSupported: boolean;
  usbPdVoltageV: number;
  usbPdCurrentA: number;
  endpoints: {
    ep: number;
    direction: "IN" | "OUT";
    type: "Control" | "Bulk" | "Interrupt" | "Isochronous";
    maxPacketSize: number;
  }[];
}

export interface UsbSanitizeReport {
  standard: "nist_800_88_purge" | "nist_800_88_clear" | "dod_5220_22_m" | "gutmann_35";
  passesCompleted: number;
  totalPasses: number;
  bytesSanitized: number;
  verificationPassed: boolean;
  cryptoHashSha256: string;
  certificateId: string;
  completedAt: string;
}

export interface KnownFolder {
  id: string;
  label: string;
  path: string;
}

export interface Bookmark {
  id: string;
  name: string;
  path: string;
  icon?: string | null;
  color?: string | null;
}

export interface RecentEntry {
  path: string;
  name: string;
  visitedMs: number;
}

export interface CustomThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
  bg: string;
  bg2: string;
  surface: string;
  border: string;
  text: string;
  textDim?: string;
  accent: string;
  glassBlur?: number;
  glassOpacity?: number;
  borderRadius?: number;
  fontFamily?: string;
}

export interface Settings {
  version: number;
  theme: "dark" | "light" | "system" | string;
  accent: string;
  density: "comfortable" | "compact" | string;
  lastPath: string;
  view: ViewMode | string;
  sortKey: SortKey | string;
  sortDesc: boolean;
  showHidden: boolean;
  showSystem: boolean;
  showExtensions: boolean;
  confirmDelete: boolean;
  previewOpen: boolean;
  previewWidth?: number;
  sidebarOpen: boolean;
  sidebarWidth: number;
  restoreSession: boolean;
  sessionTabs: string[];
  recentLimit: number;
  animations: boolean;
  zoom: number;
  faytEnabled?: boolean;
  vimModeEnabled?: boolean;
  chromaticHeatmap?: boolean;
  customAccentColor?: string;
  glassBlur?: number;
  glassOpacity?: number;
  borderRadius?: number;
  fontFamily?: string;
  customThemes?: CustomThemeDefinition[];
  activeCustomTheme?: CustomThemeDefinition | null;
  visibleColumns?: ColumnId[];
}

export type ColumnId = "name" | "modified" | "created" | "type" | "size" | "ext";
export type SortKey = "name" | "modified" | "size" | "type" | "created";
export type ViewMode = "list" | "grid" | "columns";

export interface ScanStart {
  scanId: string;
  rootPath: string;
}

export interface TextPreview {
  content: string;
  truncated: boolean;
  size: number;
}

export type PreviewTab = "preview" | "actions" | "shelf" | "git" | "meta" | "summary";

export type PreviewKind =
  | "text"
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "archive"
  | "binary"
  | "unsupported";

export interface PreviewData {
  path: string;
  kind: PreviewKind;
  mime: string;
  size: number;
  truncated: boolean;
  text: string | null;
  width: number | null;
  height: number | null;
}

export interface FileHash {
  path: string;
  size: number;
  algorithm: string;
  digest: string;
  elapsedMs: number;
}

export interface FolderSize {
  path: string;
  size: number;
  files: number;
  folders: number;
  elapsedMs: number;
}

export interface EntryProperties {
  entry: FileEntry;
  readonly: boolean;
  hidden: boolean;
  system: boolean;
  archive: boolean;
  attributes: number | null;
  linkTarget: string | null;
  files: number | null;
  folders: number | null;
  totalSize: number | null;
}

export interface AppInfo {
  version: string;
  engineVersion: string;
  platform: string;
  arch: string;
  user: string;
  hostname: string;
  dataDir: string;
  homeDir: string;
}

export interface JobSummary {
  jobId: string;
  kind: string;
  state: string;
  totalFiles: number;
  processedFiles: number;
  totalBytes: number;
  processedBytes: number;
  speedBps: number;
  etaSecs: number;
  currentFile: string | null;
  conflictsPending: number;
}

export type ScanEvent =
  | { event: "batch"; data: { entries: FileEntry[] } }
  | { event: "done"; data: { total: number; durationMs: number } }
  | { event: "error"; data: { message: string } };

export type SearchEvent =
  | { event: "batch"; data: { entries: FileEntry[] } }
  | { event: "done"; data: { total: number; durationMs: number } }
  | { event: "error"; data: { message: string } };

export type FolderSizeEvent =
  | { event: "progress"; data: { taskId: string; files: number; folders: number; bytes: number } }
  | {
    event: "done";
    data: { taskId: string; size: number; files: number; folders: number; elapsedMs: number };
  }
  | { event: "error"; data: { taskId: string; message: string } };

export interface ConflictInfo {
  jobId: string;
  conflictId: string;
  source: string;
  destination: string;
  sourceSize: number;
  destSize: number;
  sourceModifiedMs: number;
  destModifiedMs: number;
  isDir: boolean;
}

export type JobEvent =
  | {
    event: "started";
    data: { jobId: string; kind: string; totalFiles: number; totalBytes: number };
  }
  | {
    event: "progress";
    data: {
      jobId: string;
      processedBytes: number;
      processedFiles: number;
      totalBytes: number;
      totalFiles: number;
      speedBps: number;
      etaSecs: number;
      currentFile: string | null;
    };
  }
  | {
    event: "fileDone";
    data: { jobId: string; path: string; ok: boolean; error: string | null };
  }
  | { event: "conflict"; data: ConflictInfo }
  | { event: "state"; data: { jobId: string; state: string } }
  | {
    event: "error";
    data: { jobId: string; message: string; path: string | null };
  };

export interface UndoStatus {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

export interface OperationFailure {
  path: string;
  message: string;
}

export interface OperationReport {
  succeeded: number;
  failed: OperationFailure[];
}

export type TransferKind = "copy" | "move" | "delete";

export type AccelerationMode =
  | "refs_block_clone"
  | "kernel_offload"
  | "nvme_direct_stream"
  | "parallel_batch"
  | "sparse_hole_punch"
  | "standard_stream"
  | "atomic_volume_move";

export type QosProfile = "uncapped" | "gaming" | "battery" | "whisper";

export interface TransferTelemetry {
  accelerationMode?: AccelerationMode;
  iops?: number;
  activeWorkers?: number;
  bufferSizeMb?: number;
  hashAlgorithm?: string;
  sourceFs?: string;
  destFs?: string;
  speedHistory?: number[];
  recentEvents?: { time: string; msg: string; type: "info" | "success" | "warn" }[];
  isSparse?: boolean;
  qosProfile?: QosProfile;
}

export interface TransferJob {
  id: string;
  kind: TransferKind;
  state: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
  sources?: string[];
  destination?: string;
  totalFiles: number;
  processedFiles: number;
  totalBytes: number;
  processedBytes: number;
  speedBps: number;
  etaSecs: number;
  currentFile: string | null;
  error: string | null;
  conflicts: number;
  startedAt: number;
  // 2027+ Observability & Telemetry
  accelerationMode?: AccelerationMode;
  iops?: number;
  activeWorkers?: number;
  bufferSizeMb?: number;
  hashAlgorithm?: string;
  sourceFs?: string;
  destFs?: string;
  speedHistory?: number[];
  recentEvents?: { time: string; msg: string; type: "info" | "success" | "warn" }[];
  isSparse?: boolean;
  qosProfile?: QosProfile;
}

export interface ContextMenuItem {
  id?: string;
  label?: string;
  icon?: "open" | "reveal" | "copy" | "cut" | "paste" | "rename" | "delete" | "newfolder" | "newfile" | "properties" | "hash" | "refresh" | "terminal" | "star" | "info" | "permanent" | "preview" | "sort" | "view" | "newtab" | "sparkles";
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
}

export interface SearchState {
  open: boolean;
  query: string;
  root: string;
  searchId: string | null;
  running: boolean;
  results: FileEntry[];
  total: number;
  elapsedMs: number;
  error: string | null;
}

export interface PromptConfig {
  title: string;
  description?: string;
  label: string;
  value: string;
  placeholder?: string;
  confirmLabel?: string;
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void | Promise<void>;
}

export interface Tab {
  quickFilter?: string;
  id: string;
  path: string;
  title: string;
  history: string[];
  historyIndex: number;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  sortKey: SortKey;
  sortDesc: boolean;
  view: ViewMode;
  groupBy: "none" | "date" | "type" | "size";
  selected: string[];
  anchorPath: string | null;
  isLocked?: boolean;
  colorGroup?: TabColorGroup | null;
}

export type TabColorGroup = "emerald" | "purple" | "orange" | "blue" | "rose";
export interface ConfirmConfig {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Power-User & Forensic Tools (Rust Engine 2.0)
// ─────────────────────────────────────────────────────────────────────────────

export interface SniffResult {
  path: string;
  fileName: string;
  declaredExtension: string;
  detectedFormat: string;
  detectedMime: string;
  isSpoofed: boolean;
  isUnknown: boolean;
  headerHex: string;
  fileSizeBytes: number;
}

export interface HexDiffChunk {
  offset: number;
  leftHex: string;
  rightHex: string;
  leftAscii: string;
  rightAscii: string;
  isMatch: boolean;
}

export interface BinaryDiffReport {
  fileA: string;
  fileB: string;
  sizeA: number;
  sizeB: number;
  isIdentical: boolean;
  matchingPercentage: number;
  totalDifferencesBytes: number;
  firstDifferenceOffset: number | null;
  diffChunks: HexDiffChunk[];
}

export interface AlternateDataStream {
  filePath: string;
  streamFullName: string;
  streamName: string;
  streamType: string;
  sizeBytes: number;
  isZoneIdentifier: boolean;
  contentPreview: string;
}

export type LinkType =
  | "directoryJunction"
  | "directorySymlink"
  | "fileSymlink"
  | "hardlink"
  | "regular";

export interface LinkItem {
  path: string;
  name: string;
  linkType: LinkType;
  targetPath: string;
  isBroken: boolean;
  isDirectory: boolean;
  hardlinkCount: number;
}

export interface LockingProcess {
  pid: number;
  name: string;
  appType: string;
  isSystem: boolean;
}

export interface TimestampInfo {
  path: string;
  filename: string;
  createdMs: number;
  modifiedMs: number;
  accessedMs: number;
  attributes: number;
  isReadonly: boolean;
  isHidden: boolean;
  isSystem: boolean;
  isArchive: boolean;
}

export interface SplitManifest {
  originalFilename: string;
  originalSize: number;
  chunkSize: number;
  totalParts: number;
  sha256: string;
  createdAtUnix: number;
  parts: string[];
}

export interface SplitResult {
  partsCreated: string[];
  manifestPath: string;
  elapsedMs: number;
  sha256: string;
}

export interface JoinResult {
  outputPath: string;
  totalBytes: number;
  hashVerified: boolean;
  elapsedMs: number;
  sha256: string;
}

export interface ContentMatch {
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export interface ContentSearchReport {
  totalMatches: number;
  filesSearched: number;
  matches: ContentMatch[];
  elapsedMs: number;
}

export interface ScaffoldResult {
  createdDirs: string[];
  createdFiles: string[];
  errors: string[];
}

export type CaseTransformation =
  | "none"
  | "uppercase"
  | "lowercase"
  | "titleCase"
  | "camelCase"
  | "snakeCase"
  | "kebabCase";

export interface RenamePlanItem {
  originalPath: string;
  originalName: string;
  newName: string;
  newPath: string;
  isValid: boolean;
  errorMessage: string;
  isChanged: boolean;
}

export interface RenameTransaction {
  timestampUnix: number;
  items: [string, string][];
}

export interface UsnJournalInfo {
  volume: string;
  journalId: number;
  lowestValidUsn: number;
  nextUsn: number;
  maximumUsn: number;
  maximumSize: number;
  allocationDelta: number;
}

export type ArchiveFormat =
  | "zip"
  | "sevenZip"
  | "tar"
  | "tarGz"
  | "tarBz2"
  | "tarXz"
  | "rar"
  | "iso"
  | "cab"
  | "unknown";

export interface ArchiveEntryInfo {
  path: string;
  name: string;
  uncompressedSize: number;
  compressedSize: number;
  isDirectory: boolean;
  modifiedMs: number;
  crc32: string;
}

export interface ArchiveMetadata {
  archivePath: string;
  format: ArchiveFormat;
  totalEntries: number;
  totalFiles: number;
  totalDirectories: number;
  uncompressedBytes: number;
  compressedBytes: number;
  entries: ArchiveEntryInfo[];
}

export interface ArchiveOperationResult {
  success: boolean;
  archivePath: string;
  destinationPath: string;
  filesProcessed: number;
  bytesProcessed: number;
  elapsedMs: number;
  errorMessage: string | null;
}

export interface Par2FileInfo {
  fileId: string;
  fileName: string;
  fileSizeBytes: number;
  md5Hash16k: string;
  md5HashFull: string;
}

export interface Par2PacketInfo {
  packetType: string;
  packetLength: number;
  recoverySetId: string;
  isValid: boolean;
}

export interface Par2ValidationReport {
  filePath: string;
  isValid: boolean;
  recoverySetId: string;
  sliceSize: number;
  totalDataFiles: number;
  totalDataSlices: number;
  recoverySlicesAvailable: number;
  protectedFiles: Par2FileInfo[];
  packets: Par2PacketInfo[];
  error: string | null;
}

export interface CloneResult {
  source: string;
  destination: string;
  bytes: number;
  isCowBlockCloned: boolean;
  elapsedMs: number;
}

export type ShredAlgorithm = "zero" | "random" | "dod3" | "dod7" | "gutmann" | "nist-clear" | "nist-purge";

export interface SanitizationCertificate {
  certificateId: string;
  timestampUtc: string;
  operator: string;
  systemHostname: string;
  mediaPath: string;
  mediaType: string;
  standard: string;
  method: string;
  algorithmApplied: ShredAlgorithm;
  bytesSanitized: number;
  preShredDigest: string;
  postVerificationStatus: string;
  cryptographicSeal: string;
}

export interface IoRingCapabilities {
  supported: boolean;
  apiVersion: number;
  maxQueueDepth: number;
  submissionQueueSize: number;
  completionQueueSize: number;
  kernelAccelerated: boolean;
  fallbackMode: string;
}

export interface ChunkInfo {
  offset: number;
  length: number;
  blake3Hash: string;
}

export interface SharedBlockSample {
  chunkHash: string;
  chunkSize: number;
  occurrenceCount: number;
  referencedInFiles: string[];
}

export interface BlockDeduplicationReport {
  totalFilesAnalyzed: number;
  totalBytesRaw: number;
  totalChunksProduced: number;
  uniqueChunksCount: number;
  uniqueBytes: number;
  duplicateChunksCount: number;
  duplicateBytesSaved: number;
  deduplicationRatio: number;
  elapsedMs: number;
  sharedBlockSamples: SharedBlockSample[];
}

export type EntropyClassification =
  | "plaintext"
  | "structuredData"
  | "compressedMedia"
  | "encryptedOrRansomwareSuspect";

export interface ChunkEntropy {
  offset: number;
  length: number;
  entropy: number;
}

export interface EntropyReport {
  filePath: string;
  fileSize: number;
  overallEntropy: number;
  headerEntropy: number;
  tailEntropy: number;
  classification: EntropyClassification;
  confidenceScore: number;
  detectedMagic?: string;
  chunkDistribution: ChunkEntropy[];
  elapsedMs: number;
  advisory: string;
}

export interface MerkleLeaf {
  relativePath: string;
  fileSize: number;
  modifiedMs: number;
  leafHash: string;
}

export interface MerkleProof {
  targetRelativePath: string;
  leafHash: string;
  leafIndex: number;
  totalLeaves: number;
  auditPath: Array<[string, boolean]>;
  expectedRootHash: string;
  isValid: boolean;
}

export interface MerkleTreeReport {
  rootPath: string;
  merkleRootHash: string;
  totalFiles: number;
  totalBytes: number;
  treeDepth: number;
  elapsedMs: number;
  leaves: MerkleLeaf[];
}

export interface MerkleDiffReport {
  rootHashA: string;
  rootHashB: string;
  isIdentical: boolean;
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];
  unmodifiedCount: number;
  elapsedMs: number;
}

export interface ShredReport {
  filesDestroyed: number;
  directoriesRemoved: number;
  totalBytesShredded: number;
  algorithm: ShredAlgorithm;
  elapsedMs: number;
  errors: string[];
  advisory?: string;
}

export type GitFileStatus =
  | "unmodified"
  | "modified"
  | "staged"
  | "untracked"
  | "ignored"
  | "conflicted"
  | "renamed"
  | "deleted";

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  timestampMs: number;
  message: string;
}

export interface GitRepoStatus {
  isRepo: boolean;
  repoRoot: string | null;
  currentBranch: string | null;
  isDetached: boolean;
  headCommit: GitCommitInfo | null;
  fileStatuses: Record<string, GitFileStatus>;
}

export interface GitDiffLine {
  lineType: "add" | "del" | "context" | "header" | string;
  oldLineNum?: number | null;
  newLineNum?: number | null;
  text: string;
}

export interface GitFileDiff {
  filePath: string;
  isBinary: boolean;
  lines: GitDiffLine[];
  additions: number;
  deletions: number;
}

export interface VaultOperationResult {
  success: boolean;
  sourcePath: string;
  targetPath: string;
  bytesProcessed: number;
  elapsedMs: number;
}

export interface HexSlice {
  totalBytes: number;
  offset: number;
  bytes: number[];
}

export interface TagItem {
  name: string;
  color: string;
  paths: string[];
}

export interface FileAnnotation {
  path: string;
  noteMarkdown: string;
  updatedMs: number;
}

export interface TreemapRect {
  path: string;
  name: string;
  sizeBytes: number;
  isDir: boolean;
  ext: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  children: TreemapRect[];
}

export interface TreemapAnalysis {
  rootPath: string;
  totalBytes: number;
  fileCount: number;
  dirCount: number;
  elapsedMs: number;
  root: TreemapRect;
}

export interface AutomationReportItem {
  filePath: string;
  ruleId: string;
  ruleName: string;
  actionTaken: string;
  success: boolean;
  error?: string | null;
}

export interface AutomationExecutionReport {
  itemsProcessed: number;
  actionsExecuted: number;
  results: AutomationReportItem[];
  elapsedMs: number;
}

export interface GitBlameLine {
  lineNumber: number;
  commitHash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  timestampMs: number;
  summary: string;
  lineContent: string;
}

export interface OutlineNode {
  title: string;
  kind: string;
  lineNumber: number;
  level: number;
}

export interface DocumentSummary {
  filePath: string;
  totalWords: number;
  totalLines: number;
  totalChars: number;
  readingTimeSeconds: number;
  summaryBullets: string[];
  keyTopics: string[];
  outline: OutlineNode[];
  detectedType: string;
}

export interface SemanticMatch {
  filePath: string;
  relPath: string;
  fileName: string;
  fileSize: number;
  score: number;
  snippet: string;
  matchedTerms: string[];
}

export interface SemanticIndex {
  rootDir: string;
  version: number;
  totalDocuments: number;
  updatedAtMs: number;
}

export type CopilotActionKind =
  | "search"
  | "organize_by_extension"
  | "clone_cow"
  | "shred"
  | "tag"
  | "archive_zip"
  | "disk_treemap"
  | "git_status";

export interface CopilotCandidateItem {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  formattedSize: string;
  ext?: string;
}

export interface AgentPlanStep {
  stepNumber: number;
  actionKind: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface CopilotPlan {
  planId?: string;
  rawPrompt: string;
  intentSummary: string;
  actionKind: string;
  confidence: number;
  isDestructive: boolean;
  requiresExplicitConfirm?: boolean;
  safetyScore?: number;
  warnings?: string[];
  targetPatterns?: string[];
  sizeMinBytes?: number | null;
  sizeMaxBytes?: number | null;
  tagName?: string | null;
  outputPath?: string | null;
  matchedFiles: string[];
  matchedCandidates?: CopilotCandidateItem[];
  totalMatchedBytes: number;
  explanation: string;
  steps?: AgentPlanStep[];
}

export interface CopilotExecutionResult {
  success: boolean;
  processedCount: number;
  message: string;
  affectedPaths?: string[];
}

export interface MeshPeer {
  deviceId: string;
  deviceName: string;
  os: string;
  ipAddress: string;
  tcpPort: number;
  lastSeenMs: number;
}

export interface MeshTransferReport {
  totalFiles: number;
  totalBytes: number;
  targetPeer: string;
  success: boolean;
  durationMs: number;
  errorMessage?: string | null;
}

export type PaneLayout = "single" | "dual-h" | "dual-v" | "triple" | "quad";

export interface UsnRecordEntry {
  usn: number;
  fileReferenceNumber: number;
  parentFileReferenceNumber: number;
  fileName: string;
  reasons: string[];
  reasonRaw: number;
  timestamp: string;
  fileAttributes: number;
}

export interface UsnRecordsBatch {
  volume: string;
  nextUsn: number;
  records: UsnRecordEntry[];
}

export interface VssSnapshot {
  id: string;
  volumeName: string;
  snapshotPath: string;
  creationTime: string;
  provider: string;
  attributes: string;
}

export interface DevDriveVolume {
  driveLetter: string;
  volumeLabel: string;
  filesystem: string;
  isDevDrive: boolean;
  isRefs: boolean;
  cowSupported: boolean;
  totalBytes: number;
  freeBytes: number;
}

export interface PackageCacheAudit {
  ecosystem: string;
  envVar: string;
  currentPath: string;
  exists: boolean;
  isOnDevDrive: boolean;
  recommendedPath?: string | null;
}

export interface DevDriveReport {
  devDrivesDetected: DevDriveVolume[];
  packageCaches: PackageCacheAudit[];
  hasDevDrive: boolean;
  recommendedActions: string[];
}

export interface PackageCacheMigrationResult {
  ecosystem: string;
  sourcePath: string;
  targetPath: string;
  junctionCreated: boolean;
  message: string;
}

export interface BitLockerVolumeStatus {
  driveLetter: string;
  volumeType: string;
  encryptionStatus: string;
  lockStatus: string;
  protectionStatus: string;
  percentageEncrypted: number;
  keyProtectors: string[];
}

export interface ProvenanceEvent {
  sequence: number;
  timestamp: string;
  eventType: string;
  filePath: string;
  fileSize: number;
  blake3Digest: string;
  actor: string;
  prevChainHash: string;
  chainHash: string;
}

export interface ProvenanceVerification {
  isValid: boolean;
  totalRecords: number;
  genesisHash: string;
  latestChainHash: string;
  errorMessage?: string | null;
  tamperedRecordSequence?: number | null;
}

export interface MediaMetadata {
  path: string;
  kind: "image" | "audio" | "unknown";
  format: string;
  fileSize: number;
  cameraMake?: string | null;
  cameraModel?: string | null;
  software?: string | null;
  dateTaken?: string | null;
  iso?: number | null;
  fNumber?: number | null;
  exposureTime?: string | null;
  focalLength?: number | null;
  dimensions?: [number, number] | null;
  orientation?: number | null;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  year?: string | null;
  trackNumber?: number | null;
  genre?: string | null;
}

export interface OcrWord {
  text: string;
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
}

export interface OcrResult {
  imagePath: string;
  extractedText: string;
  lines: OcrLine[];
  engine: string;
  language: string;
}

export interface SftpProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  privateKeyPath?: string | null;
  remotePath: string;
}

export interface RemoteFileEntry {
  name: string;
  isDir: boolean;
  size: number;
  permissions: string;
  owner: string;
  modified: string;
}




// -----------------------------------------------------------------------------
// Duplicate finder, flat view, smart folders, manifests, images, terminal, plugins
// -----------------------------------------------------------------------------

export interface DuplicateFile {
  name: string;
  path: string;
  size: number;
  modifiedMs: number;
}

export interface DuplicateGroup {
  size: number;
  hash: string;
  files: DuplicateFile[];
  wastedBytes: number;
}

export interface DuplicateReport {
  root: string;
  scannedFiles: number;
  groups: DuplicateGroup[];
  totalGroups: number;
  duplicateFiles: number;
  reclaimableBytes: number;
  elapsedMs: number;
}

export interface FlatEntry {
  entry: FileEntry;
  relativePath: string;
  depth: number;
}

export interface FlatListing {
  root: string;
  entries: FlatEntry[];
  totalFiles: number;
  totalDirectories: number;
  totalBytes: number;
  truncated: boolean;
  elapsedMs: number;
}

export interface SmartFolder {
  id: string;
  name: string;
  root: string;
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  extensions: string[];
  includeDirectories: boolean;
  createdMs: number;
}

export interface SmartFolderResult {
  folder: SmartFolder;
  entries: FileEntry[];
  total: number;
  truncated: boolean;
  elapsedMs: number;
}

export interface HashManifestResult {
  manifestPath: string;
  algorithm: string;
  entries: number;
  totalBytes: number;
  elapsedMs: number;
}

export type HashVerifyStatus = "match" | "mismatch" | "missing";

export interface HashVerifyItem {
  path: string;
  expected: string;
  actual: string;
  status: HashVerifyStatus;
}

export interface HashVerifyReport {
  manifestPath: string;
  algorithm: string;
  total: number;
  matched: number;
  mismatched: number;
  missing: number;
  items: HashVerifyItem[];
  elapsedMs: number;
}

export interface ImageOptimizeResult {
  inputPath: string;
  outputPath: string;
  inputBytes: number;
  outputBytes: number;
  savedBytes: number;
  savingsPercent: number;
  outputFormat: string;
  width: number;
  height: number;
  strippedMetadata: boolean;
  elapsedMs: number;
}

export interface ImageOptimizeBatch {
  results: ImageOptimizeResult[];
  errors: string[];
  totalInputBytes: number;
  totalOutputBytes: number;
  totalSavedBytes: number;
  savingsPercent: number;
}

export interface TerminalStart {
  sessionId: string;
  shell: string;
  cwd: string;
}

export interface TerminalChunk {
  output: string;
  closed: boolean;
  exitCode: number | null;
}

export type PluginAction =
  | { type: "launch"; target: string; args: string[] }
  | { type: "shell"; command: string; args: string[] }
  | { type: "open"; target: string };

export interface PluginCommand {
  id: string;
  title: string;
  description?: string | null;
  action: PluginAction;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description: string;
  author: string;
  commands: PluginCommand[];
}

export interface PluginInfo {
  manifest: PluginManifest;
  pluginDir: string;
  enabled: boolean;
  valid: boolean;
  error?: string | null;
}

export interface PluginExecutionResult {
  pluginId: string;
  commandId: string;
  success: boolean;
  output: string;
  exitCode: number | null;
  elapsedMs: number;
}

export interface ScaffoldTemplateInfo {
  extension: string;
  label: string;
}

export interface ScaffoldPresetInfo {
  name: string;
  spec: string;
}

export interface ScaffoldCatalog {
  templates: ScaffoldTemplateInfo[];
  presets: ScaffoldPresetInfo[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2027+ Frontier Innovation Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VdfsNode {
  id: string;
  name: string;
  nodeType: string;
  endpoint?: string | null;
  online: boolean;
}

export interface VdfsSummary {
  totalObjects: number;
  totalLogicalBytes: number;
  totalPhysicalReplicas: number;
  totalPhysicalBytes: number;
  deduplicationSavingsBytes: number;
  nodeCount: number;
  nodes: VdfsNode[];
}

export interface VdfsIndexReport {
  nodeId: string;
  indexedFiles: number;
  newObjects: number;
  duplicateReplicasFound: number;
  totalBytesScanned: number;
  elapsedMs: number;
}

export interface WebDropFile {
  id: number;
  name: string;
  path: string;
  size: number;
}

export interface WebDropStatus {
  isActive: boolean;
  url: string;
  port: number;
  localIp: string;
  qrSvg: string;
  sharedFiles: WebDropFile[];
  downloadsCompleted: number;
  uploadsReceived: number;
}

export interface JanitorTarget {
  category: string;
  name: string;
  path: string;
  sizeBytes: number;
  fileCount: number;
  lastModifiedMs: number;
}

export interface JanitorScanReport {
  rootPath: string;
  targets: JanitorTarget[];
  totalReclaimableBytes: number;
  scannedDirs: number;
  elapsedMs: number;
}

export interface JanitorCleanResult {
  cleanedTargets: number;
  bytesFreed: number;
  errors: string[];
}

export interface EmptyDirsReport {
  rootPath: string;
  emptyDirs: string[];
  scannedDirs: number;
  elapsedMs: number;
}

export interface EmptyDirsCleanResult {
  removedCount: number;
  failedCount: number;
  errors: string[];
}

export interface DlpFinding {
  filePath: string;
  lineNumber: number;
  ruleName: string;
  severity: "critical" | "high" | "medium";
  maskedSnippet: string;
}

export interface DlpScanReport {
  scannedFiles: number;
  filesWithFindings: number;
  totalFindings: number;
  findings: DlpFinding[];
  elapsedMs: number;
}

export interface VirtualMount {
  driveLetter: string;
  sourcePath: string;
  mountType: string;
  localTarget: string;
  mountedAtMs: number;
}
