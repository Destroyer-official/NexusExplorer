/** Pure entry filtering/sorting/aggregation helpers. */

import type { FileEntry, Settings, SortKey, Tab } from "@/types";

export function visibleEntries(tab: Tab, settings: Pick<Settings, "showHidden" | "showSystem">): FileEntry[] {
  const rows = tab.entries.filter((entry) => {
    if (!settings.showHidden && entry.isHidden) return false;
    if (!settings.showSystem && entry.isSystem) return false;
    return true;
  });
  const direction = tab.sortDesc ? -1 : 1;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  return rows.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const result = compare(a, b, tab.sortKey as SortKey, collator);
    return result === 0 ? collator.compare(a.name, b.name) * direction : result * direction;
  });
}

function compare(a: FileEntry, b: FileEntry, key: SortKey, collator: Intl.Collator): number {
  switch (key) {
    case "modified":
      return a.modifiedMs - b.modifiedMs;
    case "created":
      return a.createdMs - b.createdMs;
    case "size":
      return a.size - b.size;
    case "type":
      return collator.compare(a.isDir ? "" : a.ext, b.isDir ? "" : b.ext);
    case "name":
    default:
      return collator.compare(a.name, b.name);
  }
}

export interface SelectionStats {
  count: number;
  bytes: number;
  files: number;
  folders: number;
}

export function selectionStats(entries: FileEntry[], selected: string[]): SelectionStats {
  const set = new Set(selected.map((path) => path.toLowerCase()));
  let count = 0;
  let bytes = 0;
  let files = 0;
  let folders = 0;
  for (const entry of entries) {
    if (!set.has(entry.path.toLowerCase())) continue;
    count += 1;
    if (entry.isDir) folders += 1;
    else {
      files += 1;
      bytes += entry.size;
    }
  }
  return { count, bytes, files, folders };
}

export function groupEntries(entries: FileEntry[], groupBy: "none" | "date" | "type" | "size"): { label: string; entries: FileEntry[] }[] {
  if (groupBy === "none") return [{ label: "", entries }];
  const groups = new Map<string, FileEntry[]>();
  const keyOf = (e: FileEntry) => {
    if (groupBy === "date") {
      const d = new Date(e.modifiedMs);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) return "Today";
      const y = new Date(now); y.setDate(now.getDate() - 1);
      if (d.toDateString() === y.toDateString()) return "Yesterday";
      if (now.getTime() - e.modifiedMs < 7 * 86400000) return "This week";
      if (now.getTime() - e.modifiedMs < 30 * 86400000) return "This month";
      return d.toLocaleString(undefined, { year: "numeric", month: "long" });
    }
    if (groupBy === "type") return e.isDir ? "Folders" : (e.ext ? e.ext.toUpperCase() + " files" : "Files");
    if (groupBy === "size") {
      if (e.isDir) return "Folders";
      const mb = e.size / 1048576;
      if (mb < 1) return "Small (<1 MB)";
      if (mb < 100) return "Medium (1–100 MB)";
      if (mb < 1024) return "Large (100 MB–1 GB)";
      return "Huge (>1 GB)";
    }
    return "";
  };
  for (const e of entries) {
    const k = keyOf(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  return Array.from(groups.entries()).map(([label, entries]) => ({ label, entries }));
}
