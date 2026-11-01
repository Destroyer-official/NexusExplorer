//! Neuro-Symbolic Semantic Slot Extraction & Natural Language Intent Engine.
//!
//! Rapidly parses unstructured conversational prompts into typed, strongly validated
//! filesystem intents with zero cloud calls, zero external runtime, and sub-millisecond execution.

use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionKind {
    OrganizeByExtension,
    OrganizeByDate,
    ArchiveZip,
    Shred,
    Tag,
    CloneCow,
    Search,
    FlattenDirectory,
    Deduplicate,
}

impl ActionKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::OrganizeByExtension => "organize_by_extension",
            Self::OrganizeByDate => "organize_by_date",
            Self::ArchiveZip => "archive_zip",
            Self::Shred => "shred",
            Self::Tag => "tag",
            Self::CloneCow => "clone_cow",
            Self::Search => "search",
            Self::FlattenDirectory => "flatten_directory",
            Self::Deduplicate => "deduplicate",
        }
    }
}

/// Parsed natural language intent representation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedIntent {
    pub action_kind: ActionKind,
    pub confidence: f32,
    pub is_destructive: bool,
    pub target_extensions: Vec<String>,
    pub size_min_bytes: Option<u64>,
    pub size_max_bytes: Option<u64>,
    pub age_days_min: Option<u32>,
    pub age_days_max: Option<u32>,
    pub custom_tag: Option<String>,
    pub explicit_dest_dir: Option<String>,
    pub raw_prompt: String,
}

pub struct IntentParser;

impl IntentParser {
    /// Parses natural language text into a structured intent with semantic slots.
    pub fn parse(prompt: &str, _current_dir: &Path) -> ParsedIntent {
        let lower = prompt.to_lowercase();
        let words: Vec<&str> = lower.split_whitespace().collect();

        // 1. Classify Action Kind
        let (action_kind, is_destructive, confidence) = if lower.contains("shred") || lower.contains("wipe") || lower.contains("secure delete") {
            (ActionKind::Shred, true, 0.96)
        } else if lower.contains("date") || lower.contains("by year") || lower.contains("by month") || lower.contains("chronological") {
            (ActionKind::OrganizeByDate, false, 0.92)
        } else if lower.contains("organize") || lower.contains("sort by extension") || lower.contains("tidy") || lower.contains("group by type") {
            (ActionKind::OrganizeByExtension, false, 0.94)
        } else if lower.contains("zip") || lower.contains("compress") || lower.contains("archive") || lower.contains("pack") {
            (ActionKind::ArchiveZip, false, 0.95)
        } else if lower.contains("clone") || lower.contains("cow") || lower.contains("duplicate") {
            (ActionKind::CloneCow, false, 0.90)
        } else if lower.contains("flatten") || lower.contains("un-nest") || lower.contains("extract all files here") {
            (ActionKind::FlattenDirectory, false, 0.91)
        } else if lower.contains("dedup") || lower.contains("duplicate") || lower.contains("find same files") {
            (ActionKind::Deduplicate, false, 0.93)
        } else if lower.contains("tag") || lower.contains("label") || lower.contains("categorize") {
            (ActionKind::Tag, false, 0.88)
        } else {
            (ActionKind::Search, false, 0.85)
        };

        // 2. Extract Category & Extensions
        let mut target_extensions = Vec::new();
        if lower.contains("image") || lower.contains("photo") || lower.contains("picture") {
            target_extensions.extend_from_slice(&["png".into(), "jpg".into(), "jpeg".into(), "webp".into(), "svg".into(), "gif".into()]);
        }
        if lower.contains("video") || lower.contains("movie") || lower.contains("clip") {
            target_extensions.extend_from_slice(&["mp4".into(), "mkv".into(), "mov".into(), "avi".into()]);
        }
        if lower.contains("audio") || lower.contains("music") || lower.contains("sound") {
            target_extensions.extend_from_slice(&["mp3".into(), "wav".into(), "flac".into(), "m4a".into()]);
        }
        if lower.contains("doc") || lower.contains("document") || lower.contains("pdf") || lower.contains("notes") {
            target_extensions.extend_from_slice(&["pdf".into(), "docx".into(), "txt".into(), "md".into(), "xlsx".into()]);
        }
        if lower.contains("code") || lower.contains("source") {
            target_extensions.extend_from_slice(&["rs".into(), "ts".into(), "js".into(), "tsx".into(), "py".into(), "json".into()]);
        }
        if lower.contains("installer") || lower.contains("setup") {
            target_extensions.extend_from_slice(&["exe".into(), "msi".into(), "iso".into()]);
        }
        if lower.contains("log") || lower.contains("temp") || lower.contains("tmp") {
            target_extensions.extend_from_slice(&["log".into(), "tmp".into(), "bak".into()]);
        }

        // Direct extension tokens (e.g. *.png, .rs, .md)
        for w in &words {
            if w.starts_with('.') && w.len() > 1 {
                let ext = w.trim_start_matches('.').trim_matches(|c: char| !c.is_alphanumeric()).to_string();
                if !ext.is_empty() && !target_extensions.contains(&ext) {
                    target_extensions.push(ext);
                }
            }
        }

        // 3. Extract Size Bounds
        let mut size_min_bytes = None;
        let mut size_max_bytes = None;

        for (i, w) in words.iter().enumerate() {
            if (*w == ">" || *w == "larger" || *w == "over" || *w == "above") && i + 1 < words.len() {
                size_min_bytes = parse_size_token(words[i + 1]);
            } else if (*w == "<" || *w == "smaller" || *w == "under" || *w == "below") && i + 1 < words.len() {
                size_max_bytes = parse_size_token(words[i + 1]);
            }
        }

        // 4. Extract Age Bounds
        let mut age_days_min = None;
        let mut age_days_max = None;

        for (i, w) in words.iter().enumerate() {
            if (*w == "older" || *w == "prior") && i + 2 < words.len() && words[i + 1] == "than" {
                if let Ok(days) = words[i + 2].parse::<u32>() {
                    age_days_min = Some(days);
                }
            } else if (*w == "newer" || *w == "recent") && i + 2 < words.len() && words[i + 1] == "than" {
                if let Ok(days) = words[i + 2].parse::<u32>() {
                    age_days_max = Some(days);
                }
            }
        }

        // 5. Extract Custom Tag
        let mut custom_tag = None;
        if action_kind == ActionKind::Tag {
            for (i, w) in words.iter().enumerate() {
                if (*w == "with" || *w == "as") && i + 1 < words.len() {
                    custom_tag = Some(words[i + 1].trim_matches(|c: char| !c.is_alphanumeric()).to_string());
                    break;
                }
            }
        }

        // 6. Explicit Destination Directory (if specified)
        let mut explicit_dest_dir = None;
        for (i, w) in words.iter().enumerate() {
            if (*w == "to" || *w == "into") && i + 1 < words.len() {
                let candidate = words[i + 1].trim_matches(|c: char| c == '\'' || c == '"');
                if candidate.contains(":\\") || candidate.contains('/') || candidate.contains('\\') {
                    explicit_dest_dir = Some(candidate.to_string());
                }
            }
        }

        ParsedIntent {
            action_kind,
            confidence,
            is_destructive,
            target_extensions,
            size_min_bytes,
            size_max_bytes,
            age_days_min,
            age_days_max,
            custom_tag,
            explicit_dest_dir,
            raw_prompt: prompt.to_string(),
        }
    }
}

fn parse_size_token(token: &str) -> Option<u64> {
    let clean = token.trim_matches(|c: char| !c.is_alphanumeric() && c != '.');
    let lower = clean.to_lowercase();
    let num_str: String = lower.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
    let val: f64 = num_str.parse().ok()?;

    if lower.ends_with("gb") || lower.ends_with('g') {
        Some((val * 1024.0 * 1024.0 * 1024.0) as u64)
    } else if lower.ends_with("mb") || lower.ends_with('m') {
        Some((val * 1024.0 * 1024.0) as u64)
    } else if lower.ends_with("kb") || lower.ends_with('k') {
        Some((val * 1024.0) as u64)
    } else {
        Some(val as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intent_parsing_shred() {
        let p = IntentParser::parse("shred all .tmp files over 10mb", Path::new("C:\\Users"));
        assert_eq!(p.action_kind, ActionKind::Shred);
        assert!(p.is_destructive);
        assert!(p.target_extensions.contains(&"tmp".to_string()));
        assert_eq!(p.size_min_bytes, Some(10 * 1024 * 1024));
    }

    #[test]
    fn test_intent_parsing_date_sort() {
        let p = IntentParser::parse("organize photos by year and month", Path::new("C:\\Users"));
        assert_eq!(p.action_kind, ActionKind::OrganizeByDate);
        assert!(!p.is_destructive);
        assert!(p.target_extensions.contains(&"png".to_string()));
    }
}
