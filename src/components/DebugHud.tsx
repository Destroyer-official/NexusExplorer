import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/state/store";
import { formatBytes } from "@/lib/format";

interface PerfSample {
  fps: number;
  frameMs: number;
  heapMb: number | null;
  domNodes: number;
}

export default function DebugHud() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [sample, setSample] = useState<PerfSample>({ fps: 0, frameMs: 0, heapMb: null, domNodes: 0 });
  const [expanded, setExpanded] = useState(false);
  const frame = useRef(0);
  const last = useRef(performance.now());
  const acc = useRef(0);
  const count = useRef(0);

  useEffect(() => {
    if (!store.debugHud) return;
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const delta = now - last.current;
      last.current = now;
      frame.current += 1;
      acc.current += delta;
      count.current += 1;
      if (acc.current >= 500) {
        const avg = acc.current / count.current;
        const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        setSample({
          fps: Math.round(1000 / Math.max(avg, 0.01)),
          frameMs: Math.round(avg * 100) / 100,
          heapMb: memory ? Math.round(memory.usedJSHeapSize / 1_048_576) : null,
          domNodes: document.getElementsByTagName("*").length,
        });
        acc.current = 0;
        count.current = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [store.debugHud]);

  if (!store.debugHud) return null;

  const rows: [string, string][] = [
    ["fps", `${sample.fps}`],
    ["frame", `${sample.frameMs} ms`],
    ["heap", sample.heapMb === null ? "n/a" : `${sample.heapMb} MB`],
    ["dom", `${sample.domNodes}`],
    ["entries", `${activeTab?.entries.length ?? 0}`],
    ["selected", `${activeTab?.selected.length ?? 0}`],
    ["tabs", `${store.tabs.length}`],
    ["staged", `${store.stagingPaths.length}`],
    ["transfers", `${Object.keys(store.transfers).length}`],
    ["view", `${store.settings.view}${store.flatView ? " · flat" : ""}`],
  ];

  return (
    <div className="debug-hud" style={{ cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div className="hud-title">Nexus performance {expanded ? "▾" : "▸"}</div>
      {rows.map(([key, value]) => (
        <div key={key} className="hud-row">
          <span className="hud-key">{key}</span>
          <span>{value}</span>
        </div>
      ))}
      {expanded && (
        <div style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
          <div className="hud-row"><span className="hud-key">path</span><span style={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={activeTab?.path}>{activeTab?.path ?? "—"}</span></div>
          <div className="hud-row"><span className="hud-key">loading</span><span>{activeTab?.loading ? "yes" : "no"}</span></div>
          <div className="hud-row"><span className="hud-key">flat time</span><span>{store.flatListing ? `${store.flatListing.elapsedMs} ms` : "—"}</span></div>
          <div className="hud-row"><span className="hud-key">flat total</span><span>{store.flatListing ? formatBytes(store.flatListing.totalBytes) : "—"}</span></div>
          <div className="hud-row"><span className="hud-key">terminal</span><span>{store.terminalOpen ? "open" : "closed"}</span></div>
          <div className="hud-row"><span className="hud-key">tool modals</span><span>{[store.powerToolsOpen && "power", store.scaffoldOpen && "scaffold", store.smartFolderOpen && "smart"].filter(Boolean).join(", ") || "none"}</span></div>
        </div>
      )}
    </div>
  );
}
