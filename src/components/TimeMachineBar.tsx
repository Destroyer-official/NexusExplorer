import { useState, useEffect } from "react";
import { Clock, RotateCcw, X } from "lucide-react";
import { ipc } from "@/lib/ipc";
import { useAppStore } from "@/state/store";
import type { VssSnapshot } from "@/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function TimeMachineBar({ isOpen, onClose }: Props) {
  const store = useAppStore();
  const [snapshots, setSnapshots] = useState<VssSnapshot[]>([]);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
      const volume = activeTab?.path?.slice(0, 3) || "C:\\";
      setLoading(true);
      ipc.toolsVssList(volume)
        .then((list) => {
          setSnapshots(list);
          setSliderIndex(list.length); // default to Now
        })
        .catch(() => setSnapshots([]))
        .finally(() => setLoading(false));
    }
  }, [isOpen, store.activeTabId]);

  if (!isOpen) return null;

  const isNow = sliderIndex === snapshots.length;
  const currentSnapshot = !isNow ? snapshots[sliderIndex] : null;

  const handleRestore = async () => {
    if (!currentSnapshot) return;
    const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
    if (!activeTab) return;
    const target = activeTab.selected[0];
    if (!target) {
      store.pushToast("info", "Select a file", "Pick a file in this folder, then restore its older version.");
      return;
    }

    // Rewind a single file to a sibling copy so nothing on disk is overwritten.
    const volume = target.slice(0, 3);
    const relative = target.slice(volume.length).replace(/^[\\/]+/, "");
    const destination = `${target}.restored`;

    try {
      const bytes = await ipc.toolsVssRestore(currentSnapshot.snapshotPath, relative, destination);
      store.pushToast("success", "Time Machine restored", `${bytes} bytes → ${destination}`);
      await store.refreshActive();
      onClose();
    } catch (e: any) {
      store.pushToast("error", "Restore Failed", e?.message || String(e));
    }
  };

  return (
    <div
      style={{
        position: "relative",
        background: "var(--surface)",
        borderTop: "1px solid var(--accent)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.25)",
        padding: "10px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 800,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Visual Time Machine Snapshot Slider</span>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {isNow ? "● Viewing Live Active Filesystem" : `● Viewing Snapshot: ${currentSnapshot?.creationTime}`}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isNow && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRestore}
              style={{ display: "flex", alignItems: "center", gap: 6, height: 26, fontSize: 11 }}
            >
              <RotateCcw size={12} /> Restore Folder to This Version
            </button>
          )}
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrubbable Slider */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)", width: 60 }}>Older</span>
        <input
          type="range"
          min={0}
          max={snapshots.length}
          value={sliderIndex}
          onChange={(e) => setSliderIndex(Number(e.target.value))}
          style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer" }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: isNow ? "var(--accent)" : "var(--text)", width: 60, textAlign: "right" }}>
          Now (Live)
        </span>
      </div>

      {snapshots.length === 0 && !loading && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
          No Volume Shadow Copies currently recorded on this drive. (Requires System Restore / Shadow Storage enabled in Windows).
        </div>
      )}
    </div>
  );
}

