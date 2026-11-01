//! Declarative plugin system.
//!
//! A plugin is a folder under `%LOCALAPPDATA%\\NexusExplorer\\plugins\\<id>`
//! containing a `plugin.json` manifest. Plugins contribute commands to the
//! command palette / context menu; each command either launches a program,
//! runs a shell command, or opens a path with its default handler.
//!
//! This mirrors the legacy Python manifest/lifecycle model while staying inside
//! Rust's safety boundary: plugins never execute code inside the host process,
//! they only spawn explicit child processes the user approved by enabling them.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::fs::ops;
use crate::state::StateStore;
use crate::util::data_dir;

const ENABLED_FILE: &str = "plugins.json";
const SUPPORTED_API: &str = "1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PluginAction {
    /// Spawn an executable with explicit arguments.
    Launch {
        target: String,
        #[serde(default)]
        args: Vec<String>,
    },
    /// Run through the platform shell (`cmd /C` on Windows).
    Shell {
        command: String,
        #[serde(default)]
        args: Vec<String>,
    },
    /// Open a file/folder with its registered handler.
    Open { target: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginCommand {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub action: PluginAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub api_version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub commands: Vec<PluginCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub manifest: PluginManifest,
    pub plugin_dir: String,
    pub enabled: bool,
    pub valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginExecutionResult {
    pub plugin_id: String,
    pub command_id: String,
    pub success: bool,
    pub output: String,
    pub exit_code: Option<i32>,
    pub elapsed_ms: u64,
}

fn plugins_dir() -> PathBuf {
    data_dir().join("plugins")
}

fn enabled_map() -> HashMap<String, bool> {
    StateStore::new()
        .load_json::<HashMap<String, bool>>(ENABLED_FILE)
        .unwrap_or_default()
}

fn save_enabled(map: &HashMap<String, bool>) -> Result<(), String> {
    StateStore::new()
        .write_json(ENABLED_FILE, map)
        .map_err(|e| format!("cannot save plugin state: {e}"))
}

fn read_manifest(dir: &Path) -> Result<PluginManifest, String> {
    let file = dir.join("plugin.json");
    let raw = std::fs::read_to_string(&file)
        .map_err(|e| format!("cannot read {}: {e}", file.display()))?;
    let manifest: PluginManifest =
        serde_json::from_str(&raw).map_err(|e| format!("invalid plugin.json: {e}"))?;
    if manifest.id.trim().is_empty() {
        return Err("plugin id cannot be empty".into());
    }
    if !manifest
        .id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(format!("invalid plugin id '{}'", manifest.id));
    }
    if !manifest.api_version.starts_with(SUPPORTED_API) {
        return Err(format!(
            "unsupported plugin apiVersion '{}' (host supports {SUPPORTED_API}.x)",
            manifest.api_version
        ));
    }
    if manifest.commands.iter().any(|c| c.id.trim().is_empty()) {
        return Err("plugin command ids cannot be empty".into());
    }
    Ok(manifest)
}

/// Discovers every plugin folder, including invalid ones (reported with `valid: false`).
pub fn list_plugins() -> Vec<PluginInfo> {
    let dir = plugins_dir();
    let _ = std::fs::create_dir_all(&dir);
    let enabled = enabled_map();
    let mut out = Vec::new();
    let Ok(read) = std::fs::read_dir(&dir) else {
        return out;
    };
    for item in read.flatten() {
        if !item.path().is_dir() {
            continue;
        }
        let plugin_dir = item.path();
        match read_manifest(&plugin_dir) {
            Ok(manifest) => {
                let is_enabled = *enabled.get(&manifest.id).unwrap_or(&false);
                out.push(PluginInfo {
                    enabled: is_enabled,
                    manifest,
                    plugin_dir: plugin_dir.to_string_lossy().into_owned(),
                    valid: true,
                    error: None,
                });
            }
            Err(error) => {
                let id = plugin_dir
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default();
                out.push(PluginInfo {
                    enabled: false,
                    manifest: PluginManifest {
                        id: id.clone(),
                        name: id,
                        version: "0.0.0".into(),
                        api_version: "?".into(),
                        description: String::new(),
                        author: String::new(),
                        commands: Vec::new(),
                    },
                    plugin_dir: plugin_dir.to_string_lossy().into_owned(),
                    valid: false,
                    error: Some(error),
                });
            }
        }
    }
    out.sort_by_key(|a| a.manifest.name.to_lowercase());
    out
}

/// Enables or disables a discovered plugin.
pub fn set_plugin_enabled(plugin_id: &str, enabled: bool) -> Result<Vec<PluginInfo>, String> {
    let plugins = list_plugins();
    if !plugins.iter().any(|p| p.manifest.id == plugin_id) {
        return Err(format!("plugin '{plugin_id}' not found"));
    }
    let mut map = enabled_map();
    map.insert(plugin_id.to_string(), enabled);
    save_enabled(&map)?;
    Ok(list_plugins())
}

/// Installs a plugin from a source folder by copying it into the plugin directory.
pub fn install_plugin_from_dir(source_dir: &Path) -> Result<PluginInfo, String> {
    let manifest = read_manifest(source_dir)?;
    if list_plugins()
        .iter()
        .any(|p| p.manifest.id == manifest.id)
    {
        return Err(format!("plugin '{}' is already installed", manifest.id));
    }
    let target = plugins_dir().join(&manifest.id);
    copy_dir(source_dir, &target)?;
    list_plugins()
        .into_iter()
        .find(|p| p.manifest.id == manifest.id)
        .ok_or_else(|| "plugin install failed".to_string())
}

fn copy_dir(source: &Path, target: &Path) -> Result<(), String> {
    std::fs::create_dir_all(target).map_err(|e| e.to_string())?;
    for item in std::fs::read_dir(source)
        .map_err(|e| format!("cannot read {}: {e}", source.display()))?
        .flatten()
    {
        let from = item.path();
        let to = target.join(item.file_name());
        if from.is_dir() {
            copy_dir(&from, &to)?;
        } else if from.is_file() {
            std::fs::copy(&from, &to)
                .map_err(|e| format!("cannot copy {}: {e}", from.display()))?;
        }
    }
    Ok(())
}

/// Executes one plugin command. Disabled plugins are refused.
pub fn execute_plugin_command(
    plugin_id: &str,
    command_id: &str,
) -> Result<PluginExecutionResult, String> {
    let started = std::time::Instant::now();
    let plugin = list_plugins()
        .into_iter()
        .find(|p| p.manifest.id == plugin_id)
        .ok_or_else(|| format!("plugin '{plugin_id}' not found"))?;
    if !plugin.valid {
        return Err(plugin.error.unwrap_or_else(|| "plugin is invalid".into()));
    }
    if !plugin.enabled {
        return Err(format!(
            "plugin '{}' is disabled — enable it in Settings → Plugins",
            plugin_id
        ));
    }
    let command = plugin
        .manifest
        .commands
        .iter()
        .find(|c| c.id == command_id)
        .ok_or_else(|| format!("command '{command_id}' not found in plugin '{plugin_id}'"))?
        .clone();

    match command.action {
        PluginAction::Open { target } => {
            let expanded = expand(&target, &plugin.plugin_dir);
            ops::open_path(&expanded).map_err(|e| e.to_string())?;
            Ok(PluginExecutionResult {
                plugin_id: plugin_id.to_string(),
                command_id: command_id.to_string(),
                success: true,
                output: format!("Opened {expanded}"),
                exit_code: None,
                elapsed_ms: started.elapsed().as_millis() as u64,
            })
        }
        PluginAction::Launch { target, args } => {
            let program = expand(&target, &plugin.plugin_dir);
            let output = Command::new(&program)
                .args(args.iter().map(|a| expand(a, &plugin.plugin_dir)))
                .current_dir(&plugin.plugin_dir)
                .output()
                .map_err(|e| format!("cannot launch {program}: {e}"))?;
            Ok(build_result(plugin_id, command_id, output, started))
        }
        PluginAction::Shell { command: shell, args } => {
            #[cfg(windows)]
            let mut cmd = {
                let mut c = Command::new("cmd.exe");
                c.arg("/C").arg(&shell);
                c
            };
            #[cfg(not(windows))]
            let mut cmd = {
                let mut c = Command::new("sh");
                c.arg("-c").arg(&shell);
                c
            };
            cmd.args(args.iter().map(|a| expand(a, &plugin.plugin_dir)))
                .current_dir(&plugin.plugin_dir);
            let output = cmd
                .output()
                .map_err(|e| format!("shell command failed: {e}"))?;
            Ok(build_result(plugin_id, command_id, output, started))
        }
    }
}

fn build_result(
    plugin_id: &str,
    command_id: &str,
    output: std::process::Output,
    started: std::time::Instant,
) -> PluginExecutionResult {
    let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
    let err = String::from_utf8_lossy(&output.stderr);
    if !err.trim().is_empty() {
        if !text.ends_with('\n') && !text.is_empty() {
            text.push('\n');
        }
        text.push_str(&err);
    }
    if text.len() > 100_000 {
        text.truncate(100_000);
        text.push_str("\n… output truncated …");
    }
    PluginExecutionResult {
        plugin_id: plugin_id.to_string(),
        command_id: command_id.to_string(),
        success: output.status.success(),
        output: text,
        exit_code: output.status.code(),
        elapsed_ms: started.elapsed().as_millis() as u64,
    }
}

fn expand(value: &str, plugin_dir: &str) -> String {
    value
        .replace("{pluginDir}", plugin_dir)
        .replace("{home}", &dirs::home_dir().unwrap_or_default().to_string_lossy())
}

/// Writes a starter plugin manifest so users can see the expected shape.
pub fn create_sample_plugin() -> Result<PluginInfo, String> {
    let dir = plugins_dir().join("sample-tools");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let manifest = serde_json::json!({
        "id": "sample-tools",
        "name": "Sample Tools",
        "version": "1.0.0",
        "apiVersion": "1.0",
        "description": "Example plugin demonstrating Nexus commands. Safe to edit or remove.",
        "author": "Nexus",
        "commands": [
            {
                "id": "open-home",
                "title": "Open my home folder",
                "description": "Opens %USERPROFILE% with the default handler.",
                "action": { "type": "open", "target": "{home}" }
            },
            {
                "id": "list-files",
                "title": "List files in plugin folder",
                "action": { "type": "shell", "command": "dir", "args": [] }
            }
        ]
    });
    std::fs::write(
        dir.join("plugin.json"),
        serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    list_plugins()
        .into_iter()
        .find(|p| p.manifest.id == "sample-tools")
        .ok_or_else(|| "sample plugin creation failed".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_manifest_api_version() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("plugin.json"),
            r#"{"id":"x","name":"X","version":"1","apiVersion":"2.0","commands":[]}"#,
        )
        .unwrap();
        assert!(read_manifest(dir.path()).is_err());
    }

    #[test]
    fn parses_valid_manifest() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("plugin.json"),
            r#"{"id":"x","name":"X","version":"1","apiVersion":"1.0","commands":[{"id":"c","title":"C","action":{"type":"open","target":"{home}"}}]}"#,
        )
        .unwrap();
        let manifest = read_manifest(dir.path()).unwrap();
        assert_eq!(manifest.commands.len(), 1);
    }
}
