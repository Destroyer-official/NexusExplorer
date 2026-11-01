/** Theme + accent application. All colour decisions live in CSS variables. */

import type { Settings } from "@/types";

export interface AccentPreset {
  id: string;
  name: string;
  hue: string;
  soft: string;
  glow: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "aurora", name: "Aurora", hue: "#7c6cff", soft: "#22d3ee", glow: "rgba(124, 108, 255, 0.35)" },
  { id: "cobalt", name: "Cobalt", hue: "#3b82f6", soft: "#60a5fa", glow: "rgba(59, 130, 246, 0.35)" },
  { id: "emerald", name: "Emerald", hue: "#10b981", soft: "#34d399", glow: "rgba(16, 185, 129, 0.35)" },
  { id: "amber", name: "Amber", hue: "#f59e0b", soft: "#fbbf24", glow: "rgba(245, 158, 11, 0.35)" },
  { id: "rose", name: "Rose", hue: "#f43f5e", soft: "#fb7185", glow: "rgba(244, 63, 94, 0.35)" },
  { id: "graphite", name: "Graphite", hue: "#94a3b8", soft: "#cbd5e1", glow: "rgba(148, 163, 184, 0.3)" },
];

export function accentById(id: string): AccentPreset {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}

export function resolvedTheme(theme: string): "dark" | "light" | "mica" | "acrylic" {
  if (theme === "system") {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  if (theme === "mica" || theme === "acrylic") return theme;
  return theme === "light" ? "light" : "dark";
}

export function applyTheme(settings: Pick<Settings, "theme" | "accent" | "density" | "animations">): void {
  const root = document.documentElement;
  const accent = accentById(settings.accent);
  root.dataset.theme = resolvedTheme(settings.theme);
  root.dataset.density = settings.density === "compact" ? "compact" : "comfortable";
  root.dataset.motion = settings.animations ? "on" : "off";
  root.style.setProperty("--accent", accent.hue);
  root.style.setProperty("--accent-soft", accent.soft);
  root.style.setProperty("--accent-glow", accent.glow);
}
