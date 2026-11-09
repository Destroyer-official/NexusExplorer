import { useEffect, useState } from "react";
import type { GitFileDiff } from "@/types";
import { ipc } from "@/lib/ipc";
import { Plus, Minus, RefreshCw } from "lucide-react";

interface GitDiffPreviewProps {
  filePath: string;
  repoRoot?: string;
}

export default function GitDiffPreview({ filePath, repoRoot }: GitDiffPreviewProps) {
  const [diff, setDiff] = useState<GitFileDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadDiff = async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const d = await ipc.toolsGitDiff(filePath);
      setDiff(d);
    } catch (e: any) {
      console.warn("Git diff failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiff();
  }, [filePath]);

  const handleAction = async (action: "stage" | "unstage" | "discard") => {
    if (!repoRoot) return;
    try {
      await ipc.toolsGitAction(repoRoot, action, [filePath]);
      setActionMsg(`Git ${action} complete.`);
      await loadDiff();
    } catch (e: any) {
      setActionMsg(`Action error: ${e?.message || e}`);
    }
  };

  if (loading) {
    return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: 8 }}>Computing Git diff...</div>;
  }

  if (!diff || (diff.additions === 0 && diff.deletions === 0 && diff.lines.length === 0)) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-dim)", padding: 12, textAlign: "center" }}>
        No uncommitted git changes for this file.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxHeight: 320 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <span style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: 2 }}>
          <Plus size={12} /> {diff.additions}
        </span>
        <span style={{ color: "var(--error)", display: "flex", alignItems: "center", gap: 2 }}>
          <Minus size={12} /> {diff.deletions}
        </span>

        <span style={{ flex: 1 }} />

        {repoRoot && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="btn btn-sm" onClick={() => handleAction("stage")} title="Stage in git">
              Stage
            </button>
            <button className="btn btn-sm" onClick={() => handleAction("discard")} title="Revert / Discard uncommitted changes">
              Discard
            </button>
          </div>
        )}

        <button className="icon-btn" onClick={loadDiff} title="Refresh diff">
          <RefreshCw size={12} />
        </button>
      </div>

      {actionMsg && (
        <div style={{ fontSize: 11, color: "var(--accent)" }}>{actionMsg}</div>
      )}

      {/* Diff viewer */}
      {diff.isBinary ? (
        <div style={{ fontSize: 11, color: "var(--text-dim)", padding: 8 }}>Binary file modification detected.</div>
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: 250,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {diff.lines.map((ln, idx) => {
            const rawType = ln.lineType ?? (ln as any).kind ?? "context";
            const isAdd = rawType === "add";
            const isDel = rawType === "del" || rawType === "delete";
            const isHeader = rawType === "header";
            const text = ln.text ?? (ln as any).content ?? "";

            const bg = isAdd
              ? "rgba(34, 197, 94, 0.12)"
              : isDel
              ? "rgba(239, 68, 68, 0.12)"
              : isHeader
              ? "var(--bg-subtle)"
              : "transparent";

            const color = isAdd
              ? "#4ade80"
              : isDel
              ? "#f87171"
              : isHeader
              ? "var(--text-faint)"
              : "var(--text)";

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  background: bg,
                  color: color,
                  padding: "1px 4px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                <span
                  style={{
                    width: 32,
                    userSelect: "none",
                    color: "var(--text-faint)",
                    fontSize: 10,
                    textAlign: "right",
                    marginRight: 8,
                  }}
                >
                  {ln.newLineNum ?? (ln as any).newLineNumber ?? ln.oldLineNum ?? (ln as any).oldLineNumber ?? ""}
                </span>
                <span style={{ width: 14, userSelect: "none", fontWeight: 700 }}>
                  {isAdd ? "+" : isDel ? "-" : " "}
                </span>
                <span style={{ flex: 1 }}>{text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
