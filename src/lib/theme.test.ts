import { describe, it, expect, beforeEach } from "vitest";
import {
  THEME_PRESETS,
  resolveAccent,
  accentById,
  themeById,
  resolvedTheme,
  exportThemeJson,
  importThemeJson,
  applyTheme,
  loadSavedCustomThemes,
  saveCustomThemesToStorage,
} from "./theme";
import type { CustomThemeDefinition } from "@/types";

describe("Theme Engine", () => {
  beforeEach(() => {
    document.documentElement.style.cssText = "";
    document.documentElement.dataset.theme = "";
  });

  describe("Accent Resolution", () => {
    it("resolves built-in preset accents by ID", () => {
      const aurora = resolveAccent("aurora");
      expect(aurora.id).toBe("aurora");
      expect(aurora.hue).toBe("#7c6cff");

      const emerald = accentById("emerald");
      expect(emerald.id).toBe("emerald");
      expect(emerald.hue).toBe("#10b981");
    });

    it("dynamically resolves arbitrary custom hex accents and computes soft/glow/selection", () => {
      const custom = resolveAccent("#ff007f");
      expect(custom.isCustom).toBe(true);
      expect(custom.hue).toBe("#ff007f");
      expect(custom.glow).toContain("rgba(255, 0, 127");
      expect(custom.selection).toContain("rgba(255, 0, 127");
      expect(custom.selectionBorder).toContain("rgba(255, 0, 127");
      expect(custom.soft).toBeDefined();
    });

    it("falls back gracefully for unknown or empty accents", () => {
      const fallback = resolveAccent("non-existent-accent");
      expect(fallback.id).toBe("aurora");
    });
  });

  describe("Theme Presets", () => {
    it("provides all curated presets including Mica, Acrylic, OLED, Catppuccin, Nord, Cyberpunk", () => {
      const ids = THEME_PRESETS.map((t) => t.id);
      expect(ids).toContain("dark");
      expect(ids).toContain("light");
      expect(ids).toContain("mica");
      expect(ids).toContain("acrylic");
      expect(ids).toContain("oled");
      expect(ids).toContain("catppuccin");
      expect(ids).toContain("dracula");
      expect(ids).toContain("nord");
      expect(ids).toContain("tokyo-night");
      expect(ids).toContain("cyberpunk");
      expect(ids).toContain("rose-pine");
      expect(ids).toContain("forest");
    });

    it("looks up theme presets by id", () => {
      const oled = themeById("oled");
      expect(oled).toBeDefined();
      expect(oled?.colors.bg).toBe("#000000");
      expect(oled?.glassBlur).toBe(0);

      const mica = themeById("mica");
      expect(mica).toBeDefined();
      expect(mica?.glassBlur).toBe(40);
    });

    it("resolves system theme based on media query", () => {
      const resolved = resolvedTheme("mica");
      expect(resolved).toBe("mica");

      const sys = resolvedTheme("system");
      expect(["dark", "light"]).toContain(sys);
    });
  });

  describe("applyTheme", () => {
    it("injects CSS variables onto document.documentElement", () => {
      applyTheme({
        theme: "nord",
        accent: "emerald",
        density: "comfortable",
        animations: true,
        glassBlur: 36,
        glassOpacity: 80,
        borderRadius: 14,
        fontFamily: "inter",
      });

      const root = document.documentElement;
      expect(root.dataset.theme).toBe("nord");
      expect(root.dataset.density).toBe("comfortable");
      expect(root.dataset.motion).toBe("on");

      expect(root.style.getPropertyValue("--accent")).toBe("#10b981");
      expect(root.style.getPropertyValue("--glass-blur")).toBe("36px");
      expect(root.style.getPropertyValue("--glass-opacity")).toBe("0.8");
      expect(root.style.getPropertyValue("--radius-md")).toBe("14px");
      expect(root.style.getPropertyValue("--font-ui")).toContain("Inter");
      expect(root.style.getPropertyValue("--selection")).toContain("rgba");
    });

    it("supports custom theme definitions with arbitrary colors", () => {
      const custom: CustomThemeDefinition = {
        id: "my-synthwave",
        name: "Synthwave Custom",
        isDark: true,
        bg: "#050014",
        bg2: "#0d0226",
        surface: "rgba(255,0,128,0.1)",
        border: "#ff007f",
        text: "#ffffff",
        textDim: "#ff77aa",
        accent: "#00f0ff",
        glassBlur: 42,
        glassOpacity: 75,
        borderRadius: 18,
      };

      applyTheme({
        theme: custom.id,
        accent: custom.accent,
        density: "compact",
        animations: false,
        activeCustomTheme: custom,
      });

      const root = document.documentElement;
      expect(root.dataset.density).toBe("compact");
      expect(root.dataset.motion).toBe("off");
      expect(root.style.getPropertyValue("--bg")).toBe("#050014");
      expect(root.style.getPropertyValue("--bg-2")).toBe("#0d0226");
      expect(root.style.getPropertyValue("--accent")).toBe("#00f0ff");
      expect(root.style.getPropertyValue("--border")).toBe("#ff007f");
    });
  });

  describe("Theme Export & Import", () => {
    it("exports theme as JSON schema", () => {
      const nord = themeById("nord")!;
      const json = exportThemeJson(nord);
      expect(json).toContain("nord");
      expect(json).toContain("https://nexus-explorer.org/schemas/theme-v1.json");

      const parsed = JSON.parse(json);
      expect(parsed.name).toBe("Nord Frost");
      expect(parsed.theme.bg).toBe("#2e3440");
    });

    it("imports theme from JSON correctly", () => {
      const sample = JSON.stringify({
        name: "Hacker Matrix",
        isDark: true,
        theme: {
          bg: "#001100",
          bg2: "#002200",
          surface: "rgba(0,255,0,0.1)",
          border: "#00ff00",
          text: "#00ff66",
          accent: "#00ff33",
          glassBlur: 16,
          glassOpacity: 90,
          borderRadius: 4,
        },
      });

      const imported = importThemeJson(sample);
      expect(imported).not.toBeNull();
      expect(imported?.name).toBe("Hacker Matrix");
      expect(imported?.bg).toBe("#001100");
      expect(imported?.accent).toBe("#00ff33");
      expect(imported?.glassBlur).toBe(16);
    });

    it("rejects invalid JSON safely", () => {
      expect(importThemeJson("not a json")).toBeNull();
      expect(importThemeJson(JSON.stringify({ incomplete: true }))).toBeNull();
    });
  });

  describe("Custom Themes LocalStorage", () => {
    it("handles saving and loading from storage", () => {
      const themes: CustomThemeDefinition[] = [
        {
          id: "custom-1",
          name: "Test Custom",
          isDark: true,
          bg: "#101010",
          bg2: "#181818",
          surface: "#222222",
          border: "#333333",
          text: "#f0f0f0",
          accent: "#ff5500",
        },
      ];

      saveCustomThemesToStorage(themes);
      const loaded = loadSavedCustomThemes();
      expect(loaded.length).toBe(1);
      expect(loaded[0].name).toBe("Test Custom");
    });
  });
});
