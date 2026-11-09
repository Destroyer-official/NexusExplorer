//! Multi-threaded in-file text and regex content search engine.

use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentMatch {
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_text: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchReport {
    pub total_matches: usize,
    pub files_searched: usize,
    pub matches: Vec<ContentMatch>,
    pub elapsed_ms: u64,
}

pub fn is_binary_buffer(buf: &[u8]) -> bool {
    buf.iter().take(1024).any(|&b| b == 0)
}

fn is_binary_header(path: &Path) -> bool {
    if let Ok(mut f) = File::open(path) {
        let mut buf = [0u8; 1024];
        if let Ok(n) = f.read(&mut buf) {
            return is_binary_buffer(&buf[..n]);
        }
    }
    true
}

pub fn search_in_file(
    path: &Path,
    matcher: &Regex,
    max_matches_per_file: usize,
) -> Vec<ContentMatch> {
    let mut matches = Vec::new();
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return matches,
    };

    let filename = path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
    let reader = BufReader::new(file);

    for (idx, line_res) in reader.lines().enumerate() {
        if matches.len() >= max_matches_per_file {
            break;
        }

        if let Ok(line) = line_res {
            if let Some(mat) = matcher.find(&line) {
                matches.push(ContentMatch {
                    file_path: path.to_string_lossy().to_string(),
                    file_name: filename.clone(),
                    line_number: idx + 1,
                    line_text: line.chars().take(240).collect(),
                    match_start: mat.start(),
                    match_end: mat.end(),
                });
            }
        }
    }

    matches
}

pub fn search_content<F>(
    root: &str,
    pattern: &str,
    is_regex: bool,
    case_sensitive: bool,
    max_total_matches: usize,
    cancel_flag: Option<&AtomicBool>,
    mut on_match_found: F,
) -> Result<ContentSearchReport, String>
where
    F: FnMut(&ContentMatch),
{
    let started = std::time::Instant::now();
    let escaped = if is_regex {
        pattern.to_string()
    } else {
        regex::escape(pattern)
    };

    let regex_pattern = if case_sensitive {
        escaped
    } else {
        format!("(?i){escaped}")
    };

    let matcher = Regex::new(&regex_pattern).map_err(|e| format!("invalid regex: {e}"))?;

    let mut all_matches = Vec::new();
    let mut files_searched = 0;

    for entry in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if let Some(cancel) = cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                break;
            }
        }

        if all_matches.len() >= max_total_matches {
            break;
        }

        if entry.file_type().is_file() {
            let p = entry.path();
            // Skip large files (> 50 MB) and binaries
            if let Ok(meta) = p.metadata() {
                if meta.len() > 50 * 1024 * 1024 || is_binary_header(p) {
                    continue;
                }
            }

            files_searched += 1;
            let file_matches = search_in_file(p, &matcher, 50);
            for m in file_matches {
                on_match_found(&m);
                all_matches.push(m);
                if all_matches.len() >= max_total_matches {
                    break;
                }
            }
        }
    }

    Ok(ContentSearchReport {
        total_matches: all_matches.len(),
        files_searched,
        matches: all_matches,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_content_search_text() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = dir.path().join("code.rs");
        File::create(&f1).unwrap().write_all(b"fn main() {\n    let nexus = 42;\n}\n").unwrap();

        let report = search_content(dir.path().to_str().unwrap(), "nexus", false, false, 10, None, |_| {}).unwrap();
        assert_eq!(report.total_matches, 1);
        assert_eq!(report.matches[0].line_number, 2);
    }
}

