import { useState } from "react";
import { useAppStore } from "@/state/store";
import { basename, dirname, joinPath } from "@/lib/paths";
import { iconForEntry } from "@/lib/fileIcons";
import { beginDrag } from "@/lib/dnd";
import { ipc, toErrorMessage } from "@/lib/ipc";
import {
  Copy,
  FolderInput,
  X,
  Plus,
  Trash2,
  Clock,
  Link2,
  Archive,
  FolderArchive,
  Radio,
  ChevronDown,
  Sparkles,
  FileCheck,
} from "lucide-react";

interface StagingShelfWidgetProps {
  embedded?: boolean;
}

export default function StagingShelfWidget({ embedded = false }: StagingShelfWidgetProps) {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const dest = activeTab?.path ?? "";
  const stagedPaths = store.stagingPaths;
  const mode = store.stagingMode;
  const activeSlot = store.activeStagingSlot;

  const [pasteAsOpen, setPasteAsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [patternInputOpen, setPatternInputOpen] = useState(false);
  const [patternStr, setPatternStr] = useState("{name}_backup_{date}");
  const [selectedBroadcastDirs, setSelectedBroadcastDirs] = useState<string[]>([]);

  // Collect potential broadcast destinations from other tabs, bookmarks, drives
  const broadcastDestinations = Array.from(
    new Set([
      ...store.tabs.map((t) => t.path).filter((p) => p && p !== dest),
      ...store.bookmarks.map((b) => b.path).filter((p) => p && p !== dest),
      ...store.drives.map((d) => d.path).filter((p) => p && p !== dest),
    ])
  );

  const handleDragStart = (path: string, e: React.PointerEvent) => {
    if (e.button === 0) {
      beginDrag([path], e.clientX, e.clientY);
    }
  };

  const handlePasteAs = async (kind: "symlink" | "hardlink" | "shortcut" | "zip" | "extract" | "pattern") => {
    setPasteAsOpen(false);
    if (kind === "pattern") {
      setPatternInputOpen(true);
      return;
    }
    await store.pasteStagedAs(kind, dest);
  };

  const handleExecutePatternPaste = async () => {
    setPatternInputOpen(false);
    await store.pasteStagedAs("pattern", dest, patternStr);
  };

  const handleExecuteBroadcast = async () => {
    setBroadcastOpen(false);
    if (selectedBroadcastDirs.length > 0) {
      await store.broadcastPaste(selectedBroadcastDirs);
      setSelectedBroadcastDirs([]);
    }
  };

  const handleExportManifest = async () => {
    if (stagedPaths.length === 0) return;
    try {
      store.pushToast("info", "Generating Manifest", `Hashing ${stagedPaths.length} staged file(s)...`);
      const lines: string[] = [
        `# Nexus Explorer SHA-256 Manifest`,
        `# Generated: ${new Date().toISOString()}`,
        `# Entries: ${stagedPaths.length}`,
        "",
      ];
      for (const p of stagedPaths) {
        try {
          const res = await ipc.hashFile(p, "sha256");
          const name = basename(p);
          lines.push(`${res.digest} *${name}`);
        } catch {
          lines.push(`# Failed to hash: ${p}`);
        }
      }
      const content = lines.join("\r\n") + "\r\n";
      const manifestName = `manifest_${Date.now()}.sha256`;
      if (dest) {
        const manifestPath = joinPath(dest, manifestName);
        try {
          await ipc.writeTextFile(manifestPath, content);
        } catch {
          // If write is unsupported, clipboard fallback still provides data
        }
      }
      await store.copyText(content, "SHA-256 Manifest");
      store.pushToast("success", "Manifest Exported", `Generated SHA-256 manifest and copied to clipboard`);
      if (dest) {
        const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
        if (activeTab) void store.refreshTab(activeTab.id);
      }
    } catch (err) {
      store.pushToast("error", "Manifest Failed", toErrorMessage(err));
    }
  };

  return (
    <div
      className={`staging-widget ${embedded ? "staging-widget-embedded" : ""}`}
      data-drop-target="staging"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
        const sel = activeTab?.selected ?? [];
        if (sel.length > 0) {
          store.addStaged(sel);
          store.pushToast("success", "Staged", `Added ${sel.length} item(s) to Staging Shelf`);
        }
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-2)",
        border: embedded ? "1px solid var(--border)" : "none",
        borderRadius: embedded ? "var(--radius-lg)" : "0",
        overflow: "hidden",
      }}
    >
      {/* Header with Mode Toggle & Slots */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Mode Toggle Button */}
          <button
            onClick={() => store.toggleStagingMode()}
            title={`Active mode: ${mode.toUpperCase()} (Click to toggle COPY/MOVE)`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              fontSize: 10,
              fontWeight: 800,
              cursor: "pointer",
              border: mode === "copy" ? "1px solid #3b82f6" : "1px solid #f59e0b",
              background: mode === "copy" ? "rgba(59, 130, 246, 0.15)" : "rgba(245, 158, 11, 0.15)",
              color: mode === "copy" ? "#60a5fa" : "#fbbf24",
            }}
          >
            {mode === "copy" ? <Copy size={10} /> : <FolderInput size={10} />}
            <span>{mode.toUpperCase()}</span>
          </button>

          {/* Slots Selector (1, 2, 3) */}
          <div style={{ display: "flex", gap: 3, background: "var(--surface-2)", padding: "2px 4px", borderRadius: 4 }}>
            {[1, 2, 3].map((slot) => {
              const count = (store.stagingSlots[slot] ?? []).length;
              return (
                <button
                  key={slot}
                  onClick={() => store.setActiveStagingSlot(slot)}
                  title={`Slot ${slot} (${count} items)`}
                  style={{
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 3,
                    background: activeSlot === slot ? "var(--accent)" : "transparent",
                    color: activeSlot === slot ? "#fff" : "var(--text-faint)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span>Slot {slot}</span>
                  {count > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        background: activeSlot === slot ? "rgba(255,255,255,0.25)" : "var(--border)",
                        padding: "0 4px",
                        borderRadius: 8,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shelf Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            onClick={() => store.stageSelection()}
            title="Stage Selected (Add current selection to shelf)"
          >
            <Plus size={12} />
          </button>
          <button
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            onClick={() => setHistoryOpen(!historyOpen)}
            title="Clipboard History Tray"
          >
            <Clock size={12} style={{ color: historyOpen ? "var(--accent)" : undefined }} />
          </button>
          <button
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            disabled={stagedPaths.length === 0}
            onClick={() => store.clearStaged()}
            title="Clear Staging Shelf"
          >
            <Trash2 size={12} />
          </button>
          {!embedded && (
            <button
              className="icon-btn"
              style={{ width: 22, height: 22 }}
              onClick={() => store.setStagingOpen(false)}
              title="Close Shelf"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* History Tray Drawer */}
      {historyOpen && (
        <div
          style={{
            maxHeight: 120,
            overflowY: "auto",
            padding: 6,
            background: "var(--surface-3)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", marginBottom: 4, textTransform: "uppercase" }}>
            Recent Clipboard Clips
          </div>
          {store.clipboardHistory.length === 0 ? (
            <div style={{ color: "var(--text-faint)", fontStyle: "italic", padding: "4px 0" }}>No recent clips yet.</div>
          ) : (
            store.clipboardHistory.slice(0, 5).map((clip) => (
              <div
                key={clip.id}
                onClick={() => {
                  store.addStaged(clip.paths);
                  store.pushToast("info", "Added from history", `${clip.paths.length} item(s) staged`);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "3px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: "var(--surface)",
                  marginBottom: 3,
                }}
                title={clip.paths.join("\n")}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {clip.paths.length === 1 ? basename(clip.paths[0]) : `${clip.paths.length} items`}
                </span>
                <span style={{ fontSize: 9, color: "var(--text-faint)" }}>
                  {new Date(clip.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Staged Items List */}
      <div
        className="shelf-list"
        style={{
          maxHeight: embedded ? 140 : 260,
          minHeight: 50,
          overflowY: "auto",
          padding: "4px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {stagedPaths.length === 0 ? (
          <div style={{ padding: "12px 8px", fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}>
            Staging shelf is empty.
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.85 }}>
              Drag & drop files here, or press <kbd style={{ padding: "1px 4px", background: "var(--surface-3)", borderRadius: 3 }}>Ctrl+C</kbd> / <kbd style={{ padding: "1px 4px", background: "var(--surface-3)", borderRadius: 3 }}>Ctrl+X</kbd>
            </div>
          </div>
        ) : (
          stagedPaths.map((path) => {
            const isDir = !path.includes(".");
            const { Icon, tone } = iconForEntry({ name: basename(path), ext: isDir ? "" : path.split(".").pop() || "", isDir } as any);
            return (
              <div
                key={path}
                className="shelf-item"
                title={`${path} (Drag to move/copy onto any tab or folder)`}
                onPointerDown={(e) => handleDragStart(path, e)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                  background: "var(--surface)",
                  cursor: "grab",
                  userSelect: "none",
                }}
              >
                <span className={`file-icon tone-${tone}`} style={{ display: "inline-flex", flexShrink: 0 }}>
                  <Icon size={14} strokeWidth={1.8} />
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
                  {basename(path)}
                </span>
                <span style={{ flex: "none", fontSize: 10, color: "var(--text-faint)", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {dirname(path).split(/[\/\\]/).pop()}
                </span>
                <button
                  className="icon-btn"
                  style={{ width: 18, height: 18, padding: 0 }}
                  title="Remove from staging"
                  onClick={(e) => {
                    e.stopPropagation();
                    store.removeStaged(path);
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pattern Rename Inline Prompt */}
      {patternInputOpen && (
        <div style={{ padding: 8, background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", marginBottom: 4 }}>
            Paste & Rename Pattern (Tokens: {"{name}"}, {"{date}"}):
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="text"
              value={patternStr}
              onChange={(e) => setPatternStr(e.target.value)}
              style={{
                flex: 1,
                fontSize: 11,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "2px 6px",
                color: "var(--text)",
              }}
            />
            <button className="btn btn-sm" onClick={handleExecutePatternPaste} style={{ padding: "2px 8px", fontSize: 11 }}>
              Apply
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setPatternInputOpen(false)} style={{ padding: "2px 6px", fontSize: 11 }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Multi-Target Broadcast Picker Drawer */}
      {broadcastOpen && (
        <div style={{ padding: 8, background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", marginBottom: 4 }}>
            Broadcast Paste to Multiple Destinations:
          </div>
          {broadcastDestinations.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "4px 0" }}>No other open tabs or bookmarks.</div>
          ) : (
            <div style={{ maxHeight: 90, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
              {broadcastDestinations.map((d) => {
                const checked = selectedBroadcastDirs.includes(d);
                return (
                  <label key={d} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedBroadcastDirs(
                          checked ? selectedBroadcastDirs.filter((p) => p !== d) : [...selectedBroadcastDirs, d]
                        );
                      }}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d}>
                      {d}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button
              className="btn btn-sm"
              disabled={selectedBroadcastDirs.length === 0}
              onClick={handleExecuteBroadcast}
              style={{ padding: "2px 8px", fontSize: 11 }}
            >
              Broadcast ({selectedBroadcastDirs.length})
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setBroadcastOpen(false)} style={{ padding: "2px 6px", fontSize: 11 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Footer: Dynamic Paste + Paste As + Broadcast */}
      <div
        style={{
          padding: "6px 8px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {/* Primary Action Button (⚡ Paste Here / ⚡ Move Here) */}
          <button
            className="btn btn-sm"
            disabled={stagedPaths.length === 0}
            onClick={() => {
              if (mode === "copy") void store.copyStagedTo(dest);
              else void store.moveStagedTo(dest);
            }}
            style={{
              flex: 1,
              background:
                stagedPaths.length === 0
                  ? undefined
                  : mode === "copy"
                    ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                    : "linear-gradient(135deg, #d97706, #b45309)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
            title={stagedPaths.length > 0 ? `${mode === "copy" ? "Copy" : "Move"} staged items to ${dest}` : "Shelf is empty"}
          >
            {mode === "copy" ? <Copy size={12} /> : <FolderInput size={12} />}
            <span>⚡ {mode === "copy" ? "Paste Here" : "Move Here"}</span>
            {stagedPaths.length > 0 && <span style={{ opacity: 0.85 }}>({stagedPaths.length})</span>}
          </button>

          {/* Paste As Dropdown Toggle */}
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-sm"
              disabled={stagedPaths.length === 0}
              onClick={() => setPasteAsOpen(!pasteAsOpen)}
              title="Advanced Paste As options (Symlink, Hardlink, ZIP, etc.)"
              style={{ padding: "0 6px", fontSize: 11, display: "flex", alignItems: "center", gap: 2 }}
            >
              <span>As…</span>
              <ChevronDown size={11} />
            </button>

            {pasteAsOpen && (
              <div
                className="context-menu"
                style={{ bottom: "100%", right: 0, marginBottom: 4, minWidth: 200, zIndex: 100 }}
                onMouseLeave={() => setPasteAsOpen(false)}
              >
                <div className="menu-item" onClick={() => void handlePasteAs("symlink")}>
                  <Link2 size={13} style={{ color: "#38bdf8" }} />
                  <span>Paste as Symlink</span>
                </div>
                <div className="menu-item" onClick={() => void handlePasteAs("hardlink")}>
                  <Link2 size={13} style={{ color: "#818cf8" }} />
                  <span>Paste as Hardlink</span>
                </div>
                <div className="menu-item" onClick={() => void handlePasteAs("shortcut")}>
                  <Link2 size={13} style={{ color: "#34d399" }} />
                  <span>Paste as Windows Shortcut (.lnk)</span>
                </div>
                <div className="menu-sep" />
                <div className="menu-item" onClick={() => void handlePasteAs("zip")}>
                  <Archive size={13} style={{ color: "#fbbf24" }} />
                  <span>Paste as Compressed ZIP</span>
                </div>
                <div className="menu-item" onClick={() => void handlePasteAs("extract")}>
                  <FolderArchive size={13} style={{ color: "#f472b6" }} />
                  <span>Paste Extracted (Unpack)</span>
                </div>
                <div className="menu-sep" />
                <div className="menu-item" onClick={() => void handlePasteAs("pattern")}>
                  <Sparkles size={13} style={{ color: "#a78bfa" }} />
                  <span>Paste & Rename with Pattern…</span>
                </div>
                <div className="menu-sep" />
                <div className="menu-item" onClick={() => void handleExportManifest()}>
                  <FileCheck size={13} style={{ color: "#10b981" }} />
                  <span>Export SHA-256 Manifest (.sha256)</span>
                </div>
              </div>
            )}
          </div>

          {/* Broadcast Paste Button */}
          <button
            className="icon-btn"
            disabled={stagedPaths.length === 0}
            onClick={() => setBroadcastOpen(!broadcastOpen)}
            title="Multi-Target Broadcast Paste (Replicate files across multiple folders)"
            style={{ width: 28, height: 28, flexShrink: 0 }}
          >
            <Radio size={13} style={{ color: broadcastOpen ? "var(--accent)" : undefined }} />
          </button>
        </div>

        {/* Quick Batch Actions: Copy All, Move All, Manifest, Clear */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, paddingTop: 2 }}>
          <div style={{ display: "flex", gap: 3 }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={stagedPaths.length === 0}
              onClick={() => void store.copyStagedTo(dest)}
              title={`Copy all staged items to ${dest}`}
              style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}
            >
              <Copy size={11} />
              <span>Copy All</span>
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={stagedPaths.length === 0}
              onClick={() => void store.moveStagedTo(dest)}
              title={`Move all staged items to ${dest}`}
              style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}
            >
              <FolderInput size={11} />
              <span>Move All</span>
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={stagedPaths.length === 0}
              onClick={() => void handleExportManifest()}
              title="Compute SHA-256 hashes and save manifest (.sha256)"
              style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}
            >
              <FileCheck size={11} style={{ color: "#10b981" }} />
              <span>Manifest</span>
            </button>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            disabled={stagedPaths.length === 0}
            onClick={() => store.clearStaged()}
            title="Clear Staging Shelf"
            style={{ fontSize: 10, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3, color: "var(--danger)" }}
          >
            <Trash2 size={11} />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}
