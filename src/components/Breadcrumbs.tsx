import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronDown, HardDrive, Smartphone, Folder, History, FolderOpen } from "lucide-react";
import { useAppStore } from "@/state/store";
import { splitPath, samePath } from "@/lib/paths";
import { ipc } from "@/lib/ipc";
import type { FileEntry } from "@/types";

export default function Breadcrumbs() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const path = activeTab?.path ?? "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(path);
  const finished = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sibling / Subfolder dropdown state
  const [dropdownAnchor, setDropdownAnchor] = useState<{ x: number; y: number; path: string } | null>(null);
  const [dropdownEntries, setDropdownEntries] = useState<FileEntry[]>([]);
  const [loadingDropdown, setLoadingDropdown] = useState(false);

  // History dropdown state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAnchor, setHistoryAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = () => {
      finished.current = false;
      setEditing(true);
      setValue(path);
      setTimeout(() => inputRef.current?.select(), 0);
    };
    window.addEventListener("nexus:focus-address", handler);
    return () => window.removeEventListener("nexus:focus-address", handler);
  }, [path]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) setValue(path);
  }, [path, editing]);

  useEffect(() => {
    if (!dropdownAnchor && !historyOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".breadcrumb-popover")) return;
      setDropdownAnchor(null);
      setHistoryOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdownAnchor(null);
        setHistoryOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [dropdownAnchor, historyOpen]);

  const segments = splitPath(path);

  const historyItems = useMemo(() => {
    const list: string[] = [];
    if (activeTab?.history) {
      for (const h of activeTab.history) {
        if (h && !list.includes(h) && !samePath(h, path)) list.push(h);
      }
    }
    for (const r of store.recent) {
      if (r.path && !list.includes(r.path) && !samePath(r.path, path)) list.push(r.path);
    }
    return list.slice(0, 12);
  }, [activeTab?.history, store.recent, path]);

  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed && !samePath(trimmed, path)) void store.navigateTo(trimmed);
  };

  const toggleDropdown = async (segPath: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dropdownAnchor?.path === segPath) {
      setDropdownAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownAnchor({ x: rect.left, y: rect.bottom + 4, path: segPath });
    setHistoryOpen(false);
    setLoadingDropdown(true);
    try {
      const list = await ipc.readDir(segPath);
      setDropdownEntries(list.filter((entry) => entry.isDir).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setDropdownEntries([]);
    } finally {
      setLoadingDropdown(false);
    }
  };

  const toggleHistory = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHistoryAnchor({ x: Math.max(10, rect.right - 260), y: rect.bottom + 4 });
    setDropdownAnchor(null);
    setHistoryOpen(true);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="address-edit"
        aria-label="Folder path"
        onFocus={(event) => event.currentTarget.select()}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            commit();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            finished.current = true;
            setEditing(false);
            setValue(path);
          }
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <div
      className="breadcrumbs"
      style={{ position: "relative" }}
      onDoubleClick={() => {
        finished.current = false;
        setEditing(true);
        setValue(path);
      }}
    >
      {segments.map((seg, idx) => (
        <span key={seg.path} style={{ display: "flex", alignItems: "center", gap: 2 }} data-drop-path={seg.path}>
          {idx > 0 && (
            <button
              type="button"
              className="crumb-sep-btn"
              onClick={(e) => void toggleDropdown(segments[idx - 1].path, e)}
              title={`Show subfolders in ${segments[idx - 1].label}`}
              aria-label={`Show subfolders in ${segments[idx - 1].label}`}
              style={{
                background: dropdownAnchor?.path === segments[idx - 1].path ? "var(--hover)" : "transparent",
                border: "none",
                padding: "2px 2px",
                borderRadius: 3,
                cursor: "pointer",
                color: "var(--text-faint)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={12} className="crumb-sep" />
            </button>
          )}
          <button
            type="button"
            className={`crumb ${idx === segments.length - 1 ? "current" : ""}`}
            onClick={() => void store.navigateTo(seg.path)}
            title={seg.path}
          >
            {idx === 0 && (
              path.startsWith("wpd://") ? (
                <Smartphone size={12} style={{ marginRight: 4, verticalAlign: "middle", color: "#10b981" }} />
              ) : (
                <HardDrive size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              )
            )}
            {seg.label}
          </button>
        </span>
      ))}

      {/* Trailing chevron on current folder to browse child folders directly */}
      {segments.length > 0 && (
        <button
          type="button"
          className="crumb-sep-btn"
          onClick={(e) => void toggleDropdown(segments[segments.length - 1].path, e)}
          title={`Show subfolders in ${segments[segments.length - 1].label}`}
          aria-label={`Show subfolders in ${segments[segments.length - 1].label}`}
          style={{
            background: dropdownAnchor?.path === segments[segments.length - 1].path ? "var(--hover)" : "transparent",
            border: "none",
            padding: "2px 2px",
            borderRadius: 3,
            cursor: "pointer",
            color: "var(--text-faint)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={12} className="crumb-sep" />
        </button>
      )}

      {/* History & Recent Places trigger */}
      <button
        type="button"
        className="icon-btn"
        style={{
          width: 18,
          height: 18,
          padding: 0,
          opacity: 0.6,
          marginLeft: "auto",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={toggleHistory}
        title="History & Recent Locations"
        aria-label="History & Recent Locations"
      >
        <ChevronDown size={11} />
      </button>

      {/* Subfolder Popover Menu */}
      {dropdownAnchor && (
        <div
          className="context-menu breadcrumb-popover"
          style={{
            position: "fixed",
            left: dropdownAnchor.x,
            top: dropdownAnchor.y,
            minWidth: 200,
            maxWidth: 320,
            maxHeight: 280,
            overflowY: "auto",
            zIndex: 100,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 8px 6px",
              color: "var(--text-faint)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            Subfolders ({dropdownEntries.length})
          </div>
          {loadingDropdown && <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>Loading…</div>}
          {!loadingDropdown && dropdownEntries.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>No subfolders</div>
          )}
          {!loadingDropdown &&
            dropdownEntries.map((folder) => (
              <button
                key={folder.path}
                type="button"
                className="menu-item"
                style={{ width: "100%", justifyContent: "flex-start", gap: 8, padding: "5px 8px", fontSize: 12 }}
                onClick={() => {
                  void store.navigateTo(folder.path);
                  setDropdownAnchor(null);
                }}
              >
                <Folder size={13} style={{ color: "var(--accent)" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
              </button>
            ))}
        </div>
      )}

      {/* History & Visited Locations Popover Menu */}
      {historyOpen && historyAnchor && (
        <div
          className="context-menu breadcrumb-popover"
          style={{
            position: "fixed",
            left: historyAnchor.x,
            top: historyAnchor.y,
            minWidth: 260,
            maxWidth: 360,
            maxHeight: 340,
            overflowY: "auto",
            zIndex: 100,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 8px 6px",
              color: "var(--text-faint)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <History size={12} />
            <span>Recent & Visited Locations</span>
          </div>
          {historyItems.map((histPath) => (
            <button
              key={histPath}
              type="button"
              className="menu-item"
              style={{ width: "100%", justifyContent: "flex-start", gap: 8, padding: "5px 8px", fontSize: 12 }}
              onClick={() => {
                void store.navigateTo(histPath);
                setHistoryOpen(false);
              }}
              title={histPath}
            >
              <FolderOpen size={13} style={{ color: "var(--accent)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{histPath}</span>
            </button>
          ))}
          {historyItems.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-dim)" }}>No history yet</div>
          )}
        </div>
      )}
    </div>
  );
}
