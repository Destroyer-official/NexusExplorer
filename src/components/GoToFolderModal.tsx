import { useState, useRef, useEffect, useMemo } from "react";
import { useAppStore } from "@/state/store";
import { ipc } from "@/lib/ipc";
import { FolderOpen, X, ArrowRight, ExternalLink, HardDrive } from "lucide-react";

export function GoToFolderModal() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const currentPath = activeTab?.path ?? "";
  const [targetPath, setTargetPath] = useState(currentPath);
  const [isValidating, setIsValidating] = useState(false);
  const [pathExists, setPathExists] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Debounced check for path existence
  useEffect(() => {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      setPathExists(null);
      return;
    }
    let active = true;
    setIsValidating(true);
    const timer = setTimeout(async () => {
      try {
        const entries = await ipc.readDir(trimmed);
        if (active) setPathExists(Array.isArray(entries));
      } catch {
        if (active) setPathExists(false);
      } finally {
        if (active) setIsValidating(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [targetPath]);

  const quickFolders = useMemo(() => {
    const list: { label: string; path: string }[] = [];
    store.knownFolders.forEach((f) => {
      list.push({ label: f.label, path: f.path });
    });
    store.drives.forEach((d) => {
      list.push({ label: d.label || d.path, path: d.path });
    });
    return list.slice(0, 8);
  }, [store.knownFolders, store.drives]);

  const handleNavigate = (inNewTab = false) => {
    const trimmed = targetPath.trim();
    if (!trimmed) return;
    if (inNewTab) {
      void store.openTab(trimmed, true, false);
    } else {
      void store.navigateTo(trimmed);
    }
    store.setGoToFolderOpen(false);
  };

  return (
    <div className="overlay confirmation-overlay" onClick={() => store.setGoToFolderOpen(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goto-folder-title"
        style={{ width: 500 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") store.setGoToFolderOpen(false);
          if (e.key === "Enter") {
            e.preventDefault();
            handleNavigate(e.ctrlKey || e.metaKey);
          }
        }}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <div id="goto-folder-title" className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={16} color="var(--accent)" />
            <span>Go to Folder</span>
          </div>
          <span style={{ flex: 1 }} />
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => store.setGoToFolderOpen(false)}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="goto-input" style={{ fontSize: 12, fontWeight: 600 }}>Directory Path</label>
            <input
              id="goto-input"
              ref={inputRef}
              className="input"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="e.g. C:\Users, D:\Projects, \\wsl$\Ubuntu"
              style={{ fontSize: 13, fontFamily: "monospace" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, minHeight: 18, fontSize: 11 }}>
              {isValidating && <span style={{ color: "var(--text-faint)" }}>Validating path…</span>}
              {!isValidating && pathExists === true && (
                <span style={{ color: "#10b981", fontWeight: 600 }}>✓ Valid directory path</span>
              )}
              {!isValidating && pathExists === false && targetPath.trim() && (
                <span style={{ color: "#f59e0b" }}>Path not found or inaccessible</span>
              )}
            </div>
          </div>

          {/* Quick Destination Chips */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>
              Quick Destinations
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {quickFolders.map((q) => (
                <button
                  key={q.path}
                  type="button"
                  className="chip"
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: targetPath === q.path ? "var(--accent-dim, rgba(56, 189, 248, 0.15))" : "var(--bg-2)",
                    border: targetPath === q.path ? "1px solid var(--accent)" : "1px solid var(--border)",
                    color: targetPath === q.path ? "var(--accent)" : "var(--text)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  onClick={() => setTargetPath(q.path)}
                >
                  <HardDrive size={11} style={{ opacity: 0.6 }} />
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            Press <kbd className="kbd" style={{ fontSize: 10 }}>Ctrl+Enter</kbd> to open in new tab
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => store.setGoToFolderOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleNavigate(true)}
              disabled={!targetPath.trim()}
              title="Open folder in a new tab"
            >
              <ExternalLink size={13} style={{ marginRight: 4 }} />
              Open in New Tab
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleNavigate(false)}
              disabled={!targetPath.trim()}
            >
              <ArrowRight size={13} style={{ marginRight: 4 }} />
              Navigate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoToFolderModal;

