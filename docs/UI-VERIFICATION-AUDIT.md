# UI verification audit — 2026-11-02

## Scope and evidence

This is a UI reliability and design audit, not certification that every native storage feature works on every machine. Browser preview uses mock data. Panel rendering and interaction tests do not establish that remote services, hardware operations, or destructive actions succeed in the desktop runtime.

## Changes made

- Consolidated specialist actions under Tools; retained visible file navigation, New folder, view controls, sort, preview, and transfers. Replaced the Settings text glyph with a consistent icon.
- Added keyboard-operable sidebar places, breadcrumbs, and tabs; named previously unnamed dialog controls.
- Fixed Ctrl+B, Ctrl+Shift+R and Backspace; prevented file shortcuts from acting behind dialogs and preserved text-field undo/redo.
- Made naming dialogs submit current input once, disable controls while pending, and retain errors instead of closing silently.
- Shared rename input between List and Grid. Escape cancels; Enter and blur cannot double-submit.
- Implemented folder-name filtering for List, Grid and Columns, preserved recursive-search queries, and handed typed terminal commands to the terminal input for review.
- Replaced duplicate secondary-pane instances with independent folder/selection state; scoped keyboard copy/cut/paste/delete/open to each pane and corrected triple-pane geometry. Auxiliary panes refresh after completed transfers and show listing errors.
- Corrected stale child-column responses and exposed column loading errors.
- Added explicit confirmation before build-cache deletion; confirmation dialogs appear above the originating tool.
- Corrected snapshot restoration wording: it restores a selected file to a sibling copy, not the entire folder or an actual browsed historical filesystem.
- Removed invented transfer telemetry, inferred acceleration modes, unconditional integrity-verification claims, and bandwidth buttons that did not control the backend. Missing metrics are marked as not reported. Transfer details default to the simpler view.
- Constrained small-window layouts and kept advanced functionality in the existing Tools menu and command palette.

## Verification matrix

| Area | Evidence | Limits |
| --- | --- | --- |
| Tools menu | Automated App interaction tests open all 17 tool destinations and verify rendered panels | Opening a panel does not validate its native operation |
| Power Tools | All 13 tabs render their controls in automated tests | Native calls, destructive operations and OS prerequisites are separate |
| Explorer views | Automated switching among List, Grid and Columns | Large-directory performance not benchmarked |
| New folder / Grid rename | Browser creation and rename to `UI audit folder`; regression tests for current input, duplicate submission and cancellation | Browser fixture, not a native filesystem mutation |
| Filtering/search | Browser filter reduces visible files; automated query propagation and dismissal | Recursive search engine has separate Rust tests |
| Split panes | Browser triple layout and independent child navigation; automated independent navigation and clipboard selection | Auxiliary panes are not virtualized; feature parity with primary pane is incomplete |
| Toolbar / titlebar | Accessible-name checks; sidebar, preview, transfer toggles; window-preview recovery tests | Native minimize/maximize/close not fully exercised in this audit |
| Dialogs | Settings dismissal and shortcut isolation; failed confirmations retain errors | Complete focus-trap and screen-reader audit remains outstanding |
| Terminal input | Typed command preserved for review in the dock | Shell execution not exercised through native UI here |
| Transfer display | Regression verifies high speed does not invent hardware telemetry | Bandwidth control is unavailable; missing backend metrics stay unknown |
| Native startup | Built and launched desktop executable; inspected rendered shell | Native automation stopped after concurrent user input was detected |

## Outstanding verification and known limitations

- Native UI end-to-end copy, move, conflict resolution, undo/redo, trash, archive/vault, and recovery workflows need isolated filesystem fixtures. `.ui-audit` contains small files prepared for this purpose; no native destructive tests were performed.
- ReFS cloning, USN, VSS restores, BitLocker, mount/unmount, file locks, and erasure recovery need suitable volumes, permissions and fixtures.
- SFTP, P2P and QR sharing need configured endpoints/peers and controlled network tests.
- Physical gamepad interaction, high-DPI/multiple monitors, 100,000-entry rendering, and accessibility beyond the tested controls remain unverified.
- Grid and auxiliary panes currently render their full entry sets; no 100,000-file / 60-FPS claim is justified.
- Auxiliary pane context menus expose common operations, but full primary-pane parity, independent sorting/preview and persistence remain work.
- A clean Rust Clippy gate is not established: the earlier workspace audit reported seven existing warnings promoted to errors in `ai/agent.rs` and `ai/bandit.rs`. Those Rust modules were not changed in this UI pass.
- Existing TypeScript `any` usage elsewhere in the project was not eliminated by this audit.

## Checks

- Frontend suite: 84 tests passed across 11 files at the audit checkpoint.
- TypeScript / production build and Rust workspace check: final results recorded in the chat.
- Rust test suite previously passed 114 tests; no Rust source changed in this UI pass.
- Production bundling may report large-chunk and mixed static/dynamic import warnings; these are not performance measurements.

### Final rerun

- `npm test -- --maxWorkers=1`: 84/84 passed in 11 files after all code edits.
- An overlapping build/check attempt exhausted available system memory. The native test process was stopped, and tests were rerun serially. This environmental failure was not counted as a successful check.
- The native test app was closed after the interruption/resource issue; the browser preview remains the review surface.

## Desktop bug-fix verification — 2026-11-03

This checkpoint supersedes the earlier browser-only status for the specific fixes below.

- Bundled `public/icons/filetypes` SVGs are now used by the shared icon renderer, including grid folders. The manifest covers 893 existing assets; unknown types keep a fallback glyph.
- Breadcrumbs are clickable without initiating a file drag. Address editing commits once, cancels on Escape, and selects the path on focus.
- Internal and Windows drops on the right preview open the dropped file or a separate folder browser. Auxiliary rows can initiate drags and folders can receive them. Drop onto staging still stages items.
- Copilot ignores stale analysis responses, reports planning errors, guards repeated execution, and lets users click matched files to reveal/select them. Rust parsing now handles “larger/smaller than” and wildcard extensions; explicit searches cannot become archive/shred commands from matching keywords.
- Cargo enables the custom protocol by default so the EXE embeds the built frontend instead of requiring a development server. Run `npm run build` before direct Cargo builds; `npm run desktop:build` performs both stages for a release package.
- Single-instance relaunch restores a minimized window and excludes argv[0] from paths to open.

Validation: 87 frontend tests in 12 files passed; the 8 interaction regressions were rerun after the final address-focus change. All 10 Rust AI tests passed, including the new search parsing regression. Production frontend build passed with existing chunk warnings.

Native checks used `target/debug/nexus-explorer.exe` at `http://tauri.localhost/`, with real `.ui-audit` fixtures: maximize and minimize, typed path navigation, folder and file drops into the right preview, natural-language JSON search, and clicking a matched result to select it. Browser inspection also confirmed that SVG images loaded and breadcrumb clicks navigated correctly. This is a standalone development-profile executable, not an installer or a claim that every advanced facility has been exercised.
