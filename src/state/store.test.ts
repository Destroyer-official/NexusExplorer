import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset basic store state before each test
    const store = useAppStore.getState();
    store.clearStaged();
    store.closePrompt();
    store.closeConfirm();
    store.setPowerTools(false);
    store.setStagingOpen(false);
    store.setTerminalOpen(false);
  });

  it("manages staging shelf operations correctly", () => {
    const store = useAppStore.getState();
    expect(store.stagingPaths).toEqual([]);

    store.addStaged(["C:\\file1.txt", "C:\\file2.txt"]);
    expect(useAppStore.getState().stagingPaths).toEqual(["C:\\file1.txt", "C:\\file2.txt"]);

    // Deduplication test
    store.addStaged(["C:\\file2.txt", "C:\\file3.txt"]);
    expect(useAppStore.getState().stagingPaths).toEqual([
      "C:\\file1.txt",
      "C:\\file2.txt",
      "C:\\file3.txt",
    ]);

    // Removal test
    store.removeStaged("C:\\file2.txt");
    expect(useAppStore.getState().stagingPaths).toEqual(["C:\\file1.txt", "C:\\file3.txt"]);

    // Clear test
    store.clearStaged();
    expect(useAppStore.getState().stagingPaths).toEqual([]);
  });

  it("pushes and dismisses toasts correctly", () => {
    const store = useAppStore.getState();
    store.pushToast("success", "Operation Complete", "10 files copied");

    const toasts = useAppStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    const lastToast = toasts[toasts.length - 1];
    expect(lastToast.kind).toBe("success");
    expect(lastToast.title).toBe("Operation Complete");
    expect(lastToast.message).toBe("10 files copied");

    store.dismissToast(lastToast.id);
    expect(useAppStore.getState().toasts.some((t) => t.id === lastToast.id)).toBe(false);
  });

  it("toggles UI visibility flags properly", () => {
    const store = useAppStore.getState();

    store.setPowerTools(true, "git");
    expect(useAppStore.getState().powerToolsOpen).toBe(true);
    expect(useAppStore.getState().powerToolsTab).toBe("git");

    store.setPowerTools(false);
    expect(useAppStore.getState().powerToolsOpen).toBe(false);

    store.setTerminalOpen(true);
    expect(useAppStore.getState().terminalOpen).toBe(true);

    store.toggleTerminal();
    expect(useAppStore.getState().terminalOpen).toBe(false);
  });

  it("handles confirm and prompt modal states", () => {
    const store = useAppStore.getState();

    store.openConfirm({
      title: "Confirm Delete",
      description: "Permanently delete items?",
      onConfirm: () => {},
    });
    expect(useAppStore.getState().confirm?.title).toBe("Confirm Delete");

    store.closeConfirm();
    expect(useAppStore.getState().confirm).toBeNull();

    store.openPrompt({
      title: "New Folder Name",
      label: "Folder Name",
      value: "New Folder",
      onConfirm: () => {},
    });
    expect(useAppStore.getState().prompt?.title).toBe("New Folder Name");
    expect(useAppStore.getState().prompt?.value).toBe("New Folder");

    store.closePrompt();
    expect(useAppStore.getState().prompt).toBeNull();
  });

  it("renames tabs, closes other tabs, and closes tabs to the right", async () => {
    await useAppStore.getState().boot();
    const store = useAppStore.getState();
    const tab0 = store.tabs[0];
    expect(tab0).toBeDefined();

    // Test renameTab
    store.renameTab(tab0.id, "Custom Project");
    expect(useAppStore.getState().tabs.find((t) => t.id === tab0.id)?.title).toBe("Custom Project");

    // Open additional tabs
    await store.openTab("C:\\Windows", false, false);
    await store.openTab("C:\\Users", false, false);
    await store.openTab("C:\\Program Files", false, false);
    expect(useAppStore.getState().tabs.length).toBeGreaterThanOrEqual(4);

    const tabsAfterOpen = useAppStore.getState().tabs;
    const secondTab = tabsAfterOpen[1];

    // Close tabs to right of second tab
    useAppStore.getState().closeTabsToRight(secondTab.id);
    expect(useAppStore.getState().tabs.length).toBe(2);
    expect(useAppStore.getState().tabs[0].id).toBe(tabsAfterOpen[0].id);
    expect(useAppStore.getState().tabs[1].id).toBe(secondTab.id);

    // Close other tabs
    useAppStore.getState().closeOtherTabs(secondTab.id);
    expect(useAppStore.getState().tabs.length).toBe(1);
    expect(useAppStore.getState().tabs[0].id).toBe(secondTab.id);
  });
});

it("creates a distinct tab when New tab requests an already open folder", async () => {
  await useAppStore.getState().boot();
  const before = useAppStore.getState();
  const path = before.tabs[0].path;
  const count = before.tabs.length;
  await before.openTab(path, true, false);
  const after = useAppStore.getState();
  expect(after.tabs).toHaveLength(count + 1);
  expect(after.activeTabId).not.toBe(before.tabs[0].id);
  expect(after.tabs.find((tab) => tab.id === after.activeTabId)?.path).toBe(path);
});
