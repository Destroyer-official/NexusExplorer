import { describe, expect, it } from "vitest";
import { useAppStore } from "@/state/store";

describe("App Boot & State Transitions", () => {
  it("boots the store cleanly", async () => {
    const store = useAppStore.getState();
    await store.boot();
    const updated = useAppStore.getState();
    expect(updated.ready).toBe(true);
    expect(updated.bootError).toBeNull();
    expect(updated.tabs.length).toBeGreaterThan(0);
    expect(updated.drives.length).toBeGreaterThan(0);
  });

  it("can open, navigate and switch tabs", () => {
    const store = useAppStore.getState();
    const initialCount = store.tabs.length;
    store.openTab("D:\\code\\test");
    const afterOpen = useAppStore.getState();
    expect(afterOpen.tabs.length).toBe(initialCount + 1);

    const newTabId = afterOpen.activeTabId;
    const newTab = afterOpen.tabs.find((t) => t.id === newTabId);
    expect(newTab?.path).toBe("D:\\code\\test");
  });

  it("toggles all 2027 power modals without exceptions", () => {
    const store = useAppStore.getState();

    // DevDrive modal
    store.setDevDriveOpen(true);
    expect(useAppStore.getState().devDriveOpen).toBe(true);
    store.setDevDriveOpen(false);
    expect(useAppStore.getState().devDriveOpen).toBe(false);

    // Treemap modal
    store.setTreemapOpen(true);
    expect(useAppStore.getState().treemapOpen).toBe(true);
    store.setTreemapOpen(false);

    // SFTP modal
    store.setSftpOpen(true);
    expect(useAppStore.getState().sftpOpen).toBe(true);
    store.setSftpOpen(false);

    // Copilot modal
    store.openCopilot();
    expect(useAppStore.getState().copilotOpen).toBe(true);
    store.closeCopilot();
    expect(useAppStore.getState().copilotOpen).toBe(false);

    // Janitor modal
    store.setJanitorOpen(true);
    expect(useAppStore.getState().janitorOpen).toBe(true);
    store.setJanitorOpen(false);

    // DLP modal
    store.setDlpOpen(true);
    expect(useAppStore.getState().dlpOpen).toBe(true);
    store.setDlpOpen(false);

    // Virtual Mounter modal
    store.setMounterOpen(true);
    expect(useAppStore.getState().mounterOpen).toBe(true);
    store.setMounterOpen(false);

    // WebDrop modal
    store.setWebdropOpen(true);
    expect(useAppStore.getState().webdropOpen).toBe(true);
    store.setWebdropOpen(false);

    // VDFS modal
    store.setVdfsOpen(true);
    expect(useAppStore.getState().vdfsOpen).toBe(true);
    store.setVdfsOpen(false);
  });

  it("toggles command palette, shortcuts, and settings", () => {
    const store = useAppStore.getState();
    store.setPalette(true);
    expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    store.setPalette(false);
    expect(useAppStore.getState().commandPaletteOpen).toBe(false);

    store.setSettingsOpen(true);
    expect(useAppStore.getState().settingsOpen).toBe(true);
    store.setSettingsOpen(false);
    expect(useAppStore.getState().settingsOpen).toBe(false);

    store.setShortcutsOpen(true);
    expect(useAppStore.getState().shortcutsOpen).toBe(true);
    store.setShortcutsOpen(false);
    expect(useAppStore.getState().shortcutsOpen).toBe(false);
  });
});
