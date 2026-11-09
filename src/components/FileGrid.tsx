import RenameInput from "./RenameInput";
import { useMemo, useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAppStore } from "@/state/store";
import { visibleEntries } from "@/lib/entries";
import { iconForEntry } from "@/lib/fileIcons";
import { assetUrl } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { isImageExt } from "@/lib/format";
import { beginDrag } from "@/lib/dnd";
import { entryMenu, backgroundMenu } from "@/lib/menus";
import { normalizePath, samePath } from "@/lib/paths";
import { useMarqueeSelection } from "@/hooks/useMarqueeSelection";
import { handleVimKeyEvent } from "@/lib/vimNavigation";
import type { FileEntry } from "@/types";

export function FileGrid() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId)!;
  const settings = store.settings;
  const parentRef = useRef<HTMLDivElement>(null);
  const marquee = useMarqueeSelection({ containerRef: parentRef });
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const rows = useMemo(
    () => visibleEntries(activeTab, settings, store.folderSizes),
    [activeTab, settings, store.folderSizes],
  );

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

  const minTileWidth = 104;
  const gap = 6;
  const horizontalPadding = 24; // 12px on each side
  const columnsCount = Math.max(1, Math.floor((containerWidth - horizontalPadding + gap) / (minTileWidth + gap)));

  const gridRows = useMemo(() => {
    const chunks: FileEntry[][] = [];
    for (let i = 0; i < rows.length; i += columnsCount) {
      chunks.push(rows.slice(i, i + columnsCount));
    }
    return chunks;
  }, [rows, columnsCount]);

  const tileHeight = 118;
  const rowHeight = tileHeight + gap;

  const virtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
    initialRect: { width: 800, height: 600 },
  });

  const renderTile = (entry: FileEntry) => {
    const selected = activeTab.selected.some((p) => samePath(p, entry.path));
    const { Icon, tone } = iconForEntry(entry, false);
    return (
      <div
        key={entry.path}
        data-path={entry.path}
        className={`tile ${selected ? "selected" : ""}`}
        data-drop-path={entry.isDir ? entry.path : undefined}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (target.closest("button, input")) return;
          const isIconOrName = target.closest(".tile-icon, .tile-name");
          if (!isIconOrName) {
            marquee.onPointerDown(e);
            return;
          }
          if (e.ctrlKey || e.metaKey) store.toggleSelection(entry.path);
          else if (e.shiftKey) store.selectRange(entry.path);
          else if (!activeTab.selected.some((p) => samePath(p, entry.path))) store.selectOnly(entry.path);
          const sp = store.tabs.find((t) => t.id === store.activeTabId)?.selected ?? [entry.path];
          const dragPaths = sp.length > 1 && sp.some((p) => samePath(p, entry.path)) ? sp : [entry.path];
          beginDrag(dragPaths, e.clientX, e.clientY);
        }}
        onDragStart={(e) => e.preventDefault()}
        onPointerUp={(e) => {
          if (e.button !== 0) return;
          if (marquee.isMarqueeActive) return;
          if ((e.target as HTMLElement).closest("button, input")) return;
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey && activeTab.selected.length > 1) {
            store.selectOnly(entry.path);
          }
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, input")) return;
          if (marquee.isMarqueeActive) return;
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
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
          const sel = isSelected ? activeTab.selected : [entry.path];
          store.openContextMenu(e.clientX, e.clientY, entryMenu(sel, store));
        }}
      >
        <div className="tile-icon">
          {entry.isDir ? (
            <Icon size={44} />
          ) : isImageExt(entry.ext) ? (
            <img
              src={assetUrl(entry.path)}
              alt={entry.name}
              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }}
              draggable={false}
              onError={(event) => {
                const img = event.currentTarget;
                img.onerror = null;
                if (!img.src.endsWith("/icons/filetypes/image.svg")) img.src = "/icons/filetypes/image.svg";
              }}
              loading="lazy"
            />
          ) : (
            <span className={`file-icon tone-${tone}`}>
              <Icon size={34} strokeWidth={1.5} />
            </span>
          )}
        </div>
        <div className="tile-name" title={entry.name}>
          {store.renamingPath === entry.path ? (
            <RenameInput
              name={entry.name}
              onCommit={(name) => void store.renameTo(entry.path, name)}
              onCancel={() => store.setRenaming(null)}
            />
          ) : (
            entry.name
          )}
        </div>
        <div
          className="tile-meta"
          onClick={(e) => {
            if (entry.isDir) {
              e.stopPropagation();
              void store.calculateFolderSize(entry.path);
            }
          }}
          style={entry.isDir ? { cursor: "pointer" } : undefined}
          title={entry.isDir ? "Click to recalculate size" : undefined}
        >
          {entry.isDir ? (
            (() => {
              const sizeObj =
                store.folderSizes[entry.path] ??
                store.folderSizes[normalizePath(entry.path)] ??
                store.folderSizes[normalizePath(entry.path).toLowerCase()];
              const isTask = Boolean(
                store.folderSizeTasks[entry.path] ??
                  store.folderSizeTasks[normalizePath(entry.path)] ??
                  store.folderSizeTasks[normalizePath(entry.path).toLowerCase()]
              );
              if (sizeObj) {
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    {formatBytes(sizeObj.size)}
                    {isTask && <span style={{ color: "var(--accent)", fontSize: 9 }}>⚡</span>}
                  </span>
                );
              }
              if (isTask) return <span style={{ color: "var(--accent)" }}>Computing…</span>;
              return "Folder";
            })()
          ) : (
            formatBytes(entry.size)
          )}
        </div>
        {(tagMap.get(entry.path.toLowerCase()) ?? []).length > 0 && (
          <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
            {(tagMap.get(entry.path.toLowerCase()) ?? []).map((color, i) => (
              <span
                key={`${color}-${i}`}
                title="Tagged"
                style={{ width: 7, height: 7, borderRadius: 4, background: color }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={parentRef}
      className="filegrid viewport"
      data-drop-path={activeTab.path}
      tabIndex={0}
      onPointerDown={marquee.onPointerDown}
      onKeyDown={(e) => {
        if (settings.vimModeEnabled !== false && handleVimKeyEvent(e.nativeEvent)) return;
        if (rows.length === 0) return;
        const lastSelected = activeTab.selected[activeTab.selected.length - 1];
        const currentIdx = rows.findIndex((r) => samePath(r.path, lastSelected ?? ""));

        if (e.key === "ArrowRight") {
          e.preventDefault();
          const next = Math.min(rows.length - 1, currentIdx < 0 ? 0 : currentIdx + 1);
          if (e.shiftKey) store.selectRange(rows[next].path);
          else store.selectOnly(rows[next].path);
          const targetRowIdx = Math.floor(next / columnsCount);
          virtualizer.scrollToIndex(targetRowIdx, { align: "auto" });
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          const prev = Math.max(0, currentIdx < 0 ? 0 : currentIdx - 1);
          if (e.shiftKey) store.selectRange(rows[prev].path);
          else store.selectOnly(rows[prev].path);
          const targetRowIdx = Math.floor(prev / columnsCount);
          virtualizer.scrollToIndex(targetRowIdx, { align: "auto" });
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = Math.min(rows.length - 1, currentIdx < 0 ? 0 : currentIdx + columnsCount);
          if (e.shiftKey) store.selectRange(rows[next].path);
          else store.selectOnly(rows[next].path);
          const targetRowIdx = Math.floor(next / columnsCount);
          virtualizer.scrollToIndex(targetRowIdx, { align: "auto" });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev = Math.max(0, currentIdx < 0 ? 0 : currentIdx - columnsCount);
          if (e.shiftKey) store.selectRange(rows[prev].path);
          else store.selectOnly(rows[prev].path);
          const targetRowIdx = Math.floor(prev / columnsCount);
          virtualizer.scrollToIndex(targetRowIdx, { align: "auto" });
        } else if (e.key === "Home") {
          e.preventDefault();
          store.selectOnly(rows[0].path);
          virtualizer.scrollToIndex(0, { align: "start" });
        } else if (e.key === "End") {
          e.preventDefault();
          store.selectOnly(rows[rows.length - 1].path);
          virtualizer.scrollToIndex(gridRows.length - 1, { align: "end" });
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (currentIdx >= 0 && rows[currentIdx]) {
            void store.openEntry(rows[currentIdx]);
          }
        }
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest(".tile") === null) {
          e.preventDefault();
          store.openContextMenu(e.clientX, e.clientY, backgroundMenu(activeTab.path, store));
        }
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
          padding: "12px 0",
        }}
      >
        {(virtualizer.getVirtualItems().length > 0
          ? virtualizer.getVirtualItems()
          : gridRows.slice(0, 10).map((_, i) => ({ index: i, start: i * rowHeight }))
        ).map((vRow) => {
          const rowItems = gridRows[vRow.index] ?? [];
          return (
            <div
              key={vRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columnsCount}, minmax(104px, 1fr))`,
                gap: `${gap}px`,
                padding: "0 12px",
              }}
            >
              {rowItems.map((entry) => renderTile(entry))}
            </div>
          );
        })}
      </div>
      {marquee.renderMarquee()}
    </div>
  );
}
