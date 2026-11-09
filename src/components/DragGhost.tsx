import { useDragState } from "@/lib/dnd";
import { useAppStore } from "@/state/store";
import { basename, samePath } from "@/lib/paths";
import { iconForEntry } from "@/lib/fileIcons";
import { Folder, File } from "lucide-react";

export default function DragGhost() {
  const drag = useDragState();
  const store = useAppStore();

  if (!drag.active || drag.paths.length === 0) return null;

  const firstPath = drag.paths[0];
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const foundEntry =
    activeTab?.entries.find((e) => samePath(e.path, firstPath)) ??
    store.secondaryEntries.find((e) => samePath(e.path, firstPath));

  const fileName = foundEntry?.name ?? basename(firstPath);
  const isDir = foundEntry ? foundEntry.isDir : !fileName.includes(".");
  const ext = foundEntry ? foundEntry.ext : (fileName.includes(".") ? fileName.split(".").pop() || "" : "");

  const entryForIcon = foundEntry ?? {
    name: fileName,
    path: firstPath,
    parentPath: "",
    isDir,
    size: 0,
    modifiedMs: Date.now(),
    createdMs: Date.now(),
    ext,
  };

  const { Icon, tone } = iconForEntry(entryForIcon, false);
  const count = drag.paths.length;

  return (
    <div
      className="drag-ghost"
      style={{
        left: drag.x,
        top: drag.y,
        pointerEvents: "none",
        zIndex: 99999,
      }}
    >
      <div className="drag-ghost-icon-wrap">
        {isDir ? (
          <Folder size={18} style={{ color: "#38bdf8", fill: "rgba(56,189,248,0.25)" }} />
        ) : Icon ? (
          <span className={`file-icon tone-${tone}`} style={{ display: "inline-flex" }}>
            <Icon size={18} />
          </span>
        ) : (
          <File size={18} style={{ color: "var(--text-dim)" }} />
        )}
      </div>

      <span className="drag-ghost-title" title={fileName}>
        {fileName}
      </span>

      {count > 1 && (
        <span className="drag-ghost-badge">
          +{count - 1}
        </span>
      )}
    </div>
  );
}
