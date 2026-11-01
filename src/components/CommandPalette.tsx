import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc } from "@/lib/ipc";
import { Search } from "lucide-react";

interface Item { group: string; label: string; hint?: string; action: () => void; }

export default function CommandPalette() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const push = (group: string, label: string, action: () => void, hint?: string) => out.push({ group, label, action, hint });
    // Commands
    push("Commands", "New tab", () => { const home = store.knownFolders.find((f) => f.id === "home")?.path ?? "C:\\"; void store.openTab(home, true); });
    push("Commands", "New folder", () => void store.createFolder());
    push("Commands", "New file", () => void store.createFile());
    push("Commands", "Refresh", () => void store.refreshActive());
    push("Commands", "Search files", () => store.openSearch());
    push("Commands", "Toggle hidden files", () => void store.updateSettings({ showHidden: !store.settings.showHidden }));
    push("Commands", "Toggle sidebar", () => store.toggleSidebar());
    push("Commands", "Toggle preview", () => store.togglePreview());
    push("Commands", "List view", () => store.setView("list"), "Ctrl+1");
    push("Commands", "Grid view", () => store.setView("grid"), "Ctrl+2");
    push("Commands", "Miller Columns view (Horizontal Traversal)", () => store.setView("columns"), "Ctrl+3");
    push("Commands", "Sort by name", () => store.setSort("name"));
    push("Commands", "Sort by date modified", () => store.setSort("modified"));
    push("Commands", "Sort by size", () => store.setSort("size"));
    push("Commands", "Select all", () => store.selectAll(), "Ctrl+A");
    push("Commands", "Undo", () => void store.undo(), "Ctrl+Z");
    push("Commands", "Redo", () => void store.redo(), "Ctrl+Y");
    push("Commands", "Go up", () => void store.goUp(), "Alt+Up");
    push("Commands", "Go back", () => void store.goBack(), "Alt+Left");
    push("Commands", "Go forward", () => void store.goForward(), "Alt+Right");
    push("Commands", "Close tab", () => { if (store.activeTabId) void store.closeTab(store.activeTabId); }, "Ctrl+W");
    push("Commands", "Batch rename selected...", () => store.setBatchRenameOpen(true), "Ctrl+Shift+R");
    push("Commands", "AI File Copilot (Natural Language Assistant)", () => store.openCopilot(), "Ctrl+K");
    push("Commands", "VDFS & Content-Addressed Storage Dashboard", () => store.setVdfsOpen(true));
    push("Commands", "Mobile QR AirDrop / Direct WebDrop Portal", () => store.setWebdropOpen(true));
    push("Commands", "Developer Cache & Build Artifact Janitor", () => store.setJanitorOpen(true));
    push("Commands", "Sensitive Data Loss Prevention (DLP) & Secret Scanner", () => store.setDlpOpen(true));
    push("Commands", "Universal Virtual Drive Mounter", () => store.setMounterOpen(true));
    push("Commands", "Multi-Slot Circular Drop Rings & Clipboard History", () => store.setClipboardHistoryOpen(true));
    push("Commands", "Visual Time Machine Snapshot Scrubbing", () => store.setTimeMachineOpen(true));
    push("Commands", "Toggle Synchronized Dual-Scroll Lock", () => store.toggleDualScrollLocked());
    push("Commands", "Workspace Context Profiles (Developer, Media, Forensics, Zen)", () => store.setWorkspaceProfilesOpen(true));
    push("Commands", "In-Place Hex Editor & Binary Inspector", () => {
      const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
      const selected = activeTab?.selected[0] ?? activeTab?.entries.find((e) => !e.isDir)?.path;
      if (selected) store.setHexEditorPath(selected);
      else store.pushToast("info", "Hex Editor", "Select a file to inspect its raw bytes.");
    });
    push("Commands", "Inspect Properties (Forensic Timestamps, Hashes, ADS, Locks)", () => {
      const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
      const selected = activeTab?.selected[0] ?? activeTab?.path;
      if (selected) store.setPropertiesPath(selected);
    }, "Alt+Enter");
    push("Commands", "Dev Drive & Storage Acceleration Manager", () => store.setDevDriveOpen(true));
    push("Commands", "Cryptographic Provenance Audit Ledger", () => store.setProvenanceOpen(true));
    push("Commands", "Remote SFTP / SSH Filesystem Explorer", () => store.setSftpOpen(true));
    push("Commands", "Visual Disk Space Treemap Analyzer", () => store.setTreemapOpen(true));
    push("Commands", "Power Tools (Duplicates, Content Search, Hashes, Shredder)", () => store.setPowerTools(true), "Ctrl+Alt+P");
    push("Commands", "P2P Local Mesh Sharing", () => {
      const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
      store.openMeshShare(activeTab?.selected.length ? activeTab.selected : (activeTab ? [activeTab.path] : []));
    });
    push("Commands", "Audit folder for spoofed files", async () => {
      const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
      if (!activeTab) return;
      try {
        const results = await ipc.toolsAuditDirectory(activeTab.path);
        const spoofed = results.filter((r) => r.isSpoofed);
        if (spoofed.length === 0) {
          store.pushToast("success", "Audit Clean", `All ${results.length} files match signatures.`);
        } else {
          store.pushToast("warning", `Security Alert: ${spoofed.length} Spoofed Files!`, spoofed.map((s) => s.fileName).slice(0, 3).join(", "));
        }
      } catch (err) {
        store.pushToast("error", "Audit failed", String(err));
      }
    });
    push("Commands", "Settings", () => store.setSettingsOpen(true));
    push("Commands", "Keyboard shortcuts", () => store.setShortcutsOpen(true));
    push("Commands", "Command palette", () => store.togglePalette());
    // Places
    store.knownFolders.forEach((f) => push("Places", f.label, () => void store.navigateTo(f.path), f.path));
    store.drives.forEach((d) => push("Places", d.label || d.path, () => void store.navigateTo(d.path), d.path));
    store.bookmarks.forEach((b) => push("Favorites", b.name, () => void store.navigateTo(b.path), b.path));
    store.recent.slice(0, 8).forEach((r) => push("Recent", r.name, () => void store.navigateTo(r.path), r.path));
    // Current folder entries
    const tab = store.tabs.find((t) => t.id === store.activeTabId);
    (tab?.entries ?? []).slice(0, 40).forEach((e) => push("Current folder", e.name, () => e.isDir ? void store.navigateTo(e.path) : void store.openEntry(e), e.path));
    return out;
  }, [store, store.tabs, store.activeTabId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items.slice(0, 60);
    return items.filter((i) => i.label.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q)).slice(0, 80);
  }, [items, query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { store.setPalette(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === "Enter") { e.preventDefault(); filtered[active]?.action(); store.setPalette(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, active, store]);

  // scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div className="palette-overlay" onClick={() => store.setPalette(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Search size={16} color="var(--text-faint)" />
          <input ref={inputRef} className="palette-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a command or search…" />
        </div>
        <div className="palette-list" ref={listRef}>
          {filtered.map((item, i) => {
            const showGroup = i === 0 || filtered[i - 1].group !== item.group;
            return (
              <div key={i}>
                {showGroup && <div className="palette-group">{item.group}</div>}
                <div className={`palette-item ${i === active ? "active" : ""}`} data-idx={i} onMouseEnter={() => setActive(i)} onClick={() => { item.action(); store.setPalette(false); }}>
                  <span className="palette-label">{item.label}</span>
                  {item.hint && <span className="palette-key">{item.hint}</span>}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 16, color: "var(--text-faint)", fontSize: 13 }}>No matches.</div>}
        </div>
      </div>
    </div>
  );
}