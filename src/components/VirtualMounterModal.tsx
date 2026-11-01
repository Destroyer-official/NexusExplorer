import { useState, useEffect } from "react";
import { X, HardDrive, Unlink, RefreshCw, Plus } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { useAppStore } from "@/state/store";
import type { VirtualMount } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialSource?: string;
}

export function VirtualMounterModal({ isOpen, onClose, initialSource }: Props) {
  const store = useAppStore();
  const [mounts, setMounts] = useState<VirtualMount[]>([]);
  const [sourcePath, setSourcePath] = useState(initialSource ?? "");
  const [selectedLetter, setSelectedLetter] = useState("Z");
  const [loading, setLoading] = useState(false);

  const fetchMounts = async () => {
    try {
      const res = await ipc.toolsMounterList();
      setMounts(res);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      if (initialSource) setSourcePath(initialSource);
      void fetchMounts();
    }
  }, [isOpen, initialSource]);

  if (!isOpen) return null;

  const handleMount = async () => {
    if (!sourcePath.trim()) return;
    setLoading(true);
    try {
      const mount = await ipc.toolsMounterMount(sourcePath, selectedLetter);
      store.pushToast("success", "Drive Mounted", `Mounted to ${mount.driveLetter}:\\ successfully.`);
      await fetchMounts();
      await store.refreshDrives();
      setSourcePath("");
    } catch (e: any) {
      store.pushToast("error", "Mount Failed", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUnmount = async (letter: string) => {
    try {
      await ipc.toolsMounterUnmount(letter);
      store.pushToast("info", "Drive Unmounted", `Unmounted drive ${letter}:\\.`);
      await fetchMounts();
      await store.refreshDrives();
    } catch (e: any) {
      store.pushToast("error", "Unmount Failed", e?.message || String(e));
    }
  };

  return (
    <div className="palette-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 650, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(14, 165, 233, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HardDrive size={18} style={{ color: "#0ea5e9" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Universal Virtual Drive Mounter</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Mount archives, SFTP mounts, & folders as Windows drive letters (Z:\, Y:\)</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="icon-btn" onClick={fetchMounts} title="Refresh">
              <RefreshCw size={14} />
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Mount Controls */}
          <div style={{ background: "var(--surface)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Mount New Virtual Drive</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Path to .zip, .iso, .tar archive or directory..."
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                style={{ flex: 1, height: 34, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0 10px", fontSize: 12, color: "var(--text)" }}
              />
              <select
                value={selectedLetter}
                onChange={(e) => setSelectedLetter(e.target.value)}
                style={{ width: 64, height: 34, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0 8px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}
              >
                {["Z", "Y", "X", "W", "V", "U", "T", "S", "R", "Q", "P"].map((l) => (
                  <option key={l} value={l}>
                    {l}:
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={handleMount}
                disabled={loading || !sourcePath.trim()}
                style={{ height: 34, display: "flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} /> {loading ? "Mounting..." : "Mount Drive"}
              </button>
            </div>
          </div>

          {/* Active Mounts List */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Active Virtual Mounts ({mounts.length})
            </div>
            {mounts.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mounts.map((m) => (
                  <div
                    key={m.driveLetter}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: "var(--accent-subtle)",
                          color: "var(--accent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {m.driveLetter}:
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{m.driveLetter}:\\</span>
                          <span style={{ fontSize: 11, color: "var(--text-faint)", background: "var(--bg)", padding: "1px 6px", borderRadius: 4 }}>
                            {m.mountType.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Source: {m.sourcePath}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => void store.navigateTo(`${m.driveLetter}:\\`)}
                      >
                        Open
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleUnmount(m.driveLetter)}
                        style={{ color: "#ef4444" }}
                        title="Unmount virtual drive"
                      >
                        <Unlink size={13} /> Unmount
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: "var(--text-dim)", background: "var(--surface)", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)" }}>
                No active virtual drive letter mounts. Mount an archive or folder above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

