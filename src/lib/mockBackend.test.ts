import { describe, expect, it } from "vitest";
import { mockDispatch, generateMockEntries } from "./mockBackend";
import type {
  DriveInfo,
  KnownFolder,
  Settings,
  GitRepoStatus,
  SniffResult,
  BinaryDiffReport,
  CopilotPlan,
  DevDriveReport,
  BitLockerVolumeStatus,
} from "@/types";

describe("Mock Backend Dispatcher", () => {
  it("generates mock filesystem entries", () => {
    const entries = generateMockEntries("D:\\test");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toHaveProperty("name");
    expect(entries[0]).toHaveProperty("path");
    expect(entries[0]).toHaveProperty("isDir");
  });

  it("handles get_drives command", async () => {
    const drives = await mockDispatch<DriveInfo[]>("get_drives");
    expect(Array.isArray(drives)).toBe(true);
    expect(drives.length).toBeGreaterThan(0);
    expect(drives[0].filesystem).toBeDefined();
    expect(drives[0].totalBytes).toBeGreaterThan(0);
  });

  it("handles known_folders command", async () => {
    const folders = await mockDispatch<KnownFolder[]>("known_folders");
    expect(folders.length).toBeGreaterThan(0);
    expect(folders.some((f) => f.id === "desktop")).toBe(true);
  });

  it("handles get_settings and save_settings", async () => {
    const settings = await mockDispatch<Settings>("get_settings");
    expect(settings.theme).toBe("dark");
    const updated = await mockDispatch<Settings>("save_settings", {
      settings: { ...settings, theme: "cyberpunk" },
    });
    expect(updated.theme).toBe("cyberpunk");
  });

  it("handles forensic & low-level filesystem tools", async () => {
    const sniff = await mockDispatch<SniffResult>("tools_sniff_file", { path: "D:\\test.pdf" });
    expect(sniff.detectedMime).toBe("application/pdf");
    expect(sniff.isSpoofed).toBe(false);

    const diff = await mockDispatch<BinaryDiffReport>("tools_compare_binary", {
      fileA: "A.bin",
      fileB: "B.bin",
    });
    expect(diff.isIdentical).toBe(true);

    const devDrive = await mockDispatch<DevDriveReport>("tools_devdrive_report");
    expect(devDrive.hasDevDrive).toBe(true);
    expect(devDrive.devDrivesDetected[0].isDevDrive).toBe(true);
    expect(devDrive.packageCaches.length).toBeGreaterThan(0);

    const bitlocker = await mockDispatch<BitLockerVolumeStatus[]>("tools_bitlocker_status");
    expect(bitlocker.length).toBeGreaterThan(0);
    expect(bitlocker[0].protectionStatus).toBe("Protected");
  });

  it("handles 2027 power features: git and copilot", async () => {
    const git = await mockDispatch<GitRepoStatus>("tools_git_status", { root: "D:\\repo" });
    expect(git.isRepo).toBe(true);
    expect(git.currentBranch).toBe("master");

    const copilot = await mockDispatch<CopilotPlan>("tools_copilot_plan", {
      prompt: "organize downloads",
      contextPaths: [],
    });
    expect(copilot.actionKind).toBe("move_by_extension");
    expect(copilot.confidence).toBeGreaterThan(0);
  });
});
