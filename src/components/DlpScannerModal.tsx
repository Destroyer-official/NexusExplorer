import { useState, useEffect } from "react";
import { X, ShieldAlert, AlertOctagon, CheckCircle2, RefreshCw, EyeOff } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { useAppStore } from "@/state/store";
import type { DlpScanReport } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetPaths?: string[];
}

export function DlpScannerModal({ isOpen, onClose, targetPaths = [] }: Props) {
  const store = useAppStore();
  const [report, setReport] = useState<DlpScanReport | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
    if (!activeTab) return;
    const paths = targetPaths.length > 0
      ? targetPaths
      : activeTab.selected.length > 0
      ? activeTab.selected
      : [activeTab.path];

    setScanning(true);
    try {
      const res = await ipc.toolsDlpScan(paths);
      setReport(res);
      if (res.totalFindings === 0) {
        store.pushToast("success", "DLP Scan Clean", `Scanned ${res.scannedFiles} files. Zero leaks found.`);
      } else {
        store.pushToast("warning", "DLP Secrets Detected", `Found ${res.totalFindings} exposed credentials!`);
      }
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
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldAlert size={18} style={{ color: "#ef4444" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Sensitive Data Loss Prevention (DLP) Scanner</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Pre-flight leak detection for API keys, private credentials & PII</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn" onClick={handleScan} disabled={scanning} title="Rescan">
              <RefreshCw size={14} className={scanning ? "spin" : ""} />
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Status summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${(report?.totalFindings ?? 0) > 0 ? "rgba(239, 68, 68, 0.4)" : "var(--border)"}`,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Scan Status</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: (report?.totalFindings ?? 0) > 0 ? "#ef4444" : "#10b981", marginTop: 2 }}>
                {(report?.totalFindings ?? 0) > 0 ? `${report?.totalFindings} Potential Secret Leaks` : "All Files Secure"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Scanned {report?.scannedFiles ?? 0} files in {report?.elapsedMs ?? 0} ms
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ textAlign: "center", padding: "6px 14px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Affected Files</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{report?.filesWithFindings ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Finding items */}
          {scanning ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-dim)" }}>
              Scanning files for unmasked credentials and tokens...
            </div>
          ) : report && report.findings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Detected Findings</div>
              {report.findings.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 14px",
                    background: "var(--surface)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    fontSize: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertOctagon size={14} style={{ color: "#ef4444" }} />
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{f.ruleName}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: f.severity === "critical" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: f.severity === "critical" ? "#ef4444" : "#f59e0b",
                        }}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <span style={{ color: "var(--text-faint)", fontSize: 11 }}>Line {f.lineNumber}</span>
                  </div>

                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {f.filePath}
                  </div>

                  <div
                    style={{
                      background: "var(--bg)",
                      padding: "6px 10px",
                      borderRadius: 4,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "#fbbf24",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <EyeOff size={12} />
                    <span>{f.maskedSnippet}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 30, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-dim)" }}>
              <CheckCircle2 size={40} style={{ color: "#10b981" }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Clean - No Secrets or API Keys Detected</div>
              <div style={{ fontSize: 12, maxWidth: 380 }}>
                This folder is safe for public git commits, cloud sharing, and archive distribution.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

