//! Error type shared by the core engine and every consumer.

use std::path::PathBuf;

/// Errors surfaced by core operations.
///
/// Commands convert these into user-facing strings at the IPC boundary, but the
/// structured variants let the CLI and future diagnostics render better detail.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("path is empty")]
    EmptyPath,

    #[error("invalid name '{0}'")]
    InvalidName(String),

    #[error("path does not exist: {0}")]
    NotFound(PathBuf),

    #[error("permission denied: {0}")]
    PermissionDenied(PathBuf),

    #[error("not a directory: {0}")]
    NotADirectory(PathBuf),

    #[error("operation cancelled")]
    Cancelled,

    #[error("job not found: {0}")]
    JobNotFound(String),

    #[error("search not found: {0}")]
    SearchNotFound(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("unsupported operation: {0}")]
    Unsupported(String),

    #[error("i/o error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("serialization failed: {0}")]
    Serialization(String),
}

impl CoreError {
    /// Wraps an [`std::io::Error`] with the path that produced it.
    pub fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Self::Io {
            path: path.into(),
            source,
        }
    }

    /// Maps common I/O kinds onto richer variants.
    pub fn from_io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        let path = path.into();
        match source.kind() {
            std::io::ErrorKind::NotFound => Self::NotFound(path),
            std::io::ErrorKind::PermissionDenied => Self::PermissionDenied(path),
            std::io::ErrorKind::NotADirectory => Self::NotADirectory(path),
            _ => Self::Io { path, source },
        }
    }
}

/// Convenience result alias for the engine.
pub type CoreResult<T> = Result<T, CoreError>;
