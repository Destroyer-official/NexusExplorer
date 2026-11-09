import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import { iconAssetForEntry } from "./fileIcons";
import { iconAssets } from "./iconAssets";
it("maps common types and folders to bundled SVG assets", () => {
  expect(iconAssetForEntry({ name: "main.rs", ext: "rs", isDir: false })).toBe("/icons/filetypes/rust.svg");
  expect(iconAssetForEntry({ name: "report.pdf", ext: "pdf", isDir: false })).toBe("/icons/filetypes/pdf.svg");
  expect(iconAssetForEntry({ name: "Documents", ext: "", isDir: true })).toBe("/icons/filetypes/folder-documents.svg");
  expect(iconAssetForEntry({ name: "New folder", ext: "", isDir: true })).toBe("/icons/filetypes/folder-base.svg");
  expect(iconAssetForEntry({ name: "unknown.xyzabc", ext: "xyzabc", isDir: false })).toBeNull();
});
it("has no missing files in its bundled icon manifest", () => {
  for (const name of iconAssets) expect(existsSync("public/icons/filetypes/" + name + ".svg"), name).toBe(true);
});
