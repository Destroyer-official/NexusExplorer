//! Local Semantic Embeddings & Natural Language Vector Search (100% Rust).
//!
//! Provides dense semantic projection vectors, subword n-gram hashing,
//! cosine similarity ranking, and persistent directory indexing with zero external AI runtimes.

use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use serde::{Deserialize, Serialize};
use xxhash_rust::xxh3::xxh3_64;

pub const VECTOR_DIM: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticDocument {
    pub file_path: String,
    pub rel_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub modified_ms: u64,
    pub snippet: String,
    pub vector: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticMatch {
    pub file_path: String,
    pub rel_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub score: f32, // 0.0 to 1.0
    pub snippet: String,
    pub matched_terms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SemanticIndex {
    pub root_dir: String,
    pub version: u32,
    pub total_documents: usize,
    pub updated_at_ms: u64,
    pub documents: Vec<SemanticDocument>,
}

/// Generates a normalized semantic projection vector (dimension 256) from text content.
pub fn generate_semantic_vector(text: &str) -> Vec<f32> {
    let mut vec = vec![0.0f32; VECTOR_DIM];
    if text.trim().is_empty() {
        return vec;
    }

    let words: Vec<&str> = text
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()))
        .filter(|w| !w.is_empty())
        .collect();

    if words.is_empty() {
        return vec;
    }

    // 1. Word token hashing with length weighting
    for word in &words {
        let lower = word.to_lowercase();
        let h = xxh3_64(lower.as_bytes());
        let dim = (h as usize) % VECTOR_DIM;
        let sign = if (h >> 32) & 1 == 0 { 1.0f32 } else { -1.0f32 };
        let weight = (lower.len() as f32).min(12.0) / 4.0;
        vec[dim] += sign * weight;

        // 2. Subword 3-grams for morphological and typo tolerance
        if lower.len() >= 4 {
            let chars: Vec<char> = lower.chars().collect();
            for window in chars.windows(3) {
                let ngram: String = window.iter().collect();
                let nh = xxh3_64(ngram.as_bytes());
                let ndim = (nh as usize) % VECTOR_DIM;
                let nsign = if (nh >> 32) & 1 == 0 { 1.0f32 } else { -1.0f32 };
                vec[ndim] += nsign * 0.45;
            }
        }
    }

    // L2 Normalize
    let norm_sq: f32 = vec.iter().map(|v| v * v).sum();
    if norm_sq > 0.0 {
        let norm = norm_sq.sqrt();
        for v in &mut vec {
            *v /= norm;
        }
    }

    vec
}

/// Computes cosine similarity between two normalized vectors (-1.0 to 1.0, clamped to 0.0 - 1.0).
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    dot.clamp(0.0, 1.0)
}

/// Indexes a directory and builds a persistent semantic index.
pub fn build_semantic_index(root_dir: &Path, max_files: usize) -> Result<SemanticIndex, String> {
    if !root_dir.is_dir() {
        return Err("provided path is not a directory".into());
    }

    let mut documents = Vec::new();
    let walker = jwalk::WalkDir::new(root_dir)
        .skip_hidden(false)
        .follow_links(false)
        .max_depth(8);

    let supported_exts: HashSet<&str> = [
        "txt", "md", "markdown", "rs", "ts", "tsx", "js", "jsx", "py", "json", "toml",
        "yaml", "yml", "html", "css", "sql", "sh", "bat", "ps1", "c", "cpp", "h", "go",
    ]
    .iter()
    .copied()
    .collect();

    for entry_res in walker {
        if documents.len() >= max_files {
            break;
        }
        let entry = match entry_res {
            Ok(e) => e,
            Err(_) => continue,
        };

        if !entry.file_type.is_file() {
            continue;
        }

        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !supported_exts.contains(ext.as_str()) {
            continue;
        }

        // Avoid indexing huge files (> 2MB)
        let metadata = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if metadata.len() > 2 * 1024 * 1024 {
            continue;
        }

        // Read up to 64KB for embedding
        let mut f = match File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let mut buf = Vec::new();
        let _ = f.by_ref().take(65536).read_to_end(&mut buf);

        if crate::tools::content_search::is_binary_buffer(&buf) {
            continue;
        }

        let text = String::from_utf8_lossy(&buf);
        let vector = generate_semantic_vector(&text);

        let rel_path = path
            .strip_prefix(root_dir)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        let snippet: String = text
            .lines()
            .take(4)
            .collect::<Vec<&str>>()
            .join(" ")
            .chars()
            .take(240)
            .collect();

        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        documents.push(SemanticDocument {
            file_path: path.to_string_lossy().to_string(),
            rel_path,
            file_name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
            file_size: metadata.len(),
            modified_ms,
            snippet,
            vector,
        });
    }

    let total = documents.len();
    let index = SemanticIndex {
        root_dir: root_dir.to_string_lossy().to_string(),
        version: 1,
        total_documents: total,
        updated_at_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
        documents,
    };

    // Save index to `.nexus/semantic_index.json`
    let nexus_dir = root_dir.join(".nexus");
    let _ = fs::create_dir_all(&nexus_dir);
    let index_file = nexus_dir.join("semantic_index.json");
    if let Ok(data) = serde_json::to_string(&index) {
        let _ = fs::write(index_file, data);
    }

    Ok(index)
}

/// Searches an existing index or builds one on the fly, ranking matches by semantic similarity.
pub fn search_semantic(
    root_dir: &Path,
    query: &str,
    limit: usize,
) -> Result<Vec<SemanticMatch>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    // Try loading cached index first
    let index_file = root_dir.join(".nexus").join("semantic_index.json");
    let index = if index_file.exists() {
        if let Ok(content) = fs::read_to_string(&index_file) {
            serde_json::from_str::<SemanticIndex>(&content)
                .unwrap_or_else(|_| build_semantic_index(root_dir, 500).unwrap_or_default())
        } else {
            build_semantic_index(root_dir, 500)?
        }
    } else {
        build_semantic_index(root_dir, 500)?
    };

    let query_vector = generate_semantic_vector(query);
    let query_words: Vec<String> = query
        .split_whitespace()
        .map(|w| w.to_lowercase())
        .collect();

    let mut matches = Vec::new();

    for doc in &index.documents {
        let mut sim = cosine_similarity(&query_vector, &doc.vector);

        // Filename exact/partial match bonus
        let doc_name_lower = doc.file_name.to_lowercase();
        for q in &query_words {
            if doc_name_lower.contains(q) {
                sim = (sim + 0.25).min(1.0);
            }
        }

        // Only include reasonably relevant documents
        if sim >= 0.12 {
            let matched_terms: Vec<String> = query_words
                .iter()
                .filter(|q| doc.snippet.to_lowercase().contains(q.as_str()) || doc_name_lower.contains(q.as_str()))
                .cloned()
                .collect();

            matches.push(SemanticMatch {
                file_path: doc.file_path.clone(),
                rel_path: doc.rel_path.clone(),
                file_name: doc.file_name.clone(),
                file_size: doc.file_size,
                score: (sim * 100.0).round() / 100.0,
                snippet: doc.snippet.clone(),
                matched_terms,
            });
        }
    }

    // Sort by score descending
    matches.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    matches.truncate(limit.max(1));

    Ok(matches)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semantic_vector_generation_and_cosine() {
        let v1 = generate_semantic_vector("high performance rust file explorer with fast scanning");
        let v2 = generate_semantic_vector("rust high-speed directory scanner and file manager");
        let v3 = generate_semantic_vector("chocolate chip cookie baking recipe vanilla sugar");

        assert_eq!(v1.len(), VECTOR_DIM);
        assert_eq!(v2.len(), VECTOR_DIM);
        assert_eq!(v3.len(), VECTOR_DIM);

        let sim_related = cosine_similarity(&v1, &v2);
        let sim_unrelated = cosine_similarity(&v1, &v3);

        assert!(sim_related > sim_unrelated, "sim_related ({}) should be > sim_unrelated ({})", sim_related, sim_unrelated);
        assert!(sim_related > 0.10, "related concepts should have positive similarity");
    }

    #[test]
    fn test_search_semantic_in_temp() {
        let temp = tempfile::tempdir().unwrap();
        let path1 = temp.path().join("database_migration.sql");
        let path2 = temp.path().join("styles.css");

        fs::write(&path1, "CREATE TABLE users (id SERIAL PRIMARY KEY, username VARCHAR(50), email TEXT);").unwrap();
        fs::write(&path2, "body { background-color: #121212; color: #ffffff; font-family: sans-serif; }").unwrap();

        let index = build_semantic_index(temp.path(), 50).unwrap();
        assert_eq!(index.total_documents, 2);

        let results = search_semantic(temp.path(), "user database table schema", 5).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].file_name, "database_migration.sql");
    }
}
