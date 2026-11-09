import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/App";
import { useAppStore } from "@/state/store";

vi.mock("@/lib/gamepad", () => ({ initGamepadListener: vi.fn() }));
vi.mock("@/hooks/useSystemEvents", () => ({ useSystemEvents: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
let baseline: ReturnType<typeof useAppStore.getState>;

beforeEach(async () => {
  await useAppStore.getState().boot();
  baseline = useAppStore.getState();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useAppStore.setState(baseline, true);
});

const facilities = [
  ["Nexus AI Agent", "copilotOpen"],
  ["Keyboard shortcuts", "shortcutsOpen"],
  ["Disk Space Treemap", "treemapOpen"],
  ["Dev Drive & BitLocker", "devDriveOpen"],
  ["Virtual Drive Mounter (VHD/ISO)", "mounterOpen"],
  ["Clean build caches", "janitorOpen"],
  ["Remote SFTP / SSH Explorer", "sftpOpen"],
  ["Share with QR code", "webdropOpen"],
  ["Local P2P Mesh Sharing", "meshSharePaths"],
  ["Content-addressed storage", "vdfsOpen"],
  ["File audit history", "provenanceOpen"],
  ["DLP & Secret Scanner", "dlpOpen"],
  ["File snapshots", "timeMachineOpen"],
  ["Clipboard history", "clipboardHistoryOpen"],
  ["All power tools", "powerToolsOpen"],
  ["Workspace profiles", "workspaceProfilesOpen"],
  ["Manage smart folders", "smartFolderOpen"],
] as const;

it.each(facilities)("opens %s from the rendered Tools menu", async (label, stateKey) => {
  const trigger = host.querySelector<HTMLButtonElement>('[title="Advanced Tools & Utilities"]')!;
  await act(async () => trigger.click());
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>(".toolbar-menu button")).find((item) => item.textContent?.includes(label));
  expect(button, `Missing ${label} control`).toBeDefined();
  await act(async () => button!.click());
  expect(useAppStore.getState()[stateKey]).toBeTruthy();
  expect(host.querySelector(".toolbar-menu")).toBeNull();
  expect(host.textContent).not.toContain("Something went wrong");
  // A panel must actually be rendered, rather than only setting an unused flag.
  expect(host.querySelector(".overlay, [role=dialog], .fixed, .time-machine-bar")).not.toBeNull();
});

it("changes all three explorer views using the visible controls", async () => {
  for (const [title, selector] of [["List (Ctrl+1)", ".filelist"], ["Grid (Ctrl+2)", ".filegrid"], ["Miller Columns (Ctrl+3)", ".miller-columns"]]) {
    await act(async () => host.querySelector<HTMLButtonElement>(`[title="${title}"]`)!.click());
    expect(host.querySelector(selector)).not.toBeNull();
  }
});

it("opens and dismisses Settings and keeps file shortcuts out of the dialog", async () => {
  await act(async () => host.querySelector<HTMLButtonElement>('[title="Settings (Ctrl+,)"]')!.click());
  expect(host.querySelector('[aria-label="Settings"]')).not.toBeNull();
  const priorView = useAppStore.getState().tabs[0].view;
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "3", ctrlKey: true })));
  expect(useAppStore.getState().tabs[0].view).toBe(priorView);
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(host.querySelector('[aria-label="Settings"]')).toBeNull();
});

it.each(["Duplicates", "Content search", "Image optimizer", "ADS streams", "Links", "Unlocker", "Split / Join", "Timestamps", "USN journal", "Snapshots", "BitLocker", "Checksums", "Plugins"])("renders the %s power-tool panel", async (label) => {
  await act(async () => useAppStore.getState().setPowerTools(true));
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>(".modal .side-item")).find((item) => item.textContent === label)!;
  expect(button).toBeDefined();
  await act(async () => button.click());
  expect(button.classList.contains("active")).toBe(true);
  expect(host.querySelectorAll(".modal input, .modal select, .modal .btn").length).toBeGreaterThan(0);
});

it("gives every toolbar icon an accessible name and toggles the common panels", async () => {
  for (const button of host.querySelectorAll<HTMLButtonElement>(".toolbar button, .titlebar button")) {
    expect(Boolean(button.getAttribute("aria-label") || button.title || button.textContent?.trim())).toBe(true);
  }
  for (const [title, selector] of [["Sidebar (Ctrl+B)", ".sidebar"], ["Preview (Ctrl+P)", ".preview"], ["Transfers", ".transfers-panel"]]) {
    const before = Boolean(host.querySelector(selector));
    await act(async () => host.querySelector<HTMLButtonElement>(`[title="${title}"]`)!.click());
    expect(Boolean(host.querySelector(selector))).toBe(!before);
    await act(async () => host.querySelector<HTMLButtonElement>(`[title="${title}"]`)!.click());
    expect(Boolean(host.querySelector(selector))).toBe(before);
  }
});
