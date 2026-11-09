import { useRef, useState } from "react";
import { useAppStore } from "@/state/store";
import { toErrorMessage } from "@/lib/ipc";

export default function PromptDialog() {
  const config = useAppStore((state) => state.prompt);
  const close = useAppStore((state) => state.closePrompt);
  const [value, setValue] = useState(config?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  if (!config) return null;

  const submit = async () => {
    if (submitting.current) return;
    const invalid = config.validate?.(value) ?? null;
    if (invalid) { setError(invalid); return; }
    submitting.current = true;
    setBusy(true);
    try {
      await config.onConfirm(value);
      if (useAppStore.getState().prompt === config) close();
    } catch (cause) {
      setError(toErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="overlay confirmation-overlay" onClick={() => { if (!busy) close(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="prompt-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape" && !busy) close();
        }}
        onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="modal-header"><div id="prompt-title" className="modal-title">{config.title}</div></div>
        <div className="modal-body">
          {config.description && <p className="dialog-description">{config.description}</p>}
          <div className="field">
            <label htmlFor="prompt-value">{config.label}</label>
            <input id="prompt-value" className="input" value={value} placeholder={config.placeholder} autoFocus disabled={busy}
              aria-invalid={Boolean(error)} aria-describedby={error ? "prompt-error" : undefined}
              onChange={(event) => { setValue(event.target.value); setError(null); }} />
            {error && <span id="prompt-error" role="alert" style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={close}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Working…" : config.confirmLabel ?? "OK"}</button>
        </div>
      </form>
    </div>
  );
}
