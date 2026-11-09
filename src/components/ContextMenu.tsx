import { useEffect, useRef } from "react";
import * as React from "react";
import { useAppStore } from "@/state/store";
import { FolderOpen, Copy, Scissors, ClipboardPaste, Pencil, Trash2, Info, Star, RefreshCw, Eye, Terminal, ExternalLink, Hash, HardDrive, LayoutGrid, File, Sparkles } from "lucide-react";

export default function ContextMenu() {
  const store = useAppStore();
  const menu = store.contextMenu!;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent | PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        store.closeContextMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") store.closeContextMenu(); };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [store]);

  // position adjustment
  const style: React.CSSProperties = { left: menu.x, top: menu.y };
  if (typeof window !== "undefined") {
    const w = 240;
    const maxH = Math.min(window.innerHeight - 32, menu.items.length * 32 + 16);
    if (menu.x + w > window.innerWidth) style.left = Math.max(8, window.innerWidth - w - 8);
    if (menu.y + maxH > window.innerHeight) style.top = Math.max(8, window.innerHeight - maxH - 8);
    style.maxHeight = `${window.innerHeight - 24}px`;
  }

  return (
    <div ref={ref} className="context-menu" style={style}>
      {menu.items.map((item, i) => {
        if (item.separator) return <div key={i} className="menu-sep" />;
        return (
          <div
            key={i}
            className={`menu-item ${item.danger ? "danger" : ""} ${item.disabled ? "disabled" : ""}`}
            onClick={() => { if (!item.disabled) { item.action?.(); store.closeContextMenu(); } }}
          >
            <span className="menu-icon">{item.icon ? <IconGlyph name={item.icon} /> : null}</span>
            <span>{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </div>
        );
      })}
    </div>
  );
}

function IconGlyph({ name }: { name: string }) {
  const map: Record<string, any> = {
    open: FolderOpen, copy: Copy, cut: Scissors, paste: ClipboardPaste, rename: Pencil,
    delete: Trash2, permanent: Trash2, info: Info, star: Star, refresh: RefreshCw,
    reveal: ExternalLink, terminal: Terminal, hash: Hash, newfolder: FolderOpen, newfile: File,
    preview: Eye, sort: LayoutGrid, view: LayoutGrid, newtab: FolderOpen, size: HardDrive, sparkles: Sparkles,
  };
  const Icon = map[name];
  return Icon ? <Icon size={14} /> : null;
}