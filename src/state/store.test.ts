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
});
