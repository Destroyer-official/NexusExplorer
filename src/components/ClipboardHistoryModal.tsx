import { useState } from "react";
import { X, Clipboard, Copy, ArrowDownRight, Trash2 } from "lucide-react";
import { useAppStore, cutClipboard } from "@/state/store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ClipSlot {
  id: number;
  label: string;
  paths: string[];
  op: "copy" | "cut";
  timestamp: number;
}

export function ClipboardHistoryModal({ isOpen, onClose }: Props) {
  const store = useAppStore();
  const [activeSlot, setActiveSlot] = useState(0);

  // Maintain 4 persistent memory slots
  const [slots, setSlots] = useState<ClipSlot[]>([
    { id: 0, label: "Slot 1 (Primary)", paths: cutClipboard.paths ?? [], op: (cutClipboard.mode as "copy" | "cut") ?? "copy", timestamp: Date.now() },
    { id: 1, label: "Slot 2 (Staging A)", paths: [], op: "copy", timestamp: Date.now() },
    { id: 2, label: "Slot 3 (Staging B)", paths: [], op: "copy", timestamp: Date.now() },
    { id: 3, label: "Slot 4 (Quick Bin)", paths: [], op: "copy", timestamp: Date.now() },
  ]);

  if (!isOpen) return null;

  const handleCaptureCurrentSelection = (slotId: number) => {
    const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
    if (!activeTab || activeTab.selected.length === 0) {
      store.pushToast("info", "Capture", "Select files in the active tab to stage into this slot.");
      return;
    }
    const paths = [...activeTab.selected];
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId ? { ...s, paths, timestamp: Date.now() } : s
      )
    );
    cutClipboard.paths = paths;
    cutClipboard.mode = "copy";
    store.pushToast("success", "Slot Updated", `Staged ${activeTab.selected.length} items into ${slots[slotId].label}`);
  };

  const handlePasteSlot = async (slotId: number) => {
    const s = slots[slotId];
    if (s.paths.length === 0) return;
    const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
    if (!activeTab) return;

    try {
      if (s.op === "cut") {
        await store.startMove(s.paths, activeTab.path);
      } else {
        await store.startCopy(s.paths, activeTab.path);
      }
      store.pushToast("success", "Pasted", `Pasted items from ${s.label} into ${activeTab.path}`);
      onClose();
    } catch (e: any) {
      store.pushToast("error", "Paste Failed", e?.message || String(e));
    }
  };

  const handleClearSlot = (slotId: number) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, paths: [] } : s))
    );
  };

  return (
    <div className="palette-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="palette" role="dialog" aria-modal="true" aria-label="Clipboard history"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 680, maxHeight: "88vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "rgba(245, 158, 11, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clipboard size={18} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Multi-Slot Circular Drop Rings & Clipboard History</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>4 independent staging slots for concurrent copy/cut workflows</div>
            </div>
          </div>
          <button className="icon-btn" aria-label="Close clipboard history" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Slots Selector Tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            {slots.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSlot(s.id)}
                className={`btn btn-sm ${activeSlot === s.id ? "btn-primary" : ""}`}
                style={{ flex: 1, height: 34, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <span>{s.label.split(" ")[0]} {s.id + 1}</span>
                <span
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    padding: "0 6px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {s.paths.length}
                </span>
              </button>
            ))}
          </div>

          {/* Active Slot Details */}
          {(() => {
            const slot = slots[activeSlot];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{slot.label}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleCaptureCurrentSelection(slot.id)}
                      title="Store current selected files into this slot"
                    >
                      <Copy size={13} /> Stage Selection
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handlePasteSlot(slot.id)}
                      disabled={slot.paths.length === 0}
                      style={{ color: "#10b981" }}
                    >
                      <ArrowDownRight size={13} /> Paste Here
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleClearSlot(slot.id)}
                      disabled={slot.paths.length === 0}
                      style={{ color: "#ef4444" }}
                    >
                      <Trash2 size={13} /> Clear
                    </button>
                  </div>
                </div>

                {/* Staged Paths */}
                {slot.paths.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                    {slot.paths.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 12px",
                          background: "var(--surface)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border)",
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text)",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: 30,
                      textAlign: "center",
                      color: "var(--text-dim)",
                      background: "var(--surface)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px dashed var(--border)",
                      fontSize: 12,
                    }}
                  >
                    This clipboard slot is currently empty. Click "Stage Selection" to store files.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}