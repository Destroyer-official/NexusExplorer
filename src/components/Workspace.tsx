import { useEffect } from "react";
import { useAppStore } from "@/state/store";
import Sidebar from "@/components/Sidebar";
import ExplorerView from "@/components/ExplorerView";
import PreviewPane from "@/components/PreviewPane";
import SecondaryPane from "@/components/SecondaryPane";
import { FaytBar } from "@/components/FaytBar";

export default function Workspace() {
  const previewOpen = useAppStore((s) => s.previewOpen);
  const dualPane = useAppStore((s) => s.dualPane);
  const dualScrollLocked = useAppStore((s) => s.dualScrollLocked);
  const paneLayout = useAppStore((s) => s.paneLayout);

  const isVertical = paneLayout === "dual-v";
  const isQuad = paneLayout === "quad";
  const isTriple = paneLayout === "triple";

  useEffect(() => {
    if (!dualPane || !dualScrollLocked) return;
    const primary = document.querySelector<HTMLElement>('[data-pane-id="primary"]');
    const secondary = document.querySelector<HTMLElement>('[data-pane-id="secondary"]');
    if (!primary || !secondary) return;

    let isSyncingPrimary = false;
    let isSyncingSecondary = false;

    const handlePrimaryScroll = () => {
      if (isSyncingPrimary) return;
      isSyncingSecondary = true;
      secondary.scrollTop = primary.scrollTop;
      requestAnimationFrame(() => {
        isSyncingSecondary = false;
      });
    };

    const handleSecondaryScroll = () => {
      if (isSyncingSecondary) return;
      isSyncingPrimary = true;
      primary.scrollTop = secondary.scrollTop;
      requestAnimationFrame(() => {
        isSyncingPrimary = false;
      });
    };

    primary.addEventListener("scroll", handlePrimaryScroll, { passive: true });
    secondary.addEventListener("scroll", handleSecondaryScroll, { passive: true });

    return () => {
      primary.removeEventListener("scroll", handlePrimaryScroll);
      secondary.removeEventListener("scroll", handleSecondaryScroll);
    };
  }, [dualPane, dualScrollLocked]);

  return (
    <div className="workspace">
      <Sidebar />
      <div
        className="main"
        style={{
          display: "grid",
          gridTemplateColumns:
            isVertical || !dualPane
              ? "1fr"
              : isQuad
                ? "1fr 1fr"
                : isTriple
                  ? "1.2fr 1fr"
                  : "1fr 1fr",
          gridTemplateRows:
            isVertical || isTriple
              ? "1fr 1fr"
              : isQuad
                ? "1fr 1fr"
                : "1fr",
          flex: 1,
          minWidth: 0,
          gap: 1,
          background: "var(--border)",
        }}
      >
        <div
          style={{ minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)", gridRow: isTriple ? "1 / 3" : undefined }}
          onClick={() => useAppStore.getState().setActivePane(0)}
        >
          <ExplorerView />
        </div>
        {dualPane && (
          <div
            style={{ minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}
          >
            <SecondaryPane paneId="secondary" />
          </div>
        )}
        {dualPane && (isQuad || isTriple) && (
          <div
            style={{ minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}
          >
            <SecondaryPane paneId="tertiary" />
          </div>
        )}
        {dualPane && isQuad && (
          <div
            style={{ minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}
          >
            <SecondaryPane paneId="quaternary" />
          </div>
        )}
      </div>
      {/* Unified Right Inspector Pane — single panel housing Preview, Actions, Shelf & Drop, Git, and Details */}
      {previewOpen && <PreviewPane />}
      <FaytBar />
    </div>
  );
}
