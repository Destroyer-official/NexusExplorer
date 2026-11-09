import { useState, useEffect } from "react";
import {
  Usb,
  X,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  Gauge,
  ShieldCheck,
  ShieldAlert,
  Disc,
  Play,
  RotateCw,
  Download,
  UploadCloud,
  FileCheck,
  Cpu,
  Layers,
  Zap,
  Activity,
  Shield,
  Plus,
  Smartphone,
} from "lucide-react";
import { useAppStore } from "@/state/store";
import { formatBytes } from "@/lib/format";
import type { UsbFormatOptions, UsbDiskImageOptions } from "@/types";

export function UsbDeviceManagerModal() {
  const store = useAppStore();
  const {
    usbModalOpen,
    closeUsbModal,
    usbDevices,
    usbSelectedPath,
    selectUsbDevice,
    usbActiveTab,
    setUsbActiveTab,
    usbLocks,
    usbLoading,
    usbBenchmarkResult,
    usbIntegrityResult,
    usbSurfaceReport,
    usbMultiBootConfig,
    usbTopology,
    usbSanitizeReport,
    refreshUsbDevices,
    ejectUsbDevice,
    unlockAndEjectUsbDevice,
    formatUsbDevice,
    runUsbBenchmark,
    runUsbIntegrityTest,
    toggleUsbCachePolicy,
    createUsbDiskImage,
    runUsbSurfaceScan,
    loadUsbMultiBoot,
    installUsbVentoy,
    addUsbMultiBootIso,
    loadUsbTopology,
    runUsbSanitize,
  } = store;

  // Format form state
  const [formatFs, setFormatFs] = useState<"exFAT" | "FAT32" | "NTFS" | "ReFS">("exFAT");
  const [formatLabel, setFormatLabel] = useState("");
  const [formatCluster, setFormatCluster] = useState<number>(131072); // 128KB
  const [formatQuick, setFormatQuick] = useState(true);
  const [formatConfirm, setFormatConfirm] = useState(false);

  // Disk image state
  const [imagePath, setImagePath] = useState("D:\\backups\\usb_backup.img");
  const [imageCompress, setImageCompress] = useState(true);
  const [burnSource, setBurnSource] = useState("D:\\downloads\\ubuntu-24.04-live.iso");

  // Integrity test options
  const [integrityFull, setIntegrityFull] = useState(false);

  // Surface scan hovering block
  const [hoveredBlock, setHoveredBlock] = useState<{ id: number; latencyMs: number; status: string; lba: number } | null>(null);

  // Sanitization standard
  const [sanitizeStandard, setSanitizeStandard] = useState<"nist_800_88_purge" | "nist_800_88_clear" | "dod_5220_22_m" | "gutmann_35">("nist_800_88_purge");
  const [sanitizeConfirm, setSanitizeConfirm] = useState(false);

  // MultiBoot ISO path
  const [newIsoPath, setNewIsoPath] = useState("D:\\downloads\\kali-linux-2024.3-live-amd64.iso");
  const [persistenceMB, setPersistenceMB] = useState(4096);

  const currentDevice =
    usbDevices.find((d) => d.path.toUpperCase() === (usbSelectedPath || "").toUpperCase()) ||
    usbDevices[0];

  useEffect(() => {
    if (usbModalOpen && currentDevice) {
      if (usbActiveTab === "multiboot" && !usbMultiBootConfig) {
        void loadUsbMultiBoot(currentDevice.path);
      } else if (usbActiveTab === "topology" && !usbTopology) {
        void loadUsbTopology(currentDevice.path);
      }
    }
  }, [usbModalOpen, usbActiveTab, currentDevice, usbMultiBootConfig, usbTopology, loadUsbMultiBoot, loadUsbTopology]);

  if (!usbModalOpen) return null;

  const handleFormat = async () => {
    if (!currentDevice) return;
    const opts: UsbFormatOptions = {
      filesystem: formatFs,
      label: formatLabel.trim() || currentDevice.label,
      clusterSize: formatCluster,
      quickFormat: formatQuick,
    };
    await formatUsbDevice(currentDevice.path, opts);
    setFormatConfirm(false);
  };

  const handleCreateImage = async () => {
    if (!currentDevice) return;
    const opts: UsbDiskImageOptions = {
      sourceDrive: currentDevice.driveLetter,
      targetImagePath: imagePath,
      format: "raw_img",
      compress: imageCompress,
    };
    await createUsbDiskImage(opts);
  };

  const handleSanitize = async () => {
    if (!currentDevice) return;
    await runUsbSanitize(currentDevice.path, sanitizeStandard);
    setSanitizeConfirm(false);
  };

  const usedPct =
    currentDevice && currentDevice.totalBytes > 0
      ? Math.min(100, Math.round((currentDevice.usedBytes / currentDevice.totalBytes) * 100))
      : 0;

  return (
    <div
      className="palette-overlay"
      onClick={closeUsbModal}
      style={{
        zIndex: 1400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="USB & Removable Storage Intelligence"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 880,
          maxWidth: "96vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: "var(--radius-lg, 12px)",
          border: "1px solid var(--border)",
          boxShadow: "0 28px 72px rgba(0,0,0,0.6)",
          background: "var(--bg-elevated, #1c1d22)",
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "rgba(59, 130, 246, 0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3b82f6",
                boxShadow: "0 0 12px rgba(59, 130, 246, 0.2)",
              }}
            >
              <Usb size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
                  USB & Removable Storage Center
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 12,
                    background: "rgba(59, 130, 246, 0.15)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                >
                  {usbDevices.length} Connected
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                Industrial hardware telemetry, sector surface heatmap, lock hunter & forensic sanitization
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => refreshUsbDevices()}
              title="Refresh USB devices"
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                color: "var(--fg-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
              }}
            >
              <RefreshCw size={14} className={usbLoading ? "spin" : ""} />
              Refresh
            </button>
            <button
              onClick={closeUsbModal}
              title="Close"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--fg-muted)",
                cursor: "pointer",
                padding: 6,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Device Selection Bar (if multiple devices) */}
        {usbDevices.length > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 22px",
              background: "rgba(0,0,0,0.2)",
              borderBottom: "1px solid var(--border)",
              overflowX: "auto",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>
              Active Device:
            </span>
            {usbDevices.map((d) => {
              const isSelected =
                currentDevice && d.path.toUpperCase() === currentDevice.path.toUpperCase();
              return (
                <button
                  key={d.path}
                  onClick={() => selectUsbDevice(d.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: isSelected ? "var(--accent)" : "rgba(255,255,255,0.04)",
                    color: isSelected ? "#ffffff" : "var(--fg)",
                    border: isSelected
                      ? "1px solid var(--accent)"
                      : "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {d.driveLetter === "MTP" || d.path.startsWith("wpd://") ? (
                    <Smartphone size={14} />
                  ) : (
                    <HardDrive size={14} />
                  )}
                  <span>
                    {d.driveLetter} {d.label || d.model}
                  </span>
                  {d.isDegradedPort && (
                    <span
                      title="Degraded port speed"
                      style={{
                        color: isSelected ? "#fff" : "#f59e0b",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 4px",
                        background: "rgba(245, 158, 11, 0.2)",
                        borderRadius: 4,
                      }}
                    >
                      ⚠️ 480M
                    </span>
                  )}
                  {d.isLocked && (
                    <span
                      title="Device locked by active processes"
                      style={{
                        color: isSelected ? "#fff" : "#ef4444",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 4px",
                        background: "rgba(239, 68, 68, 0.2)",
                        borderRadius: 4,
                      }}
                    >
                      🔒 Locked
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "30px 22px", textAlign: "center", color: "var(--fg-muted)" }}>
            No removable USB drives detected. Plug in a USB flash drive or external SSD.
          </div>
        )}

        {/* Degraded Port Warning Banner */}
        {currentDevice?.isDegradedPort && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 22px",
              background: "rgba(245, 158, 11, 0.12)",
              borderBottom: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#fbbf24",
              fontSize: 12,
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, color: "#f59e0b" }} />
            <div>
              <strong style={{ color: "#fef3c7" }}>Degraded USB Negotiation Detected:</strong> This{" "}
              {currentDevice.model} supports USB 3.0+ SuperSpeed (5-10 Gbps), but is currently negotiated at{" "}
              <span style={{ textDecoration: "underline" }}>USB 2.0 HighSpeed (480 Mbps)</span>.
              <span style={{ color: "rgba(255,255,255,0.7)", marginLeft: 6 }}>
                Tip: Plug into a blue/red SuperSpeed (SS) port or check your USB cable to avoid 10x slower file transfers.
              </span>
            </div>
          </div>
        )}

        {/* Modal Navigation Tabs (Horizontally Scrollable) */}
        {currentDevice && (
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border)",
              background: "rgba(0,0,0,0.15)",
              padding: "0 18px",
              gap: 2,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {[
              { id: "overview", label: "Overview & Health", icon: <HardDrive size={14} /> },
              {
                id: "unlocker",
                label: `Lock Hunter${usbLocks.length > 0 ? ` (${usbLocks.length})` : ""}`,
                icon: <Lock size={14} />,
              },
              { id: "surface", label: "Surface Heatmap", icon: <Activity size={14} /> },
              { id: "multiboot", label: "MultiBoot ISO Hub", icon: <Disc size={14} /> },
              { id: "topology", label: "Bus & Power Inspector", icon: <Zap size={14} /> },
              { id: "benchmark", label: "Speed Benchmark", icon: <Gauge size={14} /> },
              { id: "integrity", label: "Fake Flash Detector", icon: <FileCheck size={14} /> },
              { id: "sanitize", label: "Forensic Wipe", icon: <Shield size={14} /> },
              { id: "format", label: "Format Wizard", icon: <RotateCw size={14} /> },
              { id: "disk_image", label: "Disk Image & Backup", icon: <Layers size={14} /> },
            ].map((tab) => {
              const active = usbActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setUsbActiveTab(tab.id as any)}
                  className={`usb-tab ${active ? "active" : ""}`}
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    color: active ? "var(--accent)" : "var(--fg-muted)",
                    background: "transparent",
                    border: "none",
                    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab Body Contents */}
        {currentDevice && (
          <div
            style={{
              padding: "18px 22px",
              overflowY: "auto",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* 1. OVERVIEW & HEALTH TAB */}
            {usbActiveTab === "overview" && (
              <>
                {/* Hardware Telemetry Card */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                      Model & Vendor
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginTop: 4 }}>
                      {currentDevice.vendor} {currentDevice.model}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                      VID: {currentDevice.vid} | PID: {currentDevice.pid}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                      Bus Protocol & Speed
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: currentDevice.isDegradedPort ? "#f59e0b" : "#10b981",
                        marginTop: 4,
                      }}
                    >
                      {currentDevice.usbSpeed}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                      {currentDevice.usbProtocol}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                      S.M.A.R.T. Health & Temp
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <ShieldCheck size={16} style={{ color: "#10b981" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>
                        {currentDevice.smartHealthScore}% Healthy
                      </span>
                      <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                        ({currentDevice.temperatureC}°C)
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                      Partition: {currentDevice.partitionScheme} ({currentDevice.partitionsCount} part)
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                      Filesystem & Allocation
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginTop: 4 }}>
                      {currentDevice.filesystem}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                      Cluster Size: {currentDevice.clusterSizeBytes / 1024} KB
                    </div>
                  </div>
                </div>

                {/* Storage Capacity Gauge */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Capacity Breakdown</span>
                    <span style={{ color: "var(--fg-muted)" }}>
                      {formatBytes(currentDevice.freeBytes)} free of {formatBytes(currentDevice.totalBytes)} ({usedPct}% used)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 5,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${usedPct}%`,
                        background:
                          usedPct > 90
                            ? "#ef4444"
                            : usedPct > 75
                            ? "#f59e0b"
                            : "linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)",
                        borderRadius: 5,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Write Caching Policy Setting */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                      Write-Caching Policy
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>
                      {currentDevice.writeCachePolicy === "better_performance" ? (
                        <>
                          <strong style={{ color: "#60a5fa" }}>Better Performance (Buffered):</strong> OS writes to RAM first for speed. You <span style={{ textDecoration: "underline" }}>must</span> use Safely Remove before disconnecting.
                        </>
                      ) : (
                        <>
                          <strong style={{ color: "#10b981" }}>Quick Removal (Direct Flush):</strong> OS commits writes directly to flash NAND. Slower write speeds but safer to unplug anytime.
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleUsbCachePolicy(currentDevice.path)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background:
                        currentDevice.writeCachePolicy === "better_performance"
                          ? "rgba(59, 130, 246, 0.2)"
                          : "rgba(16, 185, 129, 0.2)",
                      color:
                        currentDevice.writeCachePolicy === "better_performance"
                          ? "#60a5fa"
                          : "#34d399",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Switch to {currentDevice.writeCachePolicy === "better_performance" ? "Quick Removal" : "Better Performance"}
                  </button>
                </div>

                {/* Quick Actions Row */}
                <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                  <button
                    onClick={() => ejectUsbDevice(currentDevice.path)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: 8,
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Unlock size={16} />
                    Safely Eject Media
                  </button>

                  <button
                    onClick={() => setUsbActiveTab("surface")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid var(--border)",
                      color: "var(--fg)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Activity size={16} />
                    Surface Heatmap
                  </button>

                  <button
                    onClick={() => setUsbActiveTab("multiboot")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid var(--border)",
                      color: "var(--fg)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Disc size={16} />
                    MultiBoot Hub
                  </button>
                </div>
              </>
            )}

            {/* 2. UNLOCKER & LOCK HUNTER TAB */}
            {usbActiveTab === "unlocker" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                      Active Handle & Process Lock Hunter
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                      Windows Restart Manager queries show every application blocking safe USB ejection.
                    </div>
                  </div>
                  {usbLocks.length > 0 && (
                    <button
                      onClick={() => unlockAndEjectUsbDevice(currentDevice.path)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      <Unlock size={14} />
                      Unlock & Safely Eject All
                    </button>
                  )}
                </div>

                {usbLocks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {usbLocks.map((p) => (
                      <div
                        key={p.pid}
                        style={{
                          background: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.25)",
                          borderRadius: 8,
                          padding: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                              {p.name}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "rgba(255,255,255,0.1)",
                                color: "var(--fg-muted)",
                              }}
                            >
                              PID {p.pid}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "#60a5fa",
                              }}
                            >
                              {p.appType}
                            </span>
                          </div>
                          {p.windowTitle && (
                            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>
                              Window: {p.windowTitle}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: 11,
                              color: "#f87171",
                              fontFamily: "var(--font-mono)",
                              marginTop: 4,
                            }}
                          >
                            Locked Path: {p.lockedPath}
                          </div>
                        </div>

                        <button
                          onClick={() => unlockAndEjectUsbDevice(currentDevice.path)}
                          title="Terminate locking process"
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "rgba(239, 68, 68, 0.2)",
                            color: "#f87171",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Close Handle
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: 8,
                      padding: 24,
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <CheckCircle2 size={36} style={{ color: "#10b981" }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>
                      Zero Active File Locks
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", maxWidth: 440 }}>
                      No programs, indexers, or background services are holding handles to this volume.
                      It is 100% clean and ready for instant safe ejection.
                    </div>
                    <button
                      onClick={() => ejectUsbDevice(currentDevice.path)}
                      style={{
                        marginTop: 8,
                        padding: "8px 20px",
                        borderRadius: 6,
                        background: "#10b981",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Safely Eject {currentDevice.driveLetter} Now
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 3. SURFACE SECTOR LATENCY & BAD BLOCK HEATMAP TAB */}
            {usbActiveTab === "surface" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                      Physical NAND Surface Latency & Bad Block Heatmap
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                      Victoria/HDDScan-grade block-by-block latency analyzer. Detects weak cells, ECC retry delays, and failing NAND blocks.
                    </div>
                  </div>

                  <button
                    onClick={() => runUsbSurfaceScan(currentDevice.path)}
                    disabled={usbLoading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 6,
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Play size={14} />
                    {usbLoading ? "Scanning Surface..." : "Start Surface Scan"}
                  </button>
                </div>

                {/* Latency Brackets Legend Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 14px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 11,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "#06b6d4" }} />
                    <span style={{ color: "var(--fg)" }}>&lt; 5 ms (Pristine)</span>
                    <strong style={{ color: "#06b6d4" }}>{usbSurfaceReport ? usbSurfaceReport.fastCount : "-"}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} />
                    <span style={{ color: "var(--fg)" }}>&lt; 20 ms (Good)</span>
                    <strong style={{ color: "#10b981" }}>{usbSurfaceReport ? usbSurfaceReport.goodCount : "-"}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }} />
                    <span style={{ color: "var(--fg)" }}>&lt; 50 ms (Normal)</span>
                    <strong style={{ color: "#f59e0b" }}>{usbSurfaceReport ? usbSurfaceReport.normalCount : "-"}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "#f97316" }} />
                    <span style={{ color: "var(--fg)" }}>&lt; 150 ms (Slow)</span>
                    <strong style={{ color: "#f97316" }}>{usbSurfaceReport ? usbSurfaceReport.slowCount : "-"}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }} />
                    <span style={{ color: "var(--fg)" }}>&lt; 500 ms (Critical)</span>
                    <strong style={{ color: "#ef4444" }}>{usbSurfaceReport ? usbSurfaceReport.criticalCount : "-"}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: "#d946ef" }} />
                    <span style={{ color: "#d946ef", fontWeight: 700 }}>Bad / Unreadable</span>
                    <strong style={{ color: "#d946ef" }}>{usbSurfaceReport ? usbSurfaceReport.badCount : "-"}</strong>
                  </div>
                </div>

                {/* 120-Block Interactive Heatmap Grid */}
                <div
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(20, 1fr)",
                      gap: 4,
                    }}
                  >
                    {(usbSurfaceReport?.blocks || Array.from({ length: 120 }, (_, i) => ({ id: i, status: "fast" as const, latencyMs: 3.2, lba: i * 16384 }))).map((b) => {
                      const colorMap = {
                        fast: "#06b6d4",
                        good: "#10b981",
                        normal: "#f59e0b",
                        slow: "#f97316",
                        critical: "#ef4444",
                        bad: "#d946ef",
                      };
                      const bg = colorMap[b.status] || "#06b6d4";
                      return (
                        <div
                          key={b.id}
                          onMouseEnter={() => setHoveredBlock(b)}
                          onMouseLeave={() => setHoveredBlock(null)}
                          style={{
                            height: 18,
                            borderRadius: 2,
                            background: bg,
                            opacity: usbSurfaceReport ? 1 : 0.25,
                            cursor: "pointer",
                            transition: "transform 0.15s ease",
                            boxShadow: b.status === "bad" ? "0 0 8px #d946ef" : undefined,
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Hovered Block Telemetry Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--fg-muted)",
                      paddingTop: 4,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {hoveredBlock ? (
                      <div>
                        Block #{hoveredBlock.id} · LBA: {hoveredBlock.lba} · Latency:{" "}
                        <strong style={{ color: "var(--fg)" }}>{hoveredBlock.latencyMs.toFixed(1)} ms</strong>{" "}
                        (Status: <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{hoveredBlock.status}</span>)
                      </div>
                    ) : (
                      <div>Hover over any surface sector block to inspect exact access latency and LBA mapping.</div>
                    )}

                    {usbSurfaceReport && (
                      <div>
                        Avg Latency: <strong style={{ color: "#10b981" }}>{usbSurfaceReport.avgLatencyMs.toFixed(1)} ms</strong> · Max:{" "}
                        <strong style={{ color: usbSurfaceReport.maxLatencyMs > 200 ? "#ef4444" : "var(--fg)" }}>
                          {usbSurfaceReport.maxLatencyMs.toFixed(0)} ms
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 4. MULTIBOOT ISO HUB (VENTOY ENGINE) */}
            {usbActiveTab === "multiboot" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                      Ventoy-Grade MultiBoot ISO Hub
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                      Boot multiple ISO images directly without formatting or wiping the flash drive between uses.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => installUsbVentoy(currentDevice.path)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 6,
                        background: "rgba(59, 130, 246, 0.2)",
                        color: "#60a5fa",
                        border: "1px solid rgba(59, 130, 246, 0.4)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Install / Re-install Bootloader
                    </button>
                  </div>
                </div>

                {/* Bootloader Status Card */}
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CheckCircle2 size={20} style={{ color: "#10b981" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>
                        Nexus-EFI MultiBoot Engine v1.0.99 Active
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                        Partition: GPT (ESP VFAT 32MB) · UEFI Secure Boot Compatible · Legacy BIOS Support
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 12,
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                    }}
                  >
                    SecureBoot Ready
                  </span>
                </div>

                {/* Installed Bootable ISOs */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
                    Installed Bootable OS Images ({usbMultiBootConfig?.isos.length || 0})
                  </div>

                  {(usbMultiBootConfig?.isos || []).map((iso) => (
                    <div
                      key={iso.id}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Disc size={18} style={{ color: "#60a5fa" }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                            {iso.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                            {iso.fileName} · {formatBytes(iso.sizeBytes)} · {iso.uefiCompatible ? "UEFI 64-bit" : "Legacy MBR"}
                            {iso.hasPersistence && ` · ${iso.persistenceSizeMB}MB Persistence Overlay`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(59, 130, 246, 0.15)",
                            color: "#60a5fa",
                          }}
                        >
                          Bootable
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add ISO Form */}
                <div
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
                    Add ISO Image to Boot Menu
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      type="text"
                      value={newIsoPath}
                      onChange={(e) => setNewIsoPath(e.target.value)}
                      placeholder="D:\downloads\linux_installer.iso"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <select
                      value={persistenceMB}
                      onChange={(e) => setPersistenceMB(Number(e.target.value))}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                        fontSize: 12,
                      }}
                      title="Persistence Overlay Size for Linux Live USB"
                    >
                      <option value={0}>No Persistence</option>
                      <option value={2048}>2 GB Overlay</option>
                      <option value={4096}>4 GB Overlay</option>
                      <option value={8192}>8 GB Overlay</option>
                      <option value={16384}>16 GB Overlay</option>
                    </select>

                    <button
                      onClick={() => addUsbMultiBootIso(currentDevice.path, newIsoPath)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Plus size={14} />
                      Add to MultiBoot
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 5. USB BUS TOPOLOGY & POWER INSPECTOR TAB */}
            {usbActiveTab === "topology" && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                  USB Controller Topology, Power Delivery (USB-PD) & Endpoints
                </div>

                {usbTopology && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Host Controller & Link Negotiation */}
                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                        Host Controller & Physical Root Hub
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginTop: 4 }}>
                        {usbTopology.controllerName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>
                        Type: <strong style={{ color: "#60a5fa" }}>{usbTopology.controllerType}</strong> · Root Hub Port: #{usbTopology.rootHubPort}
                      </div>
                    </div>

                    {/* Power Delivery Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <div
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: 14,
                        }}
                      >
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Negotiated Link Speed</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981", marginTop: 4 }}>
                          {usbTopology.negotiatedSpeed}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: 14,
                        }}
                      >
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Bus Power Allocation</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b", marginTop: 4 }}>
                          {usbTopology.busPowerMa} mA
                        </div>
                      </div>

                      <div
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          padding: 14,
                        }}
                      >
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>USB-PD Negotiation</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#60a5fa", marginTop: 4 }}>
                          {usbTopology.usbPdVoltageV.toFixed(1)}V @ {usbTopology.usbPdCurrentA.toFixed(1)}A ({(usbTopology.usbPdVoltageV * usbTopology.usbPdCurrentA).toFixed(0)}W)
                        </div>
                      </div>
                    </div>

                    {/* USB Endpoints Table */}
                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 14,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
                        Active Hardware Endpoints ({usbTopology.endpoints.length})
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 10 }}>
                        {usbTopology.endpoints.map((ep) => (
                          <div
                            key={ep.ep}
                            style={{
                              padding: 8,
                              borderRadius: 4,
                              background: "rgba(0,0,0,0.3)",
                              border: "1px solid var(--border)",
                              fontSize: 11,
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                              EP {ep.ep} ({ep.direction})
                            </div>
                            <div style={{ color: "var(--fg-muted)", marginTop: 2 }}>
                              {ep.type} · Max {ep.maxPacketSize} B
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 6. FORENSIC SANITIZATION & WIPE TAB (NIST 800-88 / DOD) */}
            {usbActiveTab === "sanitize" && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                  Forensic Sanitization & Cryptographic Erasure (NIST SP 800-88 / DoD 5220.22-M)
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                  Military and intelligence-grade physical block destruction preventing state-level electron-microscopy data recovery.
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
                    Sanitization Standard
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {[
                      {
                        id: "nist_800_88_purge",
                        title: "NIST SP 800-88 Rev 1 Purge (Recommended for Flash)",
                        desc: "Cryptographic flash controller key invalidation + full physical page overwrite.",
                      },
                      {
                        id: "nist_800_88_clear",
                        title: "NIST SP 800-88 Rev 1 Clear",
                        desc: "Logical block zeroing with 100% cryptographic readback verification pass.",
                      },
                      {
                        id: "dod_5220_22_m",
                        title: "DoD 5220.22-M (3-Pass)",
                        desc: "Pass 1: Fixed character, Pass 2: Complement, Pass 3: Random with verify.",
                      },
                      {
                        id: "gutmann_35",
                        title: "Gutmann Algorithm (35-Pass)",
                        desc: "Extreme magnetic and electronic residue annihilation for high-security decommission.",
                      },
                    ].map((s) => (
                      <div
                        key={s.id}
                        onClick={() => setSanitizeStandard(s.id as any)}
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          background: sanitizeStandard === s.id ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.02)",
                          border: sanitizeStandard === s.id ? "1px solid #ef4444" : "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: sanitizeStandard === s.id ? "#f87171" : "var(--fg)" }}>
                          {s.title}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>
                          {s.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warning & Trigger */}
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ShieldAlert size={22} style={{ color: "#ef4444" }} />
                    <span style={{ fontSize: 12, color: "#fca5a5" }}>
                      Irreversible Operation: Complete physical block sanitization of {currentDevice.driveLetter} ({currentDevice.model}).
                    </span>
                  </div>

                  {!sanitizeConfirm ? (
                    <button
                      onClick={() => setSanitizeConfirm(true)}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 6,
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Sanitize Drive
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleSanitize}
                        disabled={usbLoading}
                        style={{
                          padding: "8px 18px",
                          borderRadius: 6,
                          background: "#b91c1c",
                          color: "#fff",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {usbLoading ? "Sanitizing..." : "Execute Sanitization"}
                      </button>
                      <button
                        onClick={() => setSanitizeConfirm(false)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.1)",
                          color: "var(--fg)",
                          border: "1px solid var(--border)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Audit Certificate Card */}
                {usbSanitizeReport && (
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#10b981", fontWeight: 700 }}>
                      <ShieldCheck size={20} />
                      Official Certificate of Sanitization Issued
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, fontSize: 12 }}>
                      <div>
                        Certificate ID: <strong style={{ color: "var(--fg)" }}>{usbSanitizeReport.certificateId}</strong>
                      </div>
                      <div>
                        Standard: <strong style={{ color: "var(--fg)" }}>{usbSanitizeReport.standard.toUpperCase()}</strong>
                      </div>
                      <div>
                        Passes Completed: <strong style={{ color: "var(--fg)" }}>{usbSanitizeReport.passesCompleted} / {usbSanitizeReport.totalPasses}</strong>
                      </div>
                      <div>
                        SHA-256 Hash: <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{usbSanitizeReport.cryptoHashSha256.substring(0, 24)}...</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 7. FORMAT WIZARD TAB */}
            {usbActiveTab === "format" && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                  Flash Storage Formatting Wizard
                </div>

                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  {/* Filesystem Selector */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
                      Target Filesystem
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 8 }}>
                      {[
                        { id: "exFAT", name: "exFAT (Recommended)", desc: "Optimal wear-leveling, cross-platform Windows/Mac/Linux, >4GB files" },
                        { id: "FAT32", name: "FAT32", desc: "Universal legacy support, UEFI bootloaders, 4GB max file limit" },
                        { id: "NTFS", name: "NTFS", desc: "Windows native ACL security, compression, Alternate Data Streams" },
                        { id: "ReFS", name: "ReFS (Dev Drive)", desc: "Block cloning CoW, data integrity checksums, dev builds" },
                      ].map((fs) => (
                        <div
                          key={fs.id}
                          onClick={() => setFormatFs(fs.id as any)}
                          style={{
                            padding: 10,
                            borderRadius: 6,
                            background: formatFs === fs.id ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.02)",
                            border: formatFs === fs.id ? "1px solid #3b82f6" : "1px solid var(--border)",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: formatFs === fs.id ? "#60a5fa" : "var(--fg)" }}>
                            {fs.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>
                            {fs.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Volume Label & Cluster Size */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
                        Volume Label
                      </label>
                      <input
                        type="text"
                        placeholder={currentDevice.label || "NEXUS_USB"}
                        value={formatLabel}
                        onChange={(e) => setFormatLabel(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          marginTop: 6,
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid var(--border)",
                          color: "var(--fg)",
                          fontSize: 13,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
                        Allocation Unit (Cluster Size)
                      </label>
                      <select
                        value={formatCluster}
                        onChange={(e) => setFormatCluster(Number(e.target.value))}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          marginTop: 6,
                          borderRadius: 6,
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid var(--border)",
                          color: "var(--fg)",
                          fontSize: 13,
                        }}
                      >
                        <option value={4096}>4 KB (Standard Small Files)</option>
                        <option value={16384}>16 KB</option>
                        <option value={32768}>32 KB (Standard FAT32)</option>
                        <option value={65536}>64 KB</option>
                        <option value={131072}>128 KB (Optimal Flash Wear-Leveling)</option>
                        <option value={262144}>256 KB (High Throughput Video Drives)</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick format checkbox */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      id="quickFmt"
                      checked={formatQuick}
                      onChange={(e) => setFormatQuick(e.target.checked)}
                    />
                    <label htmlFor="quickFmt" style={{ fontSize: 13, color: "var(--fg)" }}>
                      Perform Quick Format (re-creates file table without zeroing entire physical NAND)
                    </label>
                  </div>
                </div>

                {/* Warning and Action */}
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertTriangle size={20} style={{ color: "#ef4444" }} />
                    <span style={{ fontSize: 12, color: "#fca5a5" }}>
                      Warning: Formatting will irrevocably destroy all files on {currentDevice.driveLetter} ({currentDevice.label}).
                    </span>
                  </div>

                  {!formatConfirm ? (
                    <button
                      onClick={() => setFormatConfirm(true)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        background: "#ef4444",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Format Volume
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleFormat}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          background: "#b91c1c",
                          color: "#fff",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirm & Erase All
                      </button>
                      <button
                        onClick={() => setFormatConfirm(false)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.1)",
                          color: "var(--fg)",
                          border: "1px solid var(--border)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 8. SPEED BENCHMARK TAB */}
            {usbActiveTab === "benchmark" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                      Sustained NAND & Burst Speed Benchmark
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                      Distinguishes initial RAM buffer burst cache vs true sustained flash write speed.
                    </div>
                  </div>

                  <button
                    onClick={() => runUsbBenchmark(currentDevice.path)}
                    disabled={usbLoading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 6,
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Play size={14} />
                    {usbLoading ? "Benchmarking..." : "Run Benchmark"}
                  </button>
                </div>

                {usbBenchmarkResult ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                        Sequential Read
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981", marginTop: 4 }}>
                        {usbBenchmarkResult.seqReadMBps} <span style={{ fontSize: 14, fontWeight: 400 }}>MB/s</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>
                        Peak multi-threaded streaming read
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                        Burst Sequential Write
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6", marginTop: 4 }}>
                        {usbBenchmarkResult.seqWriteMBps} <span style={{ fontSize: 14, fontWeight: 400 }}>MB/s</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>
                        RAM cache / SLC buffer ingestion
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                        Sustained NAND Write
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#8b5cf6", marginTop: 4 }}>
                        {usbBenchmarkResult.sustainedWriteMBps} <span style={{ fontSize: 14, fontWeight: 400 }}>MB/s</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>
                        True flash speed after buffer fills
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                        4K Random Read IOPS
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", marginTop: 4 }}>
                        {usbBenchmarkResult.rand4kReadIOPS.toLocaleString()} <span style={{ fontSize: 12 }}>IOPS</span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                        4K Random Write IOPS
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", marginTop: 4 }}>
                        {usbBenchmarkResult.rand4kWriteIOPS.toLocaleString()} <span style={{ fontSize: 12 }}>IOPS</span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "uppercase" }}>
                        Burst Drop Ratio
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", marginTop: 4 }}>
                        {usbBenchmarkResult.bufferBurstDropRatio}x
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>
                        {usbBenchmarkResult.bufferBurstDropRatio > 1.2
                          ? "Pronounced cache exhaustion drop"
                          : "Consistent sustained throughput"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px dashed var(--border)",
                      borderRadius: 8,
                      padding: 40,
                      textAlign: "center",
                      color: "var(--fg-muted)",
                    }}
                  >
                    Click &quot;Run Benchmark&quot; to test sequential, sustained, and 4K random IOPS for {currentDevice.driveLetter}.
                  </div>
                )}
              </>
            )}

            {/* 9. COUNTERFEIT FAKE FLASH DETECTOR TAB */}
            {usbActiveTab === "integrity" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                      Counterfeit & Spoofed Capacity Detector (H2testw / F3 Engine)
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                      Tests actual physical NAND capacity using cryptographic pattern verification to expose scam flash drives.
                    </div>
                  </div>

                  <button
                    onClick={() => runUsbIntegrityTest(currentDevice.path, !integrityFull)}
                    disabled={usbLoading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 6,
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ShieldCheck size={14} />
                    {usbLoading ? "Verifying..." : "Verify Flash Capacity"}
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    id="fullScan"
                    checked={integrityFull}
                    onChange={(e) => setIntegrityFull(e.target.checked)}
                  />
                  <label htmlFor="fullScan" style={{ fontSize: 12, color: "var(--fg)" }}>
                    Deep Block Verification (test non-destructive capacity boundaries and high-water sectors)
                  </label>
                </div>

                {usbIntegrityResult && (
                  <div
                    style={{
                      background: usbIntegrityResult.isCounterfeit
                        ? "rgba(239, 68, 68, 0.1)"
                        : "rgba(16, 185, 129, 0.1)",
                      border: usbIntegrityResult.isCounterfeit
                        ? "1px solid rgba(239, 68, 68, 0.3)"
                        : "1px solid rgba(16, 185, 129, 0.3)",
                      borderRadius: 8,
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {usbIntegrityResult.isCounterfeit ? (
                        <ShieldAlert size={28} style={{ color: "#ef4444" }} />
                      ) : (
                        <CheckCircle2 size={28} style={{ color: "#10b981" }} />
                      )}
                      <div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: usbIntegrityResult.isCounterfeit ? "#f87171" : "#10b981",
                          }}
                        >
                          {usbIntegrityResult.isCounterfeit
                            ? "COUNTERFEIT FLASH DETECTED!"
                            : "GENUINE FLASH MEMORY CONFIRMED"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--fg)", marginTop: 4 }}>
                          {usbIntegrityResult.statusMessage}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 12,
                        marginTop: 16,
                        borderTop: "1px solid var(--border)",
                        paddingTop: 14,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Claimed Firmware Capacity</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginTop: 2 }}>
                          {formatBytes(usbIntegrityResult.claimedCapacityBytes)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Verified Physical Capacity</div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: usbIntegrityResult.isCounterfeit ? "#f87171" : "#10b981",
                            marginTop: 2,
                          }}
                        >
                          {formatBytes(usbIntegrityResult.verifiedCapacityBytes)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>Corrupted / Loopback Blocks</div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: usbIntegrityResult.corruptedBytes > 0 ? "#ef4444" : "var(--fg)",
                            marginTop: 2,
                          }}
                        >
                          {formatBytes(usbIntegrityResult.corruptedBytes)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 10. DISK IMAGE & BACKUP TAB */}
            {usbActiveTab === "disk_image" && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                  Raw Disk Backup & OS Flasher
                </div>

                {/* Backup USB to Image */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                    Create Raw Disk Image (.IMG) Backup
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                    Creates a bit-for-bit sector image of {currentDevice.driveLetter} including partition table and boot sector.
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <input
                      type="text"
                      value={imagePath}
                      onChange={(e) => setImagePath(e.target.value)}
                      placeholder="D:\backups\usb_clone.img"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <button
                      onClick={handleCreateImage}
                      disabled={usbLoading}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Download size={14} />
                      {usbLoading ? "Dumping..." : "Dump Image"}
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <input
                      type="checkbox"
                      id="compressImg"
                      checked={imageCompress}
                      onChange={(e) => setImageCompress(e.target.checked)}
                    />
                    <label htmlFor="compressImg" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                      Compress image on-the-fly (sparse blocks skipped to save host disk space)
                    </label>
                  </div>
                </div>

                {/* Flash ISO/IMG to USB */}
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                    Flash Bootable ISO / IMG to USB Drive
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                    Writes Linux, Raspberry Pi OS, or Windows installation media with automatic sector verification.
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <input
                      type="text"
                      value={burnSource}
                      onChange={(e) => setBurnSource(e.target.value)}
                      placeholder="D:\downloads\os_installer.iso"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <button
                      onClick={() => store.pushToast("info", "Flash Simulator", `Flashing ${burnSource} to ${currentDevice.driveLetter}...`)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <UploadCloud size={14} />
                      Flash to {currentDevice.driveLetter}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 22px",
            borderTop: "1px solid var(--border)",
            background: "rgba(0,0,0,0.25)",
            fontSize: 11,
            color: "var(--fg-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={14} />
            <span>Nexus Universal Storage Controller · UASP 10Gbps Ready · NIST 800-88 Compliant</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentDevice && (
              <span>
                Drive: <strong style={{ color: "var(--fg)" }}>{currentDevice.driveLetter}</strong> ({currentDevice.filesystem})
              </span>
            )}
            <button
              onClick={closeUsbModal}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
