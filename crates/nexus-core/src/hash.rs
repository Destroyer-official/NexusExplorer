//! Streaming file checksums.

use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::Instant;

use sha2::Digest as _;

use crate::error::{CoreError, CoreResult};
use crate::models::FileHash;

const CHUNK: usize = 1024 * 1024;

/// Computes a streaming digest for `path`.
///
/// Supported algorithms: `xxh3` (fast integrity), `sha256` (portable) and
/// `blake3` (fast cryptographic). Unknown algorithms are rejected explicitly.
pub fn hash_file(path: &str, algorithm: &str) -> CoreResult<FileHash> {
    let started = Instant::now();
    let target = Path::new(path);
    let mut file = File::open(target).map_err(|e| CoreError::from_io(target, e))?;
    let size = file
        .metadata()
        .map_err(|e| CoreError::from_io(target, e))?
        .len();

    let algorithm = algorithm.to_ascii_lowercase();
    let mut buffer = vec![0u8; CHUNK];

    let digest = match algorithm.as_str() {
        "xxh3" | "xxhash" => {
            let mut hasher = xxhash_rust::xxh3::Xxh3::new();
            loop {
                let n = file
                    .read(&mut buffer)
                    .map_err(|e| CoreError::from_io(target, e))?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            format!("{:016x}", hasher.digest())
        }
        "sha256" | "sha-256" => {
            let mut hasher = sha2::Sha256::new();
            loop {
                let n = file
                    .read(&mut buffer)
                    .map_err(|e| CoreError::from_io(target, e))?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            hex::encode(hasher.finalize())
        }
        "blake3" => {
            let mut hasher = blake3::Hasher::new();
            loop {
                let n = file
                    .read(&mut buffer)
                    .map_err(|e| CoreError::from_io(target, e))?;
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            hasher.finalize().to_hex().to_string()
        }
        other => {
            return Err(CoreError::InvalidInput(format!(
                "unsupported hash algorithm '{other}' (use xxh3, sha256 or blake3)"
            )))
        }
    };

    Ok(FileHash {
        path: path.to_string(),
        size,
        algorithm,
        digest,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn known_digests_for_empty_file() {
        let dir = std::env::temp_dir().join(format!("nexus-hash-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("empty.bin");
        fs::write(&file, b"").unwrap();

        let sha = hash_file(&file.to_string_lossy(), "sha256").unwrap();
        assert_eq!(
            sha.digest,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        let blake = hash_file(&file.to_string_lossy(), "blake3").unwrap();
        assert_eq!(
            blake.digest,
            "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"
        );
        assert!(hash_file(&file.to_string_lossy(), "md5").is_err());
        fs::remove_dir_all(&dir).unwrap();
    }
}
