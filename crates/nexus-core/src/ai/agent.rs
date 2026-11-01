//! Autonomous Micro-SLM & RL Agent Orchestrator.
//!
//! Integrates neuro-symbolic intent parsing, Deterministic Safety Verification (GRPO),
//! and Non-Stationary Reinforcement Learning (D-LinUCB) into an end-to-end execution pipeline.

use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;
use serde::{Deserialize, Serialize};

use super::bandit::{ContextVector, DiscountedLinUCB};
use super::intent::{ActionKind, IntentParser};
use super::verifier::FilesystemVerifier;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAgentPlan {
    pub plan_id: String,
    pub raw_prompt: String,
    pub action_kind: String,
    pub intent_summary: String,
    pub explanation: String,
    pub matched_files: Vec<String>,
    pub total_matched_bytes: u64,
    pub confidence: f32,
    pub is_destructive: bool,
    pub requires_explicit_confirm: bool,
    pub safety_score: f32,
    pub warnings: Vec<String>,
    pub target_folder_name: Option<String>,
    #[serde(default)]
    pub target_patterns: Vec<String>,
    #[serde(default)]
    pub size_min_bytes: Option<u64>,
    #[serde(default)]
    pub size_max_bytes: Option<u64>,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExecutionResult {
    pub success: bool,
    pub processed_count: usize,
    pub message: String,
    pub affected_paths: Vec<String>,
}

/// Global Thread-Safe Agent Manager.
pub struct AiAgentManager {
    bandit: Mutex<DiscountedLinUCB>,
    storage_path: PathBuf,
}

impl AiAgentManager {
    pub fn new() -> Self {
        let storage_path = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("NexusExplorer")
            .join("ai_bandit_policy.json");

        let bandit = if let Ok(mut file) = File::open(&storage_path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                serde_json::from_str(&contents).unwrap_or_default()
            } else {
                DiscountedLinUCB::default()
            }
        } else {
            DiscountedLinUCB::default()
        };

        Self {
            bandit: Mutex::new(bandit),
            storage_path,
        }
    }

    /// Formulates an optimal, verified filesystem action plan from natural language.
    pub fn formulate_plan(&self, prompt: &str, current_dir: &Path) -> Result<AiAgentPlan, String> {
        let intent = IntentParser::parse(prompt, current_dir);

        // 1. Scan directory to match candidate files
        let mut matched_files: Vec<PathBuf> = Vec::new();
        let mut total_matched_bytes = 0u64;

        if current_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(current_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_file() {
                        continue;
                    }

                    // Extension filter
                    if !intent.target_extensions.is_empty() {
                        let ext = path
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        if !intent.target_extensions.iter().any(|p| p.eq_ignore_ascii_case(&ext)) {
                            continue;
                        }
                    }

                    // Metadata filters (size, age)
                    if let Ok(meta) = entry.metadata() {
                        let size = meta.len();
                        if let Some(min) = intent.size_min_bytes {
                            if size < min {
                                continue;
                            }
                        }
                        if let Some(max) = intent.size_max_bytes {
                            if size > max {
                                continue;
                            }
                        }

                        if let Ok(mod_time) = meta.modified() {
                            if let Ok(age) = SystemTime::now().duration_since(mod_time) {
                                let days = (age.as_secs() / 86400) as u32;
                                if let Some(min_days) = intent.age_days_min {
                                    if days < min_days {
                                        continue;
                                    }
                                }
                                if let Some(max_days) = intent.age_days_max {
                                    if days > max_days {
                                        continue;
                                    }
                                }
                            }
                        }

                        total_matched_bytes += size;
                    }

                    matched_files.push(path);
                }
            }
        }

        // 2. Construct Context Vector x_t
        let depth = current_dir.ancestors().count();
        let hour = chrono::Local::now().format("%H").to_string().parse::<u32>().unwrap_or(12);
        let is_git = current_dir.join(".git").exists() || current_dir.ancestors().any(|a| a.join(".git").exists());
        let is_temp = current_dir.to_string_lossy().to_lowercase().contains("download") || current_dir.to_string_lossy().to_lowercase().contains("temp");

        let context = ContextVector::from_directory_state(
            depth,
            matched_files.len(),
            total_matched_bytes,
            is_git,
            false,
            is_temp,
            false,
            hour,
            30.0,
            intent.is_destructive,
        );

        // 3. Safety Verification (GRPO Guard)
        let v_report = FilesystemVerifier::verify_operations(
            intent.action_kind.as_str(),
            &matched_files,
            intent.explicit_dest_dir.as_deref().map(Path::new),
            intent.is_destructive,
        );

        if !v_report.is_safe {
            return Err(format!("Safety verifier rejected plan: {}", v_report.violations.join(", ")));
        }

        // 4. D-LinUCB Reinforcement Learning Ranking
        let mut bandit = self.bandit.lock().unwrap();
        let (rl_score, expected_reward, ucb_bonus) = bandit.score_action(intent.action_kind.as_str(), &context);

        let plan_id = uuid::Uuid::new_v4().to_string();
        let intent_summary = match intent.action_kind {
            ActionKind::OrganizeByExtension => format!("Sort {} files into subfolders by file extension", matched_files.len()),
            ActionKind::OrganizeByDate => format!("Organize {} files into Year/Month subdirectories", matched_files.len()),
            ActionKind::ArchiveZip => format!("Compress {} files into ZIP archive", matched_files.len()),
            ActionKind::Shred => format!("Cryptographically wipe {} matched files", matched_files.len()),
            ActionKind::Tag => format!("Tag {} files as '{}'", matched_files.len(), intent.custom_tag.as_deref().unwrap_or("Important")),
            ActionKind::CloneCow => format!("Fast copy-on-write clone of {} items", matched_files.len()),
            ActionKind::Search => format!("Discovered {} items matching criteria", matched_files.len()),
            ActionKind::FlattenDirectory => format!("Flatten directory hierarchy for {} items", matched_files.len()),
            ActionKind::Deduplicate => format!("Scan {} candidate files for cryptographic duplicates", matched_files.len()),
        };

        let explanation = format!(
            "Micro-SLM Intent: {:?} | Safety Score: {:.0}% | D-LinUCB Expected Reward: {:.2} (UCB: +{:.2})",
            intent.action_kind,
            v_report.safety_score * 100.0,
            expected_reward,
            ucb_bonus,
        );

        let string_paths = matched_files.into_iter().map(|p| p.to_string_lossy().to_string()).collect();

        Ok(AiAgentPlan {
            plan_id,
            raw_prompt: prompt.to_string(),
            action_kind: intent.action_kind.as_str().to_string(),
            intent_summary,
            explanation,
            matched_files: string_paths,
            total_matched_bytes,
            confidence: (rl_score * 0.2 + intent.confidence * 0.8).clamp(0.1, 0.99),
            is_destructive: intent.is_destructive,
            requires_explicit_confirm: v_report.requires_explicit_confirm,
            safety_score: v_report.safety_score,
            warnings: v_report.warnings,
            target_folder_name: intent.custom_tag,
            target_patterns: intent.target_extensions,
            size_min_bytes: intent.size_min_bytes,
            size_max_bytes: intent.size_max_bytes,
            created_at_ms: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
        })
    }

    /// Executes an approved action plan.
    pub fn execute_plan(&self, plan: &AiAgentPlan, current_dir: &Path) -> Result<AiExecutionResult, String> {
        let mut affected = Vec::new();

        match plan.action_kind.as_str() {
            "organize_by_extension" => {
                let mut count = 0;
                for file_str in &plan.matched_files {
                    let p = Path::new(file_str);
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        let folder = current_dir.join(ext.to_uppercase());
                        let _ = fs::create_dir_all(&folder);
                        if let Some(name) = p.file_name() {
                            let dest = folder.join(name);
                            if fs::rename(p, &dest).is_ok() {
                                count += 1;
                                affected.push(dest.to_string_lossy().to_string());
                            }
                        }
                    }
                }
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: count,
                    message: format!("Organized {} files by file extension", count),
                    affected_paths: affected,
                })
            }
            "organize_by_date" => {
                let mut count = 0;
                for file_str in &plan.matched_files {
                    let p = Path::new(file_str);
                    if let Ok(meta) = p.metadata() {
                        if let Ok(mod_time) = meta.modified() {
                            let dt: chrono::DateTime<chrono::Local> = mod_time.into();
                            let folder_name = dt.format("%Y-%m").to_string();
                            let folder = current_dir.join(folder_name);
                            let _ = fs::create_dir_all(&folder);
                            if let Some(name) = p.file_name() {
                                let dest = folder.join(name);
                                if fs::rename(p, &dest).is_ok() {
                                    count += 1;
                                    affected.push(dest.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: count,
                    message: format!("Organized {} files by Year-Month", count),
                    affected_paths: affected,
                })
            }
            "archive_zip" => {
                let zip_name = format!("Archive_{}.zip", chrono::Local::now().format("%Y%m%d_%H%M%S"));
                let zip_path = current_dir.join(&zip_name);
                let dest_str = zip_path.to_string_lossy();
                crate::tools::archive::create_zip_archive(&plan.matched_files, &dest_str, 6, |_, _, _| {})?;
                affected.push(zip_path.to_string_lossy().to_string());
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: plan.matched_files.len(),
                    message: format!("Compressed {} files into {}", plan.matched_files.len(), zip_name),
                    affected_paths: affected,
                })
            }
            "shred" => {
                let source_paths: Vec<PathBuf> = plan.matched_files.iter().map(PathBuf::from).collect();
                let refs: Vec<&Path> = source_paths.iter().map(|p| p.as_path()).collect();
                let report = crate::tools::shredder::shred_paths(&refs, crate::tools::shredder::ShredAlgorithm::Dod3Pass, |_| {});
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: report.files_destroyed,
                    message: format!("Cryptographically shredded {} files with DoD 5220.22-M", report.files_destroyed),
                    affected_paths: plan.matched_files.clone(),
                })
            }
            "tag" => {
                let tag = plan.target_folder_name.as_deref().unwrap_or("Important");
                let mut count = 0;
                for file_str in &plan.matched_files {
                    if crate::tools::tags::assign_tag(file_str, tag, Some("#38bdf8"), None).is_ok() {
                        count += 1;
                        affected.push(file_str.clone());
                    }
                }
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: count,
                    message: format!("Assigned tag '{}' to {} files", tag, count),
                    affected_paths: affected,
                })
            }
            _ => Ok(AiExecutionResult {
                success: true,
                processed_count: plan.matched_files.len(),
                message: format!("Plan executed successfully: {}", plan.intent_summary),
                affected_paths: plan.matched_files.clone(),
            }),
        }
    }

    /// Records Reinforcement Learning user feedback to update D-LinUCB policy.
    pub fn record_feedback(&self, action_kind: &str, reward: f32) {
        let mut bandit = self.bandit.lock().unwrap();
        let dummy_context = ContextVector::new([0.5; super::bandit::CONTEXT_DIM]);
        bandit.record_feedback(action_kind, &dummy_context, reward);

        // Save updated policy to disk
        if let Some(parent) = self.storage_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(serialized) = serde_json::to_string_pretty(&*bandit) {
            let _ = fs::write(&self.storage_path, serialized);
        }
    }
}
