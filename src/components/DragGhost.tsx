import { useDragState } from "@/lib/dnd";

export default function DragGhost() {
  const drag = useDragState();
  if (!drag.active) return null;
  return (
    <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2h4v4H2zM8 2h4v4H8zM2 8h4v4H2zM8 8h4v4H8z" fill="currentColor" opacity=".6"/></svg>
      {drag.paths.length} item{drag.paths.length === 1 ? "" : "s"}
    </div>
  );
}