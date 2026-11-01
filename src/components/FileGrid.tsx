import { useMemo, useRef, useEffect } from "react";
import { useAppStore } from "@/state/store";
import { visibleEntries } from "@/lib/entries";
import { iconForEntry } from "@/lib/fileIcons";
import { assetUrl } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { isImageExt } from "@/lib/format";
import { beginDrag } from "@/lib/dnd";
import { entryMenu, backgroundMenu } from "@/lib/menus";
import { normalizePath, samePath } from "@/lib/paths";

export function FileGrid() {
  const lastClickRef = useRef<{ path: string; time: number }>({ path: "", time: 0 });
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId)!;
  const settings = store.settings;
  const rows = useMemo(() => visibleEntries(activeTab, settings), [activeTab, settings]);

  // Automatically calculate folder sizes for visible directories in Grid view
  useEffect(() => {
    if (!activeTab?.entries) return;
    const dirs = activeTab.entries.filter((e) => e.isDir).map((e) => e.path);
    if (dirs.length > 0) {
      void store.autoCalculateFolderSizes(dirs);
    }
  }, [activeTab?.path, activeTab?.entries, store]);
  const tagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tag of store.tags) {
      for (const path of tag.paths) {
        const key = path.toLowerCase();
        const list = map.get(key) ?? [];
        if (!list.includes(tag.color)) list.push(tag.color);
        map.set(key, list);
      }
    }
    return map;
  }, [store.tags]);

  return (
    <div
      className="viewport"
      data-drop-path={activeTab.path}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest(".tile") === null) {
          store.clearSelection();
        }
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest(".tile") === null) {
          e.preventDefault();
          store.openContextMenu(e.clientX, e.clientY, backgroundMenu(activeTab.path, store));
        }
      }}
    >
      <div className="filegrid">
        {rows.map((entry) => {
          const selected = activeTab.selected.some((p) => samePath(p, entry.path));
          const { Icon, tone } = iconForEntry(entry, false);
          return (
            <div
              key={entry.path}
              className={`tile ${selected ? "selected" : ""}`}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if ((e.target as HTMLElement).closest("button, input")) return;
                const now = Date.now();
                if (samePath(lastClickRef.current.path, entry.path) && (now - lastClickRef.current.time) < 500) {
                  lastClickRef.current = { path: "", time: 0 };
                  void store.openEntry(entry);
                  return;
                }
                lastClickRef.current = { path: entry.path, time: now };
                if (e.ctrlKey || e.metaKey) store.toggleSelection(entry.path);
                else if (e.shiftKey) store.selectRange(entry.path);
                else if (!activeTab.selected.some((p) => samePath(p, entry.path))) store.selectOnly(entry.path);
                const sp = store.tabs.find((t) => t.id === store.activeTabId)?.selected ?? [entry.path];
                const dragPaths = sp.length > 1 && sp.some((p) => samePath(p, entry.path)) ? sp : [entry.path];
                beginDrag(dragPaths, e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                if (e.button !== 0) return;
                if ((e.target as HTMLElement).closest("button, input")) return;
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && activeTab.selected.length > 1) {
                  store.selectOnly(entry.path);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if ((e.target as HTMLElement).closest("button, input")) return;
                void store.openEntry(entry);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const isSelected = activeTab.selected.some((p) => samePath(p, entry.path));
                if (!isSelected) {
                  store.selectOnly(entry.path);
                }
                const selected = isSelected ? activeTab.selected : [entry.path];
                store.openContextMenu(e.clientX, e.clientY, entryMenu(selected, store));
              }}
            >
              <div className="tile-icon">
              {isImageExt(entry.ext) ? (
                <img src={assetUrl(entry.path)} alt={entry.name} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} loading="lazy" />
              ) : (
                <span className={`file-icon tone-${tone}`}><Icon size={34} strokeWidth={1.5} /></span>
              )}
            </div>
              <div className="tile-name">{entry.name}</div>
              <div
                className="tile-meta"
                onClick={(e) => {
                  if (entry.isDir) {
                    e.stopPropagation();
                    void store.calculateFolderSize(entry.path);
                  }
                }}
                style={entry.isDir ? { cursor: "pointer" } : undefined}
                title={entry.isDir ? "Click to calculate size" : undefined}
              >
                {entry.isDir
                  ? (store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()])
                    ? formatBytes((store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()]).size)
                    : (store.folderSizeTasks[entry.path] ?? store.folderSizeTasks[normalizePath(entry.path)] ?? store.folderSizeTasks[normalizePath(entry.path).toLowerCase()])
                      ? "Calculating…"
                      : "Folder"
                  : formatBytes(entry.size)}
              </div>
              {(tagMap.get(entry.path.toLowerCase()) ?? []).length > 0 && (
                <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                  {(tagMap.get(entry.path.toLowerCase()) ?? []).map((color, i) => (
                    <span key={`${color}-${i}`} title="Tagged" style={{ width: 7, height: 7, borderRadius: 4, background: color }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}