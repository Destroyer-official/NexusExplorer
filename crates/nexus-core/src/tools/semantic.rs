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
    let walker = walkdir::WalkDir::new(root_dir)
        .max_depth(8)
        .follow_links(false);

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

        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path().to_path_buf();
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

/// Hybrid BM25 Lexical + Dense Semantic Vector Search with Reciprocal Rank Fusion (RRF).
/// Combines exact keyword recall from BM25 with conceptual semantic comprehension from dense 256-dim vectors.
pub fn search_semantic_hybrid(
    root_dir: &Path,
    query: &str,
    limit: usize,
) -> Result<Vec<SemanticMatch>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

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

    if index.documents.is_empty() {
        return Ok(Vec::new());
    }

    let query_vector = generate_semantic_vector(query);
    let query_words: Vec<String> = query
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase())
        .filter(|w| !w.is_empty())
        .collect();

    // 1. Calculate document frequencies for BM25
    let mut doc_freqs: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut doc_word_counts: Vec<usize> = Vec::with_capacity(index.documents.len());
    let mut total_words = 0usize;

    for doc in &index.documents {
        let snippet_lower = doc.snippet.to_lowercase();
        let name_lower = doc.file_name.to_lowercase();
        let combined = format!("{name_lower} {snippet_lower}");
        let tokens: HashSet<String> = combined
            .split_whitespace()
            .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
            .filter(|w| !w.is_empty())
            .collect();

        for term in &query_words {
            if tokens.contains(term) {
                *doc_freqs.entry(term.clone()).or_insert(0) += 1;
            }
        }

        let words_count = tokens.len().max(1);
        total_words += words_count;
        doc_word_counts.push(words_count);
    }

    let avgdl = (total_words as f32) / (index.documents.len() as f32).max(1.0);
    let n_docs = index.documents.len() as f32;
    let k1: f32 = 1.2;
    let b: f32 = 0.75;

    // 2. Compute BM25 scores and Dense Cosine scores for each document
    let mut bm25_scores: Vec<(usize, f32)> = Vec::with_capacity(index.documents.len());
    let mut dense_scores: Vec<(usize, f32)> = Vec::with_capacity(index.documents.len());

    for (idx, doc) in index.documents.iter().enumerate() {
        let snippet_lower = doc.snippet.to_lowercase();
        let name_lower = doc.file_name.to_lowercase();
        let combined = format!("{name_lower} {snippet_lower}");
        let tokens: Vec<String> = combined
            .split_whitespace()
            .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()).to_string())
            .collect();

        let mut bm25 = 0.0f32;
        let dl = doc_word_counts[idx] as f32;

        for term in &query_words {
            let df = *doc_freqs.get(term).unwrap_or(&0) as f32;
            let idf = ((n_docs - df + 0.5) / (df + 0.5) + 1.0).ln().max(0.0);
            let tf = tokens.iter().filter(|&t| t == term).count() as f32;
            if tf > 0.0 {
                let num = tf * (k1 + 1.0);
                let den = tf + k1 * (1.0 - b + b * (dl / avgdl));
                bm25 += idf * (num / den);
            }
        }

        // Filename match boost
        for term in &query_words {
            if name_lower.contains(term) {
                bm25 += 1.5;
            }
        }

        bm25_scores.push((idx, bm25));

        // Dense Semantic Cosine Similarity
        let cos_sim = cosine_similarity(&query_vector, &doc.vector);
        dense_scores.push((idx, cos_sim));
    }

    // 3. Rank both sets descending
    bm25_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    dense_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut bm25_ranks: std::collections::HashMap<usize, usize> = std::collections::HashMap::new();
    for (rank, (idx, _)) in bm25_scores.iter().enumerate() {
        bm25_ranks.insert(*idx, rank);
    }

    let mut dense_ranks: std::collections::HashMap<usize, usize> = std::collections::HashMap::new();
    for (rank, (idx, _)) in dense_scores.iter().enumerate() {
        dense_ranks.insert(*idx, rank);
    }

    // 4. Reciprocal Rank Fusion (k = 60)
    let rrf_k = 60.0f32;
    let mut fused_matches: Vec<SemanticMatch> = Vec::new();

    for (idx, doc) in index.documents.iter().enumerate() {
        let r_bm25 = *bm25_ranks.get(&idx).unwrap_or(&usize::MAX) as f32;
        let r_dense = *dense_ranks.get(&idx).unwrap_or(&usize::MAX) as f32;

        let rrf_score = (1.0 / (rrf_k + r_bm25)) + (1.0 / (rrf_k + r_dense));
        let normalized_score = ((rrf_score / (2.0 / rrf_k)) * 100.0).round() / 100.0;

        let doc_name_lower = doc.file_name.to_lowercase();
        let matched_terms: Vec<String> = query_words
            .iter()
            .filter(|q| doc.snippet.to_lowercase().contains(q.as_str()) || doc_name_lower.contains(q.as_str()))
            .cloned()
            .collect();

        if normalized_score > 0.10 || !matched_terms.is_empty() {
            fused_matches.push(SemanticMatch {
                file_path: doc.file_path.clone(),
                rel_path: doc.rel_path.clone(),
                file_name: doc.file_name.clone(),
                file_size: doc.file_size,
                score: normalized_score,
                snippet: doc.snippet.clone(),
                matched_terms,
            });
        }
    }

    fused_matches.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    fused_matches.truncate(limit.max(1));

    Ok(fused_matches)
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

    #[test]
    fn test_hybrid_bm25_semantic_search() {
        let temp = tempfile::tempdir().unwrap();
        let path1 = temp.path().join("auth_service.rs");
        let path2 = temp.path().join("docker-compose.yml");
        let path3 = temp.path().join("readme.md");

        fs::write(
            &path1,
            "pub fn authenticate_bearer_token(jwt: &str) -> Result<Claims, AuthError> {\n    // Validate cryptographic signature\n}",
        )
        .unwrap();
        fs::write(
            &path2,
            "version: '3.8'\nservices:\n  redis:\n    image: redis:7-alpine\n    ports:\n      - '6379:6379'\n",
        )
        .unwrap();
        fs::write(
            &path3,
            "# System Documentation\nThis repository provides secure authentication and container deployment orchestrations.\n",
        )
        .unwrap();

        let index = build_semantic_index(temp.path(), 50).unwrap();
        assert_eq!(index.total_documents, 3);

        // Exact term + semantic concept query
        let results = search_semantic_hybrid(temp.path(), "authenticate bearer token jwt signature", 5).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].file_name, "auth_service.rs");
        assert!(results[0].score > 0.50);
        assert!(results[0].matched_terms.contains(&"authenticate".to_string()));
    }
}
