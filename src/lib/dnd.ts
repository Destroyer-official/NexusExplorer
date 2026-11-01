import { useSyncExternalStore } from "react";
import { isWithin, samePath } from "@/lib/paths";
import { useAppStore } from "@/state/store";

export interface DragSnapshot { active: boolean; paths: string[]; x: number; y: number; }
let snapshot: DragSnapshot = { active: false, paths: [], x: 0, y: 0 };
const listeners = new Set<() => void>();
let hoverEl: HTMLElement | null = null;
let pending: { paths: string[]; startX: number; startY: number } | null = null;

function emit() { snapshot = { ...snapshot }; listeners.forEach((l) => l()); }
function dropTargetAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  // Check for drop buckets first
  const bucketEl = el.closest("[data-drop-bucket]") as HTMLElement | null;
  if (bucketEl) return bucketEl;
  // Check for staging widget target
  const stagingEl = el.closest("[data-drop-target='staging'], .staging-widget") as HTMLElement | null;
  if (stagingEl) return stagingEl;
  // Check for preview pane target
  const previewEl = el.closest("[data-drop-target='preview'], .preview") as HTMLElement | null;
  if (previewEl) return previewEl;
  // Check for standard drop path (folders, crumbs, tabs)
  return (el.closest("[data-drop-path]") as HTMLElement | null) ?? null;
}
function clearHover() { if (hoverEl) { hoverEl.classList.remove("drop-hover"); hoverEl = null; } }

if (typeof window !== "undefined") {
  window.addEventListener("pointermove", (e) => {
    if (pending && !snapshot.active) {
      const dx = e.clientX - pending.startX;
      const dy = e.clientY - pending.startY;
      // 100 = 10px threshold, preventing accidental drag initiation during double clicks
      if (dx * dx + dy * dy > 100) {
        snapshot = { active: true, paths: pending.paths, x: e.clientX, y: e.clientY };
        document.body.classList.add("dragging-files");
        emit();
        pending = null;
      }
    }
    if (snapshot.active) {
      snapshot.x = e.clientX;
      snapshot.y = e.clientY;
      emit();
      const next = dropTargetAt(e.clientX, e.clientY);
      if (next !== hoverEl) {
        clearHover();
        hoverEl = next;
        hoverEl?.classList.add("drop-hover");
      }
    }
  });
  window.addEventListener("pointerup", (e) => {
    if (snapshot.active) {
      const target = dropTargetAt(e.clientX, e.clientY);
      const store = useAppStore.getState();
      const paths = snapshot.paths;

      if (target) {
        const bucket = target.dataset.dropBucket || target.closest("[data-drop-bucket]")?.getAttribute("data-drop-bucket");
        const isStaging = target.dataset.dropTarget === "staging" || !!target.closest(".staging-widget");
        const isPreview = target.dataset.dropTarget === "preview" || !!target.closest(".preview");
        const dest = target.dataset.dropPath || target.closest("[data-drop-path]")?.getAttribute("data-drop-path");

        if (bucket) {
          if (bucket === "shelf") {
            store.addStaged(paths);
            store.pushToast("success", "Staged", `Added ${paths.length} item${paths.length > 1 ? "s" : ""} to Staging Shelf`);
          } else if (bucket === "archive") {
            const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
            const parentDir = activeTab?.path ?? "C:\\";
            void store.pasteStagedAs("zip", parentDir);
            store.pushToast("info", "Archiving", `Creating ZIP archive for ${paths.length} item${paths.length > 1 ? "s" : ""}…`);
          } else if (bucket === "trash") {
            void store.startDelete(paths, false);
          } else if (bucket === "webdrop") {
            store.addStaged(paths);
            store.setWebdropOpen(true);
            store.pushToast("info", "WebDrop", `Ready to send ${paths.length} item${paths.length > 1 ? "s" : ""} to mobile`);
          }
        } else if (isStaging || isPreview) {
          store.addStaged(paths);
          store.pushToast("success", "Staged", `Added ${paths.length} item${paths.length > 1 ? "s" : ""} to Staging Shelf`);
          if (paths.length === 1) {
            store.selectOnly(paths[0]);
          }
        } else if (dest) {
          const sources = paths.filter((p) => !samePath(p, dest) && !isWithin(dest, p));
          if (sources.length) void store.startMove(sources, dest);
        }
      }
      snapshot = { active: false, paths: [], x: 0, y: 0 };
      document.body.classList.remove("dragging-files");
      clearHover();
      emit();
    }
    pending = null;
  });
}

export function beginDrag(paths: string[], x: number, y: number) {
  pending = { paths, startX: x, startY: y };
}

export function useDragState(): DragSnapshot {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => snapshot,
    () => snapshot,
  );
}