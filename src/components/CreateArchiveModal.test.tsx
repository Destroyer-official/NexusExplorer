import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach } from "vitest";
import { CreateArchiveModal } from "./CreateArchiveModal";
import { useAppStore } from "@/state/store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("CreateArchiveModal Component", () => {
  beforeEach(async () => {
    const store = useAppStore.getState();
    await store.boot();
    store.setCreateArchivePaths(["D:\\test\\sample.txt", "D:\\test\\sample2.txt"]);
  });

  it("renders with archive title, sources count, and format choices", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<CreateArchiveModal />));

      const title = host.querySelector("#create-archive-title");
      expect(title?.textContent).toContain("Create Archive");

      // Verify sources summary is shown
      expect(host.textContent).toContain("2 selected items");

      // Verify format selection buttons
      const zipFormat = Array.from(host.querySelectorAll('[role="button"]')).find(
        (b) => b.textContent?.includes("ZIP Archive"),
      );
      expect(zipFormat).toBeDefined();

      const sevenZipFormat = Array.from(host.querySelectorAll('[role="button"]')).find(
        (b) => b.textContent?.includes("7-Zip Archive"),
      );
      expect(sevenZipFormat).toBeDefined();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("changes format when format card is clicked", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<CreateArchiveModal />));

      const sevenZipBtn = Array.from(host.querySelectorAll<HTMLElement>('[role="button"]')).find(
        (b) => b.textContent?.includes("7-Zip Archive"),
      );
      expect(sevenZipBtn).toBeDefined();

      await act(async () => sevenZipBtn?.click());

      // Target filename should now end with .7z
      expect(host.textContent).toContain(".7z");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it("dismisses modal when cancel is clicked", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => root.render(<CreateArchiveModal />));

      const cancelBtn = Array.from(host.querySelectorAll("button")).find(
        (b) => b.textContent === "Cancel",
      );
      expect(cancelBtn).toBeDefined();

      await act(async () => cancelBtn?.click());

      expect(useAppStore.getState().createArchivePaths).toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
