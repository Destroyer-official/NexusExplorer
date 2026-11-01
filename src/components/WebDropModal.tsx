import { useState, useEffect } from "react";
import { X, QrCode, Smartphone, Wifi, Download, Upload, ExternalLink, RefreshCw } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { useAppStore } from "@/state/store";
import type { WebDropStatus } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  filesToShare?: string[];
}

export function WebDropModal({ isOpen, onClose, filesToShare = [] }: Props) {
  const store = useAppStore();
  const [status, setStatus] = useState<WebDropStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await ipc.toolsWebdropStatus();
      setStatus(res);
    } catch { }
  };

  const handleStartShare = async () => {
    setLoading(true);
    try {
      const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
      const targets = filesToShare.length > 0
        ? filesToShare
        : activeTab?.selected.length
          ? activeTab.selected
          : activeTab?.entries.slice(0, 10).map((e) => e.path) ?? [];

      const res = await ipc.toolsWebdropStart(targets);
      setStatus(res);
      store.pushToast("success", "WebDrop Active", `Portal online at ${res.url}`);
    } catch (e: any) {
      store.pushToast("error", "WebDrop Failed", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleStopShare = async () => {
    try {
      await ipc.toolsWebdropStop();
      await fetchStatus();
      store.pushToast("info", "WebDrop Stopped", "Local transfer portal shut down.");
    } catch { }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="palette-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(168, 85, 247, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Smartphone size={18} style={{ color: "#a855f7" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Mobile QR-Code AirDrop / Direct WebDrop</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Instant zero-install Wi-Fi transfers to iPhone & Android</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn" onClick={fetchStatus} title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          {status?.isActive ? (
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {/* Dynamic QR SVG */}
              <div
                style={{
                  width: 220,
                  height: 220,
                  background: "#ffffff",
                  padding: 10,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                dangerouslySetInnerHTML={{ __html: status.qrSvg }}
              />

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                  <Wifi size={16} /> Live on Local Wi-Fi Network
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  Scan this QR code with your iPhone or Android camera to open the instant transfer portal.
                </div>
                <div
                  style={{
                    background: "var(--surface)",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span>{status.url}</span>
                  <button
                    className="icon-btn"
                    style={{ width: 22, height: 22 }}
                    onClick={() => void store.copyText(status.url, "URL copied")}
                    title="Copy URL"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Download size={13} style={{ color: "#38bdf8" }} />
                    Downloads: <b>{status.downloadsCompleted}</b>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Upload size={13} style={{ color: "#10b981" }} />
                    Uploads: <b>{status.uploadsReceived}</b>
                  </div>
                </div>

                <button className="btn btn-sm" onClick={handleStopShare} style={{ alignSelf: "flex-start", marginTop: 6 }}>
                  Stop WebDrop Server
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "30px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <QrCode size={48} style={{ color: "var(--text-faint)" }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>WebDrop Server is Offline</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 420 }}>
                Launch the embedded high-speed gigabit Wi-Fi portal to stream files directly to mobile devices without cloud uploads or cables.
              </div>
              <button
                className="btn btn-primary"
                onClick={handleStartShare}
                disabled={loading}
                style={{ marginTop: 6 }}
              >
                {loading ? "Starting Server..." : "Launch WebDrop Portal & QR Code"}
              </button>
            </div>
          )}

          {/* Shared files list */}
          {status?.sharedFiles && status.sharedFiles.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Actively Shared Files ({status.sharedFiles.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {status.sharedFiles.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{f.name}</span>
                    <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      {formatBytes(f.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
