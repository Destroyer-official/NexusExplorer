import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { useAppStore } from "@/state/store";
import type { Toast } from "@/state/store";

export default function Toasts({ toasts }: { toasts: Toast[] }) {
  const dismissToast = useAppStore((s) => s.dismissToast);
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-kind-${t.kind}`}>
          <div className="toast-bar" />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {t.kind === "success" && <CheckCircle2 size={14} color="var(--success)" />}
              {t.kind === "warning" && <AlertTriangle size={14} color="var(--warning)" />}
              {t.kind === "error" && <XCircle size={14} color="var(--danger)" />}
              {t.kind === "info" && <Info size={14} color="var(--accent)" />}
              <div className="toast-title">{t.title}</div>
            </div>
            {t.message && <div className="toast-msg">{t.message}</div>}
          </div>
          <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => dismissToast(t.id)}><X size={12} /></button>
        </div>
      ))}
    </div>
  );
}