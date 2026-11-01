import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/state/store";
import { selectionStats, visibleEntries } from "@/lib/entries";
import { formatBytes } from "@/lib/format";
import { normalizePath, samePath } from "@/lib/paths";
import { PieChart } from "lucide-react";

export default function StatusBar() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const settings = store.settings;
  const drives = store.drives;
  const entries = activeTab?.entries ?? [];
  const visible = activeTab ? visibleEntries(activeTab, settings) : [];
  const stats = activeTab ? selectionStats(entries, activeTab.selected) : { count: 0, bytes: 0, files: 0, folders: 0 };
  const drive = drives.find((d) => activeTab && samePath(d.path, activeTab.path.split("\\")[0] + "\\")) ?? drives.find((d) => d.isReady);
  const runningJobs = Object.values(store.transfers).filter((j) => j.state === "running" || j.state === "paused").length;

  const [showCharts, setShowCharts] = useState(false);

  // Include calculated folder sizes in selection bytes
  const totalSelectedBytes = useMemo(() => {
    let bytes = stats.bytes;
    if (activeTab) {
      for (const selPath of activeTab.selected) {
        const norm = normalizePath(selPath);
        const fSize =
          store.folderSizes[selPath] ??
          store.folderSizes[norm] ??
          store.folderSizes[norm.toLowerCase()];
        if (fSize) {
          bytes += fSize.size;
        }
      }
    }
    return bytes;
  }, [stats.bytes, activeTab?.selected, store.folderSizes]);

  // If a single folder is selected and not calculated, auto-calculate
  useEffect(() => {
    if (activeTab && activeTab.selected.length === 1) {
      const singlePath = activeTab.selected[0];
      const entry = entries.find((e) => samePath(e.path, singlePath));
      const norm = normalizePath(singlePath);
      const isCalculated =
        store.folderSizes[singlePath] ??
        store.folderSizes[norm] ??
        store.folderSizes[norm.toLowerCase()];
      const isRunning =
        store.folderSizeTasks[singlePath] ??
        store.folderSizeTasks[norm] ??
        store.folderSizeTasks[norm.toLowerCase()];
      if (entry?.isDir && !isCalculated && !isRunning) {
        void store.calculateFolderSize(singlePath);
      }
    }
  }, [activeTab?.selected, entries, store.folderSizes, store.folderSizeTasks]);

  // Calculate file extension distribution analytics
  const extensionStats = useMemo(() => {
    const fileEntries = entries.filter((e) => !e.isDir);
    if (fileEntries.length === 0) return [];
    const totalBytes = fileEntries.reduce((acc, e) => acc + e.size, 0) || 1;

    const counts: Record<string, { count: number; bytes: number }> = {};
    for (const f of fileEntries) {
      const ext = f.ext ? `.${f.ext.toLowerCase()}` : "none";
      if (!counts[ext]) counts[ext] = { count: 0, bytes: 0 };
      counts[ext].count += 1;
      counts[ext].bytes += f.size;
    }

    return Object.entries(counts)
      .map(([ext, data]) => ({
        ext,
        count: data.count,
        bytes: data.bytes,
        percentBytes: Math.round((data.bytes / totalBytes) * 100),
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);
  }, [entries]);

  return (
    <div className="statusbar" style={{ position: "relative" }}>
      <div className="status-left" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {activeTab?.loading ? (
          <span>Loading…</span>
        ) : activeTab?.selected.length ? (
          <span>
            {stats.count} selected · {stats.files} files, {stats.folders} folders · {formatBytes(totalSelectedBytes)}
            {stats.folders > 0 && totalSelectedBytes === stats.bytes && (
              <span
                style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => {
                  for (const sel of activeTab.selected) {
                    const entry = entries.find((e) => samePath(e.path, sel));
                    if (entry?.isDir) void store.calculateFolderSize(sel);
                  }
                }}
                title="Calculate size for selected folders"
              >
                (calc sizes)
              </span>
            )}
          </span>
        ) : (
          <span>
            {visible.length} items ·{" "}
            {formatBytes(
              visible.reduce((s, e) => {
                if (e.isDir) {
                  const norm = normalizePath(e.path);
                  const fSize =
                    store.folderSizes[e.path] ??
                    store.folderSizes[norm] ??
                    store.folderSizes[norm.toLowerCase()];
                  return s + (fSize ? fSize.size : 0);
                }
                return s + e.size;
              }, 0),
            )}
            {visible.some((e) => e.isDir) && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: "var(--accent)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
                onClick={() => {
                  for (const e of visible) {
                    if (e.isDir) void store.calculateFolderSize(e.path);
                  }
                }}
                title="Calculate sizes for all folders in this folder"
              >
                (calc all folders)
              </span>
            )}
          </span>
        )}
        {activeTab?.error && <span style={{ color: "var(--danger)" }}>Error</span>}

        {/* Extension breakdown mini-chart toggle */}
        {extensionStats.length > 0 && (
          <button
            onClick={() => setShowCharts((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "1px 6px",
              fontSize: 11,
              color: "var(--text-dim)",
              cursor: "pointer",
            }}
            title="Toggle Extension Analytics"
          >
            <PieChart size={11} style={{ color: "var(--accent)" }} />
            <span>Composition</span>
          </button>
        )}
      </div>

      {/* Popover Breakdown Chart */}
      {showCharts && (
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: 120,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            padding: 12,
            minWidth: 260,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
          onMouseLeave={() => setShowCharts(false)}
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>File Type Composition</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {extensionStats.map((item) => (
              <div key={item.ext} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>{item.ext} ({item.count})</span>
                  <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {formatBytes(item.bytes)} ({item.percentBytes}%)
                  </span>
                </div>
                {/* Micro bar */}
                <div style={{ height: 4, background: "var(--bg)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.percentBytes}%`, background: "var(--accent)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="spacer" />
      {store.statusMessage && <span style={{ color: "var(--text-dim)" }}>{store.statusMessage}</span>}
      <div className="status-right">
        {runningJobs > 0 && (
          <button className="status-chip" style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }} onClick={store.toggleTransfers}>
            {runningJobs} transfer{runningJobs === 1 ? "" : "s"}
          </button>
        )}
        {store.undoStatus.canUndo && (
          <button className="status-chip" style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }} onClick={() => void store.undo()} title={store.undoStatus.undoLabel ?? ""}>
            Undo
          </button>
        )}
        {drive && <span>{drive.label || drive.path}: {formatBytes(drive.freeBytes)} free</span>}
        <input type="range" min={70} max={150} value={settings.zoom} onChange={(e) => void store.updateSettings({ zoom: Number(e.target.value) })} style={{ width: 90 }} title="Zoom" />
      </div>
    </div>
  );
}