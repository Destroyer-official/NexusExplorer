/** Intelligent browser mock backend for NexusExplorer when running in standard web browsers. */

import type {
  DriveInfo,
  FileEntry,
  KnownFolder,
  RenamePlanItem,
  RenameTransaction,
  SmartFolder,
  SmartFolderResult,
  GitBlameLine,
} from "@/types";

const MOCK_DRIVES: DriveInfo[] = [
  {
    path: "C:\\",
    label: "Local Disk (Windows System)",
    driveType: "fixed",
    filesystem: "NTFS",
    freeBytes: 192_400_000_000,
    totalBytes: 512_000_000_000,
    isReady: true,
  },
  {
    path: "D:\\",
    label: "Nexus Projects (ReFS Dev Drive)",
    driveType: "fixed",
    filesystem: "ReFS",
    freeBytes: 680_000_000_000,
    totalBytes: 1_000_000_000_000,
    isReady: true,
  },
  {
    path: "E:\\",
    label: "NVMe Backup SSD",
    driveType: "removable",
    filesystem: "exFAT",
    freeBytes: 1_420_000_000_000,
    totalBytes: 2_000_000_000_000,
    isReady: true,
  },
];

const MOCK_KNOWN: KnownFolder[] = [
  { id: "home", label: "Nexus Workspace", path: "D:\\code\\Main_projects\\NexusExplorer" },
  { id: "desktop", label: "Desktop", path: "C:\\Users\\Developer\\Desktop" },
  { id: "documents", label: "Documents", path: "C:\\Users\\Developer\\Documents" },
  { id: "downloads", label: "Downloads", path: "C:\\Users\\Developer\\Downloads" },
  { id: "pictures", label: "Pictures", path: "C:\\Users\\Developer\\Pictures" },
  { id: "music", label: "Music", path: "C:\\Users\\Developer\\Music" },
  { id: "videos", label: "Videos", path: "C:\\Users\\Developer\\Videos" },
];

const mockTerminatedPids = new Set<number>();
const mockAddedEntries: Record<string, FileEntry[]> = {};
const mockDirMap = new Map<string, FileEntry[]>();
const mockDeletedSet = new Set<string>();

export function getMockEntries(parent: string): FileEntry[] {
  const norm = parent.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  let list = mockDirMap.get(norm);
  if (!list) {
    list = generateMockEntries(parent);
    mockDirMap.set(norm, list);
  }
  return list.filter((e) => !mockDeletedSet.has(e.path.replace(/\//g, "\\").toLowerCase()));
}

export function addMockEntryToParent(parent: string, entry: FileEntry) {
  const norm = parent.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  mockDeletedSet.delete(entry.path.replace(/\//g, "\\").toLowerCase());
  let list = mockDirMap.get(norm);
  if (!list) {
    list = generateMockEntries(parent);
  }
  list = list.filter((e) => e.name.toLowerCase() !== entry.name.toLowerCase());
  list.unshift(entry);
  mockDirMap.set(norm, list);
}

export function deleteMockPaths(paths: string[]) {
  for (const p of paths) {
    mockDeletedSet.add(p.replace(/\//g, "\\").toLowerCase());
  }
}

export function renameMockPath(oldPath: string, newName: string): FileEntry | null {
  const normOld = oldPath.replace(/\//g, "\\");
  const parent = normOld.split(/[\\\/]/).slice(0, -1).join("\\") || "D:\\";
  const normParent = parent.toLowerCase();
  let list = mockDirMap.get(normParent);
  if (!list) {
    list = generateMockEntries(parent);
    mockDirMap.set(normParent, list);
  }
  const item = list.find((e) => e.path.toLowerCase() === normOld.toLowerCase());
  if (item) {
    const ext = item.isDir ? "" : (newName.includes(".") ? newName.split(".").pop() || "" : "");
    const updated: FileEntry = {
      ...item,
      name: newName,
      path: `${parent}\\${newName}`,
      ext,
      modifiedMs: Date.now(),
    };
    mockDeletedSet.add(normOld.toLowerCase());
    mockDeletedSet.delete(updated.path.toLowerCase());
    mockDirMap.set(
      normParent,
      list.map((e) => (e.path.toLowerCase() === normOld.toLowerCase() ? updated : e))
    );
    return updated;
  }
  return null;
}

interface MockUndoAction {
  label: string;
  undo: () => void;
  redo: () => void;
}
const mockUndoStack: MockUndoAction[] = [];
const mockRedoStack: MockUndoAction[] = [];

export function generateMockEntries(parent: string): FileEntry[] {
  const norm = parent.replace(/\//g, "\\").replace(/\\+$/, "");
  const now = Date.now();
  const lower = norm.toLowerCase();
  const folderName = norm.split(/[\/\\]/).pop()?.toLowerCase() || "";

  const makeFile = (name: string, size: number, ext: string, ageHours = 1): FileEntry => ({
    name,
    path: `${norm}\\${name}`,
    parentPath: norm,
    isDir: false,
    size,
    modifiedMs: now - ageHours * 3600000,
    createdMs: now - 86400000,
    isHidden: false,
    isSystem: false,
    isReadonly: false,
    ext,
  });

  const makeDir = (name: string, ageHours = 2): FileEntry => ({
    name,
    path: `${norm}\\${name}`,
    parentPath: norm,
    isDir: true,
    size: 0,
    modifiedMs: now - ageHours * 3600000,
    createdMs: now - 86400000,
    isHidden: false,
    isSystem: false,
    isReadonly: false,
    ext: "",
  });

  const getBaseEntries = (): FileEntry[] => {
    if (folderName === "crates") {
    return [
      makeDir("nexus-core", 1),
      makeDir("nexus-indexer", 2),
      makeDir("nexus-protocol", 3),
      makeDir("nexus-ffi", 4),
      makeFile("Cargo.toml", 850, "toml", 1),
      makeFile("README.md", 2400, "md", 2),
    ];
  }

  if (["nexus-core", "nexus-indexer", "nexus-protocol", "nexus-ffi"].includes(folderName)) {
    return [
      makeDir("src", 1),
      makeDir("tests", 3),
      makeFile("Cargo.toml", 1200, "toml", 1),
      makeFile("build.rs", 420, "rs", 5),
      makeFile("README.md", 1850, "md", 2),
    ];
  }

  if (folderName === "src" && !lower.includes("crates")) {
    return [
      makeDir("components", 1),
      makeDir("hooks", 2),
      makeDir("lib", 3),
      makeDir("state", 1),
      makeDir("styles", 4),
      makeDir("types", 5),
      makeFile("App.tsx", 8400, "tsx", 1),
      makeFile("main.tsx", 480, "tsx", 2),
      makeFile("types.ts", 14200, "ts", 3),
    ];
  }

  if (folderName === "components") {
    return [
      makeDir("previews", 2),
      makeDir("modals", 3),
      makeFile("FileList.tsx", 9800, "tsx", 1),
      makeFile("FileGrid.tsx", 4200, "tsx", 1),
      makeFile("Toolbar.tsx", 7600, "tsx", 2),
      makeFile("Breadcrumbs.tsx", 2300, "tsx", 3),
      makeFile("Sidebar.tsx", 6100, "tsx", 4),
      makeFile("PreviewPane.tsx", 8900, "tsx", 2),
      makeFile("QuickLookDialog.tsx", 2800, "tsx", 1),
      makeFile("CommandPalette.tsx", 5400, "tsx", 3),
    ];
  }

  if (folderName === "hooks") {
    return [
      makeFile("useShortcuts.ts", 3200, "ts", 2),
      makeFile("useTheme.ts", 1400, "ts", 4),
      makeFile("useWatcher.ts", 2600, "ts", 3),
      makeFile("useVirtualScroll.ts", 4100, "ts", 5),
    ];
  }

  if (folderName === "lib") {
    return [
      makeFile("ipc.ts", 18400, "ts", 1),
      makeFile("paths.ts", 3600, "ts", 2),
      makeFile("format.ts", 2200, "ts", 4),
      makeFile("menus.ts", 5100, "ts", 3),
      makeFile("dnd.ts", 2900, "ts", 2),
      makeFile("mockBackend.ts", 24500, "ts", 1),
    ];
  }

  if (folderName === "state") {
    return [
      makeFile("store.ts", 32000, "ts", 1),
      makeFile("types.ts", 4500, "ts", 2),
    ];
  }

  if (folderName === "styles") {
    return [
      makeFile("layout.css", 9200, "css", 1),
      makeFile("theme.css", 4100, "css", 3),
      makeFile("tokens.css", 2800, "css", 5),
      makeFile("tailwind.css", 1600, "css", 2),
    ];
  }

  if (folderName === "tests") {
    return [
      makeFile("explorer.spec.ts", 6400, "ts", 2),
      makeFile("navigation.test.ts", 4200, "ts", 3),
      makeFile("ipc.test.ts", 3800, "ts", 4),
    ];
  }

  if (folderName === "dist") {
    return [
      makeDir("assets", 1),
      makeFile("index.html", 850, "html", 1),
      makeFile("favicon.ico", 1024, "ico", 1),
    ];
  }

  if (folderName === "assets") {
    return [
      makeFile("index.js", 248000, "js", 1),
      makeFile("index.css", 42000, "css", 1),
      makeFile("vendor.js", 685000, "js", 2),
      makeFile("nexus_logo.svg", 3400, "svg", 3),
    ];
  }

  if (folderName === "public") {
    return [
      makeFile("favicon.ico", 1024, "ico", 24),
      makeFile("logo.png", 18500, "png", 24),
      makeFile("robots.txt", 120, "txt", 24),
    ];
  }

  if (folderName === "desktop") {
    return [
      makeDir("Project_Alpha", 2),
      makeFile("Product_Roadmap_2027.pdf", 2450000, "pdf", 1),
      makeFile("Sprint_Notes.txt", 1400, "txt", 2),
      makeFile("Financial_Forecast.xlsx", 86000, "xlsx", 4),
      makeFile("architecture_diagram.png", 520000, "png", 3),
    ];
  }

  if (folderName === "documents") {
    return [
      makeDir("Contracts", 24),
      makeDir("Tax_2026", 48),
      makeFile("Annual_Report.pdf", 3100000, "pdf", 5),
      makeFile("Security_Whitepaper.docx", 480000, "docx", 8),
      makeFile("API_Specification.md", 14500, "md", 2),
    ];
  }

  if (folderName === "downloads") {
    return [
      makeDir("crates", 1),
      makeDir("src", 2),
      makeDir("dist", 3),
      makeDir("public", 5),
      makeFile("NexusExplorer_Setup_v2.0.exe", 48500000, "exe", 1),
      makeFile("architecture_2027.svg", 44000, "svg", 2),
      makeFile("3d_model_engine.gltf", 245000, "gltf", 3),
      makeFile("Cargo.toml", 1100, "toml", 1),
      makeFile("package.json", 1100, "json", 2),
      makeFile("README.md", 11000, "md", 1),
      makeFile("release_bundle_v2.zip", 18450000, "zip", 4),
      makeFile("sample_track.mp3", 4600000, "mp3", 5),
    ];
  }

  if (folderName === "pictures") {
    return [
      makeFile("cyberpunk_neon_city.png", 4200000, "png", 1),
      makeFile("nexus_ui_mockup.webp", 890000, "webp", 3),
      makeFile("vector_icons.svg", 45000, "svg", 6),
      makeFile("system_architecture.png", 1400000, "png", 2),
    ];
  }

  if (folderName === "music") {
    return [
      makeFile("synthwave_odyssey.flac", 24500000, "flac", 2),
      makeFile("ambient_focus_flow.mp3", 8400000, "mp3", 4),
      makeFile("cybernetic_pulse.wav", 18200000, "wav", 8),
    ];
  }

  if (folderName === "videos") {
    return [
      makeFile("nexus_explorer_demo_4k.mp4", 142000000, "mp4", 1),
      makeFile("vdfs_benchmark_recording.webm", 48000000, "webm", 3),
    ];
  }

  // If this is a root path or unhandled folder
  if (!norm || norm.endsWith(":") || norm.endsWith(":\\") || norm === "D:" || norm === "C:") {
    return [
      makeDir("crates", 1),
      makeDir("src", 2),
      makeDir("src-tauri", 3),
      makeDir("dist", 1),
      makeDir("public", 24),
      makeFile("3d_model_engine.gltf", 245000, "gltf", 5),
      makeFile("architecture_2027.svg", 45000, "svg", 2),
      makeFile("Cargo.toml", 1100, "toml", 1),
      makeFile("confidential_keys.nxvault", 3145728, "nxvault", 1),
      makeFile("package.json", 1100, "json", 1),
      makeFile("README.md", 11050, "md", 1),
      makeFile("release_bundle_v2.zip", 18454937, "zip", 12),
      makeFile("sample_track.mp3", 4613734, "mp3", 10),
    ];
  }

    // Generic fallback for any other subfolder
    const hash = folderName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return [
      makeDir("archive", 2),
      makeFile(`${folderName}_index.ts`, 1800 + (hash % 2000), "ts", 1),
      makeFile(`${folderName}_config.json`, 650 + (hash % 500), "json", 2),
      makeFile(`README_${folderName}.md`, 1200 + (hash % 1000), "md", 3),
      makeFile(`notes_${folderName}.txt`, 450 + (hash % 300), "txt", 4),
    ];
  };

  const base = getBaseEntries();
  const added = mockAddedEntries[lower] ?? [];
  return [...base, ...added];
}



let terminalReadCount = 0;

export async function mockDispatch<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const normPath = String(args?.path || args?.root || "D:\\code\\Main_projects\\NexusExplorer");

  switch (cmd) {
    case "get_settings": {
      let stored: string | null = null;
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          stored = window.localStorage.getItem("nexus_settings_browser");
        }
      } catch {}
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
      return {
        version: 1,
        theme: "dark",
        accent: "aurora",
        density: "comfortable",
        lastPath: "D:\\code\\Main_projects\\NexusExplorer",
        view: "list",
        sortKey: "name",
        sortDesc: false,
        showHidden: false,
        showSystem: false,
        showExtensions: true,
        confirmDelete: true,
        previewOpen: true,
        sidebarOpen: true,
        sidebarWidth: 268,
        restoreSession: true,
        sessionTabs: ["D:\\code\\Main_projects\\NexusExplorer"],
        recentLimit: 30,
        animations: true,
        zoom: 100,
        faytEnabled: true,
        vimModeEnabled: true,
        chromaticHeatmap: true,
      } as unknown as T;
    }

    case "save_settings": {
      if (args?.settings) {
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("nexus_settings_browser", JSON.stringify(args.settings));
          }
        } catch {}
      }
      return args?.settings as unknown as T;
    }

    case "get_drives":
      return MOCK_DRIVES as unknown as T;

    case "home_dir":
      return "D:\\code\\Main_projects\\NexusExplorer" as unknown as T;

    case "known_folders":
      return MOCK_KNOWN as unknown as T;

    case "app_info":
      return {
        version: "2.0.0",
        engineVersion: "2.0.0",
        platform: "windows",
        osVersion: "Windows 11 Pro 25H2 (Workstation)",
        cpuArch: "x86_64",
        homeDir: "D:\\code\\Main_projects\\NexusExplorer",
      } as unknown as T;

    case "window_minimize":
    case "window_close":
      return undefined as unknown as T;

    case "window_toggle_maximize":
      return true as unknown as T;

    case "window_is_maximized":
      return false as unknown as T;

    case "list_bookmarks": {
      const stored = localStorage.getItem("nexus_bookmarks_browser");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
      return [
        { id: "b1", name: "Main Project", path: "D:\\code\\Main_projects\\NexusExplorer" },
        { id: "b2", name: "Downloads", path: "C:\\Users\\Developer\\Downloads" },
      ] as unknown as T;
    }

    case "save_bookmarks": {
      if (args?.bookmarks) {
        localStorage.setItem("nexus_bookmarks_browser", JSON.stringify(args.bookmarks));
      }
      return undefined as unknown as T;
    }

    case "list_recent":
      return [
        { name: "NexusExplorer", path: "D:\\code\\Main_projects\\NexusExplorer", visitedMs: Date.now() - 60_000 },
        { name: "package.json", path: "D:\\code\\Main_projects\\NexusExplorer\\package.json", visitedMs: Date.now() - 120_000 },
      ] as unknown as T;

    case "record_recent":
      return [] as unknown as T;

    case "undo_status":
      return {
        canUndo: mockUndoStack.length > 0,
        canRedo: mockRedoStack.length > 0,
        undoLabel: mockUndoStack[mockUndoStack.length - 1]?.label ?? null,
        redoLabel: mockRedoStack[mockRedoStack.length - 1]?.label ?? null,
      } as unknown as T;

    case "undo": {
      const action = mockUndoStack.pop();
      if (!action) {
        throw new Error("Nothing to undo");
      }
      action.undo();
      mockRedoStack.push(action);
      return {
        canUndo: mockUndoStack.length > 0,
        canRedo: mockRedoStack.length > 0,
        undoLabel: mockUndoStack[mockUndoStack.length - 1]?.label ?? null,
        redoLabel: mockRedoStack[mockRedoStack.length - 1]?.label ?? null,
      } as unknown as T;
    }

    case "redo": {
      const action = mockRedoStack.pop();
      if (!action) {
        throw new Error("Nothing to redo");
      }
      action.redo();
      mockUndoStack.push(action);
      return {
        canUndo: mockUndoStack.length > 0,
        canRedo: mockRedoStack.length > 0,
        undoLabel: mockUndoStack[mockUndoStack.length - 1]?.label ?? null,
        redoLabel: mockRedoStack[mockRedoStack.length - 1]?.label ?? null,
      } as unknown as T;
    }

    case "read_dir":
      return getMockEntries(normPath) as unknown as T;

    case "stat_path": {
      const p = normPath;
      const isDir = !p.includes(".");
      const name = p.split(/[\/\\]/).pop() || p;
      return {
        name,
        path: p,
        parentPath: p.substring(0, p.lastIndexOf("\\")),
        isDir,
        size: isDir ? 0 : 4096,
        modifiedMs: Date.now() - 3_600_000,
        createdMs: Date.now() - 86_400_000,
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext: isDir ? "" : name.split(".").pop() || "",
      } as unknown as T;
    }

    case "read_text_file":
      return {
        content: `// NexusExplorer 2027+ Live Document\n// File: ${normPath}\n\nexport const config = {\n  version: "2.0.0",\n  engine: "Rust + Tauri v2 + React 19",\n  status: "Production Ready",\n};\n`,
        truncated: false,
        size: 180,
      } as unknown as T;

    case "preview_file": {
      const ext = normPath.split(".").pop()?.toLowerCase() || "";
      if (["mp3", "wav", "flac"].includes(ext)) {
        return { path: normPath, kind: "audio", mime: "audio/mpeg", size: 4580000, truncated: false, text: null, width: null, height: null } as unknown as T;
      }
      if (["mp4", "webm", "mkv"].includes(ext)) {
        return { path: normPath, kind: "video", mime: "video/mp4", size: 12000000, truncated: false, text: null, width: null, height: null } as unknown as T;
      }
      if (["gltf", "obj", "stl"].includes(ext)) {
        return { path: normPath, kind: "text", mime: "model/gltf+json", size: 245000, truncated: false, text: '{"asset":{"version":"2.0"},"scenes":[{"nodes":[0]}]}', width: null, height: null } as unknown as T;
      }
      if (ext === "svg") {
        return {
          path: normPath,
          kind: "text",
          mime: "image/svg+xml",
          size: 1024,
          truncated: false,
          text: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#7c6cff"/></svg>',
          width: 100,
          height: 100,
        } as unknown as T;
      }
      return {
        path: normPath,
        kind: "text",
        mime: "text/plain",
        size: 512,
        truncated: false,
        text: `# NexusExplorer 2027+\n\nActive workspace: \`${normPath}\`\n\nAll features verified operational and production ready.`,
        width: null,
        height: null,
      } as unknown as T;
    }

    case "read_hex_slice": {
      const bytes: number[] = [];
      const ascii: string[] = [];
      for (let i = 0; i < 256; i++) {
        const b = (i * 17 + 42) % 256;
        bytes.push(b);
        ascii.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : ".");
      }
      return {
        offset: Number(args?.offset || 0),
        bytes,
        ascii: ascii.join(""),
        totalBytes: 1024 * 1024,
      } as unknown as T;
    }

    case "hash_file":
      return {
        path: normPath,
        size: 1024,
        algorithm: String(args?.algorithm || "sha256"),
        digest: "8f4e2c91b5a3d7e0123456789abcdef08f4e2c91b5a3d7e0123456789abcdef0",
        elapsedMs: 2,
      } as unknown as T;

    case "tools_git_status":
      return {
        isRepo: true,
        repoRoot: "D:\\code\\Main_projects\\NexusExplorer",
        currentBranch: "master",
        headCommit: {
          shortHash: "7b4c91a",
          authorName: "Des",
          authorEmail: "des@nexus.io",
          message: "feat: master verified 2027+ architecture",
          timestampMs: Date.now() - 3_600_000,
        },
        isClean: false,
        stagedCount: 1,
        modifiedCount: 2,
        untrackedCount: 0,
        conflictedCount: 0,
        fileStatuses: {
          "D:\\code\\Main_projects\\NexusExplorer\\src\\lib\\ipc.ts": "modified",
        },
      } as unknown as T;

    case "tools_devdrive_report":
      return {
        hasDevDrive: true,
        devDrivesDetected: [
          {
            driveLetter: "D:",
            volumeLabel: "Nexus Projects",
            filesystem: "ReFS",
            isDevDrive: true,
            isRefs: true,
            cowSupported: true,
            totalBytes: 1_000_000_000_000,
            freeBytes: 680_000_000_000,
          },
        ],
        packageCaches: [
          {
            ecosystem: "npm / pnpm",
            envVar: "npm_config_cache",
            currentPath: "C:\\Users\\Developer\\AppData\\Local\\npm-cache",
            exists: true,
            isOnDevDrive: false,
            recommendedPath: "D:\\dev-cache\\npm",
          },
          {
            ecosystem: "cargo (Rust)",
            envVar: "CARGO_HOME",
            currentPath: "C:\\Users\\Developer\\.cargo",
            exists: true,
            isOnDevDrive: false,
            recommendedPath: "D:\\dev-cache\\cargo",
          },
        ],
        recommendedActions: [
          "Move Cargo and NPM caches to D: to unlock ReFS block cloning and up to 300% faster package operations.",
        ],
      } as unknown as T;
    case "tools_bitlocker_status":
      return [
        {
          driveLetter: "C",
          volumeStatus: "FullyEncrypted",
          protectionStatus: "Protected",
          lockStatus: "Unlocked",
          encryptionMethod: "XTS-AES-256",
          isDevDrive: false,
        },
        {
          driveLetter: "D",
          volumeStatus: "FullyEncrypted",
          protectionStatus: "Protected",
          lockStatus: "Unlocked",
          encryptionMethod: "XTS-AES-256",
          isDevDrive: true,
        },
        {
          driveLetter: "E",
          volumeStatus: "FullyEncrypted",
          protectionStatus: "Protected",
          lockStatus: "Locked",
          encryptionMethod: "AES-CBC-128",
          isDevDrive: false,
        },
      ] as unknown as T;

    case "tools_provenance_log":
      return [
        {
          sequence: 1,
          eventType: "CREATE",
          targetPath: "D:\\code\\Main_projects\\NexusExplorer\\architecture.svg",
          principalUser: "Developer",
          timestampMs: Date.now() - 3_600_000,
          payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          chainHash: "7b4c91a02e5d8f3b1a4c6e8d0f2a4b6c8e0d2f4a6b8c0e2d4f6a8b0c2e4d6f8a",
          metadata: "Genesis block recorded",
        },
      ] as unknown as T;

    case "tools_provenance_verify":
      return {
        isValid: true,
        totalRecords: 1,
        genesisHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        latestChainHash: "7b4c91a02e5d8f3b1a4c6e8d0f2a4b6c8e0d2f4a6b8c0e2d4f6a8b0c2e4d6f8a",
        lastChainHash: "7b4c91a02e5d8f3b1a4c6e8d0f2a4b6c8e0d2f4a6b8c0e2d4f6a8b0c2e4d6f8a",
        verifiedEvents: 1,
        errorMessage: null,
        tamperDetectedAtSequence: null,
        tamperedRecordSequence: null,
      } as unknown as T;

    case "tools_vdfs_summary":
      return {
        totalObjects: 214_200,
        totalLogicalBytes: 12_800_000_000_000,
        totalPhysicalBytes: 9_170_000_000_000,
        totalPhysicalReplicas: 3,
        deduplicationSavingsBytes: 3_630_000_000_000,
        nodeCount: 3,
        nodes: [
          {
            id: "node-desktop-win11",
            nodeId: "node-desktop-win11",
            name: "Main Workstation",
            nodeType: "desktop",
            endpoint: "192.168.1.10:9001",
            online: true,
            isOnline: true,
          },
          {
            id: "node-nas-storage",
            nodeId: "node-nas-storage",
            name: "TrueNAS Core",
            nodeType: "nas",
            endpoint: "192.168.1.50:9001",
            online: true,
            isOnline: true,
          },
          {
            id: "node-laptop-m3",
            nodeId: "node-laptop-m3",
            name: "MacBook Pro M3",
            nodeType: "laptop",
            endpoint: "192.168.1.25:9001",
            online: true,
            isOnline: true,
          },
        ],
      } as unknown as T;

    case "tools_webdrop_status":
      return {
        isActive: true,
        url: "http://192.168.1.10:1421/webdrop",
        localIp: "192.168.1.10",
        port: 1421,
        activeSharesCount: 3,
        qrSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/><rect x="10" y="10" width="25" height="25" fill="black"/><rect x="15" y="15" width="15" height="15" fill="white"/><rect x="18" y="18" width="9" height="9" fill="black"/><rect x="65" y="10" width="25" height="25" fill="black"/><rect x="70" y="15" width="15" height="15" fill="white"/><rect x="73" y="18" width="9" height="9" fill="black"/><rect x="10" y="65" width="25" height="25" fill="black"/><rect x="15" y="70" width="15" height="15" fill="white"/><rect x="18" y="73" width="9" height="9" fill="black"/><rect x="45" y="20" width="10" height="10" fill="black"/><rect x="40" y="40" width="20" height="20" fill="black"/><rect x="65" y="65" width="15" height="15" fill="black"/></svg>`,
      } as unknown as T;

    case "tools_janitor_scan":
      return {
        rootPath: "D:\\code\\Main_projects\\NexusExplorer",
        targets: [
          {
            path: "D:\\code\\Main_projects\\NexusExplorer\\node_modules",
            targetType: "npm_node_modules",
            sizeBytes: 185_000_000,
            safeToDelete: true,
          },
          {
            path: "D:\\code\\Main_projects\\NexusExplorer\\target",
            targetType: "cargo_target",
            sizeBytes: 1_420_000_000,
            safeToDelete: true,
          },
        ],
        totalReclaimableBytes: 1_605_000_000,
        elapsedMs: 35,
      } as unknown as T;

    case "tools_dlp_scan":
      return {
        scannedFiles: 42,
        totalFindings: 0,
        findings: [],
        elapsedMs: 14,
      } as unknown as T;

    case "tools_mounter_list":
      return [
        {
          driveLetter: "Z",
          sourcePath: "D:\\code\\Main_projects\\NexusExplorer\\release_bundle_v2.zip",
          mountType: "archive",
          isMounted: true,
          label: "Archive Z:",
        },
      ] as unknown as T;

    case "tools_copilot_plan":
      return {
        rawPrompt: String(args?.prompt || ""),
        intentSummary: "Analyze directory structure and organize files by category.",
        actionKind: "move_by_extension",
        confidence: 0.95,
        isDestructive: false,
        targetPatterns: ["*.*"],
        matchedFiles: ["demo.png", "doc.pdf"],
        totalMatchedBytes: 1048576,
        explanation: "Group files cleanly by their type.",
      } as unknown as T;
    case "tools_copilot_execute":
      return {
        success: true,
        executedActionsCount: 1,
        message: "Successfully executed planned copilot action.",
      } as unknown as T;

    case "tools_clone_file": {
      const src = String(args?.srcPath || args?.sourcePath || "");
      const dest = String(args?.destPath || "");
      const name = dest.split(/[\/\\]/).pop() || "copy";
      const pDir = dest.substring(0, dest.lastIndexOf("\\")).toLowerCase();
      const ext = name.split(".").pop() || "";
      const newEntry: FileEntry = {
        name,
        path: dest,
        parentPath: dest.substring(0, dest.lastIndexOf("\\")),
        isDir: false,
        size: 1_048_576,
        modifiedMs: Date.now(),
        createdMs: Date.now(),
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext,
      };
      if (!mockAddedEntries[pDir]) mockAddedEntries[pDir] = [];
      mockAddedEntries[pDir].push(newEntry);
      return {
        sourcePath: src,
        destPath: dest,
        isCowBlockCloned: true,
        bytesCloned: 1_048_576,
        elapsedMs: 1,
      } as unknown as T;
    }

    case "tools_shred_paths":
      return {
        filesDestroyed: 1,
        totalBytesShredded: 1_024,
        passesCompleted: 3,
        algorithm: "dod3",
        elapsedMs: 5,
      } as unknown as T;

    case "tools_sniff_file":
      return {
        path: normPath,
        fileName: normPath.split(/[\/\\]/).pop() || normPath,
        declaredExtension: normPath.split(".").pop() || "",
        detectedFormat: "Portable Document Format (PDF)",
        detectedMime: "application/pdf",
        isSpoofed: false,
        magicBytesHex: "25 50 44 46",
      } as unknown as T;

    case "tools_audit_directory":
      return [] as unknown as T;

    case "tools_compare_binary":
      return {
        isIdentical: true,
        matchingPercentage: 100,
        totalDifferencesBytes: 0,
        firstDiffOffset: null,
        chunkRows: [],
      } as unknown as T;

    case "tools_get_locking_processes":
      if (!mockTerminatedPids.has(14208) && (normPath.toLowerCase().includes("confidential_keys") || normPath.toLowerCase().includes("sample_track"))) {
        return [
          { pid: 14208, name: "node.exe", appType: "Service", isSystem: false }
        ] as unknown as T;
      }
      return [] as unknown as T;

    case "tools_vss_list":
      return [
        {
          id: "snap-1",
          snapshotPath: "\\\\?\\GLOBALROOT\\Device\\HarddiskVolumeShadowCopy1",
          volume: "C:\\",
          creationTime: "2026-10-30 18:45:00",
          attributes: "Exposed locally",
        },
      ] as unknown as T;

    case "tools_archive_list_any":
      return {
        archivePath: normPath,
        format: "zip",
        totalFiles: 8,
        totalDirectories: 2,
        compressedBytes: 18_450_000,
        uncompressedBytes: 42_100_000,
        entries: [
          { path: "src/index.ts", name: "index.ts", isDirectory: false, uncompressedSize: 1420, compressedSize: 600, crc32: "A1B2C3D4", modifiedMs: Date.now() - 3_600_000 },
          { path: "README.md", name: "README.md", isDirectory: false, uncompressedSize: 2500, compressedSize: 1100, crc32: "E5F67890", modifiedMs: Date.now() - 7_200_000 },
          { path: "assets/logo.png", name: "logo.png", isDirectory: false, uncompressedSize: 45000, compressedSize: 42000, crc32: "11223344", modifiedMs: Date.now() - 86_400_000 },
          { path: "package.json", name: "package.json", isDirectory: false, uncompressedSize: 1850, compressedSize: 820, crc32: "55667788", modifiedMs: Date.now() - 14_400_000 },
          { path: "dist/", name: "dist", isDirectory: true, uncompressedSize: 0, compressedSize: 0, crc32: "00000000", modifiedMs: Date.now() - 1_800_000 },
        ],
      } as unknown as T;

    case "tools_mesh_get_peers":
      return [
        {
          deviceId: "peer-mac-air",
          deviceName: "Alex's MacBook Air",
          os: "macOS 15 (Sonoma)",
          ipAddress: "192.168.1.34",
          tcpPort: 54321,
          lastSeenMs: Date.now() - 2_000,
        },
      ] as unknown as T;

    case "tools_flat_branch":
      return {
        root: normPath,
        totalFiles: 13,
        totalDirectories: 5,
        totalBytes: 24_500_000,
        elapsedMs: 6,
        truncated: false,
        entries: [],
      } as unknown as T;

    case "tools_terminal_start":
      terminalReadCount = 0;
      return {
        sessionId: "mock-session-1",
        shell: "powershell",
        cwd: normPath,
      } as unknown as T;

    case "tools_terminal_read": {
      const output = terminalReadCount++ === 0 ? "PS D:\\code\\Main_projects\\NexusExplorer> " : "";
      return {
        output,
        closed: false,
      } as unknown as T;
    }

    case "tools_rename_preview": {
      const paths = (args?.paths as string[]) || [];
      const find = (args?.find as string) || null;
      const replace = (args?.replace as string) || "";
      const template = (args?.template as string) || null;
      const caseStyle = (args?.case as string) || "none";

      const plan: RenamePlanItem[] = paths.map((origPath, idx) => {
        const lastSlash = Math.max(origPath.lastIndexOf("\\"), origPath.lastIndexOf("/"));
        const parentDir = lastSlash >= 0 ? origPath.substring(0, lastSlash) : "D:\\code\\Main_projects\\NexusExplorer";
        const originalName = lastSlash >= 0 ? origPath.substring(lastSlash + 1) : origPath;

        const lastDot = originalName.lastIndexOf(".");
        const hasExt = lastDot > 0;
        const ext = hasExt ? originalName.substring(lastDot + 1) : "";
        const baseName = hasExt ? originalName.substring(0, lastDot) : originalName;

        let targetBase = baseName;

        if (template) {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10);
          const yearStr = String(now.getFullYear());
          const monthStr = String(now.getMonth() + 1).padStart(2, "0");
          const dayStr = String(now.getDate()).padStart(2, "0");
          const folderName = parentDir.split(/[\\/]/).pop() || "";
          
          targetBase = template
            .replace(/[\{<]name[\}>]/gi, baseName)
            .replace(/[\{<]ext[\}>]/gi, ext)
            .replace(/[\{<]date[\}>]/gi, dateStr)
            .replace(/[\{<]year[\}>]/gi, yearStr)
            .replace(/[\{<]month[\}>]/gi, monthStr)
            .replace(/[\{<]day[\}>]/gi, dayStr)
            .replace(/[\{<]folder[\}>]/gi, folderName)
            .replace(/\{[in]\}/gi, String(idx + 1).padStart(2, "0"))
            .replace(/<counter(?::(\d+))?>/gi, (_, digits) => {
              const width = digits ? digits.length : 2;
              return String(idx + 1).padStart(width, "0");
            });
        } else if (find) {
          try {
            targetBase = baseName.replaceAll(find, replace);
          } catch {
            targetBase = baseName.split(find).join(replace);
          }
        } else if (replace) {
          targetBase = baseName + replace;
        }

        if (caseStyle === "lowercase") {
          targetBase = targetBase.toLowerCase();
        } else if (caseStyle === "uppercase") {
          targetBase = targetBase.toUpperCase();
        } else if (caseStyle === "titleCase") {
          targetBase = targetBase.replace(/\b\w/g, (c) => c.toUpperCase());
        } else if (caseStyle === "camelCase") {
          targetBase = targetBase
            .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
            .replace(/^(\w)/, (c) => c.toLowerCase());
        } else if (caseStyle === "pascalCase") {
          targetBase = targetBase
            .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
            .replace(/^(\w)/, (c) => c.toUpperCase());
        } else if (caseStyle === "snakeCase") {
          targetBase = targetBase
            .replace(/([a-z])([A-Z])/g, "$1_$2")
            .replace(/[\s-]+/g, "_")
            .toLowerCase();
        } else if (caseStyle === "kebabCase") {
          targetBase = targetBase
            .replace(/([a-z])([A-Z])/g, "$1-$2")
            .replace(/[\s_]+/g, "-")
            .toLowerCase();
        }

        const newName = (!template || !template.toLowerCase().includes("{ext}")) && hasExt && !targetBase.includes(".")
          ? `${targetBase}.${ext}`
          : targetBase;

        const isChanged = newName !== originalName;
        let isValid = true;
        let errorMessage = "";

        if (!newName.trim()) {
          isValid = false;
          errorMessage = "Filename cannot be empty";
        } else if (/[<>:"/\\|?*]/.test(newName)) {
          isValid = false;
          errorMessage = "Contains invalid characters (<>:\"/|?*)";
        }

        const newPath = `${parentDir}\\${newName}`;

        return {
          originalPath: origPath,
          originalName,
          newName,
          newPath,
          isValid,
          errorMessage,
          isChanged,
        };
      });

      return plan as unknown as T;
    }

    case "tools_rename_execute": {
      const plan = (args?.plan as RenamePlanItem[]) || [];
      const tx: RenameTransaction = {
        timestampUnix: Math.floor(Date.now() / 1000),
        items: plan.map((p) => [p.originalPath, p.newPath]),
      };
      mockUndoStack.push({
        label: `Batch Rename (${plan.length} item${plan.length > 1 ? "s" : ""})`,
        undo: () => {},
        redo: () => {},
      });
      mockRedoStack.length = 0;
      return tx as unknown as T;
    }

    case "tools_rename_rollback":
      return 1 as unknown as T;

    case "tools_list_smart_folders":
      return [
        {
          id: "sf-ts-source",
          name: "TypeScript Source",
          root: "D:\\code\\Main_projects\\NexusExplorer",
          query: "ts",
          isRegex: false,
          caseSensitive: false,
          extensions: ["ts", "tsx"],
          includeDirectories: false,
          createdMs: Date.now() - 86_400_000 * 2,
        },
        {
          id: "sf-config-docs",
          name: "Configuration & Documentation",
          root: "D:\\code\\Main_projects\\NexusExplorer",
          query: "config",
          isRegex: false,
          caseSensitive: false,
          extensions: ["json", "toml", "md"],
          includeDirectories: false,
          createdMs: Date.now() - 86_400_000 * 5,
        },
      ] as unknown as T;

    case "tools_save_smart_folder":
    case "tools_delete_smart_folder":
      return [] as unknown as T;

    case "tools_run_smart_folder": {
      const folder = (args?.folder as SmartFolder) || {
        id: "sf-default",
        name: "Mock Smart Folder",
        root: "D:\\code\\Main_projects\\NexusExplorer",
        query: "",
        isRegex: false,
        caseSensitive: false,
        extensions: [],
        includeDirectories: false,
        createdMs: Date.now(),
      };
      const maxResults = typeof args?.maxResults === "number" ? args.maxResults : 100;
      const allEntries = generateMockEntries(folder.root || "D:\\code\\Main_projects\\NexusExplorer");

      let filtered = allEntries;
      if (!folder.includeDirectories) {
        filtered = filtered.filter((e) => !e.isDir);
      }
      if (folder.extensions && folder.extensions.length > 0) {
        filtered = filtered.filter((e) => folder.extensions.includes(e.ext.toLowerCase()));
      }
      if (folder.query) {
        const q = folder.query.toLowerCase();
        filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
      }

      if (filtered.length === 0) {
        filtered = allEntries.slice(0, 3);
      }

      const truncated = filtered.length > maxResults;
      const entries = truncated ? filtered.slice(0, maxResults) : filtered;

      const result: SmartFolderResult = {
        folder,
        entries,
        total: filtered.length,
        truncated,
        elapsedMs: 8,
      };
      return result as unknown as T;
    }

    case "tools_git_file_blame": {
      const relPath = String(args?.relPath || "src/App.tsx");
      const baseName = relPath.split(/[\\/]/).pop() || "file.ts";
      const now = Date.now();
      const blameRecords: GitBlameLine[] = [
        {
          lineNumber: 1,
          commitHash: "7b4c1e2a9d8f3065e1284a56c2d1e0f9b8a7c6d5",
          shortHash: "7b4c1e2",
          authorName: "Nexus Lead Architect",
          authorEmail: "dev@nexus-explorer.org",
          timestampMs: now - 86_400_000 * 7,
          summary: `feat: initialize ${baseName} structure`,
          lineContent: `// NexusExplorer 2027+ - ${baseName}`,
        },
        {
          lineNumber: 2,
          commitHash: "7b4c1e2a9d8f3065e1284a56c2d1e0f9b8a7c6d5",
          shortHash: "7b4c1e2",
          authorName: "Nexus Lead Architect",
          authorEmail: "dev@nexus-explorer.org",
          timestampMs: now - 86_400_000 * 7,
          summary: `feat: initialize ${baseName} structure`,
          lineContent: `import React, { useMemo, useState } from "react";`,
        },
        {
          lineNumber: 3,
          commitHash: "a9d8f3065e1284a56c2d1e0f9b8a7c6d57b4c1e2",
          shortHash: "a9d8f30",
          authorName: "Nexus UI Specialist",
          authorEmail: "ui@nexus-explorer.org",
          timestampMs: now - 86_400_000 * 4,
          summary: "refactor: optimize reactivity and theme tokens",
          lineContent: `import { useAppStore } from "@/state/store";`,
        },
        {
          lineNumber: 4,
          commitHash: "a9d8f3065e1284a56c2d1e0f9b8a7c6d57b4c1e2",
          shortHash: "a9d8f30",
          authorName: "Nexus UI Specialist",
          authorEmail: "ui@nexus-explorer.org",
          timestampMs: now - 86_400_000 * 4,
          summary: "refactor: optimize reactivity and theme tokens",
          lineContent: ``,
        },
        {
          lineNumber: 5,
          commitHash: "e1284a56c2d1e0f9b8a7c6d57b4c1e2a9d8f3065",
          shortHash: "e1284a5",
          authorName: "Nexus Core Maintainer",
          authorEmail: "core@nexus-explorer.org",
          timestampMs: now - 86_400_000 * 2,
          summary: "perf: add hardware acceleration and smooth transitions",
          lineContent: `export function renderViewComponent() {`,
        },
        {
          lineNumber: 6,
          commitHash: "e1284a56c2d1e0f9b8a7c6d57b4c1e2a9d8f3065",
          shortHash: "e1284a5",
          authorName: "Nexus Core Maintainer",
          authorEmail: "core@nexus-explorer.org",
          timestampMs: now - 86_400_000 * 2,
          summary: "perf: add hardware acceleration and smooth transitions",
          lineContent: `  const theme = useAppStore((s) => s.settings.theme);`,
        },
        {
          lineNumber: 7,
          commitHash: "3065e1284a56c2d1e0f9b8a7c6d57b4c1e2a9d8f",
          shortHash: "3065e12",
          authorName: "Nexus Lead Architect",
          authorEmail: "dev@nexus-explorer.org",
          timestampMs: now - 3_600_000 * 8,
          summary: "fix: prevent unnecessary render cycles",
          lineContent: `  return <div data-component="${baseName}" className="view-root" />;`,
        },
        {
          lineNumber: 8,
          commitHash: "3065e1284a56c2d1e0f9b8a7c6d57b4c1e2a9d8f",
          shortHash: "3065e12",
          authorName: "Nexus Lead Architect",
          authorEmail: "dev@nexus-explorer.org",
          timestampMs: now - 3_600_000 * 8,
          summary: "fix: prevent unnecessary render cycles",
          lineContent: `}`,
        },
      ];
      return blameRecords as unknown as T;
    }

    case "tools_janitor_clean":
      return {
        cleanedTargets: 5,
        reclaimedBytes: 104_857_600,
        cleanedPaths: ["D:\\temp\\cache", "D:\\code\\target"],
        elapsedMs: 42,
      } as unknown as T;

    case "tools_mounter_mount":
      return {
        driveLetter: "Z:",
        mountPoint: "Z:\\",
        source: String(args?.path || "image.iso"),
        readOnly: true,
      } as unknown as T;

    case "tools_metadata_read":
      return {
        title: "Nexus Document",
        artist: "Nexus Explorer",
        duration: 180,
        dimensions: { width: 1920, height: 1080 },
        format: "mp4",
      } as unknown as T;

    case "tools_list_all_tags":
      return [] as unknown as T;

    case "tools_assign_tag":
    case "tools_remove_tag":
      return undefined as unknown as T;

    case "tools_plugins_list":
    case "tools_plugins_set_enabled":
      return [] as unknown as T;

    case "tools_plugins_create_sample":
      return {
        pluginDir: "D:\\code\\Main_projects\\NexusExplorer\\.nexus\\plugins\\sample",
        manifestPath: "D:\\code\\Main_projects\\NexusExplorer\\.nexus\\plugins\\sample\\plugin.json",
        sampleScriptPath: "D:\\code\\Main_projects\\NexusExplorer\\.nexus\\plugins\\sample\\main.js",
      } as unknown as T;

    case "tools_get_note":
      return null as unknown as T;

    case "tools_set_note":
    case "tools_delete_note":
      return undefined as unknown as T;
    case "create_folder": {
      const parent = String(args?.parent || "D:\\code");
      const name = String(args?.name || "New folder");
      const entry: FileEntry = {
        name,
        path: `${parent}\\${name}`,
        parentPath: parent,
        isDir: true,
        size: 0,
        modifiedMs: Date.now(),
        createdMs: Date.now(),
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext: "",
      };
      addMockEntryToParent(parent, entry);
      return entry as unknown as T;
    }

    case "create_file": {
      const parent = String(args?.parent || "D:\\code");
      const name = String(args?.name || "New file.txt");
      const ext = name.includes(".") ? name.split(".").pop() || "" : "";
      const entry: FileEntry = {
        name,
        path: `${parent}\\${name}`,
        parentPath: parent,
        isDir: false,
        size: 0,
        modifiedMs: Date.now(),
        createdMs: Date.now(),
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext,
      };
      addMockEntryToParent(parent, entry);
      return entry as unknown as T;
    }

    case "rename_entry": {
      const oldPath = String(args?.path || "");
      const newName = String(args?.newName || "renamed");
      const updated = renameMockPath(oldPath, newName);
      if (updated) return updated as unknown as T;
      const parent = oldPath.split(/[\\\/]/).slice(0, -1).join("\\") || "D:\\code";
      return {
        name: newName,
        path: `${parent}\\${newName}`,
        parentPath: parent,
        isDir: false,
        size: 1024,
        modifiedMs: Date.now(),
        createdMs: Date.now() - 86400000,
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext: newName.includes(".") ? newName.split(".").pop() || "" : "",
      } as unknown as T;
    }

    case "delete_entries": {
      const paths = (args?.paths as string[]) || [];
      deleteMockPaths(paths);
      return "mock-delete-task" as unknown as T;
    }

    case "entry_properties": {
      const entry = (args?.path ? generateMockEntries(String(args.path).split(/[\\\/]/).slice(0, -1).join("\\") || "D:\\")[0] : null) || {
        name: "document.pdf",
        path: normPath,
        parentPath: "D:\\code",
        isDir: false,
        size: 2457600,
        modifiedMs: Date.now() - 3600000,
        createdMs: Date.now() - 86400000,
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext: "pdf",
      };
      return {
        entry,
        readonly: false,
        hidden: false,
        system: false,
        archive: true,
        attributes: 32,
        linkTarget: null,
        files: entry.isDir ? 42 : null,
        folders: entry.isDir ? 6 : null,
        totalSize: entry.size,
      } as unknown as T;
    }

    case "tools_list_ads":
      return [
        {
          filePath: normPath,
          streamFullName: `${normPath}:Zone.Identifier:$DATA`,
          streamName: "Zone.Identifier",
          streamType: "$DATA",
          sizeBytes: 84,
          isZoneIdentifier: true,
          contentPreview: "[ZoneTransfer]\nZoneId=3\nReferrerUrl=https://github.com/",
        },
      ] as unknown as T;

    case "tools_unblock_file":
    case "tools_delete_ads":
      return true as unknown as T;

    case "tools_terminate_process":
      if (args?.pid) mockTerminatedPids.add(Number(args.pid));
      return true as unknown as T;

    case "tools_get_link_info":
      return {
        path: normPath,
        name: normPath.split(/[\\\/]/).pop() || normPath,
        linkType: "junction",
        targetPath: "D:\\code\\Main_projects\\target",
        isBroken: false,
        isDirectory: true,
        hardlinkCount: 1,
      } as unknown as T;

    case "tools_create_link":
    case "tools_remove_link":
    case "tools_set_timestamps":
    case "tools_set_attributes":
    case "open_path":
    case "open_terminal":
    case "reveal_in_shell":
    case "watch_dir":
    case "unwatch_dir":
    case "cancel_scan":
    case "cancel_folder_size":
    case "cancel_search":
    case "resolve_conflict":
    case "tools_mesh_start":
    case "tools_metadata_set_id3":
    case "tools_sftp_save_profile":
    case "tools_sftp_delete_profile":
    case "tools_terminal_write":
    case "tools_terminal_close":
    case "tools_vdfs_add_node":
    case "tools_webdrop_stop":
    case "tools_mounter_unmount":
      return undefined as unknown as T;

    case "tools_get_timestamps":
      return {
        path: normPath,
        filename: normPath.split(/[\\\/]/).pop() || normPath,
        createdMs: Date.now() - 86400000,
        modifiedMs: Date.now() - 3600000,
        accessedMs: Date.now(),
        attributes: 32,
        isReadonly: false,
        isHidden: false,
        isSystem: false,
        isArchive: true,
      } as unknown as T;

    case "tools_split_file":
      return {
        partsCreated: [`${normPath}.part001`, `${normPath}.part002`],
        manifestPath: `${normPath}.manifest.json`,
        elapsedMs: 24,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      } as unknown as T;

    case "tools_join_files":
      return {
        outputPath: normPath.replace(/\.manifest\.json$/, ""),
        totalBytes: 10485760,
        hashVerified: true,
        elapsedMs: 18,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      } as unknown as T;

    case "tools_search_content":
      return {
        totalMatches: 3,
        filesSearched: 128,
        matches: [
          {
            path: "D:\\code\\Main_projects\\NexusExplorer\\src\\App.tsx",
            lineNumber: 45,
            lineContent: "export default function App() {",
            matchStart: 24,
            matchEnd: 27,
          },
          {
            path: "D:\\code\\Main_projects\\NexusExplorer\\src\\state\\store.ts",
            lineNumber: 102,
            lineContent: "export const useAppStore = create<AppState>()(...)",
            matchStart: 13,
            matchEnd: 24,
          },
        ],
        elapsedMs: 32,
      } as unknown as T;

    case "tools_scaffold_catalog":
      return {
        templates: [
          { id: "react_ts", name: "React 19 + TypeScript + Vite", description: "Modern React with Vite, Lucide icons, Zustand state", category: "frontend" },
          { id: "rust_cli", name: "Rust High-Performance CLI", description: "Clap v4, Tokio async runtime, anyhow error handling", category: "backend" },
          { id: "tauri_app", name: "Tauri v2 Desktop App", description: "Full desktop application with Rust core and React webview", category: "desktop" },
        ],
        presets: [
          { id: "fullstack", name: "Enterprise Full-Stack Suite", description: "Frontend, Rust core engine, and CLI binary", templateIds: ["react_ts", "rust_cli"] },
        ],
      } as unknown as T;

    case "tools_batch_scaffold":
      return {
        success: true,
        createdFiles: ["package.json", "tsconfig.json", "src/App.tsx", "src/main.tsx"],
        createdDirs: ["src", "public", "tests"],
        elapsedMs: 42,
        message: "Successfully scaffolded project preset.",
      } as unknown as T;

    case "tools_usn_query":
      return {
        volume: "D:",
        journalId: 109283948572,
        lowestValidUsn: 1048576,
        nextUsn: 2097152,
        maximumUsn: 999999999999,
        maximumSize: 33554432,
        allocationDelta: 4194304,
      } as unknown as T;

    case "tools_usn_records":
      return {
        volume: "D:",
        nextUsn: 2097200,
        records: [
          {
            usn: 2097152,
            fileId: 4096,
            parentFileId: 1024,
            reason: "DATA_OVERWRITE | CLOSE",
            fileName: "ipc.ts",
            timestampMs: Date.now() - 60000,
          },
          {
            usn: 2097180,
            fileId: 4098,
            parentFileId: 1024,
            reason: "FILE_CREATE | CLOSE",
            fileName: "mockBackend.test.ts",
            timestampMs: Date.now() - 30000,
          },
        ],
      } as unknown as T;

    case "tools_archive_list":
      return {
        archivePath: normPath,
        format: "zip",
        totalEntries: 4,
        totalFiles: 3,
        totalDirectories: 1,
        uncompressedBytes: 4194304,
        compressedBytes: 1572864,
        entries: [
          { path: "bundle/", name: "bundle", isDirectory: true, uncompressedSize: 0, compressedSize: 0, crc32: "00000000", modifiedMs: Date.now() - 3600000 },
          { path: "bundle/app.exe", name: "app.exe", isDirectory: false, uncompressedSize: 3145728, compressedSize: 1048576, crc32: "AABBCCDD", modifiedMs: Date.now() - 3600000 },
          { path: "bundle/config.json", name: "config.json", isDirectory: false, uncompressedSize: 1048576, compressedSize: 524288, crc32: "11223344", modifiedMs: Date.now() - 3600000 },
        ],
      } as unknown as T;

    case "tools_archive_extract":
    case "tools_archive_create":
    case "tools_archive_extract_any":
    case "tools_archive_create_any":
      return {
        success: true,
        filesProcessed: 3,
        totalBytes: 4194304,
        elapsedMs: 45,
        message: "Archive operation completed successfully.",
      } as unknown as T;

    case "tools_archive_find_7z":
      return "C:\\Program Files\\7-Zip\\7z.exe" as unknown as T;

    case "tools_par2_inspect":
      return {
        filePath: normPath,
        isValid: true,
        recoverySetId: "4A7B9C2E",
        sliceSize: 262144,
        totalDataFiles: 1,
        totalDataSlices: 40,
        recoverySlicesAvailable: 8,
        protectedFiles: [
          { id: "0", name: "backup.iso", sizeBytes: 10485760, hash: "e3b0c442" },
        ],
        packets: [
          { packetType: "MainPacket", sizeBytes: 72 },
          { packetType: "RecoverySlice", sizeBytes: 262208 },
        ],
        error: null,
      } as unknown as T;

    case "tools_git_diff":
      return {
        filePath: normPath,
        isBinary: false,
        additions: 12,
        deletions: 4,
        lines: [
          { kind: "context", content: " import { ipc } from '@/lib/ipc';", oldLineNumber: 1, newLineNumber: 1 },
          { kind: "delete", content: "-const legacy = false;", oldLineNumber: 2, newLineNumber: null },
          { kind: "add", content: "+const nexus2027 = true;", oldLineNumber: null, newLineNumber: 2 },
          { kind: "add", content: "+const highThroughput = true;", oldLineNumber: null, newLineNumber: 3 },
          { kind: "context", content: " export function run() {", oldLineNumber: 3, newLineNumber: 4 },
        ],
      } as unknown as T;

    case "tools_git_action":
      return "Git operation completed successfully." as unknown as T;

    case "tools_git_file_history":
      return [
        {
          hash: "a1b2c3d4e5f67890123456789abcdef012345678",
          shortHash: "a1b2c3d",
          authorName: "Nexus Developer",
          authorEmail: "dev@nexus.io",
          timestampMs: Date.now() - 3600000,
          message: "feat: full 2027+ architecture verified",
        },
        {
          hash: "f9e8d7c6b5a43210987654321fedcba098765432",
          shortHash: "f9e8d7c",
          authorName: "Nexus Architect",
          authorEmail: "architect@nexus.io",
          timestampMs: Date.now() - 86400000,
          message: "feat: add ReFS CoW block cloning and forensic tools",
        },
      ] as unknown as T;

    case "tools_vault_encrypt_file":
    case "tools_vault_decrypt_file":
    case "tools_vault_encrypt_dir":
    case "tools_vault_decrypt_dir":
      return {
        success: true,
        vaultPath: normPath.endsWith(".nxvault") ? normPath : `${normPath}.nxvault`,
        filesCount: 5,
        totalBytes: 5242880,
        elapsedMs: 65,
        message: "Vault cryptographic operation completed successfully (AES-256-GCM).",
      } as unknown as T;

    case "tools_get_tags_for_path":
      return [
        { id: "tag-1", name: "High Priority", color: "#ef4444", paths: [normPath] },
        { id: "tag-2", name: "2027 Release", color: "#10b981", paths: [normPath] },
      ] as unknown as T;

    case "tools_analyze_treemap":
      return {
        rootPath: normPath,
        totalBytes: 15728640,
        fileCount: 42,
        dirCount: 8,
        elapsedMs: 25,
        root: {
          path: normPath,
          name: normPath.split(/[\\\/]/).pop() || normPath,
          sizeBytes: 15728640,
          isDir: true,
          ext: "",
          x: 0,
          y: 0,
          w: 800,
          h: 600,
          color: "#6366f1",
          children: [
            {
              path: `${normPath}\\crates`,
              name: "crates",
              sizeBytes: 8388608,
              isDir: true,
              ext: "",
              x: 0,
              y: 0,
              w: 500,
              h: 600,
              color: "#3b82f6",
              children: [],
            },
            {
              path: `${normPath}\\src`,
              name: "src",
              sizeBytes: 4194304,
              isDir: true,
              ext: "",
              x: 500,
              y: 0,
              w: 300,
              h: 350,
              color: "#10b981",
              children: [],
            },
            {
              path: `${normPath}\\assets`,
              name: "assets",
              sizeBytes: 3145728,
              isDir: true,
              ext: "",
              x: 500,
              y: 350,
              w: 300,
              h: 250,
              color: "#f59e0b",
              children: [],
            },
          ],
        },
      } as unknown as T;

    case "tools_summarize_document":
      return {
        filePath: normPath,
        totalWords: 1420,
        totalLines: 185,
        totalChars: 9850,
        readingTimeSeconds: 340,
        summaryBullets: [
          "NexusExplorer hybrid architecture combines high-performance Rust core with React 19 frontend.",
          "Full support for ReFS Copy-on-Write block cloning, instant zero-byte file duplicates.",
          "Forensic suite includes NTFS Alternate Data Streams, Process Unlocker, DoD shredder, and USN Journal.",
          "Frontier 2027 features include AI Copilot, Dev Drive acceleration, and local P2P Mesh sharing.",
        ],
        keyTopics: ["Rust Core", "ReFS CoW", "Forensics", "AI Copilot", "Tauri v2"],
        outline: [
          { title: "Architecture Overview", level: 1, lineNumber: 5 },
          { title: "Storage Engine & CoW", level: 2, lineNumber: 42 },
          { title: "Forensic Toolkit", level: 2, lineNumber: 89 },
          { title: "2027 Frontier Innovations", level: 1, lineNumber: 130 },
        ],
        detectedType: "Markdown Documentation",
      } as unknown as T;

    case "tools_semantic_index":
      return {
        indexedFilesCount: 24,
        totalChunks: 96,
        elapsedMs: 140,
        message: "Semantic vector indexing complete.",
      } as unknown as T;

    case "tools_semantic_search":
      return [
        {
          path: "D:\\code\\Main_projects\\NexusExplorer\\src\\lib\\ipc.ts",
          similarityScore: 0.94,
          snippet: "Typed IPC façade over the Rust commands with safe dual-runtime dispatching.",
        },
        {
          path: "D:\\code\\Main_projects\\NexusExplorer\\crates\\nexus-core\\src\\fs\\cow.rs",
          similarityScore: 0.88,
          snippet: "Copy-on-Write block cloning via FSCTL_DUPLICATE_EXTENTS_TO_FILE for ReFS Dev Drives.",
        },
      ] as unknown as T;

    case "tools_mesh_send_files":
      return {
        transferId: "mesh-" + Date.now(),
        peerId: "peer-01",
        filesSent: 2,
        totalBytes: 5242880,
        elapsedMs: 85,
        status: "completed",
      } as unknown as T;

    case "tools_vss_restore":
      return 1 as unknown as T;

    case "tools_bitlocker_unlock":
    case "tools_bitlocker_lock":
      return "BitLocker status changed successfully." as unknown as T;

    case "tools_provenance_record":
      return {
        eventId: "prov-" + Date.now(),
        path: normPath,
        action: "audit_verification",
        timestampMs: Date.now(),
        sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signatureVerified: true,
      } as unknown as T;

    case "tools_ocr_image":
      return {
        imagePath: normPath,
        extractedText: "NEXUS EXPLORER 2027+\\nHigh-Performance Forensic File Manager\\nAll Systems Operational",
        lines: [
          { text: "NEXUS EXPLORER 2027+", confidence: 0.99, boundingBox: { x: 10, y: 10, width: 200, height: 24 } },
          { text: "High-Performance Forensic File Manager", confidence: 0.97, boundingBox: { x: 10, y: 38, width: 320, height: 18 } },
        ],
        engine: "Tesseract OCR v5 / Windows Vision",
        language: "eng",
      } as unknown as T;

    case "tools_sftp_list_profiles":
      return [
        {
          id: "sftp-1",
          name: "Production Linux Cluster",
          host: "192.168.1.150",
          port: 22,
          username: "nexus-admin",
          authType: "key",
          privateKeyPath: "C:\\Users\\Developer\\.ssh\\id_ed25519",
          remotePath: "/var/www/nexus",
        },
      ] as unknown as T;

    case "tools_sftp_list_directory":
      return [
        { name: "src", isDir: true, size: 0, permissions: "drwxr-xr-x", owner: "root", modified: "Oct 31 12:00" },
        { name: "docker-compose.yml", isDir: false, size: 1024, permissions: "-rw-r--r--", owner: "root", modified: "Oct 30 18:30" },
        { name: "README.md", isDir: false, size: 2048, permissions: "-rw-r--r--", owner: "root", modified: "Oct 29 09:15" },
      ] as unknown as T;

    case "tools_find_duplicates":
      return {
        root: normPath,
        scannedFiles: 85,
        groups: [
          {
            hash: "xxh3-9a8b7c6d5e",
            size: 1048576,
            entries: [
              {
                name: "backup_copy.iso",
                path: `${normPath}\\backup_copy.iso`,
                parentPath: normPath,
                isDir: false,
                size: 1048576,
                modifiedMs: Date.now() - 86400000,
                createdMs: Date.now() - 172800000,
                isHidden: false,
                isSystem: false,
                isReadonly: false,
                ext: "iso",
              },
              {
                name: "backup_archive.iso",
                path: `${normPath}\\backup_archive.iso`,
                parentPath: normPath,
                isDir: false,
                size: 1048576,
                modifiedMs: Date.now() - 86400000,
                createdMs: Date.now() - 172800000,
                isHidden: false,
                isSystem: false,
                isReadonly: false,
                ext: "iso",
              },
            ],
          },
        ],
        totalGroups: 1,
        duplicateFiles: 2,
        reclaimableBytes: 1048576,
        elapsedMs: 22,
      } as unknown as T;

    case "tools_hash_create_manifest":
      return {
        manifestPath: `${normPath}\\manifest.sha256`,
        algorithm: "sha256",
        entries: 12,
        totalBytes: 5242880,
        elapsedMs: 19,
      } as unknown as T;

    case "tools_hash_verify_manifest":
      return {
        manifestPath: normPath,
        algorithm: "sha256",
        total: 12,
        matched: 12,
        mismatched: 0,
        missing: 0,
        items: [
          { path: "Cargo.toml", expectedHash: "e3b0c442", actualHash: "e3b0c442", status: "match" },
        ],
        elapsedMs: 15,
      } as unknown as T;

    case "tools_optimize_images":
      return {
        results: [
          {
            sourcePath: `${normPath}\\banner.png`,
            targetPath: `${normPath}\\banner.webp`,
            originalBytes: 1048576,
            optimizedBytes: 314572,
            savedBytes: 734004,
            savingsPercent: 70,
          },
        ],
        errors: [],
        totalInputBytes: 1048576,
        totalOutputBytes: 314572,
        totalSavedBytes: 734004,
        savingsPercent: 70,
      } as unknown as T;

    case "tools_plugins_execute":
      return {
        pluginId: "custom-utility",
        success: true,
        output: "Plugin executed successfully with status 0.",
        durationMs: 38,
      } as unknown as T;

    case "tools_plugins_install":
      return {
        id: "sample-plugin",
        name: "Nexus Sample Plugin",
        version: "1.0.0",
        description: "Custom power-user extension for NexusExplorer",
        author: "Nexus Team",
        enabled: true,
        entryPoint: "main.js",
      } as unknown as T;

    case "tools_vdfs_index":
      return {
        indexedNodesCount: 15,
        totalCasBytes: 104857600,
        uniqueBlocks: 128,
        dedupRatio: 2.4,
        elapsedMs: 45,
      } as unknown as T;

    case "tools_webdrop_start":
      return {
        isRunning: true,
        port: 8080,
        localUrl: "http://192.168.1.150:8080/drop",
        activeConnections: 0,
        qrCodeSvg: '<svg width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="#ffffff"/><rect x="20" y="20" width="40" height="40" fill="#000000"/><rect x="120" y="20" width="40" height="40" fill="#000000"/><rect x="20" y="120" width="40" height="40" fill="#000000"/><rect x="80" y="80" width="20" height="20" fill="#000000"/></svg>',
      } as unknown as T;

    case "pause_job":
    case "resume_job":
    case "cancel_job":
      return {
        jobId: String(args?.jobId || "job-1"),
        kind: "copy",
        state: cmd === "pause_job" ? "paused" : cmd === "resume_job" ? "running" : "cancelled",
        totalFiles: 10,
        processedFiles: 5,
        totalBytes: 10485760,
        processedBytes: 5242880,
        speedBps: 524288000,
        etaSecs: 1,
        currentFile: "D:\\code\\large_asset.bin",
        conflictsPending: 0,
      } as unknown as T;

    case "get_active_jobs":
      return [] as unknown as T;
    case "write_text_file":
    case "write_hex_slice":
      return undefined as unknown as T;

    case "tools_nested_folder":
      return "D:\\code\\Main_projects\\NexusExplorer\\crates\\nexus-core" as unknown as T;

    case "tools_nested_file":
      return "D:\\code\\Main_projects\\NexusExplorer\\Cargo.toml" as unknown as T;

    default:
      if (cmd.endsWith("_list") || cmd.startsWith("list_") || cmd.includes("folders") || cmd.includes("tags") || cmd.includes("peers") || cmd.includes("profiles") || cmd.includes("history")) {
        return [] as unknown as T;
      }
      return undefined as unknown as T;
  }
}
