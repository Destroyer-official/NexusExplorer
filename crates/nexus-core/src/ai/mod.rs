//! Autonomous Micro-SLM & Reinforcement Learning Subsystem (100% Native Rust).
//!
//! Provides ultra-lightweight, zero-hallucination natural language intent formulation,
//! rule-based verifier safety checks (GRPO), and non-stationary habit learning via
//! Discounted LinUCB (D-LinUCB) contextual bandits. Runs on any PC configuration with
//! sub-millisecond execution and < 35 MB RAM footprint.

pub mod agent;
pub mod bandit;
pub mod grammar;
pub mod intent;
pub mod verifier;

pub use agent::{AiAgentManager, AiAgentPlan, AiExecutionResult};
pub use bandit::{ContextVector, DiscountedLinUCB};
pub use grammar::StructuredActionDFA;
pub use intent::{ActionKind, IntentParser, ParsedIntent};
pub use verifier::{FilesystemVerifier, VerificationReport};

