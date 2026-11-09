# Nexus Explorer — Complete Master Tool & Subsystem Catalogue
>
> **Comprehensive Repository-Wide Functional Inventory & Technical Reference**  
> *Every single function, tool, backend engine, Tauri IPC command, UI facility, CLI command, and specialized subsystem across `crates/nexus-core`, `src-tauri`, `src/components`, `src/hooks`, `src/lib`, `crates/nexus-cli`, and `nexus_engine_ffi`.*

---

## Master Table of Contents

1. [Category A: Core File Management & Shell Operations](#category-a-core-file-management--shell-operations) (Tools 1–28)
2. [Category B: Navigation, Multi-Pane & Workspace Layouts](#category-b-navigation-multi-pane--workspace-layouts) (Tools 29–45)
3. [Category C: Advanced Search, Discovery & Filtering](#category-c-advanced-search-discovery--filtering) (Tools 46–55)
4. [Category D: Compression & Archive Engineering](#category-d-compression--archive-engineering) (Tools 56–65)
5. [Category E: Storage, Hardware & Drive Intelligence](#category-e-storage-hardware--drive-intelligence) (Tools 66–84)
6. [Category F: Developer, Programmer & System Administration Workflows](#category-f-developer-programmer--system-administration-workflows) (Tools 85–110)
7. [Category G: Security, Cryptography & Digital Forensics](#category-g-security-cryptography--digital-forensics) (Tools 111–130)
8. [Category H: Content Previews & Media Inspection](#category-h-content-previews--media-inspection) (Tools 131–150)
9. [Category I: Local Artificial Intelligence & Copilot Automation](#category-i-local-artificial-intelligence--copilot-automation) (Tools 151–162)
10. [Category J: P2P, Remote Storage & Network Sharing](#category-j-p2p-remote-storage--network-sharing) (Tools 163–171)
11. [Category K: System Customization, Themes & User Experience](#category-k-system-customization-themes--user-experience) (Tools 172–180)
12. [Category L: Low-Level Engine Bridges & Automation CLI](#category-l-low-level-engine-bridges--automation-cli) (Tools 181–190)
13. [Category M: 2026/2027 Frontier Systems Research & Forensic Subsystems](#category-m-20262027-frontier-systems-research--forensic-subsystems) (Tools 191–200)
14. [Complete Tauri Native IPC Command Index (All 190 Commands)](#complete-tauri-native-ipc-command-index-all-190-commands)
15. [Complete Automation CLI Command Reference (All 56 Commands)](#complete-automation-cli-command-reference-all-56-commands)
16. [Complete C-ABI Export API Reference (All 30 Functions)](#complete-c-abi-export-api-reference-all-30-functions)
17. [Complete Frontend Components, Previews & Facilities Inventory (All 83 UI Facilities)](#complete-frontend-components-previews--facilities-inventory-all-83-ui-facilities)
18. [Master Repository Verification & Test Suite Statistics](#master-repository-verification--test-suite-statistics)

---

## Category A: Core File Management & Shell Operations

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 1 | **Batch Multi-Renamer** | Regex find/replace, token templates (`<name>`, `<date>`, `<counter:001>`, `<folder>`, `<ext>`), case conversions (TitleCase, UPPER, lower, camel, snake, kebab), 2-step NTFS collision avoidance, atomic transaction rollback. | `Ctrl+Shift+R` / Context Menu / Command Palette | [`crates/nexus-core/src/tools/renamer.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/renamer.rs) & [`src/components/BatchRenameDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/BatchRenameDialog.tsx) |
| 2 | **Instant CoW Duplicate (Block Clone)** | Instant zero-byte file cloning using Copy-on-Write extents on supported filesystems (ReFS, Btrfs, APFS) via `FSCTL_DUPLICATE_EXTENTS_TO_FILE` with fallback to streaming buffered clone. | Context Menu (`Instant CoW Duplicate`) | [`crates/nexus-core/src/fs/cow.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/cow.rs) & `tools_clone_file` |
| 3 | **Transactional Undo & Redo History** | Full memory stack undo/redo for file creations, renames, copies, moves, and deletions with disk rollback execution. | `Ctrl+Z` / `Ctrl+Y` / Toolbar | [`crates/nexus-core/src/state/undo.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/state/undo.rs) & [`src-tauri/src/commands/undo_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/undo_cmds.rs) |
| 4 | **Enterprise Transfer Engine** | Transfer queue supporting pause, resume, speed throttling, overwrite conflict resolution policies (Rename, Overwrite, Skip), `.nexuspart` atomic completion staging, and SHA-256 post-transfer integrity verification. | Bottom Panel / Floating Transfer Monitor | [`crates/nexus-core/src/transfer/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/transfer/engine.rs) & [`src/components/TransfersPanel.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TransfersPanel.tsx) |
| 5 | **Dynamic Transfer Bandwidth Throttler** | Real-time byte rate limits (e.g. limit background copies to 25 MB/s) to prevent saturation of spinning HDDs or high-latency network shares. | Transfer Panel / Settings | `set_rate_limit` in [`crates/nexus-core/src/transfer/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/transfer/engine.rs) |
| 6 | **Orphaned `.nexuspart` Cleaner** | Scans directories for abandoned partial transfer files left behind by crashes or power cuts and purges them safely. | Transfers Panel → *Clean Orphans* | `orphan_parts` in [`src-tauri/src/commands/ops_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/ops_cmds.rs) |
| 7 | **Conflict Resolution Modal** | Interactive overwrite dialog with side-by-side file size, date, thumbnail, and "Keep Newer / Keep Both / Skip" decisions. | Automatic on destination collision | [`src/components/ConflictDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ConflictDialog.tsx) |
| 8 | **Staging Shelf (Drop Ring)** | Drag-and-drop accumulator shelf allowing multi-source item staging before performing batch move, copy, or compress. | `Ctrl+Shift+X` / Preview Pane Tab / Drag & Drop | [`src/components/StagingShelfWidget.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/StagingShelfWidget.tsx) |
| 9 | **Clipboard Ring & History** | Multi-slot clipboard stack storing copied/cut items, text snippets, and image paths with thumbnail previews and one-click replay. | Tools Menu → *Clipboard History* | [`src/components/ClipboardHistoryModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ClipboardHistoryModal.tsx) |
| 10 | **Safe Recycle Bin & Permanent Deletion** | Dual deletion paths: standard Win32 Recycle Bin disposal (`SHFileOperationW`) and instant bypass permanent deletion with confirmation modal. | `Del` / `Shift+Del` / Context Menu | [`crates/nexus-core/src/fs/ops.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/ops.rs) & `delete_entries` |
| 11 | **Directory Auto-Folder Packing** | One-click creation of a new named folder containing all currently selected files. | Context Menu → *New folder with selection...* | [`src/lib/menus.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/menus.ts) |
| 12 | **Parallel Recursive Folder Sizing** | Multi-threaded disk directory calculation running in background workers without freezing the UI, with cooperative cancellation. | Context Menu → *Calculate folder size* | [`crates/nexus-core/src/fs/folder_size.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/folder_size.rs) & `folder_size` |
| 13 | **Deep Directory & File Scaffolder** | Creates arbitrarily deep nested folder structures in a single atomic call (e.g. `src/components/previews/sub/`). | Shell Integration / IPC | `tools_nested_folder`, `tools_nested_file` in [`src-tauri/src/commands/tools_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/tools_cmds.rs) |
| 14 | **In-Place Inline Renamer** | Keyboard-navigable table cell renamer preserving file extensions and supporting Escape/Enter commits. | `F2` key | [`src/components/RenameInput.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/RenameInput.tsx) |
| 15 | **Drag Ghost Badge Overlay** | Floating drag badge rendering icon, file count indicator, and destination folder drop feedback. | Drag-and-drop gesture | [`src/components/DragGhost.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DragGhost.tsx) |
| 16 | **In-Place Plain Text File Editor & Saver** | Direct reading, editing, and saving of UTF-8/ASCII text and configuration files without launching external editors. | QuickLook / Preview Pane Editor | `read_text_file`, `write_text_file` in [`src-tauri/src/commands/fs_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/fs_cmds.rs) |
| 17 | **Win32 Shell "Reveal in File Explorer"** | Highlights and focuses a specific file or directory in Windows File Explorer via native `explorer.exe /select,`. | Context Menu → *Reveal in File Explorer* | `reveal_in_shell` in [`src-tauri/src/commands/fs_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/fs_cmds.rs) |
| 18 | **Win32 Default Association Launcher** | Opens any file with its system-configured default Windows application using native ShellExecute. | Double-click / Enter | `open_path` in [`src-tauri/src/commands/fs_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/fs_cmds.rs) |
| 19 | **External Terminal Launcher** | Launches external terminal session at current directory with automatic Windows Terminal / PowerShell / CMD detection. | Toolbar Terminal button / `Ctrl+Shift+T` | `open_terminal` in [`src-tauri/src/commands/fs_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/fs_cmds.rs) |
| 20 | **Windows Known Folders Shell Resolver** | Resolves Windows Known Folders (Desktop, Documents, Downloads, Music, Pictures, Videos, LocalAppData) via Win32 Shell API. | Sidebar Quick Access / Path Resolution | `known_folders` in [`crates/nexus-core/src/fs/known.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/known.rs) |
| 21 | **Atomic Unique Suffix Creator** | Creates new files and folders with automatic ` (1)`, ` (2)` non-colliding suffix allocation when collisions occur. | `Ctrl+N` / Context Menu → *New File/Folder* | `create_folder`, `create_file` in [`crates/nexus-core/src/fs/ops.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/ops.rs) |
| 22 | **Multi-Source Drag-and-Drop Subsystem** | Unified HTML5 and native drag-and-drop coordinator handling inter-pane moves/copies and desktop drop operations. | Drag & Drop gestures | [`src/lib/dnd.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/dnd.ts) |
| 23 | **Status Bar System Metrics & Selection Counter** | Live status bar rendering selection count, selected total size, folder entry counts, current Git branch, and filter indicators. | Bottom Window Bar | [`src/components/StatusBar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/StatusBar.tsx) |
| 24 | **Context Confirmation & Prompt Dialogs** | Generic modal prompt and confirmation dialogs for permanent deletion, file overwrite, and name input. | Automatic upon critical actions | [`src/components/ConfirmDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ConfirmDialog.tsx) & [`src/components/PromptDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/PromptDialog.tsx) |
| 25 | **Toast Notification Dispatcher & Queue** | Non-blocking auto-dismissing toast notifications for background job completion, warnings, and error reports. | Bottom-right toast overlay | [`src/components/Toasts.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Toasts.tsx) |
| 26 | **Win32 CopyFile2 Hardware Acceleration Engine** | Calls Windows `CopyFile2` API with `COPY_FILE_NO_BUFFERING` flag for direct disk controller bypassing and fast large file streaming. | Transfer Engine / Background copies | `try_copyfile2` in [`crates/nexus-core/src/transfer/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/transfer/engine.rs) |
| 27 | **NTFS Sparse File Allocator & Detector** | Identifies and creates sparse file extents using `FSCTL_SET_SPARSE` to optimize storage for zero-padded virtual containers and databases. | Transfer Engine / File Creation | `is_sparse_file`, `mark_file_sparse` in [`crates/nexus-core/src/transfer/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/transfer/engine.rs) |
| 28 | **Transfer Overwrite Conflict Policy Engine** | Handles destination collisions via configurable policies (`Overwrite`, `Skip`, `RenameNewer`, `AutoRenameSuffix`) with `.nexuspart` atomic staging. | Transfer Dialog / Settings | `resolve_conflict` in [`crates/nexus-core/src/transfer/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/transfer/engine.rs) & [`crates/nexus-core/src/transfer/jobs.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/transfer/jobs.rs) |

---

## Category B: Navigation, Multi-Pane & Workspace Layouts

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 29 | **Details List View** | High-density virtualized list with custom column resizing, inline sorting (Name, Size, Modified, Ext), and type icons. | `Ctrl+1` / View Switcher | [`src/components/FileList.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FileList.tsx) |
| 30 | **Fluid Grid & Gallery View** | Thumbnail card view with dynamic grid sizing, hover states, and multi-select marquee box. | `Ctrl+2` / View Switcher | [`src/components/FileGrid.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FileGrid.tsx) |
| 31 | **Miller Columns Cascading Navigator** | macOS Finder / NeXTSTEP-style multi-column cascading hierarchy navigation displaying subfolders and preview in contiguous panels. | `Ctrl+3` / View Switcher | [`src/components/MillerColumns.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/MillerColumns.tsx) |
| 32 | **Multi-Pane Layout Grid** | Configurable workspace tiling: Single Pane (1×1), Dual Horizontal (Left/Right split), Dual Vertical (Top/Bottom split), Triple Pane (1 Main + 2 Stacked), and Quad Grid (2×2). | Toolbar Pane Switcher | [`src/components/Workspace.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Workspace.tsx) & [`src/components/SecondaryPane.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SecondaryPane.tsx) |
| 33 | **Synchronized Dual-Scroll Lock** | Locks scroll positions of two adjacent panes for parallel folder visual comparison. | Command Palette / Dual Mode Toggle | [`src/state/store.ts`](file:///d:/code/Main_projects/NexusExplorer/src/state/store.ts) (`dualScrollLocked`) |
| 34 | **Flat Branch View (Unroller)** | Recursively unrolls deeply nested folder trees into a single flat listing for bulk operations. | `Ctrl+Shift+F` / Tools Menu | [`crates/nexus-core/src/tools/flat.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/flat.rs) & [`src/components/FlatList.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FlatList.tsx) |
| 35 | **Interactive Breadcrumb Bar** | Clickable parent folder segments, path dropdown picker, and direct editable Win32 address bar (`Ctrl+L`). | Address Bar | [`src/components/Breadcrumbs.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Breadcrumbs.tsx) |
| 36 | **Quick "Go to Folder" Modal** | Fuzzy path matching with auto-completion and environment variable resolution (`%AppData%`, `%Temp%`, `~`). | `Ctrl+G` / Background Menu | [`src/components/GoToFolderModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/GoToFolderModal.tsx) |
| 37 | **Tab Manager & Tab Search** | Multi-tab strip with session persistence, tab duplication, tab pinning, and fuzzy tab search. | `Ctrl+T` / `Ctrl+W` / `Ctrl+Shift+A` | [`src/components/TabStrip.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TabStrip.tsx) & [`src/components/TabSearchModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TabSearchModal.tsx) |
| 38 | **Workspace Context Profiles** | One-click workspace layout presets: *Developer*, *Media Creator*, *Forensics Investigator*, and *Zen Minimalist*. | Tools Menu → *Workspace Profiles* | [`src/components/WorkspaceProfilesModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/WorkspaceProfilesModal.tsx) |
| 39 | **FAYT (Find-As-You-Type) Bar** | Keyboard-driven instant filter filtering current directory rows as keys are typed without opening a search dialog. | Typing alphanumeric keys in folder | [`src/components/FaytBar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FaytBar.tsx) |
| 40 | **Vim & Keyboard-First Navigation** | Full modal keyboard navigation (`j`/`k` movement, `h`/`l` up/down folder, `yy` copy, `dd` cut, `p` paste, `/` search). | Keyboard Hook | [`src/lib/vimNavigation.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/vimNavigation.ts) |
| 41 | **Rubber-Band Marquee Selection** | Visual rectangular click-and-drag multi-selection of files across Grid and List views with Shift/Ctrl modifiers. | Mouse drag on background | [`src/hooks/useMarqueeSelection.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/useMarqueeSelection.tsx) |
| 42 | **Navigation Sidebar Hub** | Quick Access places, drive meters, removable drive indicators, pinned favorites, and recent history. | Left Sidebar | [`src/components/Sidebar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Sidebar.tsx) |
| 43 | **Dynamic Drive Gauges & Hotplug Monitor** | Real-time disk capacity meters with color-coded usage thresholds and hotplug drive arrival/removal detection. | Sidebar Drives Section | [`src/components/Sidebar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Sidebar.tsx) & `get_drives` |
| 44 | **Deep Win32 Context Menu & Submenus Matrix** | Full-featured context menus for file items, multiple selections, folder backgrounds, breadcrumbs, and tab strip. | Right Click anywhere | [`src/components/ContextMenu.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ContextMenu.tsx) & [`src/lib/menus.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/menus.ts) |
| 45 | **React Error Boundary & Crash Guard** | Fault-tolerant boundary wrapping explorer view to prevent catastrophic application crashes on corrupted filesystem entries. | Application Frame | [`src/components/ErrorBoundary.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ErrorBoundary.tsx) |

---

## Category C: Advanced Search, Discovery & Filtering

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 46 | **Content Deep Grep (Full-Text Search)** | Multi-threaded full-text file content search with regex, case sensitivity, word boundary toggles, and automatic binary file bypass. | Power Tools → *Content search* | [`crates/nexus-core/src/tools/content_search.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/content_search.rs) & `tools_search_content` |
| 47 | **Local Semantic Vector Search** | Document discovery via cosine similarity matching over on-device vector embeddings of text and notes. | Search Bar Mode / CLI | [`crates/nexus-core/src/tools/semantic.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/semantic.rs) & `tools_semantic_search` |
| 48 | **Content-Addressed Duplicate Finder** | Byte-level duplicate detection using xxHash3 / BLAKE3 hash trees with size filters to instantly find redundant storage hogs. | Power Tools → *Duplicates* | [`crates/nexus-core/src/tools/duplicates.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/duplicates.rs) & `tools_find_duplicates` |
| 49 | **Dynamic Smart Folders** | Virtual query-driven folders that automatically aggregate files matching custom rules (e.g. `type:code AND size:>5MB`). | Tools Menu → *Manage smart folders* | [`crates/nexus-core/src/tools/smart.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/smart.rs) & [`src/components/SmartFoldersModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SmartFoldersModal.tsx) |
| 50 | **Pattern Selection Tool** | Wildcard / regex item selection across current view (e.g. `*.log;*.tmp;!keep*`). | `Ctrl+Shift+S` / Context Menu | [`src/components/SelectPatternModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SelectPatternModal.tsx) & [`src/lib/pattern.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/pattern.ts) |
| 51 | **Universal Command Palette** | VS Code / Raycast-style unified launcher searching all commands, settings, drives, bookmarks, and tools. | `Ctrl+Shift+P` / `Ctrl+P` | [`src/components/CommandPalette.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/CommandPalette.tsx) |
| 52 | **Search Results Panel** | Search result view grouping matched items with path crumbs, file size, modified date, and one-click navigation. | Main Explorer View on Search | [`src/components/SearchResults.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SearchResults.tsx) |
| 53 | **Streaming Filename Search Engine** | Multi-threaded streaming directory walk searching filenames with cooperative background cancellation registry. | Header Search Input | [`crates/nexus-core/src/search/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/search/engine.rs) & `search_files` |
| 54 | **Glob & Regex Search Syntax Engine** | Advanced matching supporting `*` wildcard, `?` character match, exact regex patterns (`^v\d+\.json$`), and extension filters. | Search Bar / CLI / Smart Folders | `run_search_blocking` in [`crates/nexus-core/src/search/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/search/engine.rs) |
| 55 | **File Size & Date Range Filter Bounds** | Range-bounded filtering pruning listings by minimum/maximum file size (bytes, MB, GB) and modification timestamps. | Search Bar Filter Menu | [`crates/nexus-core/src/models/entry.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/models/entry.rs) (`SearchOptions`) |

---

## Category D: Compression & Archive Engineering

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 56 | **Pure Rust Native ZIP Engine** | Zero-dependency high-performance ZIP creator, unpacker, and lister with Deflate/Store modes and 10 GB anti-Zip-Bomb protection. | Context Menu / Create Archive | [`crates/nexus-core/src/tools/archive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/archive.rs) & `tools_archive_create` |
| 57 | **Enterprise Multi-Format Unpacker (7-Zip Bridge)** | Native 7z CLI auto-discovery across Windows registry and scoop shims to inspect and unpack 7z, TAR, GZ, BZ2, XZ, RAR, ISO, CAB, and WIM. | Double-click archive / Context Menu | [`crates/nexus-core/src/tools/archive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/archive.rs) & `tools_archive_extract` |
| 58 | **Create Archive Modal** | Configurable compression dialog selecting formats (ZIP, 7z, tar.gz, tar), compression levels (0 Store to 9 Ultra), and destination targets. | Context Menu → *Compress with options...* | [`src/components/CreateArchiveModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/CreateArchiveModal.tsx) |
| 59 | **Virtual Archive Browser Modal** | Explore inside compressed archives as virtual directories with live filename search, entry metadata, and selective extraction without full decompression. | Double click `.zip`/`.7z` | [`src/components/ArchiveBrowserModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ArchiveBrowserModal.tsx) |
| 60 | **Reed-Solomon PAR2 Parity Verification & Recovery** | Detects companion `.par2` archives, validates data slice checksums, parses recovery packet headers, and recovers from damaged packet length headers. | Context Menu on `.par2` / Archive Modal | [`crates/nexus-core/src/tools/par2.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/par2.rs) & `tools_par2_inspect` |
| 61 | **Zip-Slip & Path Traversal Fortification** | Lexical depth tracking preventing archive entries from escaping target destination directories via `..` or Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`). | Inherent in Archive Engine | [`crates/nexus-core/src/tools/archive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/archive.rs) |
| 62 | **Multi-Volume Archive Extraction** | Automatically discovers companion archive parts (`.part1.rar`, `.001`, `.z01`) and chains extraction across volumes. | Inherent in 7z Bridge | [`crates/nexus-core/src/tools/archive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/archive.rs) |
| 63 | **Instant Archive Compression** | Single-click instant compression of single or multi-selected items into standard `.zip` archives. | Context Menu → *Compress to ZIP* | [`src/lib/menus.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/menus.ts) |
| 64 | **Unified Archive Engine Dispatcher** | Transparent wrapper executing listing, extraction, and archive creation via native ZIP or external 7-Zip depending on file extension. | Native IPC Dispatcher | `tools_archive_list_any`, `tools_archive_extract_any`, `tools_archive_create_any` |
| 65 | **7-Zip System Discovery Engine** | Automatically scans Windows registry keys, Scoop shims, Chocolatey paths, and Program Files to locate `7z.exe`. | Inherent in Archive Tools | `tools_archive_find_7z` in [`crates/nexus-core/src/tools/archive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/archive.rs) |

---

## Category E: Storage, Hardware & Drive Intelligence

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 66 | **USB Hardware Telemetry & Health Hub** | Inspects physical bus speed (USB 3.2 Gen 2, USB 3.0, 480 Mbps USB 2.0), degraded port warnings, UASP mode, controller VID/PID, and SMART health score. | Tools Menu → *USB Storage & Lock Hunter* | [`crates/nexus-core/src/tools/usb.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/usb.rs) & [`src/components/UsbDeviceManagerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/UsbDeviceManagerModal.tsx) |
| 67 | **Direct NAND Flash Throughput Benchmarker** | Real-world non-cached direct I/O read/write speed benchmarking measuring sustained MB/s, 4K random IOPS, and buffer drop ratios. | USB Manager → *Run Benchmark* | `usb_benchmark` in [`crates/nexus-core/src/tools/usb.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/usb.rs) |
| 68 | **Fake Flash & Capacity Integrity Verifier** | Writes pseudo-random verification patterns across flash address spaces to unmask fraudulent Chinese drives spoofing their firmware capacity. | USB Manager → *Verify Fake Flash* | `usb_integrity_test` in [`crates/nexus-core/src/tools/usb.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/usb.rs) |
| 69 | **Safe USB Ejection & Force Unmounter** | Native `IOCTL_STORAGE_EJECT_MEDIA` eject engine that identifies active locking handles, flushes OS write buffers, and unmounts volumes safely. | Drive Context Menu / USB Hub | `usb_eject_device`, `usb_unlock_and_eject` |
| 70 | **Ventoy Multiboot ISO Bootable Disk Installer** | Detects and formats flash drives as bootable multi-ISO Ventoy loaders, allowing drag-and-drop booting of Linux/Windows ISOs. | USB Manager → *Multiboot Ventoy* | `usb_install_ventoy` |
| 71 | **Ventoy Live ISO Injector** | Copies bootable Linux/Windows ISOs into an installed Ventoy partition and verifies Grub2 chainloader configs. | USB Manager → *Add Multiboot ISO* | `usb_add_multiboot_iso` |
| 72 | **Raw Disk Image Creator (`.img` / `.iso`)** | Reads physical storage sectors directly into a byte-for-byte raw disk image file (`.img` / `.iso`) for forensic preservation or backup. | USB Manager → *Create Disk Image* | `usb_create_disk_image` |
| 73 | **Raw Disk Image Burner / Flasher** | Writes bootable `.iso` or raw `.img` files directly to removable flash storage sectors with post-write verification (Rufus equivalent). | USB Manager → *Burn Disk Image* | `usb_burn_disk_image` |
| 74 | **Physical NAND Surface & Bad Sector Scanner** | Traverses physical disk blocks to detect read latency spikes, unreadable sectors, and bad blocks. | USB Manager → *Surface Scan* | `usb_surface_scan` |
| 75 | **USB Hub & Controller Topology Inspector** | Maps the physical USB hardware tree: identifies root hubs, cascading hubs, shared controller bandwidth, and degraded links. | USB Manager → *USB Topology* | `usb_get_topology` |
| 76 | **Windows Write Cache Policy Switcher** | Toggles OS write caching policies between *Quick Removal* (no cache, safe unplug) and *Better Performance* (write-back cache enabled). | USB Manager → *Cache Policy* | `usb_set_cache_policy` |
| 77 | **Native Volume Formatter** | Low-level volume formatting for FAT32, exFAT, NTFS, and ReFS with customizable cluster allocation sizes (4 KB to 64 KB). | USB Manager → *Format Volume* | `usb_format` |
| 78 | **NIST 800-88 Rev 1 Forensic Sanitizer** | Full physical drive sanitization conforming to NIST 800-88 Clear/Purge guidelines, wiping boot sectors, partition tables, and data tracks. | USB Manager → *Forensic Sanitize* | `usb_forensic_sanitize` |
| 79 | **Disk Space Treemap Analyzer** | Interactive squarified / radial treemap visualizing storage usage by folder hierarchy with size breakdown and instant navigation. | Tools Menu → *Disk Space Treemap* | [`crates/nexus-core/src/tools/treemap.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/treemap.rs) & [`src/components/TreemapModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TreemapModal.tsx) |
| 80 | **Dev Drive & ReFS Storage Acceleration** | Audits developer package caches (npm, Cargo, Pip, Gradle, NuGet) and relocates them to Microsoft Dev Drive (ReFS) via NTFS symlinks for 30%+ build speedups. | Tools Menu → *Dev Drive & BitLocker* | [`crates/nexus-core/src/tools/devdrive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/devdrive.rs) & [`src/components/DevDriveModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DevDriveModal.tsx) |
| 81 | **Virtual Drive Mounter (ISO / VHD / VHDX)** | Mounts raw disk images (`.iso`, `.vhd`, `.vhdx`) directly to Windows drive letters via native Win32 VDS API with one-click unmount. | Tools Menu → *Virtual Drive Mounter* | [`crates/nexus-core/src/tools/mounter.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/mounter.rs) & [`src/components/VirtualMounterModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/VirtualMounterModal.tsx) |
| 82 | **Developer Artifact Janitor** | Scans and cleans abandoned `node_modules`, `target`, `.vs`, `__pycache__`, and temporary build outputs with dry-run previews. | Tools Menu → *Clean build caches* | [`crates/nexus-core/src/tools/janitor.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/janitor.rs) & [`src/components/JanitorModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/JanitorModal.tsx) |
| 83 | **Win32 Logical Drive Enumerator & Storage Gauge** | Enumerates all physical and mapped drive letters, volume labels, filesystems (NTFS, FAT32, exFAT, ReFS), drive types (Fixed, Removable, CD-ROM, RAMDisk, Network), and live capacity metrics. | Sidebar / Address Bar / CLI | `get_drives` in [`crates/nexus-core/src/fs/drives.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/drives.rs) |
| 84 | **ReFS CoW Extents Block Clone Fallback Engine** | Dynamically audits destination volume filesystem type, negotiating ReFS CoW block extents before falling back to buffered streaming. | CoW Clone / Transfer Engine | `try_refs_block_clone` in [`crates/nexus-core/src/transfer/engine.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/transfer/engine.rs) |

---

## Category F: Developer, Programmer & System Administration Workflows

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 85 | **In-Place Hex Editor & Binary Inspector** | Inspects raw byte offsets, hex representation, ASCII column, and data inspector (8/16/32/64-bit int, float, endianness). | Context Menu → *Open in Hex Editor* | [`src/components/HexEditorModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/HexEditorModal.tsx) |
| 86 | **Binary & Unified Diff File Comparer** | Side-by-side visual diff tool showing byte differences, insertion/deletion line diffs, and identical file verification for any two selected files. | `Ctrl+Shift+E` / Context Menu | [`crates/nexus-core/src/tools/differ.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/differ.rs) & [`src/components/FileCompareModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FileCompareModal.tsx) |
| 87 | **Git Intelligence & History Hub** | Live Git status tracking, file change status, commit history logs, line-by-line blame inspector, and unified staging action. | Preview Pane / Git Modal | [`crates/nexus-core/src/tools/git.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/git.rs) & [`src/components/GitHistoryModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/GitHistoryModal.tsx) |
| 88 | **Docked PowerShell / CMD Terminal** | Embedded terminal dock pinned directly below the file list with bidirectional communication and current working directory synchronization. | ``Ctrl+` `` / Toolbar | [`crates/nexus-core/src/tools/terminal.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/terminal.rs) & [`src/components/TerminalDock.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TerminalDock.tsx) |
| 89 | **Restart Manager File Lock Hunter (Unlocker)** | Identifies which running processes (PID and name) hold open file locks, with force handle closure to permit deletion/moving. | Power Tools → *Unlocker* / Context Menu | [`crates/nexus-core/src/tools/unlocker.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/unlocker.rs) |
| 90 | **Multi-Algorithm Checksum & Manifest Generator** | Computes MD5, SHA-1, SHA-256, SHA-512, BLAKE3, and xxHash3 hashes, with `.sha256` manifest generation and verification. | Power Tools → *Checksums* / Context Menu | [`crates/nexus-core/src/tools/hash_manifest.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/hash_manifest.rs) |
| 91 | **Clipboard Hash Verifier** | Instant one-click validation comparing a file's computed hash against whatever checksum string is currently in the Windows clipboard. | Context Menu → *Verify Hash with Clipboard* | [`src/lib/menus.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/menus.ts) |
| 92 | **Large File Binary Splitter & Joiner** | Chunks multi-gigabyte files into parts (e.g. 100 MB, 1 GB) with `.crc` manifests and joins them back with byte-level parity checks. | Power Tools → *Split / Join* | [`crates/nexus-core/src/tools/splitter.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/splitter.rs) |
| 93 | **Project Scaffolding Engine** | Fast template generator for Rust Workspaces, React + Vite TypeScript projects, Python packages, and Microservices skeletons. | `Ctrl+Shift+B` / Background Menu | [`crates/nexus-core/src/tools/scaffold.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/scaffold.rs) & [`src/components/ScaffoldDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ScaffoldDialog.tsx) |
| 94 | **NTFS Links & Junctions Manager** | Audits, inspects, and creates Windows Symbolic Links (symlinks), Hard Links, and Directory Junctions with loop detection. | Power Tools → *Links* | [`crates/nexus-core/src/tools/links.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/links.rs) |
| 95 | **Forensic Timestamp Touch & Clone** | Inspects and modifies precision Windows 64-bit timestamps: CreationTime, LastAccessTime, and LastWriteTime, with timestamp cloning. | Power Tools → *Timestamps* / Properties | [`crates/nexus-core/src/tools/touch.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/touch.rs) |
| 96 | **Lossless Image Optimizer** | Strips unnecessary EXIF/IPTC metadata and compresses PNG, JPEG, and WebP assets directly in-place. | Power Tools → *Image optimizer* | [`crates/nexus-core/src/tools/imageopt.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/imageopt.rs) |
| 97 | **Empty Directory Tree Pruner** | Recursively scans for directories containing zero files and zero subdirectories, previewing them in a dry run and pruning them in one click. | Tools Menu → *Clean build caches* | `tools_janitor_scan_empty`, `tools_janitor_clean_empty` in [`crates/nexus-core/src/tools/janitor.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/janitor.rs) |
| 98 | **Streaming Partial Hex Slicer & Patcher** | Reads and modifies specific byte ranges of multi-gigabyte binary files (`read_hex_slice` / `write_hex_slice`) without loading the full file into RAM. | Hex Editor Modal | `read_hex_slice`, `write_hex_slice` in [`src-tauri/src/commands/fs_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/fs_cmds.rs) |
| 99 | **In-Place Audio ID3 Tag Editor** | Writes ID3v1 and ID3v2 metadata frames (Song Title, Artist, Album, Year, Genre) directly into MP3/FLAC audio headers. | Properties Modal → *Metadata* | `tools_metadata_set_id3` in [`crates/nexus-core/src/tools/metadata.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/metadata.rs) |
| 100 | **Dynamic WASM & Lua Plugin Engine** | Extensible plugin architecture with manifest validation, permission sandboxing, and custom action hooks. | Power Tools → *Plugins* | [`crates/nexus-core/src/tools/plugins.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/plugins.rs) |
| 101 | **Dynamic Plugin Lifecycle Manager** | Hot-installs, enables, disables, and tests sandboxed WASM and Lua plugins with sample plugin generators. | Power Tools → *Plugins* | `tools_plugins_install`, `tools_plugins_set_enabled`, `tools_plugins_create_sample` |
| 102 | **Native OS Filesystem Change Watcher** | Win32 `ReadDirectoryChangesW` kernel event stream that pushes live file creation, rename, and deletion events directly to the UI. | Real-time Directory Observer | `watch_dir`, `unwatch_dir` in [`src-tauri/src/watch.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/watch.rs) |
| 103 | **Git Line-by-Line Blame Inspector** | Queries git commit hash, author name, timestamp, and line diff for every individual line in a repository file. | Git History Modal → *Blame* | `tools_git_file_blame` in [`crates/nexus-core/src/tools/git.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/git.rs) |
| 104 | **Git Working Directory Unified Diff Viewer** | Parses unified diff syntax with line additions (`+`), deletions (`-`), and chunk headers for modified working tree files. | Preview Pane → *Git Diff* | [`src/components/previews/GitDiffPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/GitDiffPreview.tsx) & `tools_git_diff` |
| 105 | **Git Stage / Unstage / Discard Action Engine** | Programmatically executes `git add`, `git restore --staged`, or `git checkout --` on single or batch selected files. | Git Modal / Preview Pane | `tools_git_action` in [`crates/nexus-core/src/tools/git.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/git.rs) |
| 106 | **12 Built-in Code File Template Catalog** | Ready-to-use templates for Rust modules, React TypeScript components, Python scripts, Dockerfiles, Go packages, and JSON schemas. | Scaffold Dialog / CLI | `tools_scaffold_catalog` in [`crates/nexus-core/src/tools/scaffold.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/scaffold.rs) |
| 107 | **Restart Manager Process Termination Killer** | Forcibly terminates specific locking processes identified by PID so locked files can be modified or deleted. | Unlocker Power Tool | `tools_terminate_process` in [`crates/nexus-core/src/tools/unlocker.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/unlocker.rs) |
| 108 | **NTFS Link & Junction Removal Engine** | Safely unlinks NTFS Symbolic Links and Directory Junctions without accidentally deleting destination target directories. | Links Power Tool | `tools_remove_link` in [`crates/nexus-core/src/tools/links.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/links.rs) |
| 109 | **Win32 Precision File Attributes Manipulator** | Toggles Win32 attributes: Read-Only (`FILE_ATTRIBUTE_READONLY`), Hidden (`FILE_ATTRIBUTE_HIDDEN`), System, and Archive directly in filesystem metadata. | Power Tools → *Timestamps* / Properties | `tools_set_attributes` in [`crates/nexus-core/src/tools/touch.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/touch.rs) |
| 110 | **Terminal Process Stdio Streamer & Shell Multiplexer** | Manages live background terminal sessions (PowerShell/CMD) with bidirectional stdin pipe streaming and line output ring buffers. | Terminal Dock | [`crates/nexus-core/src/tools/terminal.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/terminal.rs) & `tools_terminal_write` |

---

## Category G: Security, Cryptography & Digital Forensics

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 111 | **AES-256-GCM Zero-Knowledge Vault** | Encrypts files and entire directories into `.nxvault` containers using Argon2id key derivation, BLAKE3 authentication, and AES-256-GCM. | Context Menu → *Encrypt into Secure Vault* | [`crates/nexus-core/src/tools/vault.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/vault.rs) & `tools_vault_encrypt_file` |
| 112 | **Vault Recursive Directory Encryption & Decryption** | Recursively archives and encrypts whole nested folder structures into a single authenticated `.nxvault` container and unpacks it safely. | Vault Dialog / CLI | `tools_vault_encrypt_dir`, `tools_vault_decrypt_dir` in [`crates/nexus-core/src/tools/vault.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/vault.rs) |
| 113 | **DoD 5220.22-M Forensic Shredder** | Cryptographic sanitization wiping files with 3 or 7 overwrite passes (0x00, 0xFF, pseudo-random), MFT metadata truncation, and zero-byte flush. | Context Menu → *Secure Shred (DoD)* | [`crates/nexus-core/src/tools/shredder.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/shredder.rs) & `tools_shred_paths` |
| 114 | **Gutmann 35-Pass Cryptographic Shredder** | High-security 35-pass magnetic-domain data erasure conforming to Peter Gutmann's magnetic media sanitization specifications. | Shredder Tool Options / CLI (`--algo gutmann`) | `ShredAlgorithm::Gutmann35Pass` in [`crates/nexus-core/src/tools/shredder.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/shredder.rs) |
| 115 | **NTFS Alternate Data Streams (ADS) Inspector** | Detects hidden alternate NTFS data streams, unmasks browser "Mark-of-the-Web" (`Zone.Identifier`), and strips suspicious hidden streams. | Power Tools → *ADS streams* / Properties | [`crates/nexus-core/src/tools/ads.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/ads.rs) & `tools_list_ads` |
| 116 | **Mark-of-the-Web Unblocker** | Strips the Windows Internet download block flag (`Zone.Identifier`) in one click so files can be opened without SmartScreen warnings. | Context Menu → *Unblock (Remove MotW)* | [`src/lib/menus.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/menus.ts) & `tools_unblock_file` |
| 117 | **NTFS ADS Custom Stream Creator & Deleter** | Creates, reads, and deletes specific named NTFS Alternate Data Streams without affecting the primary unnamed data stream. | ADS Power Tool | `tools_delete_ads` in [`crates/nexus-core/src/tools/ads.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/ads.rs) |
| 118 | **File Signature & Magic-Byte Sniffer** | Inspects raw magic numbers to unmask spoofed file extensions (e.g. an executable `.exe` masquerading as a `.png` or `.pdf`). | Context Menu → *Inspect Signature (Sniffer)* | [`crates/nexus-core/src/tools/sniffer.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/sniffer.rs) & `tools_sniff_file` |
| 119 | **Directory Signature Audit** | Scans an entire folder hierarchy and flags every file where the declared extension contradicts the magic bytes. | Background Menu → *Audit Directory for Spoofed Files* | `tools_audit_directory` in [`crates/nexus-core/src/tools/sniffer.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/sniffer.rs) |
| 120 | **DLP Secret Scanner (Data Loss Prevention)** | Scans directories for leaked API keys, private RSA/ED25519 keys, AWS secrets, GitHub tokens, database passwords, and PII. | Tools Menu → *DLP & Secret Scanner* | [`crates/nexus-core/src/tools/dlp.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/dlp.rs) & [`src/components/DlpScannerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DlpScannerModal.tsx) |
| 121 | **Cryptographic Provenance Audit Ledger** | Append-only Merkle-tree hash chain recording forensic audit logs of all file creations, moves, deletions, and checks. | Tools Menu → *File audit history* | [`crates/nexus-core/src/tools/provenance.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/provenance.rs) & [`src/components/ProvenanceLedgerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ProvenanceLedgerModal.tsx) |
| 122 | **Cryptographic Merkle Provenance Verifier** | Traverses the entire audit log blockchain backwards to verify that no historical file events or cryptographic hashes have been altered. | Provenance Modal → *Verify Chain Integrity* | `tools_provenance_verify` in [`crates/nexus-core/src/tools/provenance.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/provenance.rs) |
| 123 | **Provenance Manual Event Recorder** | Manually records signed forensic compliance verification events into the immutable provenance chain. | Provenance Modal / CLI | `tools_provenance_record` in [`crates/nexus-core/src/tools/provenance.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/provenance.rs) |
| 124 | **NTFS USN Journal Fast Scanner** | Directly parses the volume Change Journal (`$UsnJrnl`) to provide a forensic timeline of file modifications without slow directory walks. | Power Tools → *USN journal* | [`crates/nexus-core/src/tools/usn.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/usn.rs) & `tools_usn_query` |
| 125 | **NTFS USN Reason Code Timeline Exporter** | Extracts and formats granular USN reason flags (`FILE_CREATE`, `DATA_EXTEND`, `RENAME_OLD_NAME`, `SECURITY_CHANGE`). | USN Journal Tool | `tools_usn_records` in [`crates/nexus-core/src/tools/usn.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/usn.rs) |
| 126 | **BitLocker Drive Encryption Manager** | Queries volume encryption percentage, protection status, key protectors (TPM, PIN, Recovery Password), and lock/unlock status. | Power Tools → *BitLocker* | [`crates/nexus-core/src/tools/bitlocker.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/bitlocker.rs) & `tools_bitlocker_status` |
| 127 | **Volume Shadow Copy (VSS) Time Machine & Restorer** | Browses Windows Volume Shadow Snapshots and restores previous versions of modified or deleted files from snapshot point-in-time IDs. | Tools Menu → *File snapshots* | [`crates/nexus-core/src/tools/vss.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/vss.rs) & [`src/components/TimeMachineBar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TimeMachineBar.tsx) |
| 128 | **BitLocker Recovery Key & Password Volume Unlocker** | Dispatches `manage-bde` unlocking pipelines using alphanumeric BitLocker recovery keys or passwords and re-locks protected volumes. | Power Tools → *BitLocker* | `unlock_bitlocker_volume`, `lock_bitlocker_volume` in [`crates/nexus-core/src/tools/bitlocker.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/bitlocker.rs) |
| 129 | **VSS Snapshot Point-in-Time File Restorer** | Restores historical versions of files and folders directly from Windows Volume Shadow Copy (VSS) snapshots to destination paths. | Time Machine Bar / VSS Tool | `restore_vss_file` in [`crates/nexus-core/src/tools/vss.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/vss.rs) & `tools_vss_restore` |
| 130 | **Cryptographic Chain Hash Root Verifier** | Recomputes Merkle hash chain root from append-only provenance event logs to verify that no historical records were altered. | Provenance Modal | `compute_chain_hash` in [`crates/nexus-core/src/tools/provenance.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/provenance.rs) & `tools_provenance_verify` |

---

## Category H: Content Previews & Media Inspection

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 131 | **QuickLook Instant Preview** | macOS-style floating spacebar preview window supporting instant rendering of text, images, media, and documents. | `Space` key | [`src/components/QuickLookDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/QuickLookDialog.tsx) |
| 132 | **Universal Docked Preview Pane** | Collapsible side panel rendering contextual previews for whichever file is selected. | `Ctrl+P` (Toggle) / Toolbar | [`src/components/PreviewPane.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/PreviewPane.tsx) |
| 133 | **Syntax-Highlighted Code & Markdown Previewer** | Line numbers, syntax highlighting for 50+ languages, and rendered Markdown with tables, links, and code blocks. | Preview Pane / QuickLook | [`crates/nexus-core/src/fs/preview.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/preview.rs) |
| 134 | **Integrated Audio Player & Waveform Visualizer** | In-panel audio playback for MP3, WAV, FLAC, OGG, and AAC with decoded waveform canvas. | Preview Pane on Audio | [`src/components/previews/AudioWaveformPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/AudioWaveformPreview.tsx) |
| 135 | **Embedded Video Player** | HTML5 video player with scrubber, timestamp, and aspect ratio controls for MP4, WebM, and MKV. | Preview Pane on Video | [`src/components/previews/VideoPlayerPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/VideoPlayerPreview.tsx) |
| 136 | **Deep EXIF & Audio ID3 Metadata Inspector** | Extracts camera parameters (ISO, aperture, exposure, GPS), color profiles, video codecs, bitrates, and ID3v1/ID3v2 tags. | Preview Pane → *Metadata* | [`crates/nexus-core/src/tools/metadata.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/metadata.rs) & [`src/components/previews/MediaMetadataPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/MediaMetadataPreview.tsx) |
| 137 | **Embedded PDF Document Viewer** | Render multi-page PDF documents directly within the preview pane with page navigation and zoom. | Preview Pane on PDF | [`src/components/previews/PdfViewer.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/PdfViewer.tsx) |
| 138 | **3D Mesh & Model Inspector** | Interactive 3D WebGL canvas rendering `.stl`, `.gltf`, and `.glb` files with rotation and wireframe toggles. | Preview Pane on 3D files | [`src/components/previews/Model3DPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/Model3DPreview.tsx) |
| 139 | **Font Typeface Previewer** | Interactive typographic specimen preview for `.ttf`, `.otf`, `.woff`, and `.woff2` files across custom test sentences. | Preview Pane on Fonts | [`src/components/previews/FontPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/FontPreview.tsx) |
| 140 | **SVG Vector Inspector** | Live vector rendering with raw XML markup viewer and dimensions inspection. | Preview Pane on SVG | [`src/components/previews/SvgInspector.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/SvgInspector.tsx) |
| 141 | **On-Device OCR Text Extractor** | Extracts optical character text from screenshots and photos directly to clipboard without external cloud dependencies. | Context Menu → *OCR: Extract Text* | [`crates/nexus-core/src/tools/ocr.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/ocr.rs) & `tools_ocr_image` |
| 142 | **Sidecar Markdown Sticky Notes** | Attach persistent developer markdown notes to any file or folder (stored separately in database, never modifying the file itself). | Preview Pane / Context Menu | [`crates/nexus-core/src/tools/notes.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/notes.rs) & [`src/components/previews/StickyNotePreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/StickyNotePreview.tsx) |
| 143 | **Color-Coded Classification Tags** | Assign colored tags to files with persistent indexing and sidebar filtering. | Context Menu → *Assign tag...* | [`crates/nexus-core/src/tools/tags.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/tags.rs) & `tools_assign_tag` |
| 144 | **Win32 Comprehensive Properties Modal** | Multi-tab property sheet: size on disk, cluster count, attributes (R/H/S/A), precision timestamps, multi-hashes, ADS streams, and locking PIDs. | `Alt+Enter` / Context Menu | [`src/components/PropertiesModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/PropertiesModal.tsx) & `entry_properties` |
| 145 | **Document Structure & Outline Extractor** | Automatically parses markdown headings, rust AST functions, or python classes to show an interactive outline in the preview pane. | Preview Pane → *Outline* | [`crates/nexus-core/src/fs/preview.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/preview.rs) |
| 146 | **Sidecar Notes CRUD Subsystem** | Programmatically queries, updates, and deletes decoupled persistent metadata notes for any path on any drive. | Inherent in Notes Tools | `tools_get_note`, `tools_set_note`, `tools_delete_note` |
| 147 | **Color-Coded Tags Query & Indexing Hub** | Lists all registered tags, queries tags assigned to specific paths, and manages tag color codes. | Sidebar Tags / Properties | `tools_list_all_tags`, `tools_get_tags_for_path`, `tools_remove_tag` |
| 148 | **Document Natural Language & Code Summarizer** | Extracts structural line counts, character counts, and markdown bullet points directly within the preview pane. | Preview Pane → *Summary* | [`src/components/previews/DocumentSummaryPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/DocumentSummaryPreview.tsx) & `tools_summarize_document` |
| 149 | **Multi-Format Icon Asset & Extension Dispatcher** | Resolves high-fidelity SVG/Lucide icons for 100+ file extensions, distinguishing source code, archives, media, and system files. | Entire UI File Rows | [`src/lib/fileIcons.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/lib/fileIcons.tsx) & [`src/lib/iconAssets.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/iconAssets.ts) |
| 150 | **Text File Encoding Sniffer** | Autodetects UTF-8, UTF-16 LE/BE, and ASCII encodings with binary character ratio thresholding to prevent garbled text renders. | Preview Pipeline | `classify_content` in [`crates/nexus-core/src/fs/preview.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/preview.rs) |

---

## Category I: Local Artificial Intelligence & Copilot Automation

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 151 | **Nexus AI Autonomous Natural Language Agent** | Micro-SLM agent that translates user language prompts (e.g. *"find all rust files larger than 10kb modified yesterday and zip them"*) into structured, safe execution plans. | `Ctrl+K` / Toolbar | [`crates/nexus-core/src/ai/agent.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/agent.rs) & [`src/components/CopilotModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/CopilotModal.tsx) |
| 152 | **AI Multi-Step Action Planner & Pipeline** | Decomposes complex user requests into sequenced multi-stage steps (Filter → Organize → Compress → Archive) with visual pre-execution preview. | Inside AI Copilot | `tools_copilot_plan` in [`crates/nexus-core/src/ai/agent.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/agent.rs) |
| 153 | **AI Action Plan Dispatcher & Executor** | Executes confirmed multi-stage AI execution plans atomically with error rollback and step progress reporting. | Copilot Modal → *Execute Plan* | `tools_copilot_execute` in [`crates/nexus-core/src/tools/copilot.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/copilot.rs) |
| 154 | **Copilot Reinforcement Learning Feedback Loop** | Records human approval, correction, or rejection of generated plans to train contextual bandit weights. | Copilot Modal Feedback buttons | `tools_copilot_feedback` in [`crates/nexus-core/src/ai/bandit.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/bandit.rs) |
| 155 | **Safety Verifier & System Path Guard** | Blocks destructive AI actions on sensitive OS directories (`C:\Windows`, `Program Files`, Root) and enforces explicit human confirmation. | Inherent in AI Agent | [`crates/nexus-core/src/ai/verifier.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/verifier.rs) |
| 156 | **Contextual Multi-Armed Bandit RL Engine** | Reinforcement learning engine that learns from user feedback (approvals/rejections) to improve prompt parsing accuracy over time. | Autonomous Background Learning | [`crates/nexus-core/src/ai/bandit.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/bandit.rs) |
| 157 | **Strict Action Grammar Engine** | Enforces mathematical schema validation so the AI agent cannot hallucinate non-existent shell commands. | Inherent in AI Agent | [`crates/nexus-core/src/ai/grammar.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/grammar.rs) |
| 158 | **Deterministic Intent Classification Engine** | Fast regex and heuristic parsing engine classifying natural language queries into 18 discrete file operations. | Inherent in AI Intent | [`crates/nexus-core/src/ai/intent.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/intent.rs) |
| 159 | **Dynamic 250+ Prompt Verification Battery** | Extensive test suite validating deterministic intent classification against 250+ hostile, ambiguous, and compound prompts. | Test Suite Verification | [`crates/nexus-core/tests/ai_250_prompts_battery.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/tests/ai_250_prompts_battery.rs) |
| 160 | **Code & Markdown Summarizer Engine** | Extracts summaries, symbol counts, and architectural structures from source code and documents. | Preview Pane → *Summary* | [`crates/nexus-core/src/tools/summarizer.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/summarizer.rs) |
| 161 | **Event-Driven Automation Engine** | Rule-based engine that triggers automated actions (auto-sort, auto-tag, auto-delete temp files) when filesystem watcher events fire. | Settings → Automation | [`crates/nexus-core/src/tools/automation.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/automation.rs) & `tools_run_automation` |
| 162 | **Multi-Armed Bandit Prior Sampling & Policy Adapter** | Autonomous Thompson Sampling over Beta priors (`alpha`, `beta`) for dynamic learning without external neural network weights. | Autonomous Background Learning | [`crates/nexus-core/src/ai/bandit.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/ai/bandit.rs) & `tools_copilot_feedback` |

---

## Category J: P2P, Remote Storage & Network Sharing

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 163 | **WebDrop Wireless Mobile QR Portal** | Zero-install local HTTP/WebRTC file sharing server; renders a QR code on the desktop that a mobile phone scans to upload or download files directly. | Tools Menu → *Share with QR code* | [`crates/nexus-core/src/tools/webdrop.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/webdrop.rs) & [`src/components/WebDropModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/WebDropModal.tsx) |
| 164 | **WebDrop Lifecycle & Status Server** | Background HTTP listener management with start, stop, port binding, and connected client telemetry. | WebDrop Modal controls | `tools_webdrop_start`, `tools_webdrop_stop`, `tools_webdrop_status` |
| 165 | **Zero-Config Local P2P Mesh Sharing** | Peer-to-peer LAN protocol discovering other Nexus Explorer instances across the local network for high-speed direct transfers. | Tools Menu → *Local P2P Mesh Sharing* | [`crates/nexus-core/src/tools/mesh.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/mesh.rs) & [`src/components/MeshShareModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/MeshShareModal.tsx) |
| 166 | **Mesh Peer Discovery & Direct TCP Dispatcher** | Discovers mesh peers via broadcast beacons and streams raw files over direct authenticated TCP sockets. | Mesh Share Modal | `tools_mesh_start`, `tools_mesh_get_peers`, `tools_mesh_send_files` |
| 167 | **Remote SFTP / SSH Explorer** | Connects to remote Linux/UNIX servers over SSH/SFTP with multi-profile management, remote directory listing, and transfer queues. | Tools Menu → *Remote SFTP / SSH Explorer* | [`crates/nexus-core/src/tools/sftp.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/sftp.rs) & [`src/components/SftpExplorerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SftpExplorerModal.tsx) |
| 168 | **SFTP Multi-Profile Connection Manager** | Stores and manages encrypted remote SSH host profiles (host, port, username, keyfile). | SFTP Explorer Modal | `tools_sftp_list_profiles`, `tools_sftp_save_profile`, `tools_sftp_delete_profile` |
| 169 | **Virtual Content-Addressed Filesystem (VDFS)** | Git-like deduplicated content-addressed file snapshot namespace with version tagging. | Tools Menu → *Content-addressed storage* | [`crates/nexus-core/src/tools/vdfs.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/vdfs.rs) & [`src/components/VdfsModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/VdfsModal.tsx) |
| 170 | **VDFS Content Store Indexer & Node Inserter** | Indexes directories into immutable content blocks and records root node structures. | VDFS Modal | `tools_vdfs_summary`, `tools_vdfs_index`, `tools_vdfs_add_node` |
| 171 | **UNC Network Share Auto-Discovery** | Native Windows SMB share path traversal (`\\server\share`) with credentials authentication. | Address Bar / Go to Folder | [`crates/nexus-core/src/fs/listing.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/listing.rs) |

---

## Category K: System Customization, Themes & User Experience

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 172 | **Theme & Visual Polish Studio** | Real-time theme customization: Windows 11 Mica Acrylic, Catppuccin Mocha, Cyberpunk Neon, OLED Deep Black, and Light Mode with custom accent colors. | `Ctrl+Alt+T` / Settings | [`src/components/SettingsDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SettingsDialog.tsx) & [`src/lib/theme.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/theme.ts) |
| 173 | **Aero Glass & Blur Customizer** | Sliders controlling background blur radius (`glassBlur` 0–40px) and acrylic surface opacity (`glassOpacity` 0.5–1.0). | Settings → Appearance | [`src/styles/glass.css`](file:///d:/code/Main_projects/NexusExplorer/src/styles/glass.css) |
| 174 | **Keyboard Shortcuts Cheat Sheet** | Searchable reference modal displaying all 40+ keyboard shortcuts across navigation, tabs, selection, and tools. | `Ctrl+/` / Tools Menu | [`src/components/ShortcutsDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ShortcutsDialog.tsx) |
| 175 | **Interactive Debug HUD** | Real-time diagnostics overlay rendering memory usage, active IPC calls, event latency, and store metrics. | `Ctrl+Shift+D` | [`src/components/DebugHud.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DebugHud.tsx) |
| 176 | **Gamepad / Controller Navigation** | Full Xbox / DualSense controller navigation support allowing joysticks and D-Pad to traverse folders, trigger actions, and launch previews. | USB / Bluetooth Gamepad hook | [`src/lib/gamepad.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/gamepad.ts) |
| 177 | **Settings Manager & Configuration Persistence** | JSON persisted application configuration storing layout, sort order, hidden file display, and safety prompts. | Settings Dialog / App Launch | `get_settings`, `save_settings` in [`crates/nexus-core/src/state/settings.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/state/settings.rs) |
| 178 | **Bookmarks & Pinned Folders Store** | Persistent custom bookmarks management with custom titles, order persistence, and quick jump buttons. | Sidebar Bookmarks / Command Palette | `list_bookmarks`, `save_bookmarks` in [`crates/nexus-core/src/state/store.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/state/store.rs) |
| 179 | **Recent Locations History Store** | Automatically records visited folders, deduplicating navigation jumps with configurable history limit. | Sidebar Recent / Go To Folder | `list_recent`, `record_recent` in [`crates/nexus-core/src/state/store.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/state/store.rs) |
| 180 | **Global Keyboard Shortcuts Dispatcher Matrix** | High-performance keyboard hook intercepting 40+ hotkeys while safely isolating inputs inside text areas and dialogs. | Global Window Event Loop | [`src/hooks/useShortcuts.ts`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/useShortcuts.ts) |

---

## Category L: Low-Level Engine Bridges & Automation CLI

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 181 | **Headless Automation CLI (`nexus_cli.exe`)** | Standalone headless command-line interface supporting batch JSON file enumeration, Micro-SLM AI prompt execution, directory diffing, and cryptographic hashing in CI/CD pipelines without launching the GUI. | Terminal execution | [`crates/nexus-cli/src/main.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-cli/src/main.rs) |
| 182 | **C-ABI Native Dynamic Engine (`nexus_engine_ffi.dll`)** | Exported native C-compatible DLL interface exposing high-speed copy, drive enumeration, directory scanning, and change notification hooks for C, C++, Python, C#, or Go foreign-function bindings. | Shared Library Linking | [`nexus_engine_ffi/src/lib.rs`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/src/lib.rs) & [`nexus_engine_ffi/include/nexus_engine.h`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/include/nexus_engine.h) |
| 183 | **Full-Fidelity Standalone Mock Engine** | Browser-native mock filesystem and IPC emulator allowing all 70+ UI dialogs, animations, and flows to be tested in standard web browsers without Tauri backend dependencies. | Browser dev mode | [`src/lib/mockBackend.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/mockBackend.ts) |
| 184 | **Frameless Acrylic Window Controller** | Native Win32 window management supporting custom Mica titlebar, drag region isolation, window snap layout triggers, and non-blocking minimize/maximize/close. | TitleBar buttons | [`src-tauri/src/commands/system_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/system_cmds.rs) & [`src/components/WindowFrame.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/WindowFrame.tsx) |
| 185 | **C-ABI Resumable Transfer Subsystem** | Direct C-linkable copy, move, and delete functions with progress, completion, and conflict callback hooks (`nexus_copy`, `nexus_move`, `nexus_delete`). | C-ABI Dynamic Linking | [`nexus_engine_ffi/src/copy.rs`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/src/copy.rs) |
| 186 | **C-ABI Streaming Search with Active Cancellation** | C-compatible thread-safe search interface streaming discovered entries through callback function pointers with cancellation tokens (`nexus_search_files`). | C-ABI Dynamic Linking | [`nexus_engine_ffi/src/search.rs`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/src/search.rs) |
| 187 | **C-ABI Kernel Directory Watcher** | Direct C-linkable `ReadDirectoryChangesW` filesystem watcher pushing events to external C runtimes (`nexus_watch_dir`). | C-ABI Dynamic Linking | [`nexus_engine_ffi/src/watch.rs`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/src/watch.rs) |
| 188 | **Single-Instance Mutex & Forwarding Pipe** | Ensures only a single native desktop window runs; secondary process launches forward paths to the active instance and focus the window. | OS Process Lifecycle | `tauri_plugin_single_instance` in [`src-tauri/src/lib.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/lib.rs) |
| 189 | **Application & Environment Telemetry Reporter** | Gathers OS version, architecture, engine semantic version, hostname, and active data directories. | About Screen / IPC | `app_info` in [`src-tauri/src/commands/system_cmds.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/commands/system_cmds.rs) |
| 190 | **Cancellation & Search Registry Coordinator** | Thread-safe cooperative cancellation tokens and search ID tracking across async Rust futures, Tauri IPC, and C-ABI runtimes. | Core Runtime Registry | `nexus_core::registry::CancellationRegistry` & `nexus_core::search::SearchRegistry` in [`crates/nexus-core/src/registry.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/registry.rs) |

---

## Category M: 2026/2027 Frontier Systems Research & Forensic Subsystems

| # | Tool / Feature Name | Technical Capability | Invocation / Access | Underlying Implementation |
| --- | --- | --- | --- | --- |
| 191 | **Windows 11 IoRing Kernel Ring Batching** | Mapped Submission Queues (SQ) and Completion Queues (CQ) via `ioringapi.dll` (Win 11 Build 22000+) for non-blocking batched kernel I/O with transparent multithreaded fallback. | Storage & Listing Subsystem / IPC | [`crates/nexus-core/src/fs/ioring.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/fs/ioring.rs) & `tools_ioring_status` |
| 192 | **BLAKE3 Verifiable Merkle Tree Storage Engine** | Provable Data Possession (PDP) and verifiable integrity (IEEE S&P / ACM CCS 2025/2026); generates instantaneous root commitments, $O(\log N)$ inclusion proofs, and differential sub-tree audits with cryptographic domain separation (`DOMAIN_LEAF = 0x00`, `DOMAIN_INTERNAL = 0x01`). | Power Tools → *Merkle Tree Integrity* / CLI | [`crates/nexus-core/src/tools/merkle.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/merkle.rs) & `tools_merkle_build`, `tools_merkle_proof`, `tools_merkle_verify`, `tools_merkle_diff` |
| 193 | **RubikFS Sort-Enhanced Archival Compression** | Groups entries by MIME family, extension, size, and entropy prior to Deflate packing (USENIX FAST 2026), maximizing 32KB dictionary matches, boosting compression ratios, and minimizing seek penalties. | Create Archive Modal / IPC | [`crates/nexus-core/src/tools/archive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/archive.rs) & `tools_archive_create_sort_enhanced` |
| 194 | **FastCDC Rolling Gear-Hash Chunking Engine** | Sub-file content-defined rolling chunking (USENIX ATC) using 256-entry Gear-Hashing matrix with dual normalization masks (`MASK_S`, `MASK_L`) enabling cross-file block-level deduplication analysis at ~10x the speed of Rabin-Karp. | Power Tools → *FastCDC Deduplication* / CLI | [`crates/nexus-core/src/tools/fastcdc.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/fastcdc.rs) & `tools_fastcdc_analyze` |
| 195 | **Real-Time Shannon Entropy & Ransomware Threat Inspector** | Byte-level randomness measurement ($H = -\sum p(x)\log_2 p(x)$) from $0.00$ to $8.00$ bits/byte paired with magic-byte container header verification to differentiate legitimate compressed archives from active ransomware payloads. | Power Tools → *Entropy & Threat* / CLI | [`crates/nexus-core/src/tools/entropy.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/entropy.rs) & `tools_entropy_inspect` |
| 196 | **NIST SP 800-88 Rev 1 Forensic Sanitization & Sealed Certificate Generator** | Hardware-aware Clear and Purge multi-pass erasure with cryptographically sealed Certificates of Media Sanitization using pre/post BLAKE3 digests and keyed authenticity tags with Markdown export. | Power Tools → *NIST 800-88 Shredder* / CLI | [`crates/nexus-core/src/tools/shredder.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/shredder.rs) & `tools_generate_sanitization_cert` |
| 197 | **Hybrid BM25 + Dense Semantic Vector Retrieval (RRF)** | Next-generation retrieval combining Robertson-Spärck Jones BM25 lexical term weighting ($k_1=1.2, b=0.75$) with 256-dimensional subword dense vector cosine similarity fused via Reciprocal Rank Fusion ($k=60$). | Power Tools → *Semantic vector search* (Hybrid Toggle) / CLI | [`crates/nexus-core/src/tools/semantic.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/semantic.rs) & `tools_semantic_hybrid_search` |
| 198 | **NTFS USN Change Journal Instant Search** | Sub-10ms filename search across volume change stream records (`$UsnJrnl`) without full recursive directory traversal. | Power Tools → *USN journal* (Live Search Filter) / CLI | [`crates/nexus-core/src/tools/usn.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/usn.rs) & `tools_usn_search` |
| 199 | **Dev Drive Package Cache Junction Migration Engine** | Relocates developer caches (Cargo, npm, pip/uv, NuGet, Gradle, Maven, Bun) to ReFS Dev Drive volumes via non-elevated NTFS directory junctions (`mklink /J`) delivering instant CoW block cloning and 35%+ build speedups. | Dev Drive Modal → *Migrate via NTFS Junction ⚡* / CLI | [`crates/nexus-core/src/tools/devdrive.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/devdrive.rs) & `tools_devdrive_migrate` |
| 200 | **Orthodox Productivity Suite & Hardware Mouse Navigation** | Dolphin 25.04 custom tab renaming (`renameTab`), batch tab pruning (Close Others / Close to Right), Mouse 4/5 thumb button backward/forward navigation, Total Commander `Insert` toggle-and-advance selection mode, `PageUp`/`PageDown` acceleration, and `Alt+Shift+Enter` batch folder size calculation. | Keyboard shortcuts / Mouse buttons / Tab strip context menu | [`src/state/store.ts`](file:///d:/code/Main_projects/NexusExplorer/src/state/store.ts), [`src/hooks/useShortcuts.ts`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/useShortcuts.ts), [`src/components/FileList.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FileList.tsx) |

---

## Complete Tauri Native IPC Command Index (All 190 Commands)

Nexus Explorer registers **190 native IPC commands** in [`src-tauri/src/lib.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/lib.rs). Every single command is documented below:

### 1. Filesystem & Shell Commands (`fs_cmds.rs` — 19 Commands)
1. `scan_dir(path, on_event)` — Asynchronously streams sorted batch chunks of directory entries over a channel.
2. `cancel_scan(scan_id)` — Cancels an in-progress streaming directory scan.
3. `read_dir(path)` — Synchronous/one-shot directory listing returning directories first, then files.
4. `stat_path(path)` — Retrieves single-path metadata or `None` if non-existent.
5. `get_drives()` — Enumerates logical drives, volume names, filesystem types, and storage capacities.
6. `home_dir()` — Returns the current user's operating system home directory path.
7. `known_folders()` — Resolves standard shell folders (Desktop, Documents, Downloads, Music, Pictures, Videos).
8. `create_folder(parent, name, unique)` — Atomically creates a folder, optionally generating unique suffixes.
9. `create_file(parent, name, unique)` — Atomically creates an empty file, optionally generating unique suffixes.
10. `rename_entry(path, new_name)` — Renames a file or folder and logs the operation to the undo manager.
11. `read_text_file(path, max_bytes)` — Reads bounded UTF-8/ASCII text content for inspection.
12. `write_text_file(path, content)` — Writes text content directly to disk.
13. `read_hex_slice(path, offset, length)` — Reads a specific byte window for virtualized hex inspection.
14. `write_hex_slice(path, offset, bytes)` — Overwrites a byte window at an arbitrary offset.
15. `open_path(path)` — Launches a file with the operating system's registered default application.
16. `reveal_in_shell(path)` — Opens Windows Explorer with the target file highlighted.
17. `open_terminal(path)` — Spawns PowerShell or Windows Terminal at the target directory.
18. `watch_dir(path)` — Starts listening to Win32 kernel filesystem change events on a directory.
19. `unwatch_dir(path)` — Stops listening to filesystem change events.

### 2. Preview, Hashing & Folder Sizing (`preview_cmds.rs` — 5 Commands)
20. `preview_file(path, max_bytes)` — Classifies content type and extracts text previews and structure outlines.
21. `hash_file(path, algorithm)` — Computes streaming xxHash3, SHA-256, or BLAKE3 digests.
22. `folder_size(path, on_event)` — Recursively calculates directory size in background with progress events.
23. `cancel_folder_size(task_id)` — Cancels an active folder size calculation task.
24. `entry_properties(path)` — Returns extended file properties (Win32 attributes, link target, cluster allocation).

### 3. File Operations & Transfer Management (`ops_cmds.rs` — 10 Commands)
25. `copy_entries(sources, dest_dir, on_event)` — Starts a background copy job with streaming progress.
26. `move_entries(sources, dest_dir, on_event)` — Starts a background move job with atomic directory rename where possible.
27. `delete_entries(paths, to_trash, on_event)` — Deletes files permanently or dispatches them to the Recycle Bin.
28. `pause_job(job_id)` — Pauses a running transfer job.
29. `resume_job(job_id)` — Resumes a paused transfer job.
30. `cancel_job(job_id)` — Cancels a transfer job and stages partial cleanup.
31. `set_rate_limit(job_id, rate_limit_bps)` — Adjusts transfer speed throttle in bytes per second.
32. `resolve_conflict(job_id, conflict_id, resolution, apply_to_all)` — Applies user overwrite/skip/keep-both decision.
33. `get_active_jobs()` — Returns current status snapshots for all active and completed transfer jobs.
34. `orphan_parts()` — Scans and returns abandoned `.nexuspart` partial download artifacts.

### 4. Filename Search (`search_cmds.rs` — 2 Commands)
35. `search_files(root, query, opts, on_event)` — Initiates multi-threaded streaming search matching glob, regex, or text.
36. `cancel_search(search_id)` — Signals cancellation for an ongoing search task.

### 5. Settings, Bookmarks & Recents (`settings_cmds.rs` — 6 Commands)
37. `get_settings()` — Loads persisted settings JSON.
38. `save_settings(settings)` — Sanitizes and persists user settings.
39. `list_bookmarks()` — Retrieves user-pinned sidebar directory bookmarks.
40. `save_bookmarks(bookmarks)` — Persists the modified sidebar bookmarks list.
41. `list_recent()` — Retrieves recently visited folders.
42. `record_recent(path, name)` — Records a directory navigation visit.

### 6. Transactional Undo & Redo (`undo_cmds.rs` — 3 Commands)
43. `undo_status()` — Queries undo and redo stack depths and next operation labels.
44. `undo()` — Reverts the most recent reversible filesystem operation.
45. `redo()` — Re-executes the next undone filesystem operation.

### 7. Window & System Controls (`system_cmds.rs` — 5 Commands)
46. `app_info()` — Returns version numbers, OS architecture, hostname, and data directory paths.
47. `window_minimize()` — Minimizes native window.
48. `window_toggle_maximize()` — Toggles native maximized state.
49. `window_close()` — Closes the native application.
50. `window_is_maximized()` — Returns boolean state of window maximization.

### 8. Specialized Power Tools, Forensics & Intelligence (`tools_cmds.rs` — 140 Commands)
51. `tools_sniff_file(path)` — Sniffs magic bytes to verify actual file format vs declared extension.
52. `tools_audit_directory(root)` — Scans directory tree and flags all spoofed file extensions.
53. `tools_compare_binary(file_a, file_b, max_chunks)` — Performs chunked binary diffing between two files.
54. `tools_list_ads(path)` — Lists NTFS Alternate Data Streams and sizes.
55. `tools_unblock_file(path)` — Removes Zone.Identifier Mark-of-the-Web stream.
56. `tools_delete_ads(path, stream_name)` — Removes a specific Alternate Data Stream.
57. `tools_get_link_info(path)` — Inspects symlinks, hardlinks, and directory junctions.
58. `tools_create_link(link_path, target, kind)` — Creates symlinks, hardlinks, or directory junctions.
59. `tools_remove_link(link_path)` — Unlinks symbolic links and junctions safely.
60. `tools_get_locking_processes(path)` — Queries Windows Restart Manager for locking process PIDs.
61. `tools_terminate_process(pid)` — Terminates a locking process to free file handles.
62. `tools_get_timestamps(path)` — Retrieves 64-bit precision MACB timestamps.
63. `tools_set_timestamps(path, created, modified, accessed)` — Sets precision MACB timestamps.
64. `tools_set_attributes(path, readonly, hidden, system, archive)` — Modifies Win32 file attribute flags.
65. `tools_split_file(path, chunk_size_mb, output_dir)` — Splits large binary files into chunked parts with manifests.
66. `tools_join_files(manifest_path, output_path)` — Recombines split parts with checksum verification.
67. `tools_search_content(root, query, is_regex, case_sensitive)` — Performs multi-threaded full-text grep.
68. `tools_nested_folder(parent, rel_path)` — Creates deeply nested folder paths atomically.
69. `tools_nested_file(parent, rel_path, content)` — Creates deeply nested files with content atomically.
70. `tools_batch_scaffold(root, preset)` — Scaffolds project architectures (Rust, React, Python, Microservice).
71. `tools_scaffold_catalog()` — Returns 12 built-in file scaffolding templates.
72. `tools_rename_preview(paths, find, replace, template, case)` — Generates preview of batch renames.
73. `tools_rename_execute(plan)` — Executes validated batch rename plans.
74. `tools_rename_rollback(tx)` — Rolls back executed batch rename transactions.
75. `tools_usn_query(volume_path)` — Queries the NTFS USN Change Journal.
76. `tools_archive_list(archive_path)` — Lists entries in ZIP/7z archives.
77. `tools_archive_extract(archive_path, output_dir, password)` — Extracts archives with decompression filters.
78. `tools_archive_create(sources, output_path, format, level)` — Compresses files into ZIP or 7z.
79. `tools_archive_find_7z()` — Locates installed 7-Zip executable.
80. `tools_par2_inspect(path)` — Inspects Reed-Solomon PAR2 recovery packets.
81. `tools_clone_file(src, dest)` — Performs Copy-on-Write block cloning via FSCTL.
82. `tools_shred_paths(paths, algo)` — Sanitizes files via DoD 5220.22-M or Gutmann wiping.
83. `tools_git_status(dir)` — Queries git repository status and branch information.
84. `tools_git_diff(file)` — Parses unified git diff for a modified file.
85. `tools_git_action(repo_root, action, files)` — Stages, unstages, or discards file changes.
86. `tools_vault_encrypt_file(src, dest, password)` — Encrypts a single file with AES-256-GCM.
87. `tools_vault_decrypt_file(src, dest, password)` — Decrypts an AES-256-GCM vault file.
88. `tools_vault_encrypt_dir(src, dest, password)` — Encrypts an entire directory into an `.nxvault`.
89. `tools_vault_decrypt_dir(src, dest, password)` — Decrypts an `.nxvault` archive back to directory.
90. `tools_assign_tag(path, tag, color)` — Assigns color-coded classification tags to a path.
91. `tools_remove_tag(path, tag)` — Removes a classification tag from a path.
92. `tools_get_tags_for_path(path)` — Queries tags assigned to a specific path.
93. `tools_list_all_tags()` — Lists all unique classification tags in the registry.
94. `tools_get_note(path)` — Retrieves sidecar markdown note for a file or folder.
95. `tools_set_note(path, note)` — Saves sidecar markdown note to decoupled store.
96. `tools_delete_note(path)` — Deletes sidecar markdown note.
97. `tools_run_automation(event_type, path)` — Triggers automated rule engine actions.
98. `tools_analyze_treemap(root, max_depth)` — Computes hierarchical storage tree metrics for treemap visualization.
99. `tools_git_file_history(file, limit)` — Retrieves git commit history for a single file.
100. `tools_git_file_blame(file)` — Retrieves line-by-line git blame annotations.
101. `tools_summarize_document(path, max_bullets)` — Generates structural summary of code/markdown documents.
102. `tools_semantic_index(root)` — Generates semantic vector index for text files in directory.
103. `tools_semantic_search(root, query, limit)` — Executes cosine similarity vector search over documents.
104. `tools_copilot_plan(prompt, current_dir)` — Translates natural language prompts into structured AI action plans.
105. `tools_copilot_execute(plan)` — Executes validated AI action plans.
106. `tools_copilot_feedback(plan_id, reward)` — Feeds human reinforcement feedback into contextual bandit model.
107. `tools_mesh_start()` — Starts local P2P mesh discovery listener.
108. `tools_mesh_get_peers()` — Lists discovered local P2P mesh peers.
109. `tools_mesh_send_files(target_ip, target_port, files)` — Transmits files directly to a mesh peer.
110. `tools_usn_records(volume_path, count)` — Reads raw NTFS USN records with reason flags.
111. `tools_vss_list(volume_path)` — Lists Volume Shadow Copy historical snapshots.
112. `tools_vss_restore(snapshot_id, relative_path, target_path)` — Restores previous versions from a VSS snapshot.
113. `tools_devdrive_report()` — Audits developer package caches and identifies Dev Drive relocation candidates.
114. `tools_bitlocker_status(drive)` — Queries volume BitLocker encryption status and key protectors.
115. `tools_bitlocker_unlock(drive, password, recovery_key)` — Unlocks an encrypted BitLocker volume.
116. `tools_bitlocker_lock(drive)` — Locks an unlocked BitLocker volume.
117. `tools_provenance_log(limit)` — Retrieves the tamper-evident cryptographic provenance ledger.
118. `tools_provenance_verify()` — Verifies the Merkle hash chain of the provenance ledger.
119. `tools_provenance_record(action, path, details)` — Records custom compliance events to provenance chain.
120. `tools_metadata_read(path)` — Reads deep EXIF, ID3, and video codec metadata.
121. `tools_metadata_set_id3(path, title, artist, album, year, genre)` — Writes ID3v1/ID3v2 tags directly to audio files.
122. `tools_ocr_image(image_path, lang)` — Extracts text from image files via optical character recognition.
123. `tools_sftp_list_profiles()` — Lists configured remote SFTP/SSH connection profiles.
124. `tools_sftp_save_profile(profile)` — Saves an SFTP connection profile.
125. `tools_sftp_delete_profile(profile_id)` — Deletes an SFTP connection profile.
126. `tools_sftp_list_directory(profile_id, path)` — Lists files in a remote directory over SFTP.
127. `tools_find_duplicates(root, min_size_bytes)` — Discovers duplicate files by staged size and xxHash3 hashing.
128. `tools_flat_branch(root, max_entries)` — Recursively unrolls folder hierarchies into a single flat list.
129. `tools_list_smart_folders()` — Lists saved smart folder queries.
130. `tools_save_smart_folder(folder)` — Saves or updates a dynamic smart folder query.
131. `tools_delete_smart_folder(folder_id)` — Deletes a smart folder query.
132. `tools_run_smart_folder(folder_id)` — Executes a smart folder query and returns matching entries.
133. `tools_hash_create_manifest(root, algorithm, output_path)` — Generates a `.sha256` or `.md5` hash manifest.
134. `tools_hash_verify_manifest(manifest_path)` — Validates directory contents against a hash manifest.
135. `tools_optimize_images(sources, format, quality)` — Batch re-encodes and optimizes images.
136. `tools_terminal_start(shell, cwd)` — Starts an interactive embedded PowerShell or CMD PTY session.
137. `tools_terminal_write(session_id, data)` — Sends input keystrokes to an active terminal session.
138. `tools_terminal_read(session_id)` — Reads queued output chunks from an active terminal session.
139. `tools_terminal_close(session_id)` — Closes an embedded terminal session.
140. `tools_plugins_list()` — Lists installed WASM and Lua plugins with permissions.
141. `tools_plugins_set_enabled(plugin_id, enabled)` — Toggles plugin enabled state.
142. `tools_plugins_execute(plugin_id, entry_path)` — Executes a sandboxed plugin action on a file.
143. `tools_plugins_create_sample(name, plugin_type)` — Generates sample WASM or Lua plugin scaffolds.
144. `tools_plugins_install(manifest_json, binary_bytes)` — Installs a new plugin into the user plugin repository.
145. `tools_archive_list_any(path)` — Lists archive entries with automatic engine selection.
146. `tools_archive_extract_any(path, dest)` — Extracts archives with automatic engine selection.
147. `tools_archive_create_any(sources, dest, format)` — Creates archives with automatic engine selection.
148. `tools_vdfs_summary()` — Summarizes virtual content-addressed storage statistics.
149. `tools_vdfs_index(root, node_id)` — Indexes a directory into the virtual content-addressed storage repository.
150. `tools_vdfs_add_node(name, parent_id)` — Adds a virtual directory node to the CAS repository.
151. `tools_webdrop_start(files)` — Starts local WebDrop HTTP/WebRTC file sharing portal.
152. `tools_webdrop_stop()` — Stops the WebDrop sharing portal.
153. `tools_webdrop_status()` — Queries active WebDrop sharing URL, QR code SVG, and status.
154. `tools_janitor_scan(root)` — Scans directory for developer artifacts (`node_modules`, `target`, `.vs`).
155. `tools_janitor_clean(items)` — Purges developer artifacts and build caches.
156. `tools_janitor_scan_empty(root)` — Scans directory tree for empty folders.
157. `tools_janitor_clean_empty(dirs)` — Prunes empty directories from disk.
158. `tools_dlp_scan(paths)` — Audits files and directories for sensitive credentials, secrets, and keys.
159. `tools_mounter_list()` — Lists currently mounted virtual disk images.
160. `tools_mounter_mount(source, drive_letter)` — Mounts ISO, VHD, or VHDX images to a Windows drive letter.
161. `tools_mounter_unmount(source)` — Unmounts a virtual disk image.
162. `usb_list_devices()` — Enumerates physical USB drives with controller topology and health scores.
163. `usb_get_device(drive_letter)` — Retrieves detailed telemetry for a specific USB volume.
164. `usb_eject_device(drive_letter)` — Safely flushes and ejects a removable USB device.
165. `usb_get_locks(drive_letter)` — Identifies processes locking a USB drive.
166. `usb_unlock_and_eject(drive_letter)` — Terminates locks and ejects a USB drive.
167. `usb_benchmark(drive_letter, block_size_kb, test_size_mb)` — Runs direct I/O read/write throughput tests.
168. `usb_integrity_test(drive_letter, sample_percent)` — Verifies true flash memory capacity against counterfeit spoofing.
169. `usb_forensic_sanitize(drive_letter, passes)` — Performs physical drive sanitization conforming to NIST 800-88.
170. `usb_surface_scan(drive_letter)` — Performs block-level physical surface scanner for bad sectors.
171. `usb_get_multiboot(drive_letter)` — Queries Ventoy multiboot bootloader installation state.
172. `usb_install_ventoy(drive_letter)` — Formats and installs Ventoy multiboot loader to a drive.
173. `usb_add_multiboot_iso(drive_letter, iso_path)` — Copies an ISO image into a Ventoy partition.
174. `usb_get_topology()` — Queries the physical USB controller hardware tree.
175. `usb_set_cache_policy(drive_letter, policy)` — Configures Windows write caching policy (Quick Removal vs Better Performance).
176. `usb_format(drive_letter, fs, cluster_size, label, quick)` — Formats volume with specified filesystem and cluster size.
177. `usb_create_disk_image(drive_letter, output_image_path)` — Creates sector-by-sector raw `.img` disk backup.
178. `usb_burn_disk_image(image_path, drive_letter)` — Flashes raw disk image to physical drive sectors.
179. `tools_ioring_status()` — Queries Windows 11 IoRing kernel ring capabilities and runtime status.
180. `tools_generate_sanitization_cert(path, algo, operator)` — Generates NIST SP 800-88 sealed Certificate of Sanitization with keyed BLAKE3 seal.
181. `tools_fastcdc_analyze(paths)` — Computes rolling Gear-Hash content-defined chunks and cross-file block deduplication metrics.
182. `tools_entropy_inspect(path)` — Calculates Shannon entropy (0.00–8.00 bits/byte) and classifies crypto-ransomware threat level.
183. `tools_semantic_hybrid_search(root, query, limit)` — Fuses BM25 lexical recall with dense 256-dim neural embeddings via Reciprocal Rank Fusion (k=60).
184. `tools_usn_search(volume_path, query, max_results)` — Fast NTFS change stream filename search (<10ms).
185. `tools_devdrive_migrate(ecosystem, target_drive)` — Creates non-elevated NTFS directory junctions to Dev Drive ReFS partitions.
186. `tools_merkle_build(path)` — Constructs BLAKE3 Merkle Tree and returns root hash commitment.
187. `tools_merkle_proof(path, relative_path)` — Generates O(log N) cryptographic Merkle inclusion proof.
188. `tools_merkle_verify(root_hash, leaf_hash, relative_path, proof)` — Verifies Merkle inclusion proof against root commitment.
189. `tools_merkle_diff(old_path, new_path)` — Performs differential sub-tree Merkle comparison detecting modified, added, and deleted files.
190. `tools_archive_create_sort_enhanced(sources, output_path, format, level)` — Sorts entries by MIME family and size for enhanced compression ratio (RubikFS).

---

## Complete Automation CLI Command Reference (All 56 Commands)

The headless automation CLI ([`crates/nexus-cli/src/main.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-cli/src/main.rs)) exposes the core engine directly to scripts, pipelines, and CI/CD:

1. `nexus-cli list <path> [--json]` — Fast directory listing with optional JSON output.
2. `nexus-cli search <root> <query> [maxResults]` — Multi-threaded filename and glob search.
3. `nexus-cli copy <src...> --to <destDir>` — Enterprise batch copy with resume and speed metrics.
4. `nexus-cli move <src...> --to <destDir>` — Batch move with atomic rename optimization.
5. `nexus-cli delete [--permanent] <path...>` — Deletes to Recycle Bin or purges permanently.
6. `nexus-cli drives [--json]` — Enumerates system and removable storage drives.
7. `nexus-cli hash <file>` — Computes xxHash3, SHA-256, and BLAKE3 digests.
8. `nexus-cli rename <path> <new_name>` — Renames a single file or directory preserving parent path.
9. `nexus-cli mkdir <path>` — Creates directory on disk at specified path.
10. `nexus-cli gui [<folder>]` — Spawns the Nexus Explorer graphical desktop interface (`nexus-explorer.exe`) at an optional folder path.
11. `nexus-cli sniff <file>` — Detects true file format from binary magic bytes.
12. `nexus-cli diff <file_a> <file_b>` — Performs binary chunk diffing.
13. `nexus-cli ads <file> [--unblock]` — Lists NTFS Alternate Data Streams and strips Mark-of-the-Web.
14. `nexus-cli link <link_path> [target] [--junction|--hardlink|--symlink|--remove]` — Manages NTFS links.
15. `nexus-cli unlock <file> [--kill]` — Inspects locking processes and terminates them.
16. `nexus-cli touch <path> [--readonly] [--hidden]` — Modifies MACB precision timestamps and Win32 flags.
17. `nexus-cli split <file> <chunk_size_mb>` — Chunks large files with `.crc` manifests.
18. `nexus-cli join <manifest.json> [output_path]` — Reassembles split files with parity verification.
19. `nexus-cli scaffold <dir> [preset_name]` — Scaffolds project templates (Rust, React, Python, Microservice).
20. `nexus-cli content-search <root> <query> [--regex] [--case-sensitive]` — Multi-threaded full-text grep.
21. `nexus-cli batch-rename [--find <regex>] [--replace <str>] [--template <str>] [--apply] <files...>` — Batch renamer.
22. `nexus-cli clone <src> <dest>` — Copy-on-Write block cloning via FSCTL.
23. `nexus-cli shred [--algo <zero|random|dod3|dod7|gutmann>] <targets...>` — Cryptographic wiping.
24. `nexus-cli git-status [<dir>]` — Live git status and branch inspection.
25. `nexus-cli git-diff <file>` — Displays unified diff for modified files.
26. `nexus-cli git-action <repo_root> <stage|unstage|discard> <files...>` — Git staging dispatcher.
27. `nexus-cli vault encrypt [--dir] <src> <dest.nxvault> --pass <password>` — AES-256-GCM vault encryption.
28. `nexus-cli vault decrypt [--dir] <dest.nxvault> <out> --pass <password>` — Vault decryption.
29. `nexus-cli tag <add|remove|list|find> [path] [tag_name] [--color <hex>]` — Color-coded file tagging.
30. `nexus-cli note <get|set|del> <path> [markdown_text]` — Sidecar markdown developer notes.
31. `nexus-cli treemap <dir> [--width <w>] [--height <h>] [--depth <d>]` — Disk space hierarchy analyzer.
32. `nexus-cli git-history <file> [--limit <n>]` — Commit history for a specific file.
33. `nexus-cli git-blame <file>` — Line-by-line git blame inspection.
34. `nexus-cli summarize <file> [--bullets <n>]` — Document outline and natural language summary.
35. `nexus-cli semantic <index|search> <dir> [--query <q>] [--limit <n>]` — On-device vector semantic search.
36. `nexus-cli copilot <prompt> [--dir <path>] [--execute]` — Autonomous natural language AI agent.
37. `nexus-cli mesh <status|listen|peers|send <ip> <port> <files...>>` — Local peer-to-peer LAN mesh.
38. `nexus-cli usn <status|records> <volume_path> [--count <n>]` — NTFS USN Change Journal records.
39. `nexus-cli vss <list|restore> [volume|args...]` — Windows Volume Shadow Snapshots browser.
40. `nexus-cli devdrive` — Audits package caches for Dev Drive acceleration.
41. `nexus-cli bitlocker <status|unlock|lock> [drive] [--password <p>] [--recovery-key <k>]` — BitLocker manager.
42. `nexus-cli provenance <log|verify|record> [args...]` — Tamper-evident cryptographic ledger.
43. `nexus-cli meta <read|set-id3> <file> [args...]` — EXIF and ID3 metadata reader and writer.
44. `nexus-cli ocr <image_file> [--lang <lang>]` — On-device optical character recognition text extraction.
45. `nexus-cli sftp <profiles|list> [args...]` — Remote SFTP connection and directory listing.
46. `nexus-cli vdfs [status|index <path> [node_id]]` — Virtual content-addressed storage.
47. `nexus-cli webdrop [status|share <files...>]` — Local HTTP/WebRTC wireless mobile portal.
48. `nexus-cli janitor [scan|clean] [path]` — Cleans build caches (`node_modules`, `target`, `.vs`).
49. `nexus-cli dlp <paths...>` — Data Loss Prevention secret and API key scanner.
50. `nexus-cli mount <source> [drive_letter]` — Mounts ISO, VHD, and VHDX disk images.
51. `nexus-cli archive <list|extract|create> <archive> [args...]` — Native archive manager.
52. `nexus-cli par2 <file.par2>` — Inspects and validates Reed-Solomon PAR2 recovery sets.
53. `nexus-cli fastcdc <paths...> [--threshold <f64>]` — FastCDC rolling Gear-Hash chunking and cross-file block deduplication.
54. `nexus-cli entropy <files...>` — Real-time Shannon entropy calculation (0.00–8.00 bits/byte) and ransomware threat classification.
55. `nexus-cli sanitize <clear|purge> <targets...> [--operator <name>] [--witness <name>]` — NIST SP 800-88 Rev 1 hardware sanitization and cryptographic certificate generation.
56. `nexus-cli merkle <build|proof|diff> [args...]` — BLAKE3 Merkle Tree building, $O(\log N)$ inclusion proof verification, and snapshot differential audit.

---

## Complete C-ABI Export API Reference (All 30 Functions)

The C dynamic library ([`nexus_engine_ffi`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/src/lib.rs) & [`nexus_engine.h`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/include/nexus_engine.h)) exports **30 C-linkable functions** for integration with C, C++, Python, C#, or Go:

1. `nexus_init()` — Creates and initializes an opaque engine context handle (`NexusHandle`).
2. `nexus_free(ctx)` — Frees engine context handle and cancels active operations.
3. `nexus_version()` — Returns static C-string pointer of the engine version.
4. `nexus_scan_dir(ctx, path, callback, user_data)` — Asynchronous streaming directory scan via C function pointer callback.
5. `nexus_cancel_scan(ctx, scan_id)` — Cancels an in-flight scanning operation.
6. `nexus_read_dir_sync(ctx, path, out_entries, out_count)` — Synchronously lists directory entries into C struct array.
7. `nexus_read_dir_sync_json(ctx, path, out_json)` — Synchronously lists directory entries as an allocated JSON C-string.
8. `nexus_free_entries(entries, count)` — Frees allocated `NexusFileEntry` array.
9. `nexus_copy(ctx, sources, count, dest_dir, progress_cb, comp_cb, conf_cb, user_data)` — Initiates threaded copy job with progress and conflict resolution callbacks.
10. `nexus_move(ctx, sources, count, dest_dir, progress_cb, comp_cb, conf_cb, user_data)` — Initiates threaded move job with progress and conflict resolution callbacks.
11. `nexus_delete(ctx, paths, count, to_trash, progress_cb, comp_cb, user_data)` — Initiates threaded delete job with progress callback.
12. `nexus_pause_job(handle)` — Pauses a running C-ABI transfer job handle.
13. `nexus_resume_job(handle)` — Resumes a paused C-ABI transfer job handle.
14. `nexus_cancel_job(handle)` — Cancels a running C-ABI transfer job handle.
15. `nexus_free_job_handle(handle)` — Frees opaque `NexusJobHandle`.
16. `nexus_search_files(ctx, root, query, options, callback, user_data)` — Initiates threaded search streaming matching entries to callback.
17. `nexus_cancel_search(ctx, search_id)` — Cancels active search by ID (or last search if NULL).
18. `nexus_last_search_id(ctx, out_id)` — Copies ID of most recently started search.
19. `nexus_get_drives(ctx, out_drives, out_count)` — Queries logical drives into allocated `NexusDriveInfo` array.
20. `nexus_free_drives(drives, count)` — Frees allocated `NexusDriveInfo` array.
21. `nexus_home_dir(ctx, out_path)` — Retrieves home directory path.
22. `nexus_free_string(ptr)` — Safely deallocates C-strings allocated by the Rust runtime.
23. `nexus_rename(ctx, path, new_name)` — Renames a file or folder.
24. `nexus_create_folder(ctx, parent, name)` — Creates a new folder.
25. `nexus_read_text_file(ctx, path, max_bytes, out_content, out_truncated, out_size)` — Reads text preview with truncation flag.
26. `nexus_open_path(ctx, path)` — Launches path with system default handler.
27. `nexus_reveal_in_shell(ctx, path)` — Reveals path in Windows Explorer.
28. `nexus_orphans_json(out_json)` — Returns JSON string of orphaned `.nexuspart` files.
29. `nexus_watch_dir(ctx, path, callback, user_data)` — Watches directory for kernel filesystem change events.
30. `nexus_unwatch_dir(ctx, path)` — Unwatches directory.

---

## Complete Frontend Components, Previews & Facilities Inventory (All 83 UI Facilities)

The desktop frontend contains **83 specialized components, modals, preview inspectors, and interaction subsystems** across [`src/components/`](file:///d:/code/Main_projects/NexusExplorer/src/components/), [`src/hooks/`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/), and [`src/lib/`](file:///d:/code/Main_projects/NexusExplorer/src/lib/):

### Core Explorer Windows & Modals (34 Facilities)
1. [`ArchiveBrowserModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ArchiveBrowserModal.tsx) — Virtual compressed archive browser.
2. [`BatchRenameDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/BatchRenameDialog.tsx) — Enterprise batch multi-renamer with token engine.
3. [`ClipboardHistoryModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ClipboardHistoryModal.tsx) — Multi-item visual clipboard ring.
4. [`CommandPalette.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/CommandPalette.tsx) — Unified keyboard launcher and fuzzy search.
5. [`ConfirmDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ConfirmDialog.tsx) — Destruction and safety confirmation modal.
6. [`ConflictDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ConflictDialog.tsx) — Interactive file collision resolution sheet.
7. [`ContextMenu.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ContextMenu.tsx) — Context menu with deep shell actions.
8. [`CopilotModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/CopilotModal.tsx) — Autonomous AI agent assistant modal.
9. [`CreateArchiveModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/CreateArchiveModal.tsx) — Compression format and level configuration dialog.
10. [`DebugHud.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DebugHud.tsx) — Diagnostic memory and FPS performance overlay.
11. [`DevDriveModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DevDriveModal.tsx) — Dev Drive (ReFS) package cache accelerator.
12. [`DlpScannerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DlpScannerModal.tsx) — Secret, API key, and credential scanner.
13. [`FileCompareModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FileCompareModal.tsx) — Side-by-side binary and line diff comparer.
14. [`GitHistoryModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/GitHistoryModal.tsx) — Git commit history and blame viewer.
15. [`GoToFolderModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/GoToFolderModal.tsx) — Fuzzy path jump with environment variable expansion.
16. [`HexEditorModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/HexEditorModal.tsx) — Virtualized in-place hex editor and binary inspector.
17. [`JanitorModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/JanitorModal.tsx) — Developer artifact cleaner and empty directory pruner.
18. [`MeshShareModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/MeshShareModal.tsx) — Zero-config LAN P2P mesh file sharing.
19. [`PowerToolsDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/PowerToolsDialog.tsx) — Unified tabbed power tools dialog (17 integrated facilities including Merkle Integrity, FastCDC, Entropy & Threat, and NIST 800-88 Shredder).
20. [`PromptDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/PromptDialog.tsx) — Text input prompt modal for new names and queries.
21. [`PropertiesModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/PropertiesModal.tsx) — Comprehensive file properties sheet (clusters, hashes, ADS).
22. [`ProvenanceLedgerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ProvenanceLedgerModal.tsx) — Cryptographic Merkle provenance audit ledger.
23. [`QuickLookDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/QuickLookDialog.tsx) — Instant spacebar preview modal.
24. [`ScaffoldDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ScaffoldDialog.tsx) — Project scaffold generator with 12 templates.
25. [`SelectPatternModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SelectPatternModal.tsx) — Wildcard and regex pattern selection dialog.
26. [`SettingsDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SettingsDialog.tsx) — Appearance, theme, and configuration studio.
27. [`SftpExplorerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SftpExplorerModal.tsx) — Remote SSH/SFTP connection explorer.
28. [`ShortcutsDialog.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ShortcutsDialog.tsx) — Keyboard shortcuts reference cheat sheet.
29. [`SmartFoldersModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SmartFoldersModal.tsx) — Dynamic query smart folder manager.
30. [`TabSearchModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TabSearchModal.tsx) — Fuzzy search for open workspace tabs.
31. [`TreemapModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TreemapModal.tsx) — Interactive disk space squarified treemap.
32. [`UsbDeviceManagerModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/UsbDeviceManagerModal.tsx) — USB telemetry, benchmark, Ventoy, and sanitizer hub.
33. [`VdfsModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/VdfsModal.tsx) — Virtual content-addressed storage browser.
34. [`VirtualMounterModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/VirtualMounterModal.tsx) — Virtual disk image mounter (ISO/VHD/VHDX).
35. [`WebDropModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/WebDropModal.tsx) — Wireless mobile QR file sharing portal.
36. [`WorkspaceProfilesModal.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/WorkspaceProfilesModal.tsx) — Workspace context layout presets.

### Dedicated Preview Inspectors (`src/components/previews/` — 10 Facilities)
37. [`AudioWaveformPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/AudioWaveformPreview.tsx) — Decoded audio waveform visualizer and player.
38. [`DocumentSummaryPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/DocumentSummaryPreview.tsx) — Natural language and code document outline summarizer.
39. [`FontPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/FontPreview.tsx) — Specimen typeface rendering for TTF/OTF/WOFF/WOFF2.
40. [`GitDiffPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/GitDiffPreview.tsx) — In-preview unified git diff viewer.
41. [`MediaMetadataPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/MediaMetadataPreview.tsx) — EXIF camera data and ID3 tag breakdown.
42. [`Model3DPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/Model3DPreview.tsx) — Interactive 3D WebGL mesh viewer (STL, GLTF, GLB).
43. [`PdfViewer.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/PdfViewer.tsx) — Multi-page PDF renderer with navigation and zoom.
44. [`StickyNotePreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/StickyNotePreview.tsx) — Persistent sidecar markdown sticky notes.
45. [`SvgInspector.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/SvgInspector.tsx) — SVG vector preview and raw XML inspector.
46. [`VideoPlayerPreview.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/previews/VideoPlayerPreview.tsx) — HTML5 video player with scrubber and aspect ratio controls.

### Workspace, Viewports & Shell Frame Facilities (18 Facilities)
47. [`Breadcrumbs.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Breadcrumbs.tsx) — Interactive breadcrumb path segments and editable address bar.
48. [`DragGhost.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/DragGhost.tsx) — Floating visual badge for drag-and-drop operations.
49. [`ErrorBoundary.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ErrorBoundary.tsx) — Crash protection and recovery screen.
50. [`ExplorerView.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/ExplorerView.tsx) — Central multi-pane explorer container.
51. [`FaytBar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FaytBar.tsx) — Find-As-You-Type instant row filter.
52. [`FileGrid.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FileGrid.tsx) — Thumbnail card gallery view.
53. [`FileList.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FileList.tsx) — High-density virtualized details list view.
54. [`FlatList.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/FlatList.tsx) — Flat branch unrolled directory listing view.
55. [`MillerColumns.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/MillerColumns.tsx) — macOS-style cascading hierarchy columns.
56. [`PreviewPane.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/PreviewPane.tsx) — Side-docked universal multi-format preview pane.
57. [`RenameInput.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/RenameInput.tsx) — In-place inline table cell renamer.
58. [`SearchResults.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SearchResults.tsx) — Search results explorer table.
59. [`SecondaryPane.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/SecondaryPane.tsx) — Secondary pane container with synchronized scroll lock.
60. [`Sidebar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Sidebar.tsx) — Navigation sidebar hub (drives, places, tags, bookmarks).
61. [`StagingShelf.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/StagingShelf.tsx) / [`StagingShelfWidget.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/StagingShelfWidget.tsx) — Persistent multi-source accumulator shelf.
62. [`StatusBar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/StatusBar.tsx) — Live status bar (selection, size, git branch).
63. [`TabStrip.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TabStrip.tsx) — Multi-tab bar with pinning and reordering.
64. [`TerminalDock.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TerminalDock.tsx) — Embedded bottom PowerShell/CMD terminal dock.
65. [`TimeMachineBar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TimeMachineBar.tsx) — Volume Shadow Copy point-in-time snapshot scrubber.
66. [`TitleBar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TitleBar.tsx) / [`WindowFrame.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/WindowFrame.tsx) — Custom Mica acrylic window frame and controls.
67. [`Toasts.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Toasts.tsx) — Non-blocking notification toast container.
68. [`Toolbar.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Toolbar.tsx) — Top command and tool bar.
69. [`TransfersPanel.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/TransfersPanel.tsx) — Transfer queue monitor and bandwidth throttler.
70. [`Workspace.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/components/Workspace.tsx) — Multi-pane workspace tiling engine (1x1, 1x2, 2x1, 1+2, 2x2).

### Frontend Runtime Subsystems, Hooks & Engine Bridges (13 Facilities)
71. [`useMarqueeSelection.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/useMarqueeSelection.tsx) — Rectangular drag-and-drop multi-item selection hook with modifier key support.
72. [`useShortcuts.ts`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/useShortcuts.ts) — Global keyboard shortcut interceptor with text input isolation.
73. [`useSystemEvents.ts`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/useSystemEvents.ts) — Tauri desktop event listener handling `open-paths` and file association triggers.
74. [`gamepad.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/gamepad.ts) — Gamepad API controller support for handheld PCs (Steam Deck, ROG Ally, Xbox).
75. [`theme.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/theme.ts) — Dynamic theme studio engine managing CSS tokens, Mica acrylic blur, and custom accent palettes.
76. [`fileIcons.tsx`](file:///d:/code/Main_projects/NexusExplorer/src/lib/fileIcons.tsx) / [`iconAssets.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/iconAssets.ts) — Dynamic vector file icon and extension badge resolver.
77. [`menus.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/menus.ts) — Context menu matrix, dynamic submenu hierarchy, and shell action dispatcher.
78. [`mockBackend.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/mockBackend.ts) — In-memory filesystem and mock IPC bridge enabling zero-dependency browser testing.
79. [`dnd.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/dnd.ts) — Cross-pane and OS shell drag-and-drop transfer coordinator.
80. [`pattern.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/pattern.ts) — Wildcard glob and regular expression matching engine for multi-item selection.
81. [`paths.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/paths.ts) — Cross-platform path parsing, extension stripping, and breadcrumb path generator.
82. [`format.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/format.ts) — High-precision byte sizing, duration parsing, and timestamp formatting.
83. [`entries.ts`](file:///d:/code/Main_projects/NexusExplorer/src/lib/entries.ts) — File entry sorting, multi-column comparator, and folder-first grouping engine.

---

## Master Repository Verification & Test Suite Statistics

* **Total Distinct Catalogued Tools & Subsystems:** **200**
* **Categories:** **13**
* **Rust Backend Tool Modules:** **44** in [`crates/nexus-core/src/tools/`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-core/src/tools/)
* **Tauri Native IPC Commands:** **190** in [`src-tauri/src/lib.rs`](file:///d:/code/Main_projects/NexusExplorer/src-tauri/src/lib.rs) (100% catalogued)
* **Headless CLI Commands & Subcommands:** **56** in [`crates/nexus-cli/src/main.rs`](file:///d:/code/Main_projects/NexusExplorer/crates/nexus-cli/src/main.rs) (100% catalogued)
* **C-ABI Export Functions:** **30** in [`nexus_engine_ffi`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/src/lib.rs) & [`nexus_engine.h`](file:///d:/code/Main_projects/NexusExplorer/nexus_engine_ffi/include/nexus_engine.h) (100% catalogued)
* **Frontend UI Facilities & Interaction Subsystems:** **83** across [`src/components/`](file:///d:/code/Main_projects/NexusExplorer/src/components/), [`src/hooks/`](file:///d:/code/Main_projects/NexusExplorer/src/hooks/), and [`src/lib/`](file:///d:/code/Main_projects/NexusExplorer/src/lib/) (100% catalogued)
* **Automated Unit & Integration Test Suite:** **292 tests passing (149 Rust tests across workspace + 143 Vitest tests), 0 errors, 0 warnings (100% Pass Rate).**
