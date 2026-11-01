//! End-to-End Cryptographic Vault Engine (AES-256-GCM + BLAKE3 KDF).
//!
//! Provides military-grade authenticated encryption for individual confidential files
//! and entire directory trees with zero metadata leakage.

use std::fs;
use std::path::Path;
use std::time::Instant;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use serde::{Deserialize, Serialize};

pub const VAULT_MAGIC: &[u8; 8] = b"NXVAULT1";
pub const SALT_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultHeaderInfo {
    pub is_valid_vault: bool,
    pub original_file_name: Option<String>,
    pub is_directory_vault: bool,
    pub ciphertext_len: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultOperationResult {
    pub success: bool,
    pub source_path: String,
    pub target_path: String,
    pub bytes_processed: u64,
    pub elapsed_ms: u64,
}

/// Derives a 256-bit AES key from a passphrase and 32-byte salt using BLAKE3 KDF.
fn derive_key(password: &str, salt: &[u8; SALT_LEN]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new_derive_key("NexusExplorer.Vault.AES256GCM.KeyDerivation.v1");
    hasher.update(salt);
    hasher.update(password.as_bytes());
    *hasher.finalize().as_bytes()
}

/// Encrypts an arbitrary byte payload using AES-256-GCM.
pub fn encrypt_bytes(data: &[u8], password: &str, original_filename: Option<&str>, is_dir: bool) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];

    // Generate cryptographically secure salt and nonce
    let mut prng = blake3::Hasher::new();
    prng.update(uuid::Uuid::new_v4().as_bytes());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
    prng.update(&now.to_le_bytes());
    let mut reader = prng.finalize_xof();
    reader.fill(&mut salt);
    reader.fill(&mut nonce_bytes);

    let key = derive_key(password, &salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("cipher init error: {e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Prepare metadata block: filename length (2 bytes), filename, is_dir flag (1 byte)
    let fname_bytes = original_filename.unwrap_or("").as_bytes();
    let mut meta_block = Vec::with_capacity(3 + fname_bytes.len());
    meta_block.extend_from_slice(&(fname_bytes.len() as u16).to_le_bytes());
    meta_block.extend_from_slice(fname_bytes);
    meta_block.push(if is_dir { 1 } else { 0 });

    // Combine metadata + payload
    let mut combined_plaintext = Vec::with_capacity(meta_block.len() + data.len());
    combined_plaintext.extend_from_slice(&meta_block);
    combined_plaintext.extend_from_slice(data);

    let ciphertext = cipher
        .encrypt(nonce, combined_plaintext.as_ref())
        .map_err(|e| format!("encryption failed: {e}"))?;

    // Format output: [NXVAULT1 (8B)] [SALT (32B)] [NONCE (12B)] [CIPHERTEXT + TAG]
    let mut output = Vec::with_capacity(VAULT_MAGIC.len() + SALT_LEN + NONCE_LEN + ciphertext.len());
    output.extend_from_slice(VAULT_MAGIC);
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);

    Ok(output)
}

/// Decrypts a vault byte buffer using AES-256-GCM.
pub fn decrypt_bytes(encrypted: &[u8], password: &str) -> Result<(Vec<u8>, Option<String>, bool), String> {
    if encrypted.len() < VAULT_MAGIC.len() + SALT_LEN + NONCE_LEN + 16 {
        return Err("data is too short to be a valid Nexus vault".into());
    }

    if &encrypted[..8] != VAULT_MAGIC {
        return Err("invalid vault magic header".into());
    }

    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&encrypted[8..8 + SALT_LEN]);

    let mut nonce_bytes = [0u8; NONCE_LEN];
    nonce_bytes.copy_from_slice(&encrypted[8 + SALT_LEN..8 + SALT_LEN + NONCE_LEN]);

    let ciphertext = &encrypted[8 + SALT_LEN + NONCE_LEN..];

    let key = derive_key(password, &salt);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("cipher init error: {e}"))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "authentication failed: invalid password or corrupted vault".to_string())?;

    if decrypted.len() < 3 {
        return Err("corrupted decrypted payload header".into());
    }

    let fname_len = u16::from_le_bytes([decrypted[0], decrypted[1]]) as usize;
    if decrypted.len() < 3 + fname_len {
        return Err("corrupted filename metadata".into());
    }

    let fname = if fname_len > 0 {
        Some(String::from_utf8_lossy(&decrypted[2..2 + fname_len]).to_string())
    } else {
        None
    };

    let is_dir = decrypted[2 + fname_len] == 1;
    let payload = decrypted[3 + fname_len..].to_vec();

    Ok((payload, fname, is_dir))
}

/// Encrypts a single file into a `.nxvault` file.
pub fn encrypt_file(
    src_file: &Path,
    vault_file: &Path,
    password: &str,
) -> Result<VaultOperationResult, String> {
    let started = Instant::now();
    let data = fs::read(src_file).map_err(|e| format!("cannot read source file: {e}"))?;
    let filename = src_file.file_name().and_then(|n| n.to_str());

    let encrypted = encrypt_bytes(&data, password, filename, false)?;

    if let Some(parent) = vault_file.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }

    fs::write(vault_file, &encrypted).map_err(|e| format!("cannot write vault file: {e}"))?;

    Ok(VaultOperationResult {
        success: true,
        source_path: src_file.to_string_lossy().to_string(),
        target_path: vault_file.to_string_lossy().to_string(),
        bytes_processed: data.len() as u64,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Decrypts a `.nxvault` file back to plain file.
pub fn decrypt_file(
    vault_file: &Path,
    dest_path: &Path,
    password: &str,
) -> Result<VaultOperationResult, String> {
    let started = Instant::now();
    let encrypted = fs::read(vault_file).map_err(|e| format!("cannot read vault file: {e}"))?;

    let (decrypted_payload, _fname, is_dir) = decrypt_bytes(&encrypted, password)?;
    if is_dir {
        return Err("this vault contains an encrypted directory; use decrypt_directory instead".into());
    }

    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }

    fs::write(dest_path, &decrypted_payload).map_err(|e| format!("cannot write decrypted file: {e}"))?;

    Ok(VaultOperationResult {
        success: true,
        source_path: vault_file.to_string_lossy().to_string(),
        target_path: dest_path.to_string_lossy().to_string(),
        bytes_processed: decrypted_payload.len() as u64,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Encrypts an entire directory into a single encrypted `.nxvault` container.
pub fn encrypt_directory(
    src_dir: &Path,
    vault_file: &Path,
    password: &str,
) -> Result<VaultOperationResult, String> {
    let started = Instant::now();
    if !src_dir.is_dir() {
        return Err("source is not a directory".into());
    }

    // First compress into a temporary zip archive
    let temp_zip_path = std::env::temp_dir().join(format!("nxvault_enc_{}.zip", uuid::Uuid::new_v4().simple()));

    let op_res = crate::tools::archive::create_zip_archive(
        &[src_dir.to_string_lossy().to_string()],
        &temp_zip_path.to_string_lossy(),
        6,
        |_, _, _| {},
    )?;

    if !op_res.success {
        let _ = fs::remove_file(&temp_zip_path);
        return Err(format!("compression failed: {:?}", op_res.error_message));
    }

    let zip_bytes = fs::read(&temp_zip_path).map_err(|e| {
        let _ = fs::remove_file(&temp_zip_path);
        format!("cannot read compressed archive: {e}")
    })?;
    let _ = fs::remove_file(&temp_zip_path);
    let dirname = src_dir.file_name().and_then(|n| n.to_str());

    let encrypted = encrypt_bytes(&zip_bytes, password, dirname, true)?;
    fs::write(vault_file, &encrypted).map_err(|e| format!("cannot write directory vault: {e}"))?;

    Ok(VaultOperationResult {
        success: true,
        source_path: src_dir.to_string_lossy().to_string(),
        target_path: vault_file.to_string_lossy().to_string(),
        bytes_processed: zip_bytes.len() as u64,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Decrypts a directory `.nxvault` container and unpacks all files.
pub fn decrypt_directory(
    vault_file: &Path,
    dest_dir: &Path,
    password: &str,
) -> Result<VaultOperationResult, String> {
    let started = Instant::now();
    let encrypted = fs::read(vault_file).map_err(|e| format!("cannot read vault file: {e}"))?;

    let (decrypted_zip, _dirname, is_dir) = decrypt_bytes(&encrypted, password)?;
    if !is_dir {
        return Err("this vault contains a single file, not a directory".into());
    }

    let temp_zip_path = std::env::temp_dir().join(format!("nxvault_dec_{}.zip", uuid::Uuid::new_v4().simple()));
    fs::write(&temp_zip_path, &decrypted_zip).map_err(|e| format!("cannot write temp archive: {e}"))?;

    if !dest_dir.exists() {
        fs::create_dir_all(dest_dir).map_err(|e| format!("cannot create target directory: {e}"))?;
    }

    let extract_res = crate::tools::archive::extract_zip_archive(
        &temp_zip_path.to_string_lossy(),
        &dest_dir.to_string_lossy(),
        None,
        |_, _, _| {},
    )?;
    let _ = fs::remove_file(&temp_zip_path);

    if !extract_res.success {
        return Err(format!("extraction failed: {:?}", extract_res.error_message));
    }

    Ok(VaultOperationResult {
        success: true,
        source_path: vault_file.to_string_lossy().to_string(),
        target_path: dest_dir.to_string_lossy().to_string(),
        bytes_processed: decrypted_zip.len() as u64,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_roundtrip_file() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("classified.pdf");
        let vault = dir.path().join("classified.pdf.nxvault");
        let restored = dir.path().join("classified_restored.pdf");

        let secret_payload = b"TOP SECRET MISSION DIRECTIVE 2027: All systems operational.";
        fs::write(&src, secret_payload).unwrap();

        let pass = "QuantumSecureKey#2027!";
        let enc_res = encrypt_file(&src, &vault, pass).unwrap();
        assert!(enc_res.success);
        assert!(vault.exists());

        // Attempt decrypt with wrong password -> must fail
        assert!(decrypt_file(&vault, &restored, "wrong_password").is_err());

        // Decrypt with correct password
        let dec_res = decrypt_file(&vault, &restored, pass).unwrap();
        assert!(dec_res.success);
        assert_eq!(fs::read(&restored).unwrap(), secret_payload);
    }

    #[test]
    fn test_vault_roundtrip_directory() {
        let dir = tempfile::tempdir().unwrap();
        let project_dir = dir.path().join("project_nexus");
        fs::create_dir_all(project_dir.join("src")).unwrap();
        fs::write(project_dir.join("README.md"), b"# Project Nexus").unwrap();
        fs::write(project_dir.join("src/main.rs"), b"fn main() {}").unwrap();

        let vault_file = dir.path().join("project.nxvault");
        let unpack_dir = dir.path().join("project_unpacked");

        let pass = "DevVaultPass999$";
        let enc_res = encrypt_directory(&project_dir, &vault_file, pass).unwrap();
        assert!(enc_res.success);
        assert!(vault_file.exists());

        let dec_res = decrypt_directory(&vault_file, &unpack_dir, pass).unwrap();
        assert!(dec_res.success);
        assert!(unpack_dir.join("README.md").exists() || unpack_dir.join("project_nexus/README.md").exists());
    }
}
