/**
 * Pure pattern matching and selection helpers for orthodox file managers.
 * Supports anchored glob wildcards (*, ?), extensions (.ts), regex (re: / /), and substrings.
 */

export interface PatternOptions {
  caseSensitive?: boolean;
  filter?: "all" | "files" | "folders";
  mode?: "replace" | "add" | "remove";
}

export function matchPattern(
  name: string,
  pattern: string,
  isDir: boolean,
  options?: PatternOptions,
): boolean {
  if (options?.filter === "files" && isDir) return false;
  if (options?.filter === "folders" && !isDir) return false;

  const trimmed = pattern.trim();
  if (!trimmed) return false;

  const caseSensitive = options?.caseSensitive ?? false;

  // 1. Regex mode: re:pattern, regex:pattern or /pattern/flags
  if (trimmed.startsWith("re:") || trimmed.startsWith("regex:")) {
    const raw = trimmed.replace(/^re(?:gex)?:/, "");
    try {
      const reg = new RegExp(raw, caseSensitive ? "" : "i");
      return reg.test(name);
    } catch {
      return false;
    }
  }
  if (trimmed.startsWith("/") && trimmed.lastIndexOf("/") > 0) {
    const lastSlash = trimmed.lastIndexOf("/");
    const body = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1) || (caseSensitive ? "" : "i");
    try {
      const reg = new RegExp(body, flags);
      return reg.test(name);
    } catch {
      return false;
    }
  }

  // 2. Glob wildcard mode (* or ?)
  if (trimmed.includes("*") || trimmed.includes("?")) {
    const escaped = trimmed
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const reg = new RegExp(`^${escaped}$`, caseSensitive ? "" : "i");
    return reg.test(name);
  }

  // 3. Simple extension mode: e.g. .ts or .json
  if (trimmed.startsWith(".")) {
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    return caseSensitive ? ext === trimmed : ext.toLowerCase() === trimmed.toLowerCase();
  }

  // 4. Substring fallback
  const target = caseSensitive ? name : name.toLowerCase();
  const pat = caseSensitive ? trimmed : trimmed.toLowerCase();
  return target.includes(pat);
}

export const COMMON_PATTERN_PRESETS: { label: string; pattern: string }[] = [
  { label: "TypeScript / JS (*.ts; *.tsx; *.js)", pattern: "*.ts" },
  { label: "Images (*.png; *.jpg; *.svg)", pattern: "*.png" },
  { label: "Documents (*.pdf; *.docx; *.md)", pattern: "*.pdf" },
  { label: "Archives (*.zip; *.7z; *.tar)", pattern: "*.zip" },
  { label: "Tests (*test* / *spec*)", pattern: "*test*" },
  { label: "Hidden / Dotfiles (.*)", pattern: ".*" },
];

