//! Well-known user folders, resolved per platform.

use std::path::PathBuf;

use crate::models::KnownFolder;

/// Returns the standard shell folders that exist on this machine.
///
/// `home` is always first so the sidebar has a stable anchor even on a
/// stripped-down Windows profile.
pub fn known_folders() -> Vec<KnownFolder> {
    let mut folders = Vec::new();
    let mut push = |id: &str, label: &str, path: Option<PathBuf>| {
        if let Some(path) = path {
            if path.is_dir() {
                folders.push(KnownFolder {
                    id: id.to_string(),
                    label: label.to_string(),
                    path: path.to_string_lossy().into_owned(),
                });
            }
        }
    };

    push("home", "Home", dirs::home_dir());
    push("desktop", "Desktop", dirs::desktop_dir());
    push("documents", "Documents", dirs::document_dir());
    push("downloads", "Downloads", dirs::download_dir());
    push("pictures", "Pictures", dirs::picture_dir());
    push("music", "Music", dirs::audio_dir());
    push("videos", "Videos", dirs::video_dir());

    // OneDrive is extremely common on modern Windows profiles but is not
    // reported by `dirs`; surface it explicitly when present.
    if let Ok(one_drive) = std::env::var("OneDriveCommercial").or_else(|_| std::env::var("OneDrive")) {
        let path = PathBuf::from(one_drive);
        if path.is_dir() && !folders.iter().any(|f| f.path == path.to_string_lossy()) {
            folders.push(KnownFolder {
                id: "onedrive".into(),
                label: "OneDrive".into(),
                path: path.to_string_lossy().into_owned(),
            });
        }
    }

    folders
}
