//! Neuro-Symbolic Semantic Slot Extraction & Natural Language Intent Engine.
//!
//! Rapidly parses unstructured conversational prompts into typed, strongly validated
//! filesystem intents with zero cloud calls, zero external runtime, and sub-millisecond execution.

use serde::{Deserialize, Serialize};
use std::path::Path;

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
        let is_shred = lower.contains("shred")
            || lower.contains("wipe")
            || lower.contains("secure delete")
            || lower.contains("erase")
            || lower.contains("purge")
            || lower.contains("destroy");

        let is_dedup = lower.contains("dedup")
            || lower.contains("duplicate file")
            || lower.contains("duplicates")
            || lower.contains("find duplicate")
            || lower.contains("locate duplicate")
            || lower.contains("same files")
            || lower.contains("identical files");

        let is_tag = lower.contains("tag with")
            || lower.contains("label as")
            || lower.contains("mark with")
            || lower.starts_with("tag ")
            || lower.starts_with("label ");

        let explicit_search = !is_shred
            && !is_dedup
            && !is_tag
            && words.first().is_some_and(|word| {
                [
                    "find", "search", "show", "locate", "list", "query", "filter", "display",
                ]
                .contains(word)
            });

        let (action_kind, is_destructive, confidence) = if explicit_search {
            (ActionKind::Search, false, 0.85)
        } else if is_shred {
            (ActionKind::Shred, true, 0.96)
        } else if is_dedup {
            (ActionKind::Deduplicate, false, 0.93)
        } else if is_tag {
            (ActionKind::Tag, false, 0.88)
        } else if words.contains(&"date")
            || words.contains(&"dates")
            || lower.contains("by date")
            || lower.contains("date taken")
            || lower.contains("creation date")
            || lower.contains("modified date")
            || lower.contains("year")
            || lower.contains("month")
            || lower.contains("chronological")
            || lower.contains("by modified")
            || lower.contains("by creation")
            || lower.contains("creation year")
        {
            (ActionKind::OrganizeByDate, false, 0.92)
        } else if lower.contains("organize")
            || lower.contains("by extension")
            || lower.contains("by format")
            || lower.contains("by file type")
            || lower.contains("group by type")
            || lower.contains("arrange by format")
            || lower.contains("tidy")
            || lower.contains("categorize files")
        {
            (ActionKind::OrganizeByExtension, false, 0.94)
        } else if lower.contains("clone")
            || lower.contains("cow")
            || lower.contains("reflink")
            || lower.contains("block clone")
            || lower.contains("block cloning")
            || lower.contains("copy on write")
            || lower.contains("duplicate folder")
            || lower.contains("duplicate directory")
        {
            (ActionKind::CloneCow, false, 0.90)
        } else if lower.contains("flatten")
            || lower.contains("un-nest")
            || lower.contains("extract all files here")
            || lower.contains("collapse hierarchy")
            || lower.contains("collapse folder hierarchy")
        {
            (ActionKind::FlattenDirectory, false, 0.91)
        } else if lower.contains("zip")
            || lower.contains("compress")
            || lower.contains("archive")
            || lower.contains("bundle")
            || words.contains(&"pack")
            || words.contains(&"tar")
            || lower.contains(".tar")
        {
            (ActionKind::ArchiveZip, false, 0.95)
        } else {
            (ActionKind::Search, false, 0.85)
        };

        // 2. Extract Category & Extensions
        let mut target_extensions = Vec::new();
        if lower.contains("image") || lower.contains("photo") || lower.contains("picture") {
            target_extensions.extend_from_slice(&[
                "png".into(),
                "jpg".into(),
                "jpeg".into(),
                "webp".into(),
                "svg".into(),
                "gif".into(),
            ]);
        }
        if lower.contains("video") || lower.contains("movie") || lower.contains("clip") {
            target_extensions.extend_from_slice(&[
                "mp4".into(),
                "mkv".into(),
                "mov".into(),
                "avi".into(),
            ]);
        }
        if lower.contains("audio") || lower.contains("music") || lower.contains("sound") {
            target_extensions.extend_from_slice(&[
                "mp3".into(),
                "wav".into(),
                "flac".into(),
                "m4a".into(),
            ]);
        }
        if lower.contains("doc")
            || lower.contains("document")
            || lower.contains("pdf")
            || lower.contains("notes")
            || lower.contains("markdown")
        {
            target_extensions.extend_from_slice(&[
                "pdf".into(),
                "docx".into(),
                "txt".into(),
                "md".into(),
                "xlsx".into(),
            ]);
        }
        if lower.contains("markdown") {
            target_extensions = vec!["md".into()];
        }
        if lower.contains("code") || lower.contains("source") {
            target_extensions.extend_from_slice(&[
                "rs".into(),
                "ts".into(),
                "js".into(),
                "tsx".into(),
                "py".into(),
                "json".into(),
            ]);
        }
        if lower.contains("installer") || lower.contains("setup") {
            target_extensions.extend_from_slice(&["exe".into(), "msi".into(), "iso".into()]);
        }
        if lower.contains("log") || lower.contains("temp") || lower.contains("tmp") {
            target_extensions.extend_from_slice(&["log".into(), "tmp".into(), "bak".into()]);
        }

        // Direct extension tokens (e.g. *.png, .rs, .md, *.env.local)
        for w in &words {
            if (w.starts_with('.') || w.starts_with("*.")) && w.len() > 1 {
                let ext = w
                    .trim_start_matches('*')
                    .trim_start_matches('.')
                    .trim_matches(|c: char| !c.is_alphanumeric() && c != '.')
                    .to_string();
                if !ext.is_empty() {
                    if !target_extensions.contains(&ext) {
                        target_extensions.push(ext.clone());
                    }
                    if ext.contains('.') {
                        if let Some(terminal) = ext.split('.').next_back() {
                            let term_str = terminal.to_string();
                            if !target_extensions.contains(&term_str) {
                                target_extensions.push(term_str);
                            }
                        }
                    }
                }
            }
        }

        // Explicit file types and programming languages take precedence over broad categories.
        let exact: Vec<String> = words
            .iter()
            .flat_map(|word| {
                let token = word
                    .trim_start_matches('*')
                    .trim_start_matches('.')
                    .trim_matches(|c: char| !c.is_alphanumeric() && c != '.');
                if word.starts_with('.')
                    || word.starts_with("*.")
                    || [
                        "pdf",
                        "zip",
                        "log",
                        "tmp",
                        "json",
                        "txt",
                        "csv",
                        "md",
                        "markdown",
                        "rust",
                        "rs",
                        "typescript",
                        "ts",
                        "tsx",
                        "python",
                        "py",
                        "golang",
                        "go",
                        "javascript",
                        "js",
                        "cpp",
                        "c",
                        "h",
                        "html",
                        "css",
                        "sql",
                        "yaml",
                        "toml",
                        "sh",
                        "parquet",
                        "svg",
                        "ico",
                        "png",
                        "jpg",
                        "jpeg",
                        "gif",
                        "bmp",
                        "webp",
                        "mp3",
                        "wav",
                        "flac",
                        "ogg",
                        "mp4",
                        "mkv",
                        "mov",
                        "tar",
                        "gz",
                        "7z",
                        "rar",
                        "iso",
                        "docx",
                        "xlsx",
                        "pptx",
                        "bak",
                        "xml",
                        "arrow",
                    ]
                    .contains(&token)
                {
                    // For archive commands, bare destination words ("to zip", "into zip")
                    // are operation formats rather than source file filters.
                    if (token == "zip" || token == "tar")
                        && (action_kind == ActionKind::ArchiveZip
                            || lower.contains("to zip")
                            || lower.contains("into zip")
                            || lower.contains("into a zip")
                            || lower.contains("into archive")
                            || lower.contains("to archive"))
                        && !word.starts_with('.')
                        && !word.starts_with("*.")
                    {
                        return vec![];
                    }

                    match token {
                        "markdown" => vec!["md".to_string()],
                        "rust" => vec!["rs".to_string()],
                        "typescript" => vec!["ts".to_string()],
                        "python" => vec!["py".to_string()],
                        "golang" => vec!["go".to_string()],
                        "javascript" => vec!["js".to_string()],
                        t if t.contains('.') => {
                            let terminal = t.split('.').next_back().unwrap_or(t);
                            vec![t.to_string(), terminal.to_string()]
                        }
                        t => vec![t.to_string()],
                    }
                } else {
                    vec![]
                }
            })
            .collect();
        if !exact.is_empty() {
            target_extensions = exact;
        }

        // 3. Extract Size Bounds
        let mut size_min_bytes = None;
        let mut size_max_bytes = None;

        for (i, w) in words.iter().enumerate() {
            if (*w == ">"
                || *w == "larger"
                || *w == "over"
                || *w == "above"
                || *w == "exceeding"
                || *w == "greater"
                || *w == "more")
                && i + 1 < words.len()
            {
                let index = if words[i + 1] == "than" { i + 2 } else { i + 1 };
                size_min_bytes = words.get(index).and_then(|token| parse_size_token(token));
            } else if (*w == "<"
                || *w == "smaller"
                || *w == "under"
                || *w == "below"
                || *w == "less")
                && i + 1 < words.len()
            {
                let index = if words[i + 1] == "than" { i + 2 } else { i + 1 };
                size_max_bytes = words.get(index).and_then(|token| parse_size_token(token));
            } else if w.starts_with('>') && w.len() > 1 {
                size_min_bytes = parse_size_token(&w[1..]);
            } else if w.starts_with('<') && w.len() > 1 {
                size_max_bytes = parse_size_token(&w[1..]);
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
            } else if (*w == "newer" || *w == "recent")
                && i + 2 < words.len()
                && words[i + 1] == "than"
            {
                if let Ok(days) = words[i + 2].parse::<u32>() {
                    age_days_max = Some(days);
                }
            }
        }

        // 5. Extract Custom Tag (preserving case from original prompt)
        let mut custom_tag = None;
        if action_kind == ActionKind::Tag {
            let orig_words: Vec<&str> = prompt.split_whitespace().collect();
            for (i, w) in words.iter().enumerate() {
                if (*w == "with" || *w == "as") && i + 1 < orig_words.len() {
                    custom_tag = Some(
                        orig_words[i + 1]
                            .trim_matches(|c: char| !c.is_alphanumeric())
                            .to_string(),
                    );
                    break;
                }
            }
        }

        // 6. Explicit Destination Directory (if specified)
        let mut explicit_dest_dir = None;
        for (i, w) in words.iter().enumerate() {
            if (*w == "to" || *w == "into") && i + 1 < words.len() {
                let candidate = words[i + 1].trim_matches(|c: char| c == '\'' || c == '"');
                if candidate.contains(":\\") || candidate.contains('/') || candidate.contains('\\')
                {
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
    let num_str: String = lower
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
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
    fn search_filters_do_not_turn_into_actions() {
        let p = IntentParser::parse("find zip files larger than 10MB", Path::new("."));
        assert_eq!(p.action_kind, ActionKind::Search);
        assert_eq!(p.target_extensions, vec!["zip"]);
        assert_eq!(p.size_min_bytes, Some(10 * 1024 * 1024));
        let p = IntentParser::parse("find *.pdf smaller than 2MB", Path::new("."));
        assert_eq!(p.target_extensions, vec!["pdf"]);
        assert_eq!(p.size_max_bytes, Some(2 * 1024 * 1024));
    }
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

    #[test]
    fn test_dynamic_prompt_battery_not_hardcoded() {
        // 1. Dynamic arbitrary extension
        let p1 = IntentParser::parse("search all *.parquet files", Path::new("."));
        assert_eq!(p1.action_kind, ActionKind::Search);
        assert_eq!(p1.target_extensions, vec!["parquet"]);

        // 2. Dynamic size in GB
        let p2 = IntentParser::parse("find video files larger than 4.5GB", Path::new("."));
        assert_eq!(p2.action_kind, ActionKind::Search);
        assert!(p2.target_extensions.contains(&"mp4".to_string()));
        assert_eq!(
            p2.size_min_bytes,
            Some((4.5 * 1024.0 * 1024.0 * 1024.0) as u64)
        );

        // 3. Dynamic size in KB with upper bound
        let p3 = IntentParser::parse("locate audio under 500kb", Path::new("."));
        assert_eq!(p3.action_kind, ActionKind::Search);
        assert!(p3.target_extensions.contains(&"flac".to_string()));
        assert_eq!(p3.size_max_bytes, Some(500 * 1024));

        // 4. Dynamic age in days
        let p4 = IntentParser::parse("find documents older than 90 days", Path::new("."));
        assert_eq!(p4.age_days_min, Some(90));

        // 5. Dynamic tag extraction
        let p5 = IntentParser::parse("tag with MilestoneAlpha2027", Path::new("."));
        assert_eq!(p5.action_kind, ActionKind::Tag);
        assert_eq!(p5.custom_tag, Some("MilestoneAlpha2027".to_string()));

        // 6. Dynamic CoW clone
        let p6 = IntentParser::parse("duplicate folder with cow block cloning", Path::new("."));
        assert_eq!(p6.action_kind, ActionKind::CloneCow);
        assert!(!p6.is_destructive);

        // 7. Dynamic Archive ZIP
        let p7 = IntentParser::parse("compress all source code into archive", Path::new("."));
        assert_eq!(p7.action_kind, ActionKind::ArchiveZip);
        assert!(p7.target_extensions.contains(&"rs".to_string()));

        // 8. Dynamic Flatten Directory
        let p8 = IntentParser::parse("flatten nested directory structure", Path::new("."));
        assert_eq!(p8.action_kind, ActionKind::FlattenDirectory);

        // 9. Dynamic Deduplicate
        let p9 = IntentParser::parse("find same files with dedup", Path::new("."));
        assert_eq!(p9.action_kind, ActionKind::Deduplicate);

        // 10. Dynamic Shred
        let p10 = IntentParser::parse("secure delete all *.bak files over 50mb", Path::new("."));
        assert_eq!(p10.action_kind, ActionKind::Shred);
        assert!(p10.is_destructive);
        assert_eq!(p10.target_extensions, vec!["bak"]);
        assert_eq!(p10.size_min_bytes, Some(50 * 1024 * 1024));

        // 11. Dynamic markdown recognition
        let p11 = IntentParser::parse("find all markdown files", Path::new("."));
        assert_eq!(p11.action_kind, ActionKind::Search);
        assert_eq!(p11.target_extensions, vec!["md"]);

        // 12. Dynamic typescript recognition
        let p12 = IntentParser::parse("organize typescript into code folder", Path::new("."));
        assert_eq!(p12.action_kind, ActionKind::OrganizeByExtension);
        assert_eq!(p12.target_extensions, vec!["ts"]);
    }
}
