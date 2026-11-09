# Phase III: Exhaustive Feature Requirements Catalogue

---

## Category A: Core File Management
- **Atomic Operations:** Create, rename, copy, move, and trash operations executed atomically with rollback capability.
- **Batch Renaming:** Regex matching, sequential numbering tokens (`<#>`, `<##>`), date tokens (`<YYYY>`, `<MM>`), prefix/suffix injection, and case transformations (UPPERCASE, lowercase, Title Case, camelCase, snake_case).
- **Collision Resolution:** Granular prompt options: "Overwrite Newer", "Overwrite Older", "Keep Sibling Copy (Auto-Rename)", "Skip", and "Apply to All".
- **Total Commander Selection Controls:** Select by Pattern (`+` / `Ctrl+Shift+S`) supporting wildcards (`*.rs;*.ts`), regex, live match tallying, and Invert Selection (`*` / `Ctrl+Shift+I`).
- **Archive Engine:** Native pure-Rust ZIP compression and decompression, plus 7-Zip CLI auto-discovery fallback for `.7z`, `.tar`, `.tar.gz`, `.tar.zst`.

---

## Category B: Navigation & Productivity
- **Multiple Layout Modes:** Details List (`Ctrl+1`), Virtual Grid (`Ctrl+2`), and Miller Columns (`Ctrl+3`).
- **Tree-in-List Inline Expansion:** Expand subdirectories inline within the primary details list without navigating away or losing context.
- **Interactive Breadcrumb Navigation:** Visual path segments with clickable chevrons providing popovers of sibling and child folders; editable path bar on click/focus with Escape to cancel.
- **Tabbed Browsing:** Multi-tab interface with drag-and-drop reordering, close buttons, duplicate tab actions, and Total Commander–style Tab Search Modal (`Ctrl+Shift+A`).
- **Go To Folder:** Rapid modal navigation dialog (`Ctrl+G`) with debounce validation and quick destination chips (Home, Desktop, Downloads, Drives, WSL).
- **Find-As-You-Type (FAYT):**
  - `'` (single quote): Instant in-view client filtering.
  - `+` (plus): High-speed indexed system-wide search.
  - `>` (greater-than): Inline shell command execution.
  - `]` (bracket): Bookmark fast-jump list.

---

## Category C: Advanced Search & Discovery
- **High-Throughput Filename & Regex Search:** Multi-threaded directory scanning with case-insensitive substring, wildcard, and regular expression modes.
- **Deep Content Search:** Plain text and regex search inside files with automatic binary sniffer rejection to prevent stalls on multi-gigabyte binaries.
- **Deduplication Engine:** Exact file duplicate detection using staged sizing filters followed by BLAKE3 cryptographic hash verification.
- **Smart Folders:** Dynamic saved search queries persisted to settings and evaluated on-demand.

---

## Category D: Storage & Filesystem Primitives
- **NTFS Feature Support:**
  - Alternate Data Streams (ADS) enumeration and deletion (e.g., removing `Zone.Identifier` to unblock downloaded files).
  - USN Change Journal query engine for auditing file creations, modifications, and deletions.
  - Volume Shadow Copy (VSS) snapshot inspection and single-file point-in-time recovery.
  - Junction and symbolic link inspection, creation, and removal.
- **ReFS Support:** Block extent cloning via `FSCTL_DUPLICATE_EXTENTS_TO_FILE` for instant, zero-copy duplication.
- **Dev Drive:** Package cache directory auditing and automatic junction redirection to ReFS Dev Drive volumes.
- **BitLocker:** Volume encryption status inspection and programmatic locking/unlocking via `manage-bde`.
- **Virtual Drives:** Mapping folders and archives to dedicated drive letters using `subst`.

---

## Category E: Advanced File Transfers
- **Asynchronous Worker Pool:** Dedicated background thread pool executing non-blocking file transfers.
- **QoS Rate Limiting:** User-configurable transfer speed ceilings (e.g., limit to 50 MB/s to preserve disk bandwidth for development servers).
- **Live Transfer Metrics:** Real-time throughput (MB/s), ETA calculation, active file progress, and error logging without simulated metrics.
- **Checksum Verification:** Post-copy integrity verification comparing SHA-256 or BLAKE3 digests between source and destination files.

---

## Category F: Developer & Technical Workflows
- **Docked Pseudo-Terminal:** Embedded interactive terminal (`Ctrl+\``) with live PowerShell and CMD integration tracking active explorer directories.
- **Git Integration:**
  - Active branch and working tree dirty status detection.
  - Side-by-side and unified diff visualization for modified files.
  - Commit history log viewer.
  - Line-by-line Git blame viewer.
- **Binary Differ:** Side-by-side hex comparison displaying byte offsets and mismatched bytes.
- **Hex Editor / Slice Inspector:** Inspect arbitrary file segments in hexadecimal and ASCII representations.
- **Scaffolding Engine:** 12 built-in source templates (Rust, TypeScript, Python, Go, Dockerfile, etc.) and full project scaffolding presets.
- **Build Cache Cleaner (Janitor):** Scans and purges large build artifacts (`node_modules`, `target`, `bin`, `obj`, `.venv`) with explicit user confirmation.

---

## Category G: Security & Privacy
- **DoD & Gutmann Shredder:** Multi-pass data destruction complying with DoD 5220.22-M (3 passes: zeros, ones, cryptographically pseudo-random bytes) and Peter Gutmann's 35-pass standard.
- **AES-256-GCM Vaults:** Password-protected authenticated encryption for individual files and entire directories stored as portable `.nxvault` containers.
- **Secret & DLP Leak Scanner:** Scans files and directories for accidental exposure of API keys, AWS credentials, private keys, and authorization tokens.
- **Zip-Slip Protection:** Canonical path validation on archive extraction preventing extraction outside the intended destination directory.
- **Process Lock Release:** Identifies locking process handles via the Windows Restart Manager API (`RstrtMgr.dll`) and allows targeted termination.

---

## Category H: Previews & Content Management
- **Text & Code:** Highlighted syntax viewing for source code, configuration files, and Markdown.
- **Images:** High-DPI preview with dimension inspection and lossless WebP batch optimization.
- **Audio & Video:** Audio playback with metadata inspection (ID3v1 tags, bitrates, sample rates).
- **Forensic Sniffer:** 40+ magic-byte signatures detecting extension spoofing (e.g., `.exe` disguised as `.pdf`).

---

## Category I: Automation & Intelligent Capabilities
- **Event-Driven Rules:** Trigger custom actions based on file creations, extensions, or sizing thresholds.
- **Micro-SLM AI Copilot:**
  - Natural language intent parsing for directory organization, archiving, and analysis.
  - Formal deterministic AST safety verification rejecting unauthorized destructive operations on critical paths.
  - Multi-armed bandit reinforcement learning adapting action ranking to user execution patterns.

---

## Category J: User Experience & Design
- **Theme Studio:** Full theming engine supporting Dark, Light, Mica (Windows 11 translucent glass), Catppuccin Mocha, Cyberpunk Neon, and custom color accents.
- **Staging Shelf:** Drop area for collecting items across multiple folders before executing a unified transfer or archive operation.
- **Status Bar:** Item count, selected count, cumulative selected size, free disk space, and active background job status.
- **Vim Navigation:** Modal keyboard controls (`h`, `j`, `k`, `l`, `gg`, `G`, `y`, `d`, `p`).

---

## Category K: 2027 Frontier Requirements
- **Local LAN WebDrop:** Zero-cloud peer-to-peer file sharing over Wi-Fi featuring embedded HTTP service and dynamic QR code generation.
- **Direct Flash Hardware Intelligence:** Direct unbuffered disk benchmarking (`FILE_FLAG_NO_BUFFERING`), fake flash drive detection (H2testw standard), and NIST SP 800-88 Rev 1 forensic disk sanitization.
- **Local Semantic Vector Search:** Neural embeddings and cosine similarity search for document discovery without cloud API dependencies.

