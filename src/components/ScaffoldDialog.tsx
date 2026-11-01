import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc, toErrorMessage } from "@/lib/ipc";
import type { ScaffoldCatalog, ScaffoldResult } from "@/types";
import { FolderPlus, Sparkles, Wand2, X } from "lucide-react";

const SAMPLE = `app/
  api/
    routes.py
    models.py
  main.py
docs/
  README.md
requirements.txt`;

function countSpec(spec: string) {
  const lines = spec.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
  const dirs = lines.filter((line) => /[\\/]$/.test(line.trim())).length;
  return { total: lines.length, dirs, files: lines.length - dirs };
}

export default function ScaffoldDialog() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [base, setBase] = useState(activeTab?.path ?? "");
  const [spec, setSpec] = useState(SAMPLE);
  const [catalog, setCatalog] = useState<ScaffoldCatalog | null>(null);
  const [result, setResult] = useState<ScaffoldResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single nested item helper
  const [itemName, setItemName] = useState("");

  useEffect(() => {
    if (!store.scaffoldOpen) return;
    setBase(activeTab?.path ?? "");
    setResult(null);
    setError(null);
    void (async () => {
      try {
        setCatalog(await ipc.toolsScaffoldCatalog());
      } catch {
        setCatalog(null);
      }
    })();
  }, [store.scaffoldOpen, activeTab?.path]);

  const stats = useMemo(() => countSpec(spec), [spec]);

  const create = async () => {
    if (!base || !spec.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const created = await ipc.toolsBatchScaffold(base, spec);
      setResult(created);
      await store.refreshActive();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createSingle = async (isDir: boolean) => {
    const rel = itemName.trim();
    if (!base || !rel) return;
    setBusy(true);
    setError(null);
    try {
      if (isDir) await ipc.toolsNestedFolder(base, rel);
      else await ipc.toolsNestedFile(base, rel);
      store.pushToast("success", isDir ? "Folder created" : "File created", rel);
      setItemName("");
      await store.refreshActive();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!store.scaffoldOpen) return null;

  return (
    <div className="overlay" onClick={() => store.setScaffoldOpen(false)}>
      <div
        className="modal"
        style={{ width: "min(900px, 96vw)", height: "min(700px, 92vh)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Wand2 size={17} color="var(--accent)" />
          <div className="modal-title" style={{ flex: 1 }}>Project scaffolding</div>
          <button className="icon-btn" onClick={() => store.setScaffoldOpen(false)}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4>Destination</h4>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" value={base} onChange={(e) => setBase(e.target.value)} placeholder="Base folder" />
              <button className="btn" disabled={!activeTab} onClick={() => setBase(activeTab?.path ?? "")}>Use current folder</button>
            </div>
          </div>

          {catalog && catalog.presets.length > 0 && (
            <div className="modal-section">
              <h4>Start from a preset</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {catalog.presets.map((preset) => (
                  <button key={preset.name} className="btn btn-sm" onClick={() => { setSpec(preset.spec); setResult(null); }}>
                    <Sparkles size={12} /> {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="modal-section">
            <h4>Structure definition</h4>
            <textarea
              className="input"
              style={{ minHeight: 230, fontFamily: "var(--font-mono)", fontSize: 12, resize: "vertical", lineHeight: 1.55 }}
              value={spec}
              onChange={(e) => { setSpec(e.target.value); setResult(null); }}
              spellCheck={false}
            />
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-faint)", marginTop: 6, flexWrap: "wrap" }}>
              <span>{stats.dirs} folder(s)</span>
              <span>{stats.files} file(s)</span>
              <span>Indent with 2 spaces to nest. Trailing <code>/</code> marks a folder. Lines starting with <code>#</code> are ignored.</span>
            </div>
            {catalog && catalog.templates.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-faint)" }}>
                Template content is applied automatically for: {catalog.templates.map((t) => t.extension).join(", ")}
              </div>
            )}
          </div>

          <div className="modal-section">
            <h4>Create a single nested item</h4>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. deep/nested/path/file.py"
                onKeyDown={(e) => { if (e.key === "Enter") void createSingle(false); }}
              />
              <button className="btn" disabled={busy || !itemName.trim()} onClick={() => void createSingle(true)}>
                <FolderPlus size={13} /> Folder
              </button>
              <button className="btn" disabled={busy || !itemName.trim()} onClick={() => void createSingle(false)}>File</button>
            </div>
          </div>

          {error && <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>}

          {result && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 12 }}>
              <div style={{ display: "flex", gap: 18, marginBottom: 8 }}>
                <span style={{ color: "var(--success)" }}>{result.createdDirs.length} folder(s)</span>
                <span style={{ color: "var(--success)" }}>{result.createdFiles.length} file(s)</span>
                {result.errors.length > 0 && <span style={{ color: "var(--danger)" }}>{result.errors.length} error(s)</span>}
              </div>
              <div style={{ maxHeight: 150, overflow: "auto", color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {[...result.createdDirs, ...result.createdFiles].map((path) => <div key={path}>{path}</div>)}
                {result.errors.map((message) => <div key={message} style={{ color: "var(--danger)" }}>{message}</div>)}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => store.setScaffoldOpen(false)}>Close</button>
          <button className="btn btn-primary" disabled={busy || !base || !spec.trim()} onClick={() => void create()}>
            {busy ? "Creating…" : `Create ${stats.total} item(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
