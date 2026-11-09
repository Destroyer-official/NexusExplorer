import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach } from "vitest";
import BatchRenameDialog from "./BatchRenameDialog";
import { useAppStore } from "@/state/store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("BatchRenameDialog Component", () => {
  beforeEach(async () => {
    const store = useAppStore.getState();
    await store.boot();
    // Select two files in the active tab
    const tab = store.tabs.find((t) => t.id === store.activeTabId);
    if (tab && tab.entries.length >= 2) {
      store.setSelected([tab.entries[0].path, tab.entries[1].path]);
    }
    store.setBatchRenameOpen(true);
  });

  it("renders with selected items count and default template", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<BatchRenameDialog />));

      const title = host.querySelector(".modal-title");
      expect(title?.textContent).toBe("Batch Rename");

      const inputs = host.querySelectorAll<HTMLInputElement>("input.input");
      expect(inputs.length).toBeGreaterThanOrEqual(2); // Find, Replace, Template

      // Check presets are rendered
      const presetButtons = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).filter(
        (b) => b.textContent?.includes("Date") || b.textContent?.includes("Counter"),
      );
      expect(presetButtons.length).toBeGreaterThan(0);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("adds tokens to template when token buttons are clicked", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<BatchRenameDialog />));

      const counterBtn = Array.from(host.querySelectorAll<HTMLButtonElement>("button.kbd")).find(
        (b) => b.textContent?.includes("Counter"),
      );
      expect(counterBtn).toBeDefined();

      await act(async () => counterBtn?.click());

      const templateInput = Array.from(host.querySelectorAll<HTMLInputElement>("input.input")).find(
        (input) => input.value.includes("<counter:001>"),
      );
      expect(templateInput).toBeDefined();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("updates template when quick preset is clicked", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<BatchRenameDialog />));

      const dateCounterPreset = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Date + Counter",
      );
      expect(dateCounterPreset).toBeDefined();

      await act(async () => dateCounterPreset?.click());

      const templateInput = Array.from(host.querySelectorAll<HTMLInputElement>("input.input")).find(
        (input) => input.value === "<date>_<counter:001>",
      );
      expect(templateInput).toBeDefined();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("allows selecting case transformation styles", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<BatchRenameDialog />));

      const select = host.querySelector<HTMLSelectElement>("select.input");
      expect(select).not.toBeNull();

      await act(async () => {
        if (select) {
          select.value = "uppercase";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      expect(select?.value).toBe("uppercase");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("dismisses modal when Cancel is clicked", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<BatchRenameDialog />));

      const cancelBtn = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent === "Cancel",
      );
      expect(cancelBtn).toBeDefined();

      await act(async () => cancelBtn?.click());

      expect(useAppStore.getState().batchRenameOpen).toBe(false);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});

