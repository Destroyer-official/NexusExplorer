import { useEffect, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc, toErrorMessage } from "@/lib/ipc";
import type { CaseTransformation, RenamePlanItem } from "@/types";
import { AlertCircle, ArrowRight, Check, X } from "lucide-react";

export default function BatchRenameDialog() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const selected = tab?.selected ?? [];

  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [template, setTemplate] = useState("<name>");
  const [caseStyle, setCaseStyle] = useState<CaseTransformation>("none");
  const [plan, setPlan] = useState<RenamePlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Update preview via Rust renamer engine whenever parameters change
  useEffect(() => {
    if (selected.length === 0) {
      setPlan([]);
      return;
    }

    let active = true;
    setLoading(true);
    setPreviewError(null);

    const timer = setTimeout(async () => {
      try {
        const preview = await ipc.toolsRenamePreview(
          selected,
          find.trim() ? find : null,
          replace,
          template.trim() ? template : null,
          caseStyle,
        );
        if (active) {
          setPlan(preview);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setPreviewError(toErrorMessage(err));
          setLoading(false);
        }
      }
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selected, find, replace, template, caseStyle]);

  const changedCount = plan.filter((i) => i.isChanged && i.isValid).length;
  const invalidCount = plan.filter((i) => !i.isValid).length;

  const handleExecute = async () => {
    if (changedCount === 0 || invalidCount > 0 || executing) return;
    setExecuting(true);
    try {
      const tx = await ipc.toolsRenameExecute(plan);
      store.pushToast(
        "success",
        "Batch Rename Complete",
        `Successfully renamed ${tx.items.length} item(s).`,
      );
      await store.refreshActive();
      await store.refreshUndoStatus();
      store.clearSelection();
      store.setBatchRenameOpen(false);
    } catch (err) {
      store.pushToast("error", "Batch Rename Failed", toErrorMessage(err));
    } finally {
      setExecuting(false);
    }
  };

  const addToken = (token: string) => {
    setTemplate((prev) => (prev ? `${prev}${token}` : token));
  };

  return (
    <div className="overlay" onClick={() => store.setBatchRenameOpen(false)}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 680, maxHeight: "90vh" }}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <div>
            <div className="modal-title">Batch Rename</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              {selected.length} items selected
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => store.setBatchRenameOpen(false)}
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Find & Replace */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Find (regex or text)</label>
              <input
                className="input"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="e.g. IMG_ or ^\d+_"
              />
            </div>
            <div className="field">
              <label>Replace with</label>
              <input
                className="input"
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                placeholder="replacement string"
              />
            </div>
          </div>

          {/* Template & Quick Tokens */}
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              <label>Rename Pattern Template</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="kbd"
                  style={{ cursor: "pointer" }}
                  onClick={() => addToken("<counter:001>")}
                  title="Sequential Counter (e.g. 001, 002)"
                >
                  + Counter
                </button>
                <button
                  type="button"
                  className="kbd"
                  style={{ cursor: "pointer" }}
                  onClick={() => addToken("<date>")}
                  title="Current Date (YYYY-MM-DD)"
                >
                  + Date
                </button>
                <button
                  type="button"
                  className="kbd"
                  style={{ cursor: "pointer" }}
                  onClick={() => addToken("<name>")}
                  title="Original Filename Stem"
                >
                  + Name
                </button>
                <button
                  type="button"
                  className="kbd"
                  style={{ cursor: "pointer" }}
                  onClick={() => addToken("<folder>")}
                  title="Parent Directory Name"
                >
                  + Folder
                </button>
                <button
                  type="button"
                  className="kbd"
                  style={{ cursor: "pointer" }}
                  onClick={() => addToken("<ext>")}
                  title="File Extension"
                >
                  + Ext
                </button>
              </div>
            </div>
            <input
              className="input"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="e.g. Doc_<date>_<counter:001>"
            />
            {/* Quick Presets */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Presets:</span>
              {[
                { label: "Date + Counter", tmpl: "<date>_<counter:001>" },
                { label: "Name + Date", tmpl: "<name>_<date>" },
                { label: "Backup Copy", tmpl: "<name>_backup_<date>" },
                { label: "Folder + Counter", tmpl: "<folder>_<counter:001>" },
                { label: "Clean Original", tmpl: "<name>" },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setTemplate(p.tmpl)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "2px 7px",
                    fontSize: 10,
                    color: "var(--text-dim)",
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Case Transformation */}
          <div className="field">
            <label>Case Transformation</label>
            <select
              className="input"
              value={caseStyle}
              onChange={(e) => setCaseStyle(e.target.value as CaseTransformation)}
              style={{ cursor: "pointer" }}
            >
              <option value="none">Original Case (No Change)</option>
              <option value="lowercase">lowercase (e.g. my-file.txt)</option>
              <option value="uppercase">UPPERCASE (e.g. MY-FILE.TXT)</option>
              <option value="titleCase">Title Case (e.g. My File.txt)</option>
              <option value="camelCase">camelCase (e.g. myFile.txt)</option>
              <option value="snakeCase">snake_case (e.g. my_file.txt)</option>
              <option value="kebabCase">kebab-case (e.g. my-file.txt)</option>
            </select>
          </div>

          {/* Error Banner */}
          {previewError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.12)",
                borderRadius: "var(--radius-md)",
                color: "var(--danger)",
                fontSize: 12,
              }}
            >
              <AlertCircle size={14} />
              <span>{previewError}</span>
            </div>
          )}

          {/* Preview Table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--text-faint)",
                fontWeight: 600,
              }}
            >
              <span>Preview ({plan.length} items)</span>
              <span>
                {loading
                  ? "Computing..."
                  : invalidCount > 0
                    ? `${invalidCount} collision(s)`
                    : `${changedCount} to rename`}
              </span>
            </div>

            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface)",
              }}
            >
              {selected.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                  No items selected. Select files in the folder and reopen Batch Rename.
                </div>
              ) : plan.length === 0 && loading ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                  Generating preview…
                </div>
              ) : (
                plan.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 20px 1fr auto",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderBottom:
                      idx < plan.length - 1 ? "1px solid var(--border-soft)" : "none",
                    fontSize: 12,
                    background: !item.isValid
                      ? "rgba(239, 68, 68, 0.08)"
                      : item.isChanged
                        ? "transparent"
                        : "rgba(0,0,0,0.02)",
                  }}
                >
                  <span
                    className="truncate mono"
                    title={item.originalName}
                    style={{ color: "var(--text-dim)" }}
                  >
                    {item.originalName}
                  </span>
                  <ArrowRight size={12} style={{ color: "var(--text-faint)" }} />
                  <span
                    className="truncate mono"
                    title={item.newName}
                    style={{
                      color: !item.isValid
                        ? "var(--danger)"
                        : item.isChanged
                          ? "var(--accent)"
                          : "var(--text-faint)",
                      fontWeight: item.isChanged ? 600 : 400,
                    }}
                  >
                    {item.newName}
                  </span>
                  <div>
                    {!item.isValid ? (
                      <span
                        title={item.errorMessage}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "var(--danger)",
                          fontSize: 11,
                        }}
                      >
                        <AlertCircle size={12} />
                        {item.errorMessage}
                      </span>
                    ) : item.isChanged ? (
                      <Check size={12} style={{ color: "var(--success)" }} />
                    ) : (
                      <span style={{ color: "var(--text-faint)", fontSize: 11 }}>unchanged</span>
                    )}
                  </div>
                </div>
              )))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={() => store.setBatchRenameOpen(false)}
            disabled={executing}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void handleExecute()}
            disabled={changedCount === 0 || invalidCount > 0 || executing || loading}
          >
            {executing
              ? "Renaming..."
              : changedCount > 0
                ? `Rename ${changedCount} items`
                : "No Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
