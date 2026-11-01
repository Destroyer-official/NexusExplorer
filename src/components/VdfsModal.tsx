import { useState, useEffect } from "react";
import { X, RefreshCw, Layers, Database, Plus, CheckCircle, Server } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { useAppStore } from "@/state/store";
import type { VdfsSummary, VdfsIndexReport } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function VdfsModal({ isOpen, onClose }: Props) {
  const store = useAppStore();
  const [summary, setSummary] = useState<VdfsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexReport, setIndexReport] = useState<VdfsIndexReport | null>(null);
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState("nas");

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await ipc.toolsVdfsSummary();
      setSummary(res);
    } catch (e: any) {
      store.pushToast("error", "VDFS Error", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadSummary();
      setIndexReport(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleIndexActiveFolder = async () => {
    const tab = store.tabs.find((t) => t.id === store.activeTabId);
    if (!tab) return;
    setIndexing(true);
    try {
      const report = await ipc.toolsVdfsIndex(tab.path, "local-node");
      setIndexReport(report);
      store.pushToast(
        "success",
        "VDFS Indexed",
        `Indexed ${report.indexedFiles} files (${formatBytes(report.totalBytesScanned)}) into CAS.`
      );
      await loadSummary();
    } catch (e: any) {
      store.pushToast("error", "Index Failed", e?.message || String(e));
    } finally {
      setIndexing(false);
    }
  };

  const handleAddNode = async () => {
    if (!nodeName.trim()) return;
    const id = `node-${Date.now()}`;
    try {
      await ipc.toolsVdfsAddNode(id, nodeName, nodeType);
      store.pushToast("success", "Node Added", `Registered ${nodeName} to VDFS cluster.`);
      setNodeName("");
      await loadSummary();
    } catch (e: any) {
      store.pushToast("error", "Failed to add node", e?.message || String(e));
    }
  };

  return (
    <div className="palette-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 720, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(56, 189, 248, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={18} style={{ color: "#38bdf8" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Virtual Distributed Filesystem (VDFS & CAS)</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Content-Addressed Storage & Multi-Device Logical Namespace</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn" onClick={loadSummary} title="Refresh VDFS status">
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ background: "var(--surface)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Unique CAS Objects</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>{summary?.totalObjects ?? 0}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{formatBytes(summary?.totalLogicalBytes ?? 0)} logical content</div>
            </div>
            <div style={{ background: "var(--surface)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Physical Replicas</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "#38bdf8" }}>{summary?.totalPhysicalReplicas ?? 0}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{formatBytes(summary?.totalPhysicalBytes ?? 0)} physical on disk</div>
            </div>
            <div style={{ background: "var(--surface)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Deduplication Savings</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "#10b981" }}>{formatBytes(summary?.deduplicationSavingsBytes ?? 0)}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Zero physical storage waste</div>
            </div>
          </div>

          {/* Connected Cluster Nodes */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Server size={14} style={{ color: "#a855f7" }} />
              Cluster Nodes ({summary?.nodes.length ?? 0})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {summary?.nodes.map((n, idx) => {
                const nodeKey = n.id || (n as any).nodeId || `node-${idx}`;
                const isOnline = n.online ?? (n as any).isOnline ?? true;
                return (
                  <div
                    key={nodeKey}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "#10b981" : "#94a3b8" }} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{n.name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-faint)", background: "var(--bg)", padding: "1px 6px", borderRadius: 4 }}>
                        {n.nodeType.toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>ID: {nodeKey}</span>
                  </div>
                );
              })}
            </div>

            {/* Add Node row */}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                type="text"
                placeholder="New Node Name (e.g. NAS Backup, Laptop-M3)..."
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                style={{ flex: 1, height: 32, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0 10px", fontSize: 12, color: "var(--text)" }}
              />
              <select
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value)}
                style={{ height: 32, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0 8px", fontSize: 12, color: "var(--text)" }}
              >
                <option value="nas">NAS Storage</option>
                <option value="remote">Remote Workstation</option>
                <option value="cloud">Cloud S3 Bucket</option>
              </select>
              <button className="btn btn-sm" onClick={handleAddNode} style={{ height: 32 }}>
                <Plus size={13} /> Add Node
              </button>
            </div>
          </div>

          {/* Index Active Folder */}
          <div style={{ background: "rgba(56, 189, 248, 0.05)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Index Current Directory into CAS</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                Computes BLAKE3 cryptographic fingerprints to register files into the unified virtual catalog.
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleIndexActiveFolder}
              disabled={indexing}
              style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 120, justifyContent: "center" }}
            >
              <Database size={13} className={indexing ? "spin" : ""} />
              {indexing ? "Indexing..." : "Index Folder"}
            </button>
          </div>

          {indexReport && (
            <div style={{ background: "var(--surface)", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--accent-subtle)", fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontWeight: 600, color: "#10b981", display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={14} /> Indexing Complete in {indexReport.elapsedMs} ms
              </div>
              <div>• {indexReport.indexedFiles} total files scanned ({formatBytes(indexReport.totalBytesScanned)})</div>
              <div>• {indexReport.newObjects} new content objects registered</div>
              <div>• {indexReport.duplicateReplicasFound} duplicate replicas mapped across nodes</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

