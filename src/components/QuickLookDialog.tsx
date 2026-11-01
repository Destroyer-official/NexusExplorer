import { useAppStore } from "@/state/store";
import { ipc, assetUrl } from "@/lib/ipc";
import { formatBytes, formatDate, isImageExt } from "@/lib/format";
import { X, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import AudioWaveformPreview from "@/components/previews/AudioWaveformPreview";
import { VideoPlayerPreview } from "@/components/previews/VideoPlayerPreview";
import SvgInspector from "@/components/previews/SvgInspector";
import Model3DPreview from "@/components/previews/Model3DPreview";
import FontPreview from "@/components/previews/FontPreview";
import { PdfViewer } from "@/components/previews/PdfViewer";

export default function QuickLookDialog() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const selected = activeTab?.selected ?? [];
  const entry = selected.length === 1 ? (activeTab?.entries.find((e) => e.path === selected[0]) ?? null) : null;
  const [text, setText] = useState("");

  useEffect(() => {
    setText("");
    if (!entry || entry.isDir) return;
    const ext = entry.ext.toLowerCase();
    const textExts = new Set([
      "txt", "md", "json", "rs", "ts", "tsx", "js", "py", "log", "csv", "yaml", "yml",
      "toml", "ini", "xml", "html", "css", "scss", "sql", "sh", "bat", "ps1", "c", "cpp", "h"
    ]);
    if (textExts.has(ext)) {
      ipc.readTextFile(entry.path, 32768).then((r) => setText(r.content)).catch(() => setText(""));
    }
  }, [entry?.path]);

  // Spacebar or Escape to close QuickLook
  useEffect(() => {
    if (!store.quickLookOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        store.setQuickLookOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [store.quickLookOpen]);

  useEffect(() => {
    if (store.quickLookOpen && entry?.isDir && !store.folderSizes[entry.path] && !store.folderSizeTasks[entry.path]) {
      void store.calculateFolderSize(entry.path);
    }
  }, [store.quickLookOpen, entry?.path, store.folderSizes, store.folderSizeTasks]);

  if (!store.quickLookOpen) return null;

  const ext = entry?.ext?.toLowerCase() ?? "";
  const isAudio = /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(entry?.name ?? "");
  const isVideo = /\.(mp4|webm|mkv|mov|avi|wmv)$/i.test(entry?.name ?? "");
  const isSvg = ext === "svg";
  const is3D = ["gltf", "glb", "obj", "stl"].includes(ext);
  const isFont = ["ttf", "otf", "woff", "woff2"].includes(ext);
  const isPdf = ext === "pdf";
  const isImage = entry ? isImageExt(entry.ext) : false;

  return (
    <div
      className="overlay"
      onClick={() => store.setQuickLookOpen(false)}
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", zIndex: 100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 94vw)",
          height: "min(640px, 86vh)",
          maxHeight: "86vh",
          background: "var(--bg-2)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <strong style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry?.name ?? "Quick Look Preview"}
          </strong>
          {entry && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", marginRight: 8 }}>
              {entry.isDir
                ? store.folderSizes[entry.path]
                  ? formatBytes(store.folderSizes[entry.path].size)
                  : "Folder"
                : formatBytes(entry.size)} · {formatDate(entry.modifiedMs)}
            </span>
          )}
          {entry && (
            <button
              className="icon-btn"
              style={{ width: 26, height: 26 }}
              title="Open with default handler"
              onClick={() => {
                store.setQuickLookOpen(false);
                void store.openEntry(entry);
              }}
            >
              <ExternalLink size={13} />
            </button>
          )}
          <button
            className="icon-btn"
            style={{ width: 26, height: 26 }}
            onClick={() => store.setQuickLookOpen(false)}
            title="Close (Space or Esc)"
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", padding: isAudio || isVideo || is3D || isFont ? 0 : 16 }}>
          {!entry ? (
            <div style={{ color: "var(--text-faint)", margin: "auto" }}>Select a file to preview.</div>
          ) : entry.isDir ? (
            <div style={{ textAlign: "center", color: "var(--text-dim)", margin: "auto" }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>📁</div>
              <div style={{ fontWeight: 600 }}>{entry.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>{entry.path}</div>
              <div style={{ fontSize: 13, color: "var(--accent)", marginTop: 10, fontWeight: 500 }}>
                {store.folderSizes[entry.path]
                  ? `${formatBytes(store.folderSizes[entry.path].size)} (${store.folderSizes[entry.path].files} files, ${store.folderSizes[entry.path].folders} folders)`
                  : store.folderSizeTasks[entry.path]
                    ? "Calculating size…"
                    : "Folder"}
              </div>
            </div>
          ) : isAudio ? (
            <div style={{ padding: 16, height: "100%" }}>
              <AudioWaveformPreview src={assetUrl(entry.path)} name={entry.name} size={entry.size} />
            </div>
          ) : isVideo ? (
            <VideoPlayerPreview src={assetUrl(entry.path)} name={entry.name} size={entry.size} />
          ) : isSvg ? (
            <div style={{ height: "100%", padding: 12 }}>
              <SvgInspector filePath={entry.path} name={entry.name} />
            </div>
          ) : is3D ? (
            <Model3DPreview filePath={entry.path} name={entry.name} size={entry.size} />
          ) : isFont ? (
            <FontPreview filePath={entry.path} name={entry.name} />
          ) : isPdf ? (
            <PdfViewer filePath={entry.path} />
          ) : isImage ? (
            <div style={{ display: "grid", placeItems: "center", height: "100%", width: "100%" }}>
              <img
                src={assetUrl(entry.path)}
                alt={entry.name}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "var(--radius-md)" }}
              />
            </div>
          ) : text ? (
            <pre
              className="mono"
              style={{
                width: "100%",
                height: "100%",
                margin: 0,
                fontSize: 12,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "var(--surface)",
                padding: 12,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                overflow: "auto",
              }}
            >
              {text}
            </pre>
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-dim)", margin: "auto" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 600 }}>{entry.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
                {formatBytes(entry.size)} · {formatDate(entry.modifiedMs)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}