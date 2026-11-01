import { useAppStore } from "@/state/store";
import { iconForEntry } from "@/lib/fileIcons";
import { formatBytes, formatDate } from "@/lib/format";

export default function SecondaryPane() {
  const store = useAppStore();
  const entries = store.secondaryEntries;
  const path = store.secondaryPath;
  const loading = store.secondaryLoading;

  return (
    <div
      className="main"
      style={{ borderLeft: "1px solid var(--border)", cursor: "default" }}
      onClick={() => store.setActivePane(1)}
    >
      <div className="toolbar" style={{ height: 40 }}>
        <span style={{ fontSize: 12, color: "var(--text-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{path}</span>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => store.navigateSecondary(path.split("\\").slice(0, -1).join("\\") || path)}>↑</button>
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => void store.refreshSecondary()}>↻</button>
      </div>
      <div className="viewport" data-pane-id="secondary" data-drop-path={path}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : (
          <div className="filelist">
            <div className="filelist-head">
              <div>Name</div><div>Modified</div><div>Type</div><div>Size</div>
            </div>
            {entries.map((e) => {
              const { Icon, tone } = iconForEntry(e, false);
              return (
                <div
                  key={e.path}
                  className={`row ${store.secondarySelected.includes(e.path) ? "selected" : ""}`}
                  onPointerDown={() => {
                    if (store.secondarySelected.includes(e.path)) useAppStore.setState({ secondarySelected: store.secondarySelected.filter((p) => p !== e.path) });
                    else useAppStore.setState({ secondarySelected: [...store.secondarySelected, e.path] });
                  }}
                  onDoubleClick={() => { if (e.isDir) void store.navigateSecondary(e.path); }}
                >
                  <div className="row-name-cell">
                    <span className={`file-icon tone-${tone}`}><Icon size={16} strokeWidth={1.7} /></span>
                    <span className="row-name">{e.name}</span>
                  </div>
                  <div className="row-col">{formatDate(e.modifiedMs)}</div>
                  <div className="row-col">{e.isDir ? "Folder" : e.ext.toUpperCase()}</div>
                  <div className="row-col">{e.isDir ? "—" : formatBytes(e.size)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}