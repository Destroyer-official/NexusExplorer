import { describe, it, expect, vi } from "vitest";
import { tagColor, entryMenu, backgroundMenu } from "./menus";

// Create a mock store state
function createMockStore() {
  return {
    tabs: [
      {
        id: "tab1",
        path: "C:\\projects",
        history: ["C:\\projects"],
        historyIndex: 0,
        entries: [
          {
            name: "test.zip",
            path: "C:\\projects\\test.zip",
            parent: "C:\\projects",
            isDir: false,
            size: 1024,
            createdMs: 1000,
            modifiedMs: 2000,
            accessedMs: 2000,
            isReadonly: false,
            isHidden: false,
            isSystem: false,
            isArchive: true,
            isSymlink: false,
            ext: "zip",
            kind: "archive",
          },
          {
            name: "secret.nxvault",
            path: "C:\\projects\\secret.nxvault",
            parent: "C:\\projects",
            isDir: false,
            size: 2048,
            createdMs: 1000,
            modifiedMs: 2000,
            accessedMs: 2000,
            isReadonly: false,
            isHidden: false,
            isSystem: false,
            isArchive: false,
            isSymlink: false,
            ext: "nxvault",
            kind: "file",
          },
        ],
        selected: [],
        lastSelected: null,
        sortKey: "name",
        sortDesc: false,
        viewMode: "details",
        loading: false,
        error: null,
      },
    ],
    activeTabId: "tab1",
    settings: { showHidden: false, showSystem: false },
    openEntry: vi.fn(),
    openTab: vi.fn(),
    openTerminal: vi.fn(),
    copySelection: vi.fn(),
    pasteInto: vi.fn(),
    setRenaming: vi.fn(),
    setBatchRenameOpen: vi.fn(),
    openConfirm: vi.fn(),
    openPrompt: vi.fn(),
    openGitHistory: vi.fn(),
    openMeshShare: vi.fn(),
    setWebdropOpen: vi.fn(),
    setDlpOpen: vi.fn(),
    setMounterOpen: vi.fn(),
    setClipboardHistoryOpen: vi.fn(),
    openCopilot: vi.fn(),
    startDelete: vi.fn(),
    copyText: vi.fn(),
    addBookmark: vi.fn(),
    addStaged: vi.fn(),
    assignTag: vi.fn(),
    setSmartFolderOpen: vi.fn(),
    setPowerTools: vi.fn(),
    setArchivePath: vi.fn(),
    refreshActive: vi.fn(),
    calculateFolderSize: vi.fn(),
    togglePreview: vi.fn(),
    createFolder: vi.fn(),
    createFile: vi.fn(),
    setDevDriveOpen: vi.fn(),
    setProvenanceOpen: vi.fn(),
    setSftpOpen: vi.fn(),
    setTreemapOpen: vi.fn(),
    setJanitorOpen: vi.fn(),
    setVdfsOpen: vi.fn(),
    setTimeMachineOpen: vi.fn(),
    setScaffoldOpen: vi.fn(),
    toggleFlatView: vi.fn(),
    setTerminalOpen: vi.fn(),
    selectAll: vi.fn(),
    updateSettings: vi.fn(),
    pushToast: vi.fn(),
  } as unknown as Parameters<typeof entryMenu>[1];
}

describe("tagColor helper", () => {
  it("returns stable color for identical tag names", () => {
    const c1 = tagColor("finance");
    const c2 = tagColor("finance");
    const c3 = tagColor("design");
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c3).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("entryMenu", () => {
  it("builds single file menu with essential items", () => {
    const store = createMockStore();
    const menu = entryMenu(["C:\\projects\\app.ts"], store);
    const labels = menu.map((m) => m.label).filter(Boolean);

    expect(labels).toContain("Open");
    expect(labels).toContain("Open in new tab");
    expect(labels).toContain("Open in terminal");
    expect(labels).toContain("Copy");
    expect(labels).toContain("Cut");
    expect(labels).toContain("Rename");
    expect(labels).toContain("Instant CoW Duplicate (Block Clone)");
    expect(labels).toContain("Git: Stage File");
    expect(labels).toContain("Git: View File History & Blame");
    expect(labels).toContain("Previous versions (VSS Snapshots)...");
    expect(labels).toContain("Hash & Copy SHA-256");
    expect(labels).toContain("Verify Hash with Clipboard...");
    expect(labels).toContain("Properties");

    const vssItem = menu.find((m) => m.label === "Previous versions (VSS Snapshots)...");
    expect(vssItem?.action).toBeDefined();
    vssItem?.action?.();
    expect(store.setTimeMachineOpen).toHaveBeenCalledWith(true);
  });

  it("handles multi-selection menu correctly", () => {
    const store = createMockStore();
    const menu = entryMenu(["C:\\projects\\app.ts", "C:\\projects\\main.rs"], store);
    const labels = menu.map((m) => m.label).filter(Boolean);

    expect(labels).toContain("Open 2 items");
    expect(labels).toContain("Delete 2 items");
    expect(labels).toContain("Compare Files (Binary Diff)");
    expect(labels).toContain("New folder with selection (2 items)...");
    expect(labels).toContain("Copy path");
    expect(labels).toContain("Copy filename");

    const newFolderItem = menu.find((m) => m.label === "New folder with selection (2 items)...");
    expect(newFolderItem?.action).toBeDefined();
    newFolderItem?.action?.();
    expect(store.openPrompt).toHaveBeenCalledTimes(1);

    const copyFilenameItem = menu.find((m) => m.label === "Copy filename");
    expect(copyFilenameItem?.action).toBeDefined();
    copyFilenameItem?.action?.();
    expect(store.copyText).toHaveBeenCalledWith("app.ts\nmain.rs", "Name copied");
  });

  it("detects archive files and adds archive actions", () => {
    const store = createMockStore();
    const menu = entryMenu(["C:\\projects\\test.zip"], store);
    const labels = menu.map((m) => m.label).filter(Boolean);

    expect(labels).toContain("Browse archive");
    expect(labels).toContain("Extract here");
    expect(labels).toContain("Inspect Archive Details");
  });

  it("detects .nxvault files and offers decryption", () => {
    const store = createMockStore();
    const menu = entryMenu(["C:\\projects\\secret.nxvault"], store);
    const labels = menu.map((m) => m.label).filter(Boolean);

    expect(labels).toContain("Decrypt Secure Vault...");
  });
});

describe("backgroundMenu", () => {
  it("builds background folder menu with next-gen power tools", () => {
    const store = createMockStore();
    const menu = backgroundMenu("C:\\projects", store);
    const labels = menu.map((m) => m.label).filter(Boolean);

    expect(labels).toContain("New folder");
    expect(labels).toContain("New file");
    expect(labels).toContain("Paste");
    expect(labels).toContain("Refresh");
    expect(labels).toContain("Dev Drive & Storage Acceleration...");
    expect(labels).toContain("Cryptographic Provenance Audit Ledger...");
    expect(labels).toContain("Remote SFTP / SSH Filesystem Explorer...");
    expect(labels).toContain("Disk Space Treemap Analyzer...");
    expect(labels).toContain("Developer Cache & Build Artifact Janitor...");
    expect(labels).toContain("VDFS Distributed Namespace & Storage...");
    expect(labels).toContain("Mobile QR AirDrop (WebDrop Portal)...");
    expect(labels).toContain("Mount Folder / Archive as Virtual Drive...");
    expect(labels).toContain("Visual Time Machine Snapshot Slider...");
    expect(labels).toContain("Smart folders...");
    expect(labels).toContain("Flat branch view");
    expect(labels).toContain("Select by pattern...");
    expect(labels).toContain("Invert selection");
    expect(labels).toContain("Go to folder...");
  });
});

