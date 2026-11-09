import { useEffect, useState, useRef } from "react";
import { ipc } from "@/lib/ipc";
import type { TreemapAnalysis, TreemapRect } from "@/types";
import { formatBytes } from "@/lib/format";
import { X, PieChart, RefreshCw, ZoomIn, ArrowUp, ExternalLink } from "lucide-react";
import { useAppStore } from "@/state/store";

interface TreemapModalProps {
  initialPath: string;
  onClose: () => void;
}

const CATEGORIES = [
  { label: "Video", color: "#8b5cf6" },
  { label: "Archive / ISO", color: "#ef4444" },
  { label: "Audio", color: "#f97316" },
  { label: "Images", color: "#10b981" },
  { label: "Code", color: "#06b6d4" },
  { label: "Documents", color: "#3b82f6" },
  { label: "System / Binary", color: "#64748b" },
];

export default function TreemapModal({ initialPath, onClose }: TreemapModalProps) {
  const store = useAppStore();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [analysis, setAnalysis] = useState<TreemapAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredRect, setHoveredRect] = useState<TreemapRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadTreemap = async (path: string) => {
    setLoading(true);
    setHoveredRect(null);
    try {
      const data = await ipc.toolsAnalyzeTreemap(path, 900, 500, 4);
      setAnalysis(data);
      setCurrentPath(path);
    } catch (e: any) {
      store.pushToast("error", "Treemap analysis failed", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTreemap(initialPath);
  }, [initialPath]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card" role="dialog" aria-modal="true" aria-label="Disk space"
        style={{ width: 940, maxWidth: "96vw", height: 680, display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PieChart size={18} color="var(--accent)" />
          <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Visual Disk Space Treemap: </span>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{currentPath}</span>
          </div>
          {analysis && (
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              {formatBytes(analysis.totalBytes)} ({analysis.fileCount.toLocaleString()} files, {analysis.dirCount.toLocaleString()} folders)
            </span>
          )}
          <button className="icon-btn" aria-label="Close disk space" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Toolbar & Category Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-subtle)",
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn btn-sm"
            onClick={() => {
              const parts = currentPath.split(/[\\/]/);
              if (parts.length > 1) {
                parts.pop();
                const parent = parts.join("\\") || parts.join("/");
                if (parent) loadTreemap(parent);
              }
            }}
            title="Go to parent directory"
          >
            <ArrowUp size={13} /> Parent
          </button>

          <button className="icon-btn" onClick={() => loadTreemap(currentPath)} title="Re-scan directory">
            <RefreshCw size={13} />
          </button>

          {/* Color legend pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            {CATEGORIES.map((c) => (
              <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                <span style={{ color: "var(--text-dim)" }}>{c.label}</span>
              </span>
            ))}
          </div>

          <span style={{ flex: 1 }} />

          {analysis && (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Scanned in {analysis.elapsedMs} ms</span>
          )}
        </div>

        {/* Treemap Canvas Container */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            position: "relative",
            background: "#0f172a",
            overflow: "hidden",
            margin: 12,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}
        >
          {loading ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
              Scanning directory structure and computing squarified layout...
            </div>
          ) : analysis?.root.children ? (
            <svg
              viewBox="0 0 900 500"
              style={{ width: "100%", height: "100%", display: "block" }}
              preserveAspectRatio="none"
            >
              {renderRectNodes(analysis.root.children, setHoveredRect, loadTreemap)}
            </svg>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>No files found in directory.</div>
          )}
        </div>

        {/* Bottom Inspection Card */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            fontSize: 12,
            background: "var(--bg-card)",
            minHeight: 44,
            gap: 12,
          }}
        >
          {hoveredRect ? (
            <>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: hoveredRect.color,
                  display: "inline-block",
                }}
              />
              <span style={{ fontWeight: 600 }}>{hoveredRect.name}</span>
              <span style={{ color: "var(--accent)" }}>{formatBytes(hoveredRect.sizeBytes)}</span>
              <span style={{ color: "var(--text-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {hoveredRect.path}
              </span>
              <button
                className="btn btn-sm"
                onClick={() => void ipc.revealInShell(hoveredRect.path)}
                title="Reveal file in Windows Explorer"
              >
                <ExternalLink size={12} /> Reveal
              </button>
              {hoveredRect.isDir && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => loadTreemap(hoveredRect.path)}
                  title="Zoom into this subfolder"
                >
                  <ZoomIn size={12} /> Zoom In
                </button>
              )}
            </>
          ) : (
            <span style={{ color: "var(--text-faint)" }}>
              Hover over any rectangle to inspect size and path. Double-click or click Zoom In on folders to navigate.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function renderRectNodes(
  nodes: TreemapRect[],
  onHover: (r: TreemapRect | null) => void,
  onNavigate: (path: string) => void,
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (const node of nodes) {
    if (node.w < 2.0 || node.h < 2.0) continue;

    elements.push(
      <g key={node.path}>
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          fill={node.color}
          stroke="#0f172a"
          strokeWidth={1}
          style={{
            cursor: node.isDir ? "pointer" : "default",
            opacity: 0.9,
            transition: "opacity 0.1s ease",
          }}
          onMouseEnter={() => onHover(node)}
          onDoubleClick={() => {
            if (node.isDir) onNavigate(node.path);
          }}
        />
        {/* Render text label if rectangle is large enough */}
        {node.w > 45 && node.h > 18 && (
          <text
            x={node.x + 4}
            y={node.y + 13}
            fill="#ffffff"
            fontSize={10}
            fontFamily="sans-serif"
            fontWeight={600}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {node.name.length > Math.floor(node.w / 7)
              ? node.name.slice(0, Math.max(3, Math.floor(node.w / 7) - 2)) + "…"
              : node.name}
          </text>
        )}
        {node.children && node.children.length > 0 && renderRectNodes(node.children, onHover, onNavigate)}
      </g>
    );
  }

  return elements;
}
