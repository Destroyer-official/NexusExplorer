import { useState, useMemo, useRef, useEffect } from "react";
import { useAppStore } from "@/state/store";
import { basename } from "@/lib/paths";
import { Folder, Lock, Search, X, Check } from "lucide-react";

const COLOR_HEX: Record<string, string> = {
  blue: "#38bdf8",
  emerald: "#10b981",
  orange: "#f59e0b",
  purple: "#a855f7",
  rose: "#f43f5e",
};

export function TabSearchModal() {
  const store = useAppStore();
  const tabs = store.tabs;
  const activeTabId = store.activeTabId;
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return tabs;
    return tabs.filter((t) => {
      const title = (t.title || basename(t.path)).toLowerCase();
      const p = t.path.toLowerCase();
      const color = (t.colorGroup || "").toLowerCase();
      return title.includes(q) || p.includes(q) || color.includes(q);
    });
  }, [tabs, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelectTab = (tabId: string) => {
    store.activateTab(tabId);
    store.setTabSearchOpen(false);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    void store.closeTab(tabId);
  };

  return (
    <div className="overlay confirmation-overlay" onClick={() => store.setTabSearchOpen(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tab-search-title"
        style={{ width: 540, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            store.setTabSearchOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((idx) => (idx + 1) % Math.max(1, filtered.length));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((idx) => (idx - 1 + filtered.length) % Math.max(1, filtered.length));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[selectedIndex]) {
              handleSelectTab(filtered[selectedIndex].id);
            }
          }
        }}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <div id="tab-search-title" className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={16} color="var(--accent)" />
            <span>Search & Switch Tabs</span>
          </div>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--text-faint)", marginRight: 8 }}>
            {filtered.length} of {tabs.length} tabs
          </span>
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => store.setTabSearchOpen(false)}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 6 }}>
          <div className="field" style={{ margin: 0 }}>
            <input
              ref={inputRef}
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tabs by name, directory path, or color group…"
              style={{ fontSize: 13 }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 360,
              overflowY: "auto",
              paddingRight: 2,
            }}
          >
            {filtered.map((t, idx) => {
              const isActive = t.id === activeTabId;
              const isSelected = idx === selectedIndex;
              const title = t.title || basename(t.path);
              const color = t.colorGroup ? (COLOR_HEX[t.colorGroup] || t.colorGroup) : null;

              return (
                <div
                  key={t.id}
                  className={`menu-item ${isSelected ? "selected" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: isSelected
                      ? "var(--accent-subtle, rgba(56, 189, 248, 0.12))"
                      : isActive
                      ? "var(--hover)"
                      : "transparent",
                    borderLeft: color ? `3px solid ${color}` : "3px solid transparent",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid transparent",
                  }}
                  onClick={() => handleSelectTab(t.id)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <Folder size={16} style={{ color: color || "var(--accent)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: isActive ? 700 : 500, fontSize: 13 }}>{title}</span>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 5px",
                            borderRadius: 3,
                            background: "var(--accent)",
                            color: "#fff",
                            fontWeight: 600,
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                      {t.isLocked && <Lock size={11} style={{ opacity: 0.6 }} />}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-faint)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 1,
                      }}
                      title={t.path}
                    >
                      {t.path}
                    </div>
                  </div>

                  {isActive && <Check size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />}

                  {!t.isLocked && tabs.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 22, height: 22, padding: 0, opacity: 0.6, flexShrink: 0 }}
                      onClick={(e) => handleCloseTab(e, t.id)}
                      title="Close Tab"
                      aria-label="Close Tab"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
                No matching open tabs found.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            <kbd className="kbd" style={{ fontSize: 10 }}>↑</kbd> <kbd className="kbd" style={{ fontSize: 10 }}>↓</kbd> Navigate • <kbd className="kbd" style={{ fontSize: 10 }}>Enter</kbd> Switch • <kbd className="kbd" style={{ fontSize: 10 }}>Esc</kbd> Close
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => store.setTabSearchOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TabSearchModal;

