import { useState, useCallback, useRef, useEffect } from "react";
import { useAppStore } from "@/state/store";

interface MarqueeBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface UseMarqueeOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  onSelectionChange?: (selectedPaths: string[]) => void;
}

export function useMarqueeSelection({
  containerRef,
  enabled = true,
  onSelectionChange,
}: UseMarqueeOptions) {
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);
  const dragStateRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    hasDragged: boolean;
    initialSelected: Set<string>;
    isCtrl: boolean;
    isShift: boolean;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    hasDragged: false,
    initialSelected: new Set(),
    isCtrl: false,
    isShift: false,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      const target = e.target as HTMLElement;

      // Don't start marquee when clicking interactive controls or headers
      if (
        target.closest(
          "button, input, textarea, a, select, [role='button'], .col-head, .tab-close, .window-controls",
        )
      ) {
        return;
      }

      // If clicking directly on a filename text or icon, let row drag-and-drop take priority
      const isFileTextOrIcon = target.closest(".col-name span, .tile-icon, .tile-name");
      if (isFileTextOrIcon) {
        return;
      }

      const store = useAppStore.getState();
      const tab = store.tabs.find((t) => t.id === store.activeTabId);
      const currentSelected = new Set(tab?.selected ?? []);

      dragStateRef.current = {
        isDown: true,
        startX: e.clientX,
        startY: e.clientY,
        hasDragged: false,
        initialSelected: currentSelected,
        isCtrl: e.ctrlKey || e.metaKey,
        isShift: e.shiftKey,
      };
    },
    [enabled],
  );

  // Global window listeners while pointer is down ensure 100% reliable tracking
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state.isDown) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const dist = Math.hypot(dx, dy);

      // 4px threshold prevents micro-drifts from hijacking single clicks
      if (!state.hasDragged) {
        if (dist < 4) return;
        state.hasDragged = true;
      }

      setMarqueeBox({
        startX: state.startX,
        startY: state.startY,
        currentX: e.clientX,
        currentY: e.clientY,
      });

      const container = containerRef.current;
      if (!container) return;

      const left = Math.min(state.startX, e.clientX);
      const right = Math.max(state.startX, e.clientX);
      const top = Math.min(state.startY, e.clientY);
      const bottom = Math.max(state.startY, e.clientY);

      // Find all selectable items with data-path
      const items = container.querySelectorAll<HTMLElement>("[data-path]");
      const intersected = new Set<string>();

      items.forEach((item) => {
        const r = item.getBoundingClientRect();
        const intersects = !(
          r.right < left ||
          r.left > right ||
          r.bottom < top ||
          r.top > bottom
        );
        const path = item.getAttribute("data-path");
        if (intersects && path) {
          intersected.add(path);
        }
      });

      let nextSelected: string[];
      if (state.isCtrl) {
        const combined = new Set(state.initialSelected);
        intersected.forEach((p) => {
          if (state.initialSelected.has(p)) combined.delete(p);
          else combined.add(p);
        });
        nextSelected = Array.from(combined);
      } else if (state.isShift) {
        const combined = new Set([...state.initialSelected, ...intersected]);
        nextSelected = Array.from(combined);
      } else {
        nextSelected = Array.from(intersected);
      }

      if (onSelectionChange) {
        onSelectionChange(nextSelected);
      } else {
        useAppStore.getState().setSelected(nextSelected);
      }
    };

    const handleUp = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state.isDown) return;

      const didDrag = state.hasDragged;
      state.isDown = false;
      state.hasDragged = false;
      setMarqueeBox(null);

      // If clicked on completely empty area without dragging, clear selection
      if (!didDrag) {
        const target = e.target as HTMLElement | null;
        const isRowOrTile = target?.closest(".row, .tile, [data-path]");
        if (!isRowOrTile && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          useAppStore.getState().clearSelection();
        }
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [containerRef, onSelectionChange]);

  const renderMarquee = () => {
    if (!marqueeBox) return null;
    const left = Math.min(marqueeBox.startX, marqueeBox.currentX);
    const top = Math.min(marqueeBox.startY, marqueeBox.currentY);
    const width = Math.abs(marqueeBox.currentX - marqueeBox.startX);
    const height = Math.abs(marqueeBox.currentY - marqueeBox.startY);

    return (
      <div
        className="marquee-selection"
        style={{
          position: "fixed",
          left,
          top,
          width,
          height,
          background: "var(--selection)",
          border: "1px solid var(--selection-border)",
          borderRadius: "var(--radius-sm, 2px)",
          boxShadow: "0 0 10px var(--accent-glow)",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    );
  };

  return {
    onPointerDown,
    renderMarquee,
    isMarqueeActive: !!marqueeBox,
  };
}
