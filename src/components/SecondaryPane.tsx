import { useEffect, useRef, useState } from "react";
import { ArrowUp, FolderSync, RefreshCw, GitCompare } from "lucide-react";
import { beginDrag } from "@/lib/dnd";
import { dirname, isRoot, samePath } from "@/lib/paths";
import { ipc, toErrorMessage } from "@/lib/ipc";
import { useAppStore } from "@/state/store";
import { iconForEntry } from "@/lib/fileIcons";
import { formatBytes, formatDate } from "@/lib/format";
import { useMarqueeSelection } from "@/hooks/useMarqueeSelection";
import type { FileEntry } from "@/types";

export default function SecondaryPane({ paneId = "secondary", startPath }: { paneId?: string; startPath?: string }) {
  const store = useAppStore();
  const initialPath = store.tabs.find((tab) => tab.id === store.activeTabId)?.path ?? "C:\\";
  const [path, setPath] = useState(startPath ?? (paneId === "secondary" && store.secondaryPath ? store.secondaryPath : initialPath));
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const paneRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const marquee = useMarqueeSelection({ containerRef: viewportRef, onSelectionChange: setSelected });
  const finishedTransfers = Object.values(store.transfers).filter((job) => job.state === "completed" || job.state === "failed" || job.state === "cancelled").map((job) => job.id + job.state).join("|");
  const refresh = () => setRevision((value) => value + 1);

  // Synchronize with store secondaryPath when paneId is secondary
  useEffect(() => {
    if (paneId === "secondary") {
      if (store.secondaryPath && !samePath(store.secondaryPath, path)) {
        setPath(store.secondaryPath);
      } else if (!store.secondaryPath && path) {
        void store.navigateSecondary(path);
      }
    }
  }, [paneId, store.secondaryPath, path]);

  // Synchronize secondary selection with store
  useEffect(() => {
    if (paneId === "secondary") {
      setSelected(store.secondarySelected);
    }
  }, [paneId, store.secondarySelected]);

  const navigateTo = (newPath: string) => {
    setPath(newPath);
    if (paneId === "secondary") {
      void store.navigateSecondary(newPath);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setSelected([]);
    void ipc.readDir(path).then((rows) => {
      if (!cancelled) setEntries(rows);
    }).catch((cause: unknown) => {
      if (!cancelled) { setEntries([]); setError(toErrorMessage(cause)); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, revision, finishedTransfers]);
  const visible = entries.filter((entry) => (store.settings.showHidden || !entry.isHidden) && (store.settings.showSystem || !entry.isSystem));
  const open = (entry: FileEntry) => { if (entry.isDir) navigateTo(entry.path); else void store.openEntry(entry); };
  const copy = (cut: boolean) => {
    if (!selected.length) return;
    store.setClipboard({ op: cut ? "cut" : "copy", paths: selected });
    store.pushToast("info", cut ? "Ready to move" : "Copied", `${selected.length} selected items`);
  };
  return (
    <div className="main auxiliary-pane" ref={paneRef} tabIndex={0} aria-label={`${paneId} file pane`}
      onPointerDown={(event) => { if (!(event.target as HTMLElement).closest("button, input")) paneRef.current?.focus(); }}
      onKeyDown={(event) => {
        // Each pane owns its selection; never let file shortcuts target another pane.
        event.stopPropagation();
        if ((event.target as HTMLElement).closest("button, input")) return;
        const ctrl = event.ctrlKey || event.metaKey;
        if (ctrl && event.key.toLowerCase() === "a") { event.preventDefault(); setSelected(visible.map((entry) => entry.path)); }
        if (ctrl && ["c", "x"].includes(event.key.toLowerCase())) { event.preventDefault(); copy(event.key.toLowerCase() === "x"); }
        if (ctrl && event.key.toLowerCase() === "v") { event.preventDefault(); void store.pasteInto(path); }
        if (event.key === "F5") { event.preventDefault(); refresh(); }
        if (event.key === "Backspace" || (event.altKey && event.key === "ArrowUp")) { event.preventDefault(); if (!isRoot(path)) navigateTo(dirname(path)); }
        if (event.key === "Delete" && selected.length) { event.preventDefault(); void store.startDelete(selected, event.shiftKey); }
        if (event.key === "Enter" && selected.length === 1) { event.preventDefault(); const entry = entries.find((item) => samePath(item.path, selected[0])); if (entry) open(entry); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); const index = visible.findIndex((entry) => samePath(entry.path, selected.at(-1) ?? ""));
          const next = visible[Math.max(0, Math.min(visible.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
          if (next) setSelected([next.path]);
        }
      }}>
      <div className="secondary-toolbar">
        <span className="truncate" title={path} style={{ fontSize: 12, flex: 1 }}>{path}</span>
        {paneId === "secondary" && (
          <>
            <button
              className={`icon-btn ${store.syncNav ? "active" : ""}`}
              title={store.syncNav ? "Disable Synchronized Navigation" : "Enable Synchronized Navigation (Follow folder changes in both panes)"}
              onClick={store.toggleSyncNav}
              style={store.syncNav ? { color: "var(--accent)" } : undefined}
            >
              <FolderSync size={15} />
            </button>
            <button
              className="icon-btn"
              title="Compare with Primary Pane (Ctrl+Shift+E — Select differing & unique files)"
              onClick={() => void store.comparePanes()}
            >
              <GitCompare size={15} />
            </button>
          </>
        )}
        <button className="icon-btn" title="Up in this pane" disabled={isRoot(path)} onClick={() => navigateTo(dirname(path))}><ArrowUp size={15} /></button>
        <button className="icon-btn" title="Refresh this pane" onClick={refresh}><RefreshCw size={15} /></button>
      </div>
      <div className="viewport" ref={viewportRef} data-pane-id={paneId} data-drop-path={path} onPointerDown={marquee.onPointerDown}>
        {loading ? <div className="empty-state" role="status">Loading…</div> : error ? <div className="empty-state" role="alert"><p>{error}</p><button className="btn" onClick={refresh}>Retry</button></div> : visible.length === 0 ? <div className="empty-state">No visible files in this folder</div> : (
          <div className="filelist">
            <div className="filelist-head"><div>Name</div><div>Modified</div><div>Type</div><div>Size</div></div>
            {visible.map((entry) => {
              const { Icon, tone } = iconForEntry(entry, false);
              return <div key={entry.path} data-path={entry.path} className={`row ${selected.includes(entry.path) ? "selected" : ""}`} data-drop-path={entry.isDir ? entry.path : undefined}
                onPointerDown={(event) => {
                  if (event.button === 0) {
                    const isName = (event.target as HTMLElement).closest(".row-name-cell");
                    if (!isName) {
                      marquee.onPointerDown(event);
                      return;
                    }
                    beginDrag(selected.includes(entry.path) ? selected : [entry.path], event.clientX, event.clientY);
                  }
                }}
                onClick={(event) => {
                  if (marquee.isMarqueeActive) return;
                  setSelected((previous) => event.ctrlKey || event.metaKey ? previous.includes(entry.path) ? previous.filter((item) => item !== entry.path) : [...previous, entry.path] : [entry.path]);
                }}
                onDoubleClick={() => open(entry)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  const paths = selected.includes(entry.path) ? selected : [entry.path]; setSelected(paths);
                  store.openContextMenu(event.clientX, event.clientY, [
                    { label: "Open", icon: "open", action: () => open(entry) },
                    { label: "Copy", icon: "copy", action: () => store.setClipboard({ op: "copy", paths }) },
                    { label: "Cut", icon: "cut", action: () => store.setClipboard({ op: "cut", paths }) },
                    { label: "Paste here", icon: "paste", action: () => { void store.pasteInto(path); } },
                    { label: "Properties", icon: "properties", action: () => store.setPropertiesPath(entry.path) },
                  ]);
                }}>
                <div className="row-name-cell"><span className={`file-icon tone-${tone}`}><Icon size={16} /></span><span className="row-name">{entry.name}</span></div>
                <div className="row-col">{formatDate(entry.modifiedMs)}</div><div className="row-col">{entry.isDir ? "Folder" : entry.ext.toUpperCase()}</div><div className="row-col">{entry.isDir ? "—" : formatBytes(entry.size)}</div>
              </div>;
            })}
          </div>
        )}
        {marquee.renderMarquee()}
      </div>
    </div>
  );
}
