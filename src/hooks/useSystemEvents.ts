import { useEffect } from "react";
import { useAppStore } from "@/state/store";
import { ipc, isTauri } from "@/lib/ipc";

export function useSystemEvents() {
  const handleFsChange = useAppStore((s) => s.handleFsChange);
  const openPaths = useAppStore((s) => s.openPaths);
  const activePath = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.path ?? "");

  useEffect(() => {
    if (!isTauri()) return;
    let un1: (() => void) | null = null;
    let un2: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ path: string }>("fs-change", (e) => handleFsChange(e.payload.path)).then((fn) => { un1 = fn; }).catch(() => undefined);
      listen<{ paths: string[] }>("open-paths", (e) => { void openPaths(e.payload.paths); }).then((fn) => { un2 = fn; }).catch(() => undefined);
    }).catch(() => undefined);
    return () => { un1?.(); un2?.(); };
  }, [handleFsChange, openPaths]);

  useEffect(() => {
    if (!activePath || !isTauri()) return;
    void ipc.watchDir(activePath).catch(() => undefined);
    return () => {
      void ipc.unwatchDir(activePath).catch(() => undefined);
    };
  }, [activePath]);
}
