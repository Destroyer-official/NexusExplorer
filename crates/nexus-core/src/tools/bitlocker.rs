//! BitLocker Drive Encryption Status and Lock/Unlock Controller.
//! Queries volume protection state and manages unlocking/locking of encrypted volumes.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BitLockerVolumeStatus {
    pub drive_letter: String,
    pub volume_type: String,
    pub encryption_status: String,
    pub lock_status: String,
    pub protection_status: String,
    pub percentage_encrypted: f32,
    pub key_protectors: Vec<String>,
}

pub fn parse_manage_bde_output(output: &str) -> Vec<BitLockerVolumeStatus> {
    let mut results = Vec::new();

    let mut current_drive = String::new();
    let mut current_type = "Fixed Data".to_string();
    let mut current_enc_status = "Unknown".to_string();
    let mut current_lock_status = "Unlocked".to_string();
    let mut current_prot_status = "Unknown".to_string();
    let mut current_pct = 0.0f32;
    let mut current_keys = Vec::new();
    let mut in_key_protectors = false;

    let flush = |drives: &mut Vec<BitLockerVolumeStatus>,
                 drive: &str,
                 v_type: &str,
                 enc: &str,
                 lock: &str,
                 prot: &str,
                 pct: f32,
                 keys: &[String]| {
        if !drive.is_empty() {
            drives.push(BitLockerVolumeStatus {
                drive_letter: drive.to_string(),
                volume_type: v_type.to_string(),
                encryption_status: enc.to_string(),
                lock_status: lock.to_string(),
                protection_status: prot.to_string(),
                percentage_encrypted: pct,
                key_protectors: keys.to_vec(),
            });
        }
    };

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let lower = trimmed.to_lowercase();
        if lower.starts_with("volume ") {
            flush(
                &mut results,
                &current_drive,
                &current_type,
                &current_enc_status,
                &current_lock_status,
                &current_prot_status,
                current_pct,
                &current_keys,
            );

            // e.g. "Volume C: [OSDisk]" or "Volume D:"
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            current_drive = parts.get(1).unwrap_or(&"").trim_end_matches(':').to_string();
            if !current_drive.is_empty() {
                current_drive = format!("{}:", current_drive);
            }
            current_type = if lower.contains("operating system") {
                "Operating System".to_string()
            } else {
                "Data Volume".to_string()
            };
            current_enc_status = "Unknown".to_string();
            current_lock_status = "Unlocked".to_string();
            current_prot_status = "Unknown".to_string();
            current_pct = 0.0;
            current_keys.clear();
            in_key_protectors = false;
        } else if lower.contains("conversion status:") {
            current_enc_status = trimmed.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if lower.contains("percentage encrypted:") {
            let num_str = trimmed.split(':').nth(1).unwrap_or("").trim().trim_end_matches('%');
            current_pct = num_str.parse::<f32>().unwrap_or(0.0);
        } else if lower.contains("protection status:") {
            current_prot_status = trimmed.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if lower.contains("lock status:") {
            current_lock_status = trimmed.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if lower.contains("key protectors:") {
            in_key_protectors = true;
        } else if in_key_protectors
            && (trimmed.starts_with("Numerical Password")
                || trimmed.starts_with("TPM")
                || trimmed.starts_with("Password")
                || trimmed.starts_with("External Key"))
        {
            current_keys.push(trimmed.to_string());
        }
    }

    flush(
        &mut results,
        &current_drive,
        &current_type,
        &current_enc_status,
        &current_lock_status,
        &current_prot_status,
        current_pct,
        &current_keys,
    );

    results
}

#[cfg(windows)]
pub fn get_bitlocker_status(drive: Option<&str>) -> Result<Vec<BitLockerVolumeStatus>, String> {
    use std::process::Command;

    let mut cmd = Command::new("manage-bde");
    cmd.arg("-status");
    if let Some(d) = drive {
        let clean = d.trim_end_matches(['\\', '/']);
        cmd.arg(clean);
    }

    let output = cmd.output().map_err(|e| format!("failed to run manage-bde: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    if !stdout.contains("BitLocker Drive Encryption") && !output.status.success() {
        return Err(format!("manage-bde returned error: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(parse_manage_bde_output(&stdout))
}

#[cfg(not(windows))]
pub fn get_bitlocker_status(_drive: Option<&str>) -> Result<Vec<BitLockerVolumeStatus>, String> {
    Err("BitLocker is only supported on Windows".to_string())
}

#[cfg(windows)]
pub fn unlock_bitlocker_volume(
    drive: &str,
    password: Option<&str>,
    recovery_key: Option<&str>,
) -> Result<String, String> {
    use std::process::Command;

    let clean = drive.trim_end_matches(['\\', '/']);
    let mut cmd = Command::new("manage-bde");
    cmd.arg("-unlock").arg(clean);

    if let Some(pass) = password {
        cmd.arg("-Password").arg(pass);
    } else if let Some(rec) = recovery_key {
        cmd.arg("-RecoveryPassword").arg(rec);
    } else {
        return Err("Either password or recovery key must be provided to unlock BitLocker volume".to_string());
    }

    let output = cmd.output().map_err(|e| format!("failed to execute manage-bde -unlock: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("unlock failed: {stderr} {stdout}"));
    }

    Ok(stdout.trim().to_string())
}

#[cfg(not(windows))]
pub fn unlock_bitlocker_volume(_drive: &str, _password: Option<&str>, _recovery_key: Option<&str>) -> Result<String, String> {
    Err("BitLocker unlock is only supported on Windows".to_string())
}

#[cfg(windows)]
pub fn lock_bitlocker_volume(drive: &str) -> Result<String, String> {
    use std::process::Command;

    let clean = drive.trim_end_matches(['\\', '/']);
    let mut cmd = Command::new("manage-bde");
    cmd.arg("-lock").arg(clean).arg("-ForceDismount");

    let output = cmd.output().map_err(|e| format!("failed to execute manage-bde -lock: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("lock failed: {stderr} {stdout}"));
    }

    Ok(stdout.trim().to_string())
}

#[cfg(not(windows))]
pub fn lock_bitlocker_volume(_drive: &str) -> Result<String, String> {
    Err("BitLocker lock is only supported on Windows".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_manage_bde_output() {
        let sample = r#"
BitLocker Drive Encryption: Configuration Tool version 10.0.26100
Copyright (C) 2013 Microsoft Corporation. All rights reserved.

Disk volumes that can be protected with
BitLocker Drive Encryption:
Volume C: [OS]
    [OS Volume]
    Conversion Status:    Fully Encrypted
    Percentage Encrypted: 100.0%
    Encryption Method:    XTS-AES 128
    Protection Status:    Protection On
    Lock Status:          Unlocked
    Identification Field: None
    Key Protectors:
        TPM
        Numerical Password

Volume E: [Vault]
    [Data Volume]
    Conversion Status:    Fully Encrypted
    Percentage Encrypted: 100.0%
    Encryption Method:    XTS-AES 256
    Protection Status:    Protection On
    Lock Status:          Locked
    Identification Field: None
    Key Protectors:
        Password
"#;

        let res = parse_manage_bde_output(sample);
        assert_eq!(res.len(), 2);
        assert_eq!(res[0].drive_letter, "C:");
        assert_eq!(res[0].lock_status, "Unlocked");
        assert_eq!(res[0].protection_status, "Protection On");
        assert_eq!(res[0].percentage_encrypted, 100.0);
        assert!(res[0].key_protectors.contains(&"TPM".to_string()));

        assert_eq!(res[1].drive_letter, "E:");
        assert_eq!(res[1].lock_status, "Locked");
        assert!(res[1].key_protectors.contains(&"Password".to_string()));
    }
}

