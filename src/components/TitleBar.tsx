import { Minus, Square, X, Copy } from "lucide-react";
import { useAppStore } from "@/state/store";
import { useWindowControls } from "./WindowFrame";
import TabStrip from "./TabStrip";

export default function TitleBar() {
  const activePath = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? "");
  const { native, maximized, busy, perform } = useWindowControls();
  const maximizeLabel = maximized ? "Restore window" : "Maximize window";

  return (
    <header className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region aria-hidden="true" />
      <TabStrip />
      <div className="titlebar-drag" data-tauri-drag-region title={activePath} />
      {!native && <span className="preview-label">Browser preview</span>}
      <div className="titlebar-actions" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} role="group" aria-label="Window controls">
        <button className="win-btn" disabled={busy} onClick={() => void perform("minimize")} title="Minimize" aria-label="Minimize"><Minus size={15} /></button>
        <button className="win-btn" disabled={busy} onClick={() => void perform("maximize")} title={maximizeLabel} aria-label={maximizeLabel}>
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button className="win-btn win-btn-close" disabled={busy} onClick={() => void perform("close")} title="Close window" aria-label="Close window"><X size={16} /></button>
      </div>
    </header>
  );
}
