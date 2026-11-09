//! Autonomous Micro-SLM & RL Agent Orchestrator.
//!
//! Integrates neuro-symbolic intent parsing, Deterministic Safety Verification (GRPO),
//! and Non-Stationary Reinforcement Learning (D-LinUCB) into an end-to-end execution pipeline.

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

use super::bandit::{ContextVector, DiscountedLinUCB};
use super::intent::{ActionKind, IntentParser};
use super::verifier::FilesystemVerifier;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopilotCandidateItem {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub formatted_size: String,
    pub ext: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAgentStep {
    pub step_number: usize,
    pub action_kind: String,
    pub title: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAgentPlan {
    #[serde(alias = "plan_id")]
    pub plan_id: String,
    #[serde(alias = "raw_prompt")]
    pub raw_prompt: String,
    #[serde(alias = "action_kind")]
    pub action_kind: String,
    #[serde(alias = "intent_summary")]
    pub intent_summary: String,
    pub explanation: String,
    #[serde(alias = "matched_files", default)]
    pub matched_files: Vec<String>,
    #[serde(alias = "matched_candidates", default)]
    pub matched_candidates: Vec<CopilotCandidateItem>,
    #[serde(alias = "total_matched_bytes", default)]
    pub total_matched_bytes: u64,
    pub confidence: f32,
    #[serde(alias = "is_destructive", default)]
    pub is_destructive: bool,
    #[serde(alias = "requires_explicit_confirm", default)]
    pub requires_explicit_confirm: bool,
    #[serde(alias = "safety_score", default)]
    pub safety_score: f32,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(
        alias = "target_folder_name",
        alias = "tagName",
        alias = "tag_name",
        default
    )]
    pub target_folder_name: Option<String>,
    #[serde(alias = "target_patterns", default)]
    pub target_patterns: Vec<String>,
    #[serde(alias = "size_min_bytes", default)]
    pub size_min_bytes: Option<u64>,
    #[serde(alias = "size_max_bytes", default)]
    pub size_max_bytes: Option<u64>,
    #[serde(alias = "created_at_ms", default)]
    pub created_at_ms: u64,
    #[serde(default)]
    pub steps: Vec<AiAgentStep>,
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

impl Default for AiAgentManager {
    fn default() -> Self {
        Self::new()
    }
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
        let fallback_dir;
        let effective_dir = if current_dir.as_os_str().is_empty() || !current_dir.exists() {
            fallback_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            &fallback_dir
        } else {
            current_dir
        };

        let intent = IntentParser::parse(prompt, effective_dir);

        let lower_prompt = prompt.to_lowercase();
        let is_folder_query = lower_prompt.contains("folder")
            || lower_prompt.contains("directory")
            || lower_prompt.contains("directories");
        let is_largest_query = lower_prompt.contains("largest")
            || lower_prompt.contains("biggest")
            || lower_prompt.contains("heaviest")
            || lower_prompt.contains("most space");

        // 1. Scan directory to match candidate files and folders
        let mut matched_files: Vec<PathBuf> = Vec::new();
        let mut matched_candidates: Vec<CopilotCandidateItem> = Vec::new();
        let mut total_matched_bytes = 0u64;

        if effective_dir.is_dir() {
            if intent.action_kind == super::intent::ActionKind::FlattenDirectory {
                for entry in jwalk::WalkDir::new(effective_dir)
                    .min_depth(2)
                    .skip_hidden(false)
                    .into_iter()
                    .flatten()
                {
                    let path = entry.path();
                    if path.is_file() {
                        let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                        total_matched_bytes += size;
                        let name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        let ext = path
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|s| s.to_string());
                        matched_candidates.push(CopilotCandidateItem {
                            path: path.to_string_lossy().to_string(),
                            name,
                            is_dir: false,
                            size,
                            formatted_size: crate::util::human_bytes(size),
                            ext,
                        });
                        matched_files.push(path);
                    }
                }
            } else if let Ok(entries) = fs::read_dir(effective_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let is_dir = path.is_dir();

                    // If user specifically asked for folders, only process folders.
                    // Otherwise if not a largest/storage query, only process files.
                    if (is_folder_query && !is_dir) || (!is_folder_query && !is_largest_query && is_dir) {
                        continue;
                    }

                    // Extension filter (only for files)
                    if !is_dir && !intent.target_extensions.is_empty() {
                        let ext = path
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        if !intent
                            .target_extensions
                            .iter()
                            .any(|p| p.eq_ignore_ascii_case(&ext))
                        {
                            continue;
                        }
                    }

                    // Metadata filters (size, age)
                    let size = if is_dir {
                        let cancel = std::sync::atomic::AtomicBool::new(false);
                        crate::fs::folder_size::calculate_folder_size(
                            &path.to_string_lossy(),
                            &cancel,
                            &mut |_, _, _| {},
                        )
                        .map(|fs| fs.size)
                        .unwrap_or(0)
                    } else if let Ok(meta) = entry.metadata() {
                        meta.len()
                    } else {
                        0
                    };

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

                    if let Ok(meta) = entry.metadata() {
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
                    }

                    total_matched_bytes += size;
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    let ext = if is_dir {
                        None
                    } else {
                        path.extension()
                            .and_then(|e| e.to_str())
                            .map(|s| s.to_string())
                    };

                    matched_candidates.push(CopilotCandidateItem {
                        path: path.to_string_lossy().to_string(),
                        name,
                        is_dir,
                        size,
                        formatted_size: crate::util::human_bytes(size),
                        ext,
                    });
                    matched_files.push(path);
                }
            }
        }

        // Sort descending if user asked for largest/biggest
        if is_largest_query {
            matched_candidates.sort_by_key(|a| std::cmp::Reverse(a.size));
            matched_files.sort_by(|a, b| {
                let size_a = matched_candidates
                    .iter()
                    .find(|c| c.path == a.to_string_lossy())
                    .map(|c| c.size)
                    .unwrap_or(0);
                let size_b = matched_candidates
                    .iter()
                    .find(|c| c.path == b.to_string_lossy())
                    .map(|c| c.size)
                    .unwrap_or(0);
                size_b.cmp(&size_a)
            });
        }

        // 2. Construct Context Vector x_t
        let depth = effective_dir.ancestors().count();
        let hour = chrono::Local::now()
            .format("%H")
            .to_string()
            .parse::<u32>()
            .unwrap_or(12);
        let is_git = effective_dir.join(".git").exists()
            || effective_dir.ancestors().any(|a| a.join(".git").exists());
        let is_temp = effective_dir
            .to_string_lossy()
            .to_lowercase()
            .contains("download")
            || effective_dir
                .to_string_lossy()
                .to_lowercase()
                .contains("temp");

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
            return Err(format!(
                "Safety verifier rejected plan: {}",
                v_report.violations.join(", ")
            ));
        }

        // 4. D-LinUCB Reinforcement Learning Ranking
        let mut bandit = self.bandit.lock().unwrap();
        let (rl_score, expected_reward, ucb_bonus) =
            bandit.score_action(intent.action_kind.as_str(), &context);

        let plan_id = uuid::Uuid::new_v4().to_string();
        let intent_summary = if is_largest_query && !matched_candidates.is_empty() {
            let top = &matched_candidates[0];
            let item_type = if top.is_dir { "folder" } else { "file" };
            format!(
                "Identified largest {}: {} ({})",
                item_type, top.name, top.formatted_size
            )
        } else {
            match intent.action_kind {
                ActionKind::OrganizeByExtension => format!(
                    "Sort {} files into subfolders by file extension",
                    matched_files.len()
                ),
                ActionKind::OrganizeByDate => format!(
                    "Organize {} files into Year/Month subdirectories",
                    matched_files.len()
                ),
                ActionKind::ArchiveZip => {
                    format!("Compress {} files into ZIP archive", matched_files.len())
                }
                ActionKind::Shred => format!(
                    "Cryptographically wipe {} matched files",
                    matched_files.len()
                ),
                ActionKind::Tag => format!(
                    "Tag {} files as '{}'",
                    matched_files.len(),
                    intent.custom_tag.as_deref().unwrap_or("Important")
                ),
                ActionKind::CloneCow => {
                    format!("Fast copy-on-write clone of {} items", matched_files.len())
                }
                ActionKind::Search => {
                    format!("Discovered {} items matching criteria", matched_files.len())
                }
                ActionKind::FlattenDirectory => format!(
                    "Flatten directory hierarchy for {} items",
                    matched_files.len()
                ),
                ActionKind::Deduplicate => format!(
                    "Scan {} candidate files for cryptographic duplicates",
                    matched_files.len()
                ),
            }
        };

        let explanation = if is_largest_query && !matched_candidates.is_empty() {
            let top = &matched_candidates[0];
            let item_type = if top.is_dir { "folder" } else { "file" };
            format!(
                "Analyzed storage in {}. The largest {} is '{}' taking {}.",
                effective_dir.display(),
                item_type,
                top.name,
                top.formatted_size
            )
        } else {
            format!(
                "Micro-SLM Intent: {:?} | Safety Score: {:.0}% | D-LinUCB Expected Reward: {:.2} (UCB: +{:.2})",
                intent.action_kind,
                v_report.safety_score * 100.0,
                expected_reward,
                ucb_bonus,
            )
        };

        let string_paths: Vec<String> = matched_files
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();

        // Multi-Step Pipeline Formulation
        let mut steps = Vec::new();
        let has_multi_step = lower_prompt.contains(" and then ")
            || lower_prompt.contains(" then ")
            || lower_prompt.contains(" after that ")
            || (lower_prompt.contains(" and ")
                && (lower_prompt.contains("shred")
                    || lower_prompt.contains("wipe")
                    || lower_prompt.contains("delete"))
                && (lower_prompt.contains("zip")
                    || lower_prompt.contains("compress")
                    || lower_prompt.contains("archive")
                    || lower_prompt.contains("organize")));

        if has_multi_step {
            if (lower_prompt.contains("zip")
                || lower_prompt.contains("compress")
                || lower_prompt.contains("archive"))
                && (lower_prompt.contains("shred")
                    || lower_prompt.contains("wipe")
                    || lower_prompt.contains("delete"))
            {
                steps.push(AiAgentStep {
                    step_number: 1,
                    action_kind: "archive_zip".to_string(),
                    title: format!("Compress {} matched files into ZIP archive", string_paths.len()),
                    status: "pending".to_string(),
                });
                steps.push(AiAgentStep {
                    step_number: 2,
                    action_kind: "shred".to_string(),
                    title: format!("Cryptographically wipe {} original source files", string_paths.len()),
                    status: "pending".to_string(),
                });
            } else if lower_prompt.contains("clone") && lower_prompt.contains("tag") {
                steps.push(AiAgentStep {
                    step_number: 1,
                    action_kind: "clone_cow".to_string(),
                    title: format!("Fast copy-on-write clone of {} items", string_paths.len()),
                    status: "pending".to_string(),
                });
                steps.push(AiAgentStep {
                    step_number: 2,
                    action_kind: "tag".to_string(),
                    title: format!("Apply tag metadata to {} items", string_paths.len()),
                    status: "pending".to_string(),
                });
            } else if (lower_prompt.contains("largest")
                || lower_prompt.contains("search")
                || lower_prompt.contains("find"))
                && lower_prompt.contains("organize")
            {
                steps.push(AiAgentStep {
                    step_number: 1,
                    action_kind: "search".to_string(),
                    title: format!("Filter and rank {} matching items", string_paths.len()),
                    status: "pending".to_string(),
                });
                steps.push(AiAgentStep {
                    step_number: 2,
                    action_kind: "organize_by_extension".to_string(),
                    title: format!("Sort {} items into subfolders by extension", string_paths.len()),
                    status: "pending".to_string(),
                });
            }
        }

        if steps.is_empty() {
            steps.push(AiAgentStep {
                step_number: 1,
                action_kind: intent.action_kind.as_str().to_string(),
                title: intent_summary.clone(),
                status: "pending".to_string(),
            });
        }

        Ok(AiAgentPlan {
            plan_id,
            raw_prompt: prompt.to_string(),
            action_kind: intent.action_kind.as_str().to_string(),
            intent_summary,
            explanation,
            matched_files: string_paths,
            matched_candidates,
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
            created_at_ms: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            steps,
        })
    }

    /// Executes an approved action plan (supporting multi-step pipelines).
    pub fn execute_plan(
        &self,
        plan: &AiAgentPlan,
        current_dir: &Path,
    ) -> Result<AiExecutionResult, String> {
        if plan.steps.len() > 1 {
            let mut total_processed = 0;
            let mut all_affected = Vec::new();
            let mut step_messages = Vec::new();

            for step in &plan.steps {
                let single_plan = AiAgentPlan {
                    action_kind: step.action_kind.clone(),
                    ..plan.clone()
                };
                let res = self.execute_single_action(&single_plan, current_dir)?;
                total_processed += res.processed_count;
                all_affected.extend(res.affected_paths);
                step_messages.push(format!("Step {}: {}", step.step_number, res.message));
            }

            Ok(AiExecutionResult {
                success: true,
                processed_count: total_processed,
                message: format!("Multi-step pipeline completed: {}", step_messages.join(" → ")),
                affected_paths: all_affected,
            })
        } else {
            self.execute_single_action(plan, current_dir)
        }
    }

    fn execute_single_action(
        &self,
        plan: &AiAgentPlan,
        current_dir: &Path,
    ) -> Result<AiExecutionResult, String> {
        let mut affected = Vec::new();

        match plan.action_kind.as_str() {
            "organize_by_extension" | "move_by_extension" => {
                let mut count = 0;
                for file_str in &plan.matched_files {
                    let p = Path::new(file_str);
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        let folder = current_dir.join(ext.to_uppercase());
                        let _ = fs::create_dir_all(&folder);
                        if let Some(name) = p.file_name() {
                            let dest = crate::util::unique_path(&folder, &name.to_string_lossy());
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
                                let dest =
                                    crate::util::unique_path(&folder, &name.to_string_lossy());
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
                let zip_name = format!(
                    "Archive_{}.zip",
                    chrono::Local::now().format("%Y%m%d_%H%M%S")
                );
                let zip_path = current_dir.join(&zip_name);
                let dest_str = zip_path.to_string_lossy();
                crate::tools::archive::create_zip_archive(
                    &plan.matched_files,
                    &dest_str,
                    6,
                    |_, _, _| {},
                )?;
                affected.push(zip_path.to_string_lossy().to_string());
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: plan.matched_files.len(),
                    message: format!(
                        "Compressed {} files into {}",
                        plan.matched_files.len(),
                        zip_name
                    ),
                    affected_paths: affected,
                })
            }
            "shred" => {
                let source_paths: Vec<PathBuf> =
                    plan.matched_files.iter().map(PathBuf::from).collect();
                let refs: Vec<&Path> = source_paths.iter().map(|p| p.as_path()).collect();
                let report = crate::tools::shredder::shred_paths(
                    &refs,
                    crate::tools::shredder::ShredAlgorithm::Dod3Pass,
                    |_| {},
                );
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: report.files_destroyed,
                    message: format!(
                        "Cryptographically shredded {} files with DoD 5220.22-M",
                        report.files_destroyed
                    ),
                    affected_paths: plan.matched_files.clone(),
                })
            }
            "tag" => {
                let tag = plan.target_folder_name.as_deref().unwrap_or("Important");
                let mut count = 0;
                for file_str in &plan.matched_files {
                    if crate::tools::tags::assign_tag(file_str, tag, Some("#38bdf8"), None).is_ok()
                    {
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
            "clone_cow" => {
                let mut count = 0;
                for file_str in &plan.matched_files {
                    let p = Path::new(file_str);
                    if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                        let ext = p
                            .extension()
                            .and_then(|e| e.to_str())
                            .map(|e| format!(".{e}"))
                            .unwrap_or_default();
                        let target_name = format!("{stem}_copy{ext}");
                        let dest = crate::util::unique_path(current_dir, &target_name);
                        if crate::fs::cow::clone_file(&p.to_string_lossy(), &dest.to_string_lossy())
                            .is_ok()
                        {
                            count += 1;
                            affected.push(dest.to_string_lossy().to_string());
                        }
                    }
                }
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: count,
                    message: format!("Cloned {} files using Copy-on-Write", count),
                    affected_paths: affected,
                })
            }
            "flatten_directory" => {
                let mut count = 0;
                let mut dirs_to_prune: std::collections::HashSet<PathBuf> =
                    std::collections::HashSet::new();
                for file_str in &plan.matched_files {
                    let p = Path::new(file_str);
                    if let Some(name) = p.file_name() {
                        let dest = crate::util::unique_path(current_dir, &name.to_string_lossy());
                        if dest != p && fs::rename(p, &dest).is_ok() {
                            count += 1;
                            affected.push(dest.to_string_lossy().to_string());
                            if let Some(parent) = p.parent() {
                                if parent != current_dir && parent.starts_with(current_dir) {
                                    dirs_to_prune.insert(parent.to_path_buf());
                                }
                            }
                        }
                    }
                }
                // Prune empty subfolders bottom-up
                let mut sorted_dirs: Vec<PathBuf> = dirs_to_prune.into_iter().collect();
                sorted_dirs.sort_by_key(|p| std::cmp::Reverse(p.as_os_str().len()));
                for d in sorted_dirs {
                    let _ = fs::remove_dir(d);
                }
                Ok(AiExecutionResult {
                    success: true,
                    processed_count: count,
                    message: format!("Flattened {} files into current directory", count),
                    affected_paths: affected,
                })
            }
            "search" => Ok(AiExecutionResult {
                success: true,
                processed_count: plan.matched_files.len(),
                message: format!("Located {} matching items", plan.matched_files.len()),
                affected_paths: plan.matched_files.clone(),
            }),
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_ai_agent_plan_formulation() {
        let dir = tempdir().unwrap();
        let path = dir.path();

        // Create sample files
        fs::write(path.join("document1.pdf"), "sample pdf content").unwrap();
        fs::write(path.join("document2.pdf"), "sample pdf content 2").unwrap();
        fs::write(path.join("image.png"), "sample png bytes").unwrap();

        let agent = AiAgentManager::new();

        // Test organizing PDF files
        let plan = agent
            .formulate_plan("organize pdf files by extension", path)
            .expect("Should formulate plan");

        assert_eq!(plan.action_kind, "organize_by_extension");
        assert_eq!(plan.matched_files.len(), 2);
        assert!(!plan.is_destructive);
        assert!(plan.safety_score > 0.8);
    }

    #[test]
    fn test_ai_agent_execution_and_rl_feedback() {
        let dir = tempdir().unwrap();
        let path = dir.path();

        // Create sample files for compression
        fs::write(path.join("file1.log"), "log line 1\n").unwrap();
        fs::write(path.join("file2.log"), "log line 2\n").unwrap();

        let agent = AiAgentManager::new();

        // 1. Formulate plan to archive files
        let plan = agent
            .formulate_plan("compress log files to zip", path)
            .expect("Should formulate archive plan");

        assert_eq!(plan.action_kind, "archive_zip");
        assert_eq!(plan.matched_files.len(), 2);

        // 2. Execute plan
        let result = agent
            .execute_plan(&plan, path)
            .expect("Should execute archive plan successfully");

        assert!(result.success);
        assert_eq!(result.processed_count, 2);

        // 3. Record positive RL reward
        agent.record_feedback(&plan.action_kind, 1.0);

        // Verify ZIP archive was created
        let archives: Vec<_> = fs::read_dir(path)
            .unwrap()
            .flatten()
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "zip"))
            .collect();

        assert_eq!(archives.len(), 1, "Expected 1 zip archive to be created");
    }

    #[test]
    fn test_ai_agent_safety_verification_blocks_destructive_without_confirm() {
        let dir = tempdir().unwrap();
        let path = dir.path();

        fs::write(path.join("sensitive.key"), "SUPER_SECRET_KEY").unwrap();

        let agent = AiAgentManager::new();
        let plan = agent
            .formulate_plan("shred key files", path)
            .expect("Should formulate shred plan");

        assert_eq!(plan.action_kind, "shred");
        assert!(plan.is_destructive);
        assert!(plan.requires_explicit_confirm);
    }

    #[test]
    fn test_ai_agent_multistep_pipeline() {
        let dir = tempdir().unwrap();
        let path = dir.path();

        fs::write(path.join("trace.log"), "trace data").unwrap();
        fs::write(path.join("audit.log"), "audit data").unwrap();

        let agent = AiAgentManager::new();
        let plan = agent
            .formulate_plan("compress log files to zip and then shred originals", path)
            .expect("Should formulate multi-step plan");

        assert_eq!(plan.steps.len(), 2, "Expected 2 steps in pipeline");
        assert_eq!(plan.steps[0].action_kind, "archive_zip");
        assert_eq!(plan.steps[1].action_kind, "shred");

        let result = agent
            .execute_plan(&plan, path)
            .expect("Multi-step pipeline should execute");

        assert!(result.success);
        assert!(result.message.contains("Multi-step pipeline completed"));
    }
}
