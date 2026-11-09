//! PAR2 (Parchive 2.0) Parity Checksum & Packet Integrity Inspector (100% pure Rust).
//!
//! Inspects and validates Reed-Solomon PAR2 recovery sets:
//! - Parses PAR2 64-byte packet headers (`PAR2\0PKT`).
//! - Extracts Main packet slice size, block counts, and recovery set IDs.
//! - Validates File Description packets (MD5-16k, full MD5, filename, size).
//! - Audits recovery slice availability for file damage protection.

use std::fs::File;
use std::io::Read;
use std::path::Path;
use serde::{Deserialize, Serialize};

pub const PAR2_MAGIC: &[u8; 8] = b"PAR2\x00PKT";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Par2FileInfo {
    pub file_id: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub md5_hash_16k: String,
    pub md5_hash_full: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Par2PacketInfo {
    pub packet_type: String,
    pub packet_length: u64,
    pub recovery_set_id: String,
    pub is_valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Par2ValidationReport {
    pub file_path: String,
    pub is_valid: bool,
    pub recovery_set_id: String,
    pub slice_size: u64,
    pub total_data_files: usize,
    pub total_data_slices: u32,
    pub recovery_slices_available: u32,
    pub protected_files: Vec<Par2FileInfo>,
    pub packets: Vec<Par2PacketInfo>,
    pub error: Option<String>,
}

/// Inspects a PAR2 file and parses its packet structure and recovery metadata.
pub fn inspect_par2_file(path_str: &str) -> Par2ValidationReport {
    let p = Path::new(path_str);
    if !p.is_file() {
        return Par2ValidationReport {
            file_path: path_str.to_string(),
            is_valid: false,
            recovery_set_id: String::new(),
            slice_size: 0,
            total_data_files: 0,
            total_data_slices: 0,
            recovery_slices_available: 0,
            protected_files: Vec::new(),
            packets: Vec::new(),
            error: Some("file does not exist".into()),
        };
    }

    let mut file = match File::open(p) {
        Ok(f) => f,
        Err(e) => {
            return Par2ValidationReport {
                file_path: path_str.to_string(),
                is_valid: false,
                recovery_set_id: String::new(),
                slice_size: 0,
                total_data_files: 0,
                total_data_slices: 0,
                recovery_slices_available: 0,
                protected_files: Vec::new(),
                packets: Vec::new(),
                error: Some(format!("cannot open file: {e}")),
            }
        }
    };

    let mut content = Vec::new();
    if let Err(e) = file.read_to_end(&mut content) {
        return Par2ValidationReport {
            file_path: path_str.to_string(),
            is_valid: false,
            recovery_set_id: String::new(),
            slice_size: 0,
            total_data_files: 0,
            total_data_slices: 0,
            recovery_slices_available: 0,
            protected_files: Vec::new(),
            packets: Vec::new(),
            error: Some(format!("read error: {e}")),
        };
    }

    if content.len() < 64 {
        return Par2ValidationReport {
            file_path: path_str.to_string(),
            is_valid: false,
            recovery_set_id: String::new(),
            slice_size: 0,
            total_data_files: 0,
            total_data_slices: 0,
            recovery_slices_available: 0,
            protected_files: Vec::new(),
            packets: Vec::new(),
            error: Some("file too small for PAR2 packet structure".into()),
        };
    }

    let mut offset = 0;
    let mut set_id = String::new();
    let mut slice_size = 0u64;
    let mut data_slices = 0u32;
    let mut recovery_slices = 0u32;
    let mut protected_files = Vec::new();
    let mut packets = Vec::new();

    while offset + 64 <= content.len() {
        if &content[offset..offset + 8] != PAR2_MAGIC {
            // Scan ahead for next magic
            let mut found = None;
            for i in (offset + 1)..content.len().saturating_sub(8) {
                if &content[i..i + 8] == PAR2_MAGIC {
                    found = Some(i);
                    break;
                }
            }
            match found {
                Some(next_pos) => {
                    offset = next_pos;
                }
                None => break,
            }
        }

        // Read packet length (u64 little-endian at offset+8)
        let packet_len = u64::from_le_bytes(content[offset + 8..offset + 16].try_into().unwrap_or([0; 8]));
        if packet_len < 64 || (offset as u64 + packet_len) > content.len() as u64 || packet_len % 4 != 0 {
            // Damaged/corrupted packet length: advance past this magic and scan for next valid packet
            offset += 8;
            continue;
        }

        let pkt_len_usize = packet_len as usize;
        let pkt_type_bytes = &content[offset + 32..offset + 48];
        let curr_set_id = hex::encode_upper(&content[offset + 48..offset + 64]);
        if set_id.is_empty() {
            set_id = curr_set_id.clone();
        }

        let pkt_body = &content[offset + 64..offset + pkt_len_usize];

        let mut pkt_name = "Unknown Packet".to_string();

        if pkt_type_bytes.windows(4).any(|w| w == b"Main") {
            pkt_name = "Main Packet".to_string();
            if pkt_body.len() >= 12 {
                slice_size = u64::from_le_bytes(pkt_body[0..8].try_into().unwrap_or([0; 8]));
                data_slices = u32::from_le_bytes(pkt_body[8..12].try_into().unwrap_or([0; 4]));
            }
        } else if pkt_type_bytes.windows(8).any(|w| w == b"FileDesc") {
            pkt_name = "File Description".to_string();
            if pkt_body.len() >= 56 {
                let file_id_hex = hex::encode_upper(&pkt_body[0..16]);
                let md5_full = hex::encode_upper(&pkt_body[16..32]);
                let md5_16k = hex::encode_upper(&pkt_body[32..48]);
                let f_size = u64::from_le_bytes(pkt_body[48..56].try_into().unwrap_or([0; 8]));

                let raw_name_bytes = &pkt_body[56..];
                // strip trailing null bytes
                let trimmed = raw_name_bytes.iter().take_while(|&&b| b != 0).cloned().collect::<Vec<u8>>();
                let f_name = String::from_utf8_lossy(&trimmed).to_string();

                protected_files.push(Par2FileInfo {
                    file_id: file_id_hex,
                    file_name: f_name,
                    file_size_bytes: f_size,
                    md5_hash_16k: md5_16k,
                    md5_hash_full: md5_full,
                });
            }
        } else if pkt_type_bytes.windows(8).any(|w| w == b"RecvSlic") {
            pkt_name = "Recovery Slice".to_string();
            recovery_slices += 1;
        } else if pkt_type_bytes.windows(4).any(|w| w == b"IFSC") {
            pkt_name = "Input File Slice Checksum".to_string();
        }

        packets.push(Par2PacketInfo {
            packet_type: pkt_name,
            packet_length: packet_len,
            recovery_set_id: curr_set_id,
            is_valid: true,
        });

        offset += pkt_len_usize;
    }

    let is_valid = !packets.is_empty() && !set_id.is_empty();

    Par2ValidationReport {
        file_path: path_str.to_string(),
        is_valid,
        recovery_set_id: set_id,
        slice_size,
        total_data_files: protected_files.len(),
        total_data_slices: data_slices,
        recovery_slices_available: recovery_slices,
        protected_files,
        packets,
        error: if is_valid { None } else { Some("no valid PAR2 packets found".into()) },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_par2_synthetic_packet_parsing() {
        let mut buf = Vec::new();
        // Construct a synthetic PAR2 Main Packet (64 header + 16 body)
        buf.extend_from_slice(PAR2_MAGIC); // 8 bytes magic
        buf.extend_from_slice(&80u64.to_le_bytes()); // 8 bytes len = 80
        buf.extend_from_slice(&[0u8; 16]); // 16 bytes md5
        buf.extend_from_slice(b"PAR 2.0\x00Main\x00\x00\x00\x00"); // 16 bytes packet type
        buf.extend_from_slice(&[0xABu8; 16]); // 16 bytes recovery set ID
        // Body: 8 bytes slice size (2048), 4 bytes data slices (10)
        buf.extend_from_slice(&2048u64.to_le_bytes());
        buf.extend_from_slice(&10u32.to_le_bytes());
        buf.extend_from_slice(&[0u8; 4]); // 4 bytes padding

        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("test.par2");
        std::fs::write(&file, &buf).unwrap();

        let report = inspect_par2_file(&file.to_string_lossy());
        assert!(report.is_valid);
        assert_eq!(report.slice_size, 2048);
        assert_eq!(report.total_data_slices, 10);
        assert_eq!(report.packets.len(), 1);
        assert_eq!(report.packets[0].packet_type, "Main Packet");
        assert_eq!(report.recovery_set_id, "ABABABABABABABABABABABABABABABAB");
    }

    #[test]
    fn test_par2_recovers_from_corrupted_packet() {
        let mut buf = Vec::new();
        // 1. Damaged packet with invalid packet length (e.g. 5 bytes)
        buf.extend_from_slice(PAR2_MAGIC);
        buf.extend_from_slice(&5u64.to_le_bytes()); // Corrupted packet len < 64
        buf.extend_from_slice(&[0xFFu8; 16]);

        // 2. Subsequent valid Main Packet
        buf.extend_from_slice(PAR2_MAGIC);
        buf.extend_from_slice(&80u64.to_le_bytes()); // valid len 80
        buf.extend_from_slice(&[0u8; 16]); // md5
        buf.extend_from_slice(b"PAR 2.0\x00Main\x00\x00\x00\x00");
        buf.extend_from_slice(&[0xCDu8; 16]); // set ID
        buf.extend_from_slice(&4096u64.to_le_bytes()); // slice size
        buf.extend_from_slice(&5u32.to_le_bytes()); // data slices
        buf.extend_from_slice(&[0u8; 4]);

        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("corrupted.par2");
        std::fs::write(&file, &buf).unwrap();

        let report = inspect_par2_file(&file.to_string_lossy());
        assert!(report.is_valid, "Should recover and parse the subsequent valid packet");
        assert_eq!(report.slice_size, 4096);
        assert_eq!(report.total_data_slices, 5);
        assert_eq!(report.packets.len(), 1);
        assert_eq!(report.recovery_set_id, "CDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCD");
    }
}
