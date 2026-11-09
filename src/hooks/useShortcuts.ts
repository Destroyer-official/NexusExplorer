import { useEffect } from "react";
import { useAppStore } from "@/state/store";

export function useShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const ctrl = e.ctrlKey || e.metaKey;
      const store = useAppStore.getState();

      if (e.key === "Escape") {
        if (store.conflict) return;
        if (store.prompt) { store.closePrompt(); return; }
        if (store.confirm) { store.closeConfirm(); return; }
        if (store.settingsOpen) { store.setSettingsOpen(false); return; }
        if (store.shortcutsOpen) { store.setShortcutsOpen(false); return; }
        if (store.quickLookOpen) { store.setQuickLookOpen(false); return; }
        if (store.batchRenameOpen) { store.setBatchRenameOpen(false); return; }
        if (store.devDriveOpen) { store.setDevDriveOpen(false); return; }
        if (store.provenanceOpen) { store.setProvenanceOpen(false); return; }
        if (store.sftpOpen) { store.setSftpOpen(false); return; }
        if (store.treemapOpen) { store.setTreemapOpen(false); return; }
        if (store.hexEditorPath) { store.setHexEditorPath(null); return; }
        if (store.workspaceProfilesOpen) { store.setWorkspaceProfilesOpen(false); return; }
        if (store.propertiesPath) { store.setPropertiesPath(null); return; }
        if (store.contextMenu) { store.closeContextMenu(); return; }
        if (store.vdfsOpen) { store.setVdfsOpen(false); return; }
        if (store.webdropOpen) { store.setWebdropOpen(false); return; }
        if (store.janitorOpen) { store.setJanitorOpen(false); return; }
        if (store.dlpOpen) { store.setDlpOpen(false); return; }
        if (store.mounterOpen) { store.setMounterOpen(false); return; }
        if (store.clipboardHistoryOpen) { store.setClipboardHistoryOpen(false); return; }
        if (store.timeMachineOpen) { store.setTimeMachineOpen(false); return; }
        if (store.archivePath) { store.setArchivePath(null); return; }
        if (store.powerToolsOpen) { store.setPowerTools(false); return; }
        if (store.scaffoldOpen) { store.setScaffoldOpen(false); return; }
        if (store.smartFolderOpen) { store.setSmartFolderOpen(false); return; }
        if (store.pluginsOpen) { store.setPowerTools(false); return; }
        if (store.copilotOpen) { store.closeCopilot(); return; }
        if (store.meshSharePaths) { store.closeMeshShare(); return; }
        if (store.gitHistoryPath) { store.closeGitHistory(); return; }
        if (store.commandPaletteOpen) { store.setPalette(false); return; }
        if (store.search.open) { store.closeSearch(); return; }
        if (store.prompt) { store.closePrompt(); return; }
        if (store.confirm) { store.closeConfirm(); return; }
        if (store.transfersOpen) { store.toggleTransfers(); return; }
        if (store.flatView) { void store.toggleFlatView(); return; }
        return;
      }

      if (document.querySelector(".overlay, .palette-overlay, .modal-backdrop, [aria-modal=true]")) return;
      if (typing && ctrl && ["z", "y"].includes(e.key.toLowerCase())) return;

      // ── parity feature shortcuts ─────────────────────────────────────────
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); void store.toggleFlatView(); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); store.setContentSearchOpen(true); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "b") { e.preventDefault(); store.setScaffoldOpen(true); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "x") { e.preventDefault(); store.stageSelection(); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "m") { e.preventDefault(); store.setSmartFolderOpen(true); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "p") { e.preventDefault(); store.togglePalette(); return; }
      if (ctrl && e.altKey && e.key.toLowerCase() === "p") { e.preventDefault(); store.setPowerTools(true); return; }
      if (ctrl && e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        const current = store.settings.theme;
        const next = current === "light" ? "dark" : "light";
        void store.updateSettings({ theme: next });
        store.pushToast("info", "Theme Changed", `Switched to ${next === "light" ? "Light" : "Dark"} mode`);
        return;
      }
      if (ctrl && (e.key === "`" || e.key === "~")) { e.preventDefault(); store.toggleTerminal(); return; }
      if (e.key === "F12") { e.preventDefault(); store.toggleDebugHud(); return; }

      if (ctrl && e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); store.openCopilot(); return; }
      if (ctrl && e.key.toLowerCase() === "k") { e.preventDefault(); store.openCopilot(); return; }
      if (ctrl && e.key === ",") { e.preventDefault(); store.setSettingsOpen(true); return; }
      if (ctrl && (e.key === "/" || e.key === "?")) { e.preventDefault(); store.setShortcutsOpen(true); return; }
      if (ctrl && !e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); const home = store.knownFolders.find((f) => f.id === "home")?.path ?? store.drives.find((d) => d.isReady)?.path ?? "C:\\"; void store.openTab(home, true, false); return; }
      if (ctrl && e.key.toLowerCase() === "w") { e.preventDefault(); if (store.activeTabId) void store.closeTab(store.activeTabId); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "r") { e.preventDefault(); store.setBatchRenameOpen(true); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "i") { e.preventDefault(); store.invertSelection(); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); store.setSelectPatternOpen(true); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "a") { e.preventDefault(); store.setTabSearchOpen(true); return; }
      if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "g") { e.preventDefault(); store.setGoToFolderOpen(true); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "d") { e.preventDefault(); store.toggleSyncNav(); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "e") { e.preventDefault(); void store.comparePanes(); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
        const selected = activeTab?.selected ?? [];
        if (selected.length > 0) {
          void store.copyText(selected.join("\n"), `Copied ${selected.length} path(s)`);
        } else if (activeTab?.path) {
          void store.copyText(activeTab.path, "Folder path copied");
        }
        return;
      }
      if (ctrl && e.key.toLowerCase() === "b") { e.preventDefault(); store.toggleSidebar(); return; }
      if (ctrl && e.key.toLowerCase() === "r") { e.preventDefault(); void store.refreshActive(); return; }
      if (ctrl && e.key.toLowerCase() === "h") { e.preventDefault(); void store.updateSettings({ showHidden: !store.settings.showHidden }); return; }
      if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); store.toggleDualPane(); return; }
      if (ctrl && e.key.toLowerCase() === "p") { e.preventDefault(); store.togglePreview(); return; }
      if (ctrl && e.key.toLowerCase() === "a") { if (!typing) { e.preventDefault(); store.selectAll(); } return; }
      if (ctrl && e.key.toLowerCase() === "c") { if (!typing) { e.preventDefault(); store.copySelection(false); } return; }
      if (ctrl && e.key.toLowerCase() === "x") { if (!typing) { e.preventDefault(); store.copySelection(true); } return; }
      if (ctrl && e.key.toLowerCase() === "v") { if (!typing) { e.preventDefault(); void store.pasteInto(); } return; }
      if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) void store.redo(); else void store.undo(); return; }
      if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); void store.redo(); return; }
      if (ctrl && e.key.toLowerCase() === "f") { e.preventDefault(); store.openSearch(); return; }
      if (ctrl && e.key.toLowerCase() === "l") { e.preventDefault(); window.dispatchEvent(new CustomEvent("nexus:focus-address")); return; }
      if (ctrl && e.key === "Tab") { e.preventDefault(); const tabs = store.tabs; if (!tabs.length) return; const idx = tabs.findIndex((t) => t.id === store.activeTabId); const next = e.shiftKey ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length; store.activateTab(tabs[next].id); return; }
      if (ctrl && (e.key === "1" || e.key === "2" || e.key === "3")) { e.preventDefault(); store.setView(e.key === "1" ? "list" : e.key === "2" ? "grid" : "columns"); return; }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "n") { e.preventDefault(); void store.createFolder(); return; }

      if (typing) return;
      if (e.key === "*" && !ctrl && !e.altKey) { e.preventDefault(); store.invertSelection(); return; }
      if (e.key === "+" && !ctrl && !e.altKey) { e.preventDefault(); store.setSelectPatternOpen(true); return; }
      if (e.key === " ") {
        if (target?.closest("select, [role=menu]")) return;
        e.preventDefault();
        store.setQuickLookOpen(!store.quickLookOpen);
        return;
      }
      if (target?.closest("button, select, a[href], [role=menu]")) return;

      if (e.key === "Backspace") { e.preventDefault(); void store.goUp(); return; }
      if (e.key === "F2") { e.preventDefault(); const tab = store.tabs.find((t) => t.id === store.activeTabId); const sel = tab?.selected[0]; if (sel) store.setRenaming(sel); return; }
      if (e.key === "Delete") { e.preventDefault(); const tab = store.tabs.find((t) => t.id === store.activeTabId); if (tab && tab.selected.length) void store.startDelete(tab.selected, e.shiftKey); return; }
      if (e.key === "F5") { e.preventDefault(); void store.refreshActive(); return; }
      if (e.key === "Enter") {
        if (e.altKey && e.shiftKey) {
          e.preventDefault();
          void store.calculateAllVisibleFolderSizes();
          return;
        }
        if (e.altKey) {
          e.preventDefault();
          const tab = store.tabs.find((t) => t.id === store.activeTabId);
          const sel = tab?.selected[0] ?? tab?.path;
          if (sel) store.setPropertiesPath(sel);
          return;
        }
        const tab = store.tabs.find((t) => t.id === store.activeTabId);
        if (tab && tab.selected.length === 1) {
          const entry = tab.entries.find((en) => en.path === tab.selected[0]);
          if (entry) void store.openEntry(entry);
        }
        return;
      }
      if (e.key === " ") { e.preventDefault(); store.setQuickLookOpen(true); return; }
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); void store.goBack(); return; }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); void store.goForward(); return; }
      if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); void store.goUp(); return; }
    };

    const mouseHandler = (e: MouseEvent) => {
      // button 3 = back thumb button, button 4 = forward thumb button on 5-button mouse
      if (e.button === 3) {
        e.preventDefault();
        const store = useAppStore.getState();
        void store.goBack();
      } else if (e.button === 4) {
        e.preventDefault();
        const store = useAppStore.getState();
        void store.goForward();
      }
    };

    window.addEventListener("keydown", handler);
    window.addEventListener("pointerup", mouseHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("pointerup", mouseHandler);
    };
  }, []);
}
