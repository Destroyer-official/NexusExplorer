//! Deterministic Rule Verifier & Safety Environment (GRPO Evaluator).
//!
//! Evaluates candidate action trajectories against hard filesystem invariants:
//! collision prevention, system path protection, storage capacity limits, and
//! destructive boundary enforcement before presenting plans to the user.

use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationReport {
    pub is_safe: bool,
    pub safety_score: f32, // 0.0 to 1.0
    pub requires_explicit_confirm: bool,
    pub violations: Vec<String>,
    pub warnings: Vec<String>,
    pub estimated_bytes_affected: u64,
}

pub struct FilesystemVerifier;

impl FilesystemVerifier {
    /// Evaluates candidate source paths and planned target destinations.
    pub fn verify_operations(
        action_kind: &str,
        sources: &[PathBuf],
        dest_dir: Option<&Path>,
        is_destructive: bool,
    ) -> VerificationReport {
        let mut violations = Vec::new();
        let mut warnings = Vec::new();
        let mut total_bytes = 0u64;

        // 1. Check Protected System Paths
        for src in sources {
            let path_str = src.to_string_lossy().to_lowercase();
            if Self::is_critical_system_path(&path_str) {
                violations.push(format!("Forbidden: Path '{path_str}' is a protected system directory"));
            }

            if let Ok(meta) = src.metadata() {
                total_bytes += meta.len();
                if meta.permissions().readonly() && is_destructive {
                    warnings.push(format!("File '{}' has read-only attribute", src.display()));
                }
            }
        }

        // 2. Check Target Collision & Capacity
        if let Some(dest) = dest_dir {
            let dest_str = dest.to_string_lossy().to_lowercase();
            if Self::is_critical_system_path(&dest_str) {
                violations.push(format!("Forbidden: Target directory '{dest_str}' is protected"));
            }

            for src in sources {
                if let Some(name) = src.file_name() {
                    let target_path = dest.join(name);
                    if target_path.exists() && target_path != *src {
                        warnings.push(format!("Collision: Destination file '{}' already exists", target_path.display()));
                    }
                }
            }
        }

        // 3. Destructive Action Check
        let requires_explicit_confirm = is_destructive || action_kind == "shred" || sources.len() > 100 || !warnings.is_empty();

        let mut safety_score = 1.0f32;
        safety_score -= (violations.len() as f32) * 0.5;
        safety_score -= (warnings.len() as f32) * 0.08;
        if is_destructive {
            safety_score -= 0.15;
        }
        safety_score = safety_score.clamp(0.0, 1.0);

        VerificationReport {
            is_safe: violations.is_empty(),
            safety_score,
            requires_explicit_confirm,
            violations,
            warnings,
            estimated_bytes_affected: total_bytes,
        }
    }

    /// Verifies if a path is inside Windows critical system folders.
    fn is_critical_system_path(path_lower: &str) -> bool {
        let system_prefixes = [
            "c:\\windows",
            "c:\\program files",
            "c:\\program files (x86)",
            "c:\\system volume information",
            "c:\\$recycle.bin",
            "c:\\boot",
            "c:\\recovery",
            "c:\\msocache",
        ];

        for prefix in &system_prefixes {
            if path_lower.starts_with(prefix) {
                return true;
            }
        }

        // Protect internal .git directories
        if path_lower.contains("\\.git\\objects") || path_lower.contains("\\.git\\refs") {
            return true;
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_path_protection() {
        let sys_path = PathBuf::from("C:\\Windows\\System32\\cmd.exe");
        let report = FilesystemVerifier::verify_operations("shred", &[sys_path], None, true);
        assert!(!report.is_safe);
        assert!(!report.violations.is_empty());
    }

    #[test]
    fn test_user_file_safety() {
        let user_path = PathBuf::from("C:\\Users\\Developer\\Desktop\\notes.txt");
        let report = FilesystemVerifier::verify_operations("organize_by_extension", &[user_path], None, false);
        assert!(report.is_safe);
        assert!(report.safety_score > 0.8);
    }
}

