import { FolderClosed, Lock } from "lucide-react";
import { useAppStore } from "@/state/store";
import { basename } from "@/lib/paths";

const COLOR_HEX: Record<string, string> = {
  blue: "#38bdf8",
  emerald: "#10b981",
  orange: "#f59e0b",
  purple: "#a855f7",
  rose: "#f43f5e",
};

export default function TabStrip() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const activateTab = useAppStore((s) => s.activateTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const openTab = useAppStore((s) => s.openTab);
  const toggleLockTab = useAppStore((s) => s.toggleLockTab);
  const setTabColorGroup = useAppStore((s) => s.setTabColorGroup);
  const openContextMenu = useAppStore((s) => s.openContextMenu);
  const drives = useAppStore((s) => s.drives);
  const knownFolders = useAppStore((s) => s.knownFolders);

  return (
    <div className="tabstrip">
      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? "active" : ""}`}
            style={{
              borderTop: tab.colorGroup ? `3px solid ${COLOR_HEX[tab.colorGroup] || tab.colorGroup}` : undefined,
              position: "relative",
            }}
            onClick={() => activateTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1 && !tab.isLocked) void closeTab(tab.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openContextMenu(e.clientX, e.clientY, [
                {
                  id: "toggle-lock",
                  label: tab.isLocked ? "Unlock Tab" : "Lock Tab (Pinned)",
                  action: () => toggleLockTab(tab.id),
                },
                {
                  id: "color-none",
                  label: "Clear Color Group",
                  action: () => setTabColorGroup(tab.id, null),
                },
                {
                  id: "color-blue",
                  label: "Color Group: Blue",
                  action: () => setTabColorGroup(tab.id, "blue"),
                },
                {
                  id: "color-emerald",
                  label: "Color Group: Emerald",
                  action: () => setTabColorGroup(tab.id, "emerald"),
                },
                {
                  id: "color-orange",
                  label: "Color Group: Orange",
                  action: () => setTabColorGroup(tab.id, "orange"),
                },
                {
                  id: "color-purple",
                  label: "Color Group: Purple",
                  action: () => setTabColorGroup(tab.id, "purple"),
                },
                {
                  id: "color-rose",
                  label: "Color Group: Rose",
                  action: () => setTabColorGroup(tab.id, "rose"),
                },
                {
                  id: "duplicate",
                  label: "Duplicate Tab",
                  action: () => void openTab(tab.path, true),
                },
                {
                  id: "close",
                  label: "Close Tab",
                  danger: true,
                  disabled: tab.isLocked || tabs.length <= 1,
                  action: () => void closeTab(tab.id),
                },
              ]);
            }}
          >
            <FolderClosed size={14} style={{ color: "var(--accent)" }} />
            <span className="tab-title">{tab.title || basename(tab.path)}</span>
            {tab.isLocked && (
              <span title="Pinned / Locked Tab" style={{ display: "inline-flex", opacity: 0.75 }}>
                <Lock size={11} style={{ color: "var(--accent)" }} />
              </span>
            )}
            {!tab.isLocked && tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  void closeTab(tab.id);
                }}
                title="Close Tab"
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        className="tab-add"
        onClick={() => {
          const home =
            knownFolders.find((f) => f.id === "home")?.path ??
            drives.find((d) => d.isReady)?.path ??
            "C:\\";
          void openTab(home, true);
        }}
        title="New tab (Ctrl+T)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}