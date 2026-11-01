import { useEffect, useRef } from "react";
import { FolderClosed, Star, HardDrive, Clock, Plus, Sparkles } from "lucide-react";
import { useAppStore } from "@/state/store";
import { formatBytes } from "@/lib/format";
import { samePath } from "@/lib/paths";

export default function Sidebar() {
  const store = useAppStore();
  const activePath = store.tabs.find((t) => t.id === store.activeTabId)?.path ?? "";
  const width = store.sidebarWidth;
  const resizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = resizerRef.current;
    if (!el) return;
    let startX = 0;
    let startW = width;
    const onMove = (e: PointerEvent) => {
      const next = Math.max(196, Math.min(320, startW + (e.clientX - startX)));
      store.setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    const onDown = (e: PointerEvent) => {
      startX = e.clientX;
      startW = store.sidebarWidth;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, [store, width]);

  if (!store.sidebarOpen) return null;

  const Item = ({ path, label, icon }: { path: string; label: string; icon?: React.ReactNode }) => (
    <div
      className={`side-item ${samePath(activePath, path) ? "active" : ""}`}
      onClick={() => void store.navigateTo(path)}
      onDoubleClick={() => void store.navigateTo(path)}
      onContextMenu={(e) => {
        e.preventDefault();
        store.openContextMenu(e.clientX, e.clientY, [
          { label: "Open", icon: "open", action: () => void store.navigateTo(path) },
          { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(path, true) },
          { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(path) },
          { separator: true },
          { label: "Remove from favorites", icon: "star", action: () => void store.removeBookmark(store.bookmarks.find((b) => samePath(b.path, path))?.id ?? "") },
        ]);
      }}
      data-drop-path={path}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {icon ?? <FolderClosed size={15} />}
      <span className="side-item-name">{label}</span>
    </div>
  );

  return (
    <div className="sidebar" style={{ width }}>
      <div className="sidebar-inner">
        <div className="side-section">
          <div className="side-heading">Quick access</div>
          {(store.knownFolders ?? []).map((f) => (
            <Item key={f.id} path={f.path} label={f.label} icon={<FolderClosed size={15} style={{ color: "var(--accent-soft)" }} />} />
          ))}
        </div>

        {(store.bookmarks ?? []).length > 0 && (
          <div className="side-section">
            <div className="side-heading">Favorites</div>
            {(store.bookmarks ?? []).map((b) => (
              <Item key={b.id} path={b.path} label={b.name} icon={<Star size={15} style={{ color: "var(--warning)" }} />} />
            ))}
          </div>
        )}

        <div className="side-section">
          <div className="side-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Smart folders</span>
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => store.setSmartFolderOpen(true)} title="Manage smart folders (Ctrl+Shift+M)">
              <Plus size={12} />
            </button>
          </div>
          {(store.smartFolders ?? []).length === 0 && (
            <div className="side-meta" style={{ padding: "2px 12px 6px" }}>Save live searches for reuse.</div>
          )}
          {(store.smartFolders ?? []).map((folder) => (
            <div
              key={folder.id}
              className="side-item"
              title={`${folder.name}\n${folder.root}`}
              onClick={() => void store.runSmartFolder(folder)}
              onDoubleClick={() => void store.runSmartFolder(folder)}
              style={{ cursor: "pointer", userSelect: "none" }}
            >
              <Sparkles size={14} style={{ color: "var(--accent)" }} />
              <span className="side-item-name">{folder.name}</span>
            </div>
          ))}
        </div>

        <div className="side-section">
          <div className="side-heading">Drives</div>
          {(store.drives ?? []).map((d) => {
            const used = d.totalBytes - d.freeBytes;
            const pct = d.totalBytes ? (used / d.totalBytes) * 100 : 0;
            const letter = (d.path.match(/^([A-Za-z]:)/)?.[1] || d.path.replace(/[\\\/]+$/, "")).toUpperCase();
            const rawLabel = (d.label || "").trim();
            const displayName = rawLabel
              ? (rawLabel.toUpperCase().includes(`(${letter})`) ? rawLabel : `${rawLabel} (${letter})`)
              : (letter ? `Local Disk (${letter})` : d.path);
            const isDriveActive = samePath(activePath, d.path);

            return (
              <div
                key={d.path}
                className={`side-item side-drive-card ${isDriveActive ? "active" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 4,
                  padding: "7px 10px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => void store.navigateTo(d.path)}
                onDoubleClick={() => void store.navigateTo(d.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  store.openContextMenu(e.clientX, e.clientY, [
                    { label: "Open", icon: "open", action: () => void store.navigateTo(d.path) },
                    { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(d.path, true) },
                    { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(d.path) },
                    { separator: true },
                    { label: "Properties", icon: "info", action: () => store.setPropertiesPath(d.path) },
                  ]);
                }}
                data-drop-path={d.path}
                title={`${displayName}\n${formatBytes(d.freeBytes)} free of ${formatBytes(d.totalBytes)}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                  <HardDrive size={15} style={{ flexShrink: 0, color: isDriveActive ? "var(--accent)" : undefined }} />
                  <span className="side-item-name" style={{ fontWeight: isDriveActive ? 600 : 400 }}>
                    {displayName}
                  </span>
                </div>
                <div style={{ paddingLeft: 25, width: "100%" }}>
                  <div className="drive-bar"><div className="drive-bar-fill" style={{ width: `${pct}%` }} /></div>
                  <div className="side-meta" style={{ marginTop: 3 }}>
                    {formatBytes(d.freeBytes)} free of {formatBytes(d.totalBytes)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(store.recent ?? []).length > 0 && (
          <div className="side-section">
            <div className="side-heading">Recent</div>
            {(store.recent ?? []).slice(0, 8).map((r) => (
              <div
                key={r.path}
                className={`side-item ${samePath(activePath, r.path) ? "active" : ""}`}
                onClick={() => void store.navigateTo(r.path)}
                onDoubleClick={() => void store.navigateTo(r.path)}
                data-drop-path={r.path}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                <Clock size={14} />
                <span className="side-item-name">{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sidebar-resizer" ref={resizerRef} />
    </div>
  );
}
