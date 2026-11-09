# Phase V: Prioritized Engineering Roadmap

---

## 1. Roadmap Overview & Execution Philosophy

The Nexus Explorer engineering roadmap is structured according to strict architectural dependency ordering:
1. **Foundational Core Stability (P0):** Correctness, memory safety, path traversal safeguards, and data-loss prevention.
2. **Core Desktop Experience (P1):** Multi-pane layout, virtualized lists, keyboard-first navigation, and breadcrumbs.
3. **Developer & Power Workflows (P2):** Terminal dock, Git diffs, batch renaming, build artifact janitor.
4. **Forensic & Systems Operations (P3):** ADS manager, USN change stream, DoD shredder, fake flash detector.
5. **2027 Frontier Capabilities (P4):** Local Micro-SLM AI copilot, local LAN WebDrop, vector semantic search.

---

## 2. Milestone Breakdown & Technical Specifications

### Milestone 1: P0 — Data Integrity & Safety Invariants (Status: COMPLETE)
- **Task 1.1:** Atomic file transfers with rollback and collision detection (`overwrite`, `skip`, `keepBoth`).
  - *Module:* `crates/nexus-core/src/transfer/engine.rs`
  - *Acceptance Criteria:* Moving folders across volumes must clean up source completely without leaving orphaned partial directories; collision auto-renaming must generate collision-free unique names.
- **Task 1.2:** Zip-Slip Path Traversal Protection.
  - *Module:* `crates/nexus-core/src/tools/archive.rs`
  - *Acceptance Criteria:* Unpacking an archive containing `../../Windows/System32/evil.dll` must be intercepted and rejected with an explicit `TraversalsAttempted` error.
- **Task 1.3:** Critical System Path Shields.
  - *Module:* `crates/nexus-core/src/ai/verifier.rs`
  - *Acceptance Criteria:* AI agent and batch delete operations targeting `C:\Windows`, `Program Files`, or system volume roots must be blocked deterministically by AST safety verifier.

### Milestone 2: P1 — Core Navigation & Multi-View Rendering (Status: COMPLETE)
- **Task 2.1:** Tri-View Architecture (Details List, Virtual Grid, Miller Columns).
  - *Modules:* `src/components/FileList.tsx`, `FileGrid.tsx`, `MillerColumns.tsx`
  - *Acceptance Criteria:* Instant switching via `Ctrl+1`, `Ctrl+2`, `Ctrl+3` while preserving selection and scroll state.
- **Task 2.2:** Total Commander Orthodox Pattern Selection.
  - *Modules:* `src/components/SelectPatternModal.tsx`, `src/lib/pattern.ts`
  - *Acceptance Criteria:* Hotkey `+` triggers pattern dialog; supports wildcards (`*.log;*.tmp`), live count previews, and invert selection (`*`).
- **Task 2.3:** Find-As-You-Type (FAYT) Live Quick-Filter.
  - *Module:* `src/components/FaytBar.tsx`
  - *Acceptance Criteria:* Typing `'` opens in-view filter bar; typing `+` routes to indexed global search; typing `>` routes to shell command execution.

### Milestone 3: P2 — Developer Workstations & Automation (Status: COMPLETE)
- **Task 3.1:** Embedded Docked Terminal.
  - *Modules:* `crates/nexus-core/src/tools/terminal.rs`, `src/components/TerminalDock.tsx`
  - *Acceptance Criteria:* `Ctrl+\`` toggles docked terminal; maintains state, streams output asynchronously, and auto-syncs with active directory.
- **Task 3.2:** Native Git Repository Status & Diffs.
  - *Modules:* `crates/nexus-core/src/tools/git.rs`, `src/components/previews/GitDiffPreview.tsx`
  - *Acceptance Criteria:* Parses Git status, branch name, unified diff chunks, and blame lines natively without requiring external tools.
- **Task 3.3:** Build Artifact & Cache Janitor.
  - *Modules:* `crates/nexus-core/src/tools/janitor.rs`, `src/components/JanitorModal.tsx`
  - *Acceptance Criteria:* Discovers `node_modules`, `target`, `.venv`, `.next` folders; calculates size without locking; prompts for explicit two-step confirmation before deletion.

### Milestone 4: P3 — Forensic Tools & Storage Hardware (Status: COMPLETE)
- **Task 4.1:** USB Hardware Management & Direct Flash Benchmark.
  - *Modules:* `crates/nexus-core/src/tools/usb.rs`, `src-tauri/src/commands/tools_cmds.rs`, `src/components/UsbDeviceManagerModal.tsx`
  - *Acceptance Criteria:* Direct unbuffered I/O benchmark via Win32 `FILE_FLAG_NO_BUFFERING`; fake flash H2testw algorithm; safe volume dismount via `FSCTL_DISMOUNT_VOLUME`.
- **Task 4.2:** Alternate Data Streams (ADS) & Zone.Identifier Cleaner.
  - *Module:* `crates/nexus-core/src/tools/ads.rs`
  - *Acceptance Criteria:* Discovers hidden streams on NTFS files; removes `Zone.Identifier` to unblock downloaded files.
- **Task 4.3:** DoD 5220.22-M & Gutmann Multi-Pass File Shredder.
  - *Module:* `crates/nexus-core/src/tools/shredder.rs`
  - *Acceptance Criteria:* Multi-pass overwrite (pass 1: zeros, pass 2: ones, pass 3: CSPRNG bytes) followed by file truncation and rename before unlinking.

### Milestone 5: P4 — 2027 Frontier Features (Status: COMPLETE)
- **Task 5.1:** Local Micro-SLM AI Agent & Safety Verifier.
  - *Modules:* `crates/nexus-core/src/ai/agent.rs`, `src/components/CopilotModal.tsx`
  - *Acceptance Criteria:* 250+ natural language prompts parsed into formal AST action plans; reinforcement learning bandit updates policy based on user confirmations.
- **Task 5.2:** Local LAN WebDrop HTTP Portal.
  - *Modules:* `crates/nexus-core/src/tools/webdrop.rs`, `src/components/WebDropModal.tsx`
  - *Acceptance Criteria:* Embedded micro-HTTP daemon running on local Wi-Fi port; serves staged files to mobile devices; dynamically renders SVG QR code for mobile scanning.
- **Task 5.3:** Direct NTFS USN Journal Change Stream Instant Search.
  - *Modules:* `crates/nexus-core/src/tools/usn.rs`, `src-tauri/src/commands/tools_cmds.rs`, `src/components/PowerToolsDialog.tsx`
  - *Acceptance Criteria:* Sub-10ms instantaneous filename pattern search across volume change journal stream records without full filesystem traversal.
- **Task 5.4:** Dev Drive Package Cache Orchestration & Neural Semantic Search UI.
  - *Modules:* `crates/nexus-core/src/tools/devdrive.rs`, `src/components/DevDriveModal.tsx`, `src/components/PowerToolsDialog.tsx`
  - *Acceptance Criteria:* Transparent NTFS directory junctions (`mklink /J`) relocating developer caches (Cargo, npm, pip/uv, NuGet, Gradle, Maven, Bun) to ReFS Dev Drive partitions without admin elevation; dedicated on-device neural semantic vector search UI with cosine similarity scores and token matching badges.


