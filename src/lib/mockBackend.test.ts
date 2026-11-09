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
  BlockDeduplicationReport,
  EntropyReport,
  MerkleTreeReport,
  MerkleProof,
  MerkleDiffReport,
  ArchiveOperationResult,
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

  it("dynamically parses diverse multi-category copilot prompts without hardcoding", async () => {
    const testCases: Array<{
      prompt: string;
      expectedAction: string;
      expectedDestructive: boolean;
      expectedPattern?: string;
    }> = [
      { prompt: "find all markdown files", expectedAction: "search", expectedDestructive: false, expectedPattern: "*.md" },
      { prompt: "shred all .log files", expectedAction: "shred", expectedDestructive: true, expectedPattern: "*.log" },
      { prompt: "wipe temporary caches", expectedAction: "shred", expectedDestructive: true },
      { prompt: "find same files with dedup", expectedAction: "deduplicate", expectedDestructive: false },
      { prompt: "compress all source code into archive", expectedAction: "archive_zip", expectedDestructive: false },
      { prompt: "duplicate folder with cow block cloning", expectedAction: "clone_cow", expectedDestructive: false },
      { prompt: "flatten nested directory structure", expectedAction: "flatten_directory", expectedDestructive: false },
      { prompt: "tag with MilestoneAlpha2027", expectedAction: "tag", expectedDestructive: false },
      { prompt: "organize photos by year and month", expectedAction: "organize_by_date", expectedDestructive: false },
      { prompt: "find files larger than 1.5GB", expectedAction: "search", expectedDestructive: false },
      { prompt: "find files smaller than 500KB", expectedAction: "search", expectedDestructive: false },
      { prompt: "organize python scripts", expectedAction: "move_by_extension", expectedDestructive: false, expectedPattern: "*.py" },
      { prompt: "archive selected documents to zip", expectedAction: "archive_zip", expectedDestructive: false },
    ];

    for (const tc of testCases) {
      const plan = await mockDispatch<CopilotPlan>("tools_copilot_plan", {
        prompt: tc.prompt,
        currentDir: "D:\\code\\Main_projects\\NexusExplorer",
      });

      expect(plan.actionKind, `Mismatch on '${tc.prompt}'`).toBe(tc.expectedAction);
      expect(plan.isDestructive, `Mismatch on '${tc.prompt}'`).toBe(tc.expectedDestructive);
      if (tc.expectedPattern) {
        expect(plan.targetPatterns).toContain(tc.expectedPattern);
      }
    }
  });

  it("handles FastCDC block-level deduplication and Shannon entropy inspection", async () => {
    const dedup = await mockDispatch<BlockDeduplicationReport>("tools_fastcdc_analyze", {
      paths: ["D:\\test\\a.dat", "D:\\test\\b.dat"],
    });
    expect(dedup.totalFilesAnalyzed).toBe(2);
    expect(dedup.deduplicationRatio).toBeGreaterThan(1);
    expect(dedup.sharedBlockSamples.length).toBeGreaterThan(0);

    const entropy = await mockDispatch<EntropyReport>("tools_entropy_inspect", {
      path: "D:\\test\\sample.bin",
    });
    expect(entropy.overallEntropy).toBeGreaterThan(0);
    expect(entropy.chunkDistribution.length).toBeGreaterThan(0);
    expect(entropy.advisory).toBeDefined();
  });

  it("handles BLAKE3 Merkle Tree construction, inclusion proofs, and sort-enhanced archiving", async () => {
    const tree = await mockDispatch<MerkleTreeReport>("tools_merkle_build", { dir: "D:\\code\\repo" });
    expect(tree.merkleRootHash).toBeDefined();
    expect(tree.totalFiles).toBeGreaterThan(0);
    expect(tree.leaves.length).toBeGreaterThan(0);

    const proof = await mockDispatch<MerkleProof>("tools_merkle_proof", {
      dir: "D:\\code\\repo",
      relPath: "src/main.rs",
    });
    expect(proof.targetRelativePath).toBe("src/main.rs");
    expect(proof.isValid).toBe(true);
    expect(proof.auditPath.length).toBeGreaterThan(0);

    const verified = await mockDispatch<boolean>("tools_merkle_verify", { proof });
    expect(verified).toBe(true);

    const diff = await mockDispatch<MerkleDiffReport>("tools_merkle_diff", {
      treeA: tree,
      treeB: tree,
    });
    expect(diff.isIdentical).toBe(true);
    expect(diff.unmodifiedCount).toBe(tree.totalFiles);

    const sortZip = await mockDispatch<ArchiveOperationResult>("tools_archive_create_sort_enhanced", {
      sources: ["D:\\code\\repo"],
      destZipPath: "D:\\out.zip",
    });
    expect(sortZip.success).toBe(true);
    expect(sortZip.filesProcessed).toBeGreaterThan(0);
  });
});
