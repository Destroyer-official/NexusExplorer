import type { FileEntry, GitRepoStatus, LockingProcess } from "@/types";
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
  Tag,
  Copy,
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
  Wrench,
  Check,
} from "lucide-react";
import { useDragState } from "@/lib/dnd";
import HexEditorModal from "@/components/HexEditorModal";
import AudioWaveformPreview from "@/components/previews/AudioWaveformPreview";
import SvgInspector from "@/components/previews/SvgInspector";
import FontPreview from "@/components/previews/FontPreview";
import GitDiffPreview from "@/components/previews/GitDiffPreview";
import StickyNotePreview from "@/components/previews/StickyNotePreview";
import Model3DPreview from "@/components/previews/Model3DPreview";
import { PdfViewer } from "@/components/previews/PdfViewer";
import { VideoPlayerPreview } from "@/components/previews/VideoPlayerPreview";
import StagingShelfWidget from "@/components/StagingShelfWidget";

export default function PreviewPane() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const selected = activeTab?.selected ?? [];
  const [droppedEntry, setDroppedEntry] = useState<FileEntry | null>(null);
  const [fallbackEntry, setFallbackEntry] = useState<FileEntry | null>(null);

  useEffect(() => {
    let version = 0;
    const handle = (event: Event) => {
      const path = (event as CustomEvent<unknown>).detail;
      if (typeof path !== "string") return;
      const request = ++version;
      void ipc.statPath(path).then((entry) => { if (request === version) setDroppedEntry(entry); }).catch(() => store.pushToast("error", "Cannot preview", path));
    };
    window.addEventListener("nexus:preview-path", handle);
    return () => { ++version; window.removeEventListener("nexus:preview-path", handle); };
  }, []);

  useEffect(() => {
    setDroppedEntry(null);
    if (selected.length === 1 && !activeTab?.entries.find((e) => samePath(e.path, selected[0]))) {
      let cancelled = false;
      void ipc.statPath(selected[0]).then((ent) => {
        if (!cancelled && ent) setFallbackEntry(ent);
      }).catch(() => {});
      return () => { cancelled = true; };
    } else {
      setFallbackEntry(null);
    }
  }, [selected, activeTab?.entries]);

  const entry = droppedEntry ?? (selected.length === 1 ? (activeTab?.entries.find((e) => samePath(e.path, selected[0])) ?? fallbackEntry) : null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

  const dragState = useDragState();

  // View Mode: 'preview', 'actions', 'shelf', 'git', 'summary', or 'meta' (synced with store)
  const viewMode = store.previewTab;
  const setViewMode = store.setPreviewTab;

  // Hex Editor modal state
  const [showHexEditor, setShowHexEditor] = useState(false);

  // Power Actions state
  const [lockingProcesses, setLockingProcesses] = useState<LockingProcess[]>([]);
  const [terminating, setTerminating] = useState(false);
  const [isReadonly, setIsReadonly] = useState(entry?.isReadonly ?? false);
  const [isHidden, setIsHidden] = useState(entry?.isHidden ?? false);

  useEffect(() => {
    setIsEditing(false);
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

  const close = () => {
    store.setPreviewOpen(false);
  };

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
    const ext = entry.ext && !entry.isDir ? `.${entry.ext}` : "";
    const nameNoExt = entry.name.replace(/\.[^/.]+$/, "");
    const destPath = `${dir}\\${nameNoExt}_copy${ext}`;
    try {
      if (entry.isDir) {
        await ipc.copyEntries([p], dir, () => {});
        store.pushToast("success", "Folder Cloned", `Created duplicate of ${entry.name}`);
      } else {
        await ipc.toolsCloneFile(p, destPath);
        store.pushToast("success", "Cloned", `Created ${basename(destPath)}`);
      }
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
      description: `Permanently shred and overwrite "${entry.name}"? Data will be overwritten with 3 cryptographic passes and deleted.\n\nAdvisory: On SSDs (FTL wear-leveling) and CoW filesystems (ReFS/Btrfs), BitLocker full-volume encryption is recommended for complete sanitization.`,
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

  const previewWidth = store.previewWidth ?? 340;

  const handleResizerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = useAppStore.getState().previewWidth ?? 340;
    const target = e.currentTarget;
    target.classList.add("resizing");
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(220, Math.min(750, startW - (ev.clientX - startX)));
      useAppStore.getState().setPreviewWidth(next);
    };

    const onUp = (ev: PointerEvent) => {
      target.classList.remove("resizing");
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const isFont = entry?.ext && ["ttf", "otf", "woff", "woff2"].includes(entry.ext.toLowerCase());
  const isSvg = entry?.ext && entry.ext.toLowerCase() === "svg";
  const is3D = entry?.ext && ["obj", "stl", "gltf", "glb"].includes(entry.ext.toLowerCase());
  const isAudio = preview?.kind === "audio";

  return (
    <aside
      className="preview"
      data-drop-target="preview"
      style={{ width: previewWidth }}
    >
      <div className="preview-resizer" onPointerDown={handleResizerPointerDown} />
      {/* Header */}
      <div className="preview-header">
        <span style={{ display: "inline-flex", marginRight: 6, color: "var(--accent)" }}>
          {entry ? (entry.isDir ? <FolderOpen size={16} strokeWidth={1.8} /> : <FileText size={16} strokeWidth={1.8} />) : <FolderOpen size={16} />}
        </span>
        <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry ? entry.name : (activeTab ? basename(activeTab.path) : "")}
        </span>
        <span style={{ flex: 1 }} />
        <button className="icon-btn" onClick={close} title="Close Preview (Ctrl+P)"><X size={15} /></button>
      </div>

      {/* Segmented Mode Navigation Bar */}
      <div className="preview-view-tabs" role="tablist" aria-label="Preview view modes">
        <button
          type="button"
          className={`preview-tab-btn ${viewMode === "preview" ? "active" : ""}`}
          onClick={() => setViewMode("preview")}
          title={entry?.isDir ? "Folder Contents & Tree" : "Live Visual / Code Preview"}
        >
          <Eye size={12} /> <span>Preview</span>
        </button>
        <button
          type="button"
          className={`preview-tab-btn ${viewMode === "actions" ? "active" : ""}`}
          onClick={() => setViewMode("actions")}
          title="File Operations, Tools & Modifications"
        >
          <Wrench size={12} /> <span>Actions</span>
        </button>
        <button
          type="button"
          className={`preview-tab-btn ${viewMode === "shelf" ? "active" : ""}`}
          onClick={() => setViewMode("shelf")}
          title="Staging Shelf, Clipboard Dock & Quick Drop Targets"
        >
          <Layers size={12} /> <span>Shelf & Drop</span>
        </button>
        <button
          type="button"
          className={`preview-tab-btn ${viewMode === "git" ? "active" : ""}`}
          onClick={() => setViewMode("git")}
          title="Git Diff, Status & Repository History"
        >
          <GitBranch size={12} /> <span>Git</span>
        </button>
        <button
          type="button"
          className={`preview-tab-btn ${viewMode === "meta" ? "active" : ""}`}
          onClick={() => setViewMode("meta")}
          title="Sticky Notes, Checklists & System Attributes"
        >
          <Tag size={12} /> <span>Details</span>
        </button>
      </div>

      {/* Universal Drop Target Hub - visible when any drag is active */}
      {dragState.active && (
        <div
          className="universal-drop-hub"
          style={{
            margin: "8px 12px 0 12px",
            padding: "10px",
            background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(99,102,241,0.12))",
            border: "2px dashed var(--accent)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            animation: "fadeIn .15s ease",
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={13} />
            <span>Drop Target Hub ({dragState.paths.length} item{dragState.paths.length > 1 ? "s" : ""})</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div
              className="drop-bucket"
              data-drop-bucket="shelf"
              style={{
                padding: "8px 6px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px dashed var(--accent)",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--accent)",
              }}
            >
              📋 Drop to Stage
            </div>
            <div
              className="drop-bucket"
              data-drop-bucket="archive"
              style={{
                padding: "8px 6px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px dashed #fbbf24",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "#fbbf24",
              }}
            >
              📦 Drop to ZIP
            </div>
            <div
              className="drop-bucket"
              data-drop-bucket="trash"
              style={{
                padding: "8px 6px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px dashed #f87171",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "#f87171",
              }}
            >
              🗑 Drop to Trash
            </div>
            <div
              className="drop-bucket"
              data-drop-bucket="webdrop"
              style={{
                padding: "8px 6px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px dashed #34d399",
                textAlign: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "#34d399",
              }}
            >
              📱 Drop to Phone
            </div>
          </div>
        </div>
      )}

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

            {/* TAB 1: PREVIEW */}
            {viewMode === "preview" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div className="preview-stage" style={{ flex: 1, minHeight: 220 }}>
                  {loading ? (
                    <div>Loading preview…</div>
                  ) : entry.isDir ? (
                    <FolderContentsStage path={entry.path} onOpenChild={(c) => void store.openEntry(c)} />
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

                {/* Compact Footer Information & Quick Actions for Preview Tab */}
                <div style={{ padding: "8px 12px 10px 12px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <div className="preview-meta" style={{ padding: 0 }}>
                    <div className="meta-row">
                      <span>Type</span>
                      <span>{fileTypeLabel(entry.name, entry.ext, entry.isDir)}</span>
                    </div>
                    <div className="meta-row">
                      <span>Size</span>
                      <span>{entry.isDir ? (getFolderSize(entry.path) ? formatBytes(getFolderSize(entry.path)!.size) : "—") : formatBytes(entry.size)}</span>
                    </div>
                    <div className="meta-row">
                      <span>Modified</span>
                      <span>{formatDate(entry.modifiedMs)}</span>
                    </div>
                    <div className="meta-row" style={{ alignItems: "center" }}>
                      <span>Attributes</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className={`attribute-pill ${isReadonly ? "active" : ""}`}
                          onClick={() => handleToggleAttribute("readonly")}
                          title={isReadonly ? "Read-Only is active. Click to make writable" : "Writable. Click to set Read-Only"}
                        >
                          <span>{isReadonly ? "🔒 Read-only" : "🔓 Writable"}</span>
                        </button>
                        <button
                          type="button"
                          className={`attribute-pill ${isHidden ? "active" : ""}`}
                          onClick={() => handleToggleAttribute("hidden")}
                          title={isHidden ? "Hidden is active. Click to make visible" : "Visible. Click to hide"}
                        >
                          <span>{isHidden ? "👁‍🗨 Hidden" : "👁 Visible"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Pills */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, width: "100%", marginTop: 8 }}>
                    <button
                      className="btn btn-sm btn-primary-action"
                      onClick={() => void store.openEntry(entry)}
                      title="Open with system default application (Enter)"
                    >
                      <FolderOpen size={13} /> <span>Open</span>
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
                      title="Reveal in native Windows File Explorer"
                    >
                      <ExternalLink size={13} /> <span>Reveal</span>
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => void store.copyText(entry.path, "Windows path copied")}
                      title="Copy full path to clipboard"
                    >
                      <Copy size={13} /> <span>Copy</span>
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => store.setPropertiesPath(entry.path)}
                      title="File Properties & Alternate Data Streams (Alt+Enter)"
                    >
                      <SlidersHorizontal size={13} /> <span>Properties</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ACTIONS */}
            {viewMode === "actions" && (
              <ActionsWorkstation
                entry={entry}
                isReadonly={isReadonly}
                isHidden={isHidden}
                onToggleAttribute={handleToggleAttribute}
                onCloneHere={handleCloneHere}
                onTouchNow={handleTouchNow}
                onShred={handleShred}
                onOpenHex={() => setShowHexEditor(true)}
              />
            )}

            {/* TAB 3: SHELF & DROP */}
            {viewMode === "shelf" && (
              <ShelfWorkstation />
            )}

            {/* TAB 4: GIT */}
            {viewMode === "git" && (
              <div style={{ flex: 1, minHeight: 0 }}>
                {entry.isDir ? (
                  <FolderGitPreview path={entry.path} />
                ) : (
                  <GitDiffPreview filePath={entry.path} />
                )}
              </div>
            )}

            {/* TAB 5: DETAILS */}
            {viewMode === "meta" && (
              <DetailsWorkstation entry={entry} />
            )}
          </>
        ) : activeTab ? (
          <>
            {viewMode === "preview" && (
              <FolderSummary path={activeTab.path} />
            )}
            {viewMode === "actions" && (
              <FolderActionsWorkstation
                path={activeTab.path}
                onCloneHere={handleCloneHere}
                onTouchNow={handleTouchNow}
              />
            )}
            {viewMode === "shelf" && (
              <ShelfWorkstation />
            )}
            {viewMode === "git" && (
              <FolderGitPreview path={activeTab.path} />
            )}
            {viewMode === "meta" && (
              <div style={{ padding: 10 }}>
                <StickyNotePreview filePath={activeTab.path} />
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Hex Editor Modal */}
      {showHexEditor && entry && (
        <HexEditorModal filePath={entry.path} onClose={() => setShowHexEditor(false)} />
      )}
    </aside>
  );
}

function ActionsWorkstation({
  entry,
  isReadonly,
  isHidden,
  onToggleAttribute,
  onCloneHere,
  onTouchNow,
  onShred,
  onOpenHex,
}: {
  entry: FileEntry;
  isReadonly: boolean;
  isHidden: boolean;
  onToggleAttribute: (type: "readonly" | "hidden") => void;
  onCloneHere: () => void;
  onTouchNow: () => void;
  onShred: () => void;
  onOpenHex: () => void;
}) {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const copyWithToast = async (text: string, label: string, formatId: string) => {
    await store.copyText(text, label);
    setCopiedFormat(formatId);
    setTimeout(() => setCopiedFormat(null), 1800);
  };

  return (
    <div className="actions-workstation" style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Target Identity Card */}
      <div
        style={{
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ color: "var(--accent)" }}>
          {entry.isDir ? <FolderOpen size={24} /> : <FileText size={24} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.path}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
            {entry.isDir ? "Directory" : formatBytes(entry.size)} · {formatDate(entry.modifiedMs)}
          </div>
        </div>
      </div>

      {/* Section 1: Primary Launchers */}
      <div>
        <div className="section-label">Launch & Inspect</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <button
            className="btn btn-sm btn-primary-action"
            onClick={() => void store.openEntry(entry)}
            title="Open with system default application (Enter)"
            style={{ justifyContent: "center" }}
          >
            <FolderOpen size={14} /> <span>Open Default</span>
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
            title="Reveal in native Windows File Explorer"
            style={{ justifyContent: "center" }}
          >
            <ExternalLink size={14} /> <span>Reveal in Shell</span>
          </button>
          <button
            className="btn btn-sm"
            onClick={() => void store.openTerminal(entry.isDir ? entry.path : dirname(entry.path))}
            title="Open terminal in this directory"
            style={{ justifyContent: "center" }}
          >
            <Terminal size={14} style={{ color: "#60a5fa" }} /> <span>Terminal</span>
          </button>
          {!entry.isDir ? (
            <button
              className="btn btn-sm"
              onClick={onOpenHex}
              title="Open in virtualized Hex Editor"
              style={{ justifyContent: "center" }}
            >
              <Binary size={14} style={{ color: "#a78bfa" }} /> <span>Hex View</span>
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={() => void store.calculateFolderSize(entry.path)}
              title="Calculate full directory size"
              style={{ justifyContent: "center" }}
            >
              <Calculator size={14} style={{ color: "#34d399" }} /> <span>Folder Size</span>
            </button>
          )}
          <button
            className="btn btn-sm"
            onClick={() => store.setPropertiesPath(entry.path)}
            title="File Properties & Alternate Data Streams (Alt+Enter)"
            style={{ gridColumn: "span 2", justifyContent: "center" }}
          >
            <SlidersHorizontal size={14} /> <span>Properties & ADS</span>
          </button>
        </div>
      </div>

      {/* Section 2: Rich Copy Station */}
      <div>
        <div className="section-label">Rich Copy & Export Hub</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 6 }}>
          <button
            className="btn btn-sm copy-tile-btn"
            onClick={() => void copyWithToast(entry.path, "Windows path copied", "win")}
            title="Copy Windows format path (C:\path\to\file)"
          >
            {copiedFormat === "win" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>Windows Path</span>
          </button>
          <button
            className="btn btn-sm copy-tile-btn"
            onClick={() => void copyWithToast(entry.path.replace(/\\/g, "/"), "POSIX path copied", "posix")}
            title="Copy POSIX format path (C:/path/to/file)"
          >
            {copiedFormat === "posix" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>POSIX Path</span>
          </button>
          <button
            className="btn btn-sm copy-tile-btn"
            onClick={() => {
              const activeDir = activeTab?.path ?? "";
              let rel = entry.path;
              if (entry.path.toLowerCase().startsWith(activeDir.toLowerCase())) {
                rel = entry.path.slice(activeDir.length).replace(/^[\\\/]+/, "");
              }
              void copyWithToast(rel || basename(entry.path), "Relative path copied", "rel");
            }}
            title="Copy path relative to current folder"
          >
            {copiedFormat === "rel" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>Relative Path</span>
          </button>
          <button
            className="btn btn-sm copy-tile-btn"
            onClick={() =>
              void copyWithToast(
                `[${entry.name}](file:///${entry.path.replace(/\\/g, "/")})`,
                "Markdown link copied",
                "md"
              )
            }
            title="Copy Markdown link [name](file:///path)"
          >
            {copiedFormat === "md" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>Markdown Link</span>
          </button>
          <button
            className="btn btn-sm copy-tile-btn"
            onClick={() =>
              void copyWithToast(`file:///${entry.path.replace(/\\/g, "/")}`, "URI copied", "uri")
            }
            title="Copy file:// URI"
          >
            {copiedFormat === "uri" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>file:// URI</span>
          </button>
          {!entry.isDir && (
            <>
              <button
                className="btn btn-sm copy-tile-btn"
                onClick={async () => {
                  try {
                    const res = await ipc.readTextFile(entry.path, 65536);
                    await copyWithToast(res.content, "File content copied", "content");
                  } catch (e: any) {
                    store.pushToast("error", "Copy failed", e?.message || String(e));
                  }
                }}
                title="Copy text file contents directly to clipboard"
              >
                {copiedFormat === "content" ? <Check size={12} color="#10b981" /> : <FileText size={12} />}
                <span>File Content</span>
              </button>
              <button
                className="btn btn-sm copy-tile-btn"
                onClick={async () => {
                  try {
                    const res = await ipc.readTextFile(entry.path, 65536);
                    const b64 = btoa(res.content);
                    await copyWithToast(b64, "Base64 copied", "b64");
                  } catch (e: any) {
                    store.pushToast("error", "Base64 failed", e?.message || String(e));
                  }
                }}
                title="Copy file contents encoded as Base64 string"
              >
                {copiedFormat === "b64" ? <Check size={12} color="#10b981" /> : <Binary size={12} />}
                <span>Copy Base64</span>
              </button>
              <button
                className="btn btn-sm copy-tile-btn"
                onClick={async () => {
                  try {
                    const h = await ipc.hashFile(entry.path, "sha256");
                    await copyWithToast(h.digest, "SHA-256 hash copied", "hash");
                  } catch (e: any) {
                    store.pushToast("error", "Hash failed", (e as Error).message);
                  }
                }}
                title="Calculate and copy SHA-256 cryptographic digest"
              >
                {copiedFormat === "hash" ? <Check size={12} color="#10b981" /> : <HashIcon size={12} />}
                <span>SHA-256 Hash</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Section 3: File Mutation & Metadata Manipulation */}
      <div>
        <div className="section-label">Mutation & Attributes</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <button className="btn btn-sm" onClick={onCloneHere} title="Duplicate file in place">
            <CopyPlus size={14} style={{ color: "#38bdf8" }} /> <span>Duplicate</span>
          </button>
          <button className="btn btn-sm" onClick={onTouchNow} title="Update modified/created timestamps to now">
            <Clock size={14} style={{ color: "#fbbf24" }} /> <span>Touch Now</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isReadonly ? "btn-primary-action" : ""}`}
            onClick={() => onToggleAttribute("readonly")}
            title={isReadonly ? "Read-Only is ACTIVE. Click to make writable." : "File is Writable. Click to set Read-Only."}
          >
            <span>{isReadonly ? "🔒 Read-only (On)" : "🔓 Read-only (Off)"}</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isHidden ? "btn-primary-action" : ""}`}
            onClick={() => onToggleAttribute("hidden")}
            title={isHidden ? "Hidden is ACTIVE. Click to make visible." : "File is Visible. Click to hide."}
          >
            <span>{isHidden ? "👁‍🗨 Hidden (On)" : "👁 Visible"}</span>
          </button>
        </div>
      </div>

      {/* Section 4: Security & Forensic Shred */}
      <div>
        <div className="section-label" style={{ color: "#f87171" }}>Security & Shred</div>
        <div style={{ marginTop: 6 }}>
          <button
            className="btn btn-sm danger-tile-btn"
            onClick={onShred}
            title="Permanently overwrite and shred this item (DoD 5220.22-M 3-pass)"
            style={{
              width: "100%",
              justifyContent: "center",
              background: "rgba(239, 68, 68, 0.12)",
              borderColor: "rgba(239, 68, 68, 0.35)",
              color: "#f87171",
              fontWeight: 600,
            }}
          >
            <Flame size={14} /> <span>Secure Cryptographic Shred</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ShelfWorkstation() {
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".6px",
          color: "var(--text-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Staging Shelf & Clipboard Dock</span>
        <span style={{ fontSize: 9, opacity: 0.8 }}>2027+ Multi-Slot</span>
      </div>
      <StagingShelfWidget embedded={true} />
      <QuickDropBuckets />
    </div>
  );
}

function DetailsWorkstation({ entry }: { entry: FileEntry }) {
  const store = useAppStore();
  const [hash, setHash] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [clipStatus, setClipStatus] = useState<"match" | "mismatch" | null>(null);

  const norm = normalizePath(entry.path);
  const size = store.folderSizes[entry.path] ?? store.folderSizes[norm] ?? store.folderSizes[norm.toLowerCase()];

  const handleComputeHash = async () => {
    if (entry.isDir) return;
    setHashing(true);
    try {
      const h = await ipc.hashFile(entry.path, "sha256");
      setHash(h.digest);
      store.pushToast("success", "SHA-256 Calculated", h.digest.slice(0, 16) + "…");
    } catch (e: any) {
      store.pushToast("error", "Hash calculation failed", e?.message || String(e));
    } finally {
      setHashing(false);
    }
  };

  const handleVerifyClipboard = async () => {
    if (entry.isDir) return;
    try {
      const clip = (await navigator.clipboard.readText()).trim().toLowerCase().replace(/[^a-f0-9]/g, "");
      let currentHash = hash;
      if (!currentHash) {
        setHashing(true);
        const h = await ipc.hashFile(entry.path, "sha256");
        currentHash = h.digest;
        setHash(currentHash);
        setHashing(false);
      }
      if (clip && clip === currentHash.toLowerCase()) {
        setClipStatus("match");
        store.pushToast("success", "✓ Hash Match Verified", "File SHA-256 matches clipboard checksum.");
      } else {
        setClipStatus("mismatch");
        store.pushToast("error", "✗ Hash Mismatch", `Computed: ${currentHash.slice(0, 16)}...\nClipboard: ${clip ? clip.slice(0, 16) + "..." : "(empty)"}`);
      }
    } catch (e: any) {
      setHashing(false);
      store.pushToast("error", "Clipboard verification failed", e?.message || String(e));
    }
  };

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Complete System Metadata Table */}
      <div>
        <div className="section-label">System Metadata</div>
        <div className="preview-meta" style={{ marginTop: 6, padding: 0 }}>
          <div className="meta-row">
            <span>Name</span>
            <span style={{ fontWeight: 600 }}>{entry.name}</span>
          </div>
          <div className="meta-row">
            <span>Type</span>
            <span>{fileTypeLabel(entry.name, entry.ext, entry.isDir)}</span>
          </div>
          <div className="meta-row">
            <span>Path</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" }} title={entry.path}>
              {entry.path}
            </span>
          </div>
          <div className="meta-row">
            <span>Size</span>
            <span>{entry.isDir ? (size ? formatBytes(size.size) : "—") : formatBytes(entry.size)}</span>
          </div>
          <div className="meta-row">
            <span>Modified</span>
            <span>{formatDate(entry.modifiedMs)}</span>
          </div>
          <div className="meta-row">
            <span>Created</span>
            <span>{formatDate(entry.createdMs)}</span>
          </div>
          <div className="meta-row">
            <span>Permissions</span>
            <span>{entry.isReadonly ? "Read-Only" : "Read / Write"}</span>
          </div>
          <div className="meta-row">
            <span>Visibility</span>
            <span>{entry.isHidden ? "Hidden" : "Visible"}</span>
          </div>
        </div>
      </div>

      {/* SHA-256 Digest Box */}
      {!entry.isDir && (
        <div>
          <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Cryptographic Integrity</span>
            <div style={{ display: "flex", gap: 6 }}>
              {!hash && (
                <button
                  className="btn btn-sm"
                  onClick={handleComputeHash}
                  disabled={hashing}
                  style={{ fontSize: 10, padding: "2px 6px" }}
                >
                  {hashing ? "Hashing…" : "Compute SHA-256"}
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={handleVerifyClipboard}
                disabled={hashing}
                style={{ fontSize: 10, padding: "2px 6px" }}
                title="Compare file hash against clipboard string"
              >
                Verify Clipboard
              </button>
            </div>
          </div>
          {clipStatus === "match" && (
            <div style={{ marginTop: 4, fontSize: 10, color: "#10b981", fontWeight: 600 }}>
              ✓ Matches checksum from clipboard
            </div>
          )}
          {clipStatus === "mismatch" && (
            <div style={{ marginTop: 4, fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
              ✗ Does not match checksum from clipboard
            </div>
          )}
          {hash ? (
            <div
              className="hash-box"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                wordBreak: "break-all",
                color: "var(--text-dim)",
                background: "var(--surface)",
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                marginTop: 6,
                cursor: "pointer",
              }}
              onClick={() => void store.copyText(hash, "SHA-256 copied")}
              title="Click to copy full SHA-256 hash"
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)", marginBottom: 2 }}>SHA-256 (Click to Copy)</div>
              {hash}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4, fontStyle: "italic" }}>
              Click 'Compute SHA-256' to calculate forensic hash.
            </div>
          )}
        </div>
      )}

      {/* Persistent Sticky Notes & Annotations */}
      <div>
        <div className="section-label">Persistent Notes & Checklist</div>
        <div style={{ marginTop: 6 }}>
          <StickyNotePreview filePath={entry.path} />
        </div>
      </div>
    </div>
  );
}

function FolderActionsWorkstation({
  path,
  onCloneHere,
  onTouchNow,
}: {
  path: string;
  onCloneHere: () => void;
  onTouchNow: () => void;
}) {
  const store = useAppStore();
  const folderName = basename(path) || path;

  return (
    <div className="actions-workstation" style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <FolderOpen size={24} style={{ color: "var(--accent)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {folderName}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {path}
          </div>
        </div>
      </div>

      <div>
        <div className="section-label">Launch & Inspect</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <button
            className="btn btn-sm"
            onClick={async () => {
              try {
                await ipc.revealInShell(path);
                store.pushToast("info", "Revealed in Explorer", folderName);
              } catch (e: any) {
                store.pushToast("error", "Reveal failed", e?.message || String(e));
              }
            }}
            style={{ justifyContent: "center" }}
          >
            <ExternalLink size={14} /> <span>Reveal in Shell</span>
          </button>
          <button
            className="btn btn-sm"
            onClick={() => void store.openTerminal(path)}
            style={{ justifyContent: "center" }}
          >
            <Terminal size={14} style={{ color: "#60a5fa" }} /> <span>Terminal Here</span>
          </button>
          <button
            className="btn btn-sm"
            onClick={() => void store.calculateFolderSize(path)}
            style={{ gridColumn: "span 2", justifyContent: "center" }}
          >
            <Calculator size={14} style={{ color: "#34d399" }} /> <span>Calculate Directory Deep Size</span>
          </button>
        </div>
      </div>

      <div>
        <div className="section-label">Folder Mutation</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <button className="btn btn-sm" onClick={onCloneHere} title="Duplicate folder in place">
            <CopyPlus size={14} style={{ color: "#38bdf8" }} /> <span>Duplicate Folder</span>
          </button>
          <button className="btn btn-sm" onClick={onTouchNow} title="Update folder timestamp to now">
            <Clock size={14} style={{ color: "#fbbf24" }} /> <span>Touch Folder</span>
          </button>
        </div>
      </div>

      <div>
        <div className="section-label">Copy Paths</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 6 }}>
          <button
            className="btn btn-sm copy-tile-btn"
            onClick={() => void store.copyText(path, "Windows path copied")}
          >
            <Copy size={12} /> <span>Windows Path</span>
          </button>
          <button
            className="btn btn-sm copy-tile-btn"
            onClick={() => void store.copyText(path.replace(/\\/g, "/"), "POSIX path copied")}
          >
            <Copy size={12} /> <span>POSIX Path</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderContentsStage({ path, onOpenChild }: { path: string; onOpenChild?: (e: FileEntry) => void }) {
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ipc.readDir(path)
      .then((entries) => {
        if (!cancelled) setChildren(entries);
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (loading) {
    return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: 12 }}>Loading directory contents…</div>;
  }

  if (children.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, color: "var(--text-faint)" }}>
        <FolderOpen size={36} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>Empty Directory</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
        <span>Directory Quicklook</span>
        <span>{children.length} item{children.length === 1 ? "" : "s"}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px" }}>
        {children.map((child) => {
          const { Icon, tone } = iconForEntry(child, false);
          return (
            <div
              key={child.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 6px",
                borderRadius: "var(--radius-sm)",
                fontSize: 11,
                cursor: "pointer",
              }}
              className="hover:bg-white/5"
              onClick={() => onOpenChild?.(child)}
              title={child.path}
            >
              <span className={`file-icon tone-${tone}`} style={{ display: "inline-flex" }}>
                <Icon size={14} />
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {child.name}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-faint)", flexShrink: 0 }}>
                {child.isDir ? "Folder" : formatBytes(child.size)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FolderGitPreview({ path }: { path: string }) {
  const [gitStatus, setGitStatus] = useState<GitRepoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ipc.toolsGitStatus(path)
      .then((res) => {
        if (!cancelled) setGitStatus(res);
      })
      .catch(() => {
        if (!cancelled) setGitStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (loading) {
    return <div style={{ fontSize: 11, color: "var(--text-dim)", padding: 10 }}>Scanning Git status…</div>;
  }

  if (!gitStatus || !gitStatus.isRepo) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-dim)", padding: 12, textAlign: "center" }}>
        Not inside a Git repository.
      </div>
    );
  }

  const entries = Object.entries(gitStatus.fileStatuses || {});
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "var(--text-faint)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
        <span>Branch: {gitStatus.currentBranch || "HEAD"}</span>
        <span>{entries.length} changed</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px" }}>
        {entries.length === 0 ? (
          <div style={{ padding: 12, fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
            Working tree clean. No uncommitted changes in this folder.
          </div>
        ) : (
          entries.map(([fPath, status]) => (
            <div
              key={fPath}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "3px 6px",
                fontSize: 11,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {basename(fPath)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 4px",
                  borderRadius: 3,
                  marginLeft: 6,
                  background:
                    status === "modified" ? "rgba(234, 179, 8, 0.15)" :
                    status === "staged" ? "rgba(6, 182, 212, 0.15)" :
                    status === "untracked" ? "rgba(34, 197, 94, 0.15)" :
                    "rgba(255, 255, 255, 0.08)",
                  color:
                    status === "modified" ? "#eab308" :
                    status === "staged" ? "#06b6d4" :
                    status === "untracked" ? "#22c55e" :
                    "var(--text-faint)",
                }}
              >
                {status}
              </span>
            </div>
          ))
        )}
      </div>
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
      {!size && !isCalculating && <button className="btn btn-sm" onClick={() => void store.calculateFolderSize(path)}>Calculate folder size</button>}
      <StickyNotePreview filePath={path} />
    </div>
  );
}

function QuickDropBuckets() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const selected = activeTab?.selected ?? [];

  const handleAction = (bucket: string) => {
    const targets = selected.length > 0 ? selected : store.stagingPaths;
    if (bucket === "shelf") {
      if (targets.length > 0) {
        store.addStaged(targets);
        store.pushToast("success", "Staged", `Added ${targets.length} item(s) to shelf`);
      } else {
        store.pushToast("info", "Staging Shelf", "Select files or drag them here to stage");
      }
    } else if (bucket === "archive") {
      if (targets.length > 0) {
        if (selected.length > 0) store.addStaged(selected);
        void store.pasteStagedAs("zip", activeTab?.path ?? "C:\\");
        store.pushToast("info", "Archiving", `Creating ZIP archive for ${targets.length} item(s)…`);
      } else {
        store.pushToast("info", "ZIP Archive", "Select files or drag them here to create an archive");
      }
    } else if (bucket === "trash") {
      if (targets.length > 0) {
        void store.startDelete(targets, false);
      } else {
        store.pushToast("info", "Trash", "Select files or drag them here to delete");
      }
    } else if (bucket === "webdrop") {
      if (targets.length > 0) store.addStaged(targets);
      store.setWebdropOpen(true);
    }
  };

  const handleDrop = (e: React.DragEvent, bucket: string) => {
    e.preventDefault();
    e.stopPropagation();
    handleAction(bucket);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
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
          onClick={() => handleAction("archive")}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "archive")}
          style={{
            padding: "10px 8px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .15s, background .15s, box-shadow .15s",
          }}
        >
          <Archive size={15} style={{ color: "#fbbf24" }} />
          <span>📦 ZIP Archive</span>
        </div>

        <div
          className="drop-bucket"
          data-drop-bucket="trash"
          title="Drop files here to send directly to Trash"
          onClick={() => handleAction("trash")}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "trash")}
          style={{
            padding: "10px 8px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .15s, background .15s, box-shadow .15s",
          }}
        >
          <Trash2 size={15} style={{ color: "#f87171" }} />
          <span>🗑 Send to Trash</span>
        </div>

        <div
          className="drop-bucket"
          data-drop-bucket="webdrop"
          title="Drop files here to open Mobile QR WebDrop"
          onClick={() => handleAction("webdrop")}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "webdrop")}
          style={{
            padding: "10px 8px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .15s, background .15s, box-shadow .15s",
          }}
        >
          <Share2 size={15} style={{ color: "#34d399" }} />
          <span>📱 Send to Phone</span>
        </div>

        <div
          className="drop-bucket"
          data-drop-bucket="shelf"
          title="Drop files here to add to Staging Shelf"
          onClick={() => handleAction("shelf")}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "shelf")}
          style={{
            padding: "10px 8px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            textAlign: "center",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-dim)",
            transition: "border-color .15s, background .15s, box-shadow .15s",
          }}
        >
          <Layers size={15} style={{ color: "#38bdf8" }} />
          <span>📋 Add to Shelf</span>
        </div>
      </div>
    </div>
  );
}
