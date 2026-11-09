use serde::{Deserialize, Serialize};

/// A single file or directory row returned by listing and search.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub parent_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: u64,
    pub created_ms: u64,
    pub is_hidden: bool,
    pub is_system: bool,
    pub is_readonly: bool,
    pub ext: String,
}

/// A mounted drive/volume with capacity and readiness info.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub path: String,
    pub label: String,
    pub drive_type: String,
    pub filesystem: String,
    pub free_bytes: u64,
    pub total_bytes: u64,
    pub is_ready: bool,
    #[serde(default)]
    pub is_usb: bool,
    #[serde(default)]
    pub usb_speed: Option<String>,
    #[serde(default)]
    pub is_degraded_port: bool,
}

/// Identifies a started directory scan and the root it covers.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanStart {
    pub scan_id: String,
    pub root_path: String,
}

/// Bounded text preview of a file with truncation and total-size metadata.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextPreview {
    pub content: String,
    pub truncated: bool,
    pub size: u64,
}

/// Point-in-time progress snapshot for a copy/move/delete job.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JobSummary {
    pub job_id: String,
    pub kind: String,
    pub state: String,
    pub total_files: u64,
    pub processed_files: u64,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub speed_bps: f64,
    pub eta_secs: f64,
    pub current_file: Option<String>,
    pub conflicts_pending: u32,
}

/// Filename search options: recursion, result cap, and hidden-file inclusion.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub recursive: bool,
    pub max_results: u32,
    pub include_hidden: bool,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            recursive: true,
            max_results: 10_000,
            include_hidden: false,
        }
    }
}

/// One of the user's well-known shell folders (Desktop, Downloads, …).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KnownFolder {
    /// Stable lookup key, e.g. `desktop`, `downloads`, `home`.
    pub id: String,
    /// Human-readable label.
    pub label: String,
    pub path: String,
}

/// Result of a recursive folder size calculation.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FolderSize {
    pub path: String,
    pub size: u64,
    pub files: u64,
    pub folders: u64,
    pub elapsed_ms: u64,
}

/// Streaming checksum result for a single file.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileHash {
    pub path: String,
    pub size: u64,
    pub algorithm: String,
    pub digest: String,
    pub elapsed_ms: u64,
}

/// Extended, user-facing properties of one file or directory.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EntryProperties {
    pub entry: FileEntry,
    pub readonly: bool,
    pub hidden: bool,
    pub system: bool,
    pub archive: bool,
    /// `None` on platforms without Windows file attributes.
    pub attributes: Option<u32>,
    pub link_target: Option<String>,
    pub files: Option<u64>,
    pub folders: Option<u64>,
    pub total_size: Option<u64>,
}

/// How the UI should render a preview payload.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PreviewKind {
    Text,
    Image,
    Pdf,
    Audio,
    Video,
    Archive,
    Binary,
    Unsupported,
}

/// Preview metadata returned for the details pane.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PreviewData {
    pub path: String,
    pub kind: PreviewKind,
    pub mime: String,
    pub size: u64,
    pub truncated: bool,
    pub text: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// A user-managed bookmark shown in the sidebar.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub color: Option<String>,
}

/// A recently visited location.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    pub path: String,
    pub name: String,
    pub visited_ms: u64,
}

/// Static environment information used by the About/Settings screens.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub engine_version: String,
    pub platform: String,
    pub arch: String,
    pub user: String,
    pub hostname: String,
    pub data_dir: String,
    pub home_dir: String,
}
