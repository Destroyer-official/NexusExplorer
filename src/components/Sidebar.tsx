import { FolderClosed, Star, HardDrive, Clock, Plus, Sparkles, Usb, Cpu, Smartphone, Terminal, Globe, Zap } from "lucide-react";
import { useAppStore } from "@/state/store";
import { formatBytes } from "@/lib/format";
import { samePath } from "@/lib/paths";
import { ipc } from "@/lib/ipc";

export default function Sidebar() {
  const store = useAppStore();
  const activePath = store.tabs.find((t) => t.id === store.activeTabId)?.path ?? "";
  const width = store.sidebarWidth;

  const handleResizerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = useAppStore.getState().sidebarWidth;
    const target = e.currentTarget;
    target.classList.add("resizing");
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(160, Math.min(500, startW + (ev.clientX - startX)));
      useAppStore.getState().setSidebarWidth(next);
    };

    const onUp = (ev: PointerEvent) => {
      target.classList.remove("resizing");
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (!store.sidebarOpen) return null;

  const Item = ({ path, label, icon }: { path: string; label: string; icon?: React.ReactNode }) => (
    <button type="button"
      className={`side-item ${samePath(activePath, path) ? "active" : ""}`}
      onClick={() => void store.navigateTo(path)}
      onContextMenu={(e) => {
        e.preventDefault();
        store.openContextMenu(e.clientX, e.clientY, [
          { label: "Open", icon: "open", action: () => void store.navigateTo(path) },
          { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(path, true) },
          { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(path) },
          { separator: true },
          { label: "Remove from favorites", icon: "star", action: () => void store.removeBookmark(store.bookmarks.find((b) => samePath(b.path, path))?.id ?? "") },
        ]);
      }}
      data-drop-path={path}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {icon ?? <FolderClosed size={15} />}
      <span className="side-item-name">{label}</span>
    </button>
  );

  return (
    <div className="sidebar" style={{ width }}>
      <div className="sidebar-inner">
        <div className="side-section">
          <div className="side-heading">Quick access</div>
          {(store.knownFolders ?? []).map((f) => (
            <Item key={f.id} path={f.path} label={f.label} icon={<FolderClosed size={15} style={{ color: "var(--accent-soft)" }} />} />
          ))}
        </div>

        {(store.bookmarks ?? []).length > 0 && (
          <div className="side-section">
            <div className="side-heading">Favorites</div>
            {(store.bookmarks ?? []).map((b) => (
              <Item key={b.id} path={b.path} label={b.name} icon={<Star size={15} style={{ color: "var(--warning)" }} />} />
            ))}
          </div>
        )}

        <div className="side-section">
          <div className="side-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Smart folders</span>
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => store.setSmartFolderOpen(true)} title="Manage smart folders (Ctrl+Shift+M)">
              <Plus size={12} />
            </button>
          </div>
          {(store.smartFolders ?? []).length === 0 && (
            <div className="side-meta" style={{ padding: "2px 12px 6px" }}>Save live searches for reuse.</div>
          )}
          {(store.smartFolders ?? []).map((folder) => (
            <div
              key={folder.id} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}
              className="side-item"
              title={`${folder.name}\n${folder.root}`}
              onClick={() => void store.runSmartFolder(folder)}
              style={{ cursor: "pointer", userSelect: "none" }}
            >
              <Sparkles size={14} style={{ color: "var(--accent)" }} />
              <span className="side-item-name">{folder.name}</span>
            </div>
          ))}
        </div>

        {/* Internal / Fixed & Dev Drives */}
        {(() => {
          const isRemovableOrUsb = (d: (typeof store.drives)[number]) =>
            d.driveType === "removable" || d.driveType === "portable" || d.isUsb;
          const isWsl = (d: (typeof store.drives)[number]) =>
            d.driveType === "wsl" || d.path.startsWith("\\\\wsl");
          const isNetwork = (d: (typeof store.drives)[number]) => d.driveType === "network";

          const fixedDrives = (store.drives ?? []).filter(
            (d) => !isRemovableOrUsb(d) && !isWsl(d) && !isNetwork(d)
          );
          const usbDrives = (store.drives ?? []).filter((d) => isRemovableOrUsb(d));
          const wslDrives = (store.drives ?? []).filter((d) => isWsl(d));
          const networkDrives = (store.drives ?? []).filter((d) => isNetwork(d));

          return (
            <>
              <div className="side-section">
                <div className="side-heading">Fixed Drives</div>
                {fixedDrives.map((d) => {
                  const used = d.totalBytes - d.freeBytes;
                  const pct = d.totalBytes ? (used / d.totalBytes) * 100 : 0;
                  const letter = (d.path.match(/^([A-Za-z]:)/)?.[1] || d.path.replace(/[\\\/]+$/, "")).toUpperCase();
                  const rawLabel = (d.label || "").trim();
                  const displayName = rawLabel
                    ? (rawLabel.toUpperCase().includes(`(${letter})`) ? rawLabel : `${rawLabel} (${letter})`)
                    : (letter ? `Local Disk (${letter})` : d.path);
                  const isDriveActive = samePath(activePath, d.path);
                  const isReFS = (d.filesystem || "").toUpperCase().includes("REFS");

                  return (
                    <div
                      key={d.path}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.currentTarget.click();
                        }
                      }}
                      className={`side-item side-drive-card ${isDriveActive ? "active" : ""}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        gap: 4,
                        padding: "7px 10px",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => void store.navigateTo(d.path)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        store.openContextMenu(e.clientX, e.clientY, [
                          { label: "Open", icon: "open", action: () => void store.navigateTo(d.path) },
                          { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(d.path, true) },
                          { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(d.path) },
                          { separator: true },
                          { label: "Properties", icon: "info", action: () => store.setPropertiesPath(d.path) },
                        ]);
                      }}
                      data-drop-path={d.path}
                      title={`${displayName}\n${formatBytes(d.freeBytes)} free of ${formatBytes(d.totalBytes)}${isReFS ? " · ReFS Dev Drive (CoW Extent Duplication)" : ""}`}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                          <HardDrive size={15} style={{ flexShrink: 0, color: isDriveActive ? "var(--accent)" : undefined }} />
                          <span className="side-item-name" style={{ fontWeight: isDriveActive ? 600 : 400 }}>
                            {displayName}
                          </span>
                        </div>
                        {isReFS && (
                          <span
                            title="Microsoft ReFS / Dev Drive (High Performance Copy-on-Write Extent Duplication)"
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: "#38bdf8",
                              background: "rgba(56, 189, 248, 0.15)",
                              padding: "1px 5px",
                              borderRadius: 4,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Zap size={9} /> ReFS
                          </span>
                        )}
                      </div>
                      <div style={{ paddingLeft: 25, width: "100%" }}>
                        <div className="drive-bar"><div className="drive-bar-fill" style={{ width: `${pct}%` }} /></div>
                        <div className="side-meta" style={{ marginTop: 3 }}>
                          {formatBytes(d.freeBytes)} free of {formatBytes(d.totalBytes)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Removable & Portable Storage Section */}
              {usbDrives.length > 0 && (
                <div className="side-section">
                  <div
                    className="side-heading"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingRight: 6,
                    }}
                  >
                    <span>Removable & Portable Devices</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void store.openUsbModal();
                      }}
                      title="Open USB Command Center"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--accent)",
                        cursor: "pointer",
                        padding: "2px 4px",
                        fontSize: 10,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Cpu size={12} />
                      Manager
                    </button>
                  </div>

                  {usbDrives.map((d) => {
                    const isPortable = d.driveType === "portable" || d.path.startsWith("wpd://");
                    const used = d.totalBytes - d.freeBytes;
                    const pct = d.totalBytes ? (used / d.totalBytes) * 100 : 0;
                    const letter = (d.path.match(/^([A-Za-z]:)/)?.[1] || "").toUpperCase();
                    const rawLabel = (d.label || "").trim();
                    const displayName = isPortable
                      ? (rawLabel || "Portable Device")
                      : rawLabel
                        ? (letter && !rawLabel.toUpperCase().includes(`(${letter})`) ? `${rawLabel} (${letter})` : rawLabel)
                        : (letter ? `Removable (${letter})` : d.path);
                    const isDriveActive = samePath(activePath, d.path);

                    return (
                      <div
                        key={d.path}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.currentTarget.click();
                          }
                        }}
                        className={`side-item side-drive-card ${isDriveActive ? "active" : ""}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: 4,
                          padding: "7px 10px",
                          cursor: "pointer",
                          userSelect: "none",
                          position: "relative",
                        }}
                        onClick={() => void store.navigateTo(d.path)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (isPortable) {
                            store.openContextMenu(e.clientX, e.clientY, [
                              { label: "Open", icon: "open", action: () => void store.navigateTo(d.path) },
                              { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(d.path, true) },
                              { separator: true },
                              { label: "Open in Windows Explorer", icon: "reveal", action: () => void ipc.revealInShell(d.path) },
                              { label: "USB & Device Telemetry", icon: "info", action: () => void store.openUsbModal(d.path, "overview") },
                              { separator: true },
                              { label: "Properties", icon: "info", action: () => store.setPropertiesPath(d.path) },
                            ]);
                          } else {
                            store.openContextMenu(e.clientX, e.clientY, [
                              { label: "Open", icon: "open", action: () => void store.navigateTo(d.path) },
                              { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(d.path, true) },
                              { separator: true },
                              { label: "Safely Eject USB Drive", icon: "reveal", action: () => void store.ejectUsbDevice(d.path) },
                              { label: "Lock Hunter & Eject...", icon: "properties", action: () => void store.openUsbModal(d.path, "unlocker") },
                              { label: "Hardware Telemetry & S.M.A.R.T.", icon: "info", action: () => void store.openUsbModal(d.path, "overview") },
                              { label: "Speed & Sustained NAND Benchmark", icon: "info", action: () => void store.openUsbModal(d.path, "benchmark") },
                              { label: "Verify Fake Flash (H2testw)", icon: "info", action: () => void store.openUsbModal(d.path, "integrity") },
                              { label: "Format USB Drive...", icon: "delete", action: () => void store.openUsbModal(d.path, "format") },
                              { separator: true },
                              { label: "Properties", icon: "info", action: () => store.setPropertiesPath(d.path) },
                            ]);
                          }
                        }}
                        data-drop-path={d.path}
                        title={`${displayName}\n${formatBytes(d.freeBytes)} free of ${formatBytes(d.totalBytes)}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                            {isPortable ? (
                              <Smartphone size={15} style={{ flexShrink: 0, color: isDriveActive ? "var(--accent)" : "#10b981" }} />
                            ) : (
                              <Usb size={15} style={{ flexShrink: 0, color: isDriveActive ? "var(--accent)" : "#3b82f6" }} />
                            )}
                            <span className="side-item-name" style={{ fontWeight: isDriveActive ? 600 : 400 }}>
                              {displayName}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {d.isDegradedPort && (
                              <span
                                title="Degraded port speed: 480 Mbps"
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "#f59e0b",
                                  background: "rgba(245, 158, 11, 0.2)",
                                  padding: "1px 4px",
                                  borderRadius: 4,
                                }}
                              >
                                ⚠️ 480M
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void store.ejectUsbDevice(d.path);
                              }}
                              title="Safely Eject USB Drive"
                              style={{
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid var(--border)",
                                color: "var(--fg-muted)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                                fontSize: 11,
                              }}
                            >
                              ⏏
                            </button>
                          </div>
                        </div>

                        <div style={{ paddingLeft: 23, width: "100%" }}>
                          <div className="drive-bar"><div className="drive-bar-fill" style={{ width: `${pct}%`, background: d.isDegradedPort ? "#f59e0b" : undefined }} /></div>
                          <div className="side-meta" style={{ marginTop: 3 }}>
                            {formatBytes(d.freeBytes)} free · {d.filesystem || "exFAT"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Linux & WSL Section */}
              {wslDrives.length > 0 && (
                <div className="side-section">
                  <div className="side-heading">Linux & WSL</div>
                  {wslDrives.map((d) => {
                    const distroName = (d.label || "").replace(/^WSL:\s*/i, "").trim() || "Linux";
                    const isDriveActive = samePath(activePath, d.path);
                    const used = d.totalBytes - d.freeBytes;
                    const pct = d.totalBytes ? (used / d.totalBytes) * 100 : 0;
                    return (
                      <div
                        key={d.path}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.currentTarget.click();
                          }
                        }}
                        className={`side-item side-drive-card ${isDriveActive ? "active" : ""}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: 4,
                          padding: "7px 10px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        onClick={() => void store.navigateTo(d.path)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          store.openContextMenu(e.clientX, e.clientY, [
                            { label: "Open", icon: "open", action: () => void store.navigateTo(d.path) },
                            { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(d.path, true) },
                            { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(d.path) },
                            { separator: true },
                            { label: "Properties", icon: "info", action: () => store.setPropertiesPath(d.path) },
                          ]);
                        }}
                        data-drop-path={d.path}
                        title={`${distroName} (${d.path})\nWSL2 · ext4`}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                            <Terminal size={15} style={{ flexShrink: 0, color: isDriveActive ? "var(--accent)" : "#f97316" }} />
                            <span className="side-item-name" style={{ fontWeight: isDriveActive ? 600 : 400 }}>
                              {distroName}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: "#f97316",
                              background: "rgba(249, 115, 22, 0.15)",
                              padding: "1px 5px",
                              borderRadius: 4,
                            }}
                          >
                            WSL2
                          </span>
                        </div>
                        <div style={{ paddingLeft: 25, width: "100%" }}>
                          {d.totalBytes > 0 && (
                            <div className="drive-bar"><div className="drive-bar-fill" style={{ width: `${pct}%`, background: "#f97316" }} /></div>
                          )}
                          <div className="side-meta" style={{ marginTop: 2 }}>
                            {d.totalBytes > 0 ? `${formatBytes(d.freeBytes)} free · ` : ""}ext4 filesystem
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Network Locations Section */}
              {networkDrives.length > 0 && (
                <div className="side-section">
                  <div className="side-heading">Network Locations</div>
                  {networkDrives.map((d) => {
                    const isDriveActive = samePath(activePath, d.path);
                    const letter = (d.path.match(/^([A-Za-z]:)/)?.[1] || "").toUpperCase();
                    const rawLabel = (d.label || "").trim();
                    const displayName = rawLabel
                      ? (letter ? `${rawLabel} (${letter})` : rawLabel)
                      : (letter ? `Network Drive (${letter})` : d.path);
                    const used = d.totalBytes - d.freeBytes;
                    const pct = d.totalBytes ? (used / d.totalBytes) * 100 : 0;
                    return (
                      <div
                        key={d.path}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.currentTarget.click();
                          }
                        }}
                        className={`side-item side-drive-card ${isDriveActive ? "active" : ""}`}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: 4,
                          padding: "7px 10px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        onClick={() => void store.navigateTo(d.path)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          store.openContextMenu(e.clientX, e.clientY, [
                            { label: "Open", icon: "open", action: () => void store.navigateTo(d.path) },
                            { label: "Open in new tab", icon: "newtab", action: () => void store.openTab(d.path, true) },
                            { label: "Open in terminal", icon: "terminal", action: () => void store.openTerminal(d.path) },
                            { separator: true },
                            { label: "Properties", icon: "info", action: () => store.setPropertiesPath(d.path) },
                          ]);
                        }}
                        data-drop-path={d.path}
                        title={`${displayName}\nSMB / Network Share`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                          <Globe size={15} style={{ flexShrink: 0, color: isDriveActive ? "var(--accent)" : "#38bdf8" }} />
                          <span className="side-item-name" style={{ fontWeight: isDriveActive ? 600 : 400 }}>
                            {displayName}
                          </span>
                        </div>
                        {d.totalBytes > 0 && (
                          <div style={{ paddingLeft: 25, width: "100%" }}>
                            <div className="drive-bar"><div className="drive-bar-fill" style={{ width: `${pct}%`, background: "#38bdf8" }} /></div>
                            <div className="side-meta" style={{ marginTop: 2 }}>
                              {formatBytes(d.freeBytes)} free of {formatBytes(d.totalBytes)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}

        {(store.recent ?? []).length > 0 && (
          <div className="side-section">
            <div className="side-heading">Recent</div>
            {(store.recent ?? []).slice(0, 8).map((r) => (
              <div
                key={r.path} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}
                className={`side-item ${samePath(activePath, r.path) ? "active" : ""}`}
                onClick={() => void store.navigateTo(r.path)}
                data-drop-path={r.path}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                <Clock size={14} />
                <span className="side-item-name">{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sidebar-resizer" onPointerDown={handleResizerPointerDown} />
    </div>
  );
}
