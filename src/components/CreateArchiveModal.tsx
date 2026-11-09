import { useState, useMemo } from "react";
import { useAppStore } from "@/state/store";
import { ipc, toErrorMessage } from "@/lib/ipc";
import { dirname, basename } from "@/lib/paths";
import { Archive, X, Check, FileArchive } from "lucide-react";

const FORMAT_OPTIONS: { id: string; label: string; ext: string; description: string }[] = [
  { id: "zip", label: "ZIP Archive", ext: ".zip", description: "Native pure Rust engine, universal cross-platform support" },
  { id: "7z", label: "7-Zip Archive", ext: ".7z", description: "High-ratio LZMA2 compression via 7-Zip engine" },
  { id: "tar.gz", label: "Tarball (tar.gz)", ext: ".tar.gz", description: "Standard Linux and container archive format" },
  { id: "tar", label: "TAR Archive", ext: ".tar", description: "Uncompressed POSIX tape archive packaging" },
];

const COMPRESSION_LEVELS: { level: number; label: string }[] = [
  { level: 0, label: "0 - Store (No compression)" },
  { level: 1, label: "1 - Fastest" },
  { level: 3, label: "3 - Fast" },
  { level: 5, label: "5 - Normal (Recommended)" },
  { level: 7, label: "7 - Maximum" },
  { level: 9, label: "9 - Ultra" },
];

export function CreateArchiveModal() {
  const store = useAppStore();
  const sources = store.createArchivePaths ?? [];
  const firstSource = sources[0] ?? "";
  const targetDir = firstSource ? dirname(firstSource) : "";

  const defaultBaseName = useMemo(() => {
    if (sources.length === 1 && firstSource) {
      return basename(firstSource);
    }
    if (targetDir) {
      return basename(targetDir);
    }
    return "archive";
  }, [sources, firstSource, targetDir]);

  const [archiveName, setArchiveName] = useState(defaultBaseName);
  const [format, setFormat] = useState("zip");
  const [level, setLevel] = useState(5);
  const [busy, setBusy] = useState(false);

  const selectedFormat = FORMAT_OPTIONS.find((f) => f.id === format) ?? FORMAT_OPTIONS[0];

  const fullDestination = useMemo(() => {
    const raw = archiveName.trim() || "archive";
    const cleaned = raw.replace(/\.(zip|7z|tar\.gz|tar|tgz)$/i, "");
    const ext = selectedFormat.ext;
    const finalName = `${cleaned}${ext}`;
    return targetDir ? `${targetDir}\\${finalName}` : finalName;
  }, [archiveName, selectedFormat, targetDir]);

  const handleCreate = async () => {
    if (sources.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await ipc.toolsArchiveCreateAny(sources, fullDestination, level, format);
      store.pushToast(
        "success",
        "Archive Created",
        `Created ${basename(fullDestination)} with ${res.filesProcessed} items (${(res.bytesProcessed / (1024 * 1024)).toFixed(1)} MB) in ${res.elapsedMs} ms.`,
      );
      await store.refreshActive();
      store.setCreateArchivePaths(null);
    } catch (err) {
      store.pushToast("error", "Archive Creation Failed", toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay confirmation-overlay" onClick={() => !busy && store.setCreateArchivePaths(null)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-archive-title"
        style={{ width: 520 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) store.setCreateArchivePaths(null);
          if (e.key === "Enter" && !busy) {
            e.preventDefault();
            void handleCreate();
          }
        }}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <div id="create-archive-title" className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileArchive size={16} color="var(--accent)" />
            <span>Create Archive</span>
          </div>
          <span style={{ flex: 1 }} />
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => !busy && store.setCreateArchivePaths(null)}
            disabled={busy}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            Compressing <strong>{sources.length}</strong> selected item{sources.length === 1 ? "" : "s"} into a compressed archive package.
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="archive-name-input" style={{ fontSize: 12, fontWeight: 600 }}>Archive File Name</label>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                id="archive-name-input"
                className="input"
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                placeholder="archive"
                disabled={busy}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 600, paddingRight: 4 }}>
                {selectedFormat.ext}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
              Target: {fullDestination}
            </span>
          </div>

          {/* Format selection */}
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Archive Format</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {FORMAT_OPTIONS.map((f) => (
                <div
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={format === f.id}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    cursor: busy ? "default" : "pointer",
                    border: format === f.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: format === f.id ? "var(--accent-subtle, rgba(56, 189, 248, 0.10))" : "var(--bg-2)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                  onClick={() => !busy && setFormat(f.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!busy) setFormat(f.id);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: format === f.id ? "var(--accent)" : "var(--text)" }}>
                      {f.label}
                    </span>
                    {format === f.id && <Check size={13} style={{ color: "var(--accent)" }} />}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.2 }}>
                    {f.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Compression Level */}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="compression-select" style={{ fontSize: 12, fontWeight: 600 }}>Compression Level</label>
            <select
              id="compression-select"
              className="input"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              disabled={busy}
              style={{ fontSize: 13 }}
            >
              {COMPRESSION_LEVELS.map((c) => (
                <option key={c.level} value={c.level}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => store.setCreateArchivePaths(null)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCreate()}
            disabled={busy || !archiveName.trim()}
          >
            <Archive size={14} style={{ marginRight: 4 }} />
            {busy ? "Compressing…" : "Create Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateArchiveModal;

