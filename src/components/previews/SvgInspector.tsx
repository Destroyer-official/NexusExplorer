import { useEffect, useState } from "react";
import { Copy, Check, ZoomIn, ZoomOut, RotateCcw, Code } from "lucide-react";
import { ipc } from "@/lib/ipc";

interface SvgInspectorProps {
  filePath: string;
  name: string;
}

export default function SvgInspector({ filePath, name: _name }: SvgInspectorProps) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ paths: number; width?: string; height?: string }>({ paths: 0 });

  useEffect(() => {
    ipc.readTextFile(filePath, 256 * 1024).then((res) => {
      const text = res.content;
      setSvgContent(text);
      // Parse paths & dimensions
      const pathMatches = text.match(/<path/gi);
      const widthMatch = text.match(/width="([^"]+)"/i);
      const heightMatch = text.match(/height="([^"]+)"/i);
      const viewBoxMatch = text.match(/viewBox="([^"]+)"/i);

      setStats({
        paths: pathMatches ? pathMatches.length : 0,
        width: widthMatch ? widthMatch[1] : (viewBoxMatch ? viewBoxMatch[1].split(" ")[2] : undefined),
        height: heightMatch ? heightMatch[1] : (viewBoxMatch ? viewBoxMatch[1].split(" ")[3] : undefined),
      });
    }).catch(() => setSvgContent(""));
  }, [filePath]);

  const copyCode = () => {
    void navigator.clipboard.writeText(svgContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", gap: 8 }}>
      {/* Metrics bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-dim)" }}>
        {stats.width && stats.height && (
          <span className="badge" style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4 }}>
            {stats.width} × {stats.height}
          </span>
        )}
        <span className="badge" style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4 }}>
          {stats.paths} paths
        </span>
        <span style={{ flex: 1 }} />
        <button
          className={`btn btn-sm ${showCode ? "btn-primary" : ""}`}
          onClick={() => setShowCode(!showCode)}
          title="Toggle Raw Code"
        >
          <Code size={12} /> {showCode ? "Visual" : "Code"}
        </button>
        <button className="icon-btn" onClick={copyCode} title="Copy SVG Code">
          {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
        </button>
      </div>

      {/* Stage */}
      {showCode ? (
        <pre
          style={{
            flex: 1,
            maxHeight: 260,
            overflowY: "auto",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            background: "var(--bg-card)",
            padding: 8,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {svgContent}
        </pre>
      ) : (
        <div
          style={{
            position: "relative",
            flex: 1,
            minHeight: 180,
            maxHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(#222 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            backgroundColor: "var(--bg-subtle)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transition: "transform 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {/* Floating zoom controls */}
          <div
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(0, 0, 0, 0.7)",
              borderRadius: "var(--radius-sm)",
              padding: "2px 4px",
            }}
          >
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}>
              <ZoomOut size={12} />
            </button>
            <span style={{ fontSize: 10, minWidth: 28, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setZoom((z) => Math.min(5, z + 0.2))}>
              <ZoomIn size={12} />
            </button>
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setZoom(1)}>
              <RotateCcw size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
