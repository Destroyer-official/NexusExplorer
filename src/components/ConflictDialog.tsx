import { useState } from "react";
import { useAppStore } from "@/state/store";
import { formatBytes, formatDate } from "@/lib/format";
import { basename } from "@/lib/paths";

export default function ConflictDialog() {
  const store = useAppStore();
  const c = store.conflict!;
  const [applyAll, setApplyAll] = useState(false);

  const resolve = (r: "skip" | "overwrite" | "keepBoth") => void store.resolveConflict(r, applyAll);

  if (!c) return null;

  const isSourceNewer = c.sourceModifiedMs > c.destModifiedMs;
  const isDestNewer = c.destModifiedMs > c.sourceModifiedMs;
  const isSameSize = c.sourceSize === c.destSize;
  const isIdentical = isSameSize && Math.abs(c.sourceModifiedMs - c.destModifiedMs) < 2000;

  return (
    <div className="overlay" style={{ zIndex: 110 }}>
      <div className="modal" style={{ width: 540 }}>
        <div className="modal-header">
          <div className="modal-title">File Conflict Detected</div>
        </div>
        <div className="modal-body">
          <p style={{ margin: "0 0 14px", color: "var(--text-dim)", fontSize: 13 }}>
            <strong style={{ color: "var(--text)" }}>{basename(c.source)}</strong> already exists in the destination folder.
          </p>

          <div className="conflict-grid">
            <div
              className="conflict-card"
              style={{
                border: isSourceNewer ? "1px solid var(--accent)" : undefined,
                background: isSourceNewer ? "rgba(124,108,255,0.06)" : undefined,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h5 style={{ margin: 0 }}>Incoming (Source)</h5>
                {isSourceNewer && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.15)", padding: "1px 6px", borderRadius: 3 }}>
                    ⚡ Newer
                  </span>
                )}
              </div>
              <div className="conflict-name truncate" title={c.source}>{basename(c.source)}</div>
              <div className="conflict-meta">
                {formatBytes(c.sourceSize)} · {formatDate(c.sourceModifiedMs)}
              </div>
            </div>

            <div
              className="conflict-card"
              style={{
                border: isDestNewer ? "1px solid var(--accent)" : undefined,
                background: isDestNewer ? "rgba(124,108,255,0.06)" : undefined,
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h5 style={{ margin: 0 }}>Existing (Destination)</h5>
                {isDestNewer && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.15)", padding: "1px 6px", borderRadius: 3 }}>
                    ⚠️ Newer
                  </span>
                )}
              </div>
              <div className="conflict-name truncate" title={c.destination}>{basename(c.destination)}</div>
              <div className="conflict-meta">
                {formatBytes(c.destSize)} · {formatDate(c.destModifiedMs)}
              </div>
            </div>
          </div>

          {isIdentical && (
            <div style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "var(--surface)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-faint)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span>ℹ️ Files appear identical in size and modification timestamp.</span>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-dim)", cursor: "pointer", marginTop: 8 }}>
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            <span>Apply this resolution to all remaining conflicts</span>
          </label>
        </div>

        <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => resolve("skip")}>Skip</button>
          <button className="btn" onClick={() => resolve("keepBoth")}>Keep Both (Auto-Rename)</button>
          <button className="btn btn-primary" onClick={() => resolve("overwrite")}>
            {isSourceNewer ? "⚡ Replace (Source Newer)" : "Replace"}
          </button>
        </div>
      </div>
    </div>
  );
}