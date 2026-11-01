import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCw, Search, LayoutGrid, List, Sidebar as SidebarIcon, PanelRight, Package, Command, Star, GitBranch, PieChart, Sparkles, Share2, Columns, Sliders, Cpu, ShieldCheck, Globe, Wrench, Layers, FolderSearch, ListTree, SquareTerminal, QrCode, Database, ShieldAlert, Disc, Clipboard, Clock, Link2, Unlink2, ChevronDown } from "lucide-react";
import { useAppStore } from "@/state/store";
import Breadcrumbs from "@/components/Breadcrumbs";
import { ipc } from "@/lib/ipc";
import type { GitRepoStatus } from "@/types";

const SORTS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "modified", label: "Date modified" },
  { key: "created", label: "Date created" },
  { key: "size", label: "Size" },
  { key: "type", label: "Type" },
];

export default function Toolbar() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [sortOpen, setSortOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | null>(null);
  const [paneMenuOpen, setPaneMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

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
    <div className="toolbar">
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

      <select
        value={activeTab?.groupBy ?? "none"}
        onChange={(e) => store.setGroupBy(e.target.value as any)}
        style={{ height: 30, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 }}
        title="Group by"
      >
        <option value="none">No grouping</option>
        <option value="date">Date modified</option>
        <option value="type">Type</option>
        <option value="size">Size</option>
      </select>
      <div className="seg">
        <button className={`seg-btn ${activeTab?.view === "list" ? "active" : ""}`} onClick={() => store.setView("list")} title="List (Ctrl+1)"><List size={14} /></button>
        <button className={`seg-btn ${activeTab?.view === "grid" ? "active" : ""}`} onClick={() => store.setView("grid")} title="Grid (Ctrl+2)"><LayoutGrid size={14} /></button>
        <button className={`seg-btn ${activeTab?.view === "columns" ? "active" : ""}`} onClick={() => store.setView("columns")} title="Miller Columns (Ctrl+3)"><Columns size={14} /></button>
      </div>

      <div style={{ position: "relative" }}>
        <button className="icon-btn" onClick={() => setSortOpen((v) => !v)} title="Sort">
          <svg width="15" height="15" viewBox="0 0 15 15"><path d="M3 4h9M3 7.5h6M3 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>
        {sortOpen && (
          <div className="context-menu" style={{ top: 44, right: 0 }} onMouseLeave={() => setSortOpen(false)}>
            {SORTS.map((s) => (
              <div key={s.key} className="menu-item" onClick={() => { store.setSort(s.key as any); setSortOpen(false); }}>
                <span>{s.label}</span>
                {activeTab?.sortKey === s.key && <span className="menu-shortcut">{activeTab.sortDesc ? "↓" : "↑"}</span>}
              </div>
            ))}
            <div className="menu-sep" />
            <div className="menu-item" onClick={() => { if (activeTab) store.setSort(activeTab.sortKey, !activeTab.sortDesc); setSortOpen(false); }}>
              <span>Reverse order</span>
            </div>
          </div>
        )}
      </div>

      <button className="icon-btn" onClick={store.toggleSidebar} title="Sidebar (Ctrl+B)"><SidebarIcon size={16} /></button>
      <button className="icon-btn" onClick={store.togglePreview} title="Preview (Ctrl+P)"><PanelRight size={16} /></button>

      {/* Primary Quick Actions */}
      <button className="icon-btn" onClick={store.toggleTransfers} title="Transfers">
        <Package size={16} />
        {Object.keys(store.transfers).length > 0 && (
          <span style={{ position: "absolute", top: 4, right: 4, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
        )}
      </button>
      <button className="icon-btn" onClick={store.openCopilot} title="AI File Copilot (Ctrl+K)"><Sparkles size={16} style={{ color: "#38bdf8" }} /></button>
      <button className={`icon-btn ${store.terminalOpen ? "active" : ""}`} onClick={store.toggleTerminal} title="Docked terminal (Ctrl+`)"><SquareTerminal size={16} /></button>

      {/* Consolidated Tools & Extensions Menu */}
      <div style={{ position: "relative" }}>
        <button
          className={`icon-btn ${toolsMenuOpen ? "active" : ""}`}
          onClick={() => setToolsMenuOpen((v) => !v)}
          title="Advanced Tools & Utilities"
          style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 8px", width: "auto" }}
        >
          <Wrench size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>Tools</span>
          <ChevronDown size={11} />
        </button>
        {toolsMenuOpen && (
          <div
            className="context-menu"
            style={{
              top: 44,
              right: 0,
              minWidth: 260,
              maxHeight: 460,
              overflowY: "auto",
              boxShadow: "var(--shadow-xl)",
            }}
            onMouseLeave={() => setToolsMenuOpen(false)}
          >
            <div className="side-heading" style={{ padding: "4px 8px" }}>Storage & Hardware</div>
            <div className="menu-item" onClick={() => { store.setTreemapOpen(true); setToolsMenuOpen(false); }}>
              <PieChart size={14} style={{ color: "#38bdf8" }} />
              <span>Disk Space Treemap</span>
            </div>
            <div className="menu-item" onClick={() => { store.setDevDriveOpen(true); setToolsMenuOpen(false); }}>
              <Cpu size={14} style={{ color: "#6366f1" }} />
              <span>Dev Drive & BitLocker</span>
            </div>
            <div className="menu-item" onClick={() => { store.setMounterOpen(true); setToolsMenuOpen(false); }}>
              <Disc size={14} style={{ color: "#8b5cf6" }} />
              <span>Virtual Drive Mounter (VHD/ISO)</span>
            </div>
            <div className="menu-item" onClick={() => { store.setJanitorOpen(true); setToolsMenuOpen(false); }}>
              <Sparkles size={14} style={{ color: "#f59e0b" }} />
              <span>Artifact & Cache Janitor</span>
            </div>

            <div className="menu-sep" />
            <div className="side-heading" style={{ padding: "4px 8px" }}>Cloud & Sharing</div>
            <div className="menu-item" onClick={() => { store.setSftpOpen(true); setToolsMenuOpen(false); }}>
              <Globe size={14} style={{ color: "#06b6d4" }} />
              <span>Remote SFTP / SSH Explorer</span>
            </div>
            <div className="menu-item" onClick={() => { store.setWebdropOpen(true); setToolsMenuOpen(false); }}>
              <QrCode size={14} style={{ color: "#10b981" }} />
              <span>Mobile QR AirDrop</span>
            </div>
            <div className="menu-item" onClick={() => { store.openMeshShare(activeTab?.selected.length ? activeTab.selected : (activeTab ? [activeTab.path] : [])); setToolsMenuOpen(false); }}>
              <Share2 size={14} style={{ color: "#a855f7" }} />
              <span>Local P2P Mesh Sharing</span>
            </div>
            <div className="menu-item" onClick={() => { store.setVdfsOpen(true); setToolsMenuOpen(false); }}>
              <Database size={14} style={{ color: "#38bdf8" }} />
              <span>VDFS Global CAS Namespace</span>
            </div>

            <div className="menu-sep" />
            <div className="side-heading" style={{ padding: "4px 8px" }}>Security & History</div>
            <div className="menu-item" onClick={() => { store.setProvenanceOpen(true); setToolsMenuOpen(false); }}>
              <ShieldCheck size={14} style={{ color: "#10b981" }} />
              <span>Provenance Ledger Audit</span>
            </div>
            <div className="menu-item" onClick={() => { store.setDlpOpen(true); setToolsMenuOpen(false); }}>
              <ShieldAlert size={14} style={{ color: "#ef4444" }} />
              <span>DLP & Secret Scanner</span>
            </div>
            <div className="menu-item" onClick={() => { store.setTimeMachineOpen(true); setToolsMenuOpen(false); }}>
              <Clock size={14} style={{ color: "#06b6d4" }} />
              <span>Time Machine Snapshots</span>
            </div>
            <div className="menu-item" onClick={() => { store.setClipboardHistoryOpen(true); setToolsMenuOpen(false); }}>
              <Clipboard size={14} style={{ color: "#ec4899" }} />
              <span>Multi-Slot Clipboard History</span>
            </div>

            <div className="menu-sep" />
            <div className="side-heading" style={{ padding: "4px 8px" }}>Power Tools & Workspaces</div>
            <div className="menu-item" onClick={() => { store.setPowerTools(true); setToolsMenuOpen(false); }}>
              <Wrench size={14} style={{ color: "#f59e0b" }} />
              <span>Advanced Power Tools Dialog (Ctrl+Alt+P)</span>
            </div>
            <div className="menu-item" onClick={() => { store.setWorkspaceProfilesOpen(true); setToolsMenuOpen(false); }}>
              <Sliders size={14} style={{ color: "#a855f7" }} />
              <span>Workspace Context Profiles</span>
            </div>
            <div className="menu-item" onClick={() => { store.setSmartFolderOpen(true); setToolsMenuOpen(false); }}>
              <FolderSearch size={14} />
              <span>Smart Folders Manager (Ctrl+Shift+M)</span>
            </div>
            <div className="menu-item" onClick={() => { void store.toggleFlatView(); setToolsMenuOpen(false); }}>
              <ListTree size={14} />
              <span>{store.flatView ? "Disable Flat Branch View" : "Enable Flat Branch View"}</span>
            </div>
            <div className="menu-item" onClick={() => { store.setStagingOpen(!store.stagingOpen); setToolsMenuOpen(false); }}>
              <Layers size={14} />
              <span>Staging Shelf Drawer (Ctrl+Shift+X)</span>
            </div>
          </div>
        )}
      </div>

      <button className="icon-btn" onClick={() => store.togglePalette()} title="Command palette (Ctrl+Shift+P)"><Command size={16} /></button>

      {/* Pane Layout Switcher */}
      <div style={{ position: "relative" }}>
        <button
          className={`icon-btn ${store.dualPane ? "active" : ""}`}
          onClick={() => setPaneMenuOpen((v) => !v)}
          title={`Spatial Pane Layout (${store.paneLayout})`}
        >
          <Columns size={16} />
        </button>
        {paneMenuOpen && (
          <div className="context-menu" style={{ top: 44, right: 0, minWidth: 220 }} onMouseLeave={() => setPaneMenuOpen(false)}>
            <div className={`menu-item ${store.paneLayout === "single" ? "active" : ""}`} onClick={() => { store.setPaneLayout("single"); setPaneMenuOpen(false); }}>
              <span>Single Pane (1×1)</span>
            </div>
            <div className={`menu-item ${store.paneLayout === "dual-h" ? "active" : ""}`} onClick={() => { store.setPaneLayout("dual-h"); setPaneMenuOpen(false); }}>
              <span>Dual Horizontal (Split Left/Right)</span>
            </div>
            <div className={`menu-item ${store.paneLayout === "dual-v" ? "active" : ""}`} onClick={() => { store.setPaneLayout("dual-v"); setPaneMenuOpen(false); }}>
              <span>Dual Vertical (Split Top/Bottom)</span>
            </div>
            <div className={`menu-item ${store.paneLayout === "triple" ? "active" : ""}`} onClick={() => { store.setPaneLayout("triple"); setPaneMenuOpen(false); }}>
              <span>Triple Pane (1 Main + 2 Stacked)</span>
            </div>
            <div className={`menu-item ${store.paneLayout === "quad" ? "active" : ""}`} onClick={() => { store.setPaneLayout("quad"); setPaneMenuOpen(false); }}>
              <span>Quad Grid (2 × 2)</span>
            </div>
          </div>
        )}
      </div>
      {store.dualPane && (
        <button
          className={`icon-btn ${store.dualScrollLocked ? "active" : ""}`}
          onClick={store.toggleDualScrollLocked}
          title={store.dualScrollLocked ? "Unlock Dual-Scroll Synchronization" : "Lock Dual-Scroll in Synchronization"}
        >
          {store.dualScrollLocked ? <Link2 size={16} style={{ color: "var(--accent)" }} /> : <Unlink2 size={16} />}
        </button>
      )}

      <button className="icon-btn" onClick={() => store.setSettingsOpen(true)} title="Settings (Ctrl+,)">⚙</button>
    </div>
  );
}