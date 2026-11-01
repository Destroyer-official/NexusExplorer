import { useAppStore } from "@/state/store";

export default function ConfirmDialog() {
  const store = useAppStore();
  const config = store.confirm!;
  return (
    <div className="overlay" onClick={() => store.closeConfirm()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <div className="modal-header"><div className="modal-title">{config.title}</div></div>
        <div className="modal-body"><p style={{ margin: 0, color: "var(--text-dim)", fontSize: 13 }}>{config.description}</p></div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => store.closeConfirm()}>Cancel</button>
          <button className={`btn ${config.danger ? "btn-danger" : "btn-primary"}`} onClick={() => { void config.onConfirm(); store.closeConfirm(); }}>{config.confirmLabel ?? "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}