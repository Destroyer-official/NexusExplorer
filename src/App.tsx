import { useEffect } from "react";
import { isTauri } from "@/lib/ipc";
import { useAppStore } from "@/state/store";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useSystemEvents } from "@/hooks/useSystemEvents";
import QuickLookDialog from "@/components/QuickLookDialog";
import DragGhost from "@/components/DragGhost";
import TitleBar from "@/components/TitleBar";
import TabStrip from "@/components/TabStrip";
import Toolbar from "@/components/Toolbar";
import Workspace from "@/components/Workspace";
import StatusBar from "@/components/StatusBar";
import CommandPalette from "@/components/CommandPalette";
import SettingsDialog from "@/components/SettingsDialog";
import ShortcutsDialog from "@/components/ShortcutsDialog";
import TransfersPanel from "@/components/TransfersPanel";
import ConflictDialog from "@/components/ConflictDialog";
import PromptDialog from "@/components/PromptDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import ContextMenu from "@/components/ContextMenu";
import Toasts from "@/components/Toasts";
import BatchRenameDialog from "@/components/BatchRenameDialog";
import { GitHistoryModal } from "@/components/GitHistoryModal";
import { CopilotModal } from "@/components/CopilotModal";
import { MeshShareModal } from "@/components/MeshShareModal";
import { DevDriveModal } from "@/components/DevDriveModal";
import { ProvenanceLedgerModal } from "@/components/ProvenanceLedgerModal";
import { SftpExplorerModal } from "@/components/SftpExplorerModal";
import TreemapModal from "@/components/TreemapModal";
import PowerToolsDialog from "@/components/PowerToolsDialog";
import SmartFoldersModal from "@/components/SmartFoldersModal";
import ScaffoldDialog from "@/components/ScaffoldDialog";
import ArchiveBrowserModal from "@/components/ArchiveBrowserModal";
import TerminalDock from "@/components/TerminalDock";
import DebugHud from "@/components/DebugHud";
import { VdfsModal } from "@/components/VdfsModal";
import { WebDropModal } from "@/components/WebDropModal";
import { JanitorModal } from "@/components/JanitorModal";
import { DlpScannerModal } from "@/components/DlpScannerModal";
import { VirtualMounterModal } from "@/components/VirtualMounterModal";
import { ClipboardHistoryModal } from "@/components/ClipboardHistoryModal";
import { TimeMachineBar } from "@/components/TimeMachineBar";
import { PropertiesModal } from "@/components/PropertiesModal";
import HexEditorModal from "@/components/HexEditorModal";
import { WorkspaceProfilesModal } from "@/components/WorkspaceProfilesModal";
import { initGamepadListener } from "@/lib/gamepad";

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const bootError = useAppStore((s) => s.bootError);
  const boot = useAppStore((s) => s.boot);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const shortcutsOpen = useAppStore((s) => s.shortcutsOpen);
  const contextMenu = useAppStore((s) => s.contextMenu);
  const prompt = useAppStore((s) => s.prompt);
  const confirm = useAppStore((s) => s.confirm);
  const conflict = useAppStore((s) => s.conflict);
  const batchRenameOpen = useAppStore((s) => s.batchRenameOpen);
  const quickLookOpen = useAppStore((s) => s.quickLookOpen);
  const transfersOpen = useAppStore((s) => s.transfersOpen);
  const toasts = useAppStore((s) => s.toasts);
  const copilotOpen = useAppStore((s) => s.copilotOpen);
  const meshSharePaths = useAppStore((s) => s.meshSharePaths);
  const gitHistoryPath = useAppStore((s) => s.gitHistoryPath);
  const devDriveOpen = useAppStore((s) => s.devDriveOpen);
  const provenanceOpen = useAppStore((s) => s.provenanceOpen);
  const sftpOpen = useAppStore((s) => s.sftpOpen);
  const treemapOpen = useAppStore((s) => s.treemapOpen);
  const setDevDriveOpen = useAppStore((s) => s.setDevDriveOpen);
  const setProvenanceOpen = useAppStore((s) => s.setProvenanceOpen);
  const setSftpOpen = useAppStore((s) => s.setSftpOpen);
  const setTreemapOpen = useAppStore((s) => s.setTreemapOpen);

  const vdfsOpen = useAppStore((s) => s.vdfsOpen);
  const setVdfsOpen = useAppStore((s) => s.setVdfsOpen);
  const webdropOpen = useAppStore((s) => s.webdropOpen);
  const setWebdropOpen = useAppStore((s) => s.setWebdropOpen);
  const janitorOpen = useAppStore((s) => s.janitorOpen);
  const setJanitorOpen = useAppStore((s) => s.setJanitorOpen);
  const dlpOpen = useAppStore((s) => s.dlpOpen);
  const setDlpOpen = useAppStore((s) => s.setDlpOpen);
  const mounterOpen = useAppStore((s) => s.mounterOpen);
  const setMounterOpen = useAppStore((s) => s.setMounterOpen);
  const clipboardHistoryOpen = useAppStore((s) => s.clipboardHistoryOpen);
  const setClipboardHistoryOpen = useAppStore((s) => s.setClipboardHistoryOpen);
  const timeMachineOpen = useAppStore((s) => s.timeMachineOpen);
  const setTimeMachineOpen = useAppStore((s) => s.setTimeMachineOpen);
  const propertiesPath = useAppStore((s) => s.propertiesPath);
  const setPropertiesPath = useAppStore((s) => s.setPropertiesPath);
  const hexEditorPath = useAppStore((s) => s.hexEditorPath);
  const setHexEditorPath = useAppStore((s) => s.setHexEditorPath);
  const workspaceProfilesOpen = useAppStore((s) => s.workspaceProfilesOpen);
  const setWorkspaceProfilesOpen = useAppStore((s) => s.setWorkspaceProfilesOpen);

  const activeTab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const closeCopilot = useAppStore((s) => s.closeCopilot);
  const closeMeshShare = useAppStore((s) => s.closeMeshShare);
  const closeGitHistory = useAppStore((s) => s.closeGitHistory);
  const refreshActive = useAppStore((s) => s.refreshActive);

  useShortcuts();
  useSystemEvents();

  useEffect(() => {
    initGamepadListener();
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/webview").then(({ getCurrentWebview }) => {
      try {
        const webview = getCurrentWebview();
        webview
          .onDragDropEvent((event) => {
            const payload = event.payload as { type: string; paths?: string[]; position?: { x: number; y: number } };
            if (payload.type === "drop" && payload.paths?.length) {
              const store = useAppStore.getState();
              const x = (payload.position?.x ?? 0) / window.devicePixelRatio;
              const y = (payload.position?.y ?? 0) / window.devicePixelRatio;
              const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-path]");
              const dest = el?.dataset.dropPath ?? store.tabs.find((t) => t.id === store.activeTabId)?.path;
              if (dest) void store.startCopy(payload.paths, dest);
            }
          })
          .then((fn) => { unlisten = fn; });
      } catch {
        // Safe browser fallback
      }
    }).catch(() => undefined);
    return () => { unlisten?.(); };
  }, []);

  if (!ready) {
    return (
      <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 22 }}>N</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Nexus Explorer</div>
          <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Booting Rust engine…</div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="modal" style={{ width: 420 }}>
          <div className="modal-header"><div className="modal-title">Could not start Nexus</div></div>
          <div className="modal-body"><div style={{ color: "var(--danger)" }}>{bootError}</div></div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => { useAppStore.setState({ ready: false, bootError: null }); void boot(); }}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TitleBar />
      <TabStrip />
      <Toolbar />
      <Workspace />
      <TerminalDock />
      <StatusBar />
      <PowerToolsDialog />
      <SmartFoldersModal />
      <ScaffoldDialog />
      <ArchiveBrowserModal />
      <DebugHud />
      {commandPaletteOpen && <CommandPalette />}
      {settingsOpen && <SettingsDialog />}
      {shortcutsOpen && <ShortcutsDialog />}
      {transfersOpen && <TransfersPanel />}
      {conflict && <ConflictDialog />}
      {prompt && <PromptDialog />}
      {confirm && <ConfirmDialog />}
  {batchRenameOpen && <BatchRenameDialog />}
  {quickLookOpen && <QuickLookDialog />}
      {contextMenu && <ContextMenu />}
      <Toasts toasts={toasts} />
      <DragGhost />

      {gitHistoryPath && (
        <GitHistoryModal
          filePath={gitHistoryPath}
          isOpen={!!gitHistoryPath}
          onClose={closeGitHistory}
        />
      )}

      {copilotOpen && (
        <CopilotModal
          isOpen={copilotOpen}
          currentDir={activeTab?.path ?? ""}
          onClose={closeCopilot}
          onRefreshDirectory={() => void refreshActive()}
        />
      )}

      {meshSharePaths && (
        <MeshShareModal
          isOpen={!!meshSharePaths}
          filePaths={meshSharePaths}
          onClose={closeMeshShare}
        />
      )}

      {devDriveOpen && (
        <DevDriveModal
          open={devDriveOpen}
          onClose={() => setDevDriveOpen(false)}
        />
      )}

      {provenanceOpen && (
        <ProvenanceLedgerModal
          open={provenanceOpen}
          onClose={() => setProvenanceOpen(false)}
        />
      )}

      {sftpOpen && (
        <SftpExplorerModal
          open={sftpOpen}
          onClose={() => setSftpOpen(false)}
        />
      )}

      {treemapOpen && activeTab && (
        <TreemapModal
          initialPath={activeTab.path}
          onClose={() => setTreemapOpen(false)}
        />
      )}

      {vdfsOpen && (
        <VdfsModal
          isOpen={vdfsOpen}
          onClose={() => setVdfsOpen(false)}
        />
      )}

      {webdropOpen && (
        <WebDropModal
          isOpen={webdropOpen}
          onClose={() => setWebdropOpen(false)}
          filesToShare={activeTab?.selected.length ? activeTab.selected : (activeTab ? [activeTab.path] : [])}
        />
      )}

      {janitorOpen && (
        <JanitorModal
          isOpen={janitorOpen}
          onClose={() => setJanitorOpen(false)}
        />
      )}

      {dlpOpen && (
        <DlpScannerModal
          isOpen={dlpOpen}
          onClose={() => setDlpOpen(false)}
        />
      )}

      {mounterOpen && (
        <VirtualMounterModal
          isOpen={mounterOpen}
          onClose={() => setMounterOpen(false)}
          initialSource={activeTab?.selected?.[0] || activeTab?.path}
        />
      )}

      {clipboardHistoryOpen && (
        <ClipboardHistoryModal
          isOpen={clipboardHistoryOpen}
          onClose={() => setClipboardHistoryOpen(false)}
        />
      )}

      {timeMachineOpen && (
        <TimeMachineBar
          isOpen={timeMachineOpen}
          onClose={() => setTimeMachineOpen(false)}
        />
      )}

      {propertiesPath && (
        <PropertiesModal
          path={propertiesPath}
          onClose={() => setPropertiesPath(null)}
        />
      )}

      {workspaceProfilesOpen && (
        <WorkspaceProfilesModal
          isOpen={workspaceProfilesOpen}
          onClose={() => setWorkspaceProfilesOpen(false)}
        />
      )}

      {hexEditorPath && (
        <HexEditorModal
          filePath={hexEditorPath}
          onClose={() => setHexEditorPath(null)}
        />
      )}
    </div>
  );
}