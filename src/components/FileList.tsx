import RenameInput from "./RenameInput";
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
import { ChevronRight, ChevronDown, SlidersHorizontal } from "lucide-react";
import { handleVimKeyEvent } from "@/lib/vimNavigation";
import { useMarqueeSelection } from "@/hooks/useMarqueeSelection";
import type { GitFileStatus, FileEntry, ColumnId, ContextMenuItem } from "@/types";

export function FileList() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId)!;
  const settings = store.settings;
  const baseRows = useMemo(
    () => visibleEntries(activeTab, settings, store.folderSizes),
    [activeTab, settings, store.folderSizes],
  );

  const maxFolderSize = useMemo(() => {
    let max = 1;
    for (const e of baseRows) {
      const s = e.isDir
        ? (store.folderSizes[e.path]?.size ?? store.folderSizes[normalizePath(e.path)]?.size ?? store.folderSizes[normalizePath(e.path).toLowerCase()]?.size ?? 0)
        : e.size;
      if (s > max) max = s;
    }
    return max;
  }, [baseRows, store.folderSizes]);

  // Automatically calculate folder sizes for visible directories


  // Tree-in-List expanded subfolders state
  const [expandedFolders, setExpandedFolders] = useState<Record<string, FileEntry[]>>({});

  const toggleExpand = async (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedFolders[folderPath]) {
      const next = { ...expandedFolders };
      const prefixSlash = folderPath.toLowerCase() + "/";
      const prefixBackslash = folderPath.toLowerCase() + "\\";
      for (const key of Object.keys(next)) {
        const lower = key.toLowerCase();
        if (lower === folderPath.toLowerCase() || lower.startsWith(prefixSlash) || lower.startsWith(prefixBackslash)) {
          delete next[key];
        }
      }
      setExpandedFolders(next);
    } else {
      try {
        const subEntries = await ipc.readDir(folderPath);
        setExpandedFolders((prev) => ({ ...prev, [folderPath]: subEntries }));
      } catch (err: any) {
        store.pushToast("error", "Expand Failed", err?.message || String(err));
      }
    }
  };

  const rows = useMemo(() => {
    const res: Array<FileEntry & { depth?: number; parentDir?: string }> = [];
    const appendSubEntries = (parentPath: string, depth: number) => {
      const children = expandedFolders[parentPath];
      if (!children) return;
      for (const sub of children) {
        res.push({ ...sub, depth, parentDir: parentPath });
        if (sub.isDir && expandedFolders[sub.path]) {
          appendSubEntries(sub.path, depth + 1);
        }
      }
    };

    for (const r of baseRows) {
      res.push({ ...r, depth: 0 });
      if (r.isDir && expandedFolders[r.path]) {
        appendSubEntries(r.path, 1);
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
  const marquee = useMarqueeSelection({ containerRef: parentRef });
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
    const target = e.target as HTMLElement;
    if (target.closest("button, input")) return;

    // Check if clicking filename/icon or secondary columns (Date, Type, Size)
    const isNameCell = target.closest(".row-name-cell, .col-name");
    if (!isNameCell) {
      marquee.onPointerDown(e);
      return;
    }

    const selected = activeTab.selected;
    if (e.ctrlKey || e.metaKey) store.toggleSelection(entry.path);
    else if (e.shiftKey) store.selectRange(entry.path);
    else if (!selected.some((p) => samePath(p, entry.path))) store.selectOnly(entry.path);
    const dragPaths = selected.length > 1 && selected.some((p) => samePath(p, entry.path)) ? selected : [entry.path];
    beginDrag(dragPaths, e.clientX, e.clientY);
  };

  const onRowPointerUp = (entry: (typeof rows)[number], e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (marquee.isMarqueeActive) return;
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

  const DEFAULT_COLS: ColumnId[] = ["name", "modified", "type", "size"];
  const visibleCols = useMemo<ColumnId[]>(() => {
    const cols = settings.visibleColumns;
    return cols && cols.length > 0 ? cols : DEFAULT_COLS;
  }, [settings.visibleColumns]);

  const gridTemplateColumns = useMemo(() => {
    const colSpecs: Record<ColumnId, string> = {
      name: "minmax(120px, 1fr)",
      modified: "minmax(90px, 135px)",
      created: "minmax(90px, 135px)",
      type: "minmax(50px, 80px)",
      size: "minmax(55px, 85px)",
      ext: "minmax(45px, 70px)",
    };
    return visibleCols.map((c) => colSpecs[c] || "minmax(60px, 100px)").join(" ") + " 24px";
  }, [visibleCols]);

  const openColumnMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cols = settings.visibleColumns?.length ? settings.visibleColumns : DEFAULT_COLS;
    const allCols: { id: ColumnId; label: string }[] = [
      { id: "name", label: "Name" },
      { id: "modified", label: "Date modified" },
      { id: "created", label: "Date created" },
      { id: "type", label: "Type" },
      { id: "size", label: "Size" },
      { id: "ext", label: "Extension" },
    ];

    const items: ContextMenuItem[] = [
      ...allCols.map((c) => ({
        label: `${cols.includes(c.id) ? "✓ " : "   "}${c.label}`,
        action: () => store.toggleColumn(c.id),
      })),
      { separator: true },
      {
        label: "Reset to default columns",
        action: () => store.resetColumns(),
      },
    ];
    store.openContextMenu(e.clientX, e.clientY, items);
  };

  return (
    <div
      className="viewport"
      ref={parentRef}
      data-pane-id="primary"
      data-drop-path={activeTab.path}
      tabIndex={0}
      onPointerDown={marquee.onPointerDown}
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
        } else if (e.key === "Insert") {
          e.preventDefault();
          const current = idx < 0 ? 0 : idx;
          store.toggleSelection(rowEntries[current].path);
          const next = Math.min(rowEntries.length - 1, current + 1);
          virtualizer.scrollToIndex(flat.findIndex((i) => i.entry?.path === rowEntries[next].path), { align: "auto" });
        } else if (e.key === "PageDown") {
          e.preventDefault();
          const pageSize = Math.max(1, Math.floor((parentRef.current?.clientHeight ?? 400) / rowHeight));
          const next = Math.min(rowEntries.length - 1, (idx < 0 ? 0 : idx) + pageSize);
          if (e.shiftKey) store.selectRange(rowEntries[next].path); else store.selectOnly(rowEntries[next].path);
          virtualizer.scrollToIndex(flat.findIndex((i) => i.entry?.path === rowEntries[next].path), { align: "auto" });
        } else if (e.key === "PageUp") {
          e.preventDefault();
          const pageSize = Math.max(1, Math.floor((parentRef.current?.clientHeight ?? 400) / rowHeight));
          const prev = Math.max(0, (idx < 0 ? 0 : idx) - pageSize);
          if (e.shiftKey) store.selectRange(rowEntries[prev].path); else store.selectOnly(rowEntries[prev].path);
          virtualizer.scrollToIndex(flat.findIndex((i) => i.entry?.path === rowEntries[prev].path), { align: "auto" });
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
        <div className="filelist-head" style={{ gridTemplateColumns }} onContextMenu={openColumnMenu}>
          {visibleCols.map((colId) => {
            if (colId === "name") {
              return (
                <div key="name" className="col-head col-name" onClick={() => store.toggleSort("name")}>
                  Name <span className="sort-arrow">{activeTab.sortKey === "name" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span>
                </div>
              );
            }
            if (colId === "modified") {
              return (
                <div key="modified" className="col-head col-modified" onClick={() => store.toggleSort("modified")}>
                  Date modified <span className="sort-arrow">{activeTab.sortKey === "modified" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span>
                </div>
              );
            }
            if (colId === "created") {
              return (
                <div key="created" className="col-head col-created" onClick={() => store.toggleSort("created")}>
                  Date created <span className="sort-arrow">{activeTab.sortKey === "created" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span>
                </div>
              );
            }
            if (colId === "type") {
              return (
                <div key="type" className="col-head col-type" onClick={() => store.toggleSort("type")}>
                  Type <span className="sort-arrow">{activeTab.sortKey === "type" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span>
                </div>
              );
            }
            if (colId === "size") {
              return (
                <div key="size" className="col-head col-size" onClick={() => store.toggleSort("size")}>
                  Size <span className="sort-arrow">{activeTab.sortKey === "size" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span>
                </div>
              );
            }
            if (colId === "ext") {
              return (
                <div key="ext" className="col-head col-ext" onClick={() => store.toggleSort("type")}>
                  Ext <span className="sort-arrow">{activeTab.sortKey === "type" ? (activeTab.sortDesc ? "▼" : "▲") : ""}</span>
                </div>
              );
            }
            return null;
          })}
          <button
            className="icon-btn"
            style={{ width: 20, height: 20, padding: 0, opacity: 0.6, justifySelf: "end" }}
            onClick={openColumnMenu}
            title="Customize columns (right-click or click here)"
          >
            <SlidersHorizontal size={12} />
          </button>
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
                data-path={entry.path}
                className={`row ${selected ? "selected" : ""}`}
                data-drop-path={entry.isDir ? entry.path : undefined}
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
                  gridTemplateColumns,
                }}
                onPointerDown={(e) => onRowPointerDown(entry, e)}
                onPointerUp={(e) => onRowPointerUp(entry, e)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, input")) return;
                  if (marquee.isMarqueeActive) return;
                  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    store.selectOnly(entry.path);
                  }
                }}
                onDragStart={(e) => e.preventDefault()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if ((e.target as HTMLElement).closest("button, input")) return;
                  void store.openEntry(entry);
                }}
                onContextMenu={(e) => onRowContextMenu(entry, e)}
              >
                {visibleCols.map((colId) => {
                  if (colId === "name") {
                    return (
                      <div key="name" className="row-name-cell">
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
                    );
                  }
                  if (colId === "modified") {
                    return <div key="modified" className="row-col row-col-modified">{formatDate(entry.modifiedMs)}</div>;
                  }
                  if (colId === "created") {
                    return <div key="created" className="row-col row-col-created" style={{ color: "var(--text-faint)" }}>{formatDate(entry.createdMs)}</div>;
                  }
                  if (colId === "type") {
                    return <div key="type" className="row-col row-col-type">{entry.isDir ? "Folder" : (entry.ext.toUpperCase() || "File")}</div>;
                  }
                  if (colId === "ext") {
                    return <div key="ext" className="row-col row-col-ext" style={{ color: "var(--text-faint)" }}>{entry.isDir ? "" : (entry.ext ? `.${entry.ext}` : "")}</div>;
                  }
                  if (colId === "size") {
                    const sizeObj = entry.isDir
                      ? (store.folderSizes[entry.path] ?? store.folderSizes[normalizePath(entry.path)] ?? store.folderSizes[normalizePath(entry.path).toLowerCase()])
                      : null;
                    const isTaskActive = entry.isDir && Boolean(
                      store.folderSizeTasks[entry.path] ?? store.folderSizeTasks[normalizePath(entry.path)] ?? store.folderSizeTasks[normalizePath(entry.path).toLowerCase()]
                    );
                    const entrySize = entry.isDir ? (sizeObj?.size ?? 0) : entry.size;

                    return (
                      <div
                        key="size"
                        className="row-col row-col-size"
                        onClick={(e) => {
                          if (entry.isDir) {
                            e.stopPropagation();
                            void store.calculateFolderSize(entry.path);
                          }
                        }}
                        title={
                          entry.isDir
                            ? sizeObj
                              ? `${sizeObj.files.toLocaleString()} files, ${sizeObj.folders.toLocaleString()} folders (Click to recalculate)`
                              : isTaskActive
                                ? "Calculating folder size…"
                                : "Click to calculate folder size"
                            : undefined
                        }
                        style={{ cursor: entry.isDir ? "pointer" : "default", position: "relative" }}
                      >
                        {/* Subtle Relative Proportional Indicator */}
                        {maxFolderSize > 0 && entrySize > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: 2,
                              bottom: 2,
                              right: 0,
                              width: `${Math.min(100, (entrySize / maxFolderSize) * 100)}%`,
                              background: entry.isDir
                                ? "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.12))"
                                : "linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.10))",
                              borderRadius: 3,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                        {entry.isDir ? (
                          sizeObj ? (
                            <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 3 }}>
                              {formatBytes(sizeObj.size)}
                              {isTaskActive && <span style={{ color: "var(--accent)", fontSize: 10 }}>⚡</span>}
                            </span>
                          ) : isTaskActive ? (
                            <span style={{ position: "relative", zIndex: 1, color: "var(--accent)", fontStyle: "italic", fontSize: 11 }}>
                              Computing…
                            </span>
                          ) : (
                            <span style={{ position: "relative", zIndex: 1, color: "var(--text-faint)" }}>—</span>
                          )
                        ) : (
                          <span style={{ position: "relative", zIndex: 1 }}>{formatBytes(entry.size)}</span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
                <div style={{ width: 24 }} />
              </div>
            );
          })}
        </div>
      </div>
      {marquee.renderMarquee()}
    </div>
  );
}

