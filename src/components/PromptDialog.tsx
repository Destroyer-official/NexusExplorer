import { useEffect, useState } from "react";
import { useAppStore } from "@/state/store";

export default function PromptDialog() {
  const store = useAppStore();
  const config = store.prompt!;
  const [value, setValue] = useState(config.value);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const err = config.validate?.(value) ?? null;
    if (err) { setError(err); return; }
    await config.onConfirm(value);
    store.closePrompt();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") store.closePrompt(); if (e.key === "Enter") void submit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="overlay" onClick={() => store.closePrompt()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><div className="modal-title">{config.title}</div></div>
        <div className="modal-body">
          {config.description && <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 0 }}>{config.description}</p>}
          <div className="field">
            <label>{config.label}</label>
            <input className="input" value={value} placeholder={config.placeholder} autoFocus
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
            {error && <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => store.closePrompt()}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void submit()}>{config.confirmLabel ?? "OK"}</button>
        </div>
      </div>
    </div>
  );
}