//! Remote SSH / SFTP Explorer and Connection Profiles Engine.
//! Manages remote server configurations, directory listings, and SFTP transfers.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SftpProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String, // "key" | "password" | "agent"
    pub private_key_path: Option<String>,
    pub remote_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub permissions: String,
    pub owner: String,
    pub modified: String,
}

pub fn get_sftp_profiles_path(custom_dir: Option<&Path>) -> PathBuf {
    if let Some(dir) = custom_dir {
        dir.join("sftp_profiles.json")
    } else {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let nexus_dir = home.join(".nexus");
        let _ = std::fs::create_dir_all(&nexus_dir);
        nexus_dir.join("sftp_profiles.json")
    }
}

pub fn list_sftp_profiles(custom_dir: Option<&Path>) -> Result<Vec<SftpProfile>, String> {
    let path = get_sftp_profiles_path(custom_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| format!("cannot read profiles: {e}"))?;
    let profiles: Vec<SftpProfile> = serde_json::from_str(&data).unwrap_or_default();
    Ok(profiles)
}

pub fn save_sftp_profile(profile: SftpProfile, custom_dir: Option<&Path>) -> Result<(), String> {
    let mut profiles = list_sftp_profiles(custom_dir)?;
    if let Some(idx) = profiles.iter().position(|p| p.id == profile.id) {
        profiles[idx] = profile;
    } else {
        profiles.push(profile);
    }

    let path = get_sftp_profiles_path(custom_dir);
    let json = serde_json::to_string_pretty(&profiles).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("failed to write {path:?}: {e}"))?;
    Ok(())
}

pub fn delete_sftp_profile(id: &str, custom_dir: Option<&Path>) -> Result<(), String> {
    let mut profiles = list_sftp_profiles(custom_dir)?;
    profiles.retain(|p| p.id != id);

    let path = get_sftp_profiles_path(custom_dir);
    let json = serde_json::to_string_pretty(&profiles).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("failed to write {path:?}: {e}"))?;
    Ok(())
}

/// Parse output of unix `ls -la`
pub fn parse_unix_ls_output(output: &str) -> Vec<RemoteFileEntry> {
    let mut entries = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("total ") {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let permissions = parts[0];
        let is_dir = permissions.starts_with('d');
        let owner = parts[2];
        let size = parts[4].parse::<u64>().unwrap_or(0);
        let modified = format!("{} {} {}", parts[5], parts[6], parts[7]);
        let name = parts[8..].join(" ");

        if name == "." || name == ".." {
            continue;
        }

        entries.push(RemoteFileEntry {
            name,
            is_dir,
            size,
            permissions: permissions.to_string(),
            owner: owner.to_string(),
            modified,
        });
    }

    entries
}

/// Run an SSH command against a remote host using system OpenSSH client
pub fn run_remote_ssh_command(
    profile: &SftpProfile,
    command: &str,
) -> Result<String, String> {
    use std::process::Command;

    let mut cmd = Command::new("ssh");
    cmd.arg("-p").arg(profile.port.to_string());
    cmd.arg("-o").arg("BatchMode=yes");
    cmd.arg("-o").arg("StrictHostKeyChecking=accept-new");
    cmd.arg("-o").arg("ConnectTimeout=5");

    if let Some(key) = &profile.private_key_path {
        if !key.is_empty() {
            cmd.arg("-i").arg(key);
        }
    }

    let target = format!("{}@{}", profile.username, profile.host);
    cmd.arg(target);
    cmd.arg(command);

    let output = cmd.output().map_err(|e| format!("failed to execute ssh command: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("ssh execution failed: {stderr} {stdout}"));
    }

    Ok(stdout.to_string())
}

pub fn list_remote_directory(
    profile: &SftpProfile,
    path: Option<&str>,
) -> Result<Vec<RemoteFileEntry>, String> {
    let target_dir = path.unwrap_or(&profile.remote_path);
    let cmd = format!("ls -la '{target_dir}'");
    let stdout = run_remote_ssh_command(profile, &cmd)?;
    Ok(parse_unix_ls_output(&stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sftp_profile_crud() {
        let temp = tempfile::tempdir().unwrap();
        let custom_dir = temp.path();

        let profile = SftpProfile {
            id: "prof-123".to_string(),
            name: "Cloud Server".to_string(),
            host: "192.168.1.100".to_string(),
            port: 2222,
            username: "nexus".to_string(),
            auth_type: "key".to_string(),
            private_key_path: Some("~/.ssh/id_ed25519".to_string()),
            remote_path: "/var/www".to_string(),
        };

        save_sftp_profile(profile.clone(), Some(custom_dir)).unwrap();

        let loaded = list_sftp_profiles(Some(custom_dir)).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "Cloud Server");
        assert_eq!(loaded[0].port, 2222);

        delete_sftp_profile("prof-123", Some(custom_dir)).unwrap();
        let loaded2 = list_sftp_profiles(Some(custom_dir)).unwrap();
        assert!(loaded2.is_empty());
    }

    #[test]
    fn test_parse_unix_ls() {
        let raw_ls = r#"
total 36
drwxr-xr-x  5 root root  4096 Oct 30 12:00 .
drwxr-xr-x 20 root root  4096 Oct 20 09:15 ..
-rw-r--r--  1 root root  1234 Oct 30 11:59 index.html
drwxr-xr-x  2 root root  4096 Oct 30 11:58 static
-rwxr-xr-x  1 root root 20480 Oct 30 11:57 server.bin
"#;

        let entries = parse_unix_ls_output(raw_ls);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].name, "index.html");
        assert!(!entries[0].is_dir);
        assert_eq!(entries[0].size, 1234);

        assert_eq!(entries[1].name, "static");
        assert!(entries[1].is_dir);

        assert_eq!(entries[2].name, "server.bin");
        assert_eq!(entries[2].size, 20480);
    }
}

