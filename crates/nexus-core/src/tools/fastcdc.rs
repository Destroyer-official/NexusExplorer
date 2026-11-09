//! FastCDC (Fast Content-Defined Chunking) & Sub-File Deduplication Engine (100% Pure Rust).
//!
//! Based on the 2016/2026 systems literature:
//! "FastCDC: a Fast and Efficient Content-Defined Chunking Approach for Data Deduplication" (Xia et al., USENIX ATC).
//!
//! Features:
//! - Gear-hashing based chunking running up to 10x faster than traditional Rabin-Karp fingerprinting.
//! - Dual-mask normalized chunking (Min: 2 KB, Avg: 8 KB, Max: 64 KB) eliminating small/large chunk skew.
//! - Cross-file block-level deduplication analyzer discovering identical blocks across distinct files.
//! - Sub-file BLAKE3 cryptographic fingerprinting per chunk.

use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Instant;
use serde::{Deserialize, Serialize};

pub const MIN_CHUNK_SIZE: usize = 2048;       // 2 KB
pub const AVG_CHUNK_SIZE: usize = 8192;       // 8 KB
pub const MAX_CHUNK_SIZE: usize = 65536;      // 64 KB

// FastCDC Gear lookup matrix (256 pseudo-random 64-bit constants)
#[rustfmt::skip]
const GEAR_TABLE: [u64; 256] = [
    0x35a137e067c29be0, 0xb2831dc3b74542d9, 0xc141f221be263d90, 0xfa399ff81432c69e,
    0x7b6f7f6a70a0d6dc, 0x6e9f2911b332b78b, 0xa5df3a39e802a820, 0x2287cfbd4aa4bf74,
    0x29432612cf730607, 0x63351ecf769f37ef, 0x247a3cf94bb3c616, 0x729ec0bcf773e738,
    0xe1c028a38c823023, 0xb0e98031d999ec98, 0x9e6931fc80ee90ff, 0x20352ef137eb1374,
    0x7471fb981f96e476, 0xdf05e197d19e9929, 0xb8be3f3607fa6d48, 0x1d471550c6bf23f0,
    0x1a719c8f258a1768, 0xd0011a84f32c7429, 0xbb309ee2e74e4428, 0x6e3d179ebf32b120,
    0x2774a0fd94e1e3e7, 0x93309e4cf948c227, 0x5a232f416d8a7a28, 0xb80214a1329c2937,
    0xa0676a917e735497, 0xd1a11728c31278e9, 0x7628b056e7212458, 0x82f2f75471413a28,
    0x2646b283df8e7627, 0x72202685942478f7, 0x22b2707f168f14a0, 0xa31e479c3b8a3237,
    0x8772a08cf512a868, 0xbb031121d520e068, 0x539e2439c28e9328, 0x9481308a3f8f1728,
    0xc127a3d3128fa727, 0xa1803738cf8126e7, 0x718f3a38c47f5257, 0xa1623912bf22d4f7,
    0x547180fd12328458, 0x91832038df726427, 0x3081e7d89f2136e7, 0x21a1237cbe81f087,
    0x247a8291f531c267, 0x7481a021b332b728, 0x7b6137a89f81a7e7, 0x31728031d9992c27,
    0xa081f238ce21b027, 0x729ec0bcf773e738, 0x82b2f0a1328e3427, 0xd0011a84f32c7429,
    0x247a3cf94bb3c616, 0x6e9f2911b332b78b, 0x20352ef137eb1374, 0xb8be3f3607fa6d48,
    0x1d471550c6bf23f0, 0x1a719c8f258a1768, 0xb0e98031d999ec98, 0x9e6931fc80ee90ff,
    0xdf05e197d19e9929, 0x7b6f7f6a70a0d6dc, 0xa5df3a39e802a820, 0x2287cfbd4aa4bf74,
    0x29432612cf730607, 0x63351ecf769f37ef, 0xfa399ff81432c69e, 0x35a137e067c29be0,
    0xb2831dc3b74542d9, 0xc141f221be263d90, 0xe1c028a38c823023, 0x7471fb981f96e476,
    0x8772a08cf512a868, 0xbb031121d520e068, 0x539e2439c28e9328, 0x9481308a3f8f1728,
    0xc127a3d3128fa727, 0xa1803738cf8126e7, 0x718f3a38c47f5257, 0xa1623912bf22d4f7,
    0x547180fd12328458, 0x91832038df726427, 0x3081e7d89f2136e7, 0x21a1237cbe81f087,
    0x247a8291f531c267, 0x7481a021b332b728, 0x7b6137a89f81a7e7, 0x31728031d9992c27,
    0xa081f238ce21b027, 0x729ec0bcf773e738, 0x82b2f0a1328e3427, 0xd0011a84f32c7429,
    0x247a3cf94bb3c616, 0x6e9f2911b332b78b, 0x20352ef137eb1374, 0xb8be3f3607fa6d48,
    0x1d471550c6bf23f0, 0x1a719c8f258a1768, 0xb0e98031d999ec98, 0x9e6931fc80ee90ff,
    0xdf05e197d19e9929, 0x7b6f7f6a70a0d6dc, 0xa5df3a39e802a820, 0x2287cfbd4aa4bf74,
    0x29432612cf730607, 0x63351ecf769f37ef, 0xfa399ff81432c69e, 0x35a137e067c29be0,
    0xb2831dc3b74542d9, 0xc141f221be263d90, 0xe1c028a38c823023, 0x7471fb981f96e476,
    0x2646b283df8e7627, 0x72202685942478f7, 0x22b2707f168f14a0, 0xa31e479c3b8a3237,
    0x2774a0fd94e1e3e7, 0x93309e4cf948c227, 0x5a232f416d8a7a28, 0xb80214a1329c2937,
    0xa0676a917e735497, 0xd1a11728c31278e9, 0x7628b056e7212458, 0x82f2f75471413a28,
    0x35a137e067c29be0, 0xb2831dc3b74542d9, 0xc141f221be263d90, 0xfa399ff81432c69e,
    0x7b6f7f6a70a0d6dc, 0x6e9f2911b332b78b, 0xa5df3a39e802a820, 0x2287cfbd4aa4bf74,
    0x29432612cf730607, 0x63351ecf769f37ef, 0x247a3cf94bb3c616, 0x729ec0bcf773e738,
    0xe1c028a38c823023, 0xb0e98031d999ec98, 0x9e6931fc80ee90ff, 0x20352ef137eb1374,
    0x7471fb981f96e476, 0xdf05e197d19e9929, 0xb8be3f3607fa6d48, 0x1d471550c6bf23f0,
    0x1a719c8f258a1768, 0xd0011a84f32c7429, 0xbb309ee2e74e4428, 0x6e3d179ebf32b120,
    0x2774a0fd94e1e3e7, 0x93309e4cf948c227, 0x5a232f416d8a7a28, 0xb80214a1329c2937,
    0xa0676a917e735497, 0xd1a11728c31278e9, 0x7628b056e7212458, 0x82f2f75471413a28,
    0x2646b283df8e7627, 0x72202685942478f7, 0x22b2707f168f14a0, 0xa31e479c3b8a3237,
    0x8772a08cf512a868, 0xbb031121d520e068, 0x539e2439c28e9328, 0x9481308a3f8f1728,
    0xc127a3d3128fa727, 0xa1803738cf8126e7, 0x718f3a38c47f5257, 0xa1623912bf22d4f7,
    0x547180fd12328458, 0x91832038df726427, 0x3081e7d89f2136e7, 0x21a1237cbe81f087,
    0x247a8291f531c267, 0x7481a021b332b728, 0x7b6137a89f81a7e7, 0x31728031d9992c27,
    0xa081f238ce21b027, 0x729ec0bcf773e738, 0x82b2f0a1328e3427, 0xd0011a84f32c7429,
    0x247a3cf94bb3c616, 0x6e9f2911b332b78b, 0x20352ef137eb1374, 0xb8be3f3607fa6d48,
    0x1d471550c6bf23f0, 0x1a719c8f258a1768, 0xb0e98031d999ec98, 0x9e6931fc80ee90ff,
    0xdf05e197d19e9929, 0x7b6f7f6a70a0d6dc, 0xa5df3a39e802a820, 0x2287cfbd4aa4bf74,
    0x29432612cf730607, 0x63351ecf769f37ef, 0xfa399ff81432c69e, 0x35a137e067c29be0,
    0xb2831dc3b74542d9, 0xc141f221be263d90, 0xe1c028a38c823023, 0x7471fb981f96e476,
    0x8772a08cf512a868, 0xbb031121d520e068, 0x539e2439c28e9328, 0x9481308a3f8f1728,
    0xc127a3d3128fa727, 0xa1803738cf8126e7, 0x718f3a38c47f5257, 0xa1623912bf22d4f7,
    0x547180fd12328458, 0x91832038df726427, 0x3081e7d89f2136e7, 0x21a1237cbe81f087,
    0x247a8291f531c267, 0x7481a021b332b728, 0x7b6137a89f81a7e7, 0x31728031d9992c27,
    0xa081f238ce21b027, 0x729ec0bcf773e738, 0x82b2f0a1328e3427, 0xd0011a84f32c7429,
    0x247a3cf94bb3c616, 0x6e9f2911b332b78b, 0x20352ef137eb1374, 0xb8be3f3607fa6d48,
    0x1d471550c6bf23f0, 0x1a719c8f258a1768, 0xb0e98031d999ec98, 0x9e6931fc80ee90ff,
    0xdf05e197d19e9929, 0x7b6f7f6a70a0d6dc, 0xa5df3a39e802a820, 0x2287cfbd4aa4bf74,
    0x29432612cf730607, 0x63351ecf769f37ef, 0xfa399ff81432c69e, 0x35a137e067c29be0,
    0xb2831dc3b74542d9, 0xc141f221be263d90, 0xe1c028a38c823023, 0x7471fb981f96e476,
    0x2646b283df8e7627, 0x72202685942478f7, 0x22b2707f168f14a0, 0xa31e479c3b8a3237,
    0x2774a0fd94e1e3e7, 0x93309e4cf948c227, 0x5a232f416d8a7a28, 0xb80214a1329c2937,
    0xa0676a917e735497, 0xd1a11728c31278e9, 0x7628b056e7212458, 0x82f2f75471413a28,
];

// Dual-mask configuration for FastCDC normalized chunking
const MASK_S: u64 = 0x0000d90f03530000;
const MASK_L: u64 = 0x0000d90003530000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkInfo {
    pub offset: u64,
    pub length: usize,
    pub blake3_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChunks {
    pub file_path: String,
    pub file_size: u64,
    pub chunks: Vec<ChunkInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockDeduplicationReport {
    pub total_files_analyzed: usize,
    pub total_bytes_raw: u64,
    pub total_chunks_produced: usize,
    pub unique_chunks_count: usize,
    pub unique_bytes: u64,
    pub duplicate_chunks_count: usize,
    pub duplicate_bytes_saved: u64,
    pub deduplication_ratio: f64,
    pub elapsed_ms: u64,
    pub shared_block_samples: Vec<SharedBlockSample>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedBlockSample {
    pub chunk_hash: String,
    pub chunk_size: usize,
    pub occurrence_count: usize,
    pub referenced_in_files: Vec<String>,
}

/// Cuts a slice of bytes into variable-length chunks using FastCDC gear hashing.
pub fn fastcdc_chunk_slice(data: &[u8]) -> Vec<ChunkInfo> {
    let mut chunks = Vec::new();
    let total_len = data.len();
    if total_len == 0 {
        return chunks;
    }

    let mut cursor = 0;
    while cursor < total_len {
        let remaining = total_len - cursor;
        if remaining <= MIN_CHUNK_SIZE {
            // Last small chunk
            let chunk_slice = &data[cursor..];
            let hash = blake3::hash(chunk_slice).to_hex().to_string();
            chunks.push(ChunkInfo {
                offset: cursor as u64,
                length: remaining,
                blake3_hash: hash,
            });
            break;
        }

        let max_len = remaining.min(MAX_CHUNK_SIZE);
        let mut fp: u64 = 0;
        let mut split = max_len;

        // Skip minimum chunk boundary
        let search_start = MIN_CHUNK_SIZE;
        let norm_boundary = search_start + (AVG_CHUNK_SIZE - MIN_CHUNK_SIZE);

        for i in search_start..max_len {
            let byte = data[cursor + i];
            fp = (fp << 1).wrapping_add(GEAR_TABLE[byte as usize]);

            let mask = if i < norm_boundary { MASK_S } else { MASK_L };
            if (fp & mask) == 0 {
                split = i + 1;
                break;
            }
        }

        let chunk_slice = &data[cursor..cursor + split];
        let hash = blake3::hash(chunk_slice).to_hex().to_string();
        chunks.push(ChunkInfo {
            offset: cursor as u64,
            length: split,
            blake3_hash: hash,
        });

        cursor += split;
    }

    chunks
}

/// Chunks a file from disk using FastCDC.
pub fn fastcdc_chunk_file(path: &Path) -> Result<FileChunks, String> {
    let mut file = File::open(path).map_err(|e| format!("cannot open file: {e}"))?;
    let metadata = file.metadata().map_err(|e| format!("cannot read metadata: {e}"))?;
    let file_size = metadata.len();

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| format!("read error: {e}"))?;

    let chunks = fastcdc_chunk_slice(&buffer);
    Ok(FileChunks {
        file_path: path.to_string_lossy().to_string(),
        file_size,
        chunks,
    })
}

/// Analyzes cross-file block-level deduplication across multiple files or directories.
pub fn analyze_block_deduplication(paths: &[PathBuf]) -> Result<BlockDeduplicationReport, String> {
    let started = Instant::now();
    let mut files_to_scan = Vec::new();

    for p in paths {
        if p.is_file() {
            files_to_scan.push(p.clone());
        } else if p.is_dir() {
            for entry in walkdir::WalkDir::new(p).into_iter().flatten() {
                if entry.file_type().is_file() {
                    files_to_scan.push(entry.path().to_path_buf());
                }
            }
        }
    }

    let total_files = files_to_scan.len();
    let mut total_raw_bytes = 0u64;
    let mut total_chunks = 0usize;

    // Map: chunk_hash -> (chunk_size, count, Set of file paths)
    let mut chunk_map: HashMap<String, (usize, usize, HashSet<String>)> = HashMap::new();

    for file_path in &files_to_scan {
        if let Ok(fc) = fastcdc_chunk_file(file_path) {
            total_raw_bytes += fc.file_size;
            total_chunks += fc.chunks.len();
            for c in fc.chunks {
                let entry = chunk_map.entry(c.blake3_hash).or_insert((c.length, 0, HashSet::new()));
                entry.1 += 1;
                entry.2.insert(fc.file_path.clone());
            }
        }
    }

    let mut unique_bytes = 0u64;
    let mut duplicate_bytes_saved = 0u64;
    let mut unique_chunks_count = 0usize;
    let mut duplicate_chunks_count = 0usize;
    let mut shared_samples = Vec::new();

    for (hash, (size, count, file_set)) in &chunk_map {
        unique_chunks_count += 1;
        unique_bytes += *size as u64;

        if *count > 1 {
            duplicate_chunks_count += count - 1;
            duplicate_bytes_saved += (*size as u64) * ((count - 1) as u64);

            if shared_samples.len() < 25 {
                let mut files: Vec<String> = file_set.iter().cloned().collect();
                files.sort();
                shared_samples.push(SharedBlockSample {
                    chunk_hash: hash.clone(),
                    chunk_size: *size,
                    occurrence_count: *count,
                    referenced_in_files: files,
                });
            }
        }
    }

    // Sort shared samples by total bytes saved descending
    shared_samples.sort_by_key(|s| std::cmp::Reverse(s.chunk_size * s.occurrence_count));

    let ratio = if unique_bytes > 0 {
        (total_raw_bytes as f64) / (unique_bytes as f64)
    } else {
        1.0
    };

    Ok(BlockDeduplicationReport {
        total_files_analyzed: total_files,
        total_bytes_raw: total_raw_bytes,
        total_chunks_produced: total_chunks,
        unique_chunks_count,
        unique_bytes,
        duplicate_chunks_count,
        duplicate_bytes_saved,
        deduplication_ratio: (ratio * 100.0).round() / 100.0,
        elapsed_ms: started.elapsed().as_millis() as u64,
        shared_block_samples: shared_samples,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_fastcdc_chunk_slice_boundaries() {
        let mut data = vec![0u8; 100_000];
        // Populate with pseudo-random content
        for (i, byte) in data.iter_mut().enumerate() {
            *byte = ((i * 31) ^ (i >> 3)) as u8;
        }

        let chunks = fastcdc_chunk_slice(&data);
        assert!(!chunks.is_empty());

        let total_chunk_len: usize = chunks.iter().map(|c| c.length).sum();
        assert_eq!(total_chunk_len, 100_000);

        for c in &chunks {
            assert!(c.length >= MIN_CHUNK_SIZE || c.offset + (c.length as u64) == 100_000);
            assert!(c.length <= MAX_CHUNK_SIZE);
            assert_eq!(c.blake3_hash.len(), 64);
        }
    }

    #[test]
    fn test_cross_file_block_deduplication() {
        let temp = tempfile::tempdir().unwrap();
        let path1 = temp.path().join("base_image.vmdk");
        let path2 = temp.path().join("cloned_diff.vmdk");

        // Shared 40KB header, 20KB distinct payload, 40KB shared tail
        let shared_block_a = vec![0x42u8; 40 * 1024];
        let diff_block_1 = vec![0xAAu8; 20 * 1024];
        let diff_block_2 = vec![0xBBu8; 20 * 1024];
        let shared_block_b = vec![0x77u8; 40 * 1024];

        let mut file1_data = shared_block_a.clone();
        file1_data.extend_from_slice(&diff_block_1);
        file1_data.extend_from_slice(&shared_block_b);

        let mut file2_data = shared_block_a;
        file2_data.extend_from_slice(&diff_block_2);
        file2_data.extend_from_slice(&shared_block_b);

        fs::write(&path1, &file1_data).unwrap();
        fs::write(&path2, &file2_data).unwrap();

        let report = analyze_block_deduplication(&[path1, path2]).unwrap();
        assert_eq!(report.total_files_analyzed, 2);
        assert!(report.duplicate_chunks_count > 0);
        assert!(report.duplicate_bytes_saved > 0);
        assert!(report.deduplication_ratio > 1.0);
    }
}

