import { useState, useEffect } from "react";
import { X, Trash2, RefreshCw, Sparkles, FolderCheck, Folder } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { useAppStore } from "@/state/store";
import type { JanitorScanReport, EmptyDirsReport } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function JanitorModal({ isOpen, onClose }: Props) {
  const store = useAppStore();
  const [janitorTab, setJanitorTab] = useState<"artifacts" | "empty_dirs">("artifacts");
  const [report, setReport] = useState<JanitorScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const [emptyReport, setEmptyReport] = useState<EmptyDirsReport | null>(null);
  const [emptyScanning, setEmptyScanning] = useState(false);
  const [emptyCleaning, setEmptyCleaning] = useState(false);
  const [selectedEmptyDirs, setSelectedEmptyDirs] = useState<Set<string>>(new Set());

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

  const handleScanEmpty = async () => {
    const tab = store.tabs.find((t) => t.id === store.activeTabId);
    if (!tab) return;
    setEmptyScanning(true);
    try {
      const res = await ipc.toolsJanitorScanEmpty(tab.path);
      setEmptyReport(res);
      setSelectedEmptyDirs(new Set(res.emptyDirs));
      store.pushToast(
        "info",
        "Empty Directory Scan Complete",
        `Found ${res.emptyDirs.length} empty directory trees in ${res.elapsedMs} ms`
      );
    } catch (e: any) {
      store.pushToast("error", "Empty Scan Failed", e?.message || String(e));
    } finally {
      setEmptyScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (janitorTab === "artifacts") {
        void handleScan();
      } else {
        void handleScanEmpty();
      }
    }
  }, [isOpen, janitorTab]);

  if (!isOpen) return null;

  const toggleSelect = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedPaths(next);
  };

  const toggleSelectEmpty = (path: string) => {
    const next = new Set(selectedEmptyDirs);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedEmptyDirs(next);
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
      await store.refreshActive();
    } catch (e: any) {
      store.pushToast("error", "Clean Failed", e?.message || String(e));
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanEmpty = async () => {
    if (selectedEmptyDirs.size === 0) return;
    setEmptyCleaning(true);
    try {
      const paths = Array.from(selectedEmptyDirs);
      const res = await ipc.toolsJanitorCleanEmpty(paths);
      store.pushToast(
        "success",
        "Empty Directories Cleaned",
        `Removed ${res.removedCount} empty folders.`
      );
      await handleScanEmpty();
      await store.refreshActive();
    } catch (e: any) {
      store.pushToast("error", "Clean Failed", e?.message || String(e));
    } finally {
      setEmptyCleaning(false);
    }
  };

  const totalSelectedBytes = (report?.targets ?? [])
    .filter((t) => selectedPaths.has(t.path))
    .reduce((acc, t) => acc + t.sizeBytes, 0);

  return (
    <div className="palette-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="palette" role="dialog" aria-modal="true" aria-label="Clean build caches"
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
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Review generated folders before permanently deleting them.</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="icon-btn"
              onClick={janitorTab === "artifacts" ? handleScan : handleScanEmpty}
              disabled={janitorTab === "artifacts" ? scanning : emptyScanning}
              title="Rescan folder"
            >
              <RefreshCw size={14} className={(janitorTab === "artifacts" ? scanning : emptyScanning) ? "spin" : ""} />
            </button>
            <button className="icon-btn" aria-label="Close clean build caches" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg)", padding: "0 20px" }}>
          <button
            className={`btn btn-sm ${janitorTab === "artifacts" ? "active" : ""}`}
            onClick={() => setJanitorTab("artifacts")}
            style={{
              borderRadius: "4px 4px 0 0",
              borderBottom: janitorTab === "artifacts" ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: janitorTab === "artifacts" ? "var(--text)" : "var(--text-dim)",
              fontWeight: janitorTab === "artifacts" ? 600 : 400,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            Build Artifacts & Caches
          </button>
          <button
            className={`btn btn-sm ${janitorTab === "empty_dirs" ? "active" : ""}`}
            onClick={() => setJanitorTab("empty_dirs")}
            style={{
              borderRadius: "4px 4px 0 0",
              borderBottom: janitorTab === "empty_dirs" ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: janitorTab === "empty_dirs" ? "var(--text)" : "var(--text-dim)",
              fontWeight: janitorTab === "empty_dirs" ? 600 : 400,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            Empty Directory Trees
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {janitorTab === "artifacts" ? (
            <>
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
                  onClick={() => store.openConfirm({ title: "Delete selected build caches?", description: "This permanently removes " + selectedPaths.size + " selected cache folders. Review the selected paths before continuing.", confirmLabel: "Delete caches", danger: true, onConfirm: handleClean })}
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
                            onChange={() => { }}
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
            </>
          ) : (
            <>
              {/* Empty Dirs View */}
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
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Orphaned Empty Folders</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", marginTop: 2 }}>
                    {selectedEmptyDirs.size} selected
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    Total discovered: {emptyReport?.emptyDirs.length ?? 0} empty folders in {emptyReport?.scannedDirs ?? 0} scanned directories
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => store.openConfirm({
                    title: "Delete selected empty folders?",
                    description: `This permanently removes ${selectedEmptyDirs.size} selected empty folders.`,
                    confirmLabel: "Delete empty folders",
                    danger: true,
                    onConfirm: handleCleanEmpty,
                  })}
                  disabled={emptyCleaning || selectedEmptyDirs.size === 0}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                  }}
                >
                  <Trash2 size={14} />
                  {emptyCleaning ? "Deleting..." : `Clean ${selectedEmptyDirs.size} Folders`}
                </button>
              </div>

              {emptyScanning ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-dim)" }}>
                  Scanning directory tree for empty folders...
                </div>
              ) : emptyReport && emptyReport.emptyDirs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {emptyReport.emptyDirs.map((dirPath) => {
                    const isSelected = selectedEmptyDirs.has(dirPath);
                    return (
                      <div
                        key={dirPath}
                        onClick={() => toggleSelectEmpty(dirPath)}
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
                            onChange={() => { }}
                            style={{ cursor: "pointer" }}
                          />
                          <Folder size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 600 }}>{dirPath.split(/[\\/]/).pop()}</span>
                            <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{dirPath}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-dim)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <FolderCheck size={36} style={{ color: "#10b981" }} />
                  <div style={{ fontWeight: 600 }}>No Empty Directories Found</div>
                  <div style={{ fontSize: 12 }}>Every folder in the scanned directory tree contains files.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

