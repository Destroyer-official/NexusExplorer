import { visibleEntries } from "@/lib/entries";
import { FileList } from "@/components/FileList";
import { FileGrid } from "@/components/FileGrid";
import FlatList from "@/components/FlatList";
import SearchResults from "@/components/SearchResults";
import { MillerColumns } from "@/components/MillerColumns";
import { useAppStore } from "@/state/store";

export default function ExplorerView() {
  const searchOpen = useAppStore((s) => s.search.open);
  const settings = useAppStore((s) => s.settings);
  const flatView = useAppStore((s) => s.flatView);
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  if (searchOpen) return <SearchResults />;
  if (flatView) return <FlatList />;
  if (!activeTab) return null;
  if (activeTab.view === "columns") return <MillerColumns />;
  if (activeTab.loading && activeTab.entries.length === 0) {
    return (
      <div className="viewport" data-drop-path={activeTab.path}>
        <div className="empty-state"><div>Loading…</div></div>
      </div>
    );
  }
  if (activeTab.error) {
    return (
      <div className="viewport" data-drop-path={activeTab.path}>
        <div className="empty-state">
          <h3>Could not open this folder</h3>
          <p>{activeTab.error}</p>
          <button className="btn btn-primary" onClick={() => void useAppStore.getState().refreshActive()}>Retry</button>
        </div>
      </div>
    );
  }
  const rows = activeTab.entries;
  const visible = visibleEntries(activeTab, settings);
  if (visible.length === 0 && rows.length > 0) return (
    <div className="viewport"><div className="empty-state">
      <h3>{activeTab.quickFilter ? "No matching files" : "Files are hidden"}</h3>
      <p>{activeTab.quickFilter ? "Try another name or clear the folder filter." : "Check hidden and system file settings to show these items."}</p>
      {activeTab.quickFilter && <button className="btn" onClick={() => useAppStore.getState().setQuickFilter("")}>Clear filter</button>}
    </div></div>
  );
  if (visible.length === 0 && rows.length === 0) {
    return (
      <div className="viewport" data-drop-path={activeTab.path}>
        <div className="empty-state">
          <h3>This folder is empty</h3>
          <p>Drop files here or use the toolbar to create a new folder.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => void useAppStore.getState().createFolder()}>New folder</button>
            <button className="btn" onClick={() => void useAppStore.getState().createFile()}>New file</button>
          </div>
        </div>
      </div>
    );
  }
  return activeTab.view === "grid" ? <FileGrid /> : <FileList />;
}