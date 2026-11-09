/**
 * Theme & Visual Polish Engine for Nexus Explorer.
 *
 * Provides:
 * 1. Curated Pro Presets: Nexus Dark/Light, Windows 11 Mica, Acrylic, OLED Black,
 *    Catppuccin Mocha, Dracula, Nord, Tokyo Night, Cyberpunk, Rose Pine, Forest Emerald.
 * 2. Accent Palette & Arbitrary Custom Hex Pickers with automated soft/glow derivation.
 * 3. Custom Theme Studio: background, surface, text, border, glass blur/opacity, corner radius, fonts.
 * 4. Theme Import / Export (JSON format) and persistence.
 * 5. Instant live CSS custom property injection.
 */

import type { CustomThemeDefinition, Settings } from "@/types";

export interface AccentPreset {
  id: string;
  name: string;
  hue: string;
  soft: string;
  glow: string;
  subtle: string;
  selection: string;
  selectionBorder: string;
  isCustom?: boolean;
}

export const ACCENTS: AccentPreset[] = [
  {
    id: "aurora",
    name: "Aurora Violet",
    hue: "#7c6cff",
    soft: "#a594ff",
    glow: "rgba(124, 108, 255, 0.40)",
    subtle: "rgba(124, 108, 255, 0.14)",
    selection: "rgba(124, 108, 255, 0.22)",
    selectionBorder: "rgba(124, 108, 255, 0.55)",
  },
  {
    id: "cyan",
    name: "Electric Cyan",
    hue: "#06b6d4",
    soft: "#38bdf8",
    glow: "rgba(6, 182, 212, 0.40)",
    subtle: "rgba(6, 182, 212, 0.14)",
    selection: "rgba(6, 182, 212, 0.22)",
    selectionBorder: "rgba(56, 189, 248, 0.55)",
  },
  {
    id: "cobalt",
    name: "Cobalt Blue",
    hue: "#3b82f6",
    soft: "#60a5fa",
    glow: "rgba(59, 130, 246, 0.40)",
    subtle: "rgba(59, 130, 246, 0.14)",
    selection: "rgba(59, 130, 246, 0.22)",
    selectionBorder: "rgba(96, 165, 250, 0.55)",
  },
  {
    id: "emerald",
    name: "Emerald Green",
    hue: "#10b981",
    soft: "#34d399",
    glow: "rgba(16, 185, 129, 0.40)",
    subtle: "rgba(16, 185, 129, 0.14)",
    selection: "rgba(16, 185, 129, 0.22)",
    selectionBorder: "rgba(52, 211, 153, 0.55)",
  },
  {
    id: "amber",
    name: "Amber Gold",
    hue: "#f59e0b",
    soft: "#fbbf24",
    glow: "rgba(245, 158, 11, 0.40)",
    subtle: "rgba(245, 158, 11, 0.14)",
    selection: "rgba(245, 158, 11, 0.22)",
    selectionBorder: "rgba(251, 191, 36, 0.55)",
  },
  {
    id: "neon",
    name: "Cyber Neon",
    hue: "#ec4899",
    soft: "#f472b6",
    glow: "rgba(236, 72, 153, 0.40)",
    subtle: "rgba(236, 72, 153, 0.14)",
    selection: "rgba(236, 72, 153, 0.22)",
    selectionBorder: "rgba(244, 114, 182, 0.55)",
  },
  {
    id: "rose",
    name: "Crimson Rose",
    hue: "#f43f5e",
    soft: "#fb7185",
    glow: "rgba(244, 63, 94, 0.40)",
    subtle: "rgba(244, 63, 94, 0.14)",
    selection: "rgba(244, 63, 94, 0.22)",
    selectionBorder: "rgba(251, 113, 133, 0.55)",
  },
  {
    id: "violet",
    name: "Deep Violet",
    hue: "#8b5cf6",
    soft: "#c4b5fd",
    glow: "rgba(139, 92, 246, 0.40)",
    subtle: "rgba(139, 92, 246, 0.14)",
    selection: "rgba(139, 92, 246, 0.22)",
    selectionBorder: "rgba(196, 181, 253, 0.55)",
  },
  {
    id: "lime",
    name: "Vibrant Lime",
    hue: "#84cc16",
    soft: "#a3e635",
    glow: "rgba(132, 204, 22, 0.40)",
    subtle: "rgba(132, 204, 22, 0.14)",
    selection: "rgba(132, 204, 22, 0.22)",
    selectionBorder: "rgba(163, 230, 53, 0.55)",
  },
  {
    id: "orange",
    name: "Sunset Orange",
    hue: "#f97316",
    soft: "#fb923c",
    glow: "rgba(249, 115, 22, 0.40)",
    subtle: "rgba(249, 115, 22, 0.14)",
    selection: "rgba(249, 115, 22, 0.22)",
    selectionBorder: "rgba(251, 146, 60, 0.55)",
  },
  {
    id: "coral",
    name: "Living Coral",
    hue: "#ff6b6b",
    soft: "#ffa8a8",
    glow: "rgba(255, 107, 107, 0.40)",
    subtle: "rgba(255, 107, 107, 0.14)",
    selection: "rgba(255, 107, 107, 0.22)",
    selectionBorder: "rgba(255, 168, 168, 0.55)",
  },
  {
    id: "graphite",
    name: "Graphite Silver",
    hue: "#94a3b8",
    soft: "#cbd5e1",
    glow: "rgba(148, 163, 184, 0.35)",
    subtle: "rgba(148, 163, 184, 0.14)",
    selection: "rgba(148, 163, 184, 0.20)",
    selectionBorder: "rgba(203, 213, 225, 0.50)",
  },
];

export interface ThemeColors {
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  glassSide: string;
  glassMain: string;
  glassTop: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  category: "core" | "developer" | "vibrant";
  isDark: boolean;
  colors: ThemeColors;
  glassBlur: number;
  glassOpacity: number;
  defaultAccent: string;
  borderRadius?: number;
  fontFamily?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "dark",
    name: "Nexus Dark",
    description: "Sleek charcoal slate with high-performance glass chrome",
    category: "core",
    isDark: true,
    glassBlur: 32,
    glassOpacity: 85,
    defaultAccent: "aurora",
    colors: {
      bg: "rgba(18, 21, 27, 0.88)",
      bg2: "rgba(24, 28, 36, 0.94)",
      surface: "rgba(255, 255, 255, 0.045)",
      surface2: "rgba(255, 255, 255, 0.08)",
      surface3: "rgba(255, 255, 255, 0.12)",
      border: "rgba(255, 255, 255, 0.09)",
      borderStrong: "rgba(255, 255, 255, 0.20)",
      text: "#f1f5f9",
      textDim: "#94a3b8",
      textFaint: "#64748b",
      glassSide: "rgba(14, 17, 22, 0.52)",
      glassMain: "rgba(24, 28, 36, 0.32)",
      glassTop: "rgba(255, 255, 255, 0.06)",
    },
  },
  {
    id: "light",
    name: "Nexus Daylight",
    description: "Clean, glare-free, high-contrast studio daylight",
    category: "core",
    isDark: false,
    glassBlur: 24,
    glassOpacity: 95,
    defaultAccent: "cobalt",
    colors: {
      bg: "#f8fafc",
      bg2: "#eef2f7",
      surface: "rgba(255, 255, 255, 0.85)",
      surface2: "rgba(255, 255, 255, 0.96)",
      surface3: "rgba(15, 23, 42, 0.05)",
      border: "rgba(15, 23, 42, 0.11)",
      borderStrong: "rgba(15, 23, 42, 0.22)",
      text: "#0f172a",
      textDim: "#475569",
      textFaint: "#94a3b8",
      glassSide: "rgba(241, 245, 249, 0.82)",
      glassMain: "rgba(255, 255, 255, 0.65)",
      glassTop: "rgba(255, 255, 255, 0.85)",
    },
  },
  {
    id: "mica",
    name: "Windows 11 Mica",
    description: "Fluent material with subtle desktop wallpaper tinting and glass depth",
    category: "core",
    isDark: true,
    glassBlur: 40,
    glassOpacity: 72,
    defaultAccent: "cyan",
    colors: {
      bg: "rgba(16, 20, 28, 0.72)",
      bg2: "rgba(22, 28, 38, 0.82)",
      surface: "rgba(255, 255, 255, 0.05)",
      surface2: "rgba(255, 255, 255, 0.085)",
      surface3: "rgba(255, 255, 255, 0.12)",
      border: "rgba(255, 255, 255, 0.11)",
      borderStrong: "rgba(255, 255, 255, 0.22)",
      text: "#eef2f6",
      textDim: "#9aa5b8",
      textFaint: "#626e82",
      glassSide: "rgba(12, 16, 24, 0.42)",
      glassMain: "rgba(24, 30, 42, 0.26)",
      glassTop: "rgba(255, 255, 255, 0.08)",
    },
  },
  {
    id: "acrylic",
    name: "Windows 11 Acrylic",
    description: "Rich frosted glass blur with high saturation and depth",
    category: "core",
    isDark: true,
    glassBlur: 28,
    glassOpacity: 58,
    defaultAccent: "neon",
    colors: {
      bg: "rgba(14, 18, 28, 0.58)",
      bg2: "rgba(20, 26, 40, 0.70)",
      surface: "rgba(255, 255, 255, 0.065)",
      surface2: "rgba(255, 255, 255, 0.105)",
      surface3: "rgba(255, 255, 255, 0.15)",
      border: "rgba(255, 255, 255, 0.14)",
      borderStrong: "rgba(255, 255, 255, 0.26)",
      text: "#f3f4f6",
      textDim: "#9ca3af",
      textFaint: "#6b7280",
      glassSide: "rgba(10, 14, 22, 0.36)",
      glassMain: "rgba(22, 28, 42, 0.22)",
      glassTop: "rgba(255, 255, 255, 0.11)",
    },
  },
  {
    id: "oled",
    name: "OLED Deep Black",
    description: "Absolute pitch-black 0-bloom contrast for OLED & HDR screens",
    category: "developer",
    isDark: true,
    glassBlur: 0,
    glassOpacity: 100,
    defaultAccent: "emerald",
    colors: {
      bg: "#000000",
      bg2: "#0a0a0c",
      surface: "#121216",
      surface2: "#1a1a20",
      surface3: "#26262e",
      border: "#232328",
      borderStrong: "#3b3b44",
      text: "#fafafa",
      textDim: "#a1a1aa",
      textFaint: "#71717a",
      glassSide: "#000000",
      glassMain: "#050507",
      glassTop: "#0d0d10",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    description: "Developer-favorite soothing pastel palette with rich depth",
    category: "developer",
    isDark: true,
    glassBlur: 28,
    glassOpacity: 88,
    defaultAccent: "aurora",
    colors: {
      bg: "#1e1e2e",
      bg2: "#181825",
      surface: "#313244",
      surface2: "#45475a",
      surface3: "#585b70",
      border: "#313244",
      borderStrong: "#585b70",
      text: "#cdd6f4",
      textDim: "#a6adc8",
      textFaint: "#6c7086",
      glassSide: "rgba(24, 24, 37, 0.85)",
      glassMain: "rgba(30, 30, 46, 0.65)",
      glassTop: "rgba(49, 50, 68, 0.45)",
    },
  },
  {
    id: "dracula",
    name: "Dracula Pro",
    description: "Iconic vampire dark purple palette with high-contrast vibrancy",
    category: "developer",
    isDark: true,
    glassBlur: 24,
    glassOpacity: 90,
    defaultAccent: "violet",
    colors: {
      bg: "#282a36",
      bg2: "#21222c",
      surface: "#44475a",
      surface2: "#6272a4",
      surface3: "#7284b8",
      border: "#44475a",
      borderStrong: "#6272a4",
      text: "#f8f8f2",
      textDim: "#bd93f9",
      textFaint: "#6272a4",
      glassSide: "rgba(33, 34, 44, 0.85)",
      glassMain: "rgba(40, 42, 54, 0.65)",
      glassTop: "rgba(68, 71, 90, 0.45)",
    },
  },
  {
    id: "nord",
    name: "Nord Frost",
    description: "Arctic polar night and cool blue-gray minimalist aesthetic",
    category: "developer",
    isDark: true,
    glassBlur: 28,
    glassOpacity: 86,
    defaultAccent: "cyan",
    colors: {
      bg: "#2e3440",
      bg2: "#242933",
      surface: "#3b4252",
      surface2: "#434c5e",
      surface3: "#4c566a",
      border: "#434c5e",
      borderStrong: "#4c566a",
      text: "#eceff4",
      textDim: "#d8dee9",
      textFaint: "#9aa3b2",
      glassSide: "rgba(36, 41, 51, 0.85)",
      glassMain: "rgba(46, 52, 64, 0.65)",
      glassTop: "rgba(59, 66, 82, 0.45)",
    },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Cyberpunk Japanese midnight blue with luminous neon cues",
    category: "developer",
    isDark: true,
    glassBlur: 32,
    glassOpacity: 85,
    defaultAccent: "cobalt",
    colors: {
      bg: "#1a1b26",
      bg2: "#16161e",
      surface: "#24283b",
      surface2: "#2f354f",
      surface3: "#414868",
      border: "#2f354f",
      borderStrong: "#414868",
      text: "#c0caf5",
      textDim: "#9aa5ce",
      textFaint: "#565f89",
      glassSide: "rgba(22, 22, 30, 0.85)",
      glassMain: "rgba(26, 27, 38, 0.65)",
      glassTop: "rgba(36, 40, 59, 0.45)",
    },
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk 2077",
    description: "High-voltage synthwave magenta, deep violet, and electric cyan",
    category: "vibrant",
    isDark: true,
    glassBlur: 32,
    glassOpacity: 82,
    defaultAccent: "neon",
    colors: {
      bg: "#0d091a",
      bg2: "#150f28",
      surface: "#22173d",
      surface2: "#32225a",
      surface3: "#452f7a",
      border: "#3e286e",
      borderStrong: "#ff007f",
      text: "#fce7f3",
      textDim: "#f472b6",
      textFaint: "#9d174d",
      glassSide: "rgba(13, 9, 26, 0.88)",
      glassMain: "rgba(21, 15, 40, 0.70)",
      glassTop: "rgba(50, 34, 90, 0.45)",
    },
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    description: "Warm muted aesthetic serenity with rose, gold, and pine tones",
    category: "vibrant",
    isDark: true,
    glassBlur: 26,
    glassOpacity: 88,
    defaultAccent: "rose",
    colors: {
      bg: "#191724",
      bg2: "#1f1d2e",
      surface: "#26233a",
      surface2: "#312e4b",
      surface3: "#3e3b5e",
      border: "#312e4b",
      borderStrong: "#524f67",
      text: "#e0def4",
      textDim: "#908caa",
      textFaint: "#6e6a86",
      glassSide: "rgba(25, 23, 36, 0.85)",
      glassMain: "rgba(31, 29, 46, 0.65)",
      glassTop: "rgba(38, 35, 58, 0.45)",
    },
  },
  {
    id: "forest",
    name: "Emerald Forest",
    description: "Deep botanical dark green with fresh mint and gold luminescence",
    category: "vibrant",
    isDark: true,
    glassBlur: 28,
    glassOpacity: 86,
    defaultAccent: "emerald",
    colors: {
      bg: "#0c1915",
      bg2: "#12241f",
      surface: "#1a352d",
      surface2: "#24473d",
      surface3: "#305e51",
      border: "#24473d",
      borderStrong: "#305e51",
      text: "#ecfdf5",
      textDim: "#a7f3d0",
      textFaint: "#6ee7b7",
      glassSide: "rgba(12, 25, 21, 0.85)",
      glassMain: "rgba(18, 36, 31, 0.65)",
      glassTop: "rgba(26, 53, 45, 0.45)",
    },
  },
];

// Color utility helpers
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return null;
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function lighten(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * (percent / 100)));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * (percent / 100)));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * (percent / 100)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function resolveAccent(accentIdOrHex: string): AccentPreset {
  if (!accentIdOrHex) return ACCENTS[0];
  const found = ACCENTS.find((a) => a.id.toLowerCase() === accentIdOrHex.toLowerCase());
  if (found) return found;

  if (accentIdOrHex.startsWith("#") || /^[0-9a-fA-F]{6}$/.test(accentIdOrHex)) {
    const hex = accentIdOrHex.startsWith("#") ? accentIdOrHex : `#${accentIdOrHex}`;
    const soft = lighten(hex, 35);
    return {
      id: hex.toLowerCase(),
      name: `Custom (${hex.toUpperCase()})`,
      hue: hex,
      soft,
      glow: hexToRgba(hex, 0.40),
      subtle: hexToRgba(hex, 0.14),
      selection: hexToRgba(hex, 0.22),
      selectionBorder: hexToRgba(hex, 0.55),
      isCustom: true,
    };
  }

  return ACCENTS[0];
}

/** Backward-compatible alias for accent lookups */
export function accentById(id: string): AccentPreset {
  return resolveAccent(id);
}

export function themeById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((t) => t.id === id);
}

export function resolvedTheme(theme: string): string {
  if (theme === "system") {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }
  return theme || "dark";
}

// Local storage storage keys with in-memory fallback
export const CUSTOM_THEMES_STORAGE_KEY = "nexus:custom_themes";
let memoryCustomThemes: CustomThemeDefinition[] = [];

export function loadSavedCustomThemes(): CustomThemeDefinition[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // Fallback to in-memory store
  }
  return memoryCustomThemes;
}

export function saveCustomThemesToStorage(themes: CustomThemeDefinition[]): void {
  memoryCustomThemes = [...themes];
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(themes));
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

export function exportThemeJson(theme: CustomThemeDefinition | ThemePreset): string {
  const payload = {
    $schema: "https://nexus-explorer.org/schemas/theme-v1.json",
    version: 1,
    id: theme.id,
    name: theme.name,
    isDark: theme.isDark,
    exportedAt: new Date().toISOString(),
    theme: {
      ...("colors" in theme ? theme.colors : {
        bg: theme.bg,
        bg2: theme.bg2,
        surface: theme.surface,
        border: theme.border,
        text: theme.text,
        textDim: theme.textDim,
      }),
      accent: "defaultAccent" in theme ? theme.defaultAccent : theme.accent,
      glassBlur: theme.glassBlur ?? 32,
      glassOpacity: theme.glassOpacity ?? 85,
      borderRadius: theme.borderRadius ?? 10,
      fontFamily: theme.fontFamily ?? "default",
    },
  };
  return JSON.stringify(payload, null, 2);
}

export function importThemeJson(jsonString: string): CustomThemeDefinition | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") return null;
    const t = parsed.theme || parsed;
    if (!t.bg || !t.text) return null;

    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    return {
      id,
      name: parsed.name || "Imported Custom Theme",
      isDark: Boolean(parsed.isDark ?? true),
      bg: t.bg,
      bg2: t.bg2 || t.bg,
      surface: t.surface || "rgba(255,255,255,0.06)",
      border: t.border || "rgba(255,255,255,0.12)",
      text: t.text,
      textDim: t.textDim || "#94a3b8",
      accent: t.accent || "#06b6d4",
      glassBlur: Number(t.glassBlur) || 32,
      glassOpacity: Number(t.glassOpacity) || 85,
      borderRadius: Number(t.borderRadius) || 10,
      fontFamily: t.fontFamily || "default",
    };
  } catch {
    return null;
  }
}

/**
 * Applies the selected theme, accent, density, and visual polish to the DOM.
 * Injects CSS custom properties in real-time onto `document.documentElement`.
 */
export function applyTheme(
  settings: Pick<Settings, "theme" | "accent" | "density" | "animations"> &
    Partial<Pick<Settings, "customAccentColor" | "glassBlur" | "glassOpacity" | "borderRadius" | "fontFamily" | "activeCustomTheme">>
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const themeId = resolvedTheme(settings.theme);

  // 1. Accent Resolution
  const activeAccentInput = settings.customAccentColor || settings.accent || "aurora";
  const accent = resolveAccent(activeAccentInput);

  // 2. Theme Preset / Custom Theme Lookup
  const preset = themeById(themeId);
  const custom = settings.activeCustomTheme;

  // Determine dark or light mode for base contrast rules
  let isDark = true;
  if (custom) {
    isDark = custom.isDark;
  } else if (preset) {
    isDark = preset.isDark;
  } else if (themeId === "light") {
    isDark = false;
  }

  // Set DOM data attributes
  root.dataset.theme = isDark ? (preset ? preset.id : "dark") : "light";
  root.dataset.density = settings.density === "compact" ? "compact" : "comfortable";
  root.dataset.motion = settings.animations ? "on" : "off";

  // 3. Inject Accent CSS Variables
  root.style.setProperty("--accent", accent.hue);
  root.style.setProperty("--accent-soft", accent.soft);
  root.style.setProperty("--accent-glow", accent.glow);
  root.style.setProperty("--accent-subtle", accent.subtle);
  root.style.setProperty("--selection", accent.selection);
  root.style.setProperty("--selection-border", accent.selectionBorder);
  root.style.setProperty("--drop", accent.selection);

  // 4. Inject Theme Colors
  if (custom) {
    root.style.setProperty("--bg", custom.bg);
    root.style.setProperty("--bg-2", custom.bg2);
    root.style.setProperty("--surface", custom.surface);
    root.style.setProperty("--surface-2", lighten(custom.bg2, isDark ? 8 : -8));
    root.style.setProperty("--surface-3", lighten(custom.bg2, isDark ? 16 : -16));
    root.style.setProperty("--border", custom.border);
    root.style.setProperty("--border-strong", lighten(custom.border, 20));
    root.style.setProperty("--text", custom.text);
    root.style.setProperty("--text-dim", custom.textDim || (isDark ? "#94a3b8" : "#475569"));
    root.style.setProperty("--text-faint", isDark ? "#64748b" : "#94a3b8");
    root.style.setProperty("--glass-side", hexToRgba(custom.bg2, 0.75));
    root.style.setProperty("--glass-main", hexToRgba(custom.bg, 0.45));
    root.style.setProperty("--glass-top", hexToRgba(custom.bg2, 0.85));
  } else if (preset) {
    root.style.setProperty("--bg", preset.colors.bg);
    root.style.setProperty("--bg-2", preset.colors.bg2);
    root.style.setProperty("--surface", preset.colors.surface);
    root.style.setProperty("--surface-2", preset.colors.surface2);
    root.style.setProperty("--surface-3", preset.colors.surface3);
    root.style.setProperty("--border", preset.colors.border);
    root.style.setProperty("--border-strong", preset.colors.borderStrong);
    root.style.setProperty("--text", preset.colors.text);
    root.style.setProperty("--text-dim", preset.colors.textDim);
    root.style.setProperty("--text-faint", preset.colors.textFaint);
    root.style.setProperty("--glass-side", preset.colors.glassSide);
    root.style.setProperty("--glass-main", preset.colors.glassMain);
    root.style.setProperty("--glass-top", preset.colors.glassTop);
  }

  // 5. Inject Material & Glass Polish Variables
  const blurVal = settings.glassBlur ?? custom?.glassBlur ?? preset?.glassBlur ?? 32;
  const opacityVal = settings.glassOpacity ?? custom?.glassOpacity ?? preset?.glassOpacity ?? 85;
  root.style.setProperty("--glass-blur", `${blurVal}px`);
  root.style.setProperty("--glass-opacity", `${opacityVal / 100}`);

  // 6. Corner Radius Polish
  const radiusVal = settings.borderRadius ?? custom?.borderRadius ?? 10;
  root.style.setProperty("--radius-sm", `${Math.max(2, Math.round(radiusVal * 0.6))}px`);
  root.style.setProperty("--radius-md", `${radiusVal}px`);
  root.style.setProperty("--radius-lg", `${Math.round(radiusVal * 1.4)}px`);
  root.style.setProperty("--radius-xl", `${Math.round(radiusVal * 1.8)}px`);

  // 7. Typography / Font
  const fontFam = settings.fontFamily ?? custom?.fontFamily ?? "default";
  if (fontFam === "segoe") {
    root.style.setProperty("--font-ui", '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif');
  } else if (fontFam === "inter") {
    root.style.setProperty("--font-ui", '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  } else if (fontFam === "mono") {
    root.style.setProperty("--font-ui", '"Cascadia Code", "Consolas", "JetBrains Mono", monospace');
  } else {
    root.style.setProperty("--font-ui", '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif');
  }
}
