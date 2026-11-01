//! DoD 5220.22-M & Gutmann Secure File Shredder (100% Pure Rust).
//!
//! Multi-pass file overwriting, disk-level buffer flushing, filename and metadata
//! obfuscation, and unlinking to permanently destroy sensitive data beyond recovery.
//!
//! Supports:
//! - `SinglePassZero` (0x00 overwriting)
//! - `SinglePassRandom` (Cryptographic PRNG overwriting)
//! - `DoD_5220_22_M` (3-pass: fixed bytes, complement, random)
//! - `DoD_5220_22_M_ECE` (7-pass extended DoD standard)
//! - `Gutmann` (35-pass magnetic encoding destruction standard)

use std::fs::{self, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShredAlgorithm {
    Zero,
    Random,
    Dod3Pass,
    Dod7Pass,
    Gutmann35Pass,
}

impl ShredAlgorithm {
    pub fn pass_count(&self) -> usize {
        match self {
            ShredAlgorithm::Zero => 1,
            ShredAlgorithm::Random => 1,
            ShredAlgorithm::Dod3Pass => 3,
            ShredAlgorithm::Dod7Pass => 7,
            ShredAlgorithm::Gutmann35Pass => 35,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShredProgress {
    pub current_file: String,
    pub file_index: usize,
    pub total_files: usize,
    pub current_pass: usize,
    pub total_passes: usize,
    pub bytes_written: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShredReport {
    pub files_destroyed: usize,
    pub directories_removed: usize,
    pub total_bytes_shredded: u64,
    pub algorithm: ShredAlgorithm,
    pub elapsed_ms: u64,
    pub errors: Vec<String>,
}

/// Simple fast PRNG based on BLAKE3 keyed derivation for shredding streams.
struct ShredPrng {
    hasher: blake3::Hasher,
    counter: u64,
}

impl ShredPrng {
    fn new(seed_salt: &str) -> Self {
        let mut hasher = blake3::Hasher::new();
        hasher.update(uuid::Uuid::new_v4().as_bytes());
        hasher.update(seed_salt.as_bytes());
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        hasher.update(&now.to_le_bytes());
        Self { hasher, counter: 0 }
    }

    fn fill_buffer(&mut self, buf: &mut [u8]) {
        let mut chunk_hasher = self.hasher.clone();
        chunk_hasher.update(&self.counter.to_le_bytes());
        self.counter = self.counter.wrapping_add(1);

        let mut output_reader = chunk_hasher.finalize_xof();
        output_reader.fill(buf);
    }
}

enum PassPattern {
    Fixed(u8),
    Random,
}

fn get_passes_for_algorithm(algo: ShredAlgorithm) -> Vec<PassPattern> {
    match algo {
        ShredAlgorithm::Zero => vec![PassPattern::Fixed(0x00)],
        ShredAlgorithm::Random => vec![PassPattern::Random],
        ShredAlgorithm::Dod3Pass => vec![
            PassPattern::Fixed(0x55), // 01010101
            PassPattern::Fixed(0xAA), // 10101010 (complement)
            PassPattern::Random,
        ],
        ShredAlgorithm::Dod7Pass => vec![
            PassPattern::Fixed(0x00),
            PassPattern::Fixed(0xFF),
            PassPattern::Random,
            PassPattern::Fixed(0x96),
            PassPattern::Fixed(0x00),
            PassPattern::Fixed(0xFF),
            PassPattern::Random,
        ],
        ShredAlgorithm::Gutmann35Pass => {
            // 4 random passes, 27 structured passes, 4 random passes
            let mut passes = Vec::with_capacity(35);
            for _ in 0..4 {
                passes.push(PassPattern::Random);
            }
            let patterns: [u8; 27] = [
                0x55, 0xAA, 0x92, 0x49, 0x24, 0x00, 0x11, 0x22, 0x33,
                0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC,
                0xDD, 0xEE, 0xFF, 0x92, 0x49, 0x24, 0x6D, 0xB6, 0xDB,
            ];
            for p in patterns {
                passes.push(PassPattern::Fixed(p));
            }
            for _ in 0..4 {
                passes.push(PassPattern::Random);
            }
            passes
        }
    }
}

/// Shreds a single file by overwriting its content with multiple passes,
/// resetting metadata, renaming to a random filename, and unlinking.
pub fn shred_file<F>(
    path: &Path,
    algo: ShredAlgorithm,
    mut on_progress: F,
) -> Result<u64, String>
where
    F: FnMut(usize, usize, u64, u64),
{
    if !path.exists() {
        return Err(format!("path does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("path is not a file: {}", path.display()));
    }

    let file_len = match fs::metadata(path) {
        Ok(m) => m.len(),
        Err(e) => return Err(format!("cannot read file metadata: {e}")),
    };

    let passes = get_passes_for_algorithm(algo);
    let total_passes = passes.len();

    if file_len > 0 {
        // Clear read-only attributes if set
        let _ = crate::tools::touch::set_attributes(&path.to_string_lossy(), false, false, false, false);

        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .open(path)
            .map_err(|e| format!("cannot open file for shredding: {e}"))?;

        const CHUNK_SIZE: usize = 65536; // 64 KB
        let mut prng = ShredPrng::new(&path.to_string_lossy());
        let mut buf = vec![0u8; CHUNK_SIZE];

        for (pass_idx, pass) in passes.iter().enumerate() {
            file.seek(SeekFrom::Start(0))
                .map_err(|e| format!("seek error on pass {pass_idx}: {e}"))?;

            let mut remaining = file_len;
            while remaining > 0 {
                let to_write = std::cmp::min(remaining, CHUNK_SIZE as u64) as usize;
                match pass {
                    PassPattern::Fixed(byte) => {
                        buf[..to_write].fill(*byte);
                    }
                    PassPattern::Random => {
                        prng.fill_buffer(&mut buf[..to_write]);
                    }
                }

                file.write_all(&buf[..to_write])
                    .map_err(|e| format!("write error on pass {pass_idx}: {e}"))?;
                remaining -= to_write as u64;

                on_progress(pass_idx + 1, total_passes, file_len - remaining, file_len);
            }

            file.flush()
                .map_err(|e| format!("flush error on pass {pass_idx}: {e}"))?;
            file.sync_all()
                .map_err(|e| format!("sync_all error on pass {pass_idx}: {e}"))?;
        }

        // Reset timestamps to epoch
        let _ = crate::tools::touch::set_timestamps(&path.to_string_lossy(), Some(0), Some(0), Some(0));

        // Truncate to 0
        file.set_len(0).map_err(|e| format!("truncate error: {e}"))?;
        let _ = file.sync_all();
        drop(file);
    }

    // Obfuscate filename in MFT / directory table before deletion
    let obfuscated_name = format!("__nexus_shred_{}.tmp", uuid::Uuid::new_v4().simple());
    let obfuscated_path = if let Some(parent) = path.parent() {
        parent.join(&obfuscated_name)
    } else {
        PathBuf::from(&obfuscated_name)
    };

    let target_to_delete = if fs::rename(path, &obfuscated_path).is_ok() {
        obfuscated_path
    } else {
        path.to_path_buf()
    };

    fs::remove_file(&target_to_delete)
        .map_err(|e| format!("failed to unlink shredded file: {e}"))?;

    Ok(file_len)
}

/// Recursively shreds all files in the given targets (files and folders).
pub fn shred_paths<P, F>(
    targets: &[P],
    algo: ShredAlgorithm,
    mut progress_callback: F,
) -> ShredReport
where
    P: AsRef<Path>,
    F: FnMut(ShredProgress),
{
    let started = Instant::now();
    let mut files_to_shred: Vec<PathBuf> = Vec::new();
    let mut dirs_to_remove: Vec<PathBuf> = Vec::new();

    for target in targets {
        let p = target.as_ref();
        if p.is_file() {
            files_to_shred.push(p.to_path_buf());
        } else if p.is_dir() {
            // Collect all sub-files and sub-directories (deepest first for deletion)
            let mut sub_files = Vec::new();
            let mut sub_dirs = Vec::new();
            for e in jwalk::WalkDir::new(p)
                .skip_hidden(false)
                .process_read_dir(|_, _, _, children| {
                    children.retain(|c| c.is_ok());
                })
                .into_iter()
                .flatten()
            {
                let path = e.path();
                if path.is_file() {
                    sub_files.push(path);
                } else if path.is_dir() && path != p {
                    sub_dirs.push(path);
                }
            }
            files_to_shred.extend(sub_files);
            // Sort directories by length descending so children are deleted before parents
            sub_dirs.sort_by_key(|d| std::cmp::Reverse(d.components().count()));
            dirs_to_remove.extend(sub_dirs);
            dirs_to_remove.push(p.to_path_buf());
        }
    }

    let total_files = files_to_shred.len();
    let total_passes = algo.pass_count();
    let mut total_bytes_shredded = 0u64;
    let mut files_destroyed = 0usize;
    let mut directories_removed = 0usize;
    let mut errors = Vec::new();

    for (file_idx, file_path) in files_to_shred.into_iter().enumerate() {
        let current_display = file_path.to_string_lossy().to_string();
        let res = shred_file(&file_path, algo, |pass, _total_p, bytes_w, total_b| {
            progress_callback(ShredProgress {
                current_file: current_display.clone(),
                file_index: file_idx + 1,
                total_files,
                current_pass: pass,
                total_passes,
                bytes_written: bytes_w,
                total_bytes: total_b,
            });
        });

        match res {
            Ok(bytes) => {
                total_bytes_shredded += bytes;
                files_destroyed += 1;
            }
            Err(e) => {
                errors.push(format!("{}: {e}", file_path.display()));
            }
        }
    }

    // Remove cleaned directory trees
    for dir in dirs_to_remove {
        let _ = crate::tools::touch::set_attributes(&dir.to_string_lossy(), false, false, false, false);
        let obfuscated_name = format!("__nexus_shred_dir_{}.tmp", uuid::Uuid::new_v4().simple());
        let obfuscated_dir = if let Some(parent) = dir.parent() {
            parent.join(&obfuscated_name)
        } else {
            PathBuf::from(&obfuscated_name)
        };

        let target_dir = if fs::rename(&dir, &obfuscated_dir).is_ok() {
            obfuscated_dir
        } else {
            dir.clone()
        };

        if fs::remove_dir(&target_dir).is_ok() || fs::remove_dir_all(&target_dir).is_ok() {
            directories_removed += 1;
        } else {
            errors.push(format!("failed to remove dir: {}", dir.display()));
        }
    }

    ShredReport {
        files_destroyed,
        directories_removed,
        total_bytes_shredded,
        algorithm: algo,
        elapsed_ms: started.elapsed().as_millis() as u64,
        errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shred_single_file_dod3() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("secret.docx");
        let secret_data = vec![0x99u8; 128 * 1024]; // 128 KB
        fs::write(&target, &secret_data).unwrap();
        assert!(target.exists());

        let bytes = shred_file(&target, ShredAlgorithm::Dod3Pass, |_, _, _, _| {}).unwrap();
        assert_eq!(bytes, 128 * 1024);
        assert!(!target.exists());
    }

    #[test]
    fn test_shred_empty_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("empty.txt");
        fs::write(&target, b"").unwrap();

        let bytes = shred_file(&target, ShredAlgorithm::Zero, |_, _, _, _| {}).unwrap();
        assert_eq!(bytes, 0);
        assert!(!target.exists());
    }

    #[test]
    fn test_shred_recursive_directory() {
        let dir = tempfile::tempdir().unwrap();
        let secret_folder = dir.path().join("confidential_project");
        let nested = secret_folder.join("nested");
        fs::create_dir_all(&nested).unwrap();

        fs::write(secret_folder.join("doc1.txt"), b"Confidential financial 1").unwrap();
        fs::write(nested.join("doc2.txt"), b"Confidential financial 2").unwrap();

        let report = shred_paths(std::slice::from_ref(&secret_folder), ShredAlgorithm::Random, |_| {});
        assert_eq!(report.files_destroyed, 2);
        assert_eq!(report.directories_removed, 2);
        assert!(!secret_folder.exists());
        assert!(report.errors.is_empty());
    }
}
