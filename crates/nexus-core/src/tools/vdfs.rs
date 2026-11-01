//! Virtual Distributed Filesystem (VDFS) & Content-Addressed Storage (CAS).
//!
//! Inspired by Spacedrive VDFS:
//! - Aggregates multiple devices/volumes into a single logical content namespace.
//! - Hashes files using cryptographic BLAKE3 content-addressing.
//! - Tracks duplicate physical replicas across local drives, network shares, and remote machines.
//! - Computes exact deduplication savings without physical file movement.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReplicaLocation {
    pub node_id: String,
    pub path: String,
    pub verified_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CasObject {
    pub hash: String,
    pub size: u64,
    pub name: String,
    pub first_seen_ms: u64,
    pub replicas: Vec<ReplicaLocation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VdfsNode {
    pub id: String,
    pub name: String,
    pub node_type: String, // "local", "nas", "remote", "cloud"
    pub endpoint: Option<String>,
    pub online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VdfsCatalog {
    pub version: u32,
    pub nodes: Vec<VdfsNode>,
    pub objects: HashMap<String, CasObject>,
}

impl Default for VdfsCatalog {
    fn default() -> Self {
        let local_node = VdfsNode {
            id: "local-node".to_string(),
            name: "Local Workstation".to_string(),
            node_type: "local".to_string(),
            endpoint: None,
            online: true,
        };
        Self {
            version: 1,
            nodes: vec![local_node],
            objects: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VdfsSummary {
    pub total_objects: usize,
    pub total_logical_bytes: u64,
    pub total_physical_replicas: usize,
    pub total_physical_bytes: u64,
    pub deduplication_savings_bytes: u64,
    pub node_count: usize,
    pub nodes: Vec<VdfsNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VdfsIndexReport {
    pub node_id: String,
    pub indexed_files: usize,
    pub new_objects: usize,
    pub duplicate_replicas_found: usize,
    pub total_bytes_scanned: u64,
    pub elapsed_ms: u64,
}

fn catalog_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".nexus").join("vdfs_catalog.json")
}

pub fn load_catalog() -> VdfsCatalog {
    let p = catalog_path();
    if !p.exists() {
        return VdfsCatalog::default();
    }
    match fs::read_to_string(&p) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => VdfsCatalog::default(),
    }
}

pub fn save_catalog(cat: &VdfsCatalog) -> io::Result<()> {
    let p = catalog_path();
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let data = serde_json::to_string_pretty(cat)
        .map_err(io::Error::other)?;
    fs::write(p, data)
}

/// Compute BLAKE3 content hash for a file.
pub fn hash_file_blake3<P: AsRef<Path>>(path: P) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

/// Index a path into the VDFS catalog under a specific node ID.
pub fn index_directory<P: AsRef<Path>>(
    root: P,
    node_id: &str,
    mut catalog: VdfsCatalog,
) -> io::Result<(VdfsCatalog, VdfsIndexReport)> {
    let root = root.as_ref();
    let start = std::time::Instant::now();
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut indexed_files = 0;
    let mut new_objects = 0;
    let mut duplicate_replicas_found = 0;
    let mut total_bytes_scanned = 0;

    let walker = jwalk::WalkDir::new(root)
        .follow_links(false)
        .skip_hidden(true);

    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let file_path = entry.path();
        let meta = match file_path.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = meta.len();
        total_bytes_scanned += size;
        indexed_files += 1;

        let hash = match hash_file_blake3(&file_path) {
            Ok(h) => h,
            Err(_) => continue,
        };

        let file_path_str = file_path.to_string_lossy().to_string();
        let file_name = file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed".to_string());

        let replica = ReplicaLocation {
            node_id: node_id.to_string(),
            path: file_path_str.clone(),
            verified_ms: now_ms,
        };

        if let Some(existing) = catalog.objects.get_mut(&hash) {
            if !existing.replicas.iter().any(|r| r.node_id == node_id && r.path == file_path_str) {
                existing.replicas.push(replica);
                duplicate_replicas_found += 1;
            }
        } else {
            catalog.objects.insert(
                hash.clone(),
                CasObject {
                    hash,
                    size,
                    name: file_name,
                    first_seen_ms: now_ms,
                    replicas: vec![replica],
                },
            );
            new_objects += 1;
        }
    }

    let report = VdfsIndexReport {
        node_id: node_id.to_string(),
        indexed_files,
        new_objects,
        duplicate_replicas_found,
        total_bytes_scanned,
        elapsed_ms: start.elapsed().as_millis() as u64,
    };

    Ok((catalog, report))
}

pub fn get_summary(cat: &VdfsCatalog) -> VdfsSummary {
    let mut total_logical_bytes = 0u64;
    let mut total_physical_replicas = 0usize;
    let mut total_physical_bytes = 0u64;

    for obj in cat.objects.values() {
        total_logical_bytes += obj.size;
        let rep_count = obj.replicas.len();
        total_physical_replicas += rep_count;
        total_physical_bytes += obj.size * (rep_count as u64);
    }

    let deduplication_savings_bytes = total_physical_bytes.saturating_sub(total_logical_bytes);

    VdfsSummary {
        total_objects: cat.objects.len(),
        total_logical_bytes,
        total_physical_replicas,
        total_physical_bytes,
        deduplication_savings_bytes,
        node_count: cat.nodes.len(),
        nodes: cat.nodes.clone(),
    }
}

pub fn add_node(
    cat: &mut VdfsCatalog,
    id: String,
    name: String,
    node_type: String,
    endpoint: Option<String>,
) {
    if let Some(existing) = cat.nodes.iter_mut().find(|n| n.id == id) {
        existing.name = name;
        existing.node_type = node_type;
        existing.endpoint = endpoint;
    } else {
        cat.nodes.push(VdfsNode {
            id,
            name,
            node_type,
            endpoint,
            online: true,
        });
    }
}

pub fn find_replicas<'a>(cat: &'a VdfsCatalog, hash: &str) -> Option<&'a [ReplicaLocation]> {
    cat.objects.get(hash).map(|o| o.replicas.as_slice())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_vdfs_cas_lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let file_a = dir.path().join("doc_a.txt");
        let file_b = dir.path().join("doc_b.txt"); // identical content
        let file_c = dir.path().join("doc_c.txt"); // different content

        let mut f = File::create(&file_a).unwrap();
        f.write_all(b"CAS_CONTENT_12345").unwrap();
        drop(f);

        let mut f = File::create(&file_b).unwrap();
        f.write_all(b"CAS_CONTENT_12345").unwrap();
        drop(f);

        let mut f = File::create(&file_c).unwrap();
        f.write_all(b"DIFFERENT_DATA_999").unwrap();
        drop(f);

        let catalog = VdfsCatalog::default();
        let (catalog, report) = index_directory(dir.path(), "local-node", catalog).unwrap();

        assert_eq!(report.indexed_files, 3);
        assert_eq!(report.new_objects, 2); // 2 unique content hashes
        assert_eq!(report.duplicate_replicas_found, 1); // 1 replica discovered

        let summary = get_summary(&catalog);
        assert_eq!(summary.total_objects, 2);
        assert_eq!(summary.total_physical_replicas, 3);
        assert!(summary.deduplication_savings_bytes > 0);

        let hash_a = hash_file_blake3(&file_a).unwrap();
        let replicas = find_replicas(&catalog, &hash_a).unwrap();
        assert_eq!(replicas.len(), 2);
    }
}

