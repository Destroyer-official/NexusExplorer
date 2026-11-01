import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ipc } from "@/lib/ipc";
import { ExternalLink, FolderOpen, ZoomIn, ZoomOut, RotateCw, FileText } from "lucide-react";

interface PdfViewerProps {
  filePath: string;
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const fileSrc = convertFileSrc(filePath);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-xs">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-400" />
          <span className="font-medium text-slate-200 truncate max-w-[180px]">
            {filePath.split(/[/\\]/).pop()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-300 w-10 text-center">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>

          <div className="h-3.5 w-[1px] bg-slate-700 mx-1" />

          <button
            onClick={handleRotate}
            title="Rotate 90°"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>

          <div className="h-3.5 w-[1px] bg-slate-700 mx-1" />

          <button
            onClick={() => ipc.openPath(filePath)}
            title="Open in System Default PDF Reader"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-200 transition text-[11px]"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Open</span>
          </button>
          <button
            onClick={() => ipc.revealInShell(filePath)}
            title="Reveal in File Explorer"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Embedded PDF iframe */}
      <div className="flex-1 w-full h-full overflow-hidden relative bg-slate-950 flex items-center justify-center">
        <iframe
          src={`${fileSrc}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}`}
          title="PDF Document Viewer"
          className="w-full h-full border-none"
          style={{
            transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
            transition: "transform 0.2s ease",
          }}
        />
      </div>
    </div>
  );
}

