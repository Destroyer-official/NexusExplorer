//! Checksum manifest generation and verification (SFV / MD5 / SHA-1 / SHA-256 / SHA-512 / XXH3).
//!
//! Manifests use the widely understood `<hex> *<relative-path>` line format
//! (the same layout produced by `sha256sum` / `md5sum`). The verifier also accepts
//! the SFV convention `filename <crc32>` so existing community manifests load.

use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use sha2::Digest as _;

const CHUNK: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashManifestResult {
    pub manifest_path: String,
    pub algorithm: String,
    pub entries: usize,
    pub total_bytes: u64,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VerifyStatus {
    Match,
    Mismatch,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashVerifyItem {
    pub path: String,
    pub expected: String,
    pub actual: String,
    pub status: VerifyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HashVerifyReport {
    pub manifest_path: String,
    pub algorithm: String,
    pub total: usize,
    pub matched: usize,
    pub mismatched: usize,
    pub missing: usize,
    pub items: Vec<HashVerifyItem>,
    pub elapsed_ms: u64,
}

fn digest_file(path: &Path, algorithm: &str) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("cannot open {}: {e}", path.display()))?;
    let mut buffer = vec![0u8; CHUNK];
    let algo = algorithm.to_ascii_lowercase();

    let digest = match algo.as_str() {
        "sha256" | "sha-256" => {
            let mut hasher = sha2::Sha256::new();
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            hex::encode(hasher.finalize())
        }
        "sha512" | "sha-512" => {
            let mut hasher = sha2::Sha512::new();
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            hex::encode(hasher.finalize())
        }
        "sha1" | "sha-1" => {
            let mut hasher = sha1::Sha1::new();
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            hex::encode(hasher.finalize())
        }
        "md5" => {
            let mut hasher = md5::Md5::new();
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            hex::encode(hasher.finalize())
        }
        "crc32" | "sfv" => {
            let mut hasher = crc32fast::Hasher::new();
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            format!("{:08x}", hasher.finalize())
        }
        "blake3" => {
            let mut hasher = blake3::Hasher::new();
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            hasher.finalize().to_hex().to_string()
        }
        "xxh3" | "xxhash" => {
            let mut hasher = xxhash_rust::xxh3::Xxh3::new();
            loop {
                let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            format!("{:016x}", hasher.digest())
        }
        other => return Err(format!("unsupported manifest algorithm '{other}'")),
    };
    Ok(digest)
}

fn normalize_algorithm(value: &str) -> String {
    match value.to_ascii_lowercase().as_str() {
        "sha-256" => "sha256".into(),
        "sha-512" => "sha512".into(),
        "sha-1" => "sha1".into(),
        "sfv" => "crc32".into(),
        "xxhash" => "xxh3".into(),
        other => other.to_string(),
    }
}

/// Builds a manifest for every file underneath `root`.
pub fn create_manifest(
    root: &Path,
    algorithm: &str,
    manifest_path: Option<&Path>,
) -> Result<HashManifestResult, String> {
    let started = Instant::now();
    if !root.is_dir() {
        return Err(format!("not a directory: {}", root.display()));
    }
    let algorithm = normalize_algorithm(algorithm);
    let ext = match algorithm.as_str() {
        "sha256" => "sha256",
        "sha512" => "sha512",
        "sha1" => "sha1",
        "md5" => "md5",
        "crc32" => "sfv",
        "blake3" => "blake3",
        "xxh3" => "xxh3",
        other => return Err(format!("unsupported manifest algorithm '{other}'")),
    };

    let target = manifest_path
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| root.join(format!("checksums.{ext}")));

    let mut lines = Vec::new();
    let mut total_bytes = 0u64;
    let mut entries = 0usize;

    for item in jwalk::WalkDir::new(root).skip_hidden(false) {
        let Ok(entry) = item else { continue };
        if entry.file_type().is_dir() {
            continue;
        }
        let path = entry.path();
        if path == target {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        let Ok(digest) = digest_file(&path, &algorithm) else {
            continue;
        };
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        if algorithm == "crc32" {
            lines.push(format!("{rel} {digest}\n"));
        } else {
            lines.push(format!("{digest} *{rel}\n"));
        }
        entries += 1;
        total_bytes = total_bytes.saturating_add(meta.len());
    }

    std::fs::write(&target, lines.concat())
        .map_err(|e| format!("cannot write manifest {}: {e}", target.display()))?;

    Ok(HashManifestResult {
        manifest_path: target.to_string_lossy().into_owned(),
        algorithm,
        entries,
        total_bytes,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

fn parse_manifest_line(line: &str) -> Option<(String, String)> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') {
        return None;
    }
    // "<hash> *<name>" / "<hash>  <name>"
    for marker in [" *", "  "] {
        if let Some(idx) = trimmed.find(marker) {
            let hash = trimmed[..idx].trim();
            let name = trimmed[idx + marker.len()..].trim();
            if !hash.is_empty() && !name.is_empty() && hash.chars().all(|c| c.is_ascii_hexdigit()) {
                return Some((hash.to_ascii_lowercase(), name.replace('\\', "/")));
            }
        }
    }
    // SFV: "<name> <crc32>"
    if let Some((name, hash)) = trimmed.rsplit_once(' ') {
        let hash = hash.trim();
        if hash.len() == 8 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
            return Some((hash.to_ascii_lowercase(), name.trim().replace('\\', "/")));
        }
    }
    None
}

fn infer_algorithm(manifest_path: &Path, sample_hash: &str) -> String {
    let name = manifest_path
        .file_name()
        .map(|n| n.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    if name.ends_with(".md5") {
        return "md5".into();
    }
    if name.ends_with(".sha1") {
        return "sha1".into();
    }
    if name.ends_with(".sha256") {
        return "sha256".into();
    }
    if name.ends_with(".sha512") {
        return "sha512".into();
    }
    if name.ends_with(".sfv") {
        return "crc32".into();
    }
    if name.ends_with(".blake3") {
        return "blake3".into();
    }
    if name.ends_with(".xxh3") {
        return "xxh3".into();
    }
    match sample_hash.len() {
        8 => "crc32".into(),
        16 => "xxh3".into(),
        32 => "md5".into(),
        40 => "sha1".into(),
        64 => "sha256".into(),
        128 => "sha512".into(),
        _ => "sha256".into(),
    }
}

/// Verifies every entry in an existing manifest file.
pub fn verify_manifest(manifest_path: &Path) -> Result<HashVerifyReport, String> {
    let started = Instant::now();
    let file = File::open(manifest_path)
        .map_err(|e| format!("cannot open manifest {}: {e}", manifest_path.display()))?;
    let reader = BufReader::new(file);
    let root = manifest_path.parent().unwrap_or_else(|| Path::new("."));

    let mut parsed: Vec<(String, String)> = Vec::new();
    for line in reader.lines() {
        let Ok(line) = line else { continue };
        if let Some(pair) = parse_manifest_line(&line) {
            parsed.push(pair);
        }
    }
    if parsed.is_empty() {
        return Err("manifest contains no checksum entries".into());
    }
    let algorithm = infer_algorithm(manifest_path, &parsed[0].0);

    let mut items = Vec::new();
    let mut matched = 0usize;
    let mut mismatched = 0usize;
    let mut missing = 0usize;

    for (expected, rel) in parsed {
        let target: PathBuf = root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let (actual, status) = if !target.is_file() {
            missing += 1;
            (String::new(), VerifyStatus::Missing)
        } else {
            match digest_file(&target, &algorithm) {
                Ok(digest) if digest.eq_ignore_ascii_case(&expected) => {
                    matched += 1;
                    (digest, VerifyStatus::Match)
                }
                Ok(digest) => {
                    mismatched += 1;
                    (digest, VerifyStatus::Mismatch)
                }
                Err(message) => {
                    mismatched += 1;
                    (format!("error: {message}"), VerifyStatus::Mismatch)
                }
            }
        };
        items.push(HashVerifyItem {
            path: target.to_string_lossy().into_owned(),
            expected,
            actual,
            status,
        });
    }

    Ok(HashVerifyReport {
        manifest_path: manifest_path.to_string_lossy().into_owned(),
        algorithm,
        total: items.len(),
        matched,
        mismatched,
        missing,
        items,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Human-readable summary used by CLI output.
pub fn verify_summary(report: &HashVerifyReport) -> String {
    format!(
        "{} files, {} matched, {} mismatched, {} missing",
        report.total, report.matched, report.mismatched, report.missing
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_and_verify_manifest() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("a.txt"), b"alpha").unwrap();
        std::fs::write(root.join("b.txt"), b"beta").unwrap();

        for algo in ["sha256", "md5", "sha1", "crc32", "xxh3", "blake3"] {
            let result = create_manifest(root, algo, None).unwrap();
            assert_eq!(result.entries, 2, "{algo}");
            let report = verify_manifest(Path::new(&result.manifest_path)).unwrap();
            assert_eq!(report.total, 2);
            assert_eq!(report.matched, 2, "{algo} verification");
            assert_eq!(report.mismatched, 0);
            std::fs::remove_file(&result.manifest_path).unwrap();
        }
    }

    #[test]
    fn detects_tampering_and_missing_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("keep.txt"), b"keep").unwrap();
        std::fs::write(root.join("gone.txt"), b"gone").unwrap();
        std::fs::write(root.join("edit.txt"), b"original").unwrap();

        let result = create_manifest(root, "sha256", None).unwrap();
        std::fs::remove_file(root.join("gone.txt")).unwrap();
        std::fs::write(root.join("edit.txt"), b"tampered").unwrap();

        let report = verify_manifest(Path::new(&result.manifest_path)).unwrap();
        assert_eq!(report.missing, 1);
        assert_eq!(report.mismatched, 1);
        assert_eq!(report.matched, 1);
    }
}
