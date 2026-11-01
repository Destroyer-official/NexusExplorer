//! File operations: create, rename, delete and shell hand-off.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{CoreError, CoreResult};
use crate::fs::listing::stat_existing;
use crate::models::FileEntry;
use crate::util::{validate_name, unique_path};

/// One item that could not be processed during a batch operation.
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OperationFailure {
    pub path: String,
    pub message: String,
}

/// Outcome of a batch operation; partial success is explicit.
#[derive(Serialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OperationReport {
    pub succeeded: usize,
    pub failed: Vec<OperationFailure>,
}

impl OperationReport {
    pub fn is_ok(&self) -> bool {
        self.failed.is_empty()
    }

    fn fail(&mut self, path: impl Into<String>, message: impl Into<String>) {
        self.failed.push(OperationFailure {
            path: path.into(),
            message: message.into(),
        });
    }
}

/// Renames `path` to `new_name` within the same parent and returns the
/// refreshed entry.
pub fn rename_entry(path: &str, new_name: &str) -> CoreResult<FileEntry> {
    validate_name(new_name)?;
    let source = PathBuf::from(path);
    let parent = source
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| CoreError::InvalidInput(format!("cannot determine parent of '{path}'")))?;
    let destination = parent.join(new_name);
    if destination.exists() && !same_path(&source, &destination) {
        return Err(CoreError::InvalidInput(format!(
            "'{new_name}' already exists in this folder"
        )));
    }
    fs::rename(&source, &destination).map_err(|e| CoreError::from_io(&source, e))?;
    stat_existing(&destination)
}

/// Creates a folder inside `parent`, returning its entry.
///
/// When `unique` is true a non-conflicting name is generated instead of
/// failing, matching Explorer's "New folder" behaviour.
pub fn create_folder(parent: &str, name: &str, unique: bool) -> CoreResult<FileEntry> {
    validate_name(name)?;
    let parent_path = PathBuf::from(parent);
    if !parent_path.is_dir() {
        return Err(CoreError::NotADirectory(parent_path));
    }
    let target = if unique {
        unique_path(&parent_path, name)
    } else {
        parent_path.join(name)
    };
    if target.exists() {
        return Err(CoreError::InvalidInput(format!(
            "'{}' already exists",
            target.display()
        )));
    }
    fs::create_dir(&target).map_err(|e| CoreError::from_io(&target, e))?;
    stat_existing(&target)
}

/// Creates an empty file inside `parent`, returning its entry.
pub fn create_file(parent: &str, name: &str, unique: bool) -> CoreResult<FileEntry> {
    validate_name(name)?;
    let parent_path = PathBuf::from(parent);
    if !parent_path.is_dir() {
        return Err(CoreError::NotADirectory(parent_path));
    }
    let target = if unique {
        unique_path(&parent_path, name)
    } else {
        parent_path.join(name)
    };
    if target.exists() {
        return Err(CoreError::InvalidInput(format!(
            "'{}' already exists",
            target.display()
        )));
    }
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|e| CoreError::from_io(&target, e))?;
    stat_existing(&target)
}

/// Deletes paths to the recycle bin (or permanently) and reports partial
/// failures instead of aborting the batch.
pub fn delete_paths(paths: &[String], to_trash: bool) -> OperationReport {
    let mut report = OperationReport::default();
    for path in paths {
        let target = Path::new(path);
        if !target.exists() {
            report.fail(path, "path no longer exists");
            continue;
        }
        let result = if to_trash {
            trash::delete(target).map_err(|e| e.to_string())
        } else if target.is_dir() {
            fs::remove_dir_all(target).map_err(|e| e.to_string())
        } else {
            remove_file_with_retry(target).map_err(|e| e.to_string())
        };
        match result {
            Ok(()) => report.succeeded += 1,
            Err(message) => report.fail(path, message),
        }
    }
    report
}

fn remove_file_with_retry(path: &Path) -> std::io::Result<()> {
    if let Ok(meta) = fs::metadata(path) {
        let mut perms = meta.permissions();
        #[allow(clippy::permissions_set_readonly_false)]
        perms.set_readonly(false);
        let _ = fs::set_permissions(path, perms);
    }
    fs::remove_file(path)
}

/// Opens a path with its default Windows handler (Explorer for folders, default registered app for files).
pub fn open_path(path: &str) -> CoreResult<()> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        let is_dir = std::path::Path::new(path).is_dir();
        if is_dir {
            std::process::Command::new("explorer.exe")
                .arg(path)
                .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                .spawn()
                .map(|_| ())
                .map_err(|e| CoreError::io(path, e))
        } else {
            std::process::Command::new("cmd.exe")
                .args(["/C", "start", "", path])
                .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                .spawn()
                .map(|_| ())
                .map_err(|e| CoreError::io(path, e))
        }
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map(|_| ())
            .map_err(|e| CoreError::io(path, e))
    }
}

/// Reveals a path in the OS shell, selecting it.
pub fn reveal_in_shell(path: &str) -> CoreResult<()> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{path}"))
            .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
            .spawn()
            .map(|_| ())
            .map_err(|e| CoreError::io(path, e))
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err(CoreError::Unsupported(
            "reveal in shell is only implemented on Windows".into(),
        ))
    }
}

/// Opens a terminal at `path` (Windows Terminal when available, else PowerShell).
pub fn open_terminal(path: &str) -> CoreResult<()> {
    #[cfg(windows)]
    {
        let dir = if std::path::Path::new(path).is_dir() {
            path.to_string()
        } else {
            std::path::Path::new(path)
                .parent()
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.to_string())
        };
        // Prefer Windows Terminal.
        if std::process::Command::new("wt.exe")
            .args(["-d", &dir])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        // Fallback: PowerShell.
        let escaped = dir.replace('\'', "''");
        std::process::Command::new("powershell.exe")
            .args([
                "-NoExit",
                "-Command",
                &format!("Set-Location -LiteralPath '{}'", escaped),
            ])
            .spawn()
            .map(|_| ())
            .map_err(|e| CoreError::io(path, e))
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err(CoreError::Unsupported(
            "terminal launch is only implemented on Windows".into(),
        ))
    }
}

fn same_path(a: &Path, b: &Path) -> bool {
    crate::util::normalise_key(&a.to_string_lossy()) == crate::util::normalise_key(&b.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_and_rename_in_temp_folder() {
        let dir = std::env::temp_dir().join(format!("nexus-core-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let entry = create_file(&dir.to_string_lossy(), "hello.txt", false).unwrap();
        assert_eq!(entry.name, "hello.txt");
        let renamed = rename_entry(&entry.path, "renamed.txt").unwrap();
        assert_eq!(renamed.name, "renamed.txt");
        assert!(renamed.path.ends_with("renamed.txt"));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn unique_names_do_not_collide() {
        let dir = std::env::temp_dir().join(format!("nexus-core-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let first = create_folder(&dir.to_string_lossy(), "New folder", true).unwrap();
        let second = create_folder(&dir.to_string_lossy(), "New folder", true).unwrap();
        assert_ne!(first.name, second.name);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn refuses_to_delete_nothing() {
        let report = delete_paths(&[r"C:\__nexus_missing__".to_string()], true);
        assert_eq!(report.succeeded, 0);
        assert_eq!(report.failed.len(), 1);
    }

    #[test]
    fn parent_helper_is_stable() {
        use crate::fs::listing::parent_of;
        assert_eq!(parent_of(Path::new(r"C:\Users\Ada\a.txt")), r"C:\Users\Ada");
    }
}
