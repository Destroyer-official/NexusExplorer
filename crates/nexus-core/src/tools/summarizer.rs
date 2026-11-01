//! AI Document Summarization & Structure Extractor (100% Rust).
//!
//! Provides statistical & semantic extractive summarization, document outline parsing,
//! code symbol discovery, and reading metrics with zero external cloud runtime dependencies.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineNode {
    pub title: String,
    pub kind: String, // "heading-1", "heading-2", "heading-3", "function", "class", "struct", "interface", "enum"
    pub line_number: usize,
    pub level: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    pub file_path: String,
    pub total_words: usize,
    pub total_lines: usize,
    pub total_chars: usize,
    pub reading_time_seconds: u32,
    pub summary_bullets: Vec<String>,
    pub key_topics: Vec<String>,
    pub outline: Vec<OutlineNode>,
    pub detected_type: String, // "markdown", "code", "text", "config"
}

const STOPWORDS: &[&str] = &[
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't",
    "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have",
    "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
    "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into",
    "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
    "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's",
    "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs",
    "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
    "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's",
    "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't",
    "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself",
    "yourselves", "return", "true", "false", "null", "none", "import", "from", "export", "pub", "fn",
    "const", "let", "var", "function", "class", "def", "self", "this",
];

/// Summarizes a text or code document on disk.
pub fn summarize_file(file_path: &Path, max_bullets: usize) -> Result<DocumentSummary, String> {
    let bytes = fs::read(file_path).map_err(|e| format!("cannot read file: {e}"))?;
    if crate::tools::content_search::is_binary_buffer(&bytes) {
        return Err("cannot summarize binary file".into());
    }

    let content = String::from_utf8_lossy(&bytes).to_string();
    let ext = file_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    Ok(summarize_content(&content, &ext, file_path.to_string_lossy().as_ref(), max_bullets))
}

/// Core summarization engine operating on string content.
pub fn summarize_content(content: &str, ext: &str, file_name: &str, max_bullets: usize) -> DocumentSummary {
    let lines: Vec<&str> = content.lines().collect();
    let total_lines = lines.len();
    let total_chars = content.chars().count();

    // Word tokenization
    let words: Vec<&str> = content
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()))
        .filter(|w| !w.is_empty())
        .collect();
    let total_words = words.len();

    // Reading time: standard adult reading speed ~220 wpm = ~3.66 words/sec
    let reading_time_seconds = ((total_words as f32 / 3.66).ceil() as u32).max(5);

    let stop_set: HashSet<&str> = STOPWORDS.iter().copied().collect();

    // Term frequency
    let mut term_freq: HashMap<String, usize> = HashMap::new();
    for word in &words {
        let lower = word.to_lowercase();
        if lower.len() >= 3 && !stop_set.contains(lower.as_str()) && !lower.chars().all(|c| c.is_ascii_digit()) {
            *term_freq.entry(lower).or_insert(0) += 1;
        }
    }

    // Extract top topics (most frequent non-stopwords)
    let mut sorted_terms: Vec<(String, usize)> = term_freq.into_iter().collect();
    sorted_terms.sort_by_key(|a| std::cmp::Reverse(a.1));
    let key_topics: Vec<String> = sorted_terms
        .into_iter()
        .take(8)
        .map(|(term, _)| term)
        .collect();

    // Determine detected type & outline
    let (detected_type, outline) = extract_outline(&lines, ext);

    // Sentence extraction & scoring
    let summary_bullets = extract_key_sentences(content, &lines, &key_topics, max_bullets, &detected_type);

    DocumentSummary {
        file_path: file_name.to_string(),
        total_words,
        total_lines,
        total_chars,
        reading_time_seconds,
        summary_bullets,
        key_topics,
        outline,
        detected_type,
    }
}

fn extract_outline(lines: &[&str], ext: &str) -> (String, Vec<OutlineNode>) {
    let mut outline = Vec::new();

    let is_markdown = ext == "md" || ext == "markdown";
    let is_code = matches!(
        ext,
        "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "go" | "c" | "cpp" | "h" | "hpp" | "java" | "cs"
    );
    let is_config = matches!(ext, "json" | "toml" | "yaml" | "yml" | "ini" | "env");

    let detected_type = if is_markdown {
        "markdown"
    } else if is_code {
        "code"
    } else if is_config {
        "config"
    } else {
        "text"
    };

    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        let line_number = idx + 1;

        if is_markdown {
            if let Some(rest) = trimmed.strip_prefix("### ") {
                outline.push(OutlineNode {
                    title: rest.trim().to_string(),
                    kind: "heading-3".into(),
                    line_number,
                    level: 3,
                });
            } else if let Some(rest) = trimmed.strip_prefix("## ") {
                outline.push(OutlineNode {
                    title: rest.trim().to_string(),
                    kind: "heading-2".into(),
                    line_number,
                    level: 2,
                });
            } else if let Some(rest) = trimmed.strip_prefix("# ") {
                outline.push(OutlineNode {
                    title: rest.trim().to_string(),
                    kind: "heading-1".into(),
                    line_number,
                    level: 1,
                });
            }
        } else if is_code {
            if trimmed.starts_with("//") || trimmed.starts_with('#') || trimmed.starts_with("/*") {
                continue;
            }

            // Function detection
            if trimmed.contains("fn ") || trimmed.starts_with("def ") || trimmed.contains("function ") || trimmed.contains("=>") {
                if let Some(name) = extract_symbol_name(trimmed, &["fn ", "def ", "function "]) {
                    outline.push(OutlineNode {
                        title: name,
                        kind: "function".into(),
                        line_number,
                        level: 2,
                    });
                }
            } else if trimmed.contains("struct ") || trimmed.contains("class ") || trimmed.contains("interface ") || trimmed.contains("enum ") {
                if let Some(name) = extract_symbol_name(trimmed, &["struct ", "class ", "interface ", "enum ", "type "]) {
                    outline.push(OutlineNode {
                        title: name,
                        kind: "type".into(),
                        line_number,
                        level: 1,
                    });
                }
            }
        }
    }

    (detected_type.into(), outline)
}

fn extract_symbol_name(line: &str, keywords: &[&str]) -> Option<String> {
    for kw in keywords {
        if let Some(pos) = line.find(kw) {
            let after = &line[pos + kw.len()..];
            let name: String = after
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '_')
                .collect();
            if !name.is_empty() {
                return Some(format!("{} {name}", kw.trim()));
            }
        }
    }
    None
}

fn extract_key_sentences(
    content: &str,
    lines: &[&str],
    key_topics: &[String],
    max_bullets: usize,
    detected_type: &str,
) -> Vec<String> {
    let mut candidate_sentences: Vec<(usize, String, f32)> = Vec::new();

    if detected_type == "code" {
        // For code, pull top-level comments and docstrings
        for (idx, line) in lines.iter().enumerate() {
            let trimmed = line.trim();
            if trimmed.starts_with("//!") || trimmed.starts_with("///") || trimmed.starts_with("\"\"\"") {
                let clean = trimmed
                    .trim_start_matches(['/', '!', '"', ' '])
                    .trim();
                if clean.len() > 15 {
                    candidate_sentences.push((idx, clean.to_string(), 10.0));
                }
            }
        }
    }

    // Split prose into sentences
    if candidate_sentences.is_empty() {
        let raw_sentences: Vec<&str> = content
            .split(['.', '!', '?', '\n'])
            .map(|s| s.trim())
            .filter(|s| s.len() >= 25 && s.len() <= 280 && !s.starts_with('#') && !s.starts_with("import"))
            .collect();

        for (idx, s) in raw_sentences.iter().enumerate() {
            let mut score: f32 = 1.0;
            let lower = s.to_lowercase();

            // Topic overlap bonus
            for topic in key_topics {
                if lower.contains(topic) {
                    score += 2.5;
                }
            }

            // Early sentence bonus
            if idx < 5 {
                score += 2.0;
            }

            // Length sweet spot (50 - 150 chars)
            if s.len() >= 45 && s.len() <= 160 {
                score += 1.5;
            }

            candidate_sentences.push((idx, s.to_string(), score));
        }
    }

    // Sort by score descending
    candidate_sentences.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    // Take top max_bullets and sort back by original document appearance
    let mut selected: Vec<(usize, String)> = candidate_sentences
        .into_iter()
        .take(max_bullets.clamp(1, 8))
        .map(|(idx, s, _)| (idx, s))
        .collect();

    selected.sort_by_key(|(idx, _)| *idx);

    selected.into_iter().map(|(_, s)| s).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_summarize_markdown() {
        let markdown = r#"
# Nexus Intelligent Workspace

NexusExplorer is a high-performance modern desktop file manager built in pure Rust.
It offers instantaneous directory traversal and zero-knowledge encrypted vaults.

## Key Capabilities

The system features real-time USN Journal watching and CoW block extent cloning.
Users can seamlessly browse files with dual panes and staging shelves.
Cryptographic security is ensured with AES-256-GCM authenticated encryption.
"#;
        let summary = summarize_content(markdown, "md", "README.md", 3);
        assert_eq!(summary.detected_type, "markdown");
        assert_eq!(summary.outline.len(), 2);
        assert_eq!(summary.outline[0].title, "Nexus Intelligent Workspace");
        assert_eq!(summary.outline[1].title, "Key Capabilities");
        assert!(!summary.summary_bullets.is_empty());
        assert!(!summary.key_topics.is_empty());
        assert!(summary.total_words > 20);
    }

    #[test]
    fn test_summarize_rust_code() {
        let code = r#"
//! Core hashing engine for NexusExplorer.
//! Provides XXH3 streaming checksums.

pub struct FastHasher {
    state: u64,
}

impl FastHasher {
    pub fn new() -> Self {
        Self { state: 0 }
    }

    pub fn compute(&self) -> u64 {
        self.state
    }
}
"#;
        let summary = summarize_content(code, "rs", "hasher.rs", 3);
        assert_eq!(summary.detected_type, "code");
        assert!(!summary.outline.is_empty());
        assert!(summary.outline.iter().any(|o| o.title.contains("FastHasher")));
        assert!(summary.outline.iter().any(|o| o.title.contains("new")));
    }
}

