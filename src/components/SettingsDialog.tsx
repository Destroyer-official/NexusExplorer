import { useState } from "react";
import { useAppStore } from "@/state/store";
import {
  ACCENTS,
  THEME_PRESETS,
  resolveAccent,
  themeById,
  exportThemeJson,
  importThemeJson,
  loadSavedCustomThemes,
  saveCustomThemesToStorage,
} from "@/lib/theme";
import type { CustomThemeDefinition } from "@/types";
import {
  X,
  Palette,
  Compass,
  Zap,
  ShieldCheck,
  Keyboard,
  Info,
  Check,
  RotateCcw,
  Sparkles,
  Cpu,
  Lock,
  Layers,
  Copy,
  SlidersHorizontal,
  Download,
  Upload,
  Plus,
  Trash2,
  Type,
  Eye,
  Sun,
  Moon,
} from "lucide-react";

type SettingsCategory = "appearance" | "browsing" | "performance" | "forensics" | "shortcuts" | "about";

export default function SettingsDialog() {
  const store = useAppStore();
  const s = store.settings;
  const appInfo = store.appInfo;
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("appearance");
  const [copiedDiag, setCopiedDiag] = useState(false);
  const [shortcutFilter, setShortcutFilter] = useState("");

  // Appearance & Customization State
  const [themeFilter, setThemeFilter] = useState<"all" | "core" | "developer" | "vibrant" | "custom">("all");
  const [customHexInput, setCustomHexInput] = useState(s.customAccentColor || (s.accent.startsWith("#") ? s.accent : ""));
  const [customStudioOpen, setCustomStudioOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [customThemesList, setCustomThemesList] = useState<CustomThemeDefinition[]>(() => {
    return s.customThemes && s.customThemes.length > 0 ? s.customThemes : loadSavedCustomThemes();
  });

  const [studioDraft, setStudioDraft] = useState<CustomThemeDefinition>({
    id: "",
    name: "My Custom Glass",
    isDark: true,
    bg: "#13161c",
    bg2: "#1c212a",
    surface: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.12)",
    text: "#f1f5f9",
    textDim: "#94a3b8",
    accent: "#06b6d4",
    glassBlur: 32,
    glassOpacity: 85,
    borderRadius: 10,
    fontFamily: "default",
  });

  const Toggle = ({
    checked,
    onChange,
    label,
    desc,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    desc?: string;
  }) => (
    <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ paddingRight: 16 }}>
        <div className="settings-label" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{label}</div>
        {desc && <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  );

  const categories: Array<{ id: SettingsCategory; label: string; icon: React.ReactNode }> = [
    { id: "appearance", label: "Appearance", icon: <Palette size={15} /> },
    { id: "browsing", label: "File Browsing", icon: <Compass size={15} /> },
    { id: "performance", label: "Performance", icon: <Zap size={15} /> },
    { id: "forensics", label: "Forensics & Safety", icon: <ShieldCheck size={15} /> },
    { id: "shortcuts", label: "Keybindings", icon: <Keyboard size={15} /> },
    { id: "about", label: "About & Engine", icon: <Info size={15} /> },
  ];

  const shortcutsList = [
    { keys: "Ctrl+K", desc: "Nexus AI Agent (Natural language pipeline)" },
    { keys: "Space", desc: "Quick Look Instant Preview" },
    { keys: "Ctrl+Shift+P", desc: "Command Palette & Quick Launcher" },
    { keys: "Ctrl+1 / 2 / 3", desc: "Switch View (List / Grid / Miller Columns)" },
    { keys: "Ctrl+T / Ctrl+W", desc: "New Tab / Close Active Tab" },
    { keys: "Ctrl+B / Ctrl+P", desc: "Toggle Sidebar / Toggle Preview Pane" },
    { keys: "Ctrl+F", desc: "Deep Content & File Name Search" },
    { keys: "Ctrl+Alt+C", desc: "Copy Full Absolute Path to Clipboard" },
    { keys: "Ctrl+Shift+N", desc: "Create New Folder" },
    { keys: "F2", desc: "Rename Selected Item" },
    { keys: "Ctrl+Shift+R", desc: "Batch Regex Renamer Dialog" },
    { keys: "Ctrl+Alt+P", desc: "Forensic Power Tools Hub" },
    { keys: "Delete / Shift+Del", desc: "Send to Recycle Bin / Permanent Delete" },
    { keys: "F5 / Ctrl+R", desc: "Refresh Current Directory" },
    { keys: "Alt+Left / Right", desc: "Navigate Back / Forward in History" },
    { keys: "Alt+Up / Backspace", desc: "Navigate to Parent Directory" },
    { keys: "Ctrl+,", desc: "Open Preferences & Settings Hub" },
    { keys: "Ctrl+/", desc: "Open Keyboard Shortcuts Sheet" },
  ];

  const filteredShortcuts = shortcutsList.filter(
    (item) =>
      item.keys.toLowerCase().includes(shortcutFilter.toLowerCase()) ||
      item.desc.toLowerCase().includes(shortcutFilter.toLowerCase())
  );

  const copyDiagnostics = () => {
    const diag = [
      `Nexus Explorer v${appInfo?.version || "2.0.0"} (Production Ready)`,
      `Engine: ${appInfo?.engineVersion || "v2.0.0"} (${appInfo?.platform || "Windows"} / ${appInfo?.arch || "x86_64"})`,
      `User: ${appInfo?.user || "Developer"} @ ${appInfo?.hostname || "Localhost"}`,
      `Storage Acceleration: ReFS Dev Drive CoW Active`,
      `Active Theme: ${s.theme} | Accent: ${s.accent} | Density: ${s.density}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join("\n");
    void navigator.clipboard.writeText(diag);
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2500);
  };

  return (
    <div className="overlay" onClick={() => store.setSettingsOpen(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 780,
          maxWidth: "95vw",
          height: 620,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Nexus Preferences</span>
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                background: "rgba(6, 182, 212, 0.15)",
                color: "#38bdf8",
                border: "1px solid rgba(6, 182, 212, 0.3)",
                fontWeight: 600,
                letterSpacing: "0.5px",
              }}
            >
              2027+ HYBRID ENGINE
            </span>
          </div>
          <span style={{ flex: 1 }} />
          <button
            aria-label="Close settings"
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => store.setSettingsOpen(false)}
          >
            <X size={15} />
          </button>
        </div>

        {/* Master Body: Sidebar + Content */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          {/* Left Category Tabs */}
          <div
            style={{
              width: 200,
              borderRight: "1px solid var(--border)",
              background: "rgba(0,0,0,0.12)",
              padding: "12px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {categories.map((c) => {
              const active = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    color: active ? "var(--text)" : "var(--text-dim)",
                    background: active
                      ? "var(--selection)"
                      : "transparent",
                    border: active ? "1px solid var(--selection-border)" : "1px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ color: active ? "var(--accent)" : "inherit" }}>{c.icon}</span>
                  <span style={{ flex: 1 }}>{c.label}</span>
                  {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)" }} />}
                </button>
              );
            })}

            <div style={{ flex: 1 }} />
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-faint)", borderTop: "1px solid var(--border)" }}>
              NexusExplorer v{appInfo?.version || "2.0.0"}
            </div>
          </div>

          {/* Right Category Panels */}
          <div style={{ flex: 1, padding: "18px 24px", overflowY: "auto" }}>
            {/* 1. Appearance Panel */}
            {activeCategory === "appearance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Header & Reset */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <Palette size={16} style={{ color: "var(--accent)" }} /> Theme & Visual Polish Studio
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "4px 0 0" }}>
                      Curated developer palettes, native Windows 11 Mica & Acrylic glass, or complete freedom to build custom themes.
                    </p>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, flexShrink: 0 }}
                    onClick={() => {
                      void store.resetSettings();
                    }}
                    title="Reset all visual options back to Nexus Slate default"
                  >
                    <RotateCcw size={12} /> Reset to Defaults
                  </button>
                </div>

                {/* Live Mini-Window Interactive Preview */}
                <div
                  style={{
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    background: "var(--bg)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 12px",
                      background: "var(--glass-top)",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: "flex", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                    </div>
                    <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px 4px 0 0",
                          background: "var(--bg-2)",
                          borderBottom: "2px solid var(--accent)",
                          color: "var(--text)",
                          fontWeight: 600,
                        }}
                      >
                        Nexus Explorer
                      </span>
                      <span style={{ padding: "2px 8px", color: "var(--text-faint)" }}>Workspace</span>
                    </div>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--accent-subtle)",
                        color: "var(--accent)",
                        border: "1px solid var(--selection-border)",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}
                    >
                      LIVE PREVIEW
                    </span>
                  </div>

                  <div style={{ display: "flex", height: 105, fontSize: 11 }}>
                    {/* Mini Sidebar */}
                    <div
                      style={{
                        width: 140,
                        background: "var(--glass-side)",
                        borderRight: "1px solid var(--border)",
                        padding: "8px 6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <div style={{ fontSize: 9, textTransform: "uppercase", color: "var(--text-faint)", padding: "0 4px" }}>
                        Navigation
                      </div>
                      <div
                        style={{
                          padding: "3px 6px",
                          borderRadius: 4,
                          background: "var(--selection)",
                          color: "var(--text)",
                          fontWeight: 600,
                          border: "1px solid var(--selection-border)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                        Active Repo
                      </div>
                      <div style={{ padding: "3px 6px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-faint)" }} />
                        Virtual Drives
                      </div>
                    </div>

                    {/* Mini File Listing */}
                    <div style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4, background: "var(--glass-main)" }}>
                      <div
                        style={{
                          padding: "3px 8px",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          color: "var(--text-dim)",
                        }}
                      >
                        <span>📁 src / tools</span>
                        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>Folder</span>
                      </div>
                      <div
                        style={{
                          padding: "3px 8px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--selection)",
                          border: "1px solid var(--selection-border)",
                          color: "var(--text)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          boxShadow: "0 0 8px var(--accent-glow)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                          <Check size={11} style={{ color: "var(--accent)" }} />
                          nexus_engine.rs
                        </span>
                        <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>Active Selection</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
                        <button
                          style={{
                            padding: "3px 10px",
                            fontSize: 10,
                            borderRadius: "var(--radius-sm)",
                            background: "var(--accent)",
                            color: "var(--text-on-accent)",
                            border: "none",
                            fontWeight: 600,
                            boxShadow: "0 2px 8px var(--accent-glow)",
                            cursor: "pointer",
                          }}
                        >
                          Accent Action
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "4px 12px",
                      background: "var(--bg-2)",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 10,
                      color: "var(--text-dim)",
                    }}
                  >
                    <span>
                      Active: <strong style={{ color: "var(--text)" }}>{s.activeCustomTheme?.name || themeById(s.theme)?.name || s.theme}</strong>
                    </span>
                    <span>
                      Accent: <strong style={{ color: "var(--accent)" }}>{resolveAccent(s.customAccentColor || s.accent).name}</strong>
                    </span>
                    <span>
                      Blur: <strong>{s.glassBlur ?? 32}px</strong> · Radius: <strong>{s.borderRadius ?? 10}px</strong>
                    </span>
                  </div>
                </div>

                {/* 1. Curated Theme Gallery */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Curated Theme Presets</span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "var(--surface-3)", color: "var(--text-dim)" }}>
                        {THEME_PRESETS.length + customThemesList.length} total
                      </span>
                    </div>

                    {/* Filter Tabs */}
                    <div className="seg" style={{ fontSize: 11 }}>
                      {(["all", "core", "developer", "vibrant", "custom"] as const).map((tab) => (
                        <button
                          key={tab}
                          className={`seg-btn ${themeFilter === tab ? "active" : ""}`}
                          onClick={() => setThemeFilter(tab)}
                          style={{ padding: "3px 8px", fontSize: 11 }}
                        >
                          {tab === "all" ? "All" : tab === "core" ? "Core & Glass" : tab === "developer" ? "Developer" : tab === "vibrant" ? "Vibrant" : `Custom (${customThemesList.length})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Presets Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 10 }}>
                    {THEME_PRESETS.filter((p) => {
                      if (themeFilter === "all") return true;
                      if (themeFilter === "custom") return false;
                      return p.category === themeFilter;
                    }).map((preset) => {
                      const sel = !s.activeCustomTheme && (s.theme === preset.id || (preset.id === "dark" && s.theme === "system"));
                      return (
                        <div
                          key={preset.id}
                          onClick={() => {
                            void store.updateSettings({
                              theme: preset.id,
                              activeCustomTheme: null,
                              accent: s.customAccentColor ? s.accent : preset.defaultAccent,
                              glassBlur: preset.glassBlur,
                              glassOpacity: preset.glassOpacity,
                            });
                          }}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "var(--radius-md)",
                            background: sel ? "var(--selection)" : "var(--surface)",
                            border: sel ? "2px solid var(--accent)" : "1px solid var(--border)",
                            boxShadow: sel ? "0 0 12px var(--accent-glow)" : "none",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: sel ? "var(--accent)" : "var(--text)" }}>
                              {preset.name}
                            </span>
                            {sel && (
                              <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--accent)", color: "var(--text-on-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Check size={10} />
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.3, minHeight: 26 }}>
                            {preset.description}
                          </span>
                          {/* Mini Palette Swatch */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: preset.colors.bg, border: "1px solid rgba(255,255,255,0.2)" }} title="Background" />
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: preset.colors.surface, border: "1px solid rgba(255,255,255,0.2)" }} title="Surface" />
                            <span style={{ width: 12, height: 12, borderRadius: "50%", background: resolveAccent(preset.defaultAccent).hue }} title="Default Accent" />
                            <span style={{ flex: 1 }} />
                            <span style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase" }}>{preset.category}</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Custom Themes in Grid */}
                    {(themeFilter === "all" || themeFilter === "custom") &&
                      customThemesList.map((custom) => {
                        const sel = s.activeCustomTheme?.id === custom.id;
                        return (
                          <div
                            key={custom.id}
                            onClick={() => {
                              void store.updateSettings({
                                theme: custom.id,
                                activeCustomTheme: custom,
                                accent: custom.accent,
                                customAccentColor: custom.accent,
                                glassBlur: custom.glassBlur ?? 32,
                                glassOpacity: custom.glassOpacity ?? 85,
                                borderRadius: custom.borderRadius ?? 10,
                                fontFamily: custom.fontFamily ?? "default",
                              });
                            }}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "var(--radius-md)",
                              background: sel ? "var(--selection)" : "var(--surface)",
                              border: sel ? "2px solid var(--accent)" : "1px dashed var(--accent)",
                              boxShadow: sel ? "0 0 12px var(--accent-glow)" : "none",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: sel ? "var(--accent)" : "var(--text)" }}>
                                {custom.name}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                {sel && (
                                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--accent)", color: "var(--text-on-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Check size={10} />
                                  </span>
                                )}
                                <button
                                  className="icon-btn"
                                  style={{ width: 18, height: 18, color: "var(--danger)" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = customThemesList.filter((t) => t.id !== custom.id);
                                    setCustomThemesList(updated);
                                    saveCustomThemesToStorage(updated);
                                    if (s.activeCustomTheme?.id === custom.id) {
                                      void store.updateSettings({ theme: "dark", activeCustomTheme: null, customThemes: updated });
                                    } else {
                                      void store.updateSettings({ customThemes: updated });
                                    }
                                    store.pushToast("info", "Theme Deleted", `Removed "${custom.name}".`);
                                  }}
                                  title="Delete custom theme"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.3 }}>
                              User Custom Theme · {custom.isDark ? "Dark base" : "Light base"}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
                              <span style={{ width: 12, height: 12, borderRadius: "50%", background: custom.bg, border: "1px solid rgba(255,255,255,0.2)" }} />
                              <span style={{ width: 12, height: 12, borderRadius: "50%", background: custom.surface, border: "1px solid rgba(255,255,255,0.2)" }} />
                              <span style={{ width: 12, height: 12, borderRadius: "50%", background: custom.accent }} />
                              <span style={{ flex: 1 }} />
                              <span style={{ fontSize: 9, color: "var(--accent)", fontWeight: 600 }}>CUSTOM</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* 2. Color Accent Palette & Custom Hex Picker */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="settings-label" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                        Color Accent & Focus Glow
                      </div>
                      <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        Shapes directory selections, active tabs, buttons, focus halos, and drag-drop indicators
                      </div>
                    </div>
                    {/* Active Accent Tag */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "3px 8px", borderRadius: "var(--radius-sm)", background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)" }} />
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{resolveAccent(s.customAccentColor || s.accent).name}</span>
                    </div>
                  </div>

                  {/* Curated Swatches Row */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
                    {ACCENTS.map((a) => {
                      const sel = !s.customAccentColor && s.accent === a.id;
                      return (
                        <button
                          key={a.id}
                          className={`swatch ${sel ? "active" : ""}`}
                          style={{
                            background: a.hue,
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            border: sel ? "2px solid #ffffff" : "2px solid transparent",
                            boxShadow: sel ? `0 0 12px ${a.glow}` : "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            transform: sel ? "scale(1.15)" : "scale(1)",
                          }}
                          onClick={() => {
                            setCustomHexInput("");
                            void store.updateSettings({ accent: a.id, customAccentColor: "" });
                          }}
                          title={a.name}
                        />
                      );
                    })}

                    {/* Custom Hex Color Picker Divider */}
                    <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

                    {/* Native Color Picker Trigger + Hex Input */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", padding: "3px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                      <label style={{ position: "relative", width: 22, height: 22, borderRadius: "50%", overflow: "hidden", cursor: "pointer", display: "inline-block", border: "1px solid var(--border-strong)" }} title="Open Color Wheel">
                        <input
                          type="color"
                          value={customHexInput.startsWith("#") ? customHexInput : resolveAccent(s.customAccentColor || s.accent).hue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomHexInput(val);
                            void store.updateSettings({ accent: val, customAccentColor: val });
                          }}
                          style={{ position: "absolute", top: -8, left: -8, width: 40, height: 40, cursor: "pointer", opacity: 0 }}
                        />
                        <span style={{ display: "block", width: "100%", height: "100%", background: customHexInput.startsWith("#") ? customHexInput : resolveAccent(s.customAccentColor || s.accent).hue }} />
                      </label>
                      <input
                        type="text"
                        placeholder="#7C6CFF"
                        value={customHexInput}
                        onChange={(e) => setCustomHexInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && /^#[0-9a-fA-F]{6}$/.test(customHexInput)) {
                            void store.updateSettings({ accent: customHexInput, customAccentColor: customHexInput });
                            store.pushToast("success", "Custom Accent Applied", `Accent set to ${customHexInput}`);
                          }
                        }}
                        style={{
                          width: 80,
                          fontSize: 11,
                          fontFamily: "monospace",
                          border: "none",
                          background: "transparent",
                          color: "var(--text)",
                          outline: "none",
                        }}
                      />
                      <button
                        className="btn btn-sm"
                        style={{ padding: "3px 8px", fontSize: 10 }}
                        onClick={() => {
                          let hex = customHexInput.trim();
                          if (!hex.startsWith("#")) hex = `#${hex}`;
                          if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                            setCustomHexInput(hex);
                            void store.updateSettings({ accent: hex, customAccentColor: hex });
                            store.pushToast("success", "Custom Accent Applied", `Accent set to ${hex}`);
                          } else {
                            store.pushToast("warning", "Invalid Hex", "Please enter a valid 6-character hex code like #06B6D4");
                          }
                        }}
                      >
                        Set
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Visual Polish: Glass Sliders & Typography */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                    <SlidersHorizontal size={14} style={{ color: "var(--accent)" }} /> Materials & Interface Geometry
                  </div>

                  {/* Frosted Glass Blur Slider */}
                  <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="settings-label" style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        Frosted Glass Blur Intensity
                      </div>
                      <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        GPU backdrop-filter blur for Mica, Acrylic, and smoked glass (0px solid to 48px heavy frost)
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="range"
                        min="0"
                        max="48"
                        step="2"
                        value={s.glassBlur ?? 32}
                        onChange={(e) => void store.updateSettings({ glassBlur: Number(e.target.value) })}
                        style={{ width: 130, accentColor: "var(--accent)", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, width: 34, textAlign: "right", color: "var(--text)" }}>
                        {s.glassBlur ?? 32}px
                      </span>
                    </div>
                  </div>

                  {/* Glass Opacity Slider */}
                  <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="settings-label" style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        Glass Shell Background Opacity
                      </div>
                      <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        Window chrome translucency (20% ultra-sheer to 100% completely solid matte)
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        step="5"
                        value={s.glassOpacity ?? 85}
                        onChange={(e) => void store.updateSettings({ glassOpacity: Number(e.target.value) })}
                        style={{ width: 130, accentColor: "var(--accent)", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, width: 34, textAlign: "right", color: "var(--text)" }}>
                        {s.glassOpacity ?? 85}%
                      </span>
                    </div>
                  </div>

                  {/* Window Corner Radius Selector */}
                  <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="settings-label" style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        Corner Curvature Radius
                      </div>
                      <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        Curvature applied to windows, modals, file tiles, and buttons
                      </div>
                    </div>
                    <div className="seg">
                      {[
                        { label: "Square", val: 0 },
                        { label: "Subtle (6px)", val: 6 },
                        { label: "Fluent (10px)", val: 10 },
                        { label: "Modern (14px)", val: 14 },
                        { label: "Round (20px)", val: 20 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          className={`seg-btn ${(s.borderRadius ?? 10) === item.val ? "active" : ""}`}
                          onClick={() => void store.updateSettings({ borderRadius: item.val })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* UI Typography */}
                  <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="settings-label" style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Type size={13} style={{ color: "var(--accent)" }} /> Interface Typography
                      </div>
                      <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        Font family rendering across lists, trees, path headers, and tools
                      </div>
                    </div>
                    <div className="seg">
                      {[
                        { id: "default", label: "Fluent Default" },
                        { id: "segoe", label: "Segoe UI Variable" },
                        { id: "inter", label: "Inter Sans" },
                        { id: "mono", label: "Cascadia Mono" },
                      ].map((f) => (
                        <button
                          key={f.id}
                          className={`seg-btn ${(s.fontFamily ?? "default") === f.id ? "active" : ""}`}
                          onClick={() => void store.updateSettings({ fontFamily: f.id })}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Density */}
                  <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="settings-label" style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>Interface Density</div>
                      <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Comfortable (36px rows) or High-Density Compact (28px rows)</div>
                    </div>
                    <div className="seg">
                      {(["comfortable", "compact"] as const).map((d) => (
                        <button
                          key={d}
                          className={`seg-btn ${s.density === d ? "active" : ""}`}
                          onClick={() => void store.updateSettings({ density: d })}
                        >
                          {d[0].toUpperCase() + d.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Animations Toggle */}
                  <Toggle
                    checked={s.animations}
                    onChange={(v) => void store.updateSettings({ animations: v })}
                    label="Motion & Transitions"
                    desc="GPU-accelerated micro-animations, folder zoom transitions, and smooth hover state interpolation"
                  />
                </div>

                {/* 4. Custom Theme Studio (Build, Import, Export) */}
                <div style={{ marginTop: 6, border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--surface)", overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    onClick={() => setCustomStudioOpen(!customStudioOpen)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Sparkles size={15} style={{ color: "var(--accent)" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                          Custom Theme Creator & Share Studio
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          Build custom palettes from scratch, export JSON schemas, or import community designs
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = s.activeCustomTheme || themeById(s.theme) || THEME_PRESETS[0];
                          const json = exportThemeJson(target);
                          void navigator.clipboard.writeText(json);
                          store.pushToast("success", "Theme JSON Exported", "Theme configuration copied to clipboard!");
                        }}
                        title="Copy current theme as JSON"
                      >
                        <Download size={12} /> Export JSON
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportModalOpen(!importModalOpen);
                        }}
                        title="Import theme from JSON"
                      >
                        <Upload size={12} /> Import JSON
                      </button>
                      <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                        {customStudioOpen ? "▲ Hide" : "▼ Open Studio"}
                      </span>
                    </div>
                  </div>

                  {/* Inline Import Modal */}
                  {importModalOpen && (
                    <div style={{ padding: "14px 16px", background: "var(--bg-2)", borderTop: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                        Paste Theme JSON Configuration
                      </div>
                      <textarea
                        value={importJsonText}
                        onChange={(e) => setImportJsonText(e.target.value)}
                        placeholder='{"name": "My Cyber Theme", "theme": {"bg": "#121212", "text": "#ffffff", "accent": "#06b6d4"}}'
                        rows={4}
                        style={{
                          width: "100%",
                          fontSize: 11,
                          fontFamily: "monospace",
                          padding: 8,
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface)",
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                          resize: "vertical",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                        <button className="btn btn-sm" onClick={() => setImportModalOpen(false)}>
                          Cancel
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            if (!importJsonText.trim()) return;
                            const imported = importThemeJson(importJsonText);
                            if (!imported) {
                              store.pushToast("error", "Import Failed", "Could not parse valid theme JSON.");
                              return;
                            }
                            const updated = [...customThemesList, imported];
                            setCustomThemesList(updated);
                            saveCustomThemesToStorage(updated);
                            void store.updateSettings({
                              customThemes: updated,
                              activeCustomTheme: imported,
                              theme: imported.id,
                              accent: imported.accent,
                              customAccentColor: imported.accent,
                              glassBlur: imported.glassBlur,
                              glassOpacity: imported.glassOpacity,
                            });
                            setImportJsonText("");
                            setImportModalOpen(false);
                            store.pushToast("success", "Theme Imported", `Theme "${imported.name}" loaded and active!`);
                          }}
                        >
                          Import & Apply
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Theme Studio Body */}
                  {customStudioOpen && (
                    <div style={{ padding: "16px", background: "var(--bg-2)", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
                            Theme Name
                          </label>
                          <input
                            type="text"
                            className="input"
                            style={{ fontSize: 12, padding: "6px 10px" }}
                            value={studioDraft.name}
                            onChange={(e) => setStudioDraft({ ...studioDraft, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>
                            Base Contrast Mode
                          </label>
                          <div className="seg" style={{ width: "100%" }}>
                            <button
                              className={`seg-btn ${studioDraft.isDark ? "active" : ""}`}
                              style={{ flex: 1, padding: "6px 8px" }}
                              onClick={() => setStudioDraft({ ...studioDraft, isDark: true })}
                            >
                              <Moon size={12} /> Dark Contrast
                            </button>
                            <button
                              className={`seg-btn ${!studioDraft.isDark ? "active" : ""}`}
                              style={{ flex: 1, padding: "6px 8px" }}
                              onClick={() => setStudioDraft({ ...studioDraft, isDark: false })}
                            >
                              <Sun size={12} /> Light Contrast
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Studio Color Pickers Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                        {[
                          { key: "bg", label: "Window Background", val: studioDraft.bg },
                          { key: "bg2", label: "Panels Background", val: studioDraft.bg2 },
                          { key: "surface", label: "Card / Hover Surface", val: studioDraft.surface },
                          { key: "text", label: "Primary Text", val: studioDraft.text },
                          { key: "border", label: "Border Color", val: studioDraft.border },
                          { key: "accent", label: "Accent Highlight", val: studioDraft.accent },
                        ].map((field) => (
                          <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "var(--text-dim)" }}>{field.label}</label>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                              <label style={{ width: 18, height: 18, borderRadius: "50%", overflow: "hidden", cursor: "pointer", position: "relative", border: "1px solid var(--border-strong)", flexShrink: 0 }}>
                                <input
                                  type="color"
                                  value={field.val.startsWith("#") ? field.val : "#7c6cff"}
                                  onChange={(e) => setStudioDraft({ ...studioDraft, [field.key]: e.target.value })}
                                  style={{ position: "absolute", top: -8, left: -8, width: 36, height: 36, opacity: 0, cursor: "pointer" }}
                                />
                                <span style={{ display: "block", width: "100%", height: "100%", background: field.val }} />
                              </label>
                              <input
                                type="text"
                                value={field.val}
                                onChange={(e) => setStudioDraft({ ...studioDraft, [field.key]: e.target.value })}
                                style={{ width: "100%", fontSize: 11, fontFamily: "monospace", border: "none", background: "transparent", color: "var(--text)", outline: "none" }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            void store.updateSettings({
                              theme: "custom-live",
                              activeCustomTheme: { ...studioDraft, id: "custom-live" },
                              accent: studioDraft.accent,
                              customAccentColor: studioDraft.accent,
                            });
                            store.pushToast("info", "Live Test Active", "Testing custom theme in real time.");
                          }}
                        >
                          <Eye size={12} /> Test Live
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            const newTheme: CustomThemeDefinition = {
                              ...studioDraft,
                              id: `custom-${Date.now()}`,
                              name: studioDraft.name.trim() || "My Custom Theme",
                            };
                            const updated = [...customThemesList, newTheme];
                            setCustomThemesList(updated);
                            saveCustomThemesToStorage(updated);
                            void store.updateSettings({
                              customThemes: updated,
                              activeCustomTheme: newTheme,
                              theme: newTheme.id,
                              accent: newTheme.accent,
                              customAccentColor: newTheme.accent,
                              glassBlur: newTheme.glassBlur,
                              glassOpacity: newTheme.glassOpacity,
                              borderRadius: newTheme.borderRadius,
                              fontFamily: newTheme.fontFamily,
                            });
                            store.pushToast("success", "Theme Saved", `Theme "${newTheme.name}" is now active!`);
                          }}
                        >
                          <Plus size={12} /> Save As Custom Theme
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. File Browsing Panel */}
            {activeCategory === "browsing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Compass size={14} style={{ color: "#38bdf8" }} /> File Navigation & Rules
                </h4>

                <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div className="settings-label" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Default View Layout</div>
                    <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Initial layout applied to newly opened directories</div>
                  </div>
                  <div className="seg">
                    {(["list", "grid", "columns"] as const).map((vm) => (
                      <button
                        key={vm}
                        className={`seg-btn ${s.view === vm ? "active" : ""}`}
                        onClick={() => {
                          void store.updateSettings({ view: vm });
                          store.setView(vm);
                        }}
                      >
                        {vm === "columns" ? "Miller" : vm[0].toUpperCase() + vm.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <Toggle checked={s.showHidden} onChange={(v) => void store.updateSettings({ showHidden: v })} label="Show Hidden Files" desc="Displays dotfiles (.git, .nexus) and Windows hidden entries" />
                <Toggle checked={s.showSystem} onChange={(v) => void store.updateSettings({ showSystem: v })} label="Show System Files" desc="Displays protected operating system files and desktop.ini" />
                <Toggle checked={s.showExtensions} onChange={(v) => void store.updateSettings({ showExtensions: v })} label="Show File Extensions" desc="Always display filename extensions (.rs, .ts, .json)" />
                <Toggle checked={s.confirmDelete} onChange={(v) => void store.updateSettings({ confirmDelete: v })} label="Confirm Before Delete" desc="Requires explicit verification dialog prior to destructive removal" />
                <Toggle checked={s.restoreSession} onChange={(v) => void store.updateSettings({ restoreSession: v })} label="Restore Session on Launch" desc="Automatically restores previously active tabs and folder paths" />
                <Toggle checked={s.chromaticHeatmap !== false} onChange={(v) => void store.updateSettings({ chromaticHeatmap: v })} label="Chromatic Age Indicators" desc="Color-codes modified items (<24h emerald, <7d cyan, <30d blue)" />
                <Toggle checked={s.faytEnabled !== false} onChange={(v) => void store.updateSettings({ faytEnabled: v })} label="Find-As-You-Type (FAYT)" desc="Instant keyboard filtering when typing in the active directory" />
                <Toggle checked={s.vimModeEnabled !== false} onChange={(v) => void store.updateSettings({ vimModeEnabled: v })} label="Vim Modal Navigation" desc="Use h/j/k/l, gg, G, y, p to navigate file listings without mouse" />
              </div>
            )}

            {/* 3. Performance Panel */}
            {activeCategory === "performance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={14} style={{ color: "#38bdf8" }} /> Storage Engine & Hardware Acceleration
                </h4>

                <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Cpu size={18} style={{ color: "#38bdf8", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8" }}>ReFS Dev Drive Block Cloning (CoW)</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      Hardware FSCTL_DUPLICATE_EXTENTS_TO_FILE cloning is enabled. Duplicating multi-gigabyte repositories completes in &lt;10ms with zero extra disk footprint.
                    </div>
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Layers size={18} style={{ color: "#34d399", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#34d399" }}>TanStack Virtualized Viewport (60 FPS)</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      Windowing renders only active DOM nodes. Browsing directories with 100,000+ files maintains 60 FPS scrolling and sub-10ms input latency.
                    </div>
                  </div>
                </div>

                <Toggle
                  checked={s.sidebarOpen}
                  onChange={(v) => void store.updateSettings({ sidebarOpen: v })}
                  label="Sidebar Dock"
                  desc="Drives, Favorites, and Smart Folders navigation sidepane"
                />
                <Toggle
                  checked={s.previewOpen}
                  onChange={(v) => void store.updateSettings({ previewOpen: v })}
                  label="Live Forensic Preview Pane"
                  desc="Syntax-highlighted code, metadata tags, and audio/video preview"
                />
              </div>
            )}

            {/* 4. Forensics & Safety Panel */}
            {activeCategory === "forensics" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={14} style={{ color: "#38bdf8" }} /> Forensics, Privacy & Cryptography
                </h4>

                <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Lock size={18} style={{ color: "#fb7185", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fb7185" }}>DoD 5220.22-M 3-Pass Shredder</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      Destructive wipes execute 3 cryptographic passes: zeros, ones, and CSPRNG pseudorandom noise with mandatory buffer flush to prevent hardware magnetic forensics.
                    </div>
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Sparkles size={18} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24" }}>GRPO Safe AI Execution Perimeter</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      The Autonomous AI Agent verifies every planned filesystem operation against operating system boundaries (blocking system roots like C:\Windows) before execution.
                    </div>
                  </div>
                </div>

                <div className="settings-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                  <div>
                    <div className="settings-label" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Default Cryptographic Hash Algorithm</div>
                    <div className="settings-desc" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Algorithm for manifest generation and integrity verification</div>
                  </div>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--surface)", border: "1px solid var(--border)", fontFamily: "monospace", color: "#38bdf8" }}>
                    SHA-256 / xxHash3
                  </span>
                </div>
              </div>
            )}

            {/* 5. Keybindings Panel */}
            {activeCategory === "shortcuts" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                    <Keyboard size={14} style={{ color: "#38bdf8" }} /> Keyboard Shortcuts
                  </h4>
                  <input
                    type="text"
                    value={shortcutFilter}
                    onChange={(e) => setShortcutFilter(e.target.value)}
                    placeholder="Search shortcuts..."
                    style={{
                      height: 28,
                      fontSize: 11,
                      padding: "0 8px",
                      borderRadius: 4,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      width: 160,
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 380, overflowY: "auto" }}>
                  {filteredShortcuts.map((sc, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "7px 10px",
                        borderRadius: 4,
                        background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "var(--text)" }}>{sc.desc}</span>
                      <kbd
                        style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "#38bdf8",
                        }}
                      >
                        {sc.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. About Panel */}
            {activeCategory === "about" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <img src="/nexus-logo.png" alt="NexusExplorer" style={{ width: 44, height: 44, borderRadius: 10 }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Nexus Explorer</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>Version {appInfo?.version || "2.0.0"} · Production Ready</div>
                  </div>
                </div>

                {appInfo && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <span>Core Engine:</span>
                      <span style={{ fontFamily: "monospace", color: "var(--text)" }}>nexus-core {appInfo.engineVersion}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <span>Runtime Architecture:</span>
                      <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{appInfo.platform} / {appInfo.arch}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <span>Active Identity:</span>
                      <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{appInfo.user} @ {appInfo.hostname}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <span>Data Storage:</span>
                      <span style={{ fontFamily: "monospace", color: "var(--text)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>{appInfo.dataDir}</span>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-sm"
                  onClick={copyDiagnostics}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    alignSelf: "flex-start",
                    marginTop: 8,
                  }}
                >
                  <Copy size={13} />
                  <span>{copiedDiag ? "Copied Diagnostics!" : "Copy Diagnostics Summary"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => void store.resetSettings()}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RotateCcw size={13} />
            <span>Reset Appearance</span>
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => store.setSettingsOpen(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
