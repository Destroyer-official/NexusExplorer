//! Tamper-Evident File Provenance & Cryptographic Audit Log Engine.
//! Records an append-only cryptographic ledger (Merkle-chain) of all file operations
//! (create, modify, transfer, clone, shred, vault) with BLAKE3 hash chaining.

use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

pub const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceEvent {
    pub sequence: u64,
    pub timestamp: String,
    pub event_type: String,
    pub file_path: String,
    pub file_size: u64,
    pub blake3_digest: String,
    pub actor: String,
    pub prev_chain_hash: String,
    pub chain_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceVerification {
    pub is_valid: bool,
    pub total_records: usize,
    pub genesis_hash: String,
    pub latest_chain_hash: String,
    pub error_message: Option<String>,
    pub tampered_record_sequence: Option<u64>,
}

#[allow(clippy::too_many_arguments)]
pub fn compute_chain_hash(
    sequence: u64,
    timestamp: &str,
    event_type: &str,
    file_path: &str,
    file_size: u64,
    blake3_digest: &str,
    actor: &str,
    prev_chain_hash: &str,
) -> String {
    let payload = format!(
        "{sequence}|{timestamp}|{event_type}|{file_path}|{file_size}|{blake3_digest}|{actor}|{prev_chain_hash}"
    );
    blake3::hash(payload.as_bytes()).to_hex().to_string()
}

pub fn get_provenance_log_path(custom_dir: Option<&Path>) -> PathBuf {
    if let Some(dir) = custom_dir {
        dir.join("provenance.jsonl")
    } else {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let nexus_dir = home.join(".nexus");
        let _ = std::fs::create_dir_all(&nexus_dir);
        nexus_dir.join("provenance.jsonl")
    }
}

pub fn read_provenance_records(custom_dir: Option<&Path>) -> Result<Vec<ProvenanceEvent>, String> {
    let log_path = get_provenance_log_path(custom_dir);
    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&log_path).map_err(|e| format!("cannot open provenance log: {e}"))?;
    let reader = BufReader::new(file);
    let mut records = Vec::new();

    for (idx, line) in reader.lines().enumerate() {
        let l = line.map_err(|e| format!("line {idx} read error: {e}"))?;
        let trimmed = l.trim();
        if trimmed.is_empty() {
            continue;
        }
        let event: ProvenanceEvent = serde_json::from_str(trimmed)
            .map_err(|e| format!("corrupt json at line {idx}: {e}"))?;
        records.push(event);
    }

    Ok(records)
}

pub fn record_provenance_event(
    event_type: &str,
    target_path: &Path,
    actor: Option<&str>,
    custom_dir: Option<&Path>,
) -> Result<ProvenanceEvent, String> {
    let log_path = get_provenance_log_path(custom_dir);
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let existing = read_provenance_records(custom_dir)?;
    let sequence = existing.len() as u64 + 1;
    let prev_chain_hash = existing.last().map(|e| e.chain_hash.clone()).unwrap_or_else(|| GENESIS_HASH.to_string());

    let (file_size, blake3_digest) = if target_path.exists() && target_path.is_file() {
        let size = std::fs::metadata(target_path).map(|m| m.len()).unwrap_or(0);
        let bytes = std::fs::read(target_path).unwrap_or_default();
        let digest = blake3::hash(&bytes).to_hex().to_string();
        (size, digest)
    } else {
        (0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string())
    };

    let timestamp = chrono::Utc::now().to_rfc3339();
    let actor_str = actor.unwrap_or("nexus-user").to_string();
    let file_path_str = target_path.to_string_lossy().to_string();

    let chain_hash = compute_chain_hash(
        sequence,
        &timestamp,
        event_type,
        &file_path_str,
        file_size,
        &blake3_digest,
        &actor_str,
        &prev_chain_hash,
    );

    let event = ProvenanceEvent {
        sequence,
        timestamp,
        event_type: event_type.to_string(),
        file_path: file_path_str,
        file_size,
        blake3_digest,
        actor: actor_str,
        prev_chain_hash,
        chain_hash,
    };

    let line = serde_json::to_string(&event).map_err(|e| e.to_string())?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("cannot open {log_path:?} for append: {e}"))?;

    writeln!(file, "{line}").map_err(|e| format!("failed to append to provenance: {e}"))?;
    file.sync_all().map_err(|e| format!("failed to sync provenance log: {e}"))?;

    Ok(event)
}

pub fn verify_provenance_chain(custom_dir: Option<&Path>) -> Result<ProvenanceVerification, String> {
    let records = read_provenance_records(custom_dir)?;
    if records.is_empty() {
        return Ok(ProvenanceVerification {
            is_valid: true,
            total_records: 0,
            genesis_hash: GENESIS_HASH.to_string(),
            latest_chain_hash: GENESIS_HASH.to_string(),
            error_message: None,
            tampered_record_sequence: None,
        });
    }

    let mut prev_hash = GENESIS_HASH.to_string();

    for (i, rec) in records.iter().enumerate() {
        let expected_seq = (i + 1) as u64;
        if rec.sequence != expected_seq {
            return Ok(ProvenanceVerification {
                is_valid: false,
                total_records: records.len(),
                genesis_hash: GENESIS_HASH.to_string(),
                latest_chain_hash: records.last().unwrap().chain_hash.clone(),
                error_message: Some(format!(
                    "Sequence gap detected at record {}: expected {}, found {}",
                    i, expected_seq, rec.sequence
                )),
                tampered_record_sequence: Some(rec.sequence),
            });
        }

        if rec.prev_chain_hash != prev_hash {
            return Ok(ProvenanceVerification {
                is_valid: false,
                total_records: records.len(),
                genesis_hash: GENESIS_HASH.to_string(),
                latest_chain_hash: records.last().unwrap().chain_hash.clone(),
                error_message: Some(format!(
                    "Broken hash chain at sequence {}: recorded prev_hash '{}' does not match previous entry '{}'",
                    rec.sequence, rec.prev_chain_hash, prev_hash
                )),
                tampered_record_sequence: Some(rec.sequence),
            });
        }

        let computed = compute_chain_hash(
            rec.sequence,
            &rec.timestamp,
            &rec.event_type,
            &rec.file_path,
            rec.file_size,
            &rec.blake3_digest,
            &rec.actor,
            &rec.prev_chain_hash,
        );

        if computed != rec.chain_hash {
            return Ok(ProvenanceVerification {
                is_valid: false,
                total_records: records.len(),
                genesis_hash: GENESIS_HASH.to_string(),
                latest_chain_hash: records.last().unwrap().chain_hash.clone(),
                error_message: Some(format!(
                    "Tampered block content at sequence {}: hash recalculation mismatch",
                    rec.sequence
                )),
                tampered_record_sequence: Some(rec.sequence),
            });
        }

        prev_hash = rec.chain_hash.clone();
    }

    Ok(ProvenanceVerification {
        is_valid: true,
        total_records: records.len(),
        genesis_hash: GENESIS_HASH.to_string(),
        latest_chain_hash: prev_hash,
        error_message: None,
        tampered_record_sequence: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provenance_lifecycle_and_tamper_detection() {
        let temp = tempfile::tempdir().unwrap();
        let log_dir = temp.path();

        let dummy_file = log_dir.join("test_document.txt");
        std::fs::write(&dummy_file, b"Original sensitive content").unwrap();

        // 1. Record creation
        let e1 = record_provenance_event("CREATE", &dummy_file, Some("alice"), Some(log_dir)).unwrap();
        assert_eq!(e1.sequence, 1);
        assert_eq!(e1.prev_chain_hash, GENESIS_HASH);

        // 2. Record modification
        std::fs::write(&dummy_file, b"Updated sensitive content").unwrap();
        let e2 = record_provenance_event("MODIFY", &dummy_file, Some("bob"), Some(log_dir)).unwrap();
        assert_eq!(e2.sequence, 2);
        assert_eq!(e2.prev_chain_hash, e1.chain_hash);

        // 3. Verify valid chain
        let ver = verify_provenance_chain(Some(log_dir)).unwrap();
        assert!(ver.is_valid);
        assert_eq!(ver.total_records, 2);
        assert_eq!(ver.latest_chain_hash, e2.chain_hash);

        // 4. Introduce deliberate tamper into the log file
        let log_path = get_provenance_log_path(Some(log_dir));
        let content = std::fs::read_to_string(&log_path).unwrap();
        let tampered = content.replace("alice", "mallory");
        std::fs::write(&log_path, tampered).unwrap();

        // 5. Verification must detect the tamper!
        let ver_tampered = verify_provenance_chain(Some(log_dir)).unwrap();
        assert!(!ver_tampered.is_valid);
        assert_eq!(ver_tampered.tampered_record_sequence, Some(1));
    }
}

