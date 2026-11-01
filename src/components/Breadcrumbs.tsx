import { useEffect, useRef, useState } from "react";
import { ChevronRight, HardDrive } from "lucide-react";
import { useAppStore } from "@/state/store";
import { splitPath } from "@/lib/paths";
import { beginDrag } from "@/lib/dnd";

export default function Breadcrumbs() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const path = activeTab?.path ?? "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(path);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => {
      setEditing(true);
      setValue(path);
      setTimeout(() => inputRef.current?.select(), 0);
    };
    window.addEventListener("nexus:focus-address", handler);
    return () => window.removeEventListener("nexus:focus-address", handler);
  }, [path]);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setValue(path); }, [path, editing]);

  const segments = splitPath(path);

  const commit = () => {
    const trimmed = value.trim();
    setEditing(false);
    if (trimmed && trimmed !== path) void store.navigateTo(trimmed);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="address-edit"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setValue(path); }
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <div className="breadcrumbs" onDoubleClick={() => { setEditing(true); setValue(path); }}>
      {segments.map((seg, idx) => (
        <span key={seg.path} style={{ display: "flex", alignItems: "center", gap: 2 }} data-drop-path={seg.path}>
          {idx > 0 && <ChevronRight size={12} className="crumb-sep" />}
          <span
            className={`crumb ${idx === segments.length - 1 ? "current" : ""}`}
            onClick={() => void store.navigateTo(seg.path)}
            onPointerDown={(e) => beginDrag([seg.path], e.clientX, e.clientY)}
            title={seg.path}
          >
            {idx === 0 && <HardDrive size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />}
            {seg.label}
          </span>
        </span>
      ))}
    </div>
  );
}