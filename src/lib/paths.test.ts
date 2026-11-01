import { describe, it, expect } from "vitest";
import {
  normalizePath,
  joinPath,
  basename,
  dirname,
  isDriveRoot,
  isUncRoot,
  isRoot,
  splitPath,
  samePath,
  isWithin,
} from "./paths";

describe("paths module", () => {
  it("normalizes forward slashes to backslashes and trims trailing slashes", () => {
    expect(normalizePath("C:/Users/test/")).toBe("C:\\Users\\test");
    expect(normalizePath("C:/")).toBe("C:\\");
    expect(normalizePath("C:")).toBe("C:\\");
    expect(normalizePath("")).toBe("");
  });

  it("joins paths safely preserving single backslashes", () => {
    expect(joinPath("C:\\Users", "des")).toBe("C:\\Users\\des");
    expect(joinPath("C:\\", "des")).toBe("C:\\des");
    expect(joinPath("", "file.txt")).toBe("file.txt");
  });

  it("extracts basename accurately", () => {
    expect(basename("C:\\Users\\des\\document.pdf")).toBe("document.pdf");
    expect(basename("C:\\Users\\des")).toBe("des");
    expect(basename("C:\\")).toBe("C:");
    expect(basename("")).toBe("");
  });

  it("extracts dirname accurately", () => {
    expect(dirname("C:\\Users\\des\\document.pdf")).toBe("C:\\Users\\des");
    expect(dirname("C:\\Users\\des")).toBe("C:\\Users");
    expect(dirname("C:\\Users")).toBe("C:\\");
    expect(dirname("C:\\")).toBe("C:\\");
  });

  it("identifies roots correctly", () => {
    expect(isDriveRoot("C:\\")).toBe(true);
    expect(isDriveRoot("D:")).toBe(true);
    expect(isDriveRoot("C:\\Users")).toBe(false);
    expect(isUncRoot("\\\\server\\share")).toBe(true);
    expect(isUncRoot("\\\\server\\share\\sub")).toBe(false);
    expect(isRoot("C:\\")).toBe(true);
    expect(isRoot("")).toBe(true);
    expect(isRoot("C:\\folder")).toBe(false);
  });

  it("splits paths into breadcrumb segments", () => {
    const segments = splitPath("C:\\Users\\des\\Projects");
    expect(segments).toEqual([
      { label: "C:", path: "C:\\" },
      { label: "Users", path: "C:\\Users" },
      { label: "des", path: "C:\\Users\\des" },
      { label: "Projects", path: "C:\\Users\\des\\Projects" },
    ]);
  });

  it("checks path equality case-insensitively on Windows", () => {
    expect(samePath("c:\\users\\test", "C:/Users/test/")).toBe(true);
    expect(samePath("C:\\A", "C:\\B")).toBe(false);
  });

  it("checks containment correctly", () => {
    expect(isWithin("C:\\Users\\test\\file.txt", "C:\\Users\\test")).toBe(true);
    expect(isWithin("C:\\Users\\other\\file.txt", "C:\\Users\\test")).toBe(false);
    expect(isWithin("C:\\Users\\test", "C:\\Users\\test")).toBe(true);
  });
});

