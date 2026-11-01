//! User-facing settings, persisted as `settings.json`.

use serde::{Deserialize, Serialize};

/// Current settings schema version. Bump when a migration is required.
pub const SETTINGS_VERSION: u32 = 1;

/// All user preferences. Every field has a safe default so older files keep
/// loading after new settings are introduced.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub version: u32,
    pub theme: String,
    pub accent: String,
    pub density: String,
    pub last_path: String,
    pub view: String,
    pub sort_key: String,
    pub sort_desc: bool,
    pub show_hidden: bool,
    pub show_system: bool,
    pub show_extensions: bool,
    pub confirm_delete: bool,
    pub preview_open: bool,
    pub sidebar_open: bool,
    pub sidebar_width: u32,
    pub restore_session: bool,
    pub session_tabs: Vec<String>,
    pub recent_limit: u32,
    pub animations: bool,
    #[serde(default = "default_zoom")]
    pub zoom: u32,
}

fn default_zoom() -> u32 {
    100
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            theme: "dark".into(),
            accent: "aurora".into(),
            density: "comfortable".into(),
            last_path: String::new(),
            view: "list".into(),
            sort_key: "name".into(),
            sort_desc: false,
            show_hidden: false,
            show_system: false,
            show_extensions: true,
            confirm_delete: true,
            preview_open: true,
            sidebar_open: true,
            sidebar_width: 268,
            restore_session: true,
            session_tabs: Vec::new(),
            recent_limit: 30,
            animations: true,
            zoom: 100,
        }
    }
}

impl Settings {
    /// Applies structural clamps so a hand-edited settings file cannot break
    /// layout assumptions in the UI.
    pub fn sanitised(mut self) -> Self {
        if self.version == 0 {
            self.version = SETTINGS_VERSION;
        }
        if !matches!(self.theme.as_str(), "dark" | "light" | "system") {
            self.theme = "dark".into();
        }
        if !matches!(self.density.as_str(), "comfortable" | "compact") {
            self.density = "comfortable".into();
        }
        if !matches!(self.view.as_str(), "list" | "grid") {
            self.view = "list".into();
        }
        if !matches!(
            self.sort_key.as_str(),
            "name" | "modified" | "size" | "type" | "created"
        ) {
            self.sort_key = "name".into();
        }
        if !(180..=420).contains(&self.sidebar_width) {
            self.sidebar_width = 268;
        }
        if !(5..=200).contains(&self.recent_limit) {
            self.recent_limit = 30;
        }
        self.session_tabs.truncate(24);
        self.zoom = self.zoom.clamp(70, 150);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        let settings = Settings::default().sanitised();
        assert_eq!(settings.theme, "dark");
        assert_eq!(settings.view, "list");
        assert!(settings.sidebar_open);
    }

    #[test]
    fn missing_fields_use_defaults() {
        let json = r#"{"theme":"light","sidebarWidth":12}"#;
        let settings: Settings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.theme, "light");
        assert_eq!(settings.view, "list");
        let settings = settings.sanitised();
        assert_eq!(settings.sidebar_width, 268);
    }
}
