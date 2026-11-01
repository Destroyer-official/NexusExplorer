//! File Splitter and Joiner with streaming SHA-256 manifest verification.

use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitManifest {
    pub original_filename: String,
    pub original_size: u64,
    pub chunk_size: u64,
    pub total_parts: usize,
    pub sha256: String,
    pub created_at_unix: u64,
    pub parts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitResult {
    pub parts_created: Vec<String>,
    pub manifest_path: String,
    pub elapsed_ms: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinResult {
    pub output_path: String,
    pub total_bytes: u64,
    pub hash_verified: bool,
    pub elapsed_ms: u64,
    pub sha256: String,
}

pub fn split_file<F>(
    source_path_str: &str,
    chunk_size: u64,
    output_dir_opt: Option<&str>,
    cancel_flag: Option<&AtomicBool>,
    mut on_progress: F,
) -> Result<SplitResult, String>
where
    F: FnMut(usize, usize, u64, u64), // part_index, total_parts, processed_bytes, total_bytes
{
    if chunk_size == 0 {
        return Err("chunk size must be greater than zero".into());
    }

    let source_path = Path::new(source_path_str);
    let mut file = BufReader::new(File::open(source_path).map_err(|e| format!("cannot open source file: {e}"))?);
    let total_bytes = file.get_ref().metadata().map(|m| m.len()).unwrap_or(0);

    let filename = source_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();

    let out_dir = match output_dir_opt {
        Some(dir) => PathBuf::from(dir),
        None => source_path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf(),
    };

    let total_parts = total_bytes.div_ceil(chunk_size).max(1) as usize;
    let started = Instant::now();

    let mut hasher = Sha256::new();
    let mut parts_created = Vec::new();
    let mut part_filenames = Vec::new();
    let mut processed_bytes: u64 = 0;

    let mut buf = vec![0u8; 1024 * 1024]; // 1MB buffer

    for part_idx in 1..=total_parts {
        if let Some(cancel) = cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                // Cleanup partial files
                for p in &parts_created {
                    let _ = std::fs::remove_file(p);
                }
                return Err("split cancelled by user".into());
            }
        }

        let part_name = format!("{filename}.part{part_idx:03}");
        let part_path = out_dir.join(&part_name);
        let mut part_writer = BufWriter::new(File::create(&part_path).map_err(|e| format!("cannot create part file: {e}"))?);

        let mut part_bytes_written: u64 = 0;
        while part_bytes_written < chunk_size {
            let to_read = (chunk_size - part_bytes_written).min(buf.len() as u64) as usize;
            let n = file.read(&mut buf[..to_read]).unwrap_or(0);
            if n == 0 {
                break;
            }

            hasher.update(&buf[..n]);
            part_writer.write_all(&buf[..n]).map_err(|e| format!("write error: {e}"))?;

            part_bytes_written += n as u64;
            processed_bytes += n as u64;
            on_progress(part_idx, total_parts, processed_bytes, total_bytes);
        }

        part_writer.flush().map_err(|e| format!("flush error: {e}"))?;
        parts_created.push(part_path.to_string_lossy().to_string());
        part_filenames.push(part_name);

        if processed_bytes >= total_bytes {
            break;
        }
    }

    let sha256 = format!("{:X}", hasher.finalize());
    let manifest = SplitManifest {
        original_filename: filename.clone(),
        original_size: total_bytes,
        chunk_size,
        total_parts: parts_created.len(),
        sha256: sha256.clone(),
        created_at_unix: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        parts: part_filenames,
    };

    let manifest_path = out_dir.join(format!("{filename}.split.json"));
    let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| format!("json serialize error: {e}"))?;
    std::fs::write(&manifest_path, manifest_json).map_err(|e| format!("manifest write error: {e}"))?;

    Ok(SplitResult {
        parts_created,
        manifest_path: manifest_path.to_string_lossy().to_string(),
        elapsed_ms: started.elapsed().as_millis() as u64,
        sha256,
    })
}

pub fn join_files<F>(
    manifest_path_str: &str,
    output_path_opt: Option<&str>,
    cancel_flag: Option<&AtomicBool>,
    mut on_progress: F,
) -> Result<JoinResult, String>
where
    F: FnMut(usize, usize, u64, u64),
{
    let manifest_path = Path::new(manifest_path_str);
    let manifest_data = std::fs::read_to_string(manifest_path).map_err(|e| format!("cannot read manifest: {e}"))?;
    let manifest: SplitManifest = serde_json::from_str(&manifest_data).map_err(|e| format!("invalid manifest json: {e}"))?;

    let base_dir = manifest_path.parent().unwrap_or_else(|| Path::new("."));
    let out_path = match output_path_opt {
        Some(p) => PathBuf::from(p),
        None => base_dir.join(&manifest.original_filename),
    };

    let started = Instant::now();
    let mut writer = BufWriter::new(File::create(&out_path).map_err(|e| format!("cannot create output file: {e}"))?);
    let mut hasher = Sha256::new();
    let mut processed_bytes: u64 = 0;
    let mut buf = vec![0u8; 1024 * 1024];

    for (idx, part_name) in manifest.parts.iter().enumerate() {
        if let Some(cancel) = cancel_flag {
            if cancel.load(Ordering::Relaxed) {
                let _ = std::fs::remove_file(&out_path);
                return Err("join cancelled by user".into());
            }
        }

        let part_path = base_dir.join(part_name);
        let mut part_reader = BufReader::new(File::open(&part_path).map_err(|e| format!("cannot open part {part_name}: {e}"))?);

        loop {
            let n = part_reader.read(&mut buf).unwrap_or(0);
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            writer.write_all(&buf[..n]).map_err(|e| format!("write error: {e}"))?;
            processed_bytes += n as u64;
            on_progress(idx + 1, manifest.parts.len(), processed_bytes, manifest.original_size);
        }
    }

    writer.flush().map_err(|e| format!("flush error: {e}"))?;

    let computed_hash = format!("{:X}", hasher.finalize());
    let hash_verified = computed_hash.eq_ignore_ascii_case(&manifest.sha256);

    Ok(JoinResult {
        output_path: out_path.to_string_lossy().to_string(),
        total_bytes: processed_bytes,
        hash_verified,
        elapsed_ms: started.elapsed().as_millis() as u64,
        sha256: computed_hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_and_join_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("source.dat");
        let content = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()";
        std::fs::write(&src, content).unwrap();

        let split_res = split_file(src.to_str().unwrap(), 16, None, None, |_, _, _, _| {}).unwrap();
        assert_eq!(split_res.parts_created.len(), 5);

        let out_joined = dir.path().join("reconstructed.dat");
        let join_res = join_files(&split_res.manifest_path, Some(out_joined.to_str().unwrap()), None, |_, _, _, _| {}).unwrap();

        assert!(join_res.hash_verified);
        assert_eq!(std::fs::read(out_joined).unwrap(), content);
    }
}

