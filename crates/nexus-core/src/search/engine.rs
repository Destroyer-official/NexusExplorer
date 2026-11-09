//! Fast parallel filename search with streamed results.

use std::collections::HashMap;
use std::os::windows::fs::MetadataExt as _;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use parking_lot::Mutex;

use crate::models::{FileEntry, SearchEvent, SearchOptions};

/// Registry of running searches mapped to their cancellation flags.
#[derive(Clone, Default)]
pub struct SearchRegistry {
    flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl SearchRegistry {
    /// Creates an empty search registry with no active searches.
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers a running search id with its cancellation flag.
    pub fn register(&self, id: String, flag: Arc<AtomicBool>) {
        self.flags.lock().insert(id, flag);
    }

    /// Signals cancellation for the given search id; returns false when the id is unknown.
    pub fn cancel(&self, id: &str) -> bool {
        match self.flags.lock().get(id) {
            Some(flag) => {
                flag.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    }

    /// Removes and returns the cancellation flag for a finished search id.
    pub fn remove(&self, id: &str) -> Option<Arc<AtomicBool>> {
        self.flags.lock().remove(id)
    }
}

enum MatchStrategy {
    Everything,
    Substring(String),
    Extension(String),
    CompiledRegex(regex::Regex),
}

pub struct Matcher {
    strategy: MatchStrategy,
}

impl Matcher {
    pub fn new(query: &str) -> Self {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Self {
                strategy: MatchStrategy::Everything,
            };
        }

        let lowered = trimmed.to_lowercase();

        // 1. Regex query: regex:<pattern> or re:<pattern>
        if let Some(pattern) = trimmed
            .strip_prefix("regex:")
            .or_else(|| trimmed.strip_prefix("re:"))
        {
            if let Ok(re) = regex::RegexBuilder::new(pattern)
                .case_insensitive(true)
                .build()
            {
                return Self {
                    strategy: MatchStrategy::CompiledRegex(re),
                };
            }
        }

        // 2. Extension query: ext:<ext>
        if let Some(ext) = lowered.strip_prefix("ext:") {
            let clean_ext = ext.trim_start_matches('.').to_string();
            return Self {
                strategy: MatchStrategy::Extension(clean_ext),
            };
        }

        // 3. Wildcard / Glob query containing '*' or '?'
        if lowered.contains('*') || lowered.contains('?') {
            let mut pattern = String::from("^");
            for ch in lowered.chars() {
                match ch {
                    '*' => pattern.push_str(".*"),
                    '?' => pattern.push('.'),
                    '.' | '+' | '(' | ')' | '[' | ']' | '{' | '}' | '^' | '$' | '|' | '\\' => {
                        pattern.push('\\');
                        pattern.push(ch);
                    }
                    other => pattern.push(other),
                }
            }
            pattern.push('$');
            if let Ok(re) = regex::RegexBuilder::new(&pattern)
                .case_insensitive(true)
                .build()
            {
                return Self {
                    strategy: MatchStrategy::CompiledRegex(re),
                };
            }
        }

        // 4. Default: Fast case-insensitive substring
        Self {
            strategy: MatchStrategy::Substring(lowered),
        }
    }

    pub fn matches(&self, name: &str) -> bool {
        match &self.strategy {
            MatchStrategy::Everything => true,
            MatchStrategy::Substring(sub) => name.to_lowercase().contains(sub),
            MatchStrategy::Extension(target_ext) => Path::new(name)
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case(target_ext))
                .unwrap_or(false),
            MatchStrategy::CompiledRegex(re) => re.is_match(name),
        }
    }
}

fn build_entry(entry: &jwalk::DirEntry<((), ())>) -> Option<FileEntry> {
    let path = entry.path();
    let meta = entry.metadata().ok()?;
    let ft = meta.file_type();
    let name = entry.file_name().to_string_lossy().to_string();
    let parent = path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = Path::new(&name)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let attrs = meta.file_attributes();

    Some(FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        parent_path: parent,
        is_dir: ft.is_dir(),
        size: meta.len(),
        modified_ms: meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
        created_ms: meta
            .created()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
        is_hidden: attrs & 0x2 != 0,
        is_system: attrs & 0x4 != 0,
        is_readonly: meta.permissions().readonly(),
        ext,
    })
}

/// Walks `root` matching file names against `query` on the calling thread, streaming batches via `sink`.
pub fn run_search_blocking(
    root: String,
    query: String,
    opts: SearchOptions,
    cancel: Arc<AtomicBool>,
    sink: &mut dyn FnMut(SearchEvent),
) {
    let started = Instant::now();
    let root_path = std::path::PathBuf::from(&root);
    if !root_path.exists() {
        sink(SearchEvent::Error {
            message: format!("root does not exist: {root}"),
        });
        return;
    }

    let matcher = Matcher::new(&query);
    let mut walker = jwalk::WalkDir::new(&root_path).skip_hidden(!opts.include_hidden);
    if !opts.recursive {
        walker = walker.min_depth(1).max_depth(1);
    }

    const BATCH_SIZE: usize = 200;
    let max_results = opts.max_results.max(1) as u64;

    let mut batch: Vec<FileEntry> = Vec::with_capacity(BATCH_SIZE);
    let mut total: u64 = 0;
    let mut cancelled = false;

    for entry in walker.into_iter() {
        if cancel.load(Ordering::Relaxed) {
            cancelled = true;
            break;
        }
        let Ok(entry) = entry else { continue };
        if entry.depth() == 0 {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !matcher.matches(&name) {
            continue;
        }
        let Some(file_entry) = build_entry(&entry) else { continue };
        batch.push(file_entry);
        total += 1;
        if batch.len() >= BATCH_SIZE {
            sink(SearchEvent::Batch {
                entries: std::mem::take(&mut batch),
            });
            batch = Vec::with_capacity(BATCH_SIZE);
        }
        if total >= max_results {
            break;
        }
    }

    if !batch.is_empty() {
        sink(SearchEvent::Batch { entries: batch });
    }

    if cancelled {
        sink(SearchEvent::Error {
            message: "cancelled".to_string(),
        });
        return;
    }

    sink(SearchEvent::Done {
        total,
        duration_ms: started.elapsed().as_millis() as u64,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn substring_matching_is_case_insensitive() {
        let matcher = Matcher::new("report");
        assert!(matcher.matches("Q3-REPORT.pdf"));
        assert!(!matcher.matches("notes.txt"));
    }

    #[test]
    fn wildcard_matching() {
        let matcher = Matcher::new("*.pdf");
        assert!(matcher.matches("invoice.pdf"));
        assert!(!matcher.matches("invoice.txt"));
        assert!(!matcher.matches("invoice.pdf.bak"));
        let matcher = Matcher::new("nexus*2027");
        assert!(matcher.matches("nexus-explorer-2027"));
        assert!(!matcher.matches("nexus-explorer-2028"));
    }

    #[test]
    fn regex_and_glob_extensions_matching() {
        let matcher = Matcher::new("doc?.txt");
        assert!(matcher.matches("doc1.txt"));
        assert!(matcher.matches("docA.txt"));
        assert!(!matcher.matches("doc12.txt"));

        let matcher = Matcher::new("regex:^IMG_\\d{3}\\.jpg$");
        assert!(matcher.matches("IMG_101.jpg"));
        assert!(!matcher.matches("IMG_1011.jpg"));
        assert!(!matcher.matches("other.jpg"));

        let matcher = Matcher::new("ext:json");
        assert!(matcher.matches("package.json"));
        assert!(!matcher.matches("package.json.bak"));
    }

    #[test]
    fn empty_query_matches_everything() {
        assert!(Matcher::new("").matches("anything"));
    }
}
