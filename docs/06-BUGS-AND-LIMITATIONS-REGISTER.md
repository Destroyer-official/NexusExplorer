# Phase III: Existing Bugs, Technical Debt, & Limitations Register

---

## 1. Register of Resolved Defects & Technical Debt

| ID | Module / File | Description | Root Cause | Status & Verification |
| :---: | :--- | :--- | :--- | :--- |
| **BUG-01** | `crates/nexus-core/src/ai/agent.rs` | Redundant / identical `if` branch structure in directory filter loop. | Duplicate condition branches checking `is_folder_query` and `is_dir`. | **Resolved & Verified:** Consolidated into single boolean expression. |
| **BUG-02** | `crates/nexus-core/src/ai/agent.rs` | Suboptimal candidate sort using manual comparator instead of `sort_by_key`. | Clippy warning `unnecessary_sort_by`. | **Resolved & Verified:** Refactored to `sort_by_key(|a| std::cmp::Reverse(a.size))`. |
| **BUG-03** | `crates/nexus-core/src/ai/agent.rs` | Verbose `.map_or(false, ...)` on archive extension filter. | Clippy warning `unnecessary_map_or`. | **Resolved & Verified:** Refactored to `.is_some_and(|ext| ext == "zip")`. |
| **BUG-04** | `crates/nexus-core/src/ai/intent.rs` | Inefficient `.split().last()` on double-ended string iterators. | Traversing entire forward iterator when `next_back()` is $O(1)$. | **Resolved & Verified:** Replaced with `.split('.').next_back()`. |
| **BUG-05** | `crates/nexus-core/src/fs/listing.rs` | Redundant iterator traversal in WPD path cleaner. | `.split(['/', '\\']).last()` instead of `.next_back()`. | **Resolved & Verified:** Replaced with `.next_back()`. |
| **BUG-06** | `crates/nexus-core/src/state/settings.rs` | Field reassignment outside struct initializer in test cases. | Creating default struct and subsequently overwriting fields. | **Resolved & Verified:** Direct struct initialization with `..Default::default()`. |
| **BUG-07** | `crates/nexus-core/src/tools/usb.rs` | Redundant `format!` on static error string. | Clippy `useless_format` in Win32 volume lock handler. | **Resolved & Verified:** Replaced with `.to_string()`. |
| **BUG-08** | `crates/nexus-core/src/transfer/engine.rs` | Uncollapsed `match` branch on collision resolution. | Nested `if dst.exists()` inside match arm. | **Resolved & Verified:** Collapsed into `"overwrite" if dst.exists() =>`. |
| **BUG-09** | `crates/nexus-core/src/transfer/engine.rs` | Manual ASCII case comparison on drive letters. | Using `.to_ascii_uppercase() == ...` instead of `.eq_ignore_ascii_case()`. | **Resolved & Verified:** Refactored to `a_chars[0].eq_ignore_ascii_case(&b_chars[0])`. |
| **BUG-10** | `src-tauri/src/commands/tools_cmds.rs` | USB hardware intelligence commands missing native Tauri bridge. | Commands existed in `nexus-core` and mock backend, but lacked Tauri invoke registration. | **Resolved & Verified:** Registered full suite of native USB commands (`usb_list_devices`, `usb_eject_device`, `usb_benchmark`, etc.). |
| **BUG-11** | `src-tauri/src/commands/tools_cmds.rs` | Hardware write errors and flash integrity failures swallowed with fabricated 100% success. | `.unwrap_or(...)` in `usb_benchmark` and `.unwrap_or_else(...)` in `usb_integrity_test` returning fake 420 MB/s and 0 bit-rot on failed drives. | **Resolved & Verified:** Proper error propagation with `map_err(...)` so write-protected or bad media return real errors. |
| **BUG-12** | `src-tauri/src/commands/tools_cmds.rs` | Internal secondary hard drive `D:` detected as removable Samsung USB flash drive. | Hardcoded `|| d.path.starts_with("D:")` test hack in `usb_list_devices()` enumeration. | **Resolved & Verified:** Strictly filtered to real removable media (`d.is_usb || d.drive_type == "removable"`). |
| **BUG-13** | `crates/nexus-core/src/tools/usb.rs` | Placeholder `forensic_sanitize_volume` hardcoded 124 GB without wiping target files. | Implementation ignored `_target_dir` and returned synthetic certificate without performing sanitization. | **Resolved & Verified:** Connected to `shredder::shred_paths`, securely executing multi-pass wiping (`Zero`, `Random`, `DoD3Pass`, `Gutmann35Pass`) and returning real destroyed bytes count. |
| **BUG-14** | `src-tauri/src/commands/tools_cmds.rs` | Destructive formatting and disk burning permitted against internal system volumes. | Absence of drive type guard checks in `usb_format` and `usb_burn_disk_image`. | **Resolved & Verified:** Enforced drive type verification refusing destructive operations on non-removable/system drives. |
| **BUG-15** | `crates/nexus-core/src/tools/usb.rs` | `crates/nexus-core/src/tools/usb.rs` had zero unit tests and zero-byte/invalid letter panics. | Module lacked unit test suite and input boundary checks for drive letters and 0-byte benchmark sizes. | **Resolved & Verified:** Added 6 comprehensive unit tests in `usb::tests` covering benchmark, counterfeit verification, real file sanitization, and invalid drive letters. |

---

## 2. Register of Platform Architectural Constraints

| Constraint ID | Domain | Underlying Cause | Mitigation / Fallback Strategy |
| :---: | :--- | :--- | :--- |
| **LIM-01** | **ReFS Block Cloning** | Windows filesystem limitation: `FSCTL_DUPLICATE_EXTENTS_TO_FILE` is only supported on ReFS and Dev Drive volumes; standard NTFS does not support native zero-copy extent sharing. | Core automatically detects volume filesystem type; falls back transparently to optimized multi-worker buffer copying on NTFS/FAT32. |
| **LIM-02** | **Volume Shadow Copy (VSS)** | VSS snapshot exploration requires Windows Administrator elevation (`SeBackupPrivilege`). | When un-elevated, VSS commands return a clear elevation prompt with instructions rather than crashing. |
| **LIM-03** | **BitLocker Management** | BitLocker is restricted to Windows Pro, Enterprise, and Education editions (`manage-bde.exe`). | Core verifies OS edition and binary availability before attempting volume lock/unlock operations. |
| **LIM-04** | **Restart Manager (`RstrtMgr.dll`)** | System processes running under `NT AUTHORITY\SYSTEM` or Session 0 cannot be terminated by standard user privileges. | Lock hunter flags `isSystem: true` on system handles and prevents unsafe process termination that would cause a BSOD. |
| **LIM-05** | **Direct Unbuffered I/O on USB** | `FILE_FLAG_NO_BUFFERING` requires sector-aligned buffer addresses and I/O sizes matching physical sector boundaries (typically 512 or 4096 bytes). | Benchmark routines use page-aligned 1 MB buffers, ensuring strict alignment with all flash media. |

