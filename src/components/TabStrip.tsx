import { FolderClosed, Lock, Search } from "lucide-react";
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
  const renameTab = useAppStore((s) => s.renameTab);
  const closeOtherTabs = useAppStore((s) => s.closeOtherTabs);
  const closeTabsToRight = useAppStore((s) => s.closeTabsToRight);
  const openPrompt = useAppStore((s) => s.openPrompt);
  const pushToast = useAppStore((s) => s.pushToast);
  const copyText = useAppStore((s) => s.copyText);
  const openContextMenu = useAppStore((s) => s.openContextMenu);
  const drives = useAppStore((s) => s.drives);
  const knownFolders = useAppStore((s) => s.knownFolders);

  return (
    <div className="tabstrip">
      <div className="tab-list" role="tablist" aria-label="Folders">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab" aria-selected={tab.id === activeTabId} tabIndex={0}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateTab(tab.id); }
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const offset = event.key === "ArrowRight" ? 1 : -1;
                const next = tabs[(tabs.indexOf(tab) + offset + tabs.length) % tabs.length];
                activateTab(next.id);
                const sibling = event.currentTarget.parentElement?.children[(tabs.indexOf(tab) + offset + tabs.length) % tabs.length];
                if (sibling instanceof HTMLElement) sibling.focus();
              }
            }}
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
                  id: "rename-tab",
                  label: "Rename Tab...",
                  action: () => {
                    openPrompt({
                      title: "Rename Tab",
                      description: "Enter a custom title for this tab workflow, or leave blank to restore default folder name.",
                      label: "Tab Name",
                      value: tab.title || basename(tab.path),
                      confirmLabel: "Rename",
                      onConfirm: (newName) => {
                        renameTab(tab.id, newName);
                        pushToast("info", "Tab Renamed", newName ? `Renamed to "${newName}"` : "Restored default name");
                      },
                    });
                  },
                },
                {
                  id: "copy-tab-path",
                  label: "Copy Tab Path",
                  action: () => {
                    void copyText(tab.path, "Tab path copied");
                  },
                },
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
                {
                  id: "close-others",
                  label: "Close Other Tabs",
                  disabled: tabs.length <= 1,
                  action: () => closeOtherTabs(tab.id),
                },
                {
                  id: "close-right",
                  label: "Close Tabs to the Right",
                  disabled: tabs.indexOf(tab) >= tabs.length - 1,
                  action: () => closeTabsToRight(tab.id),
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
        onClick={() => useAppStore.getState().setTabSearchOpen(true)}
        title="Search & Switch Open Tabs (Ctrl+Shift+A)"
        aria-label="Search & Switch Open Tabs"
      >
        <Search size={13} />
      </button>
      <button
        className="tab-add"
        onClick={() => {
          const home =
            knownFolders.find((f) => f.id === "home")?.path ??
            drives.find((d) => d.isReady)?.path ??
            "C:\\";
          void openTab(home, true, false);
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
