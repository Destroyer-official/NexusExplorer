import { useEffect, useState, useCallback } from "react";
import { ipc } from "@/lib/ipc";
import type { HexSlice } from "@/types";
import { formatBytes } from "@/lib/format";
import { X, Save, RefreshCw, ChevronLeft, ChevronRight, Binary } from "lucide-react";

interface HexEditorModalProps {
  filePath: string;
  onClose: () => void;
}

const PAGE_SIZE = 1024; // 1 KB window (64 lines of 16 bytes)

export default function HexEditorModal({ filePath, onClose }: HexEditorModalProps) {
  const [slice, setSlice] = useState<HexSlice | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [modifiedIndices, setModifiedIndices] = useState<Map<number, number>>(new Map());
  const [jumpInput, setJumpInput] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadChunk = useCallback(async (newOffset: number) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const data = await ipc.readHexSlice(filePath, newOffset, PAGE_SIZE);
      setSlice(data);
      setOffset(newOffset);
      setModifiedIndices(new Map());
    } catch (e: any) {
      setStatusMsg(`Error loading chunk: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    loadChunk(0);
  }, [loadChunk]);

  const handleByteChange = (localIndex: number, newByteVal: number) => {
    if (!slice) return;
    const nextMap = new Map(modifiedIndices);
    nextMap.set(localIndex, newByteVal);
    setModifiedIndices(nextMap);
  };

  const handleSave = async () => {
    if (!slice || modifiedIndices.size === 0) return;
    setLoading(true);
    try {
      // Find modified contiguous or individual bytes and write
      for (const [localIdx, val] of modifiedIndices.entries()) {
        await ipc.writeHexSlice(filePath, offset + localIdx, [val]);
      }
      setStatusMsg("Changes successfully saved!");
      await loadChunk(offset);
    } catch (e: any) {
      setStatusMsg(`Save error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    let parsed = 0;
    const clean = jumpInput.trim();
    if (clean.startsWith("0x") || clean.startsWith("0X")) {
      parsed = parseInt(clean.slice(2), 16);
    } else {
      parsed = parseInt(clean, 10);
    }
    if (!isNaN(parsed) && parsed >= 0) {
      if (slice && parsed >= slice.totalBytes) {
        parsed = Math.max(0, slice.totalBytes - PAGE_SIZE);
      }
      // Align to 16 bytes
      const aligned = Math.floor(parsed / 16) * 16;
      loadChunk(aligned);
    }
  };

  const totalBytes = slice?.totalBytes ?? 0;
  const currentBytes = slice ? slice.bytes.slice() : [];
  for (const [idx, val] of modifiedIndices.entries()) {
    if (idx < currentBytes.length) {
      currentBytes[idx] = val;
    }
  }

  // Group into 16-byte lines
  const lines: { lineOffset: number; bytes: number[] }[] = [];
  for (let i = 0; i < currentBytes.length; i += 16) {
    lines.push({
      lineOffset: offset + i,
      bytes: currentBytes.slice(i, i + 16),
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: 840, maxWidth: "95vw", height: 600, display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Binary size={18} color="var(--accent)" />
          <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>In-Place Hex Editor: </span>
            <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{filePath}</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            {formatBytes(totalBytes)} ({totalBytes.toLocaleString()} bytes)
          </span>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              className="btn btn-sm"
              disabled={offset <= 0 || loading}
              onClick={() => loadChunk(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft size={14} /> Prev 1KB
            </button>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
              0x{offset.toString(16).padStart(8, "0")} - 0x{Math.min(totalBytes, offset + PAGE_SIZE).toString(16).padStart(8, "0")}
            </span>
            <button
              className="btn btn-sm"
              disabled={offset + PAGE_SIZE >= totalBytes || loading}
              onClick={() => loadChunk(offset + PAGE_SIZE)}
            >
              Next 1KB <ChevronRight size={14} />
            </button>
          </div>

          <form onSubmit={handleJump} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="text"
              placeholder="Jump (0x... or dec)"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              style={{
                width: 140,
                fontSize: 12,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
              }}
            />
            <button type="submit" className="btn btn-sm">Go</button>
          </form>

          <span style={{ flex: 1 }} />

          {modifiedIndices.size > 0 && (
            <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 500 }}>
              {modifiedIndices.size} bytes modified
            </span>
          )}

          <button
            className="btn btn-sm btn-primary"
            disabled={modifiedIndices.size === 0 || loading}
            onClick={handleSave}
          >
            <Save size={14} /> Save Changes
          </button>
          <button className="icon-btn" title="Reload chunk" onClick={() => loadChunk(offset)}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Hex Grid Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            background: "var(--bg-card)",
            userSelect: "text",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-dim)", padding: 40 }}>Loading bytes...</div>
          ) : lines.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-dim)", padding: 40 }}>Empty file (0 bytes)</div>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ width: 90, paddingBottom: 6 }}>Offset</th>
                  <th style={{ width: 440, paddingBottom: 6 }}>
                    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F
                  </th>
                  <th style={{ width: 180, paddingBottom: 6 }}>Decoded Text</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((ln) => {
                  return (
                    <tr key={ln.lineOffset} style={{ height: 22 }}>
                      {/* Offset column */}
                      <td style={{ color: "var(--text-dim)", userSelect: "none" }}>
                        0x{ln.lineOffset.toString(16).padStart(8, "0").toUpperCase()}
                      </td>

                      {/* Hex bytes column */}
                      <td style={{ letterSpacing: 1.5 }}>
                        {Array.from({ length: 16 }).map((_, byteIdx) => {
                          const hasByte = byteIdx < ln.bytes.length;
                          const b = hasByte ? ln.bytes[byteIdx] : null;
                          const localIdx = (ln.lineOffset - offset) + byteIdx;
                          const isMod = modifiedIndices.has(localIdx);

                          return (
                            <span
                              key={byteIdx}
                              style={{
                                display: "inline-block",
                                width: 22,
                                marginRight: byteIdx === 7 ? 10 : 2,
                                textAlign: "center",
                                color: isMod
                                  ? "var(--accent)"
                                  : b === 0
                                  ? "var(--text-faint)"
                                  : "var(--text)",
                                fontWeight: isMod ? 700 : 400,
                                background: isMod ? "var(--accent-subtle)" : "transparent",
                                borderRadius: 2,
                                cursor: hasByte ? "pointer" : "default",
                              }}
                              onClick={() => {
                                if (!hasByte || b === null) return;
                                const currentHex = b.toString(16).padStart(2, "0").toUpperCase();
                                const nextHex = window.prompt(`Edit byte at 0x${(ln.lineOffset + byteIdx).toString(16).toUpperCase()}:`, currentHex);
                                if (nextHex !== null) {
                                  const parsed = parseInt(nextHex.trim(), 16);
                                  if (!isNaN(parsed) && parsed >= 0 && parsed <= 255) {
                                    handleByteChange(localIdx, parsed);
                                  }
                                }
                              }}
                            >
                              {b !== null ? b.toString(16).padStart(2, "0").toUpperCase() : "  "}
                            </span>
                          );
                        })}
                      </td>

                      {/* ASCII text representation */}
                      <td
                        style={{
                          color: "var(--text-dim)",
                          whiteSpace: "pre",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ln.bytes.map((b, byteIdx) => {
                          const localIdx = (ln.lineOffset - offset) + byteIdx;
                          const isMod = modifiedIndices.has(localIdx);
                          const char = b >= 32 && b <= 126 ? String.fromCharCode(b) : "·";
                          return (
                            <span
                              key={byteIdx}
                              style={{
                                color: isMod ? "var(--accent)" : char === "·" ? "var(--text-faint)" : "var(--text)",
                                fontWeight: isMod ? 700 : 400,
                              }}
                            >
                              {char}
                            </span>
                          );
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            fontSize: 12,
            color: "var(--text-dim)",
          }}
        >
          <span>Click any byte to edit its hexadecimal value. Changes are written directly on disk upon clicking Save.</span>
          <span style={{ flex: 1 }} />
          {statusMsg && (
            <span style={{ color: statusMsg.includes("error") ? "var(--error)" : "var(--success)" }}>
              {statusMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
