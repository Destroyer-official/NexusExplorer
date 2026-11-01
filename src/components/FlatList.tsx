import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAppStore } from "@/state/store";
import { iconForEntry } from "@/lib/fileIcons";
import { formatBytes, formatDate } from "@/lib/format";
import { ipc } from "@/lib/ipc";
import { entryMenu } from "@/lib/menus";
import { basename, samePath } from "@/lib/paths";
import { ListTree, Loader2, RefreshCw, X } from "lucide-react";

export default function FlatList() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const listing = store.flatListing;
  const [selected, setSelected] = useState<string[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = Math.round((store.settings.density === "compact" ? 26 : 32) * (store.settings.zoom / 100));

  const rows = listing?.entries ?? [];
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 16,
  });

  const summary = useMemo(() => {
    if (!listing) return "Flat view";
    return `${listing.totalFiles} files · ${listing.totalDirectories} folders · ${formatBytes(listing.totalBytes)}${listing.truncated ? " · truncated" : ""}`;
  }, [listing]);

  const primaryClick = (path: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelected((current) => (current.some((p) => samePath(p, path)) ? current.filter((p) => !samePath(p, path)) : [...current, path]));
    } else {
      setSelected([path]);
    }
  };

  const openRow = async (path: string, isDir: boolean) => {
    if (isDir) {
      await store.navigateTo(path);
    } else {
      try {
        await ipc.openPath(path);
      } catch {
        await store.openPaths([path]);
      }
    }
  };

  if (!store.flatView) return null;

  return (
    <div className="viewport" data-drop-path={activeTab?.path}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <ListTree size={15} color="var(--accent)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Flat branch view</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {summary}
            {listing ? ` · ${listing.elapsedMs} ms` : ""}
            {activeTab ? ` · ${activeTab.path}` : ""}
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => void store.refreshFlat()} disabled={store.flatLoading}>
          {store.flatLoading ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} Refresh
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => void store.toggleFlatView()}>
          <X size={12} /> Exit flat view
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 150px", gap: 10, padding: "6px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--text-faint)" }}>
        <span>Relative path</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span>Modified</span>
      </div>

      <div ref={parentRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {store.flatLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 16, fontSize: 12, color: "var(--text-faint)" }}>
            <Loader2 size={14} className="spin" /> Walking the branch…
          </div>
        )}
        {!store.flatLoading && rows.length === 0 && (
          <div className="empty-state" style={{ padding: 40 }}>
            <h3>Nothing to flatten</h3>
            <p>This folder has no nested items.</p>
          </div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => {
            const item = rows[row.index];
            const entry = item.entry;
            const { Icon, tone } = iconForEntry(entry);
            const isSelected = selected.some((p) => samePath(p, entry.path));
            return (
              <div
                key={entry.path}
                className={`flat-row ${isSelected ? "selected" : ""}`}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: row.size, transform: `translateY(${row.start}px)` }}
                onClick={(e) => primaryClick(entry.path, e)}
                onDoubleClick={() => void openRow(entry.path, entry.isDir)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelected([entry.path]);
                  store.openContextMenu(e.clientX, e.clientY, entryMenu([entry.path], store));
                }}
                title={entry.path}
              >
                <span className="flat-name">
                  <Icon size={14} className={`tone-${tone}`} />
                  <span style={{ color: "var(--text-faint)", fontSize: 11, paddingLeft: Math.min(item.depth - 1, 8) * 10 }}>
                    {item.relativePath.includes("/") ? item.relativePath.slice(0, item.relativePath.lastIndexOf("/") + 1) : ""}
                  </span>
                  <span>{basename(item.relativePath)}</span>
                </span>
                <span style={{ textAlign: "right", color: "var(--text-faint)" }}>{entry.isDir ? "—" : formatBytes(entry.size)}</span>
                <span style={{ color: "var(--text-faint)" }}>{formatDate(entry.modifiedMs)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
