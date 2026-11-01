import { useState, useEffect } from "react";
import { X, Trash2, RefreshCw, Sparkles, FolderCheck } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { useAppStore } from "@/state/store";
import type { JanitorScanReport } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function JanitorModal({ isOpen, onClose }: Props) {
  const store = useAppStore();
  const [report, setReport] = useState<JanitorScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const handleScan = async () => {
    const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
    if (!activeTab) return;
    setScanning(true);
    try {
      const res = await ipc.toolsJanitorScan(activeTab.path);
      setReport(res);
      // Auto-select all detected artifact folders
      setSelectedPaths(new Set(res.targets.map((t) => t.path)));
      store.pushToast(
        "info",
        "Janitor Scan Complete",
        `Found ${res.targets.length} artifact targets (${formatBytes(res.totalReclaimableBytes)} reclaimable)`
      );
    } catch (e: any) {
      store.pushToast("error", "Scan Failed", e?.message || String(e));
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void handleScan();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedPaths(next);
  };

  const handleClean = async () => {
    if (selectedPaths.size === 0) return;
    setCleaning(true);
    try {
      const paths = Array.from(selectedPaths);
      const res = await ipc.toolsJanitorClean(paths);
      store.pushToast(
        "success",
        "Janitor Clean Complete",
        `Cleaned ${res.cleanedTargets} folders. Reclaimed ${formatBytes(res.bytesFreed)}!`
      );
      // Refresh scan
      await handleScan();
    } catch (e: any) {
      store.pushToast("error", "Clean Failed", e?.message || String(e));
    } finally {
      setCleaning(false);
    }
  };

  const totalSelectedBytes = (report?.targets ?? [])
    .filter((t) => selectedPaths.has(t.path))
    .reduce((acc, t) => acc + t.sizeBytes, 0);

  return (
    <div className="palette-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 750, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(244, 63, 94, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={18} style={{ color: "#f43f5e" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Developer Cache & Build Artifact Janitor</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Safe deep clean of node_modules, target, .venv, .gradle & build layers</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn" onClick={handleScan} disabled={scanning} title="Rescan folder">
              <RefreshCw size={14} className={scanning ? "spin" : ""} />
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Reclaimable Space</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f43f5e", marginTop: 2 }}>
                {formatBytes(totalSelectedBytes)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Selected: {selectedPaths.size} of {report?.targets.length ?? 0} artifact folders
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleClean}
              disabled={cleaning || selectedPaths.size === 0}
              style={{
                background: "#f43f5e",
                borderColor: "#f43f5e",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
              }}
            >
              <Sparkles size={14} />
              {cleaning ? "Cleaning..." : `Reclaim ${formatBytes(totalSelectedBytes)}`}
            </button>
          </div>

          {/* Results List */}
          {scanning ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-dim)" }}>
              Scanning directories for build artifacts...
            </div>
          ) : report && report.targets.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {report.targets.map((t) => {
                const isSelected = selectedPaths.has(t.path);
                return (
                  <div
                    key={t.path}
                    onClick={() => toggleSelect(t.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: isSelected ? "var(--surface-hover)" : "var(--surface)",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: "pointer" }}
                      />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{t.name}</span>
                          <span style={{ fontSize: 11, color: "var(--text-faint)", background: "var(--bg)", padding: "1px 6px", borderRadius: 4 }}>
                            {t.category}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 440 }}>
                          {t.path}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600, color: "#f43f5e", fontFamily: "var(--font-mono)" }}>
                        {formatBytes(t.sizeBytes)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                        {t.fileCount} files
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-dim)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <FolderCheck size={36} style={{ color: "#10b981" }} />
              <div style={{ fontWeight: 600 }}>No Disk-Hogging Build Artifacts Found</div>
              <div style={{ fontSize: 12 }}>The scanned directory is completely clean.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

