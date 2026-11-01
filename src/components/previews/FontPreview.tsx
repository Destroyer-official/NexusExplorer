import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/ipc";

interface FontPreviewProps {
  filePath: string;
  name: string;
}

const SAMPLE_TEXTS = [
  { label: "Pangram", text: "The quick brown fox jumps over the lazy dog." },
  { label: "Headline", text: "NexusExplorer 2027: Next-Gen Intelligent System" },
  { label: "Numbers & Symbols", text: "0123456789 !@#$%^&*()_+-=[]{}|;':\",./<>?" },
  { label: "Uppercase", text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { label: "Lowercase", text: "abcdefghijklmnopqrstuvwxyz" },
];

export default function FontPreview({ filePath, name: _name }: FontPreviewProps) {
  const [fontSize, setFontSize] = useState(24);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [customText, setCustomText] = useState("");
  const [fontFamilyName, setFontFamilyName] = useState("");

  useEffect(() => {
    // Generate unique font family name
    const family = `nexus_font_${Math.random().toString(36).slice(2, 8)}`;
    setFontFamilyName(family);

    const fontUrl = assetUrl(filePath);
    const fontFace = new FontFace(family, `url("${fontUrl}")`);
    fontFace.load().then((loaded) => {
      document.fonts.add(loaded);
    }).catch((err) => {
      console.warn("Failed to load font face:", err);
    });

    return () => {
      // Cleanup font if needed
    };
  }, [filePath]);

  const activeText = customText.trim() ? customText : SAMPLE_TEXTS[sampleIdx].text;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <select
          value={sampleIdx}
          onChange={(e) => {
            setSampleIdx(parseInt(e.target.value, 10));
            setCustomText("");
          }}
          style={{
            flex: 1,
            padding: "3px 6px",
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            fontSize: 11,
          }}
        >
          {SAMPLE_TEXTS.map((s, i) => (
            <option key={i} value={i}>{s.label}</option>
          ))}
        </select>

        <span style={{ color: "var(--text-dim)" }}>{fontSize}px</span>
        <input
          type="range"
          min="12"
          max="72"
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
          style={{ width: 70, accentColor: "var(--accent)" }}
        />
      </div>

      <input
        type="text"
        placeholder="Type custom preview text..."
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        style={{
          padding: "4px 8px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text)",
          fontSize: 11,
        }}
      />

      {/* Font Render Canvas */}
      <div
        style={{
          fontFamily: fontFamilyName ? `"${fontFamilyName}", sans-serif` : "sans-serif",
          fontSize: `${fontSize}px`,
          lineHeight: 1.3,
          minHeight: 120,
          maxHeight: 200,
          overflowY: "auto",
          padding: 12,
          background: "var(--bg-subtle)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          wordBreak: "break-word",
        }}
      >
        {activeText}
      </div>

      {/* Glyphs waterfall */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: fontFamilyName ? `"${fontFamilyName}", sans-serif` : "sans-serif",
          fontSize: 13,
          color: "var(--text-dim)",
          maxHeight: 100,
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 11 }}>12px: Sphinx of black quartz, judge my vow.</div>
        <div style={{ fontSize: 16 }}>16px: Sphinx of black quartz, judge my vow.</div>
        <div style={{ fontSize: 20 }}>20px: Sphinx of black quartz, judge my vow.</div>
      </div>
    </div>
  );
}
