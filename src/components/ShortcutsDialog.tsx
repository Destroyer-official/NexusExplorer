import { useAppStore } from "@/state/store";
import { X } from "lucide-react";

const GROUPS: { title: string; rows: [string, string][] }[] = [
  { title: "Navigation & Power Modes", rows: [
    ["Back / Forward", "Alt+← / Alt+→"],
    ["Up one level", "Alt+↑ or Backspace"],
    ["Refresh", "F5 or Ctrl+R"],
    ["Focus address bar", "Ctrl+L"],
    ["New tab", "Ctrl+T"],
    ["Close tab", "Ctrl+W"],
    ["Next / prev tab", "Ctrl+Tab / Ctrl+Shift+Tab"],
    ["Find-As-You-Type (FAYT)", "' (Filter) / + (Global) / > (Shell) / ] (Jump)"],
    ["Vim Navigation Engine", "h / j / k / l, gg (Top), G (End), y (Yank), p (Paste)"],
    ["Gamepad Controls", "D-Pad, A (Open), B (Back), Bumpers (Switch Tabs)"],
  ]},
  { title: "Files & Forensics", rows: [
    ["Open", "Enter or double-click"],
    ["Rename", "F2"],
    ["Delete", "Delete"],
    ["Permanent delete", "Shift+Delete"],
    ["Copy / Cut / Paste", "Ctrl+C / X / V"],
    ["Select all", "Ctrl+A"],
    ["New folder", "Ctrl+Shift+N"],
    ["Undo / Redo", "Ctrl+Z / Ctrl+Y"],
    ["Staging Shelf", "Ctrl+Shift+X"],
    ["Batch Rename Dialog", "Ctrl+Shift+R"],
  ]},
  { title: "Views & Tools", rows: [
    ["List / Grid / Columns view", "Ctrl+1 / Ctrl+2 / Ctrl+3"],
    ["Search files", "Ctrl+F"],
    ["Command palette", "Ctrl+Shift+P"],
    ["AI File Copilot", "Ctrl+K"],
    ["Power tools (Duplicates, Hashes, Shredder)", "Ctrl+Alt+P"],
    ["Flat branch view", "Ctrl+Shift+F"],
    ["Toggle docked terminal", "Ctrl+`"],
    ["Toggle sidebar", "Ctrl+B"],
    ["Toggle preview", "Ctrl+P"],
    ["Toggle hidden files", "Ctrl+H"],
    ["Settings", "Ctrl+,"],
    ["Shortcuts dialog", "Ctrl+/"],
  ]},
];

export default function ShortcutsDialog() {
  const store = useAppStore();
  return (
    <div className="overlay" onClick={() => store.setShortcutsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <div className="modal-title">Keyboard shortcuts</div>
          <span style={{ flex: 1 }} />
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => store.setShortcutsOpen(false)}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {GROUPS.map((g) => (
            <div key={g.title} style={{ marginBottom: 14 }}>
              <h4 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".8px", color: "var(--text-faint)", margin: "0 0 6px" }}>{g.title}</h4>
              <table className="shortcuts-table">
                <tbody>
                  {g.rows.map(([a, b]) => (
                    <tr key={a}><td>{a}</td><td style={{ textAlign: "right" }}><span className="kbd">{b}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}