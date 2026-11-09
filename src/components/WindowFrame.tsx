import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri, toErrorMessage } from "@/lib/ipc";

type WindowAction = "minimize" | "maximize" | "close" | "drag";
interface WindowControls {
  native: boolean;
  maximized: boolean;
  busy: boolean;
  perform: (action: WindowAction) => Promise<void>;
}
const ControlsContext = createContext<WindowControls | null>(null);

export function useWindowControls() {
  const controls = useContext(ControlsContext);
  if (!controls) throw new Error("Window controls require WindowFrame");
  return controls;
}

export default function WindowFrame({ children }: { children: ReactNode }) {
  const native = isTauri();
  const [maximized, setMaximized] = useState(false);
  const [previewState, setPreviewState] = useState<"open" | "minimized" | "closed">("open");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const win = getCurrentWindow();
    const sync = async () => {
      try {
        const value = await invoke<boolean>("window_is_maximized");
        if (!disposed) setMaximized(value);
      } catch (cause) {
        if (!disposed) setError(`Could not read window state: ${toErrorMessage(cause)}`);
      }
    };
    void sync();
    void win.onResized(() => { void sync(); }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch((cause: unknown) => {
      if (!disposed) setError(`Could not monitor window changes: ${toErrorMessage(cause)}`);
    });
    return () => { disposed = true; unlisten?.(); };
  }, [native]);

  const perform = async (action: WindowAction) => {
    if (inFlight.current) return;
    setError(null);
    if (!native) {
      if (action === "minimize") setPreviewState("minimized");
      if (action === "close") setPreviewState("closed");
      if (action === "maximize") setMaximized((value) => !value);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const win = getCurrentWindow();
      if (action === "minimize") await invoke<void>("window_minimize");
      if (action === "close") await invoke<void>("window_close");
      if (action === "drag") await win.startDragging();
      if (action === "maximize") {
        setMaximized(await invoke<boolean>("window_toggle_maximize"));
      }
    } catch (cause) {
      setError(`Could not ${action === "drag" ? "move" : action} the window: ${toErrorMessage(cause)}`);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <ControlsContext.Provider value={{ native, maximized, busy, perform }}>
      <div className={`window-frame ${native ? "native-frame" : "browser-frame"} ${maximized ? "is-maximized" : ""}`}>
        <div className="app" hidden={previewState !== "open"} inert={previewState !== "open"}>
          {children}
        </div>
        {previewState !== "open" && (
          <main className="preview-recovery">
            <img src="/nexus-logo.png" alt="NexusExplorer" />
            <h1>{previewState === "minimized" ? "Preview minimized" : "Preview closed"}</h1>
            <p>Your tabs are preserved in this browser preview.</p>
            <button className="btn btn-primary" autoFocus onClick={() => setPreviewState("open")}>
              {previewState === "minimized" ? "Restore window" : "Reopen Nexus Explorer"}
            </button>
          </main>
        )}
        {error && (
          <div className="window-error" role="alert">
            <span>{error}</span>
            <button className="btn btn-sm" onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
      </div>
    </ControlsContext.Provider>
  );
}
