//! Serializable boundary models shared by the desktop app, CLI and FFI.

pub mod entry;
pub mod events;

pub use entry::{
    AppInfo, Bookmark, DriveInfo, EntryProperties, FileEntry, FileHash, FolderSize, JobSummary,
    KnownFolder, PreviewData, PreviewKind, RecentEntry, ScanStart, SearchOptions, TextPreview,
};
pub use events::{FolderSizeEvent, JobEvent, ScanEvent, SearchEvent};
