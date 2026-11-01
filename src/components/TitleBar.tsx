import { useEffect, useState } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { useAppStore } from "@/state/store";
import { ipc, isTauri } from "@/lib/ipc";

export default function TitleBar() {
  const activePath = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? "");
  const [max, setMax] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    // Check initial state
    void ipc.windowIsMaximized().then((isMax) => {
      if (!cancelled) setMax(Boolean(isMax));
    }).catch(() => undefined);

    // Sync maximize state on window resize
    const handleResize = () => {
      void ipc.windowIsMaximized().then((isMax) => {
        if (!cancelled) setMax(Boolean(isMax));
      }).catch(() => undefined);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await ipc.windowMinimize();
    } catch {
      // Safe fallback
    }
  };

  const handleMax = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isTauri()) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setMax(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setMax(false);
      }
      return;
    }
    try {
      const isMax = await ipc.windowToggleMaximize();
      setMax(Boolean(isMax));
    } catch {
      // Safe fallback
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isTauri()) {
      window.close();
      return;
    }
    try {
      await ipc.windowClose();
    } catch {
      // Safe fallback
    }
  };

  return (
    <div className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region>
        <div className="brand-mark">N</div>
        <span className="brand-name">Nexus</span>
        <span className="brand-sub">Explorer</span>
      </div>
      <div className="titlebar-drag" data-tauri-drag-region onDoubleClick={() => void handleMax()}>
        <span style={{ color: "var(--text-faint)", fontSize: 12 }}>{activePath}</span>
      </div>
      <div className="titlebar-actions" onPointerDown={(e) => e.stopPropagation()}>
        <button className="win-btn" onClick={handleMin} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="win-btn" onClick={handleMax} title="Maximize">
          {max ? <Maximize2 size={13} /> : <Square size={12} />}
        </button>
        <button className="win-btn win-btn-close" onClick={handleClose} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
