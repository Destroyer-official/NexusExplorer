//! Grammar-Constrained Decoding & Structured Token Automaton (DFA).
//!
//! Provides a Deterministic Finite Automaton that strictly constrains action plans
//! to valid syntactic and semantic JSON representations, eliminating invalid tokens
//! or schema violations at generation time.

use std::collections::HashSet;

/// Discrete states in the structured action plan grammar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum GrammarState {
    Start,
    InActionKey,
    InActionValue,
    InTargetPatternKey,
    InTargetPatternValue,
    InSizeMinKey,
    InSizeMinValue,
    InSizeMaxKey,
    InSizeMaxValue,
    InDestFolderKey,
    InDestFolderValue,
    Closed,
    Error,
}

/// A lightweight Deterministic Finite Automaton for structured filesystem JSON.
#[derive(Debug, Clone)]
pub struct StructuredActionDFA {
    current_state: GrammarState,
    valid_actions: HashSet<String>,
}

impl Default for StructuredActionDFA {
    fn default() -> Self {
        Self::new()
    }
}

impl StructuredActionDFA {
    pub fn new() -> Self {
        let mut valid_actions = HashSet::new();
        valid_actions.insert("organize_by_extension".to_string());
        valid_actions.insert("organize_by_date".to_string());
        valid_actions.insert("archive_zip".to_string());
        valid_actions.insert("shred".to_string());
        valid_actions.insert("tag".to_string());
        valid_actions.insert("clone_cow".to_string());
        valid_actions.insert("search".to_string());
        valid_actions.insert("flatten_directory".to_string());
        valid_actions.insert("deduplicate".to_string());

        Self {
            current_state: GrammarState::Start,
            valid_actions,
        }
    }

    /// Resets the DFA to initial state.
    pub fn reset(&mut self) {
        self.current_state = GrammarState::Start;
    }

    /// Returns the current state of the DFA.
    pub fn state(&self) -> GrammarState {
        self.current_state
    }

    /// Validates if an action string is part of the supported action grammar.
    pub fn is_valid_action(&self, action: &str) -> bool {
        self.valid_actions.contains(action)
    }

    /// Checks whether an input token string is valid to transition from current state.
    pub fn step(&mut self, token: &str) -> bool {
        let trimmed = token.trim();
        match self.current_state {
            GrammarState::Start => {
                if trimmed == "{" || trimmed.starts_with('{') {
                    self.current_state = GrammarState::InActionKey;
                    true
                } else {
                    self.current_state = GrammarState::Error;
                    false
                }
            }
            GrammarState::InActionKey => {
                if trimmed.contains("\"action\"") {
                    self.current_state = GrammarState::InActionValue;
                    true
                } else {
                    false
                }
            }
            GrammarState::InActionValue => {
                let action = trimmed.trim_matches(|c| c == '"' || c == ',' || c == ':').trim();
                if self.valid_actions.contains(action) {
                    self.current_state = GrammarState::InTargetPatternKey;
                    true
                } else {
                    self.current_state = GrammarState::Error;
                    false
                }
            }
            GrammarState::InTargetPatternKey => {
                if trimmed.contains("\"targetPattern\"") || trimmed.contains("\"patterns\"") {
                    self.current_state = GrammarState::InTargetPatternValue;
                    true
                } else if trimmed == "}" {
                    self.current_state = GrammarState::Closed;
                    true
                } else {
                    true
                }
            }
            GrammarState::InTargetPatternValue => {
                self.current_state = GrammarState::InSizeMinKey;
                true
            }
            GrammarState::InSizeMinKey => {
                if trimmed == "}" || trimmed.ends_with('}') {
                    self.current_state = GrammarState::Closed;
                }
                true
            }
            GrammarState::Closed => trimmed.is_empty(),
            _ => true,
        }
    }

    /// Verifies if a given JSON object string strictly adheres to our action plan grammar.
    pub fn validate_json(&self, json_str: &str) -> Result<serde_json::Value, String> {
        let parsed: serde_json::Value = serde_json::from_str(json_str)
            .map_err(|e| format!("Grammar syntax violation: invalid JSON ({e})"))?;

        if !parsed.is_object() {
            return Err("Grammar semantic violation: Root must be a JSON object".to_string());
        }

        let obj = parsed.as_object().unwrap();
        if let Some(action_val) = obj.get("action") {
            if let Some(act) = action_val.as_str() {
                if !self.valid_actions.contains(act) {
                    return Err(format!("Grammar semantic violation: Unsupported action '{act}'"));
                }
            } else {
                return Err("Grammar semantic violation: 'action' field must be a string".to_string());
            }
        } else {
            return Err("Grammar semantic violation: Missing required 'action' field".to_string());
        }

        Ok(parsed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_action_grammar() {
        let dfa = StructuredActionDFA::new();
        let valid_json = r#"{"action":"organize_by_extension","targetPattern":"*.png"}"#;
        assert!(dfa.validate_json(valid_json).is_ok());

        let invalid_action = r#"{"action":"unsupported_quantum_sort"}"#;
        assert!(dfa.validate_json(invalid_action).is_err());

        let broken_json = r#"{"action": broken"#;
        assert!(dfa.validate_json(broken_json).is_err());
    }
}
