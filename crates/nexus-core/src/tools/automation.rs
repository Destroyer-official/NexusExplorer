//! Rule-Based Folder Automation Engine (Hazel / DropIt Engine).
//!
//! Event-triggered background automation rules for self-organizing file hygiene:
//! automatic compression, moving, CoW cloning, tagging, and shredding based on
//! regex patterns, file sizes, ages, and formats.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RuleCondition {
    ExtensionIn(Vec<String>),
    NameMatchesRegex(String),
    SizeGreaterThanBytes(u64),
    SizeLessThanBytes(u64),
    OlderThanDays(u32),
    IsDirectory(bool),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RuleAction {
    MoveToDirectory(String),
    CopyToDirectory(String),
    CoWCloneToDirectory(String),
    CompressToZip(String),
    SecureShred,
    AddTag(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub conditions: Vec<RuleCondition>,
    pub actions: Vec<RuleAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationReportItem {
    pub file_path: String,
    pub rule_id: String,
    pub rule_name: String,
    pub action_taken: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationExecutionReport {
    pub items_processed: usize,
    pub actions_executed: usize,
    pub results: Vec<AutomationReportItem>,
    pub elapsed_ms: u64,
}

/// Evaluates if a file matches all conditions of a rule.
fn matches_conditions(path: &Path, meta: &fs::Metadata, conditions: &[RuleCondition]) -> bool {
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let is_dir = meta.is_dir();
    let size = meta.len();

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let modified_secs = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(now_secs);

    let age_days = now_secs.saturating_sub(modified_secs) / 86400;

    for cond in conditions {
        match cond {
            RuleCondition::ExtensionIn(exts) => {
                if !exts.iter().any(|e| e.trim_start_matches('.').eq_ignore_ascii_case(&ext)) {
                    return false;
                }
            }
            RuleCondition::NameMatchesRegex(pattern) => {
                if let Ok(re) = Regex::new(pattern) {
                    if !re.is_match(filename) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            RuleCondition::SizeGreaterThanBytes(threshold) => {
                if size <= *threshold {
                    return false;
                }
            }
            RuleCondition::SizeLessThanBytes(threshold) => {
                if size >= *threshold {
                    return false;
                }
            }
            RuleCondition::OlderThanDays(days) => {
                if age_days < *days as u64 {
                    return false;
                }
            }
            RuleCondition::IsDirectory(want_dir) => {
                if is_dir != *want_dir {
                    return false;
                }
            }
        }
    }
    true
}

/// Executes configured rules against files directly inside `target_dir`.
pub fn evaluate_and_run_rules(
    rules: &[AutomationRule],
    target_dir: &Path,
) -> Result<AutomationExecutionReport, String> {
    let started = Instant::now();
    if !target_dir.is_dir() {
        return Err(format!("target is not a directory: {}", target_dir.display()));
    }

    let active_rules: Vec<&AutomationRule> = rules.iter().filter(|r| r.enabled).collect();
    if active_rules.is_empty() {
        return Ok(AutomationExecutionReport {
            items_processed: 0,
            actions_executed: 0,
            results: Vec::new(),
            elapsed_ms: started.elapsed().as_millis() as u64,
        });
    }

    let entries = fs::read_dir(target_dir).map_err(|e| e.to_string())?;
    let mut items_processed = 0usize;
    let mut actions_executed = 0usize;
    let mut results = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        items_processed += 1;

        for rule in &active_rules {
            if !path.exists() {
                // File was moved or shredded by a preceding rule action
                break;
            }

            if matches_conditions(&path, &meta, &rule.conditions) {
                for action in &rule.actions {
                    let mut success = true;
                    let mut error = None;
                    let action_desc = format!("{action:?}");

                    match action {
                        RuleAction::MoveToDirectory(dest_dir_str) => {
                            let dest_dir = PathBuf::from(dest_dir_str);
                            if !dest_dir.exists() {
                                let _ = fs::create_dir_all(&dest_dir);
                            }
                            if let Some(fname) = path.file_name() {
                                let dest_file = dest_dir.join(fname);
                                if let Err(e) = fs::rename(&path, &dest_file) {
                                    // Cross-volume fallback
                                    if let Err(e2) = fs::copy(&path, &dest_file).and_then(|_| fs::remove_file(&path)) {
                                        success = false;
                                        error = Some(format!("move failed: {e}; fallback: {e2}"));
                                    }
                                }
                            }
                        }
                        RuleAction::CopyToDirectory(dest_dir_str) => {
                            let dest_dir = PathBuf::from(dest_dir_str);
                            if !dest_dir.exists() {
                                let _ = fs::create_dir_all(&dest_dir);
                            }
                            if let Some(fname) = path.file_name() {
                                let dest_file = dest_dir.join(fname);
                                if let Err(e) = fs::copy(&path, &dest_file) {
                                    success = false;
                                    error = Some(format!("copy failed: {e}"));
                                }
                            }
                        }
                        RuleAction::CoWCloneToDirectory(dest_dir_str) => {
                            let dest_dir = PathBuf::from(dest_dir_str);
                            if !dest_dir.exists() {
                                let _ = fs::create_dir_all(&dest_dir);
                            }
                            if let Some(fname) = path.file_name() {
                                let dest_file = dest_dir.join(fname);
                                if let Err(e) = crate::fs::cow::clone_file(&path.to_string_lossy(), &dest_file.to_string_lossy()) {
                                    success = false;
                                    error = Some(format!("clone failed: {e}"));
                                }
                            }
                        }
                        RuleAction::CompressToZip(dest_zip_str) => {
                            if let Err(e) = crate::tools::archive::create_zip_archive(
                                &[path.to_string_lossy().to_string()],
                                dest_zip_str,
                                6,
                                |_, _, _| {},
                            ) {
                                success = false;
                                error = Some(format!("compress failed: {e}"));
                            }
                        }
                        RuleAction::SecureShred => {
                            let rep = crate::tools::shredder::shred_paths(
                                std::slice::from_ref(&path),
                                crate::tools::shredder::ShredAlgorithm::Dod3Pass,
                                |_| {},
                            );
                            if !rep.errors.is_empty() {
                                success = false;
                                error = Some(rep.errors.join("; "));
                            }
                        }
                        RuleAction::AddTag(tag_name) => {
                            if let Err(e) = crate::tools::tags::assign_tag(&path.to_string_lossy(), tag_name, None, None) {
                                success = false;
                                error = Some(format!("tag failed: {e}"));
                            }
                        }
                    }

                    if success {
                        actions_executed += 1;
                    }

                    results.push(AutomationReportItem {
                        file_path: path.to_string_lossy().to_string(),
                        rule_id: rule.id.clone(),
                        rule_name: rule.name.clone(),
                        action_taken: action_desc,
                        success,
                        error,
                    });
                }
            }
        }
    }

    Ok(AutomationExecutionReport {
        items_processed,
        actions_executed,
        results,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_automation_rules_execution() {
        let dir = tempfile::tempdir().unwrap();
        let target_dir = dir.path().join("inbox");
        let archive_dir = dir.path().join("archive");
        fs::create_dir_all(&target_dir).unwrap();
        fs::create_dir_all(&archive_dir).unwrap();

        let log_file = target_dir.join("debug_2027.log");
        let photo_file = target_dir.join("vacation.png");
        fs::write(&log_file, b"sample log data").unwrap();
        fs::write(&photo_file, b"sample png data").unwrap();

        let rule = AutomationRule {
            id: "move-logs".into(),
            name: "Auto-Archive Log Files".into(),
            enabled: true,
            conditions: vec![RuleCondition::ExtensionIn(vec!["log".into()])],
            actions: vec![RuleAction::MoveToDirectory(archive_dir.to_string_lossy().to_string())],
        };

        let report = evaluate_and_run_rules(&[rule], &target_dir).unwrap();
        assert_eq!(report.actions_executed, 1);
        assert!(!log_file.exists());
        assert!(archive_dir.join("debug_2027.log").exists());
        assert!(photo_file.exists()); // Photo was untouched
    }
}

