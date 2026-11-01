import { useEffect, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc, assetUrl } from "@/lib/ipc";
import { formatBytes, formatDate, fileTypeLabel } from "@/lib/format";
import { basename, dirname, normalizePath, samePath } from "@/lib/paths";
import { iconForEntry } from "@/lib/fileIcons";
import {
  FolderOpen,
  X,
  Hash as HashIcon,
  Terminal,
  ExternalLink,
  Calculator,
  Binary,
  Edit3,
  Save,
  Eye,
  GitBranch,
  Sparkles,
  Tag,
  Copy,
  ChevronDown,
  FileText,
  CopyPlus,
  Clock,
  Flame,
  ShieldAlert,
  Archive,
  Trash2,
  Share2,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import HexEditorModal from "@/components/HexEditorModal";
import AudioWaveformPreview from "@/components/previews/AudioWaveformPreview";
import SvgInspector from "@/components/previews/SvgInspector";
import FontPreview from "@/components/previews/FontPreview";
import GitDiffPreview from "@/components/previews/GitDiffPreview";
import StickyNotePreview from "@/components/previews/StickyNotePreview";
import Model3DPreview from "@/components/previews/Model3DPreview";
import { DocumentSummaryPreview } from "@/components/previews/DocumentSummaryPreview";
import { MediaMetadataPreview } from "@/components/previews/MediaMetadataPreview";
import { PdfViewer } from "@/components/previews/PdfViewer";
import { VideoPlayerPreview } from "@/components/previews/VideoPlayerPreview";
import StagingShelfWidget from "@/components/StagingShelfWidget";
import type { LockingProcess } from "@/types";

export default function PreviewPane() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const selected = activeTab?.selected ?? [];
  const entry = selected.length === 1 ? (activeTab?.entries.find((e) => samePath(e.path, selected[0])) ?? null) : null;
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);

  // Helper to get folder size with normalized path fallback
  const getFolderSize = (p: string) => {
    const norm = normalizePath(p);
    return store.folderSizes[p] ?? store.folderSizes[norm] ?? store.folderSizes[norm.toLowerCase()];
  };
  const getFolderTask = (p: string) => {
    const norm = normalizePath(p);
    return store.folderSizeTasks[p] ?? store.folderSizeTasks[norm] ?? store.folderSizeTasks[norm.toLowerCase()];
  };

  // In-Place Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [saving, setSaving] = useState(false);

  // View Mode: 'preview', 'git', 'summary', or 'meta'
  const [viewMode, setViewMode] = useState<"preview" | "git" | "summary" | "meta">("preview");

  // Hex Editor modal state
  const [showHexEditor, setShowHexEditor] = useState(false);

  // Rich Copy & Power Actions state
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [lockingProcesses, setLockingProcesses] = useState<LockingProcess[]>([]);
  const [terminating, setTerminating] = useState(false);
  const [isReadonly, setIsReadonly] = useState(entry?.isReadonly ?? false);
  const [isHidden, setIsHidden] = useState(entry?.isHidden ?? false);

  useEffect(() => {
    setHash(null);
    setIsEditing(false);
    setViewMode("preview");
    setCopyMenuOpen(false);
    setIsReadonly(entry?.isReadonly ?? false);
    setIsHidden(entry?.isHidden ?? false);

    if (!entry) {
      setPreview(null);
      setLockingProcesses([]);
      return;
    }

    if (entry.isDir) {
      setPreview(null);
      setLockingProcesses([]);
      if (!getFolderSize(entry.path) && !getFolderTask(entry.path)) {
        void store.calculateFolderSize(entry.path);
      }
      return;
    }

    let cancelled = false;
    setLoading(true);

    ipc
      .previewFile(entry.path)
      .then((d) => {
        if (!cancelled) {
          setPreview(d);
          if (d?.kind === "text" && d?.text) {
            setEditedText(d.text);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Check for locking processes
    ipc
      .toolsGetLockingProcesses(entry.path)
      .then((procs) => {
        if (!cancelled) setLockingProcesses(procs ?? []);
      })
      .catch(() => {
        if (!cancelled) setLockingProcesses([]);
      });

    return () => {
      cancelled = true;
    };
  }, [entry?.path, entry?.isReadonly, entry?.isHidden]);

  const close = () => store.togglePreview();

  const handleSaveText = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await ipc.writeTextFile(entry.path, editedText);
      store.pushToast("success", "Saved", `Updated ${entry.name}`);
      setIsEditing(false);
      setPreview((prev: any) => ({ ...prev, text: editedText }));
    } catch (e: any) {
      store.pushToast("error", "Save failed", e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockAndKill = async (pid: number) => {
    setTerminating(true);
    try {
      await ipc.toolsTerminateProcess(pid);
      store.pushToast("success", "Process Terminated", `Unlocked file (PID ${pid})`);
      if (entry) {
        const remaining = await ipc.toolsGetLockingProcesses(entry.path);
        setLockingProcesses(remaining ?? []);
      }
    } catch (e: any) {
      store.pushToast("error", "Unlock failed", e?.message || String(e));
    } finally {
      setTerminating(false);
    }
  };

  const handleToggleAttribute = async (type: "readonly" | "hidden") => {
    if (!entry) return;
    const newRo = type === "readonly" ? !isReadonly : isReadonly;
    const newHidden = type === "hidden" ? !isHidden : isHidden;
    try {
      await ipc.toolsSetAttributes(entry.path, newRo, newHidden, entry.isSystem, true);
      setIsReadonly(newRo);
      setIsHidden(newHidden);
      store.pushToast(
        "success",
        "Attributes Updated",
        `${entry.name} is now ${newRo ? "Read-Only" : "Writable"}${newHidden ? ", Hidden" : ""}`
      );
      await store.refreshActive();
    } catch (e: any) {
      store.pushToast("error", "Attribute update failed", e?.message || String(e));
    }
  };

  const handleCloneHere = async () => {
    if (!entry) return;
    const p = entry.path;
    const dir = dirname(p);
    const ext = entry.ext ? `.${entry.ext}` : "";
    const nameNoExt = entry.name.replace(/\.[^/.]+$/, "");
    const destPath = `${dir}\\${nameNoExt}_copy${ext}`;
    try {
      await ipc.toolsCloneFile(p, destPath);
      store.pushToast("success", "Cloned", `Created ${basename(destPath)}`);
      await store.refreshActive();
    } catch (e: any) {
      store.pushToast("error", "Clone failed", e?.message || String(e));
    }
  };

  const handleTouchNow = async () => {
    if (!entry) return;
    const now = Date.now();
    try {
      await ipc.toolsSetTimestamps(entry.path, now, now, now);
      store.pushToast("success", "Touched", `Updated timestamps for ${entry.name}`);
      await store.refreshActive();
    } catch (e: any) {
      store.pushToast("error", "Touch failed", e?.message || String(e));
    }
  };

  const handleShred = () => {
    if (!entry) return;
    store.openConfirm({
      title: "Secure Cryptographic Shred",
      description: `Permanently shred and overwrite "${entry.name}"? This cannot be undone.`,
      confirmLabel: "Shred Permanently",
      danger: true,
      onConfirm: async () => {
        try {
          await ipc.toolsShredPaths([entry.path], "dod3");
          store.pushToast("success", "Shredded", `Permanently destroyed ${entry.name}`);
          await store.refreshActive();
        } catch (e: any) {
          store.pushToast("error", "Shred failed", e?.message || String(e));
        }
      },
    });
  };

  const isFont = entry?.ext && ["ttf", "otf", "woff", "woff2"].includes(entry.ext.toLowerCase());
  const isSvg = entry?.ext && entry.ext.toLowerCase() === "svg";
  const is3D = entry?.ext && ["obj", "stl", "gltf", "glb"].includes(entry.ext.toLowerCase());
  const isAudio = preview?.kind === "audio";

  return (
    <div className="preview" data-drop-target="preview">
      {/* Header */}
      <div className="preview-header">
        <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry ? entry.name : (activeTab ? basename(activeTab.path) : "")}
        </span>
        <span style={{ flex: 1 }} />

        {entry && !entry.isDir && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 6 }}>
            <button
              className={`icon-btn ${viewMode === "preview" ? "active" : ""}`}
              onClick={() => setViewMode("preview")}
              title="Media / Text Preview"
            >
              <Eye size={14} />
            </button>
            <button
              className={`icon-btn ${viewMode === "git" ? "active" : ""}`}
              onClick={() => setViewMode("git")}
              title="Git Diff & Status"
            >
              <GitBranch size={14} />
            </button>
            <button
              className={`icon-btn ${viewMode === "summary" ? "active" : ""}`}
              onClick={() => setViewMode("summary")}
              title="AI Deep Summary"
            >
              <Sparkles size={14} />
            </button>
            <button
              className={`icon-btn ${viewMode === "meta" ? "active" : ""}`}
              onClick={() => setViewMode("meta")}
              title="EXIF & Media Tags"
            >
              <Tag size={14} />
            </button>
          </div>
        )}

        <button className="icon-btn" onClick={close} title="Close Preview (Ctrl+P)"><X size={15} /></button>
      </div>

      <div className="preview-body">
        {selected.length > 1 ? (
          <MultiSummary />
        ) : entry ? (
          <>
            {/* Process Lock Warning Banner */}
            {lockingProcesses.length > 0 && (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#ef4444",
                  fontSize: 11,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                  <ShieldAlert size={14} />
                  <span>Locked by {lockingProcesses.map((p) => `${p.name} (PID ${p.pid})`).join(", ")}</span>
                </div>
                <button
                  className="btn btn-sm"
                  disabled={terminating}
                  onClick={() => handleUnlockAndKill(lockingProcesses[0].pid)}
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: 700,
                    padding: "3px 8px",
                    fontSize: 10,
                    alignSelf: "flex-start",
                  }}
                >
                  ⚡ Unlock & Kill Process
                </button>
              </div>
            )}

            {/* Stage / Preview Area */}
            <div className="preview-stage">
              {loading ? (
                <div>Loading preview…</div>
              ) : viewMode === "git" ? (
                <GitDiffPreview filePath={entry.path} />
              ) : viewMode === "summary" ? (
                <DocumentSummaryPreview filePath={entry.path} />
              ) : viewMode === "meta" ? (
                <MediaMetadataPreview filePath={entry.path} />
              ) : isAudio ? (
                <AudioWaveformPreview src={assetUrl(entry.path)} name={entry.name} size={entry.size} />
              ) : isSvg ? (
                <SvgInspector filePath={entry.path} name={entry.name} />
              ) : isFont ? (
                <FontPreview filePath={entry.path} name={entry.name} />
              ) : is3D ? (
                <Model3DPreview filePath={entry.path} name={entry.name} size={entry.size} />
              ) : preview?.kind === "text" ? (
                preview.mime === "application/pdf" ? (
                  <PdfViewer filePath={entry.path} />
                ) : preview.text ? (
                  <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 6 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 4 }}>
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-sm"
                            onClick={handleSaveText}
                            disabled={saving}
                            style={{ fontSize: 11, padding: "2px 8px" }}
                          >
                            <Save size={12} /> {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              setIsEditing(false);
                              setEditedText(preview.text);
                            }}
                            style={{ fontSize: 11, padding: "2px 8px" }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setIsEditing(true)}
                          style={{ fontSize: 11, padding: "2px 8px" }}
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        style={{
                          flex: 1,
                          width: "100%",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          background: "var(--bg-card)",
                          color: "var(--text)",
                          border: "1px solid var(--accent)",
                          borderRadius: "var(--radius-sm)",
                          padding: 8,
                          resize: "vertical",
                        }}
                        spellCheck={false}
                      />
                    ) : (
                      <pre className="preview-text">{preview.text}</pre>
                    )}
                  </div>
                ) : (
                  renderStage(entry, preview)
                )
              ) : (
                renderStage(entry, preview)
              )}
            </div>

            {/* Metadata Rows */}
            <div className="preview-meta">
              <div className="meta-row">
                <span>Type</span>
                <span>{fileTypeLabel(entry.name, entry.ext, entry.isDir)}</span>
              </div>
              <div className="meta-row">
                <span>Size</span>
                <span
                  style={entry.isDir ? { cursor: "pointer" } : undefined}
                  onClick={() => {
                    if (entry.isDir) void store.calculateFolderSize(entry.path);
                  }}
                  title={entry.isDir ? "Click to recalculate folder size" : undefined}
                >
                  {entry.isDir
                    ? getFolderSize(entry.path)
                      ? formatBytes(getFolderSize(entry.path)!.size)
                      : getFolderTask(entry.path)
                        ? "Calculating…"
                        : "— (Click to calculate)"
                    : formatBytes(entry.size)}
                </span>
              </div>
              <div className="meta-row">
                <span>Modified</span>
                <span>{formatDate(entry.modifiedMs)}</span>
              </div>
              <div className="meta-row">
                <span>Created</span>
                <span>{formatDate(entry.createdMs)}</span>
              </div>
              {entry.isDir && (
                <div className="meta-row">
                  <span>Contents</span>
                  <span>
                    {getFolderSize(entry.path)
                      ? `${getFolderSize(entry.path)!.files} files, ${getFolderSize(entry.path)!.folders} folders`
                      : getFolderTask(entry.path)
                        ? "Scanning directory…"
                        : "—"}
                  </span>
                </div>
              )}
              {/* Direct Clickable Attribute Toggles */}
              <div className="meta-row" style={{ alignItems: "center" }}>
                <span>Attributes</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11 }}>
                    <input type="checkbox" checked={isReadonly} onChange={() => handleToggleAttribute("readonly")} />
                    <span>Read-only</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11 }}>
                    <input type="checkbox" checked={isHidden} onChange={() => handleToggleAttribute("hidden")} />
                    <span>Hidden</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Persistent Sticky Note / Annotation */}
            <StickyNotePreview filePath={entry.path} />

            {/* Quick Actions Bar */}
            <div className="preview-actions">
              <button className="btn btn-sm" onClick={() => void store.openEntry(entry)}>
                <FolderOpen size={13} /> Open
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    await ipc.revealInShell(entry.path);
                    store.pushToast("info", "Revealed in Explorer", entry.name);
                  } catch (e: any) {
                    store.pushToast("error", "Reveal failed", e?.message || String(e));
                  }
                }}
              >
                <ExternalLink size={13} /> Reveal
              </button>

              {/* Rich Copy Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setCopyMenuOpen(!copyMenuOpen)}
                  style={{ display: "flex", alignItems: "center", gap: 3 }}
                  title="Copy path or content in various formats"
                >
                  <Copy size={13} /> Copy <ChevronDown size={11} />
                </button>
                {copyMenuOpen && (
                  <div
                    className="context-menu"
                    style={{ top: "100%", left: 0, marginTop: 4, minWidth: 210, zIndex: 110 }}
                    onMouseLeave={() => setCopyMenuOpen(false)}
                  >
                    <div
                      className="menu-item"
                      onClick={() => {
                        setCopyMenuOpen(false);
                        void store.copyText(entry.path, "Windows path copied");
                      }}
                    >
                      <span>Windows Path (C:\...)</span>
                    </div>
                    <div
                      className="menu-item"
                      onClick={() => {
                        setCopyMenuOpen(false);
                        void store.copyText(entry.path.replace(/\\/g, "/"), "POSIX path copied");
                      }}
                    >
                      <span>POSIX Path (C:/...)</span>
                    </div>
                    <div
                      className="menu-item"
                      onClick={() => {
                        setCopyMenuOpen(false);
                        const activeDir = activeTab?.path ?? "";
                        let rel = entry.path;
                        if (entry.path.toLowerCase().startsWith(activeDir.toLowerCase())) {
                          rel = entry.path.slice(activeDir.length).replace(/^[\\\/]+/, "");
                        }
                        void store.copyText(rel || basename(entry.path), "Relative path copied");
                      }}
                    >
                      <span>Relative Path</span>
                    </div>
                    <div
                      className="menu-item"
                      onClick={() => {
                        setCopyMenuOpen(false);
                        void store.copyText(
                          `[${entry.name}](file:///${entry.path.replace(/\\/g, "/")})`,
                          "Markdown link copied"
                        );
                      }}
                    >
                      <span>Markdown Link</span>
                    </div>
                    <div
                      className="menu-item"
                      onClick={() => {
                        setCopyMenuOpen(false);
                        void store.copyText(`file:///${entry.path.replace(/\\/g, "/")}`, "URI copied");
                      }}
                    >
                      <span>file:// URI</span>
                    </div>
                    <div className="menu-sep" />
                    {!entry.isDir && (
                      <>
                        <div
                          className="menu-item"
                          onClick={async () => {
                            setCopyMenuOpen(false);
                            try {
                              const res = await ipc.readTextFile(entry.path, 65536);
                              await store.copyText(res.content, "File content copied");
                            } catch (e: any) {
                              store.pushToast("error", "Copy failed", e?.message || String(e));
                            }
                          }}
                        >
                          <FileText size={13} style={{ color: "#38bdf8" }} />
                          <span>Copy File Content (Text)</span>
                        </div>
                        <div
                          className="menu-item"
                          onClick={async () => {
                            setCopyMenuOpen(false);
                            try {
                              const res = await ipc.readTextFile(entry.path, 65536);
                              const b64 = btoa(res.content);
                              await store.copyText(b64, "Base64 copied");
                            } catch (e: any) {
                              store.pushToast("error", "Base64 failed", e?.message || String(e));
                            }
                          }}
                        >
                          <Binary size={13} style={{ color: "#a78bfa" }} />
                          <span>Copy as Base64</span>
                        </div>
                        <div
                          className="menu-item"
                          onClick={async () => {
                            setCopyMenuOpen(false);
                            try {
                              const h = await ipc.hashFile(entry.path, "sha256");
                              await store.copyText(h.digest, "SHA-256 hash copied");
                            } catch (e: any) {
                              store.pushToast("error", "Hash failed", (e as Error).message);
                            }
                          }}
                        >
                          <HashIcon size={13} style={{ color: "#34d399" }} />
                          <span>Copy SHA-256 Hash</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Power Actions: Duplicate, Touch, Shred */}
              <button className="btn btn-sm" onClick={handleCloneHere} title="Duplicate / Clone file in place">
                <CopyPlus size={13} /> Duplicate
              </button>
              <button className="btn btn-sm" onClick={handleTouchNow} title="Touch file (update modified date to now)">
                <Clock size={13} /> Touch
              </button>
              <button
                className="btn btn-sm"
                onClick={handleShred}
                title="Secure cryptographic wipe / shred"
                style={{ color: "#f87171" }}
              >
                <Flame size={13} /> Shred
              </button>

              <button
                className="btn btn-sm"
                onClick={() => void store.openTerminal(entry.isDir ? entry.path : dirname(entry.path))}
              >
                <Terminal size={13} /> Terminal
              </button>
              {!entry.isDir && (
                <button
                  className="btn btn-sm"
                  onClick={() => setShowHexEditor(true)}
                  title="Open in virtualized Hex Editor"
                >
                  <Binary size={13} /> Hex View
                </button>
              )}
              {entry.isDir && (
                <button className="btn btn-sm" onClick={() => void store.calculateFolderSize(entry.path)}>
                  <Calculator size={13} /> Size
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={() => store.setPropertiesPath(entry.path)}
                title="File Properties, Alternate Data Streams & Permissions (Alt+Enter)"
              >
                <SlidersHorizontal size={13} /> Properties
              </button>
            </div>

            {/* Embedded Staging Shelf & Clipboard Dock - only when separate shelf drawer is closed */}
            {!store.stagingOpen && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".6px",
                    color: "var(--text-faint)",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Staging Shelf & Clipboard Dock</span>
                  <span style={{ fontSize: 9, opacity: 0.8 }}>2027+ Next-Gen</span>
                </div>
                <StagingShelfWidget embedded={true} />
              </div>
            )}

            {/* Visual Drop Target Buckets */}
            <QuickDropBuckets />

            {hash && (
              <div
                className="hash-box"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  wordBreak: "break-all",
                  color: "var(--text-dim)",
                  marginTop: 6,
                }}
              >
                {hash}
              </div>
            )}
            {preview?.truncated && <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 4 }}>Preview truncated</div>}
          </>
        ) : activeTab ? (
          <>
            <FolderSummary path={activeTab.path} />
            {!store.stagingOpen && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".6px",
                    color: "var(--text-faint)",
                    marginBottom: 6,
                  }}
                >
                  <span>Staging Shelf & Clipboard Dock</span>
                </div>
                <StagingShelfWidget embedded={true} />
              </div>
            )}
            {/* Visual Quick Drop Target Buckets in Folder View */}
            <QuickDropBuckets />
          </>
        ) : null}
      </div>

      {/* Hex Editor Modal */}
      {showHexEditor && entry && (
        <HexEditorModal filePath={entry.path} onClose={() => setShowHexEditor(false)} />
      )}
    </div>
  );
}

function renderStage(entry: any, preview: any) {
  if (entry.isDir) {
    return (
      <div className="preview-placeholder">
        <span className="file-icon tone-folder" style={{ color: "var(--accent)" }}>
          <FolderOpen size={44} strokeWidth={1.4} />
        </span>
        <div style={{ fontWeight: 600, color: "var(--text)" }}>{entry.name}</div>
        <div style={{ fontSize: 12 }}>Folder</div>
      </div>
    );
  }
  const src = assetUrl(entry.path);
  const kind = preview?.kind;
  if (kind === "image") return <img src={src} alt={entry.name} />;
  if (kind === "video") return <VideoPlayerPreview src={src} name={entry.name} size={entry.size} />;
  if (kind === "pdf") return <PdfViewer filePath={entry.path} />;
  const { Icon, tone } = iconForEntry(entry, false);
  return (
    <div className="preview-placeholder">
      <span className={`file-icon tone-${tone}`}>
        <Icon size={40} strokeWidth={1.4} />
      </span>
      <div>{entry.ext ? entry.ext.toUpperCase() + " file" : "File"}</div>
      <div style={{ fontSize: 12 }}>Preview not available</div>
    </div>
  );
}

function MultiSummary() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId)!;
  const entries = activeTab.entries;
  const selected = activeTab.selected;
  const stats = { count: selected.length, bytes: 0, files: 0, folders: 0 };
  selected.forEach((p) => {
    const e = entries.find((en) => en.path === p);
    if (!e) return;
    if (e.isDir) stats.folders++;
    else {
      stats.files++;
      stats.bytes += e.size;
    }
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="preview-placeholder">
        <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.count}</div>
        <div>items selected</div>
      </div>
      <div className="preview-meta">
        <div className="meta-row">
          <span>Files</span>
          <span>{stats.files}</span>
        </div>
        <div className="meta-row">
          <span>Folders</span>
          <span>{stats.folders}</span>
        </div>
        <div className="meta-row">
          <span>Total size</span>
          <span>{formatBytes(stats.bytes)}</span>
        </div>
      </div>
    </div>
  );
}

function FolderSummary({ path }: { path: string }) {
  const store = useAppStore();
  const norm = normalizePath(path);
  const size = store.folderSizes[path] ?? store.folderSizes[norm] ?? store.folderSizes[norm.toLowerCase()];
  const isCalculating = !!(store.folderSizeTasks[path] ?? store.folderSizeTasks[norm] ?? store.folderSizeTasks[norm.toLowerCase()]);

  useEffect(() => {
    if (path && !size && !isCalculating) {
      void store.calculateFolderSize(path);
    }
  }, [path, size, isCalculating]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="preview-placeholder">
        <FolderOpen size={40} color="var(--accent)" />
        <div style={{ color: "var(--text)" }}>{basename(path)}</div>
        <div style={{ fontSize: 12 }}>{path}</div>
      </div>
      <div className="preview-meta">
        <div className="meta-row">
          <span>Size</span>
          <span>{size ? formatBytes(size.size) : isCalculating ? "Calculating…" : "—"}</span>
        </div>
        <div className="meta-row">
          <span>Files</span>
          <span>{size ? size.files : isCalculating ? "…" : "—"}</span>
        </div>
        <div className="meta-row">
          <span>Folders</span>
          <span>{size ? size.folders : isCalculating ? "…" : "—"}</span>
        </div>
      </div>
      <StickyNotePreview filePath={path} />
    </div>
  );
}

function QuickDropBuckets() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const selected = activeTab?.selected ?? [];

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".6px",
          color: "var(--text-faint)",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Quick Drop Target Buckets</span>
        <span style={{ fontSize: 9, opacity: 0.75 }}>Drag files onto any bucket</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div
          className="drop-bucket"
          data-drop-bucket="archive"
          title="Drop files here to create instant ZIP archive"
          onClick={() => {
            const targets = selected.length > 0 ? selected : store.stagingPaths;
            if (targets.length > 0) {
              void store.pasteStagedAs("zip", activeTab?.path ?? "C:\\");
            } else {
              store.pushToast("info", "ZIP Archive", "Select files or drag them here to create an archive");
            }
          }}
          style={{
            padding: "8px 6px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .12s, background .12s",
          }}
        >
          <Archive size={14} style={{ color: "#fbbf24" }} />
          <span>📦 ZIP Archive</span>
        </div>

        <div
          className="drop-bucket"
          data-drop-bucket="trash"
          title="Drop files here to send directly to Trash"
          onClick={() => {
            const targets = selected.length > 0 ? selected : store.stagingPaths;
            if (targets.length > 0) {
              void store.startDelete(targets, false);
            } else {
              store.pushToast("info", "Trash", "Select files or drag them here to delete");
            }
          }}
          style={{
            padding: "8px 6px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .12s, background .12s",
          }}
        >
          <Trash2 size={14} style={{ color: "#f87171" }} />
          <span>🗑 Send to Trash</span>
        </div>

        <div
          className="drop-bucket"
          data-drop-bucket="webdrop"
          title="Drop files here to open Mobile QR WebDrop"
          onClick={() => {
            if (selected.length > 0) store.addStaged(selected);
            store.setWebdropOpen(true);
          }}
          style={{
            padding: "8px 6px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .12s, background .12s",
          }}
        >
          <Share2 size={14} style={{ color: "#34d399" }} />
          <span>📱 Send to Phone</span>
        </div>

        <div
          className="drop-bucket"
          data-drop-bucket="shelf"
          title="Drop files here to add to Staging Shelf"
          onClick={() => {
            if (selected.length > 0) {
              store.addStaged(selected);
              store.pushToast("success", "Staged", `Added ${selected.length} item(s) to shelf`);
            } else {
              store.pushToast("info", "Staging Shelf", "Select files or drag them here to stage");
            }
          }}
          style={{
            padding: "8px 6px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .12s, background .12s",
          }}
        >
          <Layers size={14} style={{ color: "#38bdf8" }} />
          <span>📋 Add to Shelf</span>
        </div>
      </div>
    </div>
  );
}
