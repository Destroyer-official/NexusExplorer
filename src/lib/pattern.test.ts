import { describe, expect, it } from "vitest";
import { matchPattern } from "./pattern";

describe("matchPattern", () => {
  it("matches simple extensions with wildcard", () => {
    expect(matchPattern("report.pdf", "*.pdf", false)).toBe(true);
    expect(matchPattern("report.PDF", "*.pdf", false)).toBe(true);
    expect(matchPattern("report.pdf.bak", "*.pdf", false)).toBe(false);
  });

  it("handles case sensitivity flag", () => {
    expect(matchPattern("Report.PDF", "*.pdf", false, { caseSensitive: true })).toBe(false);
    expect(matchPattern("Report.pdf", "*.pdf", false, { caseSensitive: true })).toBe(true);
  });

  it("matches single-character wildcard ?", () => {
    expect(matchPattern("image_1.png", "image_?.png", false)).toBe(true);
    expect(matchPattern("image_22.png", "image_?.png", false)).toBe(false);
  });

  it("matches regex patterns with re: prefix", () => {
    expect(matchPattern("build_2026_final.zip", "re:^build_\\d{4}_", false)).toBe(true);
    expect(matchPattern("draft_2026_final.zip", "re:^build_\\d{4}_", false)).toBe(false);
  });

  it("matches regex patterns with slash notation /.../", () => {
    expect(matchPattern("App.test.tsx", "/\\.test\\.(ts|tsx)$/", false)).toBe(true);
    expect(matchPattern("App.tsx", "/\\.test\\.(ts|tsx)$/", false)).toBe(false);
  });

  it("matches simple extension prefixes with dot", () => {
    expect(matchPattern("index.ts", ".ts", false)).toBe(true);
    expect(matchPattern("index.tsx", ".ts", false)).toBe(false);
  });

  it("filters files vs folders correctly", () => {
    expect(matchPattern("src", "src", true, { filter: "folders" })).toBe(true);
    expect(matchPattern("src", "src", false, { filter: "folders" })).toBe(false);

    expect(matchPattern("src", "src", false, { filter: "files" })).toBe(true);
    expect(matchPattern("src", "src", true, { filter: "files" })).toBe(false);
  });

  it("matches substrings when no wildcards present", () => {
    expect(matchPattern("ProjectNexusExplorer", "Nexus", false)).toBe(true);
    expect(matchPattern("ProjectExplorer", "Nexus", false)).toBe(false);
  });
});

