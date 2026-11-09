import RenameInput from "./RenameInput";
import SecondaryPane from "./SecondaryPane";
import { ipc } from "@/lib/ipc";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PromptDialog from "./PromptDialog";
import ConfirmDialog from "./ConfirmDialog";
import { FaytBar } from "./FaytBar";
import { useAppStore } from "@/state/store";
import { visibleEntries } from "@/lib/entries";
import { useShortcuts } from "@/hooks/useShortcuts";
import Breadcrumbs from "./Breadcrumbs";
import TabSearchModal from "./TabSearchModal";
import CreateArchiveModal from "./CreateArchiveModal";
import GoToFolderModal from "./GoToFolderModal";
import { FileCompareModal } from "./FileCompareModal";
import { FileGrid } from "./FileGrid";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let baseline: ReturnType<typeof useAppStore.getState>;
beforeEach(async () => {
  await useAppStore.getState().boot();
  baseline = useAppStore.getState();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(baseline, true); vi.restoreAllMocks(); });
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("submits the current name once even when submission is repeated while pending", async () => {
  let finish: (() => void) | undefined;
  const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  useAppStore.setState({ prompt: { title: "New folder", label: "Name", value: "Untitled", onConfirm } });
  await act(async () => root.render(<PromptDialog />));
  await type(host.querySelector("input")!, "Audit folder");
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(onConfirm).toHaveBeenCalledExactlyOnceWith("Audit folder");
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  await act(async () => finish?.());
  expect(useAppStore.getState().prompt).toBeNull();
});
it("keeps a failed confirmation open and displays the error", async () => {
  useAppStore.setState({ confirm: { title: "Delete?", onConfirm: async () => { throw new Error("Access denied"); } } });
  await act(async () => root.render(<ConfirmDialog />));
  await act(async () => host.querySelector<HTMLButtonElement>(".btn-primary")!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Access denied");
  expect(useAppStore.getState().confirm).not.toBeNull();
});
it("filters actual visible entries and restores them when dismissed", async () => {
  await act(async () => root.render(<FaytBar />));
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "'" })));
  const state = useAppStore.getState(); const tab = state.tabs.find((item) => item.id === state.activeTabId)!;
  const name = tab.entries[0].name;
  await type(host.querySelector("input")!, name.toUpperCase());
  const filtered = useAppStore.getState();
  expect(visibleEntries(filtered.tabs.find((item) => item.id === filtered.activeTabId)!, filtered.settings).every((entry) => entry.name.toUpperCase().includes(name.toUpperCase()))).toBe(true);
  await act(async () => host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(useAppStore.getState().tabs.find((item) => item.id === state.activeTabId)?.quickFilter).toBe("");
});
it("passes the typed search query to search and preserves a prepared terminal command", async () => {
  const runSearch = vi.fn(async () => undefined);
  useAppStore.setState({ runSearch });
  await act(async () => root.render(<FaytBar />));
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" })));
  await type(host.querySelector("input")!, "invoice");
  await act(async () => host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(runSearch).toHaveBeenCalledExactlyOnceWith("invoice");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: ">" })));
  await type(host.querySelector("input")!, "Get-Location");
  await act(async () => host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(useAppStore.getState().terminalDraft).toBe("Get-Location");
  expect(useAppStore.getState().terminalOpen).toBe(true);
});

it("does not commit a rename twice or commit after Escape", async () => {
  const commit = vi.fn(); const cancel = vi.fn();
  await act(async () => root.render(<RenameInput name="before.txt" onCommit={commit} onCancel={cancel} />));
  await type(host.querySelector("input")!, "after.txt");
  await act(async () => {
    host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    host.querySelector("input")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(commit).toHaveBeenCalledExactlyOnceWith("after.txt");
  await act(async () => root.render(<RenameInput key="second" name="before.txt" onCommit={commit} onCancel={cancel} />));
  await type(host.querySelector("input")!, "cancelled.txt");
  await act(async () => {
    host.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    host.querySelector("input")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("keeps independent split-pane navigation and clipboard selection", async () => {
  const state = useAppStore.getState();
  const initial = state.tabs.find((tab) => tab.id === state.activeTabId)!;
  const folder = initial.entries.find((entry) => entry.isDir)!;
  vi.spyOn(ipc, "readDir").mockImplementation(async (path) => path === initial.path ? [folder] : []);
  const clipboard = vi.fn(); useAppStore.setState({ setClipboard: clipboard });
  await act(async () => root.render(<><SecondaryPane paneId="secondary" /><SecondaryPane paneId="tertiary" /></>));
  const panes = host.querySelectorAll<HTMLElement>(".auxiliary-pane");
  await act(async () => panes[1].querySelector<HTMLElement>(".row")!.click());
  await act(async () => panes[1].dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true })));
  expect(clipboard).toHaveBeenCalledExactlyOnceWith({ op: "copy", paths: [folder.path] });
  await act(async () => panes[1].querySelector<HTMLElement>(".row")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
  expect(panes[0].querySelector(".secondary-toolbar")?.textContent).toContain(initial.path);
  expect(panes[1].querySelector(".secondary-toolbar")?.textContent).toContain(folder.path);
  expect(panes[1].querySelector(".empty-state")?.textContent).toContain("No visible files");
});

it("does not invent transfer hardware telemetry from throughput", () => {
  const store = useAppStore.getState();
  store.updateTransfer({ event: "progress", data: { jobId: "audit-job", processedBytes: 100, processedFiles: 1, totalBytes: 100, totalFiles: 1, speedBps: 2_000_000_000, etaSecs: 0, currentFile: "sample.txt" } });
  const job = useAppStore.getState().transfers["audit-job"];
  expect(job.accelerationMode).toBeUndefined();
  expect(job.iops).toBeUndefined();
  expect(job.activeWorkers).toBeUndefined();
  expect(job.hashAlgorithm).toBeUndefined();
  expect(job.speedBps).toBe(2_000_000_000);
});

it("navigates breadcrumb buttons and cancels address editing without navigation", async () => {
  const { default: Breadcrumbs } = await import("./Breadcrumbs");
  const navigate = vi.fn(async () => {});
  useAppStore.setState({ navigateTo: navigate });
  await act(async () => root.render(<Breadcrumbs />));
  const first = host.querySelector<HTMLButtonElement>(".crumb")!;
  await act(async () => first.click());
  expect(navigate).toHaveBeenCalledExactlyOnceWith(first.title);
  navigate.mockClear();
  await act(async () => window.dispatchEvent(new Event("nexus:focus-address")));
  const input = host.querySelector<HTMLInputElement>("input")!;
  await type(input, "Z:\\missing");
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(navigate).not.toHaveBeenCalled();
});

it("supports adjusting left and right panel widths and shows detailed transfers screen on copy/move", async () => {
  const store = useAppStore.getState();
  store.setSidebarWidth(350);
  expect(useAppStore.getState().sidebarWidth).toBe(350);

  store.setPreviewWidth(420);
  expect(useAppStore.getState().previewWidth).toBe(420);

  // Transfers panel opens automatically so user sees detailed transfer screen
  expect(useAppStore.getState().transfersOpen).toBe(false);
  await act(async () => {
    await store.startCopy(["D:\\code\\Main_projects\\NexusExplorer\\package.json"], "D:\\code");
  });
  expect(useAppStore.getState().transfersOpen).toBe(true);
});

it("duplicates files cleanly when pasting into the same folder without error", async () => {
  const store = useAppStore.getState();
  const tab = store.tabs.find((t) => t.id === store.activeTabId)!;
  const sample = tab.entries[0];
  store.selectOnly(sample.path);
  store.copySelection(false);

  expect(useAppStore.getState().transfersOpen).toBe(false);
  await act(async () => {
    await store.pasteInto(tab.path);
  });
  // Does not force open transfers popup
  expect(useAppStore.getState().transfersOpen).toBe(false);
});

it("synchronizes dual-pane navigation when syncNav is active", async () => {
  const store = useAppStore.getState();
  store.toggleSyncNav();
  expect(useAppStore.getState().syncNav).toBe(true);

  // Set dualPane and initial paths
  useAppStore.setState({
    dualPane: true,
    secondaryPath: "D:\\backup\\src",
  });
  const tab = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  useAppStore.setState({
    tabs: useAppStore.getState().tabs.map((t) => t.id === tab.id ? { ...t, path: "C:\\projects\\src" } : t),
  });

  // When primary navigates UP to C:\projects
  await act(async () => {
    await useAppStore.getState().goUp();
  });
  // Secondary pane should have navigated UP to D:\backup
  expect(useAppStore.getState().secondaryPath).toBe("D:\\backup");

  // Toggle syncNav back off
  useAppStore.getState().toggleSyncNav();
  expect(useAppStore.getState().syncNav).toBe(false);
});

function ShortcutsHarness() {
  useShortcuts();
  return null;
}

it("handles Ctrl+Shift+C (copy path) and Ctrl+Shift+D (toggle sync nav) shortcuts", async () => {
  const store = useAppStore.getState();
  const copyText = vi.fn(async () => {});
  useAppStore.setState({ copyText });

  await act(async () => root.render(<ShortcutsHarness />));

  // With a selected file
  const activeTab = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  const samplePath = activeTab.entries[0]?.path ?? "C:\\test\\file.txt";
  useAppStore.getState().selectOnly(samplePath);

  // Dispatch Ctrl+Shift+C
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "C",
      code: "KeyC",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
  });
  expect(copyText).toHaveBeenCalledWith(samplePath, "Copied 1 path(s)");

  // Dispatch Ctrl+Shift+D
  expect(useAppStore.getState().syncNav).toBe(false);
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "D",
      code: "KeyD",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
  });
  expect(useAppStore.getState().syncNav).toBe(true);

  // Dispatch Ctrl+Shift+E for comparePanes
  const compareSpy = vi.spyOn(useAppStore.getState(), "comparePanes");
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "E",
      code: "KeyE",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
  });
  expect(compareSpy).toHaveBeenCalled();
});

it("compares dual panes and selects differing and unique items", async () => {
  const store = useAppStore.getState();
  const fileA = {
    name: "same.txt",
    path: "C:\\primary\\same.txt",
    parentPath: "C:\\primary",
    isDir: false,
    size: 100,
    createdMs: 1000,
    modifiedMs: 1000,
    accessedMs: 1000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    isArchive: false,
    isSymlink: false,
    ext: "txt",
    kind: "text" as const,
  };
  const fileB = {
    name: "unique_primary.txt",
    path: "C:\\primary\\unique_primary.txt",
    parentPath: "C:\\primary",
    isDir: false,
    size: 200,
    createdMs: 1000,
    modifiedMs: 2000,
    accessedMs: 2000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    isArchive: false,
    isSymlink: false,
    ext: "txt",
    kind: "text" as const,
  };
  const fileC = {
    name: "unique_secondary.txt",
    path: "D:\\secondary\\unique_secondary.txt",
    parentPath: "D:\\secondary",
    isDir: false,
    size: 300,
    createdMs: 1000,
    modifiedMs: 3000,
    accessedMs: 3000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    isArchive: false,
    isSymlink: false,
    ext: "txt",
    kind: "text" as const,
  };

  useAppStore.setState({
    dualPane: true,
    secondaryPath: "D:\\secondary",
    tabs: store.tabs.map((t) => t.id === store.activeTabId ? { ...t, path: "C:\\primary", entries: [fileA, fileB], selected: [] } : t),
    secondarySelected: [],
  });

  vi.spyOn(ipc, "readDir").mockImplementation(async (path) => {
    if (path === "D:\\secondary") return [fileA, fileC];
    return [];
  });

  const res = await useAppStore.getState().comparePanes();
  expect(res.primaryUnique).toBe(1);
  expect(res.secondaryUnique).toBe(1);
  expect(res.modified).toBe(0);

  const activeTab = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  expect(activeTab.selected).toEqual(["C:\\primary\\unique_primary.txt"]);
  expect(useAppStore.getState().secondarySelected).toEqual(["D:\\secondary\\unique_secondary.txt"]);
});

it("inverts selection and selects by pattern correctly", () => {
  const store = useAppStore.getState();
  const file1 = {
    name: "main.rs",
    path: "C:\\code\\main.rs",
    parentPath: "C:\\code",
    isDir: false,
    size: 500,
    createdMs: 1000,
    modifiedMs: 2000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    ext: "rs",
  };
  const file2 = {
    name: "utils.rs",
    path: "C:\\code\\utils.rs",
    parentPath: "C:\\code",
    isDir: false,
    size: 600,
    createdMs: 1000,
    modifiedMs: 2000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    ext: "rs",
  };
  const file3 = {
    name: "README.md",
    path: "C:\\code\\README.md",
    parentPath: "C:\\code",
    isDir: false,
    size: 700,
    createdMs: 1000,
    modifiedMs: 2000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    ext: "md",
  };

  useAppStore.setState({
    tabs: store.tabs.map((t) =>
      t.id === store.activeTabId
        ? { ...t, entries: [file1, file2, file3], selected: [file1.path] }
        : t
    ),
  });

  // Invert selection: only file2 and file3 should now be selected
  useAppStore.getState().invertSelection();
  let tab = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  expect(tab.selected).toEqual([file2.path, file3.path]);

  // Select by pattern: select only *.md
  useAppStore.getState().selectByPattern("*.md");
  tab = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  expect(tab.selected).toEqual([file3.path]);

  // Select by pattern with add: add *.rs
  useAppStore.getState().selectByPattern("*.rs", { mode: "add" });
  tab = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  expect(tab.selected.length).toBe(3);

  // Column toggles
  useAppStore.getState().toggleColumn("created");
  expect(useAppStore.getState().settings.visibleColumns).toContain("created");
  useAppStore.getState().toggleColumn("created");
  expect(useAppStore.getState().settings.visibleColumns).not.toContain("created");
  useAppStore.getState().resetColumns();
  expect(useAppStore.getState().settings.visibleColumns).toEqual(["name", "modified", "type", "size"]);
});

it("renders breadcrumbs with subfolder dropdown and history popover", async () => {
  const store = useAppStore.getState();
  useAppStore.setState({
    tabs: store.tabs.map((t) =>
      t.id === store.activeTabId
        ? { ...t, path: "C:\\Projects\\NexusExplorer", history: ["C:\\Projects", "C:\\Projects\\NexusExplorer"] }
        : t
    ),
  });

  const subfolderItem = {
    name: "crates",
    path: "C:\\Projects\\NexusExplorer\\crates",
    parentPath: "C:\\Projects\\NexusExplorer",
    isDir: true,
    size: 0,
    createdMs: 1000,
    modifiedMs: 2000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    ext: "",
  };

  vi.spyOn(ipc, "readDir").mockImplementation(async (dirPath) => {
    if (dirPath.toLowerCase().includes("nexus")) return [subfolderItem];
    return [];
  });

  await act(async () => root.render(<Breadcrumbs />));

  // Breadcrumbs should render segments
  expect(host.textContent).toContain("Projects");
  expect(host.textContent).toContain("NexusExplorer");

  // Click subfolder dropdown on current folder (trailing separator button)
  const sepBtns = host.querySelectorAll<HTMLButtonElement>(".crumb-sep-btn");
  expect(sepBtns.length).toBeGreaterThan(0);

  const lastSep = sepBtns[sepBtns.length - 1];
  await act(async () => {
    lastSep.click();
  });

  // Popover should appear in document
  const popover = document.querySelector(".breadcrumb-popover");
  expect(popover).not.toBeNull();
  expect(popover?.textContent).toContain("crates");

  // Click subfolder crate
  const folderBtn = popover?.querySelector<HTMLButtonElement>(".menu-item");
  const navSpy = vi.spyOn(useAppStore.getState(), "navigateTo");
  await act(async () => {
    folderBtn?.click();
  });
  expect(navSpy).toHaveBeenCalledWith("C:\\Projects\\NexusExplorer\\crates");
});

it("filters and activates tabs using TabSearchModal", async () => {
  const store = useAppStore.getState();
  const activateSpy = vi.spyOn(store, "activateTab");

  await act(async () => root.render(<TabSearchModal />));

  // Should list tabs
  const tabItem = host.querySelector<HTMLDivElement>(".menu-item");
  expect(tabItem).not.toBeNull();

  await act(async () => {
    tabItem?.click();
  });
  expect(activateSpy).toHaveBeenCalled();
  expect(useAppStore.getState().tabSearchOpen).toBe(false);
});

it("creates an archive with options using CreateArchiveModal", async () => {
  useAppStore.setState({
    createArchivePaths: ["C:\\Projects\\file1.txt", "C:\\Projects\\file2.txt"],
  });

  const createSpy = vi.spyOn(ipc, "toolsArchiveCreateAny").mockResolvedValue({
    success: true,
    archivePath: "C:\\Projects\\archive.zip",
    destinationPath: "C:\\Projects",
    filesProcessed: 2,
    bytesProcessed: 1024,
    elapsedMs: 25,
    errorMessage: null,
  });

  await act(async () => root.render(<CreateArchiveModal />));

  expect(host.textContent).toContain("Compressing 2 selected items");

  const submitBtn = host.querySelector<HTMLButtonElement>(".btn-primary");
  expect(submitBtn).not.toBeNull();

  await act(async () => {
    submitBtn?.click();
  });
  expect(createSpy).toHaveBeenCalledWith(
    ["C:\\Projects\\file1.txt", "C:\\Projects\\file2.txt"],
    expect.stringContaining(".zip"),
    5,
    "zip",
  );
});

it("navigates to direct folder using GoToFolderModal", async () => {
  const navSpy = vi.spyOn(useAppStore.getState(), "navigateTo");

  await act(async () => root.render(<GoToFolderModal />));

  const input = host.querySelector<HTMLInputElement>("input");
  expect(input).not.toBeNull();

  await type(input!, "D:\\Work");

  const navBtn = host.querySelector<HTMLButtonElement>(".btn-primary");
  await act(async () => {
    navBtn?.click();
  });
  expect(navSpy).toHaveBeenCalledWith("D:\\Work");
  expect(useAppStore.getState().goToFolderOpen).toBe(false);
});

it("renders FileCompareModal with diff report, supports swapping files and closing", async () => {
  useAppStore.setState({
    compareFiles: ["D:\\Projects\\file1.bin", "D:\\Projects\\file2.bin"],
    compareModalOpen: true,
  });

  await act(async () => root.render(<FileCompareModal />));

  expect(host.textContent).toContain("Binary File Compare & Differ");
  expect(host.textContent).toContain("file1.bin");
  expect(host.textContent).toContain("file2.bin");
  expect(host.textContent).toContain("Binary Differences Detected");

  // Click swap button
  const swapBtn = host.querySelector<HTMLButtonElement>('button[title*="Swap"]');
  expect(swapBtn).not.toBeNull();
  await act(async () => {
    swapBtn?.click();
  });

  // Click Done button
  const doneBtn = host.querySelector<HTMLButtonElement>(".btn-primary");
  expect(doneBtn).not.toBeNull();
  await act(async () => {
    doneBtn?.click();
  });
  expect(useAppStore.getState().compareModalOpen).toBe(false);
});

it("supports 2D Arrow and Vim keyboard navigation in FileGrid", async () => {
  const store = useAppStore.getState();
  const tab = store.tabs.find((t) => t.id === store.activeTabId)!;
  const rows = visibleEntries(tab, store.settings, store.folderSizes);
  expect(rows.length).toBeGreaterThan(2);

  // Set initial selection before rendering
  await act(async () => {
    useAppStore.getState().selectOnly(rows[0].path);
  });

  await act(async () => root.render(<FileGrid />));

  const viewport = host.querySelector<HTMLDivElement>(".filegrid.viewport");
  expect(viewport).not.toBeNull();

  // Press ArrowRight
  await act(async () => {
    viewport!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  });
  const updatedTab1 = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  expect(updatedTab1.selected[0]).toBe(rows[1].path);

  // Press Vim 'j' (Down)
  await act(async () => {
    viewport!.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
  });
  const updatedTab2 = useAppStore.getState().tabs.find((t) => t.id === store.activeTabId)!;
  expect(updatedTab2.selected[0]).toBe(rows[2].path);
});
