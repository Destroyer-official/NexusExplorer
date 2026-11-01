//! Zero-Config Local P2P Mesh Sharing & LAN File Streaming (100% Rust).
//!
//! Provides automatic UDP LAN beacon discovery, peer registry tracking,
//! high-throughput chunked TCP file streaming, and XXH3 integrity verification with zero cloud dependencies.

use std::collections::HashMap;
use std::fs;
use std::net::UdpSocket;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use uuid::Uuid;
use xxhash_rust::xxh3::xxh3_64;

pub const MESH_UDP_PORT: u16 = 52491;
pub const MESH_TCP_PORT: u16 = 52492;
pub const MESH_PROTOCOL: &str = "nexus-mesh-v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshPeer {
    pub device_id: String,
    pub device_name: String,
    pub os: String,
    pub ip_address: String,
    pub tcp_port: u16,
    pub last_seen_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshBeacon {
    pub protocol: String,
    pub device_id: String,
    pub device_name: String,
    pub os: String,
    pub tcp_port: u16,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshFileHeader {
    pub file_name: String,
    pub file_size: u64,
    pub xxh3_checksum: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshTransferReport {
    pub total_files: usize,
    pub total_bytes: u64,
    pub target_peer: String,
    pub success: bool,
    pub duration_ms: u64,
    pub error_message: Option<String>,
}

// Thread-safe peer registry & lifecycle state
#[doc(hidden)]
mod state {
    use super::*;
    use std::sync::OnceLock;

    static REGISTRY: OnceLock<Arc<RwLock<HashMap<String, MeshPeer>>>> = OnceLock::new();
    static RUNNING: OnceLock<Arc<AtomicBool>> = OnceLock::new();

    pub fn get_registry() -> &'static Arc<RwLock<HashMap<String, MeshPeer>>> {
        REGISTRY.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
    }

    pub fn get_running() -> &'static Arc<AtomicBool> {
        RUNNING.get_or_init(|| Arc::new(AtomicBool::new(false)))
    }
}

pub fn get_local_device_info() -> (String, String, String) {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "NexusDevice".into());

    let os = std::env::consts::OS.to_string();
    let id_file = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("nexus")
        .join("device_id.txt");

    let device_id = if let Ok(id) = fs::read_to_string(&id_file) {
        id.trim().to_string()
    } else {
        let new_id = Uuid::new_v4().to_string();
        if let Some(parent) = id_file.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&id_file, &new_id);
        new_id
    };

    (device_id, hostname, os)
}

/// Starts the background UDP discovery broadcaster & listener, and TCP receiver.
pub fn start_mesh_service() -> Result<(), String> {
    let running = state::get_running();
    if running.swap(true, Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    let (device_id, device_name, os) = get_local_device_info();

    // 1. UDP Discovery Broadcaster
    let b_id = device_id.clone();
    let b_name = device_name.clone();
    let b_os = os.clone();
    std::thread::spawn(move || {
        let socket = match UdpSocket::bind("0.0.0.0:0") {
            Ok(s) => s,
            Err(_) => return,
        };
        let _ = socket.set_broadcast(true);

        while state::get_running().load(Ordering::SeqCst) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            let beacon = MeshBeacon {
                protocol: MESH_PROTOCOL.to_string(),
                device_id: b_id.clone(),
                device_name: b_name.clone(),
                os: b_os.clone(),
                tcp_port: MESH_TCP_PORT,
                timestamp_ms: now,
            };

            if let Ok(json) = serde_json::to_string(&beacon) {
                let _ = socket.send_to(json.as_bytes(), format!("255.255.255.255:{}", MESH_UDP_PORT));
            }

            std::thread::sleep(Duration::from_secs(3));
        }
    });

    // 2. UDP Discovery Listener
    let local_id = device_id.clone();
    std::thread::spawn(move || {
        let socket = match UdpSocket::bind(format!("0.0.0.0:{}", MESH_UDP_PORT)) {
            Ok(s) => s,
            Err(_) => return,
        };
        let mut buf = [0u8; 2048];

        while state::get_running().load(Ordering::SeqCst) {
            if let Ok((len, src)) = socket.recv_from(&mut buf) {
                if let Ok(beacon) = serde_json::from_slice::<MeshBeacon>(&buf[..len]) {
                    if beacon.protocol == MESH_PROTOCOL && beacon.device_id != local_id {
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);

                        let peer = MeshPeer {
                            device_id: beacon.device_id.clone(),
                            device_name: beacon.device_name,
                            os: beacon.os,
                            ip_address: src.ip().to_string(),
                            tcp_port: beacon.tcp_port,
                            last_seen_ms: now,
                        };

                        let registry = state::get_registry();
                        registry.write().insert(beacon.device_id, peer);
                    }
                }
            }
        }
    });

    // 3. TCP Receiver Daemon
    tokio::spawn(async move {
        if let Ok(listener) = TcpListener::bind(format!("0.0.0.0:{}", MESH_TCP_PORT)).await {
            while state::get_running().load(Ordering::SeqCst) {
                if let Ok((socket, _)) = listener.accept().await {
                    tokio::spawn(handle_incoming_transfer(socket));
                }
            }
        }
    });

    Ok(())
}

async fn handle_incoming_transfer(mut socket: TcpStream) -> Result<(), String> {
    // Read 4-byte header length
    let mut len_buf = [0u8; 4];
    socket.read_exact(&mut len_buf).await.map_err(|e| e.to_string())?;
    let header_len = u32::from_be_bytes(len_buf) as usize;

    if header_len > 65536 {
        return Err("header too large".into());
    }

    let mut header_buf = vec![0u8; header_len];
    socket.read_exact(&mut header_buf).await.map_err(|e| e.to_string())?;
    let header: MeshFileHeader = serde_json::from_slice(&header_buf).map_err(|e| e.to_string())?;

    // Ack header
    socket.write_all(b"OK\n").await.map_err(|e| e.to_string())?;

    let download_dir = dirs::download_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("NexusReceived");
    let _ = tokio::fs::create_dir_all(&download_dir).await;

    let dest_path = download_dir.join(&header.file_name);
    let mut file = tokio::fs::File::create(&dest_path).await.map_err(|e| e.to_string())?;

    let mut remaining = header.file_size;
    let mut chunk = [0u8; 65536];
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();

    while remaining > 0 {
        let to_read = (remaining as usize).min(chunk.len());
        let n = socket.read(&mut chunk[..to_read]).await.map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&chunk[..n]);
        file.write_all(&chunk[..n]).await.map_err(|e| e.to_string())?;
        remaining -= n as u64;
    }

    file.flush().await.map_err(|e| e.to_string())?;
    let calculated = hasher.digest();

    if header.xxh3_checksum != 0 && calculated != header.xxh3_checksum {
        return Err("XXH3 checksum mismatch on received mesh file".into());
    }

    let _ = socket.write_all(b"COMPLETE\n").await;
    Ok(())
}

/// Retrieves list of actively discovered LAN mesh peers.
pub fn get_active_peers() -> Vec<MeshPeer> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let registry = state::get_registry();
    let mut peers: Vec<MeshPeer> = registry
        .read()
        .values()
        // Peer considered active if seen in the last 15 seconds
        .filter(|p| now.saturating_sub(p.last_seen_ms) < 15_000)
        .cloned()
        .collect();

    peers.sort_by_key(|a| std::cmp::Reverse(a.last_seen_ms));
    peers
}

/// Sends files over TCP directly to a target peer.
pub async fn send_files_to_peer(
    target_ip: &str,
    target_port: u16,
    file_paths: &[String],
) -> Result<MeshTransferReport, String> {
    let start_time = SystemTime::now();
    let mut total_bytes = 0u64;
    let mut sent_count = 0;

    for path_str in file_paths {
        let path = Path::new(path_str);
        if !path.is_file() {
            continue;
        }

        let meta = tokio::fs::metadata(path).await.map_err(|e| e.to_string())?;
        let file_size = meta.len();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file.bin")
            .to_string();

        // Calculate XXH3
        let bytes = tokio::fs::read(path).await.map_err(|e| e.to_string())?;
        let checksum = xxh3_64(&bytes);

        let mut stream = TcpStream::connect(format!("{}:{}", target_ip, target_port))
            .await
            .map_err(|e| format!("cannot connect to peer {}:{}: {}", target_ip, target_port, e))?;

        let header = MeshFileHeader {
            file_name,
            file_size,
            xxh3_checksum: checksum,
        };

        let header_json = serde_json::to_vec(&header).map_err(|e| e.to_string())?;
        let header_len = (header_json.len() as u32).to_be_bytes();

        stream.write_all(&header_len).await.map_err(|e| e.to_string())?;
        stream.write_all(&header_json).await.map_err(|e| e.to_string())?;

        // Wait for Ack
        let mut ack = [0u8; 3];
        stream.read_exact(&mut ack).await.map_err(|e| e.to_string())?;
        if &ack != b"OK\n" {
            return Err("peer refused transfer header".into());
        }

        // Stream file contents
        stream.write_all(&bytes).await.map_err(|e| e.to_string())?;
        stream.flush().await.map_err(|e| e.to_string())?;

        total_bytes += file_size;
        sent_count += 1;
    }

    let elapsed = start_time.elapsed().map(|d| d.as_millis() as u64).unwrap_or(0);

    Ok(MeshTransferReport {
        total_files: sent_count,
        total_bytes,
        target_peer: format!("{}:{}", target_ip, target_port),
        success: true,
        duration_ms: elapsed,
        error_message: None,
    })
}

/// Synchronous blocking wrapper for sending files to a peer.
pub fn send_files_to_peer_blocking(
    target_ip: &str,
    target_port: u16,
    file_paths: &[String],
) -> Result<MeshTransferReport, String> {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    rt.block_on(send_files_to_peer(target_ip, target_port, file_paths))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_info() {
        let (id, name, os) = get_local_device_info();
        assert!(!id.is_empty());
        assert!(!name.is_empty());
        assert!(!os.is_empty());
    }

    #[test]
    fn test_beacon_serialization() {
        let beacon = MeshBeacon {
            protocol: MESH_PROTOCOL.to_string(),
            device_id: "test-id".to_string(),
            device_name: "test-host".to_string(),
            os: "windows".to_string(),
            tcp_port: 52492,
            timestamp_ms: 1234567,
        };

        let json = serde_json::to_string(&beacon).unwrap();
        let parsed: MeshBeacon = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.device_id, "test-id");
        assert_eq!(parsed.tcp_port, 52492);
    }
}
