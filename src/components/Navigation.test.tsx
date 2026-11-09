import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import Toolbar from "./Toolbar";
import TitleBar from "./TitleBar";
import WindowFrame from "./WindowFrame";
import { useAppStore } from "@/state/store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps toolbar actions focusable and dismisses menus with Escape or outside pointer", async () => {
  await useAppStore.getState().boot();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Toolbar />));
    const sort = host.querySelector<HTMLButtonElement>('button[title="Sort"]')!;
    await act(async () => sort.click());
    expect(host.querySelectorAll(".toolbar-menu button").length).toBe(6);
    expect(document.activeElement?.textContent).toContain("Name");
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector(".toolbar-menu")).toBeNull();
    expect(document.activeElement).toBe(sort);
    await act(async () => sort.click());
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(host.querySelector(".toolbar-menu")).toBeNull();
    await act(async () => sort.click());
    const size = Array.from(host.querySelectorAll<HTMLButtonElement>(".toolbar-menu button")).find((button) => button.textContent === "Size")!;
    await act(async () => size.click());
    const state = useAppStore.getState();
    expect(state.tabs.find((tab) => tab.id === state.activeTabId)?.sortKey).toBe("size");
    expect(host.querySelector(".toolbar-menu")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("isolates titlebar buttons and restores a minimized browser preview", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const propagated = vi.fn();
  document.body.addEventListener("click", propagated);
  try {
    await act(async () => root.render(<WindowFrame><TitleBar /></WindowFrame>));
    expect(host.querySelector("header")?.hasAttribute("data-tauri-drag-region")).toBe(false);
    expect(host.querySelectorAll("[data-tauri-drag-region]").length).toBe(2);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Minimize"]')?.click());
    expect(propagated).not.toHaveBeenCalled();
    expect(host.querySelector(".app")?.hasAttribute("hidden")).toBe(true);
    expect(host.querySelector(".preview-recovery")?.textContent).toContain("Preview minimized");
    await act(async () => host.querySelector<HTMLButtonElement>(".preview-recovery button")?.click());
    expect(host.querySelector(".app")?.hasAttribute("hidden")).toBe(false);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Maximize window"]')?.click());
    expect(host.querySelector('[aria-label="Restore window"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    document.body.removeEventListener("click", propagated);
  }
});
