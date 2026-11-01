import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/state/store";
import { formatBytes, formatDate } from "@/lib/format";
import { basename } from "@/lib/paths";
import type { SmartFolder } from "@/types";
import { FolderSearch, Pencil, Play, Plus, Trash2, X } from "lucide-react";

const EMPTY: SmartFolder = {
  id: "",
  name: "",
  root: "",
  query: "",
  isRegex: false,
  caseSensitive: false,
  extensions: [],
  includeDirectories: false,
  createdMs: 0,
};

export default function SmartFoldersModal() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [draft, setDraft] = useState<SmartFolder | null>(null);
  const [extText, setExtText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!store.smartFolderOpen) {
      setDraft(null);
    }
  }, [store.smartFolderOpen]);

  const results = store.smartFolderResults;

  const startNew = () => {
    setDraft({ ...EMPTY, root: activeTab?.path ?? "" });
    setExtText("");
  };

  const startEdit = (folder: SmartFolder) => {
    setDraft({ ...folder });
    setExtText(folder.extensions.join(", "));
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await store.saveSmartFolder({
        ...draft,
        name: draft.name.trim(),
        root: draft.root.trim(),
        extensions: extText
          .split(/[,\s]+/)
          .map((e) => e.trim().replace(/^\./, "").toLowerCase())
          .filter(Boolean),
      });
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(() => {
    if (!draft) return [];
    const sample = draft.query
      ? draft.isRegex
        ? `regex: ${draft.query}`
        : `name contains “${draft.query}”`
      : "all names";
    return [
      `Root: ${draft.root || "(pick a folder)"}`,
      `Match: ${sample}`,
      extText.trim() ? `Extensions: ${extText}` : "Extensions: any",
      draft.includeDirectories ? "Directories: included" : "Directories: skipped",
    ];
  }, [draft, extText]);

  if (!store.smartFolderOpen) return null;

  return (
    <div className="overlay" onClick={() => store.setSmartFolderOpen(false)}>
      <div
        className="modal"
        style={{ width: "min(980px, 96vw)", height: "min(720px, 92vh)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FolderSearch size={17} color="var(--accent)" />
          <div className="modal-title" style={{ flex: 1 }}>Smart folders</div>
          <button className="btn btn-sm" onClick={() => void store.refreshSmartFolders()}>Reload</button>
          <button className="btn btn-sm btn-primary" onClick={startNew}><Plus size={13} /> New</button>
          <button className="icon-btn" onClick={() => store.setSmartFolderOpen(false)}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ width: 290, borderRight: "1px solid var(--border)", overflow: "auto", flexShrink: 0 }}>
            {store.smartFolders.length === 0 && (
              <div style={{ padding: 18, fontSize: 12, color: "var(--text-faint)" }}>
                No smart folders yet. Create one to keep a live saved search — for example “All
                2026 invoices” limited to PDFs under your Documents folder.
              </div>
            )}
            {store.smartFolders.map((folder) => (
              <div
                key={folder.id}
                style={{
                  padding: "9px 12px",
                  borderBottom: "1px solid var(--border)",
                  background: results?.folder.id === folder.id ? "var(--selection)" : "transparent",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {folder.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={folder.root}>
                  {folder.root}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  {folder.query ? `“${folder.query}”` : "any name"}
                  {folder.extensions.length > 0 ? ` · ${folder.extensions.join(", ")}` : ""}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => void store.runSmartFolder(folder)}>
                    <Play size={11} /> Run
                  </button>
                  <button className="btn btn-sm" onClick={() => startEdit(folder)}><Pencil size={11} /> Edit</button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() =>
                      store.openConfirm({
                        title: `Delete “${folder.name}”?`,
                        description: "Only the saved search is removed; files on disk are untouched.",
                        confirmLabel: "Delete",
                        danger: true,
                        onConfirm: () => store.deleteSmartFolder(folder.id),
                      })
                    }
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 18 }}>
            {draft ? (
              <>
                <div className="modal-section">
                  <h4>{draft.id ? "Edit smart folder" : "New smart folder"}</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="field">
                      <label>Name</label>
                      <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 2026 PDF invoices" />
                    </div>
                    <div className="field">
                      <label>Root folder</label>
                      <input className="input" value={draft.root} onChange={(e) => setDraft({ ...draft, root: e.target.value })} placeholder="D:\Documents" />
                    </div>
                    <div className="field">
                      <label>Name filter {draft.isRegex ? "(regular expression)" : "(contains)"}</label>
                      <input className="input" value={draft.query} onChange={(e) => setDraft({ ...draft, query: e.target.value })} placeholder={draft.isRegex ? "^invoice-\\d{4}" : "invoice"} />
                    </div>
                    <div className="field">
                      <label>Extensions (comma separated, empty = all)</label>
                      <input className="input" value={extText} onChange={(e) => setExtText(e.target.value)} placeholder="pdf, docx" />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center" }}>
                      <input type="checkbox" checked={draft.isRegex} onChange={(e) => setDraft({ ...draft, isRegex: e.target.checked })} />
                      Treat filter as regex
                    </label>
                    <label style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center" }}>
                      <input type="checkbox" checked={draft.caseSensitive} onChange={(e) => setDraft({ ...draft, caseSensitive: e.target.checked })} />
                      Case sensitive
                    </label>
                    <label style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center" }}>
                      <input type="checkbox" checked={draft.includeDirectories} onChange={(e) => setDraft({ ...draft, includeDirectories: e.target.checked })} />
                      Include directories
                    </label>
                  </div>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 12, color: "var(--text-dim)" }}>
                  {preview.map((line) => <div key={line}>{line}</div>)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn btn-primary" disabled={busy || !draft.name.trim() || !draft.root.trim()} onClick={() => void save()}>
                    {draft.id ? "Save changes" : "Create smart folder"}
                  </button>
                  <button className="btn" onClick={() => setDraft(null)}>Cancel</button>
                  {draft.id && (
                    <button className="btn" onClick={() => void store.runSmartFolder({ ...draft, extensions: extText.split(/[,\s]+/).filter(Boolean) })}>
                      Preview results
                    </button>
                  )}
                </div>
              </>
            ) : results ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{results.folder.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      {results.total} item(s) · {results.elapsedMs} ms
                      {results.truncated ? " · results truncated" : ""} · {results.folder.root}
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => void store.runSmartFolder(results.folder)}>Refresh</button>
                </div>
                {results.entries.length === 0 && (
                  <div className="empty-state"><h3>No matches</h3><p>Nothing currently satisfies this saved search.</p></div>
                )}
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  {results.entries.map((entry) => (
                    <div
                      key={entry.path}
                      style={{ display: "grid", gridTemplateColumns: "1fr 110px 150px", gap: 10, alignItems: "center", padding: "6px 10px", borderBottom: "1px solid var(--border)", fontSize: 12, cursor: "pointer" }}
                      onClick={() => void store.openPaths([entry.path])}
                      title={entry.path}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.isDir ? "📁 " : ""}{basename(entry.path)}
                      </span>
                      <span style={{ color: "var(--text-faint)", textAlign: "right" }}>{entry.isDir ? "—" : formatBytes(entry.size)}</span>
                      <span style={{ color: "var(--text-faint)" }}>{formatDate(entry.modifiedMs)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h3>Select a smart folder</h3>
                <p>Run one to view live results, or create a new saved search. Smart folders are evaluated against the current filesystem every time you run them.</p>
                <button className="btn btn-primary" onClick={startNew}><Plus size={14} /> Create smart folder</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
