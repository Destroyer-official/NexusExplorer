//! Discounted LinUCB (D-LinUCB) Non-Stationary Reinforcement Learning Engine.
//!
//! Implements a contextual multi-armed bandit with exponentially decaying historical weights
//! (discount factor γ), enabling instantaneous on-device habit learning that smoothly adapts
//! to shifting user workflows without neural network backpropagation or GPU compute.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub const CONTEXT_DIM: usize = 12;

/// A 12-dimensional context feature vector describing the current filesystem & user environment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextVector {
    pub features: [f32; CONTEXT_DIM],
}

impl ContextVector {
    pub fn new(features: [f32; CONTEXT_DIM]) -> Self {
        Self { features }
    }

    /// Constructs a normalized context vector from directory metadata and runtime environment.
    pub fn from_directory_state(
        depth: usize,
        file_count: usize,
        total_bytes: u64,
        is_git_repo: bool,
        is_media_heavy: bool,
        is_temp_or_downloads: bool,
        is_system_path: bool,
        hour_of_day: u32,
        file_age_variance_days: f32,
        is_destructive_prompt: bool,
    ) -> Self {
        let depth_norm = (depth as f32 / 10.0).clamp(0.0, 1.0);
        let count_log = ((file_count as f32 + 1.0).log10() / 4.0).clamp(0.0, 1.0);
        let size_log = ((total_bytes as f32 + 1.0).log10() / 12.0).clamp(0.0, 1.0);
        let git_flag = if is_git_repo { 1.0 } else { 0.0 };
        let media_flag = if is_media_heavy { 1.0 } else { 0.0 };
        let temp_flag = if is_temp_or_downloads { 1.0 } else { 0.0 };
        let sys_flag = if is_system_path { 1.0 } else { 0.0 };

        let hour_rad = (hour_of_day as f32) * std::f32::consts::PI / 12.0;
        let hour_sin = hour_rad.sin();
        let hour_cos = hour_rad.cos();

        let age_var_norm = (file_age_variance_days / 365.0).clamp(0.0, 1.0);
        let destructive_flag = if is_destructive_prompt { 1.0 } else { 0.0 };
        let bias = 1.0;

        Self {
            features: [
                depth_norm,
                count_log,
                size_log,
                git_flag,
                media_flag,
                temp_flag,
                sys_flag,
                hour_sin,
                hour_cos,
                age_var_norm,
                destructive_flag,
                bias,
            ],
        }
    }
}

/// Parameters for a single action arm in the D-LinUCB bandit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArmModel {
    /// Covariance matrix A (dimension 12x12 flattened to 144)
    pub matrix_a: Vec<f32>,
    /// Reward-weighted context vector b (dimension 12)
    pub vector_b: Vec<f32>,
    /// Total updates received by this arm
    pub sample_count: usize,
}

impl ArmModel {
    pub fn new() -> Self {
        let mut matrix_a = vec![0.0; CONTEXT_DIM * CONTEXT_DIM];
        for i in 0..CONTEXT_DIM {
            matrix_a[i * CONTEXT_DIM + i] = 1.0; // Identity matrix I_d
        }
        let vector_b = vec![0.0; CONTEXT_DIM];

        Self {
            matrix_a,
            vector_b,
            sample_count: 0,
        }
    }

    /// Evaluates the expected reward and UCB exploration bonus for a given context vector.
    pub fn score(&self, x: &[f32; CONTEXT_DIM], alpha: f32) -> (f32, f32) {
        let inv_a = invert_matrix_12(&self.matrix_a);
        
        // theta = A^(-1) * b
        let mut theta = [0.0; CONTEXT_DIM];
        for i in 0..CONTEXT_DIM {
            let mut sum = 0.0;
            for j in 0..CONTEXT_DIM {
                sum += inv_a[i * CONTEXT_DIM + j] * self.vector_b[j];
            }
            theta[i] = sum;
        }

        // expected_reward = theta^T * x
        let mut expected_reward = 0.0;
        for i in 0..CONTEXT_DIM {
            expected_reward += theta[i] * x[i];
        }

        // variance = x^T * A^(-1) * x
        let mut inv_a_x = [0.0; CONTEXT_DIM];
        for i in 0..CONTEXT_DIM {
            let mut sum = 0.0;
            for j in 0..CONTEXT_DIM {
                sum += inv_a[i * CONTEXT_DIM + j] * x[j];
            }
            inv_a_x[i] = sum;
        }

        let mut variance = 0.0;
        for i in 0..CONTEXT_DIM {
            variance += x[i] * inv_a_x[i];
        }
        let ucb_bonus = alpha * variance.max(0.0).sqrt();

        (expected_reward, ucb_bonus)
    }

    /// Applies discounted update: A <- gamma*A + (1-gamma)*I + x*x^T, b <- gamma*b + r*x
    pub fn update(&mut self, x: &[f32; CONTEXT_DIM], reward: f32, gamma: f32) {
        self.sample_count += 1;

        // Discount existing matrix A and add (1-gamma)*I
        for i in 0..CONTEXT_DIM {
            for j in 0..CONTEXT_DIM {
                let idx = i * CONTEXT_DIM + j;
                let identity_val = if i == j { 1.0 } else { 0.0 };
                let outer_prod = x[i] * x[j];
                self.matrix_a[idx] = gamma * self.matrix_a[idx] + (1.0 - gamma) * identity_val + outer_prod;
            }
        }

        // Discount vector b and add r*x
        for i in 0..CONTEXT_DIM {
            self.vector_b[i] = gamma * self.vector_b[i] + reward * x[i];
        }
    }
}

/// The Discounted LinUCB Policy Manager.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscountedLinUCB {
    pub arms: HashMap<String, ArmModel>,
    pub gamma: f32,
    pub alpha: f32,
}

impl Default for DiscountedLinUCB {
    fn default() -> Self {
        Self::new(0.995, 0.35)
    }
}

impl DiscountedLinUCB {
    pub fn new(gamma: f32, alpha: f32) -> Self {
        let mut arms = HashMap::new();
        let default_actions = [
            "organize_by_extension",
            "organize_by_date",
            "archive_zip",
            "shred",
            "tag",
            "clone_cow",
            "search",
            "flatten_directory",
            "deduplicate",
        ];

        for act in &default_actions {
            arms.insert(act.to_string(), ArmModel::new());
        }

        Self {
            arms,
            gamma,
            alpha,
        }
    }

    /// Scores a candidate action arm for the given context. Returns (score, expected_reward, ucb_bonus).
    pub fn score_action(&mut self, action: &str, context: &ContextVector) -> (f32, f32, f32) {
        let arm = self.arms.entry(action.to_string()).or_insert_with(ArmModel::new);
        let (expected, ucb) = arm.score(&context.features, self.alpha);
        (expected + ucb, expected, ucb)
    }

    /// Records user feedback for an executed or rejected action arm.
    pub fn record_feedback(&mut self, action: &str, context: &ContextVector, reward: f32) {
        let gamma = self.gamma;
        let arm = self.arms.entry(action.to_string()).or_insert_with(ArmModel::new);
        arm.update(&context.features, reward, gamma);
    }
}

/// Inverts a symmetric positive-definite 12x12 matrix using Gauss-Jordan elimination with partial pivoting.
fn invert_matrix_12(src: &[f32]) -> [f32; CONTEXT_DIM * CONTEXT_DIM] {
    let mut augmented = [[0.0f32; CONTEXT_DIM * 2]; CONTEXT_DIM];

    for i in 0..CONTEXT_DIM {
        for j in 0..CONTEXT_DIM {
            augmented[i][j] = src[i * CONTEXT_DIM + j];
            augmented[i][j + CONTEXT_DIM] = if i == j { 1.0 } else { 0.0 };
        }
    }

    for col in 0..CONTEXT_DIM {
        // Find pivot
        let mut max_row = col;
        let mut max_val = augmented[col][col].abs();
        for r in (col + 1)..CONTEXT_DIM {
            let val = augmented[r][col].abs();
            if val > max_val {
                max_val = val;
                max_row = r;
            }
        }

        if max_row != col {
            augmented.swap(col, max_row);
        }

        let pivot = augmented[col][col];
        let pivot_safe = if pivot.abs() < 1e-6 { 1e-6 } else { pivot };

        for j in 0..(CONTEXT_DIM * 2) {
            augmented[col][j] /= pivot_safe;
        }

        for r in 0..CONTEXT_DIM {
            if r != col {
                let factor = augmented[r][col];
                for j in 0..(CONTEXT_DIM * 2) {
                    augmented[r][j] -= factor * augmented[col][j];
                }
            }
        }
    }

    let mut result = [0.0f32; CONTEXT_DIM * CONTEXT_DIM];
    for i in 0..CONTEXT_DIM {
        for j in 0..CONTEXT_DIM {
            result[i * CONTEXT_DIM + j] = augmented[i][j + CONTEXT_DIM];
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bandit_learning_adaptation() {
        let mut bandit = DiscountedLinUCB::new(0.99, 0.3);
        let ctx = ContextVector::new([0.5; CONTEXT_DIM]);

        let (initial_score, _, _) = bandit.score_action("organize_by_extension", &ctx);

        // Train with positive rewards (+1.0)
        for _ in 0..5 {
            bandit.record_feedback("organize_by_extension", &ctx, 1.0);
        }
        let (learned_score, _, _) = bandit.score_action("organize_by_extension", &ctx);
        assert!(learned_score > initial_score, "Expected score to increase after positive feedback");

        // Train alternative with negative reward (-1.0)
        bandit.record_feedback("shred", &ctx, -1.0);
        let (shred_score, _, _) = bandit.score_action("shred", &ctx);
        assert!(learned_score > shred_score, "Preferred action should rank higher than penalized action");
    }
}

