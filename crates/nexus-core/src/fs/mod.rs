//! Filesystem-facing engine: listing, drives, operations, previews and metrics.

pub mod cow;
pub mod drives;
pub mod folder_size;
pub mod ioring;
pub mod known;
pub mod listing;
pub mod ops;
pub mod preview;

pub use drives::enumerate_drives;
pub use folder_size::calculate_folder_size;
pub use ioring::{execute_batch_read, query_ioring_capabilities, IoRingBatchItem, IoRingBatchResult, IoRingCapabilities};
pub use known::known_folders;
pub use listing::{attributes, read_dir, sort_entries, stat_path};
pub use ops::{
    create_file, create_folder, delete_paths, open_path, open_terminal, rename_entry, reveal_in_shell,
    OperationFailure, OperationReport,
};
pub use preview::{preview_file, read_text_file};
