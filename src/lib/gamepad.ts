/** Gamepad API Controller Support for Handheld PCs (Steam Deck, ROG Ally, Xbox). */

import { useAppStore } from "@/state/store";

let lastActionTime = 0;
const DEBOUNCE_MS = 180;
let isLoopRunning = false;

export function initGamepadListener() {
  if (isLoopRunning || typeof window === "undefined") return;
  isLoopRunning = true;

  const pollGamepad = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads.find((g) => g && g.connected);

    if (gp) {
      const now = Date.now();
      if (now - lastActionTime > DEBOUNCE_MS) {
        const store = useAppStore.getState();
        const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
        const entries = activeTab?.entries ?? [];
        const selected = activeTab?.selected ?? [];
        const currentIdx = selected.length > 0
          ? entries.findIndex((e) => e.path === selected[selected.length - 1])
          : -1;

        // D-Pad Down (button 13) or Left Stick Down (axes[1] > 0.5)
        if (gp.buttons[13]?.pressed || gp.axes[1] > 0.5) {
          const nextIdx = Math.min(entries.length - 1, currentIdx + 1);
          if (entries[nextIdx]) store.selectOnly(entries[nextIdx].path);
          lastActionTime = now;
        }
        // D-Pad Up (button 12) or Left Stick Up (axes[1] < -0.5)
        else if (gp.buttons[12]?.pressed || gp.axes[1] < -0.5) {
          const prevIdx = Math.max(0, currentIdx - 1);
          if (entries[prevIdx]) store.selectOnly(entries[prevIdx].path);
          lastActionTime = now;
        }
        // Button A (button 0) -> Open entry
        else if (gp.buttons[0]?.pressed) {
          if (currentIdx >= 0 && entries[currentIdx]) {
            const item = entries[currentIdx];
            if (item.isDir) void store.navigateTo(item.path);
            else void store.openEntry(item);
          }
          lastActionTime = now + 100;
        }
        // Button B (button 1) -> Go back
        else if (gp.buttons[1]?.pressed) {
          void store.goBack();
          lastActionTime = now + 100;
        }
        // Left Bumper (button 4) -> Previous tab
        else if (gp.buttons[4]?.pressed) {
          const tabIdx = store.tabs.findIndex((t) => t.id === store.activeTabId);
          if (tabIdx > 0) store.activateTab(store.tabs[tabIdx - 1].id);
          lastActionTime = now + 100;
        }
        // Right Bumper (button 5) -> Next tab
        else if (gp.buttons[5]?.pressed) {
          const tabIdx = store.tabs.findIndex((t) => t.id === store.activeTabId);
          if (tabIdx < store.tabs.length - 1) store.activateTab(store.tabs[tabIdx + 1].id);
          lastActionTime = now + 100;
        }
        // Button Y (button 3) -> Toggle preview
        else if (gp.buttons[3]?.pressed) {
          store.togglePreview();
          lastActionTime = now + 150;
        }
        // Button X (button 2) -> Toggle sidebar
        else if (gp.buttons[2]?.pressed) {
          store.toggleSidebar();
          lastActionTime = now + 150;
        }
      }
    }

    requestAnimationFrame(pollGamepad);
  };

  requestAnimationFrame(pollGamepad);
}
