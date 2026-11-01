/** Vim-Modal Keyboard Navigation Engine (h/j/k/l, v, y, d, p, gg, G). */

import { useAppStore, cutClipboard } from "@/state/store";

let lastKey = "";
let lastKeyTime = 0;

export function handleVimKeyEvent(e: KeyboardEvent): boolean {
  // Ignore inside text input elements
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea") return false;

  const store = useAppStore.getState();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  if (!activeTab || activeTab.entries.length === 0) return false;

  const entries = activeTab.entries;
  const selectedPaths = activeTab.selected;
  const currentIdx = selectedPaths.length > 0
    ? entries.findIndex((en) => en.path === selectedPaths[selectedPaths.length - 1])
    : -1;

  const now = Date.now();
  const isDoubleG = e.key === "g" && lastKey === "g" && (now - lastKeyTime) < 500;
  lastKey = e.key;
  lastKeyTime = now;

  if (isDoubleG) {
    e.preventDefault();
    if (entries[0]) store.selectOnly(entries[0].path);
    return true;
  }

  switch (e.key) {
    case "j": { // Down
      e.preventDefault();
      const nextIdx = Math.min(entries.length - 1, currentIdx + 1);
      if (entries[nextIdx]) store.selectOnly(entries[nextIdx].path);
      return true;
    }
    case "k": { // Up
      e.preventDefault();
      const prevIdx = Math.max(0, currentIdx - 1);
      if (entries[prevIdx]) store.selectOnly(entries[prevIdx].path);
      return true;
    }
    case "h": { // Parent
      e.preventDefault();
      void store.goUp();
      return true;
    }
    case "l": { // Enter folder
      e.preventDefault();
      if (currentIdx >= 0 && entries[currentIdx]) {
        const item = entries[currentIdx];
        if (item.isDir) void store.navigateTo(item.path);
        else void store.openEntry(item);
      }
      return true;
    }
    case "G": { // Bottom
      e.preventDefault();
      const last = entries[entries.length - 1];
      if (last) store.selectOnly(last.path);
      return true;
    }
    case "y": { // Yank (copy)
      if (selectedPaths.length > 0) {
        e.preventDefault();
        cutClipboard.paths = [...selectedPaths];
        cutClipboard.mode = "copy";
        store.pushToast("info", "Yank", `Copied ${selectedPaths.length} items to clipboard.`);
        return true;
      }
      break;
    }
    case "d": { // Delete / Cut
      if (selectedPaths.length > 0) {
        e.preventDefault();
        cutClipboard.paths = [...selectedPaths];
        cutClipboard.mode = "cut";
        store.pushToast("info", "Cut", `Cut ${selectedPaths.length} items to clipboard.`);
        return true;
      }
      break;
    }
    case "p": { // Put (paste)
      e.preventDefault();
      void store.pasteInto();
      return true;
    }
    default:
      break;
  }

  return false;
}

