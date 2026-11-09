# Phase I: Complete Existing Project Assessment
**Target System:** Nexus Explorer v2.0.0  
**Stack:** Tauri v2, Rust 1.85+, React 19, TypeScript 5.8+, Vite 6, Tailwind CSS  
**Host Platform:** Windows 10/11 x64 (NTFS, ReFS, Dev Drive, FAT32/exFAT, WSL2)

---

## 1. Executive Summary

Nexus Explorer is architected as a high-performance desktop file manager and developer workstation. Unlike traditional Electron-based applications that suffer from substantial memory footprints and sluggish cold-start times, Nexus Explorer utilizes Tauri v2 and pure Rust (`nexus-core`), maintaining a base memory footprint under 65 MB and instantaneous UI rendering via React 19 with strict windowing and virtualized viewports.

This baseline investigation evaluates the repository structure, component boundaries, IPC mechanisms, filesystem primitives, security parameters, and test coverage before architectural stabilization.

---

## 2. Repository & Module Hierarchy

```
NexusExplorer/
├── crates/
│   ├── nexus-core/          # Pure Rust core library (no GUI dependency)
│   │   ├── src/
│   │   │   ├── ai/          # Micro-SLM, contextual bandit, intent parser, safety verifier
│   │   │   ├── fs/          # Listing, drives, CoW extent cloning, folder size, preview
│   │   │   ├── models/      # FileEntry, DriveInfo, JobEvents, IPC models
│   │   │   ├── search/      # Engine, indexing, fuzzy matching, content search
│   │   │   ├── state/       # Store, undo/redo stack, settings persistence
│   │   │   ├── tools/       # 30+ forensic & power-user utilities (ADS, Vault, Shredder, etc.)
│   │   │   └── transfer/    # Multi-worker async I/O engine, collision handling, rate limiter
│   │   └── tests/           # Integration test suites (250+ prompt battery, shell tests)
│   └── nexus-cli/           # Headless command-line binary exposing nexus-core tools
├── nexus_engine_ffi/        # Foreign Function Interface bindings (C ABI / Python interop)
├── src-tauri/               # Tauri v2 native desktop application wrapper
│   └── src/
│       ├── commands/        # Type-safe command handlers (fs, ops, preview, search, settings, tools)
│       ├── lib.rs           # Plugin registration, invoke handlers, system event loops
│       └── watch.rs         # Debounced cross-platform filesystem watcher (notify-rs)
├── src/                     # React 19 + TypeScript frontend application
│   ├── components/          # Views (List, Grid, Miller), Dialogs, Modals, Tools, HUD
│   ├── hooks/               # Custom hooks (shortcuts, marquee selection, system events)
│   ├── lib/                 # IPC abstraction, theme engine, mock backend, formatters, icons
│   ├── state/               # Centralized reactive Zustand store
│   └── styles/              # Layout, glassmorphism tokens, cyber/mica stylesheets
└── docs/                    # Architectural reports, security audits, and verification logs
```

---

## 3. Component Boundaries & Execution Architecture

### 3.1 Frontend (`src/`)
- **State Architecture:** Managed through a high-performance Zustand store (`src/state/store.ts`). It handles dual-pane folder active states, multi-selection sets, column layouts, breadcrumb history, transfer queues, and dialog visibilities.
- **Rendering Paradigms:** 
  - Details list (`src/components/FileList.tsx`): Row height fixed, tree-in-list inline recursion.
  - Virtual Grid (`src/components/FileGrid.tsx`): CSS grid auto-fill with marquee drag-selection.
  - Miller Columns (`src/components/MillerColumns.tsx`): Cascading recursive column navigation with instant keyboard traversal (`h`/`j`/`k`/`l`).
  - Previews (`src/components/PreviewPane.tsx`): High-throughput sandboxed previewer supporting text, markdown, hex inspection, SVG/PNG/JPEG, audio waveforms, video metadata, and Git diffs.

### 3.2 IPC Boundary (`src/lib/ipc.ts` ⇄ `src-tauri/src/commands/`)
- All native interactions route through `invokeSafe<T>()`.
- In standard desktop mode, invokes map directly to Rust async handlers using `tauri::command`.
- In browser testing/development mode, calls fall back seamlessly to `src/lib/mockBackend.ts` without runtime crashes or missing API exceptions.
- High-volume progress events (such as byte-by-byte file copy progress, USN journal record streaming, and terminal output) utilize Tauri streaming channels (`Channel<T>`).

### 3.3 Core Engine (`crates/nexus-core`)
- **Memory Safety & Zero-Copy Primitives:** Employs Rust memory safety guarantees. ReFS block cloning uses IOCTL `FSCTL_DUPLICATE_EXTENTS_TO_FILE` for instant metadata-only data duplication.
- **Cryptographic Engine:** Uses `aes-gcm` (AES-256-GCM authenticated encryption with 96-bit random nonces) and `blake3` / `sha2` for content verification and duplicate detection.
- **Security Boundaries:**
  - AI planning engine validates all filesystem mutations through `ai::verifier::FormalSafetyVerifier`.
  - System-critical paths (`C:\Windows`, `System32`, `Program Files`, root volume metadata) are hardware-protected and cannot be targeted for destructive actions (shredding, mass deletion, moving).
  - Destructive batch operations (DoD shredding, build artifact purging, recursive renaming) enforce explicit two-factor user confirmations.

---

## 4. Current State Feature Inventory

| Area | Implemented & Native | Partially Implemented / Fallback | Missing / Future Work |
| :--- | :--- | :--- | :--- |
| **Navigation** | Details List, Grid View, Miller Columns, Breadcrumbs with Chevron Popups, Tab Strip | Split Pane Auxiliary Sync, Tab Search Modal | Session layout auto-save across crashes |
| **Search & Indexing** | In-View FAYT (`'`), Global Indexed (`+`), Regex, Filename substring, Content Search | Local Semantic Vector Search (CPU embeddings) | Background SQLite persistent indexer |
| **Filesystem Primitives** | NTFS Attributes, ADS Streams, USN Journal Reader, Junctions/Hardlinks | Dev Drive cache redirect detection | Native ext4/Btrfs direct driver mounting |
| **Transfer Engine** | Multi-threaded Worker Pool, Collision policies (overwrite, skip, keepBoth), Speed limiting | Pause/Resume on non-seekable streams | Chunked network peer-to-peer torrents |
| **Security & Privacy** | DoD 5220.22-M 3-pass shredding, Gutmann 35-pass, AES-256-GCM Vaults, Secret & DLP scanner | Restart Manager Process Unlocker | BitLocker full TPM provisioning |
| **Forensic Utilities** | Magic-byte Sniffer (40+ headers), MACB Timestamp touch, SHA-256 manifest | PAR2 parity packet inspector | Hex editor dynamic multi-gigabyte patching |
| **Developer Workflows** | Embedded PowerShell/CMD dock, Git diff/status/history/blame, Scaffold templates | WebDrop LAN HTTP portal | Integrated Language Server Protocol (LSP) |

---

## 5. Architectural Limitations & Technical Debt Identified

1. **Large Directory Virtualization in Auxiliary Panes:**
   - The primary `FileList` handles 10,000+ entries effortlessly, but secondary split-panes previously lacked full dynamic virtualization, resulting in minor DOM overhead when navigating massive system directories (`C:\Windows\WinSxS`).
2. **USB Hardware Native Bridging:**
   - While `crates/nexus-core/src/tools/usb.rs` implemented low-level Win32 IOCTL volume locking and unbuffered benchmarking, the corresponding Tauri command bindings were previously routed through developer mock fallbacks rather than the native kernel IOCTL.
3. **Clippy Code Cleanliness:**
   - 8 minor non-idiomatic pattern warnings were identified in `crates/nexus-core` (redundant double-ended iterator splits, identical if-branches, uncollapsed match arms).

