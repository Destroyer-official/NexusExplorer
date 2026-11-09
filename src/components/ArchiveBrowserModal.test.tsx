import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach } from "vitest";
import ArchiveBrowserModal from "./ArchiveBrowserModal";
import { useAppStore } from "@/state/store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ArchiveBrowserModal Component", () => {
  beforeEach(async () => {
    const store = useAppStore.getState();
    await store.boot();
    store.setArchivePath("D:\\archives\\project.zip");
  });

  it("renders when archivePath is set and shows archive header", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<ArchiveBrowserModal />));

      const title = host.querySelector(".modal-title");
      expect(title?.textContent).toContain("project.zip");

      // Verify search input is rendered
      const search = host.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
      expect(search).toBeDefined();

      // Verify extract button
      const extractBtn = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
        (b) => b.textContent?.includes("Extract"),
      );
      expect(extractBtn).toBeDefined();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("dismisses modal when close button is clicked", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<ArchiveBrowserModal />));

      const closeBtn = host.querySelector<HTMLButtonElement>("button.icon-btn");
      expect(closeBtn).not.toBeNull();

      await act(async () => closeBtn?.click());

      expect(useAppStore.getState().archivePath).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});

