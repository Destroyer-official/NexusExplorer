import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { FileGrid } from "./FileGrid";
import { useAppStore } from "@/state/store";

vi.mock("@/lib/dnd", () => ({ beginDrag: vi.fn() }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

it("opens a grid entry only once for a complete double-click sequence", async () => {
  await useAppStore.getState().boot();
  const openEntry = vi.fn(async () => undefined);
  const originalOpen = useAppStore.getState().openEntry;
  const originalSizes = useAppStore.getState().autoCalculateFolderSizes;
  useAppStore.setState({ openEntry, autoCalculateFolderSizes: vi.fn(async () => undefined) });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<FileGrid />));
    const tile = host.querySelector(".tile");
    expect(tile).not.toBeNull();
    await act(async () => {
      for (let click = 1; click <= 2; click++) {
        tile!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, detail: click }));
        tile!.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0, detail: click }));
        tile!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, detail: click }));
      }
      tile!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, button: 0, detail: 2 }));
    });
    expect(openEntry).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    useAppStore.setState({ openEntry: originalOpen, autoCalculateFolderSizes: originalSizes });
  }
});
