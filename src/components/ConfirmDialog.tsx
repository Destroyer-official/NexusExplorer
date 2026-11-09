import { useRef, useState } from "react";
import { useAppStore } from "@/state/store";
import { toErrorMessage } from "@/lib/ipc";

export default function ConfirmDialog() {
  const config = useAppStore((state) => state.confirm);
  const close = useAppStore((state) => state.closeConfirm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  if (!config) return null;

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await config.onConfirm();
      if (useAppStore.getState().confirm === config) close();
    } catch (cause) { setError(toErrorMessage(cause)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return (
    <div className="overlay confirmation-overlay" onClick={() => { if (!busy) close(); }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"
        onClick={(event) => event.stopPropagation()} style={{ width: 440 }}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape" && !busy) close(); }}>
        <div className="modal-header"><div id="confirm-title" className="modal-title">{config.title}</div></div>
        <div className="modal-body">
          <p id="confirm-description" className="dialog-description">{config.description}</p>
          {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" autoFocus disabled={busy} onClick={close}>Cancel</button>
          <button className={`btn ${config.danger ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={() => void submit()}>{busy ? "Working…" : config.confirmLabel ?? "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}
