# Phase III: Identified User Problem Catalogue

---

## 1. Everyday Desktop Users
- **Problem 1.1: File Explorer Sluggishness & Freezes:** Users experience window freezing when opening folders with large numbers of media files or disconnected network drives.  
  *Nexus Solution:* Background worker thread pool for drive enumeration and directory stat polling, never blocking the main UI thread.
- **Problem 1.2: Accidental File Overwrites & Deletions:** Default operating system copy dialogues often present ambiguous conflict prompts ("Replace or Skip?"), leading to inadvertent data loss.  
  *Nexus Solution:* Granular conflict modal (`ConflictDialog.tsx`) offering auto-renaming sibling copies, side-by-side date/size comparisons, and a universal undo stack.
- **Problem 1.3: Unblocking Downloaded Files:** Files downloaded from the internet are marked with "Zone.Identifier" and blocked from execution without warning.  
  *Nexus Solution:* One-click Alternate Data Stream unblocking via `tools_unblock_file`.

---

## 2. Software Developers & Engineers
- **Problem 2.1: Disconnected Terminal Workflows:** Developers constantly navigate to a project folder in their file manager, only to open a separate external terminal and re-type or paste the path.  
  *Nexus Solution:* Embedded docked terminal (`TerminalDock.tsx` / `Ctrl+\``) synchronized in real-time with the active directory.
- **Problem 2.2: Build Cache Disk Bloat:** Projects accumulate gigabytes of disposable build artifacts (`node_modules`, `target`, `.venv`, `.next`, `dist`, `bin`, `obj`) across hundreds of repos, exhausting SSD storage.  
  *Nexus Solution:* Project Janitor (`JanitorModal.tsx`) sweeps directories, calculates reclaimed space, and safely cleans artifacts with confirmation.
- **Problem 2.3: Uncommitted Secrets in Working Copies:** Accidental commits of `.env` files, API tokens (OpenAI, Anthropic, GitHub), and AWS keys.  
  *Nexus Solution:* Integrated DLP & Secret Leak Scanner (`DlpScannerModal.tsx`) identifies tokens across file trees before commits occur.
- **Problem 2.4: Sluggish Repository Duplication:** Copying large source trees or virtual disk images takes minutes and wastes disk space.  
  *Nexus Solution:* ReFS Block Extent Cloning (`tools_clone_file`) creates immediate zero-copy clones on ReFS and Dev Drive volumes in milliseconds.

---

## 3. System Administrators & IT Professionals
- **Problem 3.1: "File in Use" Lock Frustration:** Inability to delete, rename, or eject removable drives because a mystery background process holds an open handle.  
  *Nexus Solution:* Windows Restart Manager Process Unlocker (`unlocker.rs` / `tools_get_locking_processes`) identifies the exact PID and process name and terminates or releases it on demand.
- **Problem 3.2: Storage Drive Capacity Confusion:** Hard drives fill up with hidden nested structures that cannot be located without specialized third-party tools (WinDirStat, TreeSize).  
  *Nexus Solution:* Storage Treemap Visualizer (`TreemapModal.tsx`) maps folder capacities into an interactive visual treemap.
- **Problem 3.3: Inability to Audit File History:** Finding out who modified or deleted a file after the fact.  
  *Nexus Solution:* Native NTFS USN Change Journal query engine (`usn.rs`) streams filesystem transaction records directly from NTFS volume metadata.

---

## 4. Security Researchers & Digital Forensics Investigators
- **Problem 4.1: Extension Spoofing Exploits:** Malicious executables disguised as documents (`invoice.pdf.exe` or spoofed MIME headers).  
  *Nexus Solution:* Forensic Sniffer (`sniffer.rs`) validates file headers against 40+ canonical magic-byte signatures and flags mismatched extensions.
- **Problem 4.2: Insecure Deletion Residuals:** Standard file deletion merely frees directory entries; sectors remain fully recoverable via basic carving tools.  
  *Nexus Solution:* Certified DoD 5220.22-M 3-pass and Gutmann 35-pass secure file shredder (`shredder.rs`) with sector zeroization and pseudo-random overwrite.
- **Problem 4.3: Counterfeit USB Flash Drives:** High rates of fake high-capacity flash drives purchased online (spoofed firmware claiming 2TB on a 32GB chip).  
  *Nexus Solution:* Cryptographic sector pattern verification (`verify_fake_flash` in `usb.rs`) testing actual unbuffered flash boundaries to detect hardware spoofing.

---

## 5. Power Users & Keyboard-First Enthusiasts
- **Problem 5.1: Excessive Mouse Reliance:** Modern file managers require constant clicking for simple selection, renaming, and filtering tasks.  
  *Nexus Solution:* Total Commander–style orthodox pattern selection (`+` / `*`), full Vim navigation keys (`h`, `j`, `k`, `l`, `gg`, `G`, `y`, `d`, `p`), and FAYT query hotkeys.
- **Problem 5.2: Fragmented File Collection:** Moving files scattered across five folders to a new destination requires five separate window openings and drag operations.  
  *Nexus Solution:* Staging Shelf widget (`StagingShelfWidget.tsx`) allows staging files from disparate paths, and then moving or archiving them in a single batch operation.

