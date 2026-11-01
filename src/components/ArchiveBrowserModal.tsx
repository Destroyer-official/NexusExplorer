import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc, toErrorMessage } from "@/lib/ipc";
import { formatBytes, formatDate } from "@/lib/format";
import { basename, dirname, joinPath, stripExtension } from "@/lib/paths";
import type { ArchiveMetadata, Par2ValidationReport } from "@/types";
import { Archive, ArrowUpFromLine, FileArchive, FolderOutput, Search, ShieldCheck, X } from "lucide-react";

export default function ArchiveBrowserModal() {
  const store = useAppStore();
  const archivePath = store.archivePath;
  const [meta, setMeta] = useState<ArchiveMetadata | null>(null);
  const [par2Report, setPar2Report] = useState<Par2ValidationReport | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState("");

  useEffect(() => {
    if (!archivePath) {
      setMeta(null);
      setPar2Report(null);
      setError(null);
      setFilter("");
      return;
    }
    setDest(joinPath(dirname(archivePath), stripExtension(basename(archivePath))));
    setLoading(true);
    setError(null);
    setMeta(null);
    setPar2Report(null);

    ipc
      .toolsArchiveListAny(archivePath)
      .then(setMeta)
      .catch((err) => setError(toErrorMessage(err)))
      .finally(() => setLoading(false));

    // Inspect companion PAR2 parity files if present
    const par2Path = `${archivePath}.par2`;
    ipc.toolsPar2Inspect(par2Path)
      .then((rep) => {
        if (rep?.isValid) setPar2Report(rep);
        else {
          const altPar2 = `${stripExtension(archivePath)}.par2`;
          ipc.toolsPar2Inspect(altPar2).then((alt) => {
            if (alt?.isValid) setPar2Report(alt);
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [archivePath]);

  const entries = useMemo(() => {
    if (!meta) return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return meta.entries;
    return meta.entries.filter((entry) => entry.path.toLowerCase().includes(needle));
  }, [meta, filter]);

  if (!archivePath) return null;

  const extract = async () => {
    if (!archivePath) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ipc.toolsArchiveExtractAny(archivePath, dest);
      store.pushToast("success", "Archive extracted", `${result.filesProcessed} file(s) → ${result.destinationPath}`);
      await store.refreshActive();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const close = () => store.setArchivePath(null);

  return (
    <div className="overlay" onClick={close}>
      <div
        className="modal"
        style={{ width: "min(980px, 96vw)", height: "min(720px, 92vh)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileArchive size={17} color="var(--accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="modal-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {basename(archivePath)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {meta ? `${String(meta.format).toUpperCase()} · ${meta.totalFiles} files · ${meta.totalDirectories} folders · ${formatBytes(meta.uncompressedBytes)} (${formatBytes(meta.compressedBytes)} packed)` : archivePath}
            </div>
          </div>
          {par2Report && par2Report.isValid && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#10b981",
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
              title={`Reed-Solomon PAR2 Redundancy Set: ${par2Report.recoverySetId}\nProtected files: ${par2Report.totalDataFiles}\nRecovery slices: ${par2Report.recoverySlicesAvailable}`}
            >
              <ShieldCheck size={13} />
              <span>PAR2 Protected ({par2Report.recoverySlicesAvailable} slices)</span>
            </div>
          )}
          <button className="icon-btn" onClick={close}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
          <Search size={14} color="var(--text-faint)" />
          <input
            className="input"
            style={{ flex: 1 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter entries…"
          />
          <span style={{ fontSize: 11, color: "var(--text-faint)", minWidth: 70, textAlign: "right" }}>
            {entries.length} / {meta?.entries.length ?? 0}
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          {loading && <div style={{ padding: 24, color: "var(--text-faint)", fontSize: 13 }}>Reading archive…</div>}
          {error && (
            <div style={{ padding: 22 }}>
              <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{error}</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Non-ZIP formats (7z, RAR, TAR, ISO…) require 7-Zip to be installed so Nexus can delegate to its
                <code> 7z.exe </code> engine.
              </div>
            </div>
          )}
          {meta && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 150px", gap: 10, padding: "6px 16px", position: "sticky", top: 0, background: "var(--bg-2)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--text-faint)" }}>
                <span>Name</span>
                <span style={{ textAlign: "right" }}>Size</span>
                <span style={{ textAlign: "right" }}>Packed</span>
                <span>CRC / date</span>
              </div>
              {entries.map((entry) => (
                <div
                  key={entry.path}
                  style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 150px", gap: 10, padding: "5px 16px", borderBottom: "1px solid var(--border)", fontSize: 12 }}
                  title={entry.path}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                    <Archive size={12} color={entry.isDirectory ? "var(--accent)" : "var(--text-faint)"} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.path}
                      {entry.isDirectory ? "/" : ""}
                    </span>
                  </span>
                  <span style={{ textAlign: "right", color: "var(--text-faint)" }}>{entry.isDirectory ? "—" : formatBytes(entry.uncompressedSize)}</span>
                  <span style={{ textAlign: "right", color: "var(--text-faint)" }}>{entry.isDirectory ? "—" : formatBytes(entry.compressedSize)}</span>
                  <span style={{ color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.crc32 || (entry.modifiedMs ? formatDate(entry.modifiedMs) : "—")}
                  </span>
                </div>
              ))}
              {entries.length === 0 && (
                <div style={{ padding: 24, color: "var(--text-faint)", fontSize: 13 }}>No entries match this filter.</div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <FolderOutput size={14} color="var(--text-faint)" />
          <input className="input" style={{ flex: 1, minWidth: 220 }} value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Destination folder" />
          <button className="btn" onClick={() => setDest(joinPath(dirname(archivePath), stripExtension(basename(archivePath))))}>
            Reset
          </button>
          <button className="btn btn-primary" disabled={busy || !dest} onClick={() => void extract()}>
            <ArrowUpFromLine size={13} /> {busy ? "Extracting…" : "Extract all"}
          </button>
        </div>
      </div>
    </div>
  );
}
