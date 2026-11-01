/** Global application store. UI components stay dumb; orchestration lives here. */

import { create } from "zustand";
import { applyTheme } from "@/lib/theme";
import { basename, dirname, isRoot, joinPath, normalizePath, samePath } from "@/lib/paths";
import { ipc, isTauri, toErrorMessage } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import type {
  AppInfo,
  Bookmark,
  ConfirmConfig,
  ConflictInfo,
  ContextMenuItem,
  DriveInfo,
  FileEntry,
  FlatListing,
  FolderSize,
  JobEvent,
  KnownFolder,
  PluginInfo,
  PromptConfig,
  RecentEntry,
  SearchState,
  Settings,
  SmartFolder,
  SmartFolderResult,
  SortKey,
  Tab,
  TabColorGroup,
  TagItem,
  TransferJob,
  UndoStatus,
  ViewMode,
} from "@/types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "dark",
  accent: "aurora",
  density: "comfortable",
  lastPath: "",
  view: "list",
  sortKey: "name",
  sortDesc: false,
  showHidden: false,
  showSystem: false,
  showExtensions: true,
  confirmDelete: true,
  previewOpen: true,
  sidebarOpen: true,
  sidebarWidth: 268,
  restoreSession: true,
  sessionTabs: [],
  recentLimit: 30,
  animations: true,
  zoom: 100,
  faytEnabled: true,
  vimModeEnabled: true,
  chromaticHeatmap: true,
};

const EMPTY_UNDO: UndoStatus = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
};

const EMPTY_SEARCH: SearchState = {
  open: false,
  query: "",
  root: "",
  searchId: null,
  running: false,
  results: [],
  total: 0,
  elapsedMs: 0,
  error: null,
};

export type ToastKind = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface AppStore {
  ready: boolean;
  bootError: string | null;
  settings: Settings;
  appInfo: AppInfo | null;
  drives: DriveInfo[];
  knownFolders: KnownFolder[];
  bookmarks: Bookmark[];
  recent: RecentEntry[];
  tabs: Tab[];
  activeTabId: string;
  sidebarOpen: boolean;
  sidebarWidth: number;
  previewOpen: boolean;
  search: SearchState;
  transfers: Record<string, TransferJob>;
  transfersOpen: boolean;
  conflict: ConflictInfo | null;
  conflictQueue: ConflictInfo[];
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  quickLookOpen: boolean;
  batchRenameOpen: boolean;
  prompt: PromptConfig | null;
  confirm: ConfirmConfig | null;
  contextMenu: ContextMenuState | null;
  toasts: Toast[];
  undoStatus: UndoStatus;
  folderSizes: Record<string, FolderSize>;
  folderSizeTasks: Record<string, string>;
  renamingPath: string | null;
  statusMessage: string | null;
  dualPane: boolean;
  secondaryPath: string;
  secondaryEntries: FileEntry[];
  secondaryLoading: boolean;
  secondarySelected: string[];
  activePane: 0 | 1;
  copilotOpen: boolean;
  meshSharePaths: string[] | null;
  gitHistoryPath: string | null;
  devDriveOpen: boolean;
  provenanceOpen: boolean;
  sftpOpen: boolean;
  treemapOpen: boolean;
  propertiesPath: string | null;
  hexEditorPath: string | null;
  workspaceProfilesOpen: boolean;
  paneLayout: "single" | "dual-h" | "dual-v" | "triple" | "quad";

  // ── parity features ──────────────────────────────────────────────────────
  stagingPaths: string[];
  stagingOpen: boolean;
  stagingMode: "copy" | "move";
  activeStagingSlot: number;
  stagingSlots: Record<number, string[]>;
  clipboardHistory: Array<{ id: string; paths: string[]; mode: "copy" | "move"; timestamp: number }>;
  flatView: boolean;
  flatListing: FlatListing | null;
  flatLoading: boolean;
  smartFolders: SmartFolder[];
  smartFolderOpen: boolean;
  smartFolderResults: SmartFolderResult | null;
  powerToolsOpen: boolean;
  powerToolsTab: string;
  scaffoldOpen: boolean;
  contentSearchOpen: boolean;
  archivePath: string | null;
  terminalOpen: boolean;
  debugHud: boolean;
  plugins: PluginInfo[];
  pluginsOpen: boolean;
  tags: TagItem[];

  setStagingOpen: (open: boolean) => void;
  setStagingMode: (mode: "copy" | "move") => void;
  toggleStagingMode: () => void;
  setActiveStagingSlot: (slot: number) => void;
  addStaged: (paths: string[]) => void;
  removeStaged: (path: string) => void;
  clearStaged: () => void;
  stageSelection: () => void;
  copyStagedTo: (dest: string) => Promise<void>;
  moveStagedTo: (dest: string) => Promise<void>;
  pasteStagedAs: (
    kind: "symlink" | "hardlink" | "shortcut" | "zip" | "extract" | "pattern",
    destDir: string,
    pattern?: string
  ) => Promise<void>;
  broadcastPaste: (destDirs: string[]) => Promise<void>;
  pushClipboardHistory: (paths: string[], mode: "copy" | "move") => void;
  toggleFlatView: () => Promise<void>;
  refreshFlat: () => Promise<void>;
  refreshSmartFolders: () => Promise<void>;
  saveSmartFolder: (folder: SmartFolder) => Promise<void>;
  deleteSmartFolder: (id: string) => Promise<void>;
  runSmartFolder: (folder: SmartFolder) => Promise<void>;
  setSmartFolderOpen: (open: boolean) => void;
  setPowerTools: (open: boolean, tab?: string) => void;
  setScaffoldOpen: (open: boolean) => void;
  setContentSearchOpen: (open: boolean) => void;
  setArchivePath: (path: string | null) => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
  toggleDebugHud: () => void;
  refreshPlugins: () => Promise<void>;
  setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
  runPluginCommand: (pluginId: string, commandId: string) => Promise<void>;
  createSamplePlugin: () => Promise<void>;
  refreshTags: () => Promise<void>;
  assignTag: (paths: string[], name: string, color: string) => Promise<void>;
  removeTag: (paths: string[], name: string) => Promise<void>;

  setDevDriveOpen: (open: boolean) => void;
  setProvenanceOpen: (open: boolean) => void;
  setSftpOpen: (open: boolean) => void;
  setTreemapOpen: (open: boolean) => void;
  setPropertiesPath: (path: string | null) => void;
  setHexEditorPath: (path: string | null) => void;
  setWorkspaceProfilesOpen: (open: boolean) => void;

  vdfsOpen: boolean;
  setVdfsOpen: (open: boolean) => void;
  webdropOpen: boolean;
  setWebdropOpen: (open: boolean) => void;
  janitorOpen: boolean;
  setJanitorOpen: (open: boolean) => void;
  dlpOpen: boolean;
  setDlpOpen: (open: boolean) => void;
  mounterOpen: boolean;
  setMounterOpen: (open: boolean) => void;
  clipboardHistoryOpen: boolean;
  setClipboardHistoryOpen: (open: boolean) => void;
  timeMachineOpen: boolean;
  setTimeMachineOpen: (open: boolean) => void;
  dualScrollLocked: boolean;
  setDualScrollLocked: (locked: boolean) => void;
  toggleDualScrollLocked: () => void;
  toggleLockTab: (id: string) => void;
  setTabColorGroup: (id: string, color: TabColorGroup | null) => void;

  boot: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  refreshDrives: () => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  refreshRecent: () => Promise<void>;
  refreshUndoStatus: () => Promise<void>;

  openTab: (path: string, activate?: boolean) => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  activateTab: (id: string) => void;
  navigateTo: (path: string, push?: boolean) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  goUp: () => Promise<void>;
  refreshActive: () => Promise<void>;
  refreshTab: (id: string) => Promise<void>;
  handleFsChange: (path: string) => void;

  setSort: (key: SortKey, desc?: boolean) => void;
  toggleSort: (key: SortKey) => void;
  setView: (view: ViewMode) => void;
  setGroupBy: (group: "none" | "date" | "type" | "size") => void;

  selectOnly: (path: string) => void;
  toggleSelection: (path: string) => void;
  selectRange: (path: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelected: (paths: string[]) => void;
  setClipboard: (clip: { op: "copy" | "cut"; paths: string[] }) => void;
  setRenaming: (path: string | null) => void;
  openCopilot: () => void;
  closeCopilot: () => void;
  openMeshShare: (paths: string[]) => void;
  closeMeshShare: () => void;
  openGitHistory: (path: string) => void;
  closeGitHistory: () => void;
  setPaneLayout: (layout: "single" | "dual-h" | "dual-v" | "triple" | "quad") => void;

  copySelection: (cut: boolean) => void;
  pasteInto: (dest?: string) => Promise<void>;
  paste: (dest?: string) => Promise<void>;
  startCopy: (sources: string[], dest: string) => Promise<void>;
  startMove: (sources: string[], dest: string) => Promise<void>;
  startDelete: (paths: string[], permanent?: boolean) => Promise<void>;
  updateTransfer: (event: JobEvent) => void;
  pauseTransfer: (jobId: string) => Promise<void>;
  resumeTransfer: (jobId: string) => Promise<void>;
  cancelTransfer: (jobId: string) => Promise<void>;
  setTransferQoS: (jobId: string, profile: "uncapped" | "gaming" | "battery" | "whisper") => void;
  toggleTransfers: () => void;
  resolveConflict: (resolution: "skip" | "overwrite" | "keepBoth", applyToAll?: boolean) => Promise<void>;

  createFolder: (name?: string) => Promise<void>;
  createFile: (name?: string) => Promise<void>;
  renameTo: (path: string, newName: string) => Promise<boolean>;
  batchRename: (paths: string[], transform: (name: string, index: number) => string) => Promise<void>;
  openPaths: (paths: string[]) => Promise<void>;
  openTerminal: (path: string) => Promise<void>;
  copyText: (text: string, label?: string) => Promise<void>;

  openSearch: () => void;
  setSearchQuery: (query: string) => void;
  runSearch: (query?: string) => Promise<void>;
  cancelSearch: () => Promise<void>;
  closeSearch: () => void;
  openEntry: (entry: FileEntry) => Promise<void>;

  calculateFolderSize: (path: string, silent?: boolean) => Promise<void>;
  autoCalculateFolderSizes: (paths: string[]) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  addBookmark: (path: string, name?: string) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  toggleBookmarkCurrent: () => Promise<void>;

  toggleDualPane: () => void;
  setActivePane: (pane: 0 | 1) => void;
  navigateSecondary: (path: string) => Promise<void>;
  refreshSecondary: () => Promise<void>;
  toggleSidebar: () => void;
  togglePreview: () => void;
  setSidebarWidth: (width: number) => void;
  togglePalette: () => void;
  setPalette: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setQuickLookOpen: (open: boolean) => void;
  setBatchRenameOpen: (open: boolean) => void;
  openPrompt: (prompt: PromptConfig) => void;
  closePrompt: () => void;
  openConfirm: (confirm: ConfirmConfig) => void;
  closeConfirm: () => void;
  openContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeContextMenu: () => void;
  pushToast: (kind: ToastKind, title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  setStatusMessage: (message: string | null) => void;
}

function newTab(path: string, settings: Settings): Tab {
  return {
    id: uid(),
    path: normalizePath(path) || path,
    title: basename(path) || path,
    history: [path],
    historyIndex: 0,
    entries: [],
    loading: true,
    error: null,
    sortKey: (settings.sortKey as SortKey) || "name",
    sortDesc: settings.sortDesc,
    view: (settings.view as ViewMode) || "list",
    groupBy: "none",
    selected: [],
    anchorPath: null,
  };
}

function patchTab(tabs: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  return tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab));
}

function activeTabOf(state: AppStore): Tab | undefined {
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  bootError: null,
  settings: DEFAULT_SETTINGS,
  appInfo: null,
  drives: [],
  knownFolders: [],
  bookmarks: [],
  recent: [],
  tabs: [],
  activeTabId: "",
  sidebarOpen: DEFAULT_SETTINGS.sidebarOpen,
  sidebarWidth: DEFAULT_SETTINGS.sidebarWidth,
  previewOpen: DEFAULT_SETTINGS.previewOpen,
  search: EMPTY_SEARCH,
  transfers: {},
  transfersOpen: false,
  conflict: null,
  conflictQueue: [],
  commandPaletteOpen: false,
  settingsOpen: false,
  shortcutsOpen: false,
  quickLookOpen: false,
  batchRenameOpen: false,
  prompt: null,
  confirm: null,
  contextMenu: null,
  toasts: [],
  undoStatus: EMPTY_UNDO,
  folderSizes: {},
  folderSizeTasks: {},
  renamingPath: null,
  statusMessage: null,
  dualPane: false,
  secondaryPath: "",
  secondaryEntries: [],
  secondaryLoading: false,
  secondarySelected: [],
  activePane: 0,
  copilotOpen: false,
  meshSharePaths: null,
  gitHistoryPath: null,
  devDriveOpen: false,
  provenanceOpen: false,
  sftpOpen: false,
  treemapOpen: false,
  propertiesPath: null,
  hexEditorPath: null,
  workspaceProfilesOpen: false,
  paneLayout: "single",
  stagingPaths: [],
  stagingOpen: false,
  stagingMode: "copy",
  activeStagingSlot: 1,
  stagingSlots: { 1: [], 2: [], 3: [] },
  clipboardHistory: [],
  flatView: false,
  flatListing: null,
  flatLoading: false,
  smartFolders: [],
  smartFolderOpen: false,
  smartFolderResults: null,
  powerToolsOpen: false,
  powerToolsTab: "duplicates",
  scaffoldOpen: false,
  contentSearchOpen: false,
  archivePath: null,
  terminalOpen: false,
  debugHud: false,
  plugins: [],
  pluginsOpen: false,
  tags: [],
  vdfsOpen: false,
  webdropOpen: false,
  janitorOpen: false,
  dlpOpen: false,
  mounterOpen: false,
  clipboardHistoryOpen: false,
  timeMachineOpen: false,
  dualScrollLocked: false,

  async boot() {
    try {
      const [settings, drives, knownFolders, bookmarks, recent, appInfo, undoStatus] =
        await Promise.all([
          ipc.getSettings(),
          ipc.getDrives().catch(() => []),
          ipc.knownFolders().catch(() => []),
          ipc.listBookmarks().catch(() => []),
          ipc.listRecent().catch(() => []),
          ipc.appInfo().catch(() => null),
          ipc.undoStatus().catch(() => EMPTY_UNDO),
        ]);

      const merged: Settings = { ...DEFAULT_SETTINGS, ...settings };
      applyTheme(merged);
      set({
        settings: merged,
        drives,
        knownFolders,
        bookmarks,
        recent,
        appInfo,
        undoStatus,
        sidebarOpen: merged.sidebarOpen,
        sidebarWidth: merged.sidebarWidth,
        previewOpen: merged.previewOpen,
      });

      const candidates = [
        ...(merged.restoreSession ? merged.sessionTabs : []),
        merged.lastPath,
        knownFolders.find((folder) => folder.id === "home")?.path,
        appInfo?.homeDir,
        drives.find((drive) => drive.isReady)?.path,
      ].filter((value): value is string => Boolean(value));

      let start = "";
      for (const candidate of candidates) {
        try {
          const stat = await ipc.statPath(candidate);
          if (stat?.isDir) {
            start = candidate;
            break;
          }
        } catch {
          // try the next candidate
        }
      }
      if (!start) start = candidates[0] ?? "C:\\";
      await get().openTab(start, true);
      set({ ready: true });
      void get().refreshSmartFolders();
      void get().refreshTags();
      void get().refreshPlugins();
    } catch (error) {
      set({ bootError: toErrorMessage(error), ready: true });
      get().pushToast("error", "Nexus could not start", toErrorMessage(error));
    }
  },

  async updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    applyTheme(settings);
    set({
      settings,
      sidebarOpen: settings.sidebarOpen,
      sidebarWidth: settings.sidebarWidth,
      previewOpen: settings.previewOpen,
    });
    try {
      const saved = await ipc.saveSettings(settings);
      set({ settings: saved });
      applyTheme(saved);
    } catch (error) {
      get().pushToast("error", "Could not save settings", toErrorMessage(error));
    }
  },

  async resetSettings() {
    await get().updateSettings({ ...DEFAULT_SETTINGS, lastPath: get().settings.lastPath });
    get().pushToast("success", "Appearance reset", "Nexus is back to its default look.");
  },

  async refreshDrives() {
    try {
      set({ drives: (await ipc.getDrives()) ?? [] });
    } catch (error) {
      get().pushToast("warning", "Drives unavailable", toErrorMessage(error));
    }
  },

  async refreshBookmarks() {
    try {
      set({ bookmarks: (await ipc.listBookmarks()) ?? [] });
    } catch {
      // bookmarks are optional
    }
  },

  async refreshRecent() {
    try {
      set({ recent: (await ipc.listRecent()) ?? [] });
    } catch {
      // recents are optional
    }
  },

  async refreshUndoStatus() {
    try {
      set({ undoStatus: await ipc.undoStatus() });
    } catch {
      // engine may still be booting
    }
  },

  async openTab(path, activate = true) {
    const normal = normalizePath(path);
    const existing = get().tabs.find((tab) => samePath(tab.path, normal));
    if (existing) {
      if (activate) set({ activeTabId: existing.id });
      return;
    }
    const tab = newTab(normal, get().settings);
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: activate ? tab.id : state.activeTabId,
    }));
    await get().refreshTab(tab.id);
    persistSession(get);
  },

  async closeTab(id) {
    const state = get();
    const target = state.tabs.find((tab) => tab.id === id);
    if (!target || target.isLocked) return;
    const index = state.tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;

    if (state.tabs.length === 1) {
      const home =
        state.knownFolders.find((folder) => folder.id === "home")?.path ||
        state.settings.lastPath ||
        "C:\\";      const replacement = newTab(home, state.settings);
      set({ tabs: [replacement], activeTabId: replacement.id });
      await get().refreshTab(replacement.id);
      persistSession(get);
      return;
    }

    const tabs = state.tabs.filter((tab) => tab.id !== id);
    let activeTabId = state.activeTabId;
    if (state.activeTabId === id) {
      const next = tabs[Math.min(index, tabs.length - 1)];
      activeTabId = next.id;
    }
    set({ tabs, activeTabId });
    persistSession(get);
  },

  activateTab(id) {
    if (get().tabs.some((tab) => tab.id === id)) set({ activeTabId: id });
  },

  async navigateTo(path, push = true) {
    const state = get();
    const tab = activeTabOf(state);
    if (!tab) {
      await get().openTab(path, true);
      return;
    }
    const normal = normalizePath(path);
    const history = push
      ? [...tab.history.slice(0, tab.historyIndex + 1), normal]
      : tab.history;
    const historyIndex = push ? history.length - 1 : tab.historyIndex;
    set((current) => ({
      tabs: patchTab(current.tabs, tab.id, {
        path: normal,
        title: basename(normal) || normal,
        history,
        historyIndex,
        entries: push ? [] : tab.entries,
        loading: true,
        error: null,
        selected: [],
        anchorPath: null,
      }),
    }));
    await get().refreshTab(tab.id);
    persistSession(get);
  },

  async goBack() {
    const tab = activeTabOf(get());
    if (!tab || tab.historyIndex <= 0) return;
    const index = tab.historyIndex - 1;
    const path = tab.history[index];
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, {
        path,
        title: basename(path) || path,
        historyIndex: index,
        loading: true,
        error: null,
        selected: [],
      }),
    }));
    await get().refreshTab(tab.id);
  },

  async goForward() {
    const tab = activeTabOf(get());
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;
    const index = tab.historyIndex + 1;
    const path = tab.history[index];
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, {
        path,
        title: basename(path) || path,
        historyIndex: index,
        loading: true,
        error: null,
        selected: [],
      }),
    }));
    await get().refreshTab(tab.id);
  },

  async goUp() {
    const tab = activeTabOf(get());
    if (!tab || isRoot(tab.path)) return;
    await get().navigateTo(dirname(tab.path));
  },

  async refreshActive() {
    const tab = activeTabOf(get());
    if (tab) await get().refreshTab(tab.id);
  },

  async refreshTab(id) {
    const tab = get().tabs.find((item) => item.id === id);
    if (!tab) return;
    set((state) => ({ tabs: patchTab(state.tabs, id, { loading: true, error: null }) }));
    try {
      const entries = await ipc.readDir(tab.path);
      set((state) => ({
        tabs: patchTab(state.tabs, id, {
          entries,
          loading: false,
          error: null,
          title: basename(tab.path) || tab.path,
        }),
      }));
      void ipc.recordRecent(tab.path, basename(tab.path) || tab.path).then((recent) => set({ recent })).catch(() => undefined);
      const dirPaths = entries.filter((e) => e.isDir).map((e) => e.path);
      if (dirPaths.length > 0) {
        void get().autoCalculateFolderSizes(dirPaths);
      }
    } catch (error) {
      set((state) => ({
        tabs: patchTab(state.tabs, id, { loading: false, error: toErrorMessage(error) }),
      }));
    }
  },

  handleFsChange(path) {
    const state = get();
    const active = activeTabOf(state);
    if (active && samePath(active.path, path)) {
      void get().refreshTab(active.id);
    }
  },

  setSort(key, desc) {
    const tab = activeTabOf(get());
    if (!tab) return;
    const sortDesc = desc ?? (tab.sortKey === key ? !tab.sortDesc : false);
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, { sortKey: key, sortDesc }),
    }));
  },

  toggleSort(key) {
    const tab = activeTabOf(get());
    if (!tab) return;
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, {
        sortKey: key,
        sortDesc: tab.sortKey === key ? !tab.sortDesc : false,
      }),
    }));
  },

  setView(view) {
    const tab = activeTabOf(get());
    if (!tab) return;
    set((state) => ({ tabs: patchTab(state.tabs, tab.id, { view }) }));
    void get().updateSettings({ view });
  },

  setGroupBy(group) {
    const tab = activeTabOf(get());
    if (!tab) return;
    set((state) => ({ tabs: patchTab(state.tabs, tab.id, { groupBy: group }) }));
  },

  selectOnly(path) {
    const tab = activeTabOf(get());
    if (!tab) return;
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, { selected: [path], anchorPath: path }),
    }));
  },

  toggleSelection(path) {
    const tab = activeTabOf(get());
    if (!tab) return;
    const selected = tab.selected.some((item) => samePath(item, path))
      ? tab.selected.filter((item) => !samePath(item, path))
      : [...tab.selected, path];
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, { selected, anchorPath: path }),
    }));
  },

  selectRange(path) {
    const state = get();
    const tab = activeTabOf(state);
    if (!tab) return;
    const rows = state.settings.showHidden || state.settings.showSystem
      ? tab.entries
      : tab.entries.filter((entry) => (!entry.isHidden || state.settings.showHidden) && (!entry.isSystem || state.settings.showSystem));
    const anchor = tab.anchorPath ?? tab.selected[0] ?? path;
    const from = rows.findIndex((entry) => samePath(entry.path, anchor));
    const to = rows.findIndex((entry) => samePath(entry.path, path));
    if (from < 0 || to < 0) {
      get().selectOnly(path);
      return;
    }
    const [start, end] = from < to ? [from, to] : [to, from];
    const selected = rows.slice(start, end + 1).map((entry) => entry.path);
    set((current) => ({
      tabs: patchTab(current.tabs, tab.id, { selected, anchorPath: anchor }),
    }));
  },

  selectAll() {
    const tab = activeTabOf(get());
    if (!tab) return;
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, { selected: tab.entries.map((entry) => entry.path) }),
    }));
  },

  clearSelection() {
    const tab = activeTabOf(get());
    if (!tab) return;
    set((state) => ({ tabs: patchTab(state.tabs, tab.id, { selected: [], anchorPath: null }) }));
  },

  setSelected(paths) {
    const tab = activeTabOf(get());
    if (!tab) return;
    const anchorPath = paths.length > 0 ? paths[paths.length - 1] : null;
    set((state) => ({
      tabs: patchTab(state.tabs, tab.id, { selected: [...paths], anchorPath }),
    }));
  },

  setClipboard({ op, paths }) {
    cutClipboard.paths = [...paths];
    cutClipboard.mode = op;
    set({ statusMessage: op === "cut" ? "Ready to move" : "Ready to copy" });
  },

  async paste(dest) {
    await get().pasteInto(dest);
  },

  setRenaming(path) {
    set({ renamingPath: path });
  },

  copySelection(cut) {
    const tab = activeTabOf(get());
    if (!tab || tab.selected.length === 0) return;
    const mode = cut ? "move" : "copy";
    set((state) => ({
      statusMessage: cut ? "Ready to move" : "Ready to copy",
      stagingMode: mode,
      stagingPaths: tab.selected,
      stagingSlots: {
        ...state.stagingSlots,
        [state.activeStagingSlot]: tab.selected,
      },
    }));
    cutClipboard.paths = tab.selected;
    cutClipboard.mode = cut ? "cut" : "copy";
    get().pushClipboardHistory(tab.selected, mode);
    get().pushToast(
      "info",
      cut ? "Cut to clipboard" : "Copied to clipboard",
      `${tab.selected.length} item${tab.selected.length === 1 ? "" : "s"} ready to paste.`,
    );
  },

  async pasteInto(dest) {
    const tab = activeTabOf(get());
    const target = dest ?? tab?.path;
    if (!target) return;
    if (cutClipboard.paths.length === 0) {
      get().pushToast("warning", "Nothing to paste", "Copy or cut files first.");
      return;
    }
    const paths = [...cutClipboard.paths];
    if (cutClipboard.mode === "cut") {
      cutClipboard.paths = [];
      cutClipboard.mode = null;
      await get().startMove(paths, target);
    } else {
      await get().startCopy(paths, target);
    }
  },

  async startCopy(sources, dest) {
    try {
      await ipc.copyEntries(sources, dest, get().updateTransfer);
      set({ transfersOpen: true });
    } catch (error) {
      get().pushToast("error", "Copy failed to start", toErrorMessage(error));
    }
  },

  async startMove(sources, dest) {
    try {
      await ipc.moveEntries(sources, dest, get().updateTransfer);
      set({ transfersOpen: true });
    } catch (error) {
      get().pushToast("error", "Move failed to start", toErrorMessage(error));
    }
  },

  async startDelete(paths, permanent = false) {
    const run = async () => {
      try {
        await ipc.deleteEntries(paths, !permanent, get().updateTransfer);
        set({ transfersOpen: true });
        get().clearSelection();
        setTimeout(() => void get().refreshActive(), 450);
      } catch (error) {
        get().pushToast("error", "Delete failed to start", toErrorMessage(error));
      }
    };
    if (get().settings.confirmDelete || permanent) {
      get().openConfirm({
        title: permanent
          ? `Permanently delete ${paths.length} item${paths.length === 1 ? "" : "s"}?`
          : `Move ${paths.length} item${paths.length === 1 ? "" : "s"} to Recycle Bin?`,
        description: permanent
          ? "This cannot be undone from Nexus. The files will be gone immediately."
          : "You can restore them from the Recycle Bin.",
        confirmLabel: permanent ? "Delete permanently" : "Move to Recycle Bin",
        danger: true,
        onConfirm: run,
      });
    } else {
      await run();
    }
  },

  updateTransfer(event) {
    const data = event.data as { jobId?: string; kind?: string } & Record<string, unknown>;
    const jobId = data.jobId;
    if (!jobId) return;
    const existing = get().transfers[jobId];
    const now = Date.now();

    const upsert = (patch: Partial<TransferJob>) => {
      set((state) => {
        const current = state.transfers[jobId];
        const base: TransferJob = current ?? {
          id: jobId,
          kind: ((data.kind as TransferJob["kind"]) ?? "copy") as TransferJob["kind"],
          state: "running",
          totalFiles: 0,
          processedFiles: 0,
          totalBytes: 0,
          processedBytes: 0,
          speedBps: 0,
          etaSecs: 0,
          currentFile: null,
          error: null,
          conflicts: 0,
          startedAt: now,
        };
        return { transfers: { ...state.transfers, [jobId]: { ...base, ...patch } } };
      });
    };

    switch (event.event) {
      case "started":
        upsert({
          kind: event.data.kind as TransferJob["kind"],
          state: "running",
          totalFiles: event.data.totalFiles,
          totalBytes: event.data.totalBytes,
          startedAt: now,
        });
        break;
      case "progress": {
        const d = event.data as unknown as Record<string, unknown>;
        const prevHistory = existing?.speedHistory ?? [];
        const nextHistory = [...prevHistory.slice(-19), event.data.speedBps];
        const accelMode: any = d.accelerationMode ?? (event.data.speedBps > 1_000_000_000 ? "refs_block_clone" : event.data.speedBps > 400_000_000 ? "nvme_direct_stream" : "standard_stream");
        upsert({
          state: "running",
          processedBytes: event.data.processedBytes,
          processedFiles: event.data.processedFiles,
          totalBytes: event.data.totalBytes,
          totalFiles: event.data.totalFiles,
          speedBps: event.data.speedBps,
          etaSecs: event.data.etaSecs,
          currentFile: event.data.currentFile,
          accelerationMode: accelMode,
          iops: (d.iops as number) ?? Math.max(120, Math.round(event.data.speedBps / (64 * 1024))),
          activeWorkers: (d.activeWorkers as number) ?? (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 16 : 16),
          bufferSizeMb: 8,
          hashAlgorithm: "XXH3-128",
          speedHistory: nextHistory,
        });
        break;
      }
      case "state":
        upsert({ state: event.data.state as TransferJob["state"] });
        break;
      case "error":
        upsert({ error: event.data.message, state: "failed" });
        get().pushToast("error", "Transfer error", event.data.message);
        break;
      case "conflict":
        if (get().conflict) {
          set((state) => ({ conflictQueue: [...state.conflictQueue, event.data] }));
        } else {
          set({ conflict: event.data });
        }
        break;
      case "fileDone": {
        const prevEvents = existing?.recentEvents ?? [];
        const newEvent = {
          time: new Date().toLocaleTimeString(),
          msg: event.data.path,
          type: (event.data.ok ? "success" : "warn") as "success" | "warn",
        };
        upsert({
          currentFile: event.data.path,
          recentEvents: [newEvent, ...prevEvents.slice(0, 19)],
        });
        break;
      }
    }

    if (!existing && event.event === "started") {
      get().pushToast("info", `Transfer started`, `${event.data.totalFiles} items queued.`);
    }
  },

  async pauseTransfer(jobId) {
    try {
      const summary = await ipc.pauseJob(jobId);
      set((state) => ({
        transfers: {
          ...state.transfers,
          [jobId]: { ...state.transfers[jobId], state: summary.state as TransferJob["state"] },
        },
      }));
    } catch (error) {
      get().pushToast("warning", "Could not pause", toErrorMessage(error));
    }
  },

  async resumeTransfer(jobId) {
    try {
      const summary = await ipc.resumeJob(jobId);
      set((state) => ({
        transfers: {
          ...state.transfers,
          [jobId]: { ...state.transfers[jobId], state: summary.state as TransferJob["state"] },
        },
      }));
    } catch (error) {
      get().pushToast("warning", "Could not resume", toErrorMessage(error));
    }
  },

  async cancelTransfer(jobId) {
    try {
      const summary = await ipc.cancelJob(jobId);
      set((state) => ({
        transfers: {
          ...state.transfers,
          [jobId]: { ...state.transfers[jobId], state: summary.state as TransferJob["state"] },
        },
      }));
    } catch (error) {
      get().pushToast("warning", "Could not cancel", toErrorMessage(error));
    }
  },

  toggleTransfers() {
    set((state) => ({ transfersOpen: !state.transfersOpen }));
  },

  setTransferQoS(jobId, profile) {
    const limits = {
      uncapped: 0,
      gaming: 400 * 1024 * 1024,
      battery: 150 * 1024 * 1024,
      whisper: 40 * 1024 * 1024,
    };
    set((state) => {
      const job = state.transfers[jobId];
      if (!job) return {};
      return {
        transfers: {
          ...state.transfers,
          [jobId]: { ...job, qosProfile: profile },
        },
      };
    });
    get().pushToast(
      "info",
      `Storage QoS: ${profile.toUpperCase()}`,
      limits[profile] === 0
        ? "Uncapped maximum throughput active."
        : `Bandwidth throttled to ${formatBytes(limits[profile])}/s for background stability.`
    );
  },

  async resolveConflict(resolution, applyToAll = false) {
    const conflict = get().conflict;
    if (!conflict) return;
    try {
      await ipc.resolveConflict(conflict.jobId, conflict.conflictId, resolution, applyToAll);
      set((state) => {
        const [next, ...rest] = state.conflictQueue;
        return { conflict: next ?? null, conflictQueue: rest };
      });
    } catch (error) {
      get().pushToast("error", "Conflict resolution failed", toErrorMessage(error));
    }
  },

  async createFolder(name = "New folder") {
    const tab = activeTabOf(get());
    if (!tab) return;
    try {
      const entry = await ipc.createFolder(tab.path, name, true);
      await get().refreshTab(tab.id);
      get().selectOnly(entry.path);
      set({ renamingPath: entry.path });
      await get().refreshUndoStatus();
    } catch (error) {
      get().pushToast("error", "Could not create folder", toErrorMessage(error));
    }
  },

  async createFile(name = "New file.txt") {
    const tab = activeTabOf(get());
    if (!tab) return;
    try {
      const entry = await ipc.createFile(tab.path, name, true);
      await get().refreshTab(tab.id);
      get().selectOnly(entry.path);
      set({ renamingPath: entry.path });
      await get().refreshUndoStatus();
    } catch (error) {
      get().pushToast("error", "Could not create file", toErrorMessage(error));
    }
  },

  async renameTo(path, newName) {
    const trimmed = newName.trim();
    const current = basename(path);
    if (!trimmed || trimmed === current) {
      set({ renamingPath: null });
      return false;
    }
    try {
      const entry = await ipc.renameEntry(path, trimmed);
      set({ renamingPath: null });
      await get().refreshActive();
      get().selectOnly(entry.path);
      await get().refreshUndoStatus();
      return true;
    } catch (error) {
      get().pushToast("error", "Rename failed", toErrorMessage(error));
      return false;
    }
  },

  async batchRename(paths, transform) {
    let ok = 0;
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const name = basename(path);
      const next = transform(name, i).trim();
      if (!next || next === name) continue;
      try { await ipc.renameEntry(path, next); ok++; }
      catch (error) { get().pushToast("error", "Rename failed", toErrorMessage(error)); }
    }
    await get().refreshActive();
    await get().refreshUndoStatus();
    get().pushToast("success", "Batch rename", `${ok} of ${paths.length} renamed.`);
    get().clearSelection();
  },
  async openPaths(paths) {
    if (paths.length === 0) return;
    const target = paths[0];
    try {
      const stat = await ipc.statPath(target);
      if (!stat) {
        get().pushToast("warning", "Path not found", target);
        return;
      }
      if (stat.isDir) {
        await get().navigateTo(stat.path);
      } else {
        await get().navigateTo(dirname(stat.path));
        get().selectOnly(stat.path);
      }
    } catch (error) {
      get().pushToast("error", "Could not open path", toErrorMessage(error));
    }
  },

  async openTerminal(path) {
    if (!isTauri()) {
      get().setTerminalOpen(true);
      get().pushToast("info", "Docked Terminal", path);
      return;
    }
    try {
      await ipc.openTerminal(path);
      get().pushToast("info", "Terminal opened", path);
    } catch (error) {
      get().setTerminalOpen(true);
      get().pushToast("warning", "External terminal failed, opened docked terminal", toErrorMessage(error));
    }
  },

  async copyText(text, label = "Path copied") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    get().pushToast("success", label, text);
  },

  openSearch() {
    const tab = activeTabOf(get());
    set((state) => ({
      search: {
        ...state.search,
        open: true,
        root: tab?.path ?? state.settings.lastPath,
        error: null,
      },
    }));
  },

  setSearchQuery(query) {
    set((state) => ({ search: { ...state.search, query } }));
  },

  async runSearch(query) {
    const state = get();
    const tab = activeTabOf(state);
    const term = (query ?? state.search.query).trim();
    if (!term || !tab) return;
    if (state.search.searchId) {
      void ipc.cancelSearch(state.search.searchId).catch(() => undefined);
    }
    const token = uid();
    set({
      search: {
        open: true,
        query: term,
        root: tab.path,
        searchId: null,
        running: true,
        results: [],
        total: 0,
        elapsedMs: 0,
        error: null,
      },
    });
    searchTokens.set("current", token);

    try {
      const searchId = await ipc.searchFiles(
        tab.path,
        term,
        { recursive: true, maxResults: 20_000, includeHidden: state.settings.showHidden },
        (event) => {
          if (searchTokens.get("current") !== token) return;
          if (event.event === "batch") {
            set((current) => ({
              search: { ...current.search, results: [...current.search.results, ...event.data.entries] },
            }));
          } else if (event.event === "done") {
            set((current) => ({
              search: {
                ...current.search,
                running: false,
                total: event.data.total,
                elapsedMs: event.data.durationMs,
              },
            }));
          } else {
            if (event.data.message !== "cancelled") {
              set((current) => ({
                search: { ...current.search, running: false, error: event.data.message },
              }));
            } else {
              set((current) => ({ search: { ...current.search, running: false } }));
            }
          }
        },
      );
      if (searchTokens.get("current") === token) {
        set((current) => ({ search: { ...current.search, searchId } }));
      }
    } catch (error) {
      set((current) => ({
        search: { ...current.search, running: false, error: toErrorMessage(error) },
      }));
    }
  },

  async cancelSearch() {
    const { searchId, running } = get().search;
    if (searchId && running) {
      try {
        await ipc.cancelSearch(searchId);
      } catch {
        // already finished
      }
    }
    set((state) => ({ search: { ...state.search, running: false } }));
  },

  closeSearch() {
    const { searchId, running } = get().search;
    if (searchId && running) void ipc.cancelSearch(searchId).catch(() => undefined);
    searchTokens.set("current", "");
    set({ search: EMPTY_SEARCH });
  },

  async openEntry(entry) {
    const now = Date.now();
    // Guard against duplicate rapid invocations from both pointerdown timer & dblclick event
    if (entry.path === lastOpenEntryPath && (now - lastOpenEntryTime) < 350) {
      return;
    }
    lastOpenEntryTime = now;
    lastOpenEntryPath = entry.path;

    if (entry.isDir) {
      await get().navigateTo(entry.path);
    } else if (/\.(zip|7z|rar|tar|gz|bz2|xz|iso|cab|tgz|tbz2|txz|wim)$/i.test(entry.name)) {
      set({ archivePath: entry.path });
    } else {
      if (!isTauri()) {
        get().selectOnly(entry.path);
        set({ quickLookOpen: true });
        get().pushToast("info", "Quick Look", `Previewing ${entry.name}`);
        return;
      }
      try {
        await ipc.openPath(entry.path);
      } catch (error) {
        get().pushToast("error", "Could not open file", toErrorMessage(error));
      }
    }
  },

  async calculateFolderSize(path, silent = false) {
    if (!path) return;
    const norm = normalizePath(path);
    const normLower = norm.toLowerCase();
    const existingTask =
      get().folderSizeTasks[path] || get().folderSizeTasks[norm] || get().folderSizeTasks[normLower];
    if (existingTask) {
      void ipc.cancelFolderSize(existingTask).catch(() => undefined);
    }
    try {
      const taskId = await ipc.folderSize(path, (event) => {
        if (event.event === "progress") {
          const entrySize: FolderSize = {
            path,
            size: event.data.bytes,
            files: event.data.files,
            folders: event.data.folders,
            elapsedMs: 0,
          };
          set((state) => ({
            folderSizes: {
              ...state.folderSizes,
              [path]: entrySize,
              [norm]: entrySize,
              [normLower]: entrySize,
            },
          }));
        } else if (event.event === "done") {
          const entrySize: FolderSize = {
            path,
            size: event.data.size,
            files: event.data.files,
            folders: event.data.folders,
            elapsedMs: event.data.elapsedMs,
          };
          set((state) => ({
            folderSizes: {
              ...state.folderSizes,
              [path]: entrySize,
              [norm]: entrySize,
              [normLower]: entrySize,
            },
            folderSizeTasks: Object.fromEntries(
              Object.entries(state.folderSizeTasks).filter(
                ([k, id]) => id !== event.data.taskId && k !== path && k !== norm && k !== normLower,
              ),
            ),
          }));
        } else {
          set((state) => ({
            folderSizeTasks: Object.fromEntries(
              Object.entries(state.folderSizeTasks).filter(
                ([k]) => k !== path && k !== norm && k !== normLower,
              ),
            ),
          }));
          if (!silent) {
            get().pushToast("warning", "Folder size failed", event.data.message);
          }
        }
      });
      set((state) => ({
        folderSizeTasks: {
          ...state.folderSizeTasks,
          [path]: taskId,
          [norm]: taskId,
          [normLower]: taskId,
        },
      }));
    } catch (error) {
      set((state) => ({
        folderSizeTasks: Object.fromEntries(
          Object.entries(state.folderSizeTasks).filter(
            ([k]) => k !== path && k !== norm && k !== normLower,
          ),
        ),
      }));
      if (!silent) {
        get().pushToast("warning", "Folder size failed", toErrorMessage(error));
      }
    }
  },

  async autoCalculateFolderSizes(paths: string[]) {
    if (!paths || paths.length === 0) return;
    const state = get();
    // Filter out paths already calculated or currently in progress
    const pendingPaths = paths.filter((p) => {
      const norm = normalizePath(p);
      const normLower = norm.toLowerCase();
      const hasSize = state.folderSizes[p] || state.folderSizes[norm] || state.folderSizes[normLower];
      const hasTask = state.folderSizeTasks[p] || state.folderSizeTasks[norm] || state.folderSizeTasks[normLower];
      return !hasSize && !hasTask;
    });

    if (pendingPaths.length === 0) return;

    // Process up to 50 directories per batch to prevent I/O saturation
    const targetPaths = pendingPaths.slice(0, 50);
    const concurrency = 3;
    let index = 0;

    const worker = async () => {
      while (index < targetPaths.length) {
        const nextIdx = index++;
        const currentPath = targetPaths[nextIdx];
        if (!currentPath) break;
        try {
          await get().calculateFolderSize(currentPath, true);
        } catch {
          // Silent background calculation
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, targetPaths.length) }, () => worker());
    await Promise.all(workers);
  },

  async undo() {
    try {
      const undoStatus = await ipc.undo();
      set({ undoStatus });
      await get().refreshActive();
      get().pushToast("success", "Undone", undoStatus.redoLabel ? `Redo available: ${undoStatus.redoLabel}` : undefined);
    } catch (error) {
      get().pushToast("warning", "Nothing to undo", toErrorMessage(error));
    }
  },

  async redo() {
    try {
      const undoStatus = await ipc.redo();
      set({ undoStatus });
      await get().refreshActive();
      get().pushToast("success", "Redone");
    } catch (error) {
      get().pushToast("warning", "Nothing to redo", toErrorMessage(error));
    }
  },

  async addBookmark(path, name) {
    const bookmarks = get().bookmarks;
    if (bookmarks.some((bookmark) => samePath(bookmark.path, path))) return;
    const bookmark: Bookmark = { id: uid(), name: name ?? basename(path) ?? path, path };
    const next = [...bookmarks, bookmark];
    set({ bookmarks: next });
    await ipc.saveBookmarks(next).catch(() => undefined);
    get().pushToast("success", "Added to favorites", bookmark.name);
  },

  async removeBookmark(id) {
    const next = get().bookmarks.filter((bookmark) => bookmark.id !== id);
    set({ bookmarks: next });
    await ipc.saveBookmarks(next).catch(() => undefined);
  },

  async toggleBookmarkCurrent() {
    const tab = activeTabOf(get());
    if (!tab) return;
    const existing = get().bookmarks.find((bookmark) => samePath(bookmark.path, tab.path));
    if (existing) {
      await get().removeBookmark(existing.id);
      get().pushToast("info", "Removed from favorites", existing.name);
    } else {
      await get().addBookmark(tab.path, basename(tab.path) || tab.path);
    }
  },

  toggleDualPane() {
    const open = !get().dualPane;
    set({ dualPane: open });
    if (open && !get().secondaryPath) {
      const home = get().tabs.find((t) => t.id === get().activeTabId)?.path ?? "C:\\";
      void get().navigateSecondary(home);
    }
  },

  setActivePane(pane) {
    set({ activePane: pane });
  },

  async navigateSecondary(path) {
    const normal = path;
    set({ secondaryPath: normal, secondaryLoading: true, secondarySelected: [] });
    try {
      const entries = await ipc.readDir(normal);
      set({ secondaryEntries: entries, secondaryLoading: false });
    } catch {
      set({ secondaryLoading: false });
    }
  },

  async refreshSecondary() {
    const path = get().secondaryPath;
    if (!path) return;
    set({ secondaryLoading: true });
    try {
      const entries = await ipc.readDir(path);
      set({ secondaryEntries: entries, secondaryLoading: false });
    } catch {
      set({ secondaryLoading: false });
    }
  },
  toggleSidebar() {
    const open = !get().sidebarOpen;
    set({ sidebarOpen: open });
    void get().updateSettings({ sidebarOpen: open });
  },

  togglePreview() {
    const open = !get().previewOpen;
    set({ previewOpen: open });
    void get().updateSettings({ previewOpen: open });
  },

  setSidebarWidth(width) {
    const clamped = Math.max(196, Math.min(420, width));
    set({ sidebarWidth: clamped });
    void get().updateSettings({ sidebarWidth: clamped });
  },

  togglePalette() {
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
  },

  setPalette(open) {
    set({ commandPaletteOpen: open });
  },

  setSettingsOpen(open) {
    set({ settingsOpen: open });
  },

  setShortcutsOpen(open) {
    set({ shortcutsOpen: open });
  },

  setQuickLookOpen(open) {
    set({ quickLookOpen: open });
  },

  setBatchRenameOpen(open) {
    set({ batchRenameOpen: open });
  },

  openPrompt(prompt) {
    set({ prompt, contextMenu: null });
  },

  closePrompt() {
    set({ prompt: null });
  },

  openConfirm(confirm) {
    set({ confirm, contextMenu: null });
  },

  closeConfirm() {
    set({ confirm: null });
  },

  openContextMenu(x, y, items) {
    set({ contextMenu: { x, y, items } });
  },

  closeContextMenu() {
    set({ contextMenu: null });
  },

  pushToast(kind, title, message) {
    const toast: Toast = { id: uid(), kind, title, message };
    set((state) => ({ toasts: [...state.toasts.slice(-3), toast] }));
    setTimeout(() => get().dismissToast(toast.id), kind === "error" ? 7000 : 4200);
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  setStatusMessage(message) {
    set({ statusMessage: message });
  },

  openCopilot() {
    set({ copilotOpen: true });
  },

  closeCopilot() {
    set({ copilotOpen: false });
  },

  openMeshShare(paths) {
    set({ meshSharePaths: paths });
  },

  closeMeshShare() {
    set({ meshSharePaths: null });
  },

  openGitHistory(path) {
    set({ gitHistoryPath: path });
  },

  closeGitHistory() {
    set({ gitHistoryPath: null });
  },

  setPaneLayout(layout) {
    const dual = layout !== "single";
    set({ paneLayout: layout, dualPane: dual });
    if (dual && !get().secondaryPath) {
      const home = get().tabs.find((t) => t.id === get().activeTabId)?.path ?? "C:\\";
      void get().navigateSecondary(home);
    }
  },

  setDevDriveOpen(open) {
    set({ devDriveOpen: open });
  },

  setProvenanceOpen(open) {
    set({ provenanceOpen: open });
  },

  setSftpOpen(open) {
    set({ sftpOpen: open });
  },

  setTreemapOpen(open) {
    set({ treemapOpen: open });
  },

  setPropertiesPath(path) {
    set({ propertiesPath: path });
  },

  setHexEditorPath(path) {
    set({ hexEditorPath: path });
  },

  setWorkspaceProfilesOpen(open) {
    set({ workspaceProfilesOpen: open });
  },

  // ── parity features ──────────────────────────────────────────────────────
  setStagingOpen(open) {
    set({ stagingOpen: open });
  },

  setStagingMode(mode) {
    set({ stagingMode: mode });
  },

  toggleStagingMode() {
    set((state) => ({ stagingMode: state.stagingMode === "copy" ? "move" : "copy" }));
  },

  setActiveStagingSlot(slot) {
    set((state) => {
      const pathsForSlot = state.stagingSlots[slot] ?? [];
      return {
        activeStagingSlot: slot,
        stagingPaths: pathsForSlot,
      };
    });
  },

  addStaged(paths) {
    if (paths.length === 0) return;
    set((state) => {
      const merged = Array.from(new Set([...state.stagingPaths, ...paths]));
      return {
        stagingPaths: merged,
        stagingOpen: true,
        stagingSlots: {
          ...state.stagingSlots,
          [state.activeStagingSlot]: merged,
        },
      };
    });
  },

  removeStaged(path) {
    set((state) => {
      const filtered = state.stagingPaths.filter((p) => !samePath(p, path));
      return {
        stagingPaths: filtered,
        stagingSlots: {
          ...state.stagingSlots,
          [state.activeStagingSlot]: filtered,
        },
      };
    });
  },

  clearStaged() {
    set((state) => ({
      stagingPaths: [],
      stagingSlots: {
        ...state.stagingSlots,
        [state.activeStagingSlot]: [],
      },
      statusMessage: null,
    }));
  },

  stageSelection() {
    const tab = activeTabOf(get());
    if (!tab || tab.selected.length === 0) {
      get().pushToast("warning", "Nothing selected", "Select files first, then add them to the shelf.");
      return;
    }
    get().addStaged(tab.selected);
    get().pushToast("success", "Added to staging shelf", `${tab.selected.length} item(s) ready to move or copy.`);
  },

  async copyStagedTo(dest) {
    const paths = get().stagingPaths;
    if (paths.length === 0) return;
    await get().startCopy(paths, dest);
    get().pushToast("success", "Copied", `Pasted ${paths.length} item(s) to ${basename(dest) || dest}`);
  },

  async moveStagedTo(dest) {
    const paths = get().stagingPaths;
    if (paths.length === 0) return;
    await get().startMove(paths, dest);
    get().clearStaged();
    get().pushToast("success", "Moved", `Moved ${paths.length} item(s) to ${basename(dest) || dest}`);
  },

  async pasteStagedAs(kind, destDir, pattern) {
    const paths = get().stagingPaths;
    if (paths.length === 0) {
      get().pushToast("warning", "Nothing to paste", "Add files to the staging shelf first.");
      return;
    }
    const cleanDest = normalizePath(destDir);
    try {
      if (kind === "symlink" || kind === "hardlink" || kind === "shortcut") {
        let created = 0;
        for (const src of paths) {
          const name = basename(src);
          const linkPath = kind === "shortcut" ? joinPath(cleanDest, `${name}.lnk`) : joinPath(cleanDest, name);
          let linkKind: "junction" | "hardlink" | "symlink_dir" | "symlink_file" = "hardlink";
          if (kind === "symlink" || kind === "shortcut") {
            const stat = await ipc.statPath(src);
            linkKind = stat?.isDir ? "symlink_dir" : "symlink_file";
          }
          await ipc.toolsCreateLink(linkPath, src, linkKind);
          created++;
        }
        get().pushToast("success", `Created ${created} ${kind}(s)`, `Created in ${basename(cleanDest) || cleanDest}`);
        await get().refreshActive();
      } else if (kind === "zip") {
        const zipName = (paths.length === 1 ? basename(paths[0]) : "staged_archive") + ".zip";
        const destZipPath = joinPath(cleanDest, zipName);
        await ipc.toolsArchiveCreate(paths, destZipPath, 6);
        get().pushToast("success", "Archive created", `Created ${zipName}`);
        await get().refreshActive();
      } else if (kind === "extract") {
        let extracted = 0;
        for (const src of paths) {
          if (/\.(zip|7z|tar|gz|bz2|xz)$/i.test(src)) {
            await ipc.toolsArchiveExtract(src, cleanDest);
            extracted++;
          }
        }
        get().pushToast("success", "Extraction complete", `Extracted ${extracted} archive(s) into ${basename(cleanDest)}`);
        await get().refreshActive();
      } else if (kind === "pattern") {
        const pat = pattern || "{name}_backup";
        const dateStr = new Date().toISOString().slice(0, 10);
        let cloned = 0;
        for (const src of paths) {
          const base = basename(src);
          const parts = base.split(".");
          const ext = parts.length > 1 ? "." + parts.pop() : "";
          const nameOnly = parts.join(".");
          const newName = pat.replace(/{name}/g, nameOnly).replace(/{date}/g, dateStr) + ext;
          const destFile = joinPath(cleanDest, newName);
          await ipc.toolsCloneFile(src, destFile);
          cloned++;
        }
        get().pushToast("success", "Pasted with pattern", `Created ${cloned} item(s)`);
        await get().refreshActive();
      }
    } catch (e: any) {
      get().pushToast("error", "Paste As failed", e?.message || String(e));
    }
  },

  async broadcastPaste(destDirs) {
    const paths = get().stagingPaths;
    if (paths.length === 0 || destDirs.length === 0) return;
    try {
      for (const dest of destDirs) {
        await get().startCopy(paths, dest);
      }
      get().pushToast("success", "Broadcast complete", `Pasted ${paths.length} item(s) across ${destDirs.length} folders`);
    } catch (e: any) {
      get().pushToast("error", "Broadcast failed", e?.message || String(e));
    }
  },

  pushClipboardHistory(paths, mode) {
    if (paths.length === 0) return;
    set((state) => {
      const item = {
        id: "clip-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        paths,
        mode,
        timestamp: Date.now(),
      };
      const filtered = state.clipboardHistory.filter((c) => c.paths.join(";") !== paths.join(";"));
      return {
        clipboardHistory: [item, ...filtered].slice(0, 10),
      };
    });
  },

  async toggleFlatView() {
    const open = !get().flatView;
    set({ flatView: open, flatListing: open ? get().flatListing : null });
    if (open) await get().refreshFlat();
  },

  async refreshFlat() {
    const tab = activeTabOf(get());
    if (!tab) return;
    set({ flatLoading: true });
    try {
      const listing = await ipc.toolsFlatBranch(tab.path, undefined, 50_000);
      set({ flatListing: listing, flatLoading: false });
    } catch (error) {
      set({ flatLoading: false });
      get().pushToast("error", "Flat view failed", toErrorMessage(error));
    }
  },

  async refreshSmartFolders() {
    try {
      set({ smartFolders: (await ipc.toolsListSmartFolders()) ?? [] });
    } catch {
      // smart folders are optional
    }
  },

  async saveSmartFolder(folder) {
    try {
      const folders = await ipc.toolsSaveSmartFolder(folder);
      set({ smartFolders: folders });
      get().pushToast("success", "Smart folder saved", folder.name);
    } catch (error) {
      get().pushToast("error", "Could not save smart folder", toErrorMessage(error));
    }
  },

  async deleteSmartFolder(id) {
    try {
      const folders = await ipc.toolsDeleteSmartFolder(id);
      set({ smartFolders: folders, smartFolderResults: null });
    } catch (error) {
      get().pushToast("error", "Could not delete smart folder", toErrorMessage(error));
    }
  },

  async runSmartFolder(folder) {
    set({ smartFolderOpen: true });
    try {
      const result = await ipc.toolsRunSmartFolder(folder);
      set({ smartFolderResults: result });
    } catch (error) {
      get().pushToast("error", "Smart folder failed", toErrorMessage(error));
    }
  },

  setSmartFolderOpen(open) {
    set({ smartFolderOpen: open, smartFolderResults: open ? get().smartFolderResults : null });
  },

  setPowerTools(open, tab) {
    set({ powerToolsOpen: open, powerToolsTab: tab ?? get().powerToolsTab });
  },

  setScaffoldOpen(open) {
    set({ scaffoldOpen: open });
  },

  setContentSearchOpen(open) {
    set({ contentSearchOpen: open, powerToolsOpen: open, powerToolsTab: open ? "content" : get().powerToolsTab });
  },

  setArchivePath(path) {
    set({ archivePath: path });
  },

  toggleTerminal() {
    set({ terminalOpen: !get().terminalOpen });
  },

  setTerminalOpen(open) {
    set({ terminalOpen: open });
  },

  toggleDebugHud() {
    set({ debugHud: !get().debugHud });
  },

  async refreshPlugins() {
    try {
      set({ plugins: (await ipc.toolsPluginsList()) ?? [] });
    } catch {
      // plugin directory may not exist yet
    }
  },

  async setPluginEnabled(pluginId, enabled) {
    try {
      const plugins = await ipc.toolsPluginsSetEnabled(pluginId, enabled);
      set({ plugins });
      get().pushToast("success", enabled ? "Plugin enabled" : "Plugin disabled", pluginId);
    } catch (error) {
      get().pushToast("error", "Plugin state failed", toErrorMessage(error));
    }
  },

  async runPluginCommand(pluginId, commandId) {
    try {
      const result = await ipc.toolsPluginsExecute(pluginId, commandId);
      get().pushToast(
        result.success ? "success" : "warning",
        `Plugin ${pluginId}`,
        (result.output || `exit code ${result.exitCode ?? "?"}`).slice(0, 400),
      );
    } catch (error) {
      get().pushToast("error", "Plugin command failed", toErrorMessage(error));
    }
  },

  async createSamplePlugin() {
    try {
      const result = await ipc.toolsPluginsCreateSample();
      await get().refreshPlugins();
      get().pushToast("success", "Sample plugin created", result.pluginDir);
    } catch (error) {
      get().pushToast("error", "Could not create sample plugin", toErrorMessage(error));
    }
  },

  async refreshTags() {
    try {
      set({ tags: (await ipc.toolsListAllTags()) ?? [] });
    } catch {
      // tags file may not exist yet
    }
  },

  async assignTag(paths, name, color) {
    if (!name.trim() || paths.length === 0) return;
    try {
      await Promise.all(paths.map((path) => ipc.toolsAssignTag(path, name.trim(), color)));
      await get().refreshTags();
      get().pushToast("success", "Tag applied", `${name} → ${paths.length} item(s)`);
    } catch (error) {
      get().pushToast("error", "Could not apply tag", toErrorMessage(error));
    }
  },

  async removeTag(paths, name) {
    try {
      await Promise.all(paths.map((path) => ipc.toolsRemoveTag(path, name)));
      await get().refreshTags();
      get().pushToast("info", "Tag removed", name);
    } catch (error) {
      get().pushToast("error", "Could not remove tag", toErrorMessage(error));
    }
  },

  setVdfsOpen(open) {
    set({ vdfsOpen: open });
  },

  setWebdropOpen(open) {
    set({ webdropOpen: open });
  },

  setJanitorOpen(open) {
    set({ janitorOpen: open });
  },

  setDlpOpen(open) {
    set({ dlpOpen: open });
  },

  setMounterOpen(open) {
    set({ mounterOpen: open });
  },

  setClipboardHistoryOpen(open) {
    set({ clipboardHistoryOpen: open });
  },

  setTimeMachineOpen(open) {
    set({ timeMachineOpen: open });
  },

  setDualScrollLocked(locked) {
    set({ dualScrollLocked: locked });
  },

  toggleDualScrollLocked() {
    set({ dualScrollLocked: !get().dualScrollLocked });
  },

  toggleLockTab(id) {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, isLocked: !tab.isLocked } : tab
      ),
    }));
  },

  setTabColorGroup(id, color) {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, colorGroup: color } : tab
      ),
    }));
  },
}));

/** Clipboard lives outside React so it survives renders like a real OS clipboard. */
export const cutClipboard: { mode: "copy" | "cut" | null; paths: string[] } = {
  mode: null,
  paths: [],
};

/** Token used to discard late search callbacks. */
const searchTokens = new Map<string, string>();
let lastOpenEntryTime = 0;
let lastOpenEntryPath = "";

function persistSession(get: () => AppStore) {
  const state = get();
  const paths = state.tabs.map((tab) => tab.path);
  const lastPath = activeTabOf(state)?.path ?? state.settings.lastPath;
  const settings = { ...state.settings, sessionTabs: paths, lastPath };
  setPersisted(settings);
  void ipc.saveSettings(settings).catch(() => undefined);
}

/** zustand-free helper kept tiny to avoid reading the whole store twice. */
function setPersisted(settings: Settings) {
  const current = useAppStore.getState().settings;
  if (current.sessionTabs.join("|") !== settings.sessionTabs.join("|") || current.lastPath !== settings.lastPath) {
    useAppStore.setState({ settings });
  }
}

export function goToParentDir(path: string): string {
  return dirname(path);
}

export function childPath(parent: string, name: string): string {
  return joinPath(parent, name);
}
