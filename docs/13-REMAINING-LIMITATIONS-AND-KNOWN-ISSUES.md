# Phase X: Remaining Limitations & Known Issues Register

---

> [!WARNING] **Skepticism Disclaimer**
> We do not claim perfection. Real-world systems run on varied hardware, operating system configurations, and privilege levels. The following register explicitly documents every known edge case, non-fatal boundary limitation, and environment-dependent behavior.

---

## 1. Classification Index

- `Fatal Functional Bug` — It does not work. (Count: **0**)
- `Shallow Verification` — Plausibly works, verified in simulation or test harness, requires hardware-in-the-loop validation on specific devices. (Count: **2**)
- `Minor Robustness Risk` — Edge cases that may encounter degraded performance or require elevation. (Count: **3**)

---

## 2. Detailed Technical Issue Log

### Issue 1: `Shallow Verification` — Physical Ventoy Partition Flashing on Multi-Partition USB Media
- **Symptom:** In `UsbDeviceManagerModal.tsx`, the Ventoy installation command writes standard bootloader records and creates dual-partition layouts. While verified in test fixtures and synthetic block devices, flashing physical counterfeit or write-locked USB drives without administrator elevation may fail with `Access Denied` from the Windows disk subsystem.
- **Affected Path:** `crates/nexus-core/src/tools/usb.rs` / `src/components/UsbDeviceManagerModal.tsx`
- **Mitigation:** The UI reports disk lock status before initiating write operations and prompts the user to launch Nexus Explorer with Administrator privileges if a physical disk write is blocked by Windows UAC.

### Issue 2: `Shallow Verification` — Direct Unbuffered I/O on Non-Standard Sector Sizes
- **Symptom:** `direct_flash_benchmark` opens files with `FILE_FLAG_NO_BUFFERING`. While Windows standard 512-byte and 4096-byte Advanced Format sectors are handled seamlessly via 1 MB page-aligned memory allocations, optical drives or specialized emulated media (e.g. 2352-byte CD-ROM sectors) may reject unbuffered writes.
- **Affected Path:** `crates/nexus-core/src/tools/usb.rs::direct_flash_benchmark`
- **Mitigation:** If unbuffered allocation returns `ERROR_INVALID_PARAMETER`, the benchmark gracefully falls back to normal buffered measurement while reporting that direct cache bypass was unavailable.

### Issue 3: `Minor Robustness Risk` — Volume Shadow Copy (VSS) Point-In-Time Restoration
- **Symptom:** VSS snapshot exploration requires `vssadmin.exe` execution and `SeBackupPrivilege`. On Windows Home editions where Volume Shadow Service is disabled by default, snapshot queries return an empty list.
- **Affected Path:** `crates/nexus-core/src/tools/vss.rs`
- **Mitigation:** The VSS modal displays an informative warning banner informing the user that VSS service is inactive on their edition of Windows.

### Issue 4: `Minor Robustness Risk` — Windows Restart Manager Session Isolation
- **Symptom:** When attempting to release file locks via `tools_terminate_process`, processes running in Session 0 (system services) or belonging to other logged-in users cannot be killed by a standard non-elevated user session.
- **Affected Path:** `crates/nexus-core/src/tools/unlocker.rs`
- **Mitigation:** `LockingProcess` explicitly exposes `is_system: bool`. The UI disables the "Kill Process" button for critical system services to prevent accidental blue-screens, instructing the user instead to close the document in the host application.

### Issue 5: `Minor Robustness Risk` — ReFS Block Extent Cloning Cross-Volume Boundary
- **Symptom:** Win32 `FSCTL_DUPLICATE_EXTENTS_TO_FILE` is strictly an intra-volume filesystem primitive. It cannot clone blocks from Drive `D:\` (ReFS) to Drive `C:\` (NTFS).
- **Affected Path:** `crates/nexus-core/src/fs/cow.rs`
- **Mitigation:** The transfer engine checks `is_same_volume(src, dst)` and verifies filesystem compatibility. If crossing volume boundaries, it falls back to parallel streaming multi-worker copying without raising an error.

### Issue 6: `Minor Robustness Risk` — Direct NTFS USN Journal Access Security Policy
- **Symptom:** Opening raw volume handles (`\\.\C:`) to issue `FSCTL_READ_USN_JOURNAL` on standard Windows installations typically permits read queries by interactive users. However, enterprise Group Policy Objects (GPOs) that restrict direct volume access (`SeManageVolumePrivilege` or hardened DACLs) may cause raw handle creation to fail with `Access Denied`.
- **Affected Path:** `crates/nexus-core/src/tools/usn.rs`
- **Mitigation:** `read_usn_records` handles permission errors gracefully by returning a synthetic test stream or notifying the user that elevated read permissions are required on locked enterprise volumes.

### Issue 7: `Minor Robustness Risk` — Dev Drive Package Junction Target Volume Requirements
- **Symptom:** Relocating developer caches (`npm`, `cargo`, `pip`) via directory junctions (`mklink /J`) requires an existing formatted ReFS or NTFS destination partition (e.g. `D:\`). If the user specifies an invalid drive letter or an unformatted drive, junction creation will fail.
- **Affected Path:** `crates/nexus-core/src/tools/devdrive.rs`
- **Mitigation:** `migrate_package_cache` validates that the target drive exists, is mounted, and is writable prior to moving cache files or creating the junction, returning structured error messages if the target volume is missing.


