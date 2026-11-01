//! Volume Shadow Copy (VSS) / "Previous Versions" Engine.
//! Allows browsing historical volume snapshots and restoring past file revisions.

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VssSnapshot {
    pub id: String,
    pub volume_name: String,
    pub snapshot_path: String,
    pub creation_time: String,
    pub provider: String,
    pub attributes: String,
}

/// Parse output of `vssadmin list shadows`
pub fn parse_vssadmin_output(output: &str) -> Vec<VssSnapshot> {
    let mut snapshots = Vec::new();
    let mut current_id = String::new();
    let mut current_vol = String::new();
    let mut current_path = String::new();
    let mut current_time = String::new();
    let mut current_provider = String::new();
    let mut current_attrs = String::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let lower = trimmed.to_lowercase();
        if lower.contains("shadow copy id:") {
            if !current_id.is_empty() && !current_path.is_empty() {
                snapshots.push(VssSnapshot {
                    id: current_id.clone(),
                    volume_name: current_vol.clone(),
                    snapshot_path: current_path.clone(),
                    creation_time: current_time.clone(),
                    provider: current_provider.clone(),
                    attributes: current_attrs.clone(),
                });
            }
            current_id = trimmed.split(':').nth(1).unwrap_or("").trim().to_string();
            current_vol.clear();
            current_path.clear();
            current_time.clear();
            current_provider.clear();
            current_attrs.clear();
        } else if lower.contains("original volume:") {
            current_vol = trimmed.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if lower.contains("shadow copy volume:") || lower.contains("shadow copy volume name:") {
            if let Some(pos) = trimmed.find(r"\\?\GLOBALROOT") {
                current_path = trimmed[pos..].trim().to_string();
            } else {
                current_path = trimmed.split(':').skip(1).collect::<Vec<_>>().join(":").trim().to_string();
            }
        } else if lower.contains("creation time:") {
            current_time = trimmed.split(':').skip(1).collect::<Vec<_>>().join(":").trim().to_string();
        } else if lower.contains("provider:") {
            current_provider = trimmed.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if lower.contains("attributes:") {
            current_attrs = trimmed.split(':').nth(1).unwrap_or("").trim().to_string();
        }
    }

    if !current_id.is_empty() && !current_path.is_empty() {
        snapshots.push(VssSnapshot {
            id: current_id,
            volume_name: current_vol,
            snapshot_path: current_path,
            creation_time: current_time,
            provider: current_provider,
            attributes: current_attrs,
        });
    }

    snapshots
}

#[cfg(windows)]
pub fn list_vss_snapshots(volume: Option<&str>) -> Result<Vec<VssSnapshot>, String> {
    use std::process::Command;

    let mut cmd = Command::new("vssadmin");
    cmd.arg("list").arg("shadows");
    if let Some(vol) = volume {
        let clean = vol.trim_end_matches(['\\', '/']);
        cmd.arg(format!("/for={clean}\\"));
    }

    let output = cmd.output().map_err(|e| format!("failed to execute vssadmin: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() && !stdout.contains("Shadow Copy ID:") {
        return Err(format!("vssadmin error (status {}): {stderr}", output.status));
    }

    Ok(parse_vssadmin_output(&stdout))
}

#[cfg(not(windows))]
pub fn list_vss_snapshots(_volume: Option<&str>) -> Result<Vec<VssSnapshot>, String> {
    Err("Volume Shadow Copy (VSS) is only supported on Windows".to_string())
}

/// Restore a file from a shadow copy volume snapshot to a specified target.
pub fn restore_vss_file(
    snapshot_path: &str,
    relative_file_path: &str,
    destination: &Path,
) -> Result<u64, String> {
    let clean_snap = snapshot_path.trim_end_matches(['\\', '/']);
    let clean_rel = relative_file_path.trim_start_matches(['\\', '/']);
    let full_src = format!("{clean_snap}\\{clean_rel}");

    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("cannot create destination dir: {e}"))?;
    }

    let bytes = std::fs::copy(&full_src, destination)
        .map_err(|e| format!("failed to copy from VSS snapshot path '{full_src}' to '{destination:?}': {e}"))?;

    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_vssadmin_output() {
        let sample_output = r#"
vssadmin 1.1 - Volume Shadow Copy Service administrative command-line tool
(C) Copyright 2001-2013 Microsoft Corp.

Contents of shadow copy set ID: {41214e4b-972a-4f51-b016-cfc16fa55523}
   Contained 1 shadow copies at creation time: 10/25/2026 8:30:15 AM
      Shadow Copy ID: {e4566b7a-97a2-4a0b-9232-23cbb147dafa}
         Original Volume: (C:)\\?\Volume{12345678-1234-1234-1234-123456789abc}\
         Shadow Copy Volume: \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1
         Originating Machine: DESKTOP-NEXUS
         Service Machine: DESKTOP-NEXUS
         Provider: 'Microsoft Software Shadow Copy provider 1.0'
         Type: ClientAccessibleWriters
         Attributes: Persistent, Client-accessible, No auto release, Differential, Auto recovered
"#;

        let snapshots = parse_vssadmin_output(sample_output);
        assert_eq!(snapshots.len(), 1);
        let snap = &snapshots[0];
        assert_eq!(snap.id, "{e4566b7a-97a2-4a0b-9232-23cbb147dafa}");
        assert_eq!(snap.snapshot_path, r"\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1");
        assert!(snap.attributes.contains("Persistent"));
    }
}

