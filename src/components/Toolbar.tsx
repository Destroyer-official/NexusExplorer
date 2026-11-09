import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCw, Search, LayoutGrid, List, Sidebar as SidebarIcon, PanelRight, Package, Command, Star, GitBranch, PieChart, Sparkles, Share2, Columns, Sliders, Cpu, ShieldCheck, Globe, Wrench, Layers, FolderSearch, ListTree, SquareTerminal, QrCode, Database, ShieldAlert, Disc, Clipboard, Clock, Link2, Unlink2, FolderSync, GitCompare, ChevronDown, FolderPlus, Settings, Keyboard, Eye, Usb } from "lucide-react";
import { useAppStore } from "@/state/store";
import Breadcrumbs from "@/components/Breadcrumbs";
import { ipc } from "@/lib/ipc";
import type { GitRepoStatus, SortKey } from "@/types";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "modified", label: "Date modified" },
  { key: "created", label: "Date created" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

export default function Toolbar() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [openMenu, setOpenMenu] = useState<"sort" | "tools" | "panes" | null>(null);
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sortOpen = openMenu === "sort";
  const toolsMenuOpen = openMenu === "tools";
  const paneMenuOpen = openMenu === "panes";

  useEffect(() => {
    if (!openMenu) return;
    const trigger = toolbarRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]');
    toolbarRef.current?.querySelector<HTMLButtonElement>(".toolbar-menu button")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolbarRef.current?.contains(event.target)) setOpenMenu(null);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpenMenu(null);
      trigger?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!activeTab?.path) {
      setGitStatus(null);
      return;
    }
    let cancelled = false;
    ipc.toolsGitStatus(activeTab.path)
      .then((res) => {
        if (!cancelled) setGitStatus(res.isRepo ? res : null);
      })
      .catch(() => {
        if (!cancelled) setGitStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab?.path]);

  const canBack = (activeTab?.historyIndex ?? 0) > 0;
  const canFwd = (activeTab?.historyIndex ?? 0) < (activeTab?.history.length ?? 1) - 1;

  return (
    <div className="toolbar" ref={toolbarRef} aria-label="File navigation and actions">
      <div className="toolbar-navigation">
      <div className="nav-group">
        <button className="icon-btn" disabled={!canBack} onClick={() => void store.goBack()} title="Back (Alt+Left)"><ArrowLeft size={16} /></button>
        <button className="icon-btn" disabled={!canFwd} onClick={() => void store.goForward()} title="Forward (Alt+Right)"><ArrowRight size={16} /></button>
        <button className="icon-btn" onClick={() => void store.goUp()} title="Up (Alt+Up)"><ArrowUp size={16} /></button>
        <button className="icon-btn" onClick={() => void store.refreshActive()} title="Refresh (F5)"><RefreshCw size={15} /></button>
      </div>

      <div className="address-bar">
        <Breadcrumbs />
        <div className="address-actions">
          {gitStatus?.currentBranch && (
            <div
              className="badge"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent-subtle)",
                color: "var(--accent)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
              title={
                gitStatus.headCommit
                  ? `Branch: ${gitStatus.currentBranch}\nCommit: ${gitStatus.headCommit.shortHash} by ${gitStatus.headCommit.authorName}\n"${gitStatus.headCommit.message.split("\n")[0]}"`
                  : `Branch: ${gitStatus.currentBranch}`
              }
            >
              <GitBranch size={11} />
              <span>{gitStatus.currentBranch}</span>
            </div>
          )}
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => {
            const tab = store.tabs.find((t) => t.id === store.activeTabId);
            if (tab) void store.copyText(tab.path, "Path copied");
          }} title="Copy path"><svg width="13" height="13" viewBox="0 0 13 13"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M9 4V2.5A1.5 1.5 0 0 0 7.5 1H2.5A1.5 1.5 0 0 0 1 2.5v5A1.5 1.5 0 0 0 2.5 9H4" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg></button>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => void store.toggleBookmarkCurrent()} title="Favorite this folder"><Star size={13} /></button>
        </div>
      </div>

      <button className="icon-btn" onClick={() => store.openSearch()} title="Search (Ctrl+F)"><Search size={16} /></button>

      </div>
      <div className="toolbar-commands">
      <button className="btn btn-sm" onClick={() => void store.createFolder()} title="New folder (Ctrl+Shift+N)"><FolderPlus size={15} />New folder</button>
      <span className="toolbar-divider" aria-hidden="true" />
      {activeTab?.quickFilter && <button className="btn btn-sm" onClick={() => store.setQuickFilter("")} title="Clear folder filter">Clear filter</button>}
      <select
        value={activeTab?.groupBy ?? "none"}
        onChange={(e) => { const value = e.target.value; if (value === "none" || value === "date" || value === "type" || value === "size") store.setGroupBy(value); }}
        style={{ height: 30, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 }}
        aria-label="Group files by" title="Group by"
      >
        <option value="none">No grouping</option>
        <option value="date">Date modified</option>
        <option value="type">Type</option>
        <option value="size">Size</option>
      </select>
      <div className="seg">
        <button className={`seg-btn ${activeTab?.view === "list" ? "active" : ""}`} aria-pressed={activeTab?.view === "list"} onClick={() => store.setView("list")} title="List (Ctrl+1)"><List size={14} /></button>
        <button className={`seg-btn ${activeTab?.view === "grid" ? "active" : ""}`} aria-pressed={activeTab?.view === "grid"} onClick={() => store.setView("grid")} title="Grid (Ctrl+2)"><LayoutGrid size={14} /></button>
        <button className={`seg-btn ${activeTab?.view === "columns" ? "active" : ""}`} aria-pressed={activeTab?.view === "columns"} onClick={() => store.setView("columns")} title="Miller Columns (Ctrl+3)"><Columns size={14} /></button>
      </div>

      <div style={{ position: "relative" }}>
        <button className="icon-btn" onClick={() => setOpenMenu(sortOpen ? null : "sort")} aria-expanded={sortOpen} title="Sort">
          <svg width="15" height="15" viewBox="0 0 15 15"><path d="M3 4h9M3 7.5h6M3 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>
        {sortOpen && (
          <div className="context-menu toolbar-menu" style={{ top: "calc(100% + 6px)", left: 0 }} >
            {SORTS.map((s) => (
              <button type="button" key={s.key} className="menu-item" onClick={() => { store.setSort(s.key); setOpenMenu(null); }}>
                <span>{s.label}</span>
                {activeTab?.sortKey === s.key && <span className="menu-shortcut">{activeTab.sortDesc ? "↓" : "↑"}</span>}
              </button>
            ))}
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => { if (activeTab) store.setSort(activeTab.sortKey, !activeTab.sortDesc); setOpenMenu(null); }}>
              <span>Reverse order</span>
            </button>
          </div>
        )}
      </div>

      <button className="icon-btn" onClick={store.toggleSidebar} title="Sidebar (Ctrl+B)"><SidebarIcon size={16} /></button>
      <button className="icon-btn" onClick={store.togglePreview} title="Preview (Ctrl+P)"><PanelRight size={16} /></button>
      <button className="icon-btn" onClick={() => store.setQuickLookOpen(true)} title="Quick Look (Space)"><Eye size={16} /></button>

      {/* Primary Quick Actions */}
      <button className="icon-btn" onClick={store.toggleTransfers} title="Transfers">
        <Package size={16} />
        {Object.keys(store.transfers).length > 0 && (
          <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
        )}
      </button>

      {/* Consolidated Tools & Extensions Menu */}
      <div style={{ position: "relative" }}>
        <button
          className={`icon-btn ${toolsMenuOpen ? "active" : ""}`}
          onClick={() => setOpenMenu(toolsMenuOpen ? null : "tools")}
          aria-expanded={toolsMenuOpen} title="Advanced Tools & Utilities"
          style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 8px", width: "auto" }}
        >
          <Wrench size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>Tools</span>
          <ChevronDown size={11} />
        </button>
        {toolsMenuOpen && (
          <div
            className="context-menu toolbar-menu"
            style={{
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 260,
              maxHeight: 460,
              overflowY: "auto",
              boxShadow: "var(--shadow-xl)",
            }}
            
          >
            <div className="side-heading" style={{ padding: "4px 8px" }}>Workspace</div>
            <button type="button" className="menu-item" onClick={() => { store.openCopilot(); setOpenMenu(null); }}><Sparkles size={14} /><span>Nexus AI Agent</span><span className="menu-shortcut">Ctrl+K</span></button>
            <button type="button" className="menu-item" onClick={() => { store.toggleTerminal(); setOpenMenu(null); }}><SquareTerminal size={14} /><span>{store.terminalOpen ? "Hide terminal" : "Open terminal"}</span></button>
            <button type="button" className="menu-item" onClick={() => { store.setShortcutsOpen(true); setOpenMenu(null); }}><Keyboard size={14} /><span>Keyboard shortcuts</span><span className="menu-shortcut">Ctrl+/</span></button>
            <div className="menu-sep" />
            <div className="side-heading" style={{ padding: "4px 8px" }}>Storage & Hardware</div>
            <button type="button" className="menu-item" onClick={() => { void store.openUsbModal(); setOpenMenu(null); }}>
              <Usb size={14} style={{ color: "#3b82f6" }} />
              <span>USB Storage & Lock Hunter</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setTreemapOpen(true); setOpenMenu(null); }}>
              <PieChart size={14} style={{ color: "#38bdf8" }} />
              <span>Disk Space Treemap</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setDevDriveOpen(true); setOpenMenu(null); }}>
              <Cpu size={14} style={{ color: "#6366f1" }} />
              <span>Dev Drive & BitLocker</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setMounterOpen(true); setOpenMenu(null); }}>
              <Disc size={14} style={{ color: "#8b5cf6" }} />
              <span>Virtual Drive Mounter (VHD/ISO)</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setJanitorOpen(true); setOpenMenu(null); }}>
              <Sparkles size={14} style={{ color: "#f59e0b" }} />
              <span>Clean build caches</span>
            </button>

            <div className="menu-sep" />
            <div className="side-heading" style={{ padding: "4px 8px" }}>Cloud & Sharing</div>
            <button type="button" className="menu-item" onClick={() => { store.setSftpOpen(true); setOpenMenu(null); }}>
              <Globe size={14} style={{ color: "#06b6d4" }} />
              <span>Remote SFTP / SSH Explorer</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setWebdropOpen(true); setOpenMenu(null); }}>
              <QrCode size={14} style={{ color: "#10b981" }} />
              <span>Share with QR code</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.openMeshShare(activeTab?.selected.length ? activeTab.selected : (activeTab ? [activeTab.path] : [])); setOpenMenu(null); }}>
              <Share2 size={14} style={{ color: "#a855f7" }} />
              <span>Local P2P Mesh Sharing</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setVdfsOpen(true); setOpenMenu(null); }}>
              <Database size={14} style={{ color: "#38bdf8" }} />
              <span>Content-addressed storage</span>
            </button>

            <div className="menu-sep" />
            <div className="side-heading" style={{ padding: "4px 8px" }}>Security & History</div>
            <button type="button" className="menu-item" onClick={() => { store.setProvenanceOpen(true); setOpenMenu(null); }}>
              <ShieldCheck size={14} style={{ color: "#10b981" }} />
              <span>File audit history</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setDlpOpen(true); setOpenMenu(null); }}>
              <ShieldAlert size={14} style={{ color: "#ef4444" }} />
              <span>DLP & Secret Scanner</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setTimeMachineOpen(true); setOpenMenu(null); }}>
              <Clock size={14} style={{ color: "#06b6d4" }} />
              <span>File snapshots</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setClipboardHistoryOpen(true); setOpenMenu(null); }}>
              <Clipboard size={14} style={{ color: "#ec4899" }} />
              <span>Clipboard history</span>
            </button>

            <div className="menu-sep" />
            <div className="side-heading" style={{ padding: "4px 8px" }}>Power Tools & Workspaces</div>
            <button type="button" className="menu-item" onClick={() => { store.setPowerTools(true); setOpenMenu(null); }}>
              <Wrench size={14} style={{ color: "#f59e0b" }} />
              <span>All power tools</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setWorkspaceProfilesOpen(true); setOpenMenu(null); }}>
              <Sliders size={14} style={{ color: "#a855f7" }} />
              <span>Workspace profiles</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { store.setSmartFolderOpen(true); setOpenMenu(null); }}>
              <FolderSearch size={14} />
              <span>Manage smart folders</span>
            </button>
            <button type="button" className="menu-item" onClick={() => { void store.toggleFlatView(); setOpenMenu(null); }}>
              <ListTree size={14} />
              <span>{store.flatView ? "Disable Flat Branch View" : "Enable Flat Branch View"}</span>
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                const isOpen = store.previewOpen && store.previewTab === "shelf";
                if (isOpen) {
                  store.setPreviewOpen(false);
                } else {
                  store.setPreviewOpen(true);
                  store.setPreviewTab("shelf");
                }
                setOpenMenu(null);
              }}
            >
              <Layers size={14} />
              <span>Staging shelf</span>
            </button>
          </div>
        )}
      </div>

      <button className="icon-btn" onClick={() => store.togglePalette()} title="Command palette (Ctrl+Shift+P)"><Command size={16} /></button>

      {/* Pane Layout Switcher */}
      <div style={{ position: "relative" }}>
        <button
          className={`icon-btn ${store.dualPane ? "active" : ""}`}
          onClick={() => setOpenMenu(paneMenuOpen ? null : "panes")}
          aria-expanded={paneMenuOpen} title={`Pane layout (${store.paneLayout})`}
        >
          <Columns size={16} />
        </button>
        {paneMenuOpen && (
          <div className="context-menu toolbar-menu" style={{ top: "calc(100% + 6px)", left: 0, minWidth: 220 }} >
            <button type="button" className={`menu-item ${store.paneLayout === "single" ? "active" : ""}`} onClick={() => { store.setPaneLayout("single"); setOpenMenu(null); }}>
              <span>Single Pane (1×1)</span>
            </button>
            <button type="button" className={`menu-item ${store.paneLayout === "dual-h" ? "active" : ""}`} onClick={() => { store.setPaneLayout("dual-h"); setOpenMenu(null); }}>
              <span>Dual Horizontal (Split Left/Right)</span>
            </button>
            <button type="button" className={`menu-item ${store.paneLayout === "dual-v" ? "active" : ""}`} onClick={() => { store.setPaneLayout("dual-v"); setOpenMenu(null); }}>
              <span>Dual Vertical (Split Top/Bottom)</span>
            </button>
            <button type="button" className={`menu-item ${store.paneLayout === "triple" ? "active" : ""}`} onClick={() => { store.setPaneLayout("triple"); setOpenMenu(null); }}>
              <span>Triple Pane (1 Main + 2 Stacked)</span>
            </button>
            <button type="button" className={`menu-item ${store.paneLayout === "quad" ? "active" : ""}`} onClick={() => { store.setPaneLayout("quad"); setOpenMenu(null); }}>
              <span>Quad Grid (2 × 2)</span>
            </button>
          </div>
        )}
      </div>
      {store.dualPane && (
        <>
          <button
            className={`icon-btn ${store.syncNav ? "active" : ""}`}
            onClick={store.toggleSyncNav}
            title={store.syncNav ? "Disable Synchronized Navigation" : "Enable Synchronized Navigation (Follow folder changes in both panes)"}
          >
            <FolderSync size={16} style={store.syncNav ? { color: "var(--accent)" } : undefined} />
          </button>
          <button
            className={`icon-btn ${store.dualScrollLocked ? "active" : ""}`}
            onClick={store.toggleDualScrollLocked}
            title={store.dualScrollLocked ? "Unlock Dual-Scroll Synchronization" : "Lock Dual-Scroll in Synchronization"}
          >
            {store.dualScrollLocked ? <Link2 size={16} style={{ color: "var(--accent)" }} /> : <Unlink2 size={16} />}
          </button>
          <button
            className="icon-btn"
            onClick={() => void store.comparePanes()}
            title="Compare Panes (Ctrl+Shift+E — Select differing & unique files)"
            aria-label="Compare Panes"
          >
            <GitCompare size={16} />
          </button>
        </>
      )}

      <button
        className="icon-btn copilot-trigger-btn"
        onClick={() => store.openCopilot()}
        title="Nexus AI Agent (Ctrl+K)"
        style={{ color: "var(--accent)" }}
      >
        <Sparkles size={16} />
      </button>
      <button className="icon-btn" onClick={() => store.setSettingsOpen(true)} title="Settings (Ctrl+,)"><Settings size={16} /></button>
      </div>
    </div>
  );
}