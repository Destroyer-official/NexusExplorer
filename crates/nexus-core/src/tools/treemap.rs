//! Visual Disk Space Treemap Analyzer (WinDirStat / SpaceMonger Engine).
//!
//! High-throughput recursive disk space scanning with pure Rust squarified treemap
//! geometric layout generation for visual identification of storage hogs.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreemapRect {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub is_dir: bool,
    pub ext: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub color: String,
    pub children: Vec<TreemapRect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreemapAnalysis {
    pub root_path: String,
    pub total_bytes: u64,
    pub file_count: usize,
    pub dir_count: usize,
    pub elapsed_ms: u64,
    pub root: TreemapRect,
}

struct RawNode {
    path: PathBuf,
    name: String,
    is_dir: bool,
    ext: String,
    size: u64,
    children: Vec<RawNode>,
}

fn color_for_extension(ext: &str, is_dir: bool) -> &'static str {
    if is_dir {
        return "#334155";
    }
    match ext.to_lowercase().as_str() {
        "mp4" | "mkv" | "mov" | "avi" | "webm" | "wmv" => "#8b5cf6", // Purple (Video)
        "zip" | "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" | "iso" => "#ef4444", // Red (Archive/ISO)
        "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a" => "#f97316", // Orange (Audio)
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "svg" | "psd" => "#10b981", // Green (Images)
        "rs" | "ts" | "js" | "py" | "go" | "cpp" | "c" | "h" | "json" => "#06b6d4", // Cyan (Code)
        "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "md" => "#3b82f6", // Blue (Docs)
        "exe" | "dll" | "sys" | "msi" | "bin" => "#64748b", // Slate (System/Bin)
        _ => "#a855f7",
    }
}

/// Recursively scans directory and builds size tree.
fn scan_raw_tree(path: &Path, max_depth: usize, current_depth: usize, file_cnt: &mut usize, dir_cnt: &mut usize) -> RawNode {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_string();
    let is_dir = path.is_dir();

    if !is_dir {
        *file_cnt += 1;
        let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        return RawNode {
            path: path.to_path_buf(),
            name,
            is_dir: false,
            ext,
            size,
            children: Vec::new(),
        };
    }

    *dir_cnt += 1;
    let mut total_size = 0u64;
    let mut children = Vec::new();

    if current_depth < max_depth {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                let child = scan_raw_tree(&p, max_depth, current_depth + 1, file_cnt, dir_cnt);
                total_size += child.size;
                children.push(child);
            }
        }
    } else {
        // Just sum shallow files
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(m) = entry.metadata() {
                    total_size += m.len();
                    if m.is_dir() { *dir_cnt += 1; } else { *file_cnt += 1; }
                }
            }
        }
    }

    // Sort children by size descending
    children.sort_by_key(|a| std::cmp::Reverse(a.size));

    RawNode {
        path: path.to_path_buf(),
        name,
        is_dir: true,
        ext,
        size: total_size,
        children,
    }
}

/// Computes squarified slice layout inside a rectangle `(x, y, w, h)`.
fn layout_children(nodes: &[RawNode], x: f64, y: f64, w: f64, h: f64, depth: usize) -> Vec<TreemapRect> {
    if nodes.is_empty() || w <= 1.0 || h <= 1.0 {
        return Vec::new();
    }

    let total_size: u64 = nodes.iter().map(|n| n.size).sum();
    if total_size == 0 {
        return Vec::new();
    }

    let mut result = Vec::with_capacity(nodes.len());
    let is_horizontal = w >= h;

    let mut current_offset = if is_horizontal { x } else { y };
    let span = if is_horizontal { w } else { h };
    let cross_span = if is_horizontal { h } else { w };

    for node in nodes {
        let fraction = (node.size as f64) / (total_size as f64);
        let node_span = (span * fraction).max(1.0);

        let (nx, ny, nw, nh) = if is_horizontal {
            (current_offset, y, node_span, cross_span)
        } else {
            (x, current_offset, cross_span, node_span)
        };

        current_offset += node_span;

        let color = color_for_extension(&node.ext, node.is_dir).to_string();

        let sub_children = if node.is_dir && depth < 3 && nw > 10.0 && nh > 10.0 {
            // Inner padding for sub-directories
            let pad = 2.0;
            layout_children(&node.children, nx + pad, ny + pad, (nw - pad * 2.0).max(1.0), (nh - pad * 2.0).max(1.0), depth + 1)
        } else {
            Vec::new()
        };

        result.push(TreemapRect {
            path: node.path.to_string_lossy().to_string(),
            name: node.name.clone(),
            size_bytes: node.size,
            is_dir: node.is_dir,
            ext: node.ext.clone(),
            x: nx,
            y: ny,
            w: nw,
            h: nh,
            color,
            children: sub_children,
        });
    }

    result
}

/// Runs treemap storage analysis on `dir_path` within a virtual canvas (e.g. 1000 x 600).
pub fn analyze_treemap(
    dir_path: &Path,
    canvas_width: f64,
    canvas_height: f64,
    max_depth: Option<usize>,
) -> Result<TreemapAnalysis, String> {
    let started = Instant::now();
    if !dir_path.is_dir() {
        return Err(format!("path is not a directory: {}", dir_path.display()));
    }

    let mut file_count = 0usize;
    let mut dir_count = 0usize;
    let depth = max_depth.unwrap_or(4);

    let raw_root = scan_raw_tree(dir_path, depth, 0, &mut file_count, &mut dir_count);
    let total_bytes = raw_root.size;

    let children = layout_children(&raw_root.children, 0.0, 0.0, canvas_width, canvas_height, 0);

    let root_rect = TreemapRect {
        path: raw_root.path.to_string_lossy().to_string(),
        name: raw_root.name.clone(),
        size_bytes: total_bytes,
        is_dir: true,
        ext: String::new(),
        x: 0.0,
        y: 0.0,
        w: canvas_width,
        h: canvas_height,
        color: "#1e293b".to_string(),
        children,
    };

    Ok(TreemapAnalysis {
        root_path: dir_path.to_string_lossy().to_string(),
        total_bytes,
        file_count,
        dir_count,
        elapsed_ms: started.elapsed().as_millis() as u64,
        root: root_rect,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_treemap_analysis() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("media");
        fs::create_dir_all(&sub).unwrap();

        fs::write(dir.path().join("code.rs"), vec![0x20; 1000]).unwrap();
        fs::write(sub.join("video.mp4"), vec![0x42; 5000]).unwrap();

        let analysis = analyze_treemap(dir.path(), 800.0, 600.0, Some(3)).unwrap();
        assert_eq!(analysis.total_bytes, 6000);
        assert!(analysis.root.children.len() >= 2);
    }
}

