//! Real-Time Shannon Entropy Analysis & Cryptographic Activity Heuristic (100% Rust).
//!
//! Based on recent storage-security and ransomware detection research (USENIX FAST / USENIX Security):
//! Measures byte-level randomness across files to detect unauthorized crypto-ransomware encryption
//! and differentiate legitimate compressed media from obfuscated or encrypted payloads.

use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EntropyClassification {
    Plaintext,
    StructuredData,
    CompressedMedia,
    EncryptedOrRansomwareSuspect,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkEntropy {
    pub offset: u64,
    pub length: usize,
    pub entropy: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntropyReport {
    pub file_path: String,
    pub file_size: u64,
    pub overall_entropy: f64,            // 0.00 to 8.00 bits per byte
    pub header_entropy: f64,             // First 4KB entropy
    pub tail_entropy: f64,               // Last 4KB entropy
    pub classification: EntropyClassification,
    pub confidence_score: f64,           // 0.0 to 1.0
    pub detected_magic: Option<String>,
    pub chunk_distribution: Vec<ChunkEntropy>,
    pub elapsed_ms: u64,
    pub advisory: String,
}

/// Computes Shannon entropy in bits per byte (0.0 to 8.0) for a byte slice.
pub fn calculate_shannon_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let mut counts = [0usize; 256];
    for &b in data {
        counts[b as usize] += 1;
    }

    let len = data.len() as f64;
    let mut entropy = 0.0f64;

    for &count in &counts {
        if count > 0 {
            let p = (count as f64) / len;
            entropy -= p * p.log2();
        }
    }

    entropy
}

/// Inspects known magic byte signatures to distinguish legitimate compressed containers from raw ciphertexts.
fn sniffer_magic_format(data: &[u8]) -> Option<&'static str> {
    if data.len() < 4 {
        return None;
    }

    if data.starts_with(b"PK\x03\x04") || data.starts_with(b"PK\x05\x06") {
        Some("ZIP Archive Container")
    } else if data.starts_with(b"\x1f\x8b") {
        Some("GZIP Compressed File")
    } else if data.starts_with(b"7z\xbc\xaf\x27\x1c") {
        Some("7-Zip Archive")
    } else if data.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("PNG Image")
    } else if data.starts_with(b"\xff\xd8\xff") {
        Some("JPEG Image")
    } else if data.starts_with(b"Rar!\x1a\x07") {
        Some("RAR Archive")
    } else if data.starts_with(b"BZh") {
        Some("BZIP2 Compressed File")
    } else if data.starts_with(b"\xfd7zXZ\x00") {
        Some("XZ Archive")
    } else if data.starts_with(b"%PDF-") {
        Some("Adobe PDF Document")
    } else {
        None
    }
}

/// Inspects a file and computes its Shannon entropy distribution and cryptographic threat profile.
pub fn inspect_file_entropy(path: &Path) -> Result<EntropyReport, String> {
    let started = Instant::now();
    let mut file = File::open(path).map_err(|e| format!("cannot open target file: {e}"))?;
    let metadata = file.metadata().map_err(|e| format!("cannot read metadata: {e}"))?;
    let file_size = metadata.len();

    // Read full file up to 16 MB for deep inspection
    let max_read = (file_size as usize).min(16 * 1024 * 1024);
    let mut buffer = vec![0u8; max_read];
    file.read_exact(&mut buffer).map_err(|e| format!("read error: {e}"))?;

    let overall_entropy = calculate_shannon_entropy(&buffer);

    let header_len = buffer.len().min(4096);
    let header_entropy = calculate_shannon_entropy(&buffer[..header_len]);

    let tail_start = buffer.len().saturating_sub(4096);
    let tail_entropy = calculate_shannon_entropy(&buffer[tail_start..]);

    let magic = sniffer_magic_format(&buffer);

    // Compute chunked entropy across 64KB blocks
    let chunk_size = 65536;
    let mut chunk_distribution = Vec::new();
    let mut offset = 0u64;

    for chunk in buffer.chunks(chunk_size) {
        let chunk_ent = calculate_shannon_entropy(chunk);
        chunk_distribution.push(ChunkEntropy {
            offset,
            length: chunk.len(),
            entropy: (chunk_ent * 100.0).round() / 100.0,
        });
        offset += chunk.len() as u64;
    }

    // Heuristic Classification
    let (classification, confidence, advisory) = if overall_entropy < 5.0 {
        (
            EntropyClassification::Plaintext,
            0.98,
            "File contains human-readable text, source code, or low-density markup.".to_string(),
        )
    } else if overall_entropy < 7.2 {
        (
            EntropyClassification::StructuredData,
            0.92,
            "File contains structured binary headers, compiled bytecode, or structured database records.".to_string(),
        )
    } else if let Some(m) = magic {
        (
            EntropyClassification::CompressedMedia,
            0.95,
            format!("High entropy verified as legitimate {m} container format."),
        )
    } else if overall_entropy >= 7.85 && header_entropy >= 7.80 && tail_entropy >= 7.80 {
        (
            EntropyClassification::EncryptedOrRansomwareSuspect,
            0.97,
            "CRITICAL: Uniform near-maximum randomness without recognized container header. High probability of encrypted vault, raw ciphertext, or active ransomware payload."
                .to_string(),
        )
    } else {
        (
            EntropyClassification::StructuredData,
            0.80,
            "High-density compressed data or custom binary representation.".to_string(),
        )
    };

    Ok(EntropyReport {
        file_path: path.to_string_lossy().to_string(),
        file_size,
        overall_entropy: (overall_entropy * 1000.0).round() / 1000.0,
        header_entropy: (header_entropy * 1000.0).round() / 1000.0,
        tail_entropy: (tail_entropy * 1000.0).round() / 1000.0,
        classification,
        confidence_score: confidence,
        detected_magic: magic.map(|s| s.to_string()),
        chunk_distribution,
        elapsed_ms: started.elapsed().as_millis() as u64,
        advisory,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_shannon_entropy_calculation() {
        let zeroes = vec![0u8; 1024];
        assert_eq!(calculate_shannon_entropy(&zeroes), 0.0);

        let ascii_text = b"The quick brown fox jumps over the lazy dog. 1234567890 Nexus Explorer";
        let text_entropy = calculate_shannon_entropy(ascii_text);
        assert!(text_entropy > 3.5 && text_entropy < 5.0, "text entropy: {text_entropy}");

        // Random bytes should have near 8.0 entropy
        let mut uniform_random = vec![0u8; 256 * 100];
        for (i, byte) in uniform_random.iter_mut().enumerate() {
            *byte = (i % 256) as u8;
        }
        let rand_entropy = calculate_shannon_entropy(&uniform_random);
        assert!((rand_entropy - 8.0).abs() < 0.01, "uniform entropy: {rand_entropy}");
    }

    #[test]
    fn test_inspect_file_entropy_classification() {
        let temp = tempfile::tempdir().unwrap();
        let text_file = temp.path().join("readme.txt");
        let encrypted_file = temp.path().join("suspicious.locked");

        fs::write(&text_file, "Plaintext source documentation and standard ASCII log files.").unwrap();

        // Pseudo-random high entropy payload
        let mut random_bytes = vec![0u8; 16384];
        for (i, b) in random_bytes.iter_mut().enumerate() {
            *b = ((i * 1664525 + 1013904223) >> 16) as u8;
        }
        fs::write(&encrypted_file, &random_bytes).unwrap();

        let report_text = inspect_file_entropy(&text_file).unwrap();
        assert_eq!(report_text.classification, EntropyClassification::Plaintext);
        assert!(report_text.overall_entropy < 5.0);

        let report_enc = inspect_file_entropy(&encrypted_file).unwrap();
        assert_eq!(report_enc.classification, EntropyClassification::EncryptedOrRansomwareSuspect);
        assert!(report_enc.overall_entropy >= 7.85);
    }
}

