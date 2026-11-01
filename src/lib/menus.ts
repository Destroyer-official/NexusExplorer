import { useAppStore } from "@/state/store";
import type { ContextMenuItem } from "@/types";
import { ipc } from "@/lib/ipc";
import { toErrorMessage } from "@/lib/ipc";
import { dirname } from "@/lib/paths";

export function entryMenu(selectedPaths: string[], store: ReturnType<typeof useAppStore.getState>): ContextMenuItem[] {
  if (!selectedPaths || selectedPaths.length === 0) return [];
  const multi = selectedPaths.length > 1;
  const first = selectedPaths[0] || "";
  const targetDir = first ? dirname(first) : "";
  return [
    { label: multi ? `Open ${selectedPaths.length} items` : "Open", icon: "open", action: () => {
      const tab = store.tabs.find((t) => t.id === store.activeTabId);
      const entries = tab?.entries ?? [];
      selectedPaths.forEach((p) => {
        const e = entries.find((en) => en.path === p);
        if (e) void store.openEntry(e);
      });
    } },
    ...(!multi ? [{ label: "Open in new tab", icon: "newtab" as const, action: () => void store.openTab(first, true) }] : []),
    { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(multi ? targetDir : (store.tabs.find((t) => t.id === store.activeTabId)?.entries.find((e) => e.path === first)?.isDir ? first : targetDir)) },
    { label: "Reveal in Explorer", icon: "reveal", action: () => void ipc.revealInShell(first).catch((e) => store.pushToast("error", "Reveal failed", toErrorMessage(e))) },
    { separator: true },
    { label: "Copy", icon: "copy", shortcut: "Ctrl+C", action: () => store.copySelection(false) },
    { label: "Cut", icon: "cut", shortcut: "Ctrl+X", action: () => store.copySelection(true) },
    { label: "Paste into folder", icon: "paste", shortcut: "Ctrl+V", action: () => void store.pasteInto(targetDir) },
    { separator: true },
    ...(!multi ? [{ label: "Rename", icon: "rename" as const, shortcut: "F2", action: () => store.setRenaming(first) }] : []),
    { label: "Batch rename...", icon: "rename" as const, action: () => store.setBatchRenameOpen(true) },
    ...(!multi ? [{
      label: "Instant CoW Duplicate (Block Clone)",
      icon: "copy" as const,
      action: async () => {
        try {
          const dotIdx = first.lastIndexOf(".");
          const dest = dotIdx > 0 ? `${first.slice(0, dotIdx)}_clone${first.slice(dotIdx)}` : `${first}_clone`;
          const res = await ipc.toolsCloneFile(first, dest);
          store.pushToast("success", "File Cloned", `${res.isCowBlockCloned ? "Instant CoW extent cloned" : "Fast stream copied"} in ${res.elapsedMs} ms`);
          await store.refreshActive();
        } catch (e) {
          store.pushToast("error", "Clone failed", toErrorMessage(e));
        }
      }
    }] : []),
    {
      label: multi ? `Secure Shred ${selectedPaths.length} items (DoD 5220.22-M)` : "Secure Shred (DoD 5220.22-M)",
      icon: "permanent" as const,
      danger: true,
      action: () => {
        store.openConfirm({
          title: "Permanent DoD 5220.22-M Shredding",
          description: `Are you sure you want to permanently shred ${selectedPaths.length} item(s)? Data will be overwritten with 3 cryptographic passes and cannot be recovered by any forensic tool.`,
          confirmLabel: "Destroy Permanently",
          danger: true,
          onConfirm: async () => {
            try {
              const rep = await ipc.toolsShredPaths(selectedPaths, "dod3");
              store.pushToast("success", "Shredding Complete", `Destroyed ${rep.filesDestroyed} files (${(rep.totalBytesShredded / 1024).toFixed(0)} KB) in ${rep.elapsedMs} ms.`);
              await store.refreshActive();
            } catch (e) {
              store.pushToast("error", "Shred failed", toErrorMessage(e));
            }
          }
        });
      }
    },
    ...(!multi && first.toLowerCase().endsWith(".nxvault") ? [{
      label: "Decrypt Secure Vault...",
      icon: "open" as const,
      action: () => {
        store.openPrompt({
          title: "Unlock Secure Vault",
          description: "Enter the master passphrase to decrypt and authenticate this vault.",
          label: "Vault Passphrase",
          value: "",
          placeholder: "Passphrase...",
          confirmLabel: "Decrypt",
          onConfirm: async (pass) => {
            try {
              const dest = first.replace(/\.nxvault$/i, "");
              const isDir = store.tabs.find((t) => t.id === store.activeTabId)?.entries.find((e) => e.path === first)?.isDir ?? false;
              const res = isDir
                ? await ipc.toolsVaultDecryptDir(first, dest, pass)
                : await ipc.toolsVaultDecryptFile(first, dest, pass);
              store.pushToast("success", "Vault Decrypted", `Restored in ${res.elapsedMs} ms.`);
              await store.refreshActive();
            } catch (e) {
              store.pushToast("error", "Decryption failed", toErrorMessage(e));
            }
          }
        });
      }
    }] : [{
      label: multi ? `Encrypt ${selectedPaths.length} items into Secure Vault...` : "Encrypt into Secure Vault...",
      icon: "star" as const,
      action: () => {
        store.openPrompt({
          title: "Encrypt into AES-256-GCM Vault",
          description: "Set a master password to encrypt this item with BLAKE3 KDF and AES-256-GCM authentication.",
          label: "Master Password",
          value: "",
          placeholder: "Password...",
          confirmLabel: "Encrypt",
          validate: (val) => val.length < 6 ? "Password must be at least 6 characters" : null,
          onConfirm: async (pass) => {
            try {
              const destVault = `${first}.nxvault`;
              const isDir = store.tabs.find((t) => t.id === store.activeTabId)?.entries.find((e) => e.path === first)?.isDir ?? false;
              const res = isDir
                ? await ipc.toolsVaultEncryptDir(first, destVault, pass)
                : await ipc.toolsVaultEncryptFile(first, destVault, pass);
              store.pushToast("success", "Vault Created", `Protected ${(res.bytesProcessed / 1024).toFixed(1)} KB in ${res.elapsedMs} ms.`);
              await store.refreshActive();
            } catch (e) {
              store.pushToast("error", "Encryption failed", toErrorMessage(e));
            }
          }
        });
      }
    }]),
    {
      label: "Git: Stage File",
      icon: "refresh" as const,
      action: async () => {
        try {
          await ipc.toolsGitAction(targetDir, "stage", selectedPaths);
          store.pushToast("success", "Git Staged", `Added ${selectedPaths.length} item(s) to git index.`);
        } catch (e) {
          store.pushToast("error", "Git stage failed", toErrorMessage(e));
        }
      }
    },
    ...(!multi ? [{
      label: "Git: View File History & Blame",
      icon: "refresh" as const,
      action: () => store.openGitHistory(first),
    }] : []),
    {
      label: multi ? `Share ${selectedPaths.length} items via Local P2P Mesh...` : "Share via Local P2P Mesh...",
      icon: "copy" as const,
      action: () => store.openMeshShare(selectedPaths),
    },
    {
      label: multi ? `Send ${selectedPaths.length} items to Mobile via WebDrop (QR Code)...` : "Send to Mobile via WebDrop (QR Code)...",
      icon: "open" as const,
      action: () => store.setWebdropOpen(true),
    },
    {
      label: multi ? `Scan ${selectedPaths.length} items for Secrets & DLP Leaks...` : "Scan for Secrets & DLP Leaks...",
      icon: "info" as const,
      action: () => store.setDlpOpen(true),
    },
    ...(!multi ? [{
      label: "Mount as Virtual Drive...",
      icon: "open" as const,
      action: () => store.setMounterOpen(true),
    }] : []),
    {
      label: multi ? `Stage ${selectedPaths.length} items into Clipboard History Ring...` : "Stage in Clipboard History Ring...",
      icon: "copy" as const,
      action: () => store.setClipboardHistoryOpen(true),
    },
    {
      label: "AI Copilot: Ask for Action (Ctrl+K)...",
      icon: "terminal" as const,
      action: () => store.openCopilot(),
    },
    { label: multi ? `Delete ${selectedPaths.length} items` : "Delete", icon: "delete", shortcut: "Del", danger: true, action: () => void store.startDelete(selectedPaths, false) },
    { label: "Delete permanently", icon: "permanent", danger: true, action: () => void store.startDelete(selectedPaths, true) },
    { separator: true },
    { label: "Copy path", icon: "copy", action: () => void store.copyText(selectedPaths.join("\n"), "Path copied") },
    { label: "Add to favorites", icon: "star", action: () => selectedPaths.forEach((p) => void store.addBookmark(p)) },
    {
      label: multi ? `Add ${selectedPaths.length} items to staging shelf` : "Add to staging shelf",
      icon: "copy" as const,
      shortcut: "Ctrl+Shift+X",
      action: () => store.addStaged(selectedPaths),
    },
    {
      label: "Assign tag...",
      icon: "star" as const,
      action: () => {
        store.openPrompt({
          title: "Assign a tag",
          description: "Tags are stored in Nexus and shown as coloured dots on each item. Separate several tags with commas.",
          label: "Tag name(s)",
          value: "",
          placeholder: "important, invoice",
          confirmLabel: "Apply tag",
          validate: (value) => (value.trim() ? null : "Enter at least one tag name"),
          onConfirm: async (value) => {
            const names = value.split(",").map((n) => n.trim()).filter(Boolean);
            for (const name of names) {
              await store.assignTag(selectedPaths, name, tagColor(name));
            }
          },
        });
      },
    },
    {
      label: "Add note...",
      icon: "info" as const,
      action: () => {
        void (async () => {
          let existing = "";
          try {
            const note = await ipc.toolsGetNote(first);
            existing = note?.noteMarkdown ?? "";
          } catch {
            existing = "";
          }
          store.openPrompt({
            title: "File note",
            description: "Notes are stored in Nexus and never written into the file itself.",
            label: "Note",
            value: existing,
            placeholder: "Why this file matters…",
            confirmLabel: "Save note",
            validate: (value) => (value.trim() ? null : "Enter a note or use Remove note"),
            onConfirm: async (value) => {
              await ipc.toolsSetNote(first, value.trim());
              store.pushToast("success", "Note saved", first);
            },
          });
        })();
      },
    },
    {
      label: "Remove note",
      icon: "delete" as const,
      action: async () => {
        try {
          const removed = await ipc.toolsDeleteNote(first);
          store.pushToast(removed ? "success" : "info", removed ? "Note removed" : "No note stored", first);
        } catch (e) {
          store.pushToast("error", "Could not remove note", toErrorMessage(e));
        }
      },
    },
    {
      label: "Open smart folders...",
      icon: "newtab" as const,
      action: () => store.setSmartFolderOpen(true),
    },
    {
      label: "Power tools...",
      icon: "terminal" as const,
      shortcut: "Ctrl+Alt+P",
      action: () => store.setPowerTools(true),
    },
    {
      label: "Fingerprint manifest for this folder...",
      icon: "hash" as const,
      action: () => store.setPowerTools(true, "hash"),
    },
    ...(!multi && /\.(zip|7z|rar|tar|gz|tgz|bz2|xz|iso|cab|wim)$/i.test(first) ? [
      {
        label: "Browse archive",
        icon: "open" as const,
        action: () => store.setArchivePath(first),
      },
      {
        label: "Extract here",
        icon: "open" as const,
        action: async () => {
          try {
            const res = await ipc.toolsArchiveExtractAny(first, targetDir);
            store.pushToast("success", "Archive extracted", `${res.filesProcessed} files in ${res.elapsedMs} ms`);
            await store.refreshActive();
          } catch (e) {
            store.pushToast("error", "Extraction failed", toErrorMessage(e));
          }
        }
      },
      {
        label: "Inspect Archive Details",
        icon: "info" as const,
        action: async () => {
          try {
            const meta = await ipc.toolsArchiveListAny(first);
            store.pushToast(
              "info",
              "Archive Details",
              `${meta.totalFiles} files, ${meta.totalDirectories} folders (${(meta.uncompressedBytes / (1024 * 1024)).toFixed(1)} MB uncompressed)`
            );
          } catch (e) {
            store.pushToast("error", "Listing failed", toErrorMessage(e));
          }
        }
      }
    ] : [
      {
        label: multi ? `Compress ${selectedPaths.length} items to ZIP` : "Compress to ZIP",
        icon: "open" as const,
        action: async () => {
          try {
            const baseName = multi ? "archive.zip" : `${first.split(/[\/\\]/).pop()}.zip`;
            const destZip = `${targetDir}\\${baseName}`;
            const res = await ipc.toolsArchiveCreate(selectedPaths, destZip, 6);
            store.pushToast("success", "Archive Created", `Compressed ${res.filesProcessed} files into ${baseName}`);
            await store.refreshActive();
          } catch (e) {
            store.pushToast("error", "Archive creation failed", toErrorMessage(e));
          }
        }
      }
    ]),
    {
      label: multi ? `Calculate sizes for ${selectedPaths.length} items` : "Calculate folder size",
      icon: "info" as const,
      action: () => {
        selectedPaths.forEach((p) => void store.calculateFolderSize(p));
      },
    },
    ...(!multi ? [
      ...(first.toLowerCase().endsWith(".par2") ? [
        {
          label: "Verify Parity Set (PAR2)",
          icon: "info" as const,
          action: async () => {
            try {
              const rep = await ipc.toolsPar2Inspect(first);
              if (rep.isValid) {
                store.pushToast(
                  "info",
                  "PAR2 Integrity Verified",
                  `Recovery Set ID: ${rep.recoverySetId.slice(0, 16)}... | ${rep.totalDataFiles} files protected with ${rep.recoverySlicesAvailable} recovery slices.`
                );
              } else {
                store.pushToast("warning", "PAR2 Check Warning", rep.error || "Invalid PAR2 file structure.");
              }
            } catch (e) {
              store.pushToast("error", "PAR2 query failed", toErrorMessage(e));
            }
          }
        }
      ] : []),
      { label: "Hash (SHA-256)", icon: "hash" as const, action: async () => {
        try {
          const h = await ipc.hashFile(first, "sha256");
          store.pushToast("success", "SHA-256", `${h.digest}  (${h.elapsedMs} ms)`);
        } catch (e) { store.pushToast("error", "Hash failed", toErrorMessage(e)); }
      } },
      ...(first.match(/\.(png|jpe?g|bmp|tiff|tif|webp|gif)$/i) ? [
        {
          label: "Optimize image…",
          icon: "info" as const,
          action: () => store.setPowerTools(true, "images"),
        },
      ] : []),
      ...(first.match(/\.(png|jpe?g|bmp|tiff|webp)$/i) ? [
        {
          label: "OCR: Extract Text from Image",
          icon: "open" as const,
          action: async () => {
            try {
              const res = await ipc.toolsOcrImage(first);
              if (res.extractedText.trim()) {
                store.pushToast("success", "OCR Extracted Text", res.extractedText.slice(0, 150));
                await store.copyText(res.extractedText, "OCR text copied to clipboard");
              } else {
                store.pushToast("info", "OCR Scan Completed", "No text detected in image.");
              }
            } catch (e) {
              store.pushToast("error", "OCR extraction failed", toErrorMessage(e));
            }
          }
        }
      ] : []),
      {
        label: "Cryptographic Provenance: Audit & Record",
        icon: "star" as const,
        action: async () => {
          try {
            const ev = await ipc.toolsProvenanceRecord("AUDIT_CHECK", first);
            store.pushToast("success", "Provenance Block Appended", `Block #${ev.sequence} Hash: ${ev.chainHash.slice(0, 16)}...`);
          } catch (e) {
            store.pushToast("error", "Provenance record failed", toErrorMessage(e));
          }
        }
      },
      { label: "Inspect Signature (Sniffer)", icon: "info" as const, action: async () => {
        try {
          const res = await ipc.toolsSniffFile(first);
          if (res.isSpoofed) {
            store.pushToast("warning", "Extension Spoofing Detected!", `Declared: .${res.declaredExtension}, Actually: ${res.detectedFormat} (${res.detectedMime})`);
          } else {
            store.pushToast("info", "Signature Match", `${res.detectedFormat} (${res.detectedMime})`);
          }
        } catch (e) { store.pushToast("error", "Sniffer failed", toErrorMessage(e)); }
      } },
      { label: "Unblock (Remove Mark-of-the-Web)", icon: "info" as const, action: async () => {
        try {
          const removed = await ipc.toolsUnblockFile(first);
          if (removed) {
            store.pushToast("success", "File Unblocked", "Zone.Identifier stream removed.");
          } else {
            store.pushToast("info", "No Block Found", "File does not contain Zone.Identifier stream.");
          }
        } catch (e) { store.pushToast("error", "Unblock failed", toErrorMessage(e)); }
      } },
      { label: "Check File Locks (Unlocker)", icon: "info" as const, action: async () => {
        try {
          const procs = await ipc.toolsGetLockingProcesses(first);
          if (procs.length === 0) {
            store.pushToast("info", "File Not Locked", "No processes currently hold locks on this file.");
          } else {
            const list = procs.map((p) => `${p.name} (PID ${p.pid})`).join(", ");
            store.pushToast("warning", `Locked by ${procs.length} process(es)`, list);
          }
        } catch (e) { store.pushToast("error", "Lock query failed", toErrorMessage(e)); }
      } },
    ] : []),
    ...(selectedPaths.length === 2 ? [{
      label: "Compare Files (Binary Diff)",
      icon: "info" as const,
      action: async () => {
        try {
          const diff = await ipc.toolsCompareBinary(selectedPaths[0], selectedPaths[1], 20);
          if (diff.isIdentical) {
            store.pushToast("success", "Files are 100% Identical", "Binary match verified.");
          } else {
            store.pushToast("warning", `Binary Difference (${diff.matchingPercentage.toFixed(1)}% match)`, `${diff.totalDifferencesBytes} bytes differ.`);
          }
        } catch (e) { store.pushToast("error", "Compare failed", toErrorMessage(e)); }
      }
    }] : []),
    ...(!multi ? [{
      label: "Open in Hex Editor",
      icon: "terminal" as const,
      action: () => store.setHexEditorPath(first),
    }] : []),
    { label: "Properties", icon: "info", shortcut: "Alt+Enter", action: () => store.setPropertiesPath(first) },
  ];
}

export function backgroundMenu(path: string, store: ReturnType<typeof useAppStore.getState>): ContextMenuItem[] {
  return [
    { label: "New folder", icon: "newfolder", shortcut: "Ctrl+Shift+N", action: () => void store.createFolder() },
    { label: "New file", icon: "newfile", action: () => void store.createFile() },
    { separator: true },
    { label: "Paste", icon: "paste", shortcut: "Ctrl+V", action: () => void store.pasteInto(path) },
    { label: "Refresh", icon: "refresh", shortcut: "F5", action: () => void store.refreshActive() },
    { separator: true },
    { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(path) },
    { label: "Reveal in Explorer", icon: "reveal", action: () => void ipc.revealInShell(path).catch((e) => store.pushToast("error", "Reveal failed", toErrorMessage(e))) },
    { separator: true },
    { label: "Audit Directory for Spoofed Files", icon: "info", action: async () => {
      try {
        const results = await ipc.toolsAuditDirectory(path);
        const spoofed = results.filter((r) => r.isSpoofed);
        if (spoofed.length === 0) {
          store.pushToast("success", "Directory Audit Clean", `Scanned ${results.length} files. Zero spoofed extensions found.`);
        } else {
          store.pushToast("warning", `Security Alert: ${spoofed.length} Spoofed File(s)!`, spoofed.map((s) => s.fileName).slice(0, 3).join(", "));
        }
      } catch (e) {
        store.pushToast("error", "Audit failed", toErrorMessage(e));
      }
    } },
    { separator: true },
    { label: "Dev Drive & Storage Acceleration...", icon: "info" as const, action: () => store.setDevDriveOpen(true) },
    { label: "Cryptographic Provenance Audit Ledger...", icon: "star" as const, action: () => store.setProvenanceOpen(true) },
    { label: "Remote SFTP / SSH Filesystem Explorer...", icon: "open" as const, action: () => store.setSftpOpen(true) },
    { label: "Disk Space Treemap Analyzer...", icon: "info" as const, action: () => store.setTreemapOpen(true) },
    { separator: true },
    { label: "Developer Cache & Build Artifact Janitor...", icon: "delete" as const, action: () => store.setJanitorOpen(true) },
    { label: "VDFS Distributed Namespace & Storage...", icon: "open" as const, action: () => store.setVdfsOpen(true) },
    { label: "Mobile QR AirDrop (WebDrop Portal)...", icon: "open" as const, action: () => store.setWebdropOpen(true) },
    { label: "Mount Folder / Archive as Virtual Drive...", icon: "open" as const, action: () => store.setMounterOpen(true) },
    { label: "Visual Time Machine Snapshot Slider...", icon: "info" as const, action: () => store.setTimeMachineOpen(true) },
    { separator: true },
    { label: "Power tools...", icon: "terminal" as const, shortcut: "Ctrl+Alt+P", action: () => store.setPowerTools(true) },
    { label: "Project scaffolding...", icon: "newfolder" as const, shortcut: "Ctrl+Shift+B", action: () => store.setScaffoldOpen(true) },
    { label: "Smart folders...", icon: "newtab" as const, shortcut: "Ctrl+Shift+M", action: () => store.setSmartFolderOpen(true) },
    { label: "Flat branch view", icon: "sort" as const, shortcut: "Ctrl+Shift+F", action: () => void store.toggleFlatView() },
    { label: "Open docked terminal", icon: "terminal" as const, action: () => store.setTerminalOpen(true) },
    { separator: true },
    { label: "Select all", icon: "info", shortcut: "Ctrl+A", action: () => store.selectAll() },
    { label: "Toggle hidden files", icon: "preview", action: () => void store.updateSettings({ showHidden: !store.settings.showHidden }) },
  ];
}

/** Deterministic tag colour so the same tag always renders the same dot. */
export function tagColor(name: string): string {
  const palette = ["#7c6cff", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#f87171", "#a78bfa", "#2dd4bf"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}