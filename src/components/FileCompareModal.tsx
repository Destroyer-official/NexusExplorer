import { useEffect, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc, toErrorMessage } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { basename, dirname } from "@/lib/paths";
import type { BinaryDiffReport, HexDiffChunk } from "@/types";
import {
  X,
  GitCompare,
  ArrowLeftRight,
  RefreshCw,
  Binary,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";

export function FileCompareModal() {
  const store = useAppStore();
  const compareFiles = store.compareFiles;
  const [fileA, setFileA] = useState<string>(compareFiles?.[0] ?? "");
  const [fileB, setFileB] = useState<string>(compareFiles?.[1] ?? "");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BinaryDiffReport | null>(null);
  const [onlyDifferences, setOnlyDifferences] = useState<boolean>(false);

  useEffect(() => {
    if (compareFiles && compareFiles.length === 2) {
      setFileA(compareFiles[0]);
      setFileB(compareFiles[1]);
    }
  }, [compareFiles]);

  const runCompare = async (pathA: string, pathB: string) => {
    if (!pathA || !pathB) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ipc.toolsCompareBinary(pathA, pathB, 200);
      setReport(res);
    } catch (err) {
      setError(toErrorMessage(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fileA && fileB) {
      void runCompare(fileA, fileB);
    }
  }, [fileA, fileB]);

  // Handle keyboard escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        store.closeCompareModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [store]);

  const handleSwap = () => {
    const nextA = fileB;
    const nextB = fileA;
    setFileA(nextA);
    setFileB(nextB);
  };

  const filteredChunks = (report?.diffChunks ?? []).filter((chunk: HexDiffChunk) => {
    if (onlyDifferences) return !chunk.isMatch;
    return true;
  });

  const diffCount = (report?.diffChunks ?? []).filter((c) => !c.isMatch).length;

  return (
    <div className="overlay" onClick={() => store.closeCompareModal()}>
      <div
        className="modal"
        style={{
          width: "min(1080px, 96vw)",
          height: "min(780px, 92vh)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Binary File Compare"
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--accent-subtle)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GitCompare size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                Binary File Compare & Differ
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                Byte-by-byte comparison and hex discrepancy analyzer
              </div>
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => store.closeCompareModal()}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* File Cards & Controls */}
        <div
          style={{
            padding: "12px 18px",
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 12,
            alignItems: "center",
          }}
        >
          {/* File A Card */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-sunken)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                }}
              >
                File A
              </span>
              <button
                className="btn btn-xs"
                onClick={() => store.setHexEditorPath(fileA)}
                title="Inspect in Hex Editor"
                style={{ fontSize: 11, padding: "2px 6px" }}
              >
                <Binary size={12} />
                <span>Hex View</span>
              </button>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={fileA}
            >
              {basename(fileA) || fileA}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                {dirname(fileA)}
              </span>
              <span>{report ? formatBytes(report.sizeA) : "…"}</span>
            </div>
          </div>

          {/* Center Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
            <button
              className="btn btn-sm"
              onClick={handleSwap}
              title="Swap File A and File B"
              style={{ padding: "4px 8px" }}
            >
              <ArrowLeftRight size={14} />
            </button>
            <button
              className="btn btn-sm"
              onClick={() => void runCompare(fileA, fileB)}
              title="Refresh / Re-compare"
              disabled={loading}
              style={{ padding: "4px 8px" }}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
          </div>

          {/* File B Card */}
          <div
            style={{
              padding: "10px 14px",
              background: "var(--surface-sunken)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                }}
              >
                File B
              </span>
              <button
                className="btn btn-xs"
                onClick={() => store.setHexEditorPath(fileB)}
                title="Inspect in Hex Editor"
                style={{ fontSize: 11, padding: "2px 6px" }}
              >
                <Binary size={12} />
                <span>Hex View</span>
              </button>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={fileB}
            >
              {basename(fileB) || fileB}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                {dirname(fileB)}
              </span>
              <span>{report ? formatBytes(report.sizeB) : "…"}</span>
            </div>
          </div>
        </div>

        {/* Status & Metrics Bar */}
        {report && (
          <div
            style={{
              padding: "10px 18px",
              background: report.isIdentical ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {report.isIdentical ? (
                <>
                  <CheckCircle2 size={18} style={{ color: "var(--success, #10b981)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--success, #10b981)" }}>
                    Files are 100% Identical
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} style={{ color: "var(--danger, #ef4444)" }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--danger, #ef4444)" }}>
                    Binary Differences Detected ({report.matchingPercentage.toFixed(2)}% Match)
                  </span>
                </>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
              <div>
                <span style={{ color: "var(--text-faint)", marginRight: 4 }}>Differing bytes:</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                  {formatBytes(report.totalDifferencesBytes)} ({report.totalDifferencesBytes.toLocaleString()} bytes)
                </span>
              </div>
              {report.firstDifferenceOffset !== null && (
                <div>
                  <span style={{ color: "var(--text-faint)", marginRight: 4 }}>First mismatch:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>
                    0x{report.firstDifferenceOffset.toString(16).toUpperCase().padStart(8, "0")}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                <SlidersHorizontal size={13} style={{ color: "var(--text-faint)" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={onlyDifferences}
                    onChange={(e) => setOnlyDifferences(e.target.checked)}
                  />
                  <span>Show differences only ({diffCount})</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Body Content / Hex Chunk Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 240,
                gap: 12,
                color: "var(--text-muted)",
              }}
            >
              <RefreshCw size={24} className="spin" style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 13 }}>Comparing binary streams byte-by-byte…</span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "16px 20px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--danger)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                fontSize: 13,
              }}
            >
              <strong>Comparison Error:</strong> {error}
            </div>
          )}

          {!loading && !error && report && (
            <>
              {report.isIdentical ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 260,
                    gap: 12,
                    textAlign: "center",
                  }}
                >
                  <CheckCircle2 size={44} style={{ color: "var(--success, #10b981)" }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                    Zero Discrepancies Found
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 440 }}>
                    Both files share identical size, content, and byte stream structure. All {formatBytes(report.sizeA)} match completely.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr 24px 1fr",
                      gap: 8,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-faint)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span>Offset</span>
                    <span>File A (Hex / ASCII)</span>
                    <span style={{ textAlign: "center" }}>•</span>
                    <span>File B (Hex / ASCII)</span>
                  </div>

                  {filteredChunks.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      No difference chunks matching filter.
                    </div>
                  ) : (
                    filteredChunks.map((chunk, idx) => {
                      const isDiff = !chunk.isMatch;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "100px 1fr 24px 1fr",
                            gap: 8,
                            padding: "8px 12px",
                            borderRadius: "var(--radius-sm)",
                            fontFamily: "monospace",
                            fontSize: 12,
                            alignItems: "center",
                            background: isDiff ? "rgba(239, 68, 68, 0.08)" : "var(--surface)",
                            border: isDiff ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid transparent",
                          }}
                        >
                          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                            0x{chunk.offset.toString(16).toUpperCase().padStart(8, "0")}
                          </span>
                          <div style={{ display: "flex", gap: 10, overflow: "hidden" }}>
                            <span style={{ color: isDiff ? "var(--danger, #ef4444)" : "var(--text)" }}>
                              {chunk.leftHex}
                            </span>
                            <span style={{ color: "var(--text-faint)" }}>|</span>
                            <span style={{ color: "var(--text-muted)" }}>{chunk.leftAscii}</span>
                          </div>
                          <span
                            style={{
                              textAlign: "center",
                              color: isDiff ? "var(--danger, #ef4444)" : "var(--success, #10b981)",
                              fontWeight: 700,
                            }}
                          >
                            {isDiff ? "≠" : "="}
                          </span>
                          <div style={{ display: "flex", gap: 10, overflow: "hidden" }}>
                            <span style={{ color: isDiff ? "var(--danger, #ef4444)" : "var(--text)" }}>
                              {chunk.rightHex}
                            </span>
                            <span style={{ color: "var(--text-faint)" }}>|</span>
                            <span style={{ color: "var(--text-muted)" }}>{chunk.rightAscii}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            Press <kbd style={{ padding: "1px 5px", background: "var(--surface)", borderRadius: 3, border: "1px solid var(--border)" }}>Esc</kbd> to exit differ
          </div>
          <button className="btn btn-primary" onClick={() => store.closeCompareModal()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
