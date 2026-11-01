//! Small shared helpers: validation, path normalisation and formatting.

use std::path::{Path, PathBuf};

use crate::error::{CoreError, CoreResult};

const INVALID_NAME_CHARS: &[char] = &['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
const RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Validates a single Windows path component (file or folder name).
pub fn validate_name(name: &str) -> CoreResult<()> {
    if name.is_empty() {
        return Err(CoreError::InvalidName(name.to_string()));
    }
    if name == "." || name == ".." {
        return Err(CoreError::InvalidName(name.to_string()));
    }
    if name
        .chars()
        .any(|c| INVALID_NAME_CHARS.contains(&c) || c.is_control())
    {
        return Err(CoreError::InvalidName(name.to_string()));
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err(CoreError::InvalidName(name.to_string()));
    }
    let stem = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    if RESERVED_NAMES.contains(&stem.as_str()) {
        return Err(CoreError::InvalidName(name.to_string()));
    }
    if name.len() > 255 {
        return Err(CoreError::InvalidName(name.to_string()));
    }
    Ok(())
}

/// Returns a unique sibling path using the Explorer convention `name (2)`.
pub fn unique_path(parent: &Path, name: &str) -> PathBuf {
    let candidate = parent.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(name);
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| name.to_string());
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().into_owned())
        .unwrap_or_default();
    for n in 2..10_000 {
        let candidate = if ext.is_empty() {
            parent.join(format!("{stem} ({n})"))
        } else {
            parent.join(format!("{stem} ({n}).{ext}"))
        };
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("{stem} (copy)"))
}

/// Normalises a path for comparisons (case-insensitive on Windows).
pub fn normalise_key(path: &str) -> String {
    let trimmed = path.trim_end_matches(['\\', '/']);
    if cfg!(windows) {
        trimmed.to_lowercase()
    } else {
        trimmed.to_string()
    }
}

/// True when `child` is exactly `parent` or lives underneath it.
pub fn is_within(child: &str, parent: &str) -> bool {
    let child = normalise_key(child);
    let parent = normalise_key(parent);
    child == parent || child.starts_with(&(parent.clone() + "\\")) || child.starts_with(&(parent + "/"))
}

/// Formats bytes into a compact human-readable string.
pub fn human_bytes(bytes: u64) -> String {
    const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
    if bytes == 0 {
        return "0 B".to_string();
    }
    let mut value = bytes as f64;
    let mut unit = 0usize;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 || value >= 100.0 {
        format!("{value:.0} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

/// Current Unix time in milliseconds.
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Returns the application data directory (`%LOCALAPPDATA%\\NexusExplorer`).
pub fn data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("NEXUS_DATA_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local).join("NexusExplorer");
        }
    }
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("NexusExplorer")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_names() {
        for name in ["", ".", "..", "a/b", "a:b", "end.", "end ", "CON", "nul.txt"] {
            assert!(validate_name(name).is_err(), "{name:?} should be rejected");
        }
        for name in ["report.pdf", "New folder", "café.txt", "a.b.c"] {
            assert!(validate_name(name).is_ok(), "{name:?} should be accepted");
        }
    }

    #[test]
    fn containment_is_case_insensitive_on_windows() {
        assert!(is_within(r"C:\Users\Ada\Docs\a.txt", r"c:\users\ada"));
        assert!(!is_within(r"C:\Users\AdaLovelace\a.txt", r"C:\Users\Ada"));
    }

    #[test]
    fn formats_bytes() {
        assert_eq!(human_bytes(0), "0 B");
        assert_eq!(human_bytes(512), "512 B");
        assert!(human_bytes(2048).ends_with("KB"));
    }
}
