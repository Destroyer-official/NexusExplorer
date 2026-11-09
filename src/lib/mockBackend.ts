/** Intelligent browser mock backend for NexusExplorer when running in standard web browsers. */

import type {
  DriveInfo,
  FileEntry,
  FileAnnotation,
  KnownFolder,
  RenamePlanItem,
  RenameTransaction,
  SmartFolder,
  SmartFolderResult,
  GitBlameLine,
  UsbDeviceDetails,
  UsbLockingProcess,
  UsbFormatOptions,
  UsbDiskImageOptions,
  UsbSurfaceScanBlock,
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
    label: "Samsung T7 Shield 1TB",
    driveType: "removable",
    filesystem: "exFAT",
    freeBytes: 680_000_000_000,
    totalBytes: 1_000_000_000_000,
    isReady: true,
    isUsb: true,
    usbSpeed: "USB 3.2 Gen 2 (10 Gbps)",
    isDegradedPort: false,
  },
  {
    path: "wpd://Destroyer/Internal storage",
    label: "Destroyer (Internal storage)",
    driveType: "portable",
    filesystem: "MTP",
    freeBytes: 19_847_356_416,
    totalBytes: 113_256_693_760,
    isReady: true,
    isUsb: true,
    usbSpeed: "USB MTP (Hi-Speed)",
    isDegradedPort: false,
  },
  {
    path: "F:\\",
    label: "SanDisk Ultra 128GB",
    driveType: "removable",
    filesystem: "FAT32",
    freeBytes: 84_000_000_000,
    totalBytes: 124_000_000_000,
    isReady: true,
    isUsb: true,
    usbSpeed: "USB 2.0 HighSpeed (480 Mbps)",
    isDegradedPort: true,
  },
];

const MOCK_USB_DEVICES: UsbDeviceDetails[] = [
  {
    path: "E:\\",
    label: "Samsung T7 Shield 1TB",
    driveLetter: "E:",
    vendor: "Samsung",
    model: "Portable SSD T7 Shield",
    serialNumber: "S5TBNX0W819482X",
    vid: "04e8",
    pid: "61f5",
    usbProtocol: "UASP (USB Attached SCSI)",
    usbSpeed: "USB 3.2 Gen 2 (10 Gbps)",
    isDegradedPort: false,
    writeCachePolicy: "better_performance",
    filesystem: "exFAT",
    clusterSizeBytes: 131072,
    freeBytes: 680_000_000_000,
    totalBytes: 1_000_000_000_000,
    usedBytes: 320_000_000_000,
    isRemovable: true,
    smartHealthScore: 99,
    temperatureC: 38,
    smartStatus: "healthy",
    partitionScheme: "GPT",
    partitionsCount: 1,
    sustainedWriteMBps: 840,
    readMBps: 1050,
    isLocked: false,
    lockingProcessesCount: 0,
  },
  {
    path: "F:\\",
    label: "SanDisk Ultra 128GB",
    driveLetter: "F:",
    vendor: "SanDisk",
    model: "Ultra USB 3.0 Flash Drive",
    serialNumber: "4C530001230408119253",
    vid: "0781",
    pid: "5581",
    usbProtocol: "BOT (Bulk-Only Transport)",
    usbSpeed: "USB 2.0 HighSpeed (480 Mbps)",
    isDegradedPort: true,
    writeCachePolicy: "quick_removal",
    filesystem: "FAT32",
    clusterSizeBytes: 32768,
    freeBytes: 84_000_000_000,
    totalBytes: 124_000_000_000,
    usedBytes: 40_000_000_000,
    isRemovable: true,
    smartHealthScore: 92,
    temperatureC: 44,
    smartStatus: "healthy",
    partitionScheme: "MBR",
    partitionsCount: 1,
    sustainedWriteMBps: 22,
    readMBps: 38,
    isLocked: true,
    lockingProcessesCount: 2,
  },
];

let mockUsbList = [...MOCK_USB_DEVICES];
let mockUsbLocks: Record<string, UsbLockingProcess[]> = {
  "F:\\": [
    {
      pid: 14820,
      name: "excel.exe",
      windowTitle: "Quarterly_Audit_Report.xlsx - Microsoft Excel",
      lockedPath: "F:\\Quarterly_Audit_Report.xlsx",
      appType: "GUI Application",
      isSystem: false,
    },
    {
      pid: 6112,
      name: "SearchIndexer.exe",
      windowTitle: "Windows Search Indexer Service",
      lockedPath: "F:\\",
      appType: "Windows Service",
      isSystem: true,
    },
  ],
  "E:\\": [],
};

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
const mockNotesMap = new Map<string, FileAnnotation>();

export function getMockEntries(parent: string): FileEntry[] {
  const norm = parent.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  let list = mockDirMap.get(norm);
  if (!list) {
    list = generateMockEntries(parent);
    mockDirMap.set(norm, list);
  }
  return list.filter((e) => !mockDeletedSet.has(e.path.replace(/\//g, "\\").toLowerCase()));
}

export function calculateMockFolderStats(dirPath: string): { size: number; files: number; folders: number } {
  const norm = dirPath.replace(/\//g, "\\").replace(/\\+$/, "");
  const baseName = (norm.split(/[\/\\]/).pop() || "").toLowerCase();

  const knownStats: Record<string, { size: number; files: number; folders: number }> = {
    "nexus-core": { size: 18_432_000, files: 48, folders: 6 },
    "nexus-ffi": { size: 6_240_000, files: 18, folders: 3 },
    "nexus-indexer": { size: 34_120_000, files: 84, folders: 11 },
    "nexus-protocol": { size: 9_820_000, files: 29, folders: 4 },
    "crates": { size: 68_615_250, files: 181, folders: 24 },
    "src": { size: 1_840_000, files: 62, folders: 8 },
    "src-tauri": { size: 4_250_000, files: 36, folders: 5 },
    "components": { size: 480_000, files: 32, folders: 2 },
    "hooks": { size: 64_000, files: 6, folders: 0 },
    "lib": { size: 240_000, files: 12, folders: 0 },
    "state": { size: 128_000, files: 4, folders: 0 },
    "styles": { size: 96_000, files: 5, folders: 0 },
    "archive": { size: 48_600_000, files: 142, folders: 8 },
    "target": { size: 1_420_000_000, files: 8420, folders: 412 },
    "node_modules": { size: 176_400_000, files: 12840, folders: 940 },
    "dist": { size: 980_000, files: 4, folders: 1 },
    "public": { size: 240_000, files: 3, folders: 0 },
    "nexusexplorer": { size: 1_728_000_000, files: 21620, folders: 1398 },
    "nexus workspace": { size: 1_728_000_000, files: 21620, folders: 1398 },
    "main_projects": { size: 2_450_000_000, files: 32100, folders: 2100 },
    "desktop": { size: 3_057_400, files: 5, folders: 1 },
    "documents": { size: 3_594_500, files: 5, folders: 2 },
    "downloads": { size: 72_151_200, files: 12, folders: 4 },
    "pictures": { size: 6_535_000, files: 4, folders: 0 },
    "music": { size: 51_100_000, files: 3, folders: 0 },
    "videos": { size: 190_000_000, files: 2, folders: 0 },
  };

  if (knownStats[baseName]) {
    return knownStats[baseName];
  }

  // Calculate from dynamic mock entries
  const entries = getMockEntries(norm);
  let totalSize = 0;
  let totalFiles = 0;
  let totalFolders = 0;

  for (const entry of entries) {
    if (entry.isDir) {
      totalFolders += 1;
      const subName = entry.name.toLowerCase();
      if (knownStats[subName]) {
        totalSize += knownStats[subName].size;
        totalFiles += knownStats[subName].files;
        totalFolders += knownStats[subName].folders;
      } else {
        totalSize += 131072;
        totalFiles += 3;
      }
    } else {
      totalFiles += 1;
      totalSize += entry.size;
    }
  }

  if (totalSize === 0 && totalFiles === 0) {
    const hash = baseName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    totalFiles = (hash % 15) + 3;
    totalFolders = (hash % 3) + 1;
    totalSize = totalFiles * 64000;
  }

  return { size: totalSize, files: totalFiles, folders: totalFolders };
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
    const norm = p.replace(/\//g, "\\").toLowerCase();
    mockDeletedSet.add(norm);
    const parent = norm.split(/[\\\/]/).slice(0, -1).join("\\");
    if (parent) {
      const list = mockDirMap.get(parent);
      if (list) {
        mockDirMap.set(parent, list.filter((e) => e.path.replace(/\//g, "\\").toLowerCase() !== norm));
      }
    }
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
    if (lower.includes("internal storage") || lower.includes("destroyer")) {
      return [
        makeDir("Pictures", 1),
        makeDir("DCIM", 1),
        makeDir("Documents", 2),
        makeDir("Download", 3),
        makeDir("backup", 4),
        makeFile("output.txt", 21641, "txt", 1),
        makeFile("sphincs.py", 18871, "py", 2),
        makeFile("production_validation_final.py", 14215, "py", 3),
        makeFile("income.jpg", 282504, "jpg", 1),
        makeFile("cryptographic_errors.py", 22227, "py", 2),
      ];
    }

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

    // Main project workspace
    if (
      folderName === "nexusexplorer" ||
      folderName === "nexus workspace" ||
      lower.endsWith("main_projects\\nexusexplorer") ||
      lower.endsWith("main_projects/nexusexplorer")
    ) {
      return [
        makeDir("crates", 1),
        makeDir("src", 2),
        makeDir("src-tauri", 3),
        makeDir("target", 1),
        makeDir("node_modules", 12),
        makeDir("dist", 1),
        makeDir("public", 24),
        makeDir("archive", 4),
        makeFile("Cargo.lock", 139566, "lock", 2),
        makeFile("Cargo.toml", 340, "toml", 1),
        makeFile("package.json", 1149, "json", 1),
        makeFile("package-lock.json", 124096, "json", 1),
        makeFile("README.md", 7498, "md", 1),
        makeFile("index.html", 490, "html", 3),
        makeFile("architecture_2027.svg", 45000, "svg", 2),
        makeFile("release_bundle_v2.zip", 18454937, "zip", 12),
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
      } catch { }
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch { }
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
        } catch { }
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

    case "list_bookmarks": {
      const stored = localStorage.getItem("nexus_bookmarks_browser");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch { }
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

    case "tools_devdrive_migrate":
      return {
        ecosystem: (args?.ecosystem as string) || "Cargo",
        sourcePath: "C:\\Users\\Developer\\.cargo",
        targetPath: "D:\\packages\\CargoHome",
        junctionCreated: true,
        message: "Successfully created NTFS junction C:\\Users\\Developer\\.cargo -> D:\\packages\\CargoHome",
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

    case "tools_janitor_scan_empty":
      return {
        rootPath: (args?.root as string) || "D:\\temp",
        emptyDirs: [
          "D:\\temp\\old_build\\empty_sub",
          "D:\\temp\\old_build",
          "D:\\temp\\unused_logs",
        ],
        scannedDirs: 48,
        elapsedMs: 12,
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

    case "tools_copilot_plan": {
      const rawPrompt = String(args?.prompt || "");
      const p = rawPrompt.toLowerCase();
      const currentDir = String(args?.currentDir || "D:\\code\\Main_projects\\NexusExplorer");
      const words = p.split(/\s+/).filter(Boolean);

      // 1. Dynamic Action Classification
      let actionKind = "move_by_extension";
      let intentSummary = "Organize files into subfolders by extension";
      let explanation = "";
      let isDestructive = false;
      let confidence = 0.94;

      const isShred = p.includes("shred") || p.includes("wipe") || p.includes("secure delete") || p.includes("erase") || p.includes("purge") || p.includes("destroy");
      const isDedup = p.includes("dedup") || p.includes("duplicate file") || p.includes("duplicates") || p.includes("find duplicate") || p.includes("locate duplicate") || p.includes("same files") || p.includes("identical files");
      const isTag = p.includes("tag with") || p.includes("label as") || p.includes("mark with") || p.startsWith("tag ") || p.startsWith("label ");
      const isSearchWords = Boolean(words[0] && ["find", "search", "show", "locate", "list", "query", "filter", "display", "what", "which", "where", "how"].includes(words[0]));
      const isLargest = p.includes("largest") || p.includes("biggest") || p.includes("heaviest") || p.includes("most space") || p.includes("takes the most") || p.includes("large folder") || p.includes("large file");
      const explicitSearch = !isShred && !isDedup && !isTag && (isSearchWords || isLargest);

      if (explicitSearch) {
        actionKind = "search";
        intentSummary = isLargest ? "Locate largest item" : "Search and filter files matching criteria";
        confidence = 0.95;
      } else if (isShred) {
        actionKind = "shred";
        intentSummary = "Cryptographically wipe matched files";
        isDestructive = true;
        confidence = 0.96;
      } else if (isDedup) {
        actionKind = "deduplicate";
        intentSummary = "Identify identical content files via hash matching";
        confidence = 0.93;
      } else if (isTag) {
        actionKind = "tag";
        intentSummary = "Apply metadata tag to matched files";
        confidence = 0.89;
      } else if (words.includes("date") || words.includes("dates") || p.includes("by date") || p.includes("date taken") || p.includes("creation date") || p.includes("modified date") || p.includes("year") || p.includes("month") || p.includes("chronological") || p.includes("by modified") || p.includes("by creation")) {
        actionKind = "organize_by_date";
        intentSummary = "Organize files into Year/Month subdirectories";
        confidence = 0.92;
      } else if (p.includes("clone") || p.includes("cow") || p.includes("reflink") || p.includes("block clone") || p.includes("block cloning") || p.includes("copy on write") || p.includes("duplicate folder") || p.includes("duplicate directory")) {
        actionKind = "clone_cow";
        intentSummary = "Fast copy-on-write clone of items";
        confidence = 0.90;
      } else if (p.includes("flatten") || p.includes("un-nest") || p.includes("extract all files here") || p.includes("collapse hierarchy") || p.includes("collapse folder hierarchy")) {
        actionKind = "flatten_directory";
        intentSummary = "Flatten nested hierarchy into the folder root";
        confidence = 0.91;
      } else if (p.includes("zip") || p.includes("compress") || p.includes("archive") || p.includes("bundle") || words.includes("pack") || words.includes("tar") || p.includes(".tar")) {
        actionKind = "archive_zip";
        intentSummary = "Compress selected files into a ZIP archive";
        confidence = 0.95;
      } else if (p.includes("organize") || p.includes("by extension") || p.includes("by format") || p.includes("by file type") || p.includes("group by type") || p.includes("arrange by format") || p.includes("tidy") || p.includes("categorize files")) {
        actionKind = "move_by_extension";
        intentSummary = "Organize files into subfolders by extension";
        confidence = 0.94;
      } else {
        actionKind = "search";
        intentSummary = "Filter files matching query criteria";
        confidence = 0.85;
      }

      // 2. Dynamic Target Extensions & Semantic Categories
      let targetExtensions: string[] = [];
      if (p.includes("image") || p.includes("photo") || p.includes("picture")) {
        targetExtensions.push("png", "jpg", "jpeg", "webp", "svg", "gif");
      }
      if (p.includes("video") || p.includes("movie") || p.includes("clip")) {
        targetExtensions.push("mp4", "mkv", "mov", "avi");
      }
      if (p.includes("audio") || p.includes("music") || p.includes("sound")) {
        targetExtensions.push("mp3", "wav", "flac");
      }
      if (p.includes("doc") || p.includes("document") || p.includes("notes") || p.includes("pdf")) {
        targetExtensions.push("pdf", "docx", "txt", "md", "xlsx");
      }
      if (p.includes("markdown")) {
        targetExtensions = ["md"];
      }
      if (p.includes("code") || p.includes("source") || p.includes("script")) {
        targetExtensions.push("rs", "ts", "tsx", "js", "py", "json");
      }
      if (p.includes("log") || p.includes("temp") || p.includes("tmp")) {
        targetExtensions.push("log", "tmp", "bak");
      }

      for (const w of words) {
        if ((w.startsWith(".") || w.startsWith("*.")) && w.length > 1) {
          const ext = w.replace(/^[*.]+/, "").replace(/[^a-zA-Z0-9.]/g, "");
          if (ext && !targetExtensions.includes(ext)) {
            targetExtensions.push(ext);
            if (ext.includes(".")) {
              const term = ext.split(".").pop();
              if (term && !targetExtensions.includes(term)) targetExtensions.push(term);
            }
          }
        } else if (["pdf", "zip", "log", "tmp", "json", "txt", "csv", "md", "markdown", "rust", "rs", "typescript", "ts", "tsx", "python", "py", "golang", "go", "javascript", "js", "parquet", "arrow", "svg", "ico"].includes(w)) {
          // If destination container format (e.g. "archive ... to zip", "compress ... into zip"), don't treat "zip" as source extension
          if ((w === "zip" || w === "tar") && (actionKind === "archive_zip" || p.includes("to zip") || p.includes("into zip") || p.includes("into a zip") || p.includes("into archive") || p.includes("to archive"))) continue;
          const mapped = w === "markdown" ? "md"
            : w === "rust" ? "rs"
              : w === "typescript" ? "ts"
                : w === "python" ? "py"
                  : w === "golang" ? "go"
                    : w === "javascript" ? "js"
                      : w;
          targetExtensions = [mapped];
        }
      }

      // 3. Dynamic Size Bounds Extraction
      let minSize: number | null = null;
      let maxSize: number | null = null;
      const parseSize = (token: string): number | null => {
        const clean = token.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
        const m = clean.match(/^([\d.]+)(gb|g|mb|m|kb|k|b)?$/);
        if (!m) return null;
        const val = parseFloat(m[1]);
        if (isNaN(val)) return null;
        const unit = m[2] || "b";
        if (unit === "gb" || unit === "g") return val * 1024 * 1024 * 1024;
        if (unit === "mb" || unit === "m") return val * 1024 * 1024;
        if (unit === "kb" || unit === "k") return val * 1024;
        return val;
      };

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (["larger", "over", "above", "exceeding", "greater", "more", ">"].includes(w) && i + 1 < words.length) {
          const next = words[i + 1] === "than" ? words[i + 2] : words[i + 1];
          if (next) minSize = parseSize(next);
        } else if (["smaller", "under", "below", "less", "<"].includes(w) && i + 1 < words.length) {
          const next = words[i + 1] === "than" ? words[i + 2] : words[i + 1];
          if (next) maxSize = parseSize(next);
        }
      }

      // 4. Dynamic Candidate Matching Against Active Directory Entries
      const isFolderQuery = p.includes("folder") || p.includes("directory") || p.includes("directories") || p.includes("dir ") || p.includes("dirs");
      const isFileQuery = (p.includes("file") || p.includes("files")) && !isFolderQuery;
      const isLargestQuery = isLargest || p.includes("largest") || p.includes("biggest") || p.includes("heaviest") || p.includes("most space") || p.includes("takes the most");

      const allEntries = getMockEntries(currentDir).map((e) => {
        if (e.isDir) {
          const stats = calculateMockFolderStats(e.path);
          return { ...e, size: stats.size };
        }
        return e;
      });

      let candidatePool = allEntries;
      if (isFolderQuery) {
        candidatePool = allEntries.filter((e) => e.isDir);
      } else if (isFileQuery) {
        candidatePool = allEntries.filter((e) => !e.isDir);
      } else if (!isLargestQuery) {
        candidatePool = allEntries.filter((e) => !e.isDir);
      }

      let matched = candidatePool.filter((entry) => {
        if (!entry.isDir && targetExtensions.length > 0) {
          const entryExt = (entry.ext || entry.name.split(".").pop() || "").toLowerCase();
          if (!targetExtensions.includes(entryExt)) return false;
        }
        if (minSize !== null && entry.size < minSize) return false;
        if (maxSize !== null && entry.size > maxSize) return false;
        return true;
      });

      if (isLargestQuery) {
        matched.sort((a, b) => b.size - a.size);
        if (matched.length > 0) {
          const top = matched[0];
          actionKind = "search";
          confidence = 0.96;
          const targetType = top.isDir ? "folder" : "file";
          const formatted = top.size >= 1024 * 1024 * 1024
            ? `${(top.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
            : top.size >= 1024 * 1024
            ? `${(top.size / (1024 * 1024)).toFixed(1)} MB`
            : `${(top.size / 1024).toFixed(0)} KB`;
          intentSummary = `Identified largest ${targetType}: ${top.name} (${formatted})`;
          explanation = `Analyzed storage in ${currentDir}. The largest ${targetType} is '${top.name}' taking ${formatted}.`;
        }
      }

      const matchedCandidates = matched.map((e) => {
        const formattedSize = e.size >= 1024 * 1024 * 1024
          ? `${(e.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
          : e.size >= 1024 * 1024
          ? `${(e.size / (1024 * 1024)).toFixed(1)} MB`
          : e.size >= 1024
          ? `${(e.size / 1024).toFixed(1)} KB`
          : `${e.size} B`;
        return {
          path: e.path,
          name: e.name,
          isDir: e.isDir,
          size: e.size,
          formattedSize,
          ext: e.ext,
        };
      });

      const matchedFiles = matched.map((e) => e.path);
      const totalMatchedBytes = matched.reduce((acc, e) => acc + e.size, 0);

      // 5. Dynamic Safety Scoring (GRPO)
      const safetyScore = isDestructive ? 0.85 : 1.0;
      const warnings: string[] = [];
      if (isDestructive) {
        warnings.push("This operation permanently wipes candidate files beyond recovery.");
      }
      if (matchedFiles.length > 50) {
        warnings.push(`High impact: operation will modify ${matchedFiles.length} files.`);
      }

      if (!isLargestQuery) {
        if (targetExtensions.length > 0) {
          intentSummary += ` (.${targetExtensions.join(", .")})`;
        }
        if (minSize !== null) {
          intentSummary += ` > ${(minSize / 1024).toFixed(0)} KB`;
        }
        if (maxSize !== null) {
          intentSummary += ` < ${(maxSize / 1024).toFixed(0)} KB`;
        }
      }

      // Multi-Step Pipeline Formulation
      const steps: Array<{ stepNumber: number; actionKind: string; title: string; status: "pending" | "running" | "completed" | "failed" }> = [];
      const hasMultiStep = p.includes(" and then ") || p.includes(" then ") || p.includes(" after that ") || (p.includes(" and ") && (p.includes("shred") || p.includes("wipe") || p.includes("delete")) && (p.includes("zip") || p.includes("compress") || p.includes("archive") || p.includes("organize")));

      if (hasMultiStep) {
        if ((p.includes("zip") || p.includes("compress") || p.includes("archive")) && (p.includes("shred") || p.includes("wipe") || p.includes("delete"))) {
          steps.push({
            stepNumber: 1,
            actionKind: "archive_zip",
            title: `Compress ${matchedFiles.length} matched files into ZIP archive`,
            status: "pending",
          });
          steps.push({
            stepNumber: 2,
            actionKind: "shred",
            title: `Cryptographically wipe ${matchedFiles.length} original files`,
            status: "pending",
          });
        } else if (p.includes("clone") && p.includes("tag")) {
          steps.push({
            stepNumber: 1,
            actionKind: "clone_cow",
            title: `Fast copy-on-write clone of ${matchedFiles.length} items`,
            status: "pending",
          });
          steps.push({
            stepNumber: 2,
            actionKind: "tag",
            title: `Apply tag metadata to ${matchedFiles.length} items`,
            status: "pending",
          });
        } else if ((p.includes("largest") || p.includes("search") || p.includes("find")) && p.includes("organize")) {
          steps.push({
            stepNumber: 1,
            actionKind: "search",
            title: `Filter and rank ${matchedFiles.length} matching items`,
            status: "pending",
          });
          steps.push({
            stepNumber: 2,
            actionKind: "organize_by_extension",
            title: `Sort ${matchedFiles.length} items into subfolders by extension`,
            status: "pending",
          });
        }
      }

      if (steps.length === 0) {
        steps.push({
          stepNumber: 1,
          actionKind,
          title: intentSummary,
          status: "pending",
        });
      }

      return {
        planId: "mock-plan-" + Date.now(),
        rawPrompt,
        intentSummary,
        actionKind,
        confidence,
        isDestructive,
        requiresExplicitConfirm: isDestructive,
        safetyScore,
        warnings,
        targetPatterns: targetExtensions.length > 0 ? targetExtensions.map((e) => `*.${e}`) : ["*.*"],
        matchedFiles,
        matchedCandidates,
        totalMatchedBytes,
        explanation: explanation || `Neuro-symbolic intent verified against ${matchedFiles.length} matched items in ${currentDir}.`,
        createdAtMs: Date.now(),
        steps,
      } as unknown as T;
    }
    case "tools_copilot_execute": {
      const plan = args?.plan as { matchedFiles?: string[]; matchedCandidates?: Array<{ name: string; isDir?: boolean }>; intentSummary?: string; actionKind?: string; totalMatchedBytes?: number; steps?: Array<{ stepNumber: number; actionKind: string; title: string }> } | undefined;
      const count = plan?.matchedFiles?.length ?? 1;
      const action = plan?.actionKind;
      const currentDir = String(args?.currentDir || "D:\\code\\Main_projects\\NexusExplorer");

      if (plan?.steps && plan.steps.length > 1) {
        const stepMessages: string[] = [];
        let totalCount = 0;
        const allAffected: string[] = [];
        for (const step of plan.steps) {
          if (step.actionKind === "archive_zip") {
            const zipName = `Archive_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`;
            const zipPath = `${currentDir}\\${zipName}`;
            addMockEntryToParent(currentDir, {
              name: zipName,
              path: zipPath,
              parentPath: currentDir,
              isDir: false,
              size: plan?.totalMatchedBytes || 4096,
              modifiedMs: Date.now(),
              createdMs: Date.now(),
              isHidden: false,
              isSystem: false,
              isReadonly: false,
              ext: "zip",
            });
            allAffected.push(zipPath);
            stepMessages.push(`Step ${step.stepNumber}: Compressed ${count} files into ${zipName}`);
            totalCount += count;
          } else if (step.actionKind === "shred" && plan?.matchedFiles) {
            deleteMockPaths(plan.matchedFiles);
            allAffected.push(...plan.matchedFiles);
            stepMessages.push(`Step ${step.stepNumber}: Cryptographically wiped ${count} original files`);
            totalCount += count;
          } else if ((step.actionKind === "move_by_extension" || step.actionKind === "organize_by_extension") && plan?.matchedFiles) {
            stepMessages.push(`Step ${step.stepNumber}: Organized ${count} files into extension folders`);
            totalCount += count;
          } else {
            stepMessages.push(`Step ${step.stepNumber}: Executed ${step.title}`);
            totalCount += count;
          }
        }
        return {
          success: true,
          processedCount: totalCount,
          message: `Multi-step pipeline completed: ${stepMessages.join(" → ")}`,
          affectedPaths: allAffected,
        } as unknown as T;
      }

      if (action === "shred" && plan?.matchedFiles) {
        deleteMockPaths(plan.matchedFiles);
        return {
          success: true,
          processedCount: count,
          message: `Cryptographically shredded ${count} files with DoD 5220.22-M`,
          affectedPaths: plan.matchedFiles,
        } as unknown as T;
      }

      if ((action === "move_by_extension" || action === "organize_by_extension") && plan?.matchedFiles) {
        const affected: string[] = [];
        for (const filePath of plan.matchedFiles) {
          const ext = filePath.split(".").pop()?.toUpperCase() || "MISC";
          const fileName = filePath.split(/[/\\]/).pop() || "file";
          const targetFolder = `${currentDir}\\${ext}`;
          const newPath = `${targetFolder}\\${fileName}`;
          deleteMockPaths([filePath]);
          addMockEntryToParent(targetFolder, {
            name: fileName,
            path: newPath,
            parentPath: targetFolder,
            isDir: false,
            size: 2048,
            modifiedMs: Date.now(),
            createdMs: Date.now(),
            isHidden: false,
            isSystem: false,
            isReadonly: false,
            ext: ext.toLowerCase(),
          });
          affected.push(newPath);
        }
        return {
          success: true,
          processedCount: count,
          message: `Organized ${count} files into extension directories`,
          affectedPaths: affected,
        } as unknown as T;
      }

      if (action === "archive_zip") {
        const zipName = `Archive_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`;
        const zipPath = `${currentDir}\\${zipName}`;
        addMockEntryToParent(currentDir, {
          name: zipName,
          path: zipPath,
          parentPath: currentDir,
          isDir: false,
          size: plan?.totalMatchedBytes || 4096,
          modifiedMs: Date.now(),
          createdMs: Date.now(),
          isHidden: false,
          isSystem: false,
          isReadonly: false,
          ext: "zip",
        });
        return {
          success: true,
          processedCount: count,
          message: `Compressed ${count} files into ${zipName}`,
          affectedPaths: [zipPath],
        } as unknown as T;
      }

      if (action === "clone_cow" && plan?.matchedFiles) {
        const affected: string[] = [];
        for (const filePath of plan.matchedFiles) {
          const fileName = filePath.split(/[/\\]/).pop() || "item";
          const copyName = fileName.includes(".")
            ? fileName.replace(/(\.[^.]+)$/, "_copy$1")
            : `${fileName}_copy`;
          const copyPath = `${currentDir}\\${copyName}`;
          addMockEntryToParent(currentDir, {
            name: copyName,
            path: copyPath,
            parentPath: currentDir,
            isDir: false,
            size: 2048,
            modifiedMs: Date.now(),
            createdMs: Date.now(),
            isHidden: false,
            isSystem: false,
            isReadonly: false,
            ext: copyName.split(".").pop() || "",
          });
          affected.push(copyPath);
        }
        return {
          success: true,
          processedCount: count,
          message: `Cloned ${count} items using ReFS Block Cloning (CoW)`,
          affectedPaths: affected,
        } as unknown as T;
      }

      const topName = plan?.matchedCandidates?.[0]?.name || plan?.matchedFiles?.[0]?.split(/[/\\]/).pop();
      const topType = plan?.matchedCandidates?.[0]?.isDir ? "folder" : "file";
      const message = count === 1 && topName
        ? `Located and highlighted ${topType} '${topName}' in Explorer`
        : `Located and highlighted ${count} matching item(s) in Explorer`;

      return {
        success: true,
        processedCount: count,
        message,
        affectedPaths: plan?.matchedFiles ?? [],
      } as unknown as T;
    }
    case "tools_copilot_feedback":
      return undefined as unknown as T;

    case "tools_clone_file": {
      const src = String(args?.srcPath || args?.sourcePath || "");
      const dest = String(args?.destPath || "").replace(/\//g, "\\");
      const name = dest.split("\\").pop() || "copy";
      const parent = dest.substring(0, dest.lastIndexOf("\\")) || "D:\\code\\Main_projects";
      const ext = name.includes(".") ? name.split(".").pop() || "" : "";
      const newEntry: FileEntry = {
        name,
        path: dest,
        parentPath: parent,
        isDir: false,
        size: 1_048_576,
        modifiedMs: Date.now(),
        createdMs: Date.now(),
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext,
      };
      addMockEntryToParent(parent, newEntry);
      return {
        sourcePath: src,
        destPath: dest,
        isCowBlockCloned: true,
        bytesCloned: 1_048_576,
        elapsedMs: 1,
      } as unknown as T;
    }

    case "tools_ioring_status": {
      return {
        supported: true,
        apiVersion: 1,
        maxQueueDepth: 1024,
        submissionQueueSize: 512,
        completionQueueSize: 512,
        kernelAccelerated: true,
        fallbackMode: "None (Windows 11 Ring Active)",
      } as unknown as T;
    }

    case "tools_generate_sanitization_cert": {
      const p = String(args?.path || "C:\\Confidential\\Target.dat");
      return {
        certificateId: "mock-cert-" + Date.now(),
        timestampUtc: new Date().toISOString(),
        operator: String(args?.operator || "Nexus Compliance Officer"),
        systemHostname: "WORKSTATION-01",
        mediaPath: p,
        mediaType: "NVMe Solid State Block Storage (FTL Overprovisioned)",
        standard: "NIST SP 800-88 Rev 1 (Media Sanitization)",
        method: "Purge (Cryptographic Erase & Verification)",
        algorithmApplied: (args?.algorithm as any) || "nist-purge",
        bytesSanitized: 1048576,
        preShredDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        postVerificationStatus: "Verified Non-Recoverable - All Overwritten Sectors Zeroed/Inaccessible",
        cryptographicSeal: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6a1b2c3d4e5f60718293a",
      } as unknown as T;
    }

    case "tools_fastcdc_analyze": {
      const inputPaths = (args?.paths as string[]) || [];
      const fileCount = inputPaths.length > 0 ? inputPaths.length : 8;
      return {
        totalFilesAnalyzed: fileCount,
        totalBytesRaw: 52428800,
        totalChunksProduced: 6400,
        uniqueChunksCount: 4200,
        uniqueBytes: 34406400,
        duplicateChunksCount: 2200,
        duplicateBytesSaved: 18022400,
        deduplicationRatio: 1.52,
        elapsedMs: 42,
        sharedBlockSamples: [
          {
            chunkHash: "3f79a9042b1029c782163b4d8d179609",
            chunkSize: 8192,
            occurrenceCount: 14,
            referencedInFiles: ["app.bundle.js", "vendor.bundle.js"],
          },
        ],
      } as unknown as T;
    }

    case "tools_entropy_inspect": {
      return {
        filePath: normPath,
        fileSize: 65536,
        overallEntropy: 7.92,
        headerEntropy: 7.94,
        tailEntropy: 7.91,
        classification: "encryptedOrRansomwareSuspect",
        confidenceScore: 0.96,
        detectedMagic: undefined,
        chunkDistribution: [
          { offset: 0, length: 65536, entropy: 7.92 },
        ],
        elapsedMs: 3,
        advisory: "CRITICAL: Uniform near-maximum randomness detected without container signature.",
      } as unknown as T;
    }

    case "tools_merkle_build": {
      const p = String(args?.dir || normPath);
      return {
        rootPath: p,
        merkleRootHash: "b3a1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9",
        totalFiles: 3,
        totalBytes: 1572864,
        treeDepth: 2,
        elapsedMs: 8,
        leaves: [
          { relativePath: "Cargo.toml", fileSize: 340, modifiedMs: Date.now() - 3600000, leafHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
          { relativePath: "src/main.rs", fileSize: 25600, modifiedMs: Date.now() - 1800000, leafHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0" },
          { relativePath: "README.md", fileSize: 1024, modifiedMs: Date.now() - 7200000, leafHash: "f1e2d3c4b5a69788796a5b4c3d2e1f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0" },
        ],
      } as unknown as T;
    }

    case "tools_merkle_proof": {
      const target = String(args?.relPath || "src/main.rs");
      return {
        targetRelativePath: target,
        leafHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
        leafIndex: 1,
        totalLeaves: 3,
        auditPath: [
          ["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", true],
          ["f1e2d3c4b5a69788796a5b4c3d2e1f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0", false],
        ],
        expectedRootHash: "b3a1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9",
        isValid: true,
      } as unknown as T;
    }

    case "tools_merkle_verify": {
      return true as unknown as T;
    }

    case "tools_merkle_diff": {
      return {
        rootHashA: "b3a1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9",
        rootHashB: "b3a1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9",
        isIdentical: true,
        addedFiles: [],
        removedFiles: [],
        modifiedFiles: [],
        unmodifiedCount: 3,
        elapsedMs: 2,
      } as unknown as T;
    }

    case "tools_archive_create_sort_enhanced": {
      const dest = String(args?.destZipPath || "archive_sorted.zip");
      return {
        success: true,
        archivePath: dest,
        destinationPath: dest,
        filesProcessed: 12,
        bytesProcessed: 1048576,
        elapsedMs: 38,
        errorMessage: undefined,
      } as unknown as T;
    }

    case "tools_shred_paths": {
      const paths = (args?.paths as string[]) || (args?.path ? [String(args.path)] : [normPath]);
      deleteMockPaths(paths);
      return {
        filesDestroyed: paths.length || 1,
        directoriesRemoved: 0,
        totalBytesShredded: 1_024,
        passesCompleted: 3,
        algorithm: "dod3",
        elapsedMs: 5,
        errors: [],
        advisory: "Advisory: On Solid State Drives (SSDs with FTL wear-leveling) and CoW filesystems (ReFS/Btrfs), full-volume encryption (BitLocker) is recommended.",
      } as unknown as T;
    }

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

    case "tools_compare_binary": {
      const p = (args || {}) as { fileA?: string; fileB?: string; forceDiff?: boolean };
      const fileA = p.fileA || "fileA.bin";
      const fileB = p.fileB || "fileB.bin";
      const hasDiff = p.forceDiff || (fileA.toLowerCase().includes("file1") && fileB.toLowerCase().includes("file2"));
      const isIdentical = !hasDiff;
      return {
        fileA,
        fileB,
        sizeA: 2048,
        sizeB: isIdentical ? 2048 : 2056,
        isIdentical,
        matchingPercentage: isIdentical ? 100 : 96.5,
        totalDifferencesBytes: isIdentical ? 0 : 72,
        firstDifferenceOffset: isIdentical ? null : 0x0040,
        diffChunks: isIdentical ? [] : [
          {
            offset: 0x0040,
            leftHex: "4E 65 78 75 73 31 00 00",
            rightHex: "4E 65 78 75 73 32 00 00",
            leftAscii: "Nexus1..",
            rightAscii: "Nexus2..",
            isMatch: false,
          },
          {
            offset: 0x0048,
            leftHex: "01 02 03 04 05 06 07 08",
            rightHex: "01 02 03 04 05 06 07 08",
            leftAscii: "........",
            rightAscii: "........",
            isMatch: true,
          },
        ],
      } as unknown as T;
    }

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
        undo: () => { },
        redo: () => { },
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

    case "tools_janitor_clean_empty":
      return {
        removedCount: (args?.paths as string[])?.length ?? 3,
        failedCount: 0,
        errors: [],
      } as unknown as T;

    case "usb_list_devices":
      return mockUsbList as unknown as T;

    case "usb_get_device": {
      const devPath = String(args?.path || "").toUpperCase();
      const dev = mockUsbList.find((d) => d.path.toUpperCase().startsWith(devPath) || devPath.startsWith(d.path.toUpperCase())) || mockUsbList[0];
      return dev as unknown as T;
    }

    case "usb_get_locks": {
      const devPath = String(args?.path || "").toUpperCase();
      const key = Object.keys(mockUsbLocks).find((k) => k.toUpperCase().startsWith(devPath) || devPath.startsWith(k.toUpperCase())) || "";
      return (mockUsbLocks[key] || []) as unknown as T;
    }

    case "usb_eject_device": {
      const devPath = String(args?.path || "").toUpperCase();
      const force = Boolean(args?.force);
      const key = Object.keys(mockUsbLocks).find((k) => k.toUpperCase().startsWith(devPath) || devPath.startsWith(k.toUpperCase())) || "";
      const locks = mockUsbLocks[key] || [];
      if (locks.length > 0 && !force) {
        throw new Error(
          `Device is currently locked by ${locks.length} active process${locks.length > 1 ? "es" : ""}: ${locks.map((l) => `${l.name} (PID ${l.pid})`).join(", ")}. Please close open files or use Unlock & Safely Eject.`
        );
      }
      mockUsbList = mockUsbList.filter((d) => !d.path.toUpperCase().startsWith(devPath) && !devPath.startsWith(d.path.toUpperCase()));
      return {
        success: true,
        message: `Volume ${devPath} unmounted and cache flushed. It is now safe to unplug the USB device.`,
      } as unknown as T;
    }

    case "usb_unlock_and_eject": {
      const devPath = String(args?.path || "").toUpperCase();
      const key = Object.keys(mockUsbLocks).find((k) => k.toUpperCase().startsWith(devPath) || devPath.startsWith(k.toUpperCase())) || "";
      const count = (mockUsbLocks[key] || []).length;
      mockUsbLocks[key] = [];
      mockUsbList = mockUsbList.filter((d) => !d.path.toUpperCase().startsWith(devPath) && !devPath.startsWith(d.path.toUpperCase()));
      return {
        success: true,
        terminatedCount: count,
        message: `Terminated ${count} locking process handles, committed all pending write cache buffers to NAND flash, and safely unmounted ${devPath}.`,
      } as unknown as T;
    }

    case "usb_format": {
      const devPath = String(args?.path || "").toUpperCase();
      const opts = (args?.options || {}) as UsbFormatOptions;
      const dev = mockUsbList.find((d) => d.path.toUpperCase().startsWith(devPath) || devPath.startsWith(d.path.toUpperCase()));
      if (dev) {
        dev.filesystem = opts.filesystem || "exFAT";
        dev.label = opts.label || dev.label;
        dev.usedBytes = 32768;
        dev.freeBytes = dev.totalBytes - 32768;
      }
      return {
        success: true,
        message: `Formatted volume ${devPath} (${opts.label || "USB"}) as ${opts.filesystem || "exFAT"} with ${((opts.clusterSize || 131072) / 1024).toFixed(0)} KB cluster alignment.`,
      } as unknown as T;
    }

    case "usb_benchmark": {
      const devPath = String(args?.path || "").toUpperCase();
      const isHighSpeed = devPath.includes("E:");
      return {
        seqReadMBps: isHighSpeed ? 1045 : 39.4,
        seqWriteMBps: isHighSpeed ? 890 : 24.8,
        sustainedWriteMBps: isHighSpeed ? 820 : 18.2,
        rand4kReadIOPS: isHighSpeed ? 62400 : 1240,
        rand4kWriteIOPS: isHighSpeed ? 48500 : 420,
        elapsedMs: 3820,
        bufferBurstDropRatio: isHighSpeed ? 1.08 : 1.36,
      } as unknown as T;
    }

    case "usb_integrity_test": {
      const devPath = String(args?.path || "").toUpperCase();
      const isSuspect = devPath.includes("F:") && args?.quick === false;
      return {
        passed: !isSuspect,
        claimedCapacityBytes: 124_000_000_000,
        verifiedCapacityBytes: isSuspect ? 16_000_000_000 : 124_000_000_000,
        corruptedBytes: isSuspect ? 108_000_000_000 : 0,
        isCounterfeit: isSuspect,
        suspectedRealCapacityBytes: isSuspect ? 16_000_000_000 : 124_000_000_000,
        elapsedMs: 2950,
        speedMBps: 34.5,
        statusMessage: isSuspect
          ? "CRITICAL: Counterfeit flash controller detected! Data wrote fine for first 16 GB, but subsequent writes looped or corrupted blocks. True capacity is ~16 GB."
          : "PASSED: All pseudo-random test sectors verified with zero bit-rot or checksum mismatch. Flash capacity is genuine.",
      } as unknown as T;
    }

    case "usb_set_cache_policy": {
      const devPath = String(args?.path || "").toUpperCase();
      const policy = args?.policy as "quick_removal" | "better_performance";
      const dev = mockUsbList.find((d) => d.path.toUpperCase().startsWith(devPath) || devPath.startsWith(d.path.toUpperCase()));
      if (dev) {
        dev.writeCachePolicy = policy || "quick_removal";
      }
      return dev as unknown as T;
    }

    case "usb_create_disk_image": {
      const opts = (args?.options || {}) as UsbDiskImageOptions;
      return {
        success: true,
        bytesWritten: 124_000_000_000,
        path: opts.targetImagePath || "D:\\backups\\usb_clone.img",
      } as unknown as T;
    }

    case "usb_burn_disk_image": {
      return {
        success: true,
        bytesWritten: 4_294_967_296,
      } as unknown as T;
    }

    case "usb_surface_scan": {
      const devPath = String(args?.path || "").toUpperCase();
      const hasBad = devPath.includes("F:");
      const blocks: UsbSurfaceScanBlock[] = [];
      let fastCount = 0;
      let goodCount = 0;
      let normalCount = 0;
      let slowCount = 0;
      let criticalCount = 0;
      let badCount = 0;

      for (let i = 0; i < 120; i++) {
        let status: UsbSurfaceScanBlock["status"] = "fast";
        let latencyMs = 2.1 + (i % 3);

        if (hasBad && (i === 42 || i === 87)) {
          status = "bad";
          latencyMs = 1500;
          badCount++;
        } else if (hasBad && (i === 41 || i === 86)) {
          status = "critical";
          latencyMs = 620;
          criticalCount++;
        } else if (i % 17 === 0) {
          status = "slow";
          latencyMs = 120;
          slowCount++;
        } else if (i % 7 === 0) {
          status = "normal";
          latencyMs = 38;
          normalCount++;
        } else if (i % 3 === 0) {
          status = "good";
          latencyMs = 14;
          goodCount++;
        } else {
          status = "fast";
          latencyMs = 3.2;
          fastCount++;
        }

        blocks.push({
          id: i,
          status,
          latencyMs,
          lba: i * 16384,
        });
      }

      return {
        totalBlocks: 120,
        scannedBlocks: 120,
        fastCount,
        goodCount,
        normalCount,
        slowCount,
        criticalCount,
        badCount,
        blocks,
        isScanning: false,
        elapsedMs: 2450,
        avgLatencyMs: hasBad ? 18.4 : 4.8,
        maxLatencyMs: hasBad ? 1500 : 42,
      } as unknown as T;
    }

    case "usb_get_multiboot": {
      return {
        isVentoyInstalled: true,
        bootloaderVersion: "v1.0.99 (Nexus-EFI Core)",
        partitionScheme: "GPT",
        secureBootEnabled: true,
        isos: [
          {
            id: "iso-1",
            name: "Windows 11 24H2 Pro / Enterprise",
            osFamily: "windows",
            fileName: "Win11_24H2_English_x64.iso",
            sizeBytes: 5_800_000_000,
            uefiCompatible: true,
            secureBootSigned: true,
            hasPersistence: false,
            isActive: true,
          },
          {
            id: "iso-2",
            name: "Ubuntu 24.04 LTS (Noble Numbat)",
            osFamily: "linux",
            fileName: "ubuntu-24.04-desktop-amd64.iso",
            sizeBytes: 4_900_000_000,
            uefiCompatible: true,
            secureBootSigned: true,
            hasPersistence: true,
            persistenceSizeMB: 8192,
            isActive: true,
          },
          {
            id: "iso-3",
            name: "Clonezilla Live 3.1 (Disk Imaging)",
            osFamily: "utility",
            fileName: "clonezilla-live-3.1.2-22-amd64.iso",
            sizeBytes: 420_000_000,
            uefiCompatible: true,
            secureBootSigned: false,
            hasPersistence: false,
            isActive: true,
          },
        ],
      } as unknown as T;
    }

    case "usb_install_ventoy": {
      return {
        isVentoyInstalled: true,
        bootloaderVersion: "v1.0.99 (Nexus-EFI Core)",
        partitionScheme: "GPT",
        secureBootEnabled: true,
        isos: [],
      } as unknown as T;
    }

    case "usb_add_multiboot_iso": {
      const isoPath = String(args?.isoPath || "new_os.iso");
      const name = isoPath.split(/[\\/]/).pop() || "Custom OS Image";
      return {
        id: `iso-${Date.now()}`,
        name: name.replace(/\.iso$/i, ""),
        osFamily: name.toLowerCase().includes("win") ? "windows" : name.toLowerCase().includes("lin") || name.toLowerCase().includes("ubu") ? "linux" : "utility",
        fileName: name,
        sizeBytes: 3_800_000_000,
        uefiCompatible: true,
        secureBootSigned: true,
        hasPersistence: false,
        isActive: true,
      } as unknown as T;
    }

    case "usb_get_topology": {
      const devPath = String(args?.path || "").toUpperCase();
      const isHighSpeed = devPath.includes("E:");
      return {
        controllerName: "Intel(R) USB 3.20 eXtensible Host Controller - 1.20 (Microsoft)",
        controllerType: isHighSpeed ? "xHCI (USB 3.2)" : "EHCI (USB 2.0)",
        rootHubPort: isHighSpeed ? 2 : 7,
        negotiatedSpeed: isHighSpeed ? "SuperSpeedPlus (10 Gbps Gen 2x1)" : "HighSpeed (480 Mbps)",
        busPowerMa: isHighSpeed ? 900 : 500,
        usbPdSupported: isHighSpeed,
        usbPdVoltageV: isHighSpeed ? 5.0 : 5.0,
        usbPdCurrentA: isHighSpeed ? 3.0 : 0.5,
        endpoints: [
          { ep: 0, direction: "IN", type: "Control", maxPacketSize: 64 },
          { ep: 1, direction: "IN", type: "Bulk", maxPacketSize: 1024 },
          { ep: 2, direction: "OUT", type: "Bulk", maxPacketSize: 1024 },
          { ep: 3, direction: "IN", type: "Interrupt", maxPacketSize: 512 },
        ],
      } as unknown as T;
    }

    case "usb_forensic_sanitize": {
      const standard = String(args?.standard || "nist_800_88_purge");
      return {
        standard: standard as any,
        passesCompleted: standard === "gutmann_35" ? 35 : standard === "dod_5220_22_m" ? 3 : 1,
        totalPasses: standard === "gutmann_35" ? 35 : standard === "dod_5220_22_m" ? 3 : 1,
        bytesSanitized: 124_000_000_000,
        verificationPassed: true,
        cryptoHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        certificateId: `NIST-SAN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        completedAt: new Date().toISOString(),
      } as unknown as T;
    }

    case "tools_mounter_mount":
      return {
        driveLetter: "Z:",
        mountPoint: "Z:\\",
        source: String(args?.path || "image.iso"),
        readOnly: true,
      } as unknown as T;

    case "tools_metadata_read": {
      const ext = normPath.split(".").pop()?.toLowerCase() || "";
      const isImg = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext);
      const isAud = ["mp3", "wav", "flac", "ogg", "aac", "m4a"].includes(ext);
      const kind = isImg ? "image" : isAud ? "audio" : "unknown";
      const fileName = normPath.split(/[\\/]/).pop() || "";
      return {
        path: normPath,
        kind,
        format: ext || "dat",
        fileSize: 4580000,
        title: fileName,
        artist: "Nexus Explorer Studio",
        album: "Production Suite 2027",
        year: "2027",
        trackNumber: 1,
        genre: "Workstation Media",
        cameraMake: isImg ? "Sony" : null,
        cameraModel: isImg ? "Alpha 7R V" : null,
        dateTaken: isImg ? "Today 12:45 PM" : null,
        iso: isImg ? 400 : null,
        fNumber: isImg ? 2.8 : null,
        exposureTime: isImg ? "1/250s" : null,
        focalLength: isImg ? 35 : null,
        dimensions: isImg ? [3840, 2160] : null,
      } as unknown as T;
    }

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

    case "tools_get_note": {
      const fPath = String(args?.path || args?.filePath || normPath).replace(/\//g, "\\").toLowerCase();
      return (mockNotesMap.get(fPath) || null) as unknown as T;
    }

    case "tools_set_note": {
      const fPath = String(args?.path || args?.filePath || normPath).replace(/\//g, "\\");
      const noteMarkdown = String(args?.markdown || args?.noteMarkdown || args?.note || "");
      const note: FileAnnotation = {
        path: fPath,
        noteMarkdown,
        updatedMs: Date.now(),
      };
      mockNotesMap.set(fPath.toLowerCase(), note);
      return note as unknown as T;
    }

    case "tools_delete_note": {
      const fPath = String(args?.path || args?.filePath || normPath).replace(/\//g, "\\").toLowerCase();
      mockNotesMap.delete(fPath);
      return true as unknown as T;
    }
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

    case "tools_set_timestamps": {
      const fPath = String(args?.path || normPath).replace(/\//g, "\\");
      const modMs = Number(args?.modifiedMs || Date.now());
      const parent = fPath.substring(0, fPath.lastIndexOf("\\")).toLowerCase();
      const list = mockDirMap.get(parent);
      if (list) {
        const item = list.find((e) => e.path.replace(/\//g, "\\").toLowerCase() === fPath.toLowerCase());
        if (item) item.modifiedMs = modMs;
      }
      return undefined as unknown as T;
    }

    case "tools_set_attributes": {
      const fPath = String(args?.path || normPath).replace(/\//g, "\\");
      const ro = Boolean(args?.readonly);
      const hidden = Boolean(args?.hidden);
      const parent = fPath.substring(0, fPath.lastIndexOf("\\")).toLowerCase();
      const list = mockDirMap.get(parent);
      if (list) {
        const item = list.find((e) => e.path.replace(/\//g, "\\").toLowerCase() === fPath.toLowerCase());
        if (item) {
          item.isReadonly = ro;
          item.isHidden = hidden;
        }
      }
      return undefined as unknown as T;
    }

    case "tools_create_link":
    case "tools_remove_link":
    case "open_path":
    case "open_terminal":
    case "reveal_in_shell":
    case "watch_dir":
    case "unwatch_dir":
    case "cancel_scan":
    case "folder_size": {
      const p = String(args?.path || normPath);
      const stats = calculateMockFolderStats(p);
      const onEvent = args?.onEvent as ((event: any) => void) | undefined;
      const taskId = "mock-size-" + Date.now();
      if (typeof onEvent === "function") {
        setTimeout(() => {
          onEvent({ event: "progress", data: { taskId, files: stats.files, folders: stats.folders, bytes: stats.size } });
          onEvent({ event: "done", data: { taskId, size: stats.size, files: stats.files, folders: stats.folders, elapsedMs: 15 } });
        }, 30);
      }
      return taskId as unknown as T;
    }

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

    case "tools_usn_search":
      return [
        {
          usn: 2097152,
          fileReferenceNumber: 4096,
          parentFileReferenceNumber: 1024,
          reasons: ["DATA_OVERWRITE", "CLOSE"],
          reasonRaw: 0x80000001,
          fileName: (args?.query as string) || "nexus_target_file.rs",
          timestamp: new Date().toISOString(),
          fileAttributes: 32,
        },
      ] as unknown as T;

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
    case "tools_archive_extract_any":
      return {
        success: true,
        filesProcessed: 3,
        totalBytes: 4194304,
        elapsedMs: 45,
        message: "Archive operation completed successfully.",
      } as unknown as T;

    case "tools_archive_create":
    case "tools_archive_create_any": {
      const destZip = String(args?.destZipPath || args?.destPath || "archive.zip").replace(/\//g, "\\");
      const name = destZip.split("\\").pop() || "archive.zip";
      const parent = destZip.substring(0, destZip.lastIndexOf("\\")) || "D:\\code\\Main_projects";
      const zipEntry: FileEntry = {
        name,
        path: destZip,
        parentPath: parent,
        isDir: false,
        size: 2_048_000,
        modifiedMs: Date.now(),
        createdMs: Date.now(),
        isHidden: false,
        isSystem: false,
        isReadonly: false,
        ext: "zip",
      };
      addMockEntryToParent(parent, zipEntry);
      return {
        success: true,
        filesProcessed: 3,
        totalBytes: 2048000,
        elapsedMs: 45,
        message: "Archive created successfully.",
      } as unknown as T;
    }

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
          { lineType: "context", kind: "context", text: " import { ipc } from '@/lib/ipc';", content: " import { ipc } from '@/lib/ipc';", oldLineNum: 1, newLineNum: 1, oldLineNumber: 1, newLineNumber: 1 },
          { lineType: "del", kind: "delete", text: "-const legacy = false;", content: "-const legacy = false;", oldLineNum: 2, newLineNum: null, oldLineNumber: 2, newLineNumber: null },
          { lineType: "add", kind: "add", text: "+const nexus2027 = true;", content: "+const nexus2027 = true;", oldLineNum: null, newLineNum: 2, oldLineNumber: null, newLineNumber: 2 },
          { lineType: "add", kind: "add", text: "+const highThroughput = true;", content: "+const highThroughput = true;", oldLineNum: null, newLineNum: 3, oldLineNumber: null, newLineNumber: 3 },
          { lineType: "context", kind: "context", text: " export function run() {", content: " export function run() {", oldLineNum: 3, newLineNum: 4, oldLineNumber: 3, newLineNumber: 4 },
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
          "Frontier 2027 features include Nexus AI Agent, Dev Drive acceleration, and local P2P Mesh sharing.",
        ],
        keyTopics: ["Rust Core", "ReFS CoW", "Forensics", "Nexus AI Agent", "Tauri v2"],
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
    case "tools_semantic_hybrid_search":
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
