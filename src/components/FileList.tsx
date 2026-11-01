import { useMemo, useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAppStore } from "@/state/store";
import { visibleEntries, groupEntries } from "@/lib/entries";
import { entryMenu, backgroundMenu } from "@/lib/menus";
import { iconForEntry } from "@/lib/fileIcons";
import { formatBytes, formatDate } from "@/lib/format";
import { isImageExt } from "@/lib/format";
import { assetUrl, ipc } from "@/lib/ipc";
import { beginDrag } from "@/lib/dnd";
import { normalizePath, samePath } from "@/lib/paths";
import { ChevronRight, ChevronDown } from "lucide-react";
import { handleVimKeyEvent } from "@/lib/vimNavigation";
import type { GitFileStatus, FileEntry } from "@/types";

export function FileList() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId)!;
  const settings = store.settings;
  const baseRows = useMemo(() => visibleEntries(activeTab, settings), [activeTab, settings]);

  // Automatically calculate folder sizes for visible directories
  useEffect(() => {
    if (!activeTab?.entries) return;
    const dirs = activeTab.entries.filter((e) => e.isDir).map((e) => e.path);
    if (dirs.length > 0) {
      void store.autoCalculateFolderSizes(dirs);
    }
  }, [activeTab?.path, activeTab?.entries, store]);

  // Tree-in-List expanded subfolders state
  const [expandedFolders, setExpandedFolders] = useState<Record<string, FileEntry[]>>({});
  const lastClickRef = useRef<{ path: string; time: number }>({ path: "", time: 0 });

  const toggleExpand = async (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedFolders[folderPath]) {
      const next = { ...expandedFolders };
      delete next[folderPath];
      setExpandedFolders(next);
    } else {
      try {
        const subEntries = await ipc.readDir(folderPath);
        setExpandedFolders((prev) => ({ ...prev, [folderPath]: subEntries }));
        const subDirs = subEntries.filter((e) => e.isDir).map((e) => e.path);
        if (subDirs.length > 0) {
          void store.autoCalculateFolderSizes(subDirs);
        }
      } catch (err: any) {
        store.pushToast("error", "Expand Failed", err?.message || String(err));
      }
    }
  };

  const rows = useMemo(() => {
    const res: Array<FileEntry & { depth?: number; parentDir?: string }> = [];
    for (const r of baseRows) {
      res.push({ ...r, depth: 0 });
      if (r.isDir && expandedFolders[r.path]) {
        for (const sub of expandedFolders[r.path]) {
          res.push({ ...sub, depth: 1, parentDir: r.path });
        }
      }
    }
    return res;
  }, [baseRows, expandedFolders]);

  const groups = useMemo(() => groupEntries(rows as any, activeTab.groupBy), [rows, activeTab.groupBy]);
  const flat = useMemo(() => {
    const out: { kind: "header" | "row"; label?: string; entry?: (typeof rows)[number] }[] = [];
    for (const g of groups) {
      if (g.label) out.push({ kind: "header", label: g.label });
      for (const e of g.entries) out.push({ kind: "row", entry: e });
    }
    return out;
  }, [groups]);
  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = Math.round((settings.density === "compact" ? 26 : 32) * (settings.zoom / 100));
  const virtualizer = useVirtualizer({ count: flat.length, getScrollElement: () => parentRef.current, estimateSize: () => rowHeight, overscan: 14 });
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitFileStatus>>({});

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

  useEffect(() => {
    if (!activeTab?.path) {
      setGitStatuses({});
      return;
    }
    let cancelled = false;
    ipc.toolsGitStatus(activeTab.path)
      .then((res) => {
        if (!cancelled && res.isRepo) {
          setGitStatuses(res.fileStatuses);
        } else if (!cancelled) {
          setGitStatuses({});
        }
      })
      .catch(() => {
        if (!cancelled) setGitStatuses({});
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab?.path, activeTab?.entries]);

  const onRowPointerDown = (entry: (typeof rows)[number], e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input")) return;
    const now = Date.now();
    if (samePath(lastClickRef.current.path, entry.path) && (now - lastClickRef.current.time) < 500) {
      lastClickRef.current = { path: "", time: 0 };
      void store.openEntry(entry);
      return;
    }
    lastClickRef.current = { path: entry.path, time: now };
    const selected = activeTab.selected;
    if (e.ctrlKey || e.metaKey) store.toggleSelection(entry.path);
    else if (e.shiftKey) store.selectRange(entry.path);
    else if (!selected.some((p) => samePath(p, entry.path))) store.selectOnly(entry.path);
    const dragPaths = selected.length > 1 && selected.some((p) => samePath(p, entry.path)) ? selected : [entry.path];
    beginDrag(dragPaths, e.clientX, e.clientY);
  };

  const onRowPointerUp = (entry: (typeof rows)[number], e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input")) return;
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && activeTab.selected.length > 1) {
      store.selectOnly(entry.path);
    }
  };

  const onRowContextMenu = (entry: (typeof rows)[number], e: React.MouseEvent) => {
    e.preventDefault();
    const isSelected = activeTab.selected.some((p) => samePath(p, entry.path));
    if (!isSelected) {
      store.selectOnly(entry.path);
    }
    const selected = isSelected ? activeTab.selected : [entry.path];
    store.openContextMenu(e.clientX, e.clientY, entryMenu(selected, store));
  };

  const renaming = store.renamingPath;

  return (
    <div className="viewport" ref={parentRef} data-pane-id="primary" data-drop-path={activeTab.path} tabIndex={0}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest(".row, .filelist-head") === null) {
          store.clearSelection();
        }
      }}
      onKeyDown={(e) => {
        if (settings.vimModeEnabled !== false && handleVimKeyEvent(e.nativeEvent)) return;
        const rowEntries = flat.filter((i) => i.kind === "row").map((i) => i.entry!);
        if (rowEntries.length === 0) return;
        const idx = rowEntries.findIndex((r) => samePath(r.path, activeTab.selected[activeTab.selected.length - 1] ?? ""));
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.min(rowEntries.length - 1, (idx < 0 ? 0 : idx + 1));
          if (e.shiftKey) store.selectRange(rowEntries[next].path); else store.selectOnly(rowEntries[next].path);
          virtualizer.scrollToIndex(flat.findIndex((i) => i.entry?.path === rowEntries[next].path), { align: "auto" });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev = Math.max(0, (idx < 0 ? 0 : idx - 1));
          if (e.shiftKey) store.selectRange(rowEntries[prev].path); else store.selectOnly(rowEntries[prev].path);
          virtualizer.scrollToIndex(flat.findIndex((i) => i.entry?.path === rowEntries[prev].path), { align: "auto" });
        } else if (e.key === "Home") {
          e.preventDefault(); store.selectOnly(rowEntries[0].path); virtualizer.scrollToIndex(flat.findIndex((i) => i.entry?.path === rowEntries[0].path));
        } else if (e.key === "End") {
          e.preventDefault(); store.selectOnly(rowEntries[rowEntries.length - 1].path); virtualizer.scrollToIndex(flat.findIndex((i) => i.entry?.path === rowEntries[rowEntries.length - 1].path));
        }
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest(".row") === null) {
          e.preventDefault();
          store.openContextMenu(e.clientX, e.clientY, backgroundMenu(activeTab.path, store));
        }
      }}
    >
      <div className="filelist">
        <div className="filelist-head">
          <div className="col-head col-name" onClick={() => store.toggleSort("name")}>Name <span className="sort-arrow">{activeTab.sortKey === "name" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span></div>
          <div className="col-head col-modified" onClick={() => store.toggleSort("modified")}>Date modified <span className="sort-arrow">{activeTab.sortKey === "modified" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span></div>
          <div className="col-head col-type" onClick={() => store.toggleSort("type")}>Type <span className="sort-arrow">{activeTab.sortKey === "type" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span></div>
          <div className="col-head col-size" onClick={() => store.toggleSort("size")}>Size <span className="sort-arrow">{activeTab.sortKey === "size" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span></div>
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const item = flat[vi.index];
            if (item.kind === "header") {
              return (
                <div key={`h-${item.label}-${vi.index}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 24, transform: `translateY(${vi.start}px)`, padding: "4px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--text-faint)", background: "var(--bg)" }}>
                  {item.label}
                </div>
              );
            }
            const entry = item.entry!;
            const selected = activeTab.selected.some((p) => samePath(p, entry.path));
            const { Icon, tone } = iconForEntry(entry, false);
            const gitStatus = gitStatuses[entry.path];
            const isGitIgnored = gitStatus === "ignored";

            // File-Age Chromatic Heatmap
            const ageMs = Date.now() - entry.modifiedMs;
            const isToday = ageMs < 86_400_000;
            const isThisWeek = ageMs < 7 * 86_400_000;
            const isThisMonth = ageMs < 30 * 86_400_000;
            const useHeatmap = settings.chromaticHeatmap !== false;
            const ageBorder = useHeatmap
              ? isToday
                ? "3px solid #10b981"
                : isThisWeek
                ? "3px solid #06b6d4"
                : isThisMonth
                ? "3px solid #3b82f6"
                : "3px solid transparent"
              : "3px solid transparent";
            const ageBg = useHeatmap
              ? isToday
                ? "rgba(16, 185, 129, 0.04)"
                : isThisWeek
                ? "rgba(6, 182, 212, 0.02)"
                : undefined
              : undefined;

            const isExpanded = entry.isDir && Boolean(expandedFolders[entry.path]);
            const depth = (entry as any).depth ?? 0;

            return (
              <div
                key={entry.path}
                className={`row ${selected ? "selected" : ""}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: rowHeight,
                  transform: `translateY(${vi.start}px)`,
                  opacity: isGitIgnored ? 0.55 : 1,
                  paddingLeft: 14 + depth * 18,
                  borderLeft: ageBorder,
                  background: selected ? undefined : ageBg,
                }}
                onPointerDown={(e) => onRowPointerDown(entry, e)}
                onPointerUp={(e) => onRowPointerUp(entry, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if ((e.target as HTMLElement).closest("button, input")) return;
                  void store.openEntry(entry);
                }}
                onContextMenu={(e) => onRowContextMenu(entry, e)}
              >
                <div className="row-name-cell">
                  {entry.isDir ? (
                    <button
                      className="icon-btn"
                      style={{ width: 16, height: 16, padding: 0, marginRight: 2 }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => toggleExpand(entry.path, e)}
                      title={isExpanded ? "Collapse folder" : "Expand folder inline"}
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  ) : (
                    <span style={{ width: 16, display: "inline-block", marginRight: 2 }} />
                  )}
                  <span className="row-icon">
                    {isImageExt(entry.ext) ? (
                      <img src={assetUrl(entry.path)} alt={entry.name} style={{ width: 18, height: 18, objectFit: "cover", borderRadius: 3 }} loading="lazy" />
                    ) : (
                      <span className={`file-icon tone-${tone}`}><Icon size={16} strokeWidth={1.7} /></span>
                    )}
                  </span>
                  {renaming === entry.path ? (
                    <RenameInput name={entry.name} onCommit={(n) => void store.renameTo(entry.path, n)} onCancel={() => store.setRenaming(null)} />
                  ) : (
                    <span className="row-name" title={entry.name}>{entry.name}</span>
                  )}
                  {gitStatus && gitStatus !== "unmodified" && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 4px",
                        borderRadius: 3,
                        marginLeft: 6,
                        background:
                          gitStatus === "modified" ? "rgba(234, 179, 8, 0.15)" :
                          gitStatus === "staged" ? "rgba(6, 182, 212, 0.15)" :
                          gitStatus === "untracked" ? "rgba(34, 197, 94, 0.15)" :
                          gitStatus === "conflicted" ? "rgba(239, 68, 68, 0.15)" :
                          "rgba(255, 255, 255, 0.08)",
                        color:
                          gitStatus === "modified" ? "#eab308" :
                          gitStatus === "staged" ? "#06b6d4" :
                          gitStatus === "untracked" ? "#22c55e" :
                          gitStatus === "conflicted" ? "#ef4444" :
                          "var(--text-faint)",
                      }}
                      title={`Git: ${gitStatus}`}
                    >
                      {gitStatus === "modified" ? "M" :
                       gitStatus === "staged" ? "S" :
                       gitStatus === "untracked" ? "U" :
                       gitStatus === "conflicted" ? "!" :
                       "I"}
                    </span>
                  )}
                  {(tagMap.get(entry.path.toLowerCase()) ?? []).map((color, i) => (
                    <span
                      key={`${color}-${i}`}
                      title="Tagged"
                      style={{ width: 7, height: 7, borderRadius: 4, background: color, marginLeft: 4, flexShrink: 0 }}
                    />
                  ))}
                </div>
                <div className="row-col row-col-modified">{formatDate(entry.modifiedMs)}</div>
                <div className="row-col row-col-type">{entry.isDir ? "Folder" : (entry.ext.toUpperCase() || "File")}</div>
                <div
                  className="row-col row-col-size"
                  onClick={(e) => {
                    if (entry.isDir) {
                      e.stopPropagation();
                      void store.calculateFolderSize(entry.path);
                    }
                  }}
                  title={
                    entry.isDir
                      ? (store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()])
                        ? `${(store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()]).files} files, ${(store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()]).folders} folders (Click to recalculate)`
                        : (store.folderSizeTasks[entry.path] ?? store.folderSizeTasks[normalizePath(entry.path)] ?? store.folderSizeTasks[normalizePath(entry.path).toLowerCase()])
                          ? "Calculating folder size…"
                          : "Click to calculate folder size"
                      : undefined
                  }
                  style={entry.isDir ? { cursor: "pointer" } : undefined}
                >
                  {entry.isDir ? (
                    (store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()]) ? (
                      formatBytes((store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()]).size)
                    ) : (store.folderSizeTasks[entry.path] ?? store.folderSizeTasks[normalizePath(entry.path)] ?? store.folderSizeTasks[normalizePath(entry.path).toLowerCase()]) ? (
                      <span style={{ color: "var(--accent)", fontStyle: "italic", fontSize: 11 }}>…</span>
                    ) : (
                      <span style={{ color: "var(--text-faint)" }}>—</span>
                    )
                  ) : (
                    formatBytes(entry.size)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RenameInput({ name, onCommit, onCancel }: { name: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); const i = name.lastIndexOf("."); if (i > 0) ref.current?.setSelectionRange(0, i); else ref.current?.select(); }, [name]);
  return (
    <input
      ref={ref}
      className="rename-input"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") onCommit(v); if (e.key === "Escape") onCancel(); }}
      onBlur={() => onCommit(v)}
    />
  );
}