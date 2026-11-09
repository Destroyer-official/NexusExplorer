import { useState, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { ipc, toErrorMessage } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { iconForEntry } from "@/lib/fileIcons";
import { entryMenu } from "@/lib/menus";
import { beginDrag } from "@/lib/dnd";
import { useAppStore } from "@/state/store";
import type { FileEntry } from "@/types";

interface Column {
  path: string;
  entries: FileEntry[];
  selectedPath: string | null;
  loading: boolean;
  error?: string;
}

export function MillerColumns() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const rootPath = activeTab?.path ?? "C:\\";

  const [columns, setColumns] = useState<Column[]>([]);
  const [activeColIndex, setActiveColIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize root column
  useEffect(() => {
    let cancelled = false;
    const loadRoot = async () => {
      try {
        const entries = await ipc.readDir(rootPath);
        if (!cancelled) {
          setColumns([
            {
              path: rootPath,
              entries,
              selectedPath: null,
              loading: false,
            },
          ]);
          setActiveColIndex(0);
        }
      } catch (cause) { if (!cancelled) setColumns([{ path: rootPath, entries: [], selectedPath: null, loading: false, error: toErrorMessage(cause) }]); }
    };
    void loadRoot();
    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  // Handle row selection in column i
  const handleSelect = async (colIndex: number, entry: FileEntry) => {
    setActiveColIndex(colIndex);

    // Update selection in column i
    const nextCols = columns.slice(0, colIndex + 1);
    nextCols[colIndex].selectedPath = entry.path;

    if (entry.isDir) {
      // Append loading child column
      const childCol: Column = {
        path: entry.path,
        entries: [],
        selectedPath: null,
        loading: true,
      };
      setColumns([...nextCols, childCol]);

      try {
        const childEntries = await ipc.readDir(entry.path);
        setColumns((prev) => {
          const updated = [...prev];
          if (updated[colIndex + 1]?.path === entry.path) {
            updated[colIndex + 1].entries = childEntries;
            updated[colIndex + 1].loading = false;
          }
          return updated;
        });
      } catch (cause) {
        setColumns((prev) => {
          const updated = [...prev];
          if (updated[colIndex + 1]?.path === entry.path) updated[colIndex + 1] = { ...updated[colIndex + 1], loading: false, error: toErrorMessage(cause) };
          return updated;
        });
      }
    } else {
      // It's a file
      setColumns(nextCols);
      store.selectOnly(entry.path);
    }

    // Scroll container to the right
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = containerRef.current.scrollWidth;
      }
    }, 50);
  };

  // Keyboard navigation across cascading columns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || target?.closest("input, textarea, select, button, [contenteditable=true]") || document.querySelector(".overlay, .palette-overlay, .modal-backdrop, [aria-modal=true]")) return;
      if (!columns[activeColIndex]) return;
      const currentCol = columns[activeColIndex];
      const entries = currentCol.entries.filter((entry) => (store.settings.showHidden || !entry.isHidden) && (store.settings.showSystem || !entry.isSystem) && (!activeTab?.quickFilter || entry.name.toLocaleLowerCase().includes(activeTab.quickFilter.toLocaleLowerCase())));
      const currentSelectedIdx = entries.findIndex((en) => en.path === currentCol.selectedPath);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = Math.min(entries.length - 1, currentSelectedIdx + 1);
        if (entries[nextIdx]) void handleSelect(activeColIndex, entries[nextIdx]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIdx = Math.max(0, currentSelectedIdx - 1);
        if (entries[prevIdx]) void handleSelect(activeColIndex, entries[prevIdx]);
      } else if (e.key === "ArrowRight") {
        if (columns[activeColIndex + 1] && columns[activeColIndex + 1].entries.length > 0) {
          e.preventDefault();
          setActiveColIndex(activeColIndex + 1);
          const first = columns[activeColIndex + 1].entries[0];
          if (first) void handleSelect(activeColIndex + 1, first);
        }
      } else if (e.key === "ArrowLeft") {
        if (activeColIndex > 0) {
          e.preventDefault();
          setActiveColIndex(activeColIndex - 1);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentSelectedIdx >= 0 && entries[currentSelectedIdx]) {
          const entry = entries[currentSelectedIdx];
          if (entry.isDir) void store.navigateTo(entry.path);
          else void store.openEntry(entry);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [columns, activeColIndex]);

  return (
    <div
      ref={containerRef}
      className="miller-columns"
      style={{
        display: "flex",
        flex: 1,
        height: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        background: "var(--bg)",
      }}
    >
      {columns.map((col, colIdx) => (
        <div
          key={col.path + colIdx}
          style={{
            minWidth: 260,
            width: 280,
            maxWidth: 320,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            background: colIdx === activeColIndex ? "var(--surface)" : "var(--bg)",
          }}
        >
          {/* Column Header */}
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-dim)",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-hover)",
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {col.path.split(/[\\/]/).filter(Boolean).pop() || col.path}
          </div>

          {/* Column items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {col.loading ? (
              <div style={{ padding: 16, fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                Loading...
              </div>
            ) : col.error ? (<div role="alert" style={{ padding: 16, color: "var(--danger)" }}>{col.error}</div>) : col.entries.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                Empty Folder
              </div>
            ) : (
              col.entries.filter((entry) => (store.settings.showHidden || !entry.isHidden) && (store.settings.showSystem || !entry.isSystem) && (!activeTab?.quickFilter || entry.name.toLocaleLowerCase().includes(activeTab.quickFilter.toLocaleLowerCase()))).map((entry) => {
                const isSelected = entry.path === col.selectedPath;
                return (
                  <div
                    key={entry.path}
                    data-path={entry.path}
                    onClick={() => handleSelect(colIdx, entry)}
                    onPointerDown={(e) => {
                      if (e.button === 0) {
                        store.selectOnly(entry.path);
                        beginDrag([entry.path], e.clientX, e.clientY);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      store.selectOnly(entry.path);
                      store.openContextMenu(e.clientX, e.clientY, entryMenu([entry.path], store));
                    }}
                    onDoubleClick={() => {
                      if (entry.isDir) void store.navigateTo(entry.path);
                      else void store.openEntry(entry);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      background: isSelected ? "var(--accent-subtle)" : "transparent",
                      color: isSelected ? "var(--accent)" : "var(--text)",
                      borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                      {(() => {
                        const { Icon, tone } = iconForEntry(entry, false);
                        return <span className={`file-icon tone-${tone}`}><Icon size={14} /></span>;
                      })()}
                      <span
                        style={{
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {entry.name}
                      </span>
                    </div>

                    {entry.isDir ? (
                      <ChevronRight size={13} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-faint)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
                        {formatBytes(entry.size)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
