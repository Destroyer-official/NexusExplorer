import { useEffect, useState } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { useAppStore } from "@/state/store";
import { isTauri } from "@/lib/ipc";

export default function TitleBar() {
  const activePath = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? "");
  const [max, setMax] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let un: (() => void) | null = null;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      try {
        const win = getCurrentWindow();
        void win.isMaximized().then(setMax);
        win.onResized(() => { void win.isMaximized().then(setMax); }).then((fn) => { un = fn; });
      } catch {
        // Safe off-window fallback
      }
    }).catch(() => undefined);
    return () => { un?.(); };
  }, []);

  const handleMin = () => {
    if (!isTauri()) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().minimize()).catch(() => undefined);
  };

  const handleMax = () => {
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
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().toggleMaximize()).catch(() => undefined);
  };

  const handleClose = () => {
    if (!isTauri()) {
      window.close();
      return;
    }
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().close()).catch(() => undefined);
  };

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <div className="brand-mark">N</div>
        <span className="brand-name">Nexus</span>
        <span className="brand-sub">Explorer</span>
      </div>
      <div className="titlebar-drag" data-tauri-drag-region>
        <span style={{ color: "var(--text-faint)", fontSize: 12 }}>{activePath}</span>
      </div>
      <div className="titlebar-actions">
        <button className="win-btn" onClick={handleMin} title="Minimize"><Minus size={14} /></button>
        <button className="win-btn" onClick={handleMax} title="Maximize">
          {max ? <Maximize2 size={13} /> : <Square size={12} />}
        </button>
        <button className="win-btn win-btn-close" onClick={handleClose} title="Close"><X size={14} /></button>
      </div>
    </div>
  );
}
