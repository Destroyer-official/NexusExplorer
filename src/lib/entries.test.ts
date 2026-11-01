import { describe, it, expect } from "vitest";
import { visibleEntries, selectionStats, groupEntries } from "./entries";
import type { FileEntry, Tab } from "@/types";

function mockEntry(overrides: Partial<FileEntry>): FileEntry {
  return {
    name: "item",
    path: "C:\\test\\item",
    parentPath: "C:\\test",
    isDir: false,
    size: 100,
    createdMs: 1000,
    modifiedMs: 2000,
    isReadonly: false,
    isHidden: false,
    isSystem: false,
    ext: "txt",
    ...overrides,
  };
}

describe("entries module", () => {
  it("filters hidden and system files according to settings", () => {
    const normal = mockEntry({ name: "normal.txt", path: "C:\\normal.txt" });
    const hidden = mockEntry({ name: ".secret", path: "C:\\.secret", isHidden: true });
    const sys = mockEntry({ name: "system.sys", path: "C:\\system.sys", isSystem: true });

    const tab: Tab = {
      id: "tab1",
      path: "C:\\",
      title: "Root",
      history: ["C:\\"],
      historyIndex: 0,
      entries: [normal, hidden, sys],
      selected: [],
      sortKey: "name",
      sortDesc: false,
      view: "list",
      loading: false,
      error: null,
      groupBy: "none",
      anchorPath: null,
    };

    const withoutHidden = visibleEntries(tab, { showHidden: false, showSystem: false });
    expect(withoutHidden.map((e) => e.name)).toEqual(["normal.txt"]);

    const withHidden = visibleEntries(tab, { showHidden: true, showSystem: false });
    expect(withHidden.map((e) => e.name)).toEqual([".secret", "normal.txt"]);

    const withAll = visibleEntries(tab, { showHidden: true, showSystem: true });
    expect(withAll.map((e) => e.name)).toEqual([".secret", "normal.txt", "system.sys"]);
  });

  it("sorts directories before files naturally", () => {
    const fileA = mockEntry({ name: "alpha.txt", isDir: false });
    const folderB = mockEntry({ name: "beta_folder", isDir: true });

    const tab: Tab = {
      id: "tab1",
      path: "C:\\",
      title: "Root",
      history: ["C:\\"],
      historyIndex: 0,
      entries: [fileA, folderB],
      selected: [],
      sortKey: "name",
      sortDesc: false,
      view: "list",
      loading: false,
      error: null,
      groupBy: "none",
      anchorPath: null,
    };

    const sorted = visibleEntries(tab, { showHidden: true, showSystem: true });
    expect(sorted[0].name).toBe("beta_folder");
    expect(sorted[1].name).toBe("alpha.txt");
  });

  it("calculates selection statistics accurately", () => {
    const f1 = mockEntry({ name: "f1.txt", path: "C:\\f1.txt", size: 500, isDir: false });
    const f2 = mockEntry({ name: "f2.txt", path: "C:\\f2.txt", size: 1500, isDir: false });
    const dir = mockEntry({ name: "dir", path: "C:\\dir", size: 0, isDir: true });

    const stats = selectionStats([f1, f2, dir], ["C:\\f1.txt", "C:\\dir"]);
    expect(stats.count).toBe(2);
    expect(stats.files).toBe(1);
    expect(stats.folders).toBe(1);
    expect(stats.bytes).toBe(500);
  });

  it("groups entries by type correctly", () => {
    const f1 = mockEntry({ name: "f1.txt", ext: "txt", isDir: false });
    const f2 = mockEntry({ name: "f2.png", ext: "png", isDir: false });
    const dir = mockEntry({ name: "dir", ext: "", isDir: true });

    const grouped = groupEntries([f1, f2, dir], "type");
    expect(grouped.length).toBe(3);
    expect(grouped.some((g) => g.label === "Folders")).toBe(true);
    expect(grouped.some((g) => g.label === "TXT files")).toBe(true);
    expect(grouped.some((g) => g.label === "PNG files")).toBe(true);
  });
});
