//! Byte-by-byte binary and hex comparison engine.

use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexDiffChunk {
    pub offset: u64,
    pub left_hex: String,
    pub right_hex: String,
    pub left_ascii: String,
    pub right_ascii: String,
    pub is_match: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryDiffReport {
    pub file_a: String,
    pub file_b: String,
    pub size_a: u64,
    pub size_b: u64,
    pub is_identical: bool,
    pub matching_percentage: f64,
    pub total_differences_bytes: u64,
    pub first_difference_offset: Option<u64>,
    pub diff_chunks: Vec<HexDiffChunk>,
}

fn to_ascii(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|&b| if (32..=126).contains(&b) { b as char } else { '.' })
        .collect()
}

fn to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn compare_binary_files(
    file_a_path: &str,
    file_b_path: &str,
    max_diff_chunks: usize,
) -> Result<BinaryDiffReport, String> {
    let pa = Path::new(file_a_path);
    let pb = Path::new(file_b_path);

    let mut fa = BufReader::new(File::open(pa).map_err(|e| format!("cannot open file A: {e}"))?);
    let mut fb = BufReader::new(File::open(pb).map_err(|e| format!("cannot open file B: {e}"))?);

    let size_a = fa.get_ref().metadata().map(|m| m.len()).unwrap_or(0);
    let size_b = fb.get_ref().metadata().map(|m| m.len()).unwrap_or(0);

    let max_len = size_a.max(size_b);
    let mut total_matching: u64 = 0;
    let mut total_differences: u64 = 0;
    let mut first_difference_offset: Option<u64> = None;
    let mut diff_chunks: Vec<HexDiffChunk> = Vec::new();

    let mut offset: u64 = 0;
    let mut buf_a = [0u8; 16];
    let mut buf_b = [0u8; 16];

    while offset < max_len {
        let n_a = fa.read(&mut buf_a).unwrap_or(0);
        let n_b = fb.read(&mut buf_b).unwrap_or(0);

        if n_a == 0 && n_b == 0 {
            break;
        }

        let slice_a = &buf_a[..n_a];
        let slice_b = &buf_b[..n_b];

        let min_n = n_a.min(n_b);
        let mut row_diffs = 0;

        for i in 0..min_n {
            if slice_a[i] == slice_b[i] {
                total_matching += 1;
            } else {
                row_diffs += 1;
                total_differences += 1;
                if first_difference_offset.is_none() {
                    first_difference_offset = Some(offset + i as u64);
                }
            }
        }

        // Unmatched tail due to size difference
        let size_diff = (n_a as i64 - n_b as i64).unsigned_abs();
        total_differences += size_diff;
        if size_diff > 0 && first_difference_offset.is_none() {
            first_difference_offset = Some(offset + min_n as u64);
        }

        let is_match = n_a == n_b && row_diffs == 0;

        if !is_match && diff_chunks.len() < max_diff_chunks {
            diff_chunks.push(HexDiffChunk {
                offset,
                left_hex: to_hex(slice_a),
                right_hex: to_hex(slice_b),
                left_ascii: to_ascii(slice_a),
                right_ascii: to_ascii(slice_b),
                is_match,
            });
        }

        offset += n_a.max(n_b) as u64;
    }

    let is_identical = size_a == size_b && total_differences == 0;
    let matching_percentage = if max_len > 0 {
        ((total_matching as f64 / max_len as f64) * 100.0).clamp(0.0, 100.0)
    } else {
        100.0
    };

    Ok(BinaryDiffReport {
        file_a: file_a_path.to_string(),
        file_b: file_b_path.to_string(),
        size_a,
        size_b,
        is_identical,
        matching_percentage,
        total_differences_bytes: total_differences,
        first_difference_offset,
        diff_chunks,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_identical_files() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.bin");
        let b = dir.path().join("b.bin");
        File::create(&a).unwrap().write_all(b"Hello World 1234567890").unwrap();
        File::create(&b).unwrap().write_all(b"Hello World 1234567890").unwrap();

        let report = compare_binary_files(a.to_str().unwrap(), b.to_str().unwrap(), 10).unwrap();
        assert!(report.is_identical);
        assert_eq!(report.matching_percentage, 100.0);
        assert_eq!(report.total_differences_bytes, 0);
        assert!(report.first_difference_offset.is_none());
    }

    #[test]
    fn test_differing_files() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.bin");
        let b = dir.path().join("b.bin");
        File::create(&a).unwrap().write_all(b"Hello Rust World!").unwrap();
        File::create(&b).unwrap().write_all(b"Hello Mojo World!").unwrap();

        let report = compare_binary_files(a.to_str().unwrap(), b.to_str().unwrap(), 10).unwrap();
        assert!(!report.is_identical);
        assert_eq!(report.first_difference_offset, Some(6));
        assert!(!report.diff_chunks.is_empty());
    }
}

