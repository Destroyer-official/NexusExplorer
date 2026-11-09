import { useState } from "react";
import { useAppStore } from "@/state/store";
import { formatBytes, formatSpeed, formatDuration } from "@/lib/format";
import {
  X,
  Pause,
  Play,
  XCircle,
  Zap,
  Activity,
  Cpu,
  ShieldCheck,
  HardDrive,
  Copy,
  Bot,
  User,
  Sliders,
  ChevronDown,
  ChevronUp,
  Trash2,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { TransferJob, AccelerationMode } from "@/types";

function getAccelerationBadge(mode?: AccelerationMode) {
  switch (mode) {
    case "atomic_volume_move":
      return {
        label: "Atomic Volume Move (Zero-Copy ⚡)",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.14)",
        border: "rgba(16, 185, 129, 0.35)",
        icon: Zap,
      };
    case "refs_block_clone":
      return {
        label: "ReFS Block Clone (Zero-Copy CoW)",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.3)",
        icon: Zap,
      };
    case "kernel_offload":
      return {
        label: "Kernel CopyFile2 Offload",
        color: "#06b6d4",
        bg: "rgba(6, 182, 212, 0.12)",
        border: "rgba(6, 182, 212, 0.3)",
        icon: Activity,
      };
    case "nvme_direct_stream":
      return {
        label: "NVMe Direct Ring (Bypass Cache)",
        color: "#8b5cf6",
        bg: "rgba(139, 92, 246, 0.12)",
        border: "rgba(139, 92, 246, 0.3)",
        icon: HardDrive,
      };
    case "parallel_batch":
      return {
        label: "Parallel Work-Stealing Workers",
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.3)",
        icon: Cpu,
      };
    case "sparse_hole_punch":
      return {
        label: "Sparse Hole-Punch (Zero-Extents Bypassed)",
        color: "#ec4899",
        bg: "rgba(236, 72, 153, 0.12)",
        border: "rgba(236, 72, 153, 0.3)",
        icon: HardDrive,
      };
    case "standard_stream":
      return {
        label: "High-Throughput SIMD Stream",
        color: "#3b82f6",
        bg: "rgba(59, 130, 246, 0.12)",
        border: "rgba(59, 130, 246, 0.3)",
        icon: Zap,
      };
    default:
      return {
        label: "Hardware Direct Acceleration",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.3)",
        icon: Zap,
      };
  }
}

/**
 * Windows Explorer 2027+ Real-Time Throughput Graph
 * High-performance SVG area chart with dynamic auto-scaling, glowing peak tracer,
 * and background reference gridlines.
 */
function WindowsSpeedGraph({
  job,
  speedHistory,
}: {
  job: TransferJob;
  speedHistory: number[];
}) {
  const isCompleted = job.state === "completed";
  const isPaused = job.state === "paused";
  const currentSpeed = job.speedBps || 0;

  // Ensure history has sufficient points for a smooth curve
  const data = speedHistory.length >= 2 ? speedHistory : [0, currentSpeed];
  const peakSpeed = Math.max(...data, currentSpeed, 1024 * 1024); // at least 1 MB/s scale
  const avgSpeed = data.reduce((a, b) => a + b, 0) / (data.length || 1);

  const width = 380;
  const height = 90;
  const paddingLeft = 6;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 18;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((val, idx) => {
    const x = paddingLeft + (idx / Math.max(1, data.length - 1)) * chartWidth;
    const clamped = Math.max(0, val);
    const y = paddingTop + chartHeight - (clamped / peakSpeed) * chartHeight;
    return { x, y };
  });

  // Smooth monotonic cubic Bézier spline interpolation
  const linePath = points.length <= 1
    ? ""
    : points.length === 2
      ? `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`
      : points.reduce((acc, pt, i, arr) => {
          if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
          const prev = arr[i - 1];
          const midX = ((prev.x + pt.x) / 2).toFixed(1);
          return `${acc} C ${midX} ${prev.y.toFixed(1)}, ${midX} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }, "");

  const lastPt = points[points.length - 1] || { x: width - paddingRight, y: height - paddingBottom };
  const firstPt = points[0] || { x: paddingLeft, y: height - paddingBottom };
  const areaPath = `${linePath} L ${lastPt.x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} L ${firstPt.x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`;

  const strokeColor = isCompleted
    ? "#10b981"
    : isPaused
      ? "#f59e0b"
      : job.kind === "move"
        ? "#fbbf24"
        : job.kind === "copy"
          ? "#06b6d4"
          : "#f43f5e";

  const gradId = `speed-grad-${job.id}`;

  return (
    <div
      style={{
        background: "rgba(0, 0, 0, 0.45)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "var(--radius-md)",
        padding: "8px 10px 4px 10px",
        marginTop: 6,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        position: "relative",
        boxShadow: "inset 0 1px 4px rgba(0,0,0,0.5)",
      }}
    >
      {/* Readout Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 11,
          paddingBottom: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: strokeColor, letterSpacing: -0.2 }}>
            {formatSpeed(currentSpeed)}
          </span>
          <span style={{ color: "var(--text-faint)", fontSize: 10 }}>
            Avg {formatSpeed(avgSpeed)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--text-dim)", fontSize: 10 }}>
            Peak: <strong style={{ color: "var(--text)" }}>{formatSpeed(peakSpeed)}</strong>
          </span>
          {isPaused && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 3,
                background: "rgba(245,158,11,0.2)",
                color: "#f59e0b",
                fontWeight: 700,
              }}
            >
              PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Speed Graph SVG */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: 86, overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
          </linearGradient>
          <filter id={`glow-${job.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Gridlines */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={width - paddingRight}
          y2={paddingTop}
          stroke="rgba(255,255,255,0.07)"
          strokeDasharray="3,3"
          strokeWidth="1"
        />
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight / 2}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight / 2}
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="3,3"
          strokeWidth="1"
        />
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* Gradient Area Fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Top Wave Line */}
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pulsing Head Tracker Dot */}
        {!isCompleted && !isPaused && (
          <g transform={`translate(${lastPt.x}, ${lastPt.y})`}>
            <circle r="5" fill={strokeColor} filter={`url(#glow-${job.id})`} />
            <circle r="2.2" fill="#ffffff" />
          </g>
        )}

        {/* Scale labels */}
        <text
          x={paddingLeft + 2}
          y={paddingTop + 8}
          fill="var(--text-faint)"
          fontSize="8"
          fontFamily="var(--font-mono)"
        >
          {formatSpeed(peakSpeed)}
        </text>
        <text
          x={paddingLeft + 2}
          y={paddingTop + chartHeight - 2}
          fill="var(--text-faint)"
          fontSize="8"
          fontFamily="var(--font-mono)"
        >
          0 B/s
        </text>
        <text
          x={width - paddingRight}
          y={height - 2}
          fill="var(--text-faint)"
          fontSize="8"
          textAnchor="end"
          fontFamily="var(--font-mono)"
        >
          Live Throughput (Rolling 60s)
        </text>
      </svg>
    </div>
  );
}

export default function TransfersPanel() {
  const store = useAppStore();
  const jobs = Object.values(store.transfers);
  const [viewTier, setViewTier] = useState<"normal" | "super" | "ai">("normal");
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedJobs((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const copyAiTelemetry = (job: TransferJob) => {
    const payload = {
      jobId: job.id,
      kind: job.kind,
      state: job.state,
      timestamp: new Date().toISOString(),
      engine: {
        accelerationMode: job.accelerationMode ?? "standard_stream",
        iops: job.iops ?? (Math.round((job.speedBps || 0) / 65536) || null),
        activeWorkers: job.activeWorkers ?? 1,
        bufferSizeMb: job.bufferSizeMb ?? 8,
        integrityAlgorithm: job.hashAlgorithm ?? "XXH3-64 SIMD",
        faultTolerance: "Atomic Transaction Journal (.nexuspart)",
        atomicCommit: "POSIX/Win32 Atomic MFT Commit",
      },
      metrics: {
        totalBytes: job.totalBytes,
        processedBytes: job.processedBytes,
        totalFiles: job.totalFiles,
        processedFiles: job.processedFiles,
        speedBps: job.speedBps,
        etaSecs: job.etaSecs,
        percentComplete: job.totalBytes
          ? Math.min(100, (job.processedBytes / job.totalBytes) * 100).toFixed(1)
          : "0.0",
      },
      currentFile: job.currentFile,
      recentEvents: job.recentEvents ?? [],
    };
    void store.copyText(JSON.stringify(payload, null, 2), "AI Telemetry JSON copied to clipboard");
  };

  const completedCount = jobs.filter(
    (j) => j.state === "completed" || j.state === "failed" || j.state === "cancelled",
  ).length;

  return (
    <div
      className="transfers-panel"
      style={{
        width: viewTier === "normal" ? 440 : 540,
        maxWidth: "94vw",
        transition: "width 0.2s ease",
      }}
    >
      {/* Header */}
      <div className="transfers-header" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} style={{ color: "var(--accent)" }} />
          <strong style={{ fontSize: 13, letterSpacing: 0.3 }}>2027+ Transfer Engine</strong>
          {jobs.length > 0 && (
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 10,
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {jobs.filter((j) => j.state === "running").length} active
            </span>
          )}
        </div>

        {/* Tier Selector & Header Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {completedCount > 0 && (
            <button
              className="btn btn-sm"
              style={{ padding: "2px 6px", fontSize: 10, height: 22 }}
              onClick={() => store.clearCompletedTransfers()}
              title="Clear completed transfers from list"
            >
              <Trash2 size={11} /> Clear done
            </button>
          )}

          <div
            style={{
              display: "flex",
              gap: 2,
              background: "var(--surface)",
              padding: 2,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
            }}
          >
            <button
              className={`btn-tier ${viewTier === "normal" ? "active" : ""}`}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 3,
                border: "none",
                cursor: "pointer",
                background: viewTier === "normal" ? "var(--accent)" : "transparent",
                color: viewTier === "normal" ? "#fff" : "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onClick={() => setViewTier("normal")}
              title="Windows Explorer 2027 Graph view"
            >
              <User size={11} /> Normal
            </button>
            <button
              className={`btn-tier ${viewTier === "super" ? "active" : ""}`}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 3,
                border: "none",
                cursor: "pointer",
                background: viewTier === "super" ? "var(--accent)" : "transparent",
                color: viewTier === "super" ? "#fff" : "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onClick={() => setViewTier("super")}
              title="Hardware & bus telemetry dashboard"
            >
              <Sliders size={11} /> Super User
            </button>
            <button
              className={`btn-tier ${viewTier === "ai" ? "active" : ""}`}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                borderRadius: 3,
                border: "none",
                cursor: "pointer",
                background: viewTier === "ai" ? "var(--accent)" : "transparent",
                color: viewTier === "ai" ? "#fff" : "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onClick={() => setViewTier("ai")}
              title="Machine-readable telemetry for AI Agents"
            >
              <Bot size={11} /> AI Inspector
            </button>
          </div>

          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={store.toggleTransfers}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="transfers-body" style={{ maxHeight: "72vh", overflowY: "auto", padding: 12 }}>
        {jobs.length === 0 && (
          <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--text-dim)" }}>
            <Activity size={24} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>No active file transfers</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
              Drag and drop items, copy/paste, or stage files to monitor real-time transfers.
            </div>
          </div>
        )}

        {jobs.map((job) => {
          const isDone = job.state === "completed";
          const pct = isDone
            ? 100
            : job.totalBytes
              ? Math.min(100, (job.processedBytes / job.totalBytes) * 100)
              : 0;

          const isExpanded = expandedJobs[job.id] ?? true;
          const badge = getAccelerationBadge(job.accelerationMode);
          const BadgeIcon = badge.icon;

          const activeFile = job.currentFile
            ? job.currentFile.split(/[/\\]/).pop() || job.currentFile
            : isDone
              ? "Transfer completed"
              : "Preparing transfer stream...";

          return (
            <div
              key={job.id}
              className="transfer-item"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                position: "relative",
              }}
            >
              {/* Primary Top Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: "78%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        textTransform: "uppercase",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 0.6,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          job.kind === "copy"
                            ? "rgba(6,182,212,0.18)"
                            : job.kind === "move"
                              ? "rgba(245,158,11,0.18)"
                              : "rgba(239,68,68,0.18)",
                        color:
                          job.kind === "copy"
                            ? "#06b6d4"
                            : job.kind === "move"
                              ? "#fbbf24"
                              : "#f87171",
                      }}
                    >
                      {job.kind}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={job.currentFile ?? ""}
                    >
                      {job.totalFiles > 1
                        ? `${job.kind === "move" ? "Moving" : "Copying"} ${job.totalFiles.toLocaleString()} items`
                        : activeFile}
                    </span>
                  </div>

                  {job.currentFile && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-dim)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={job.currentFile}
                    >
                      <Folder size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {job.currentFile}
                      </span>
                    </div>
                  )}

                  {job.destination && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--accent)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                        marginTop: 2,
                        width: "fit-content",
                      }}
                      onClick={() => {
                        const d = job.destination;
                        if (d) void store.openTab(d);
                      }}
                      title="Click to open destination folder in new tab"
                    >
                      <FolderOpen size={10} />
                      <span style={{ textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>
                        To: {job.destination}
                      </span>
                    </div>
                  )}
                </div>

                {/* Percentage & State Pill */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: isDone ? "#10b981" : "var(--accent-strong, #38bdf8)",
                      letterSpacing: -0.3,
                    }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "capitalize",
                      color: isDone
                        ? "#10b981"
                        : job.state === "running"
                          ? "#38bdf8"
                          : job.state === "paused"
                            ? "#f59e0b"
                            : "var(--text-faint)",
                    }}
                  >
                    {job.state}
                  </span>
                </div>
              </div>

              {/* Enhanced Windows 11 Progress Bar */}
              <div
                style={{
                  height: 8,
                  background: "var(--surface-3, rgba(255,255,255,0.06))",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: isDone
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : job.kind === "move"
                        ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                        : "linear-gradient(90deg, var(--accent, #3b82f6), #38bdf8)",
                    borderRadius: 4,
                    transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: !isDone ? "0 0 8px rgba(56,189,248,0.4)" : "none",
                  }}
                />
              </div>

              {/* Quick Summary Row */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--text-dim)",
                }}
              >
                <span>
                  {formatBytes(isDone ? job.totalBytes : job.processedBytes)} of{" "}
                  {formatBytes(job.totalBytes)}
                </span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                  {isDone ? "Completed" : formatSpeed(job.speedBps)}
                </span>
                <span>
                  {isDone
                    ? "Done"
                    : job.etaSecs > 0
                      ? `About ${formatDuration(job.etaSecs)} remaining`
                      : "-- ETA"}
                </span>
                <span>
                  {isDone ? job.totalFiles : job.processedFiles} / {job.totalFiles} files
                </span>
              </div>

              {/* ──────────────── TIER 1: WINDOWS 2027 REAL-TIME SPEED GRAPH ──────────────── */}
              {viewTier === "normal" && (
                <>
                  {isExpanded && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                      <WindowsSpeedGraph
                        job={job}
                        speedHistory={job.speedHistory ?? [0, job.speedBps || 0]}
                      />

                      {/* Acceleration Mode Badge */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          borderRadius: "var(--radius-sm)",
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          color: badge.color,
                        }}
                      >
                        <BadgeIcon size={12} />
                        <span>Engine: {badge.label}</span>
                      </div>
                    </div>
                  )}

                  {/* Windows Explorer Style "Fewer details / More details" button */}
                  <button
                    onClick={() => toggleExpand(job.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-dim)",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 0",
                      alignSelf: "flex-start",
                    }}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={13} /> Fewer details
                      </>
                    ) : (
                      <>
                        <ChevronDown size={13} /> More details (Speed graph & engine)
                      </>
                    )}
                  </button>
                </>
              )}

              {/* ──────────────── TIER 2: SUPER USER HARDWARE TELEMETRY ──────────────── */}
              {viewTier === "super" && (
                <div
                  style={{
                    marginTop: 4,
                    padding: 10,
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        borderRadius: 4,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: badge.color,
                      }}
                    >
                      <BadgeIcon size={13} />
                      <span>Acceleration: {badge.label}</span>
                    </div>
                  </div>

                  {/* Hardware Telemetry Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 6,
                      fontSize: 10,
                    }}
                  >
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>IOPS</div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#38bdf8" }}>
                        {job.iops !== undefined
                          ? `${job.iops.toLocaleString()} IOPS`
                          : job.speedBps > 0
                            ? `${Math.round(job.speedBps / 65536).toLocaleString()} IOPS`
                            : "Idle"}
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Worker Threads</div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa" }}>
                        {job.activeWorkers ?? 1} Worker (Direct)
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Buffer Pipeline</div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#10b981" }}>
                        {job.bufferSizeMb !== undefined ? `${job.bufferSizeMb} MB Ring` : "8 MB Ring"}
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Integrity Hash</div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text)" }}>
                        {job.hashAlgorithm ?? "XXH3-64 SIMD"}
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Fault Tolerance</div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text)" }}>
                        Atomic Journal (.nexuspart)
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Atomic Commit</div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text)" }}>
                        POSIX/Win32 Atomic
                      </div>
                    </div>
                  </div>

                  {/* Dynamic QoS Bandwidth Profiles */}
                  {!isDone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, padding: "2px 0" }}>
                      <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Bandwidth QoS:</span>
                      <button
                        className="btn btn-sm"
                        style={{ padding: "2px 7px", fontSize: 10, height: 21 }}
                        onClick={() => void store.setTransferQoS(job.id, "uncapped")}
                        title="Uncapped maximum NVMe / SSD throughput"
                      >
                        ⚡ Uncapped
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ padding: "2px 7px", fontSize: 10, height: 21 }}
                        onClick={() => void store.setTransferQoS(job.id, "gaming")}
                        title="50 MB/s (Low latency for gaming & foreground responsiveness)"
                      >
                        🎮 50 MB/s
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ padding: "2px 7px", fontSize: 10, height: 21 }}
                        onClick={() => void store.setTransferQoS(job.id, "battery")}
                        title="25 MB/s (Energy saver profile)"
                      >
                        🔋 25 MB/s
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ padding: "2px 7px", fontSize: 10, height: 21 }}
                        onClick={() => void store.setTransferQoS(job.id, "whisper")}
                        title="10 MB/s (Silent background I/O pacing)"
                      >
                        🤫 10 MB/s
                      </button>
                    </div>
                  )}

                  {/* Full Speed Waveform */}
                  <WindowsSpeedGraph
                    job={job}
                    speedHistory={job.speedHistory ?? [0, job.speedBps || 0]}
                  />

                  {/* Event Log */}
                  {job.recentEvents && job.recentEvents.length > 0 && (
                    <div
                      style={{
                        background: "var(--bg)",
                        padding: 6,
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        maxHeight: 70,
                        overflowY: "auto",
                      }}
                    >
                      {job.recentEvents.slice(0, 4).map((ev, i) => (
                        <div key={i} style={{ color: ev.type === "success" ? "#10b981" : "#f59e0b" }}>
                          [{ev.time}] {ev.msg}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────── TIER 3: AI AGENT INSPECTOR ──────────────── */}
              {viewTier === "ai" && (
                <div
                  style={{
                    marginTop: 4,
                    padding: 8,
                    background: "var(--bg)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>
                      🤖 AI Machine-Readable Telemetry Payload
                    </span>
                    <button
                      className="btn btn-sm"
                      style={{ padding: "2px 8px", fontSize: 10 }}
                      onClick={() => copyAiTelemetry(job)}
                    >
                      <Copy size={11} /> Copy JSON for AI
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: 8,
                      background: "rgba(0,0,0,0.4)",
                      borderRadius: 4,
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "#93c5fd",
                      overflowX: "auto",
                      maxHeight: 140,
                    }}
                  >
                    {JSON.stringify(
                      {
                        jobId: job.id,
                        kind: job.kind,
                        state: job.state,
                        accelerationMode: job.accelerationMode ?? "standard_stream",
                        speedBps: job.speedBps,
                        iops: job.iops ?? Math.round((job.speedBps || 0) / 65536),
                        workers: job.activeWorkers ?? 1,
                        processedBytes: isDone ? job.totalBytes : job.processedBytes,
                        totalBytes: job.totalBytes,
                        processedFiles: isDone ? job.totalFiles : job.processedFiles,
                        totalFiles: job.totalFiles,
                        etaSecs: job.etaSecs,
                        currentFile: job.currentFile,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {job.state === "running" && (
                    <button className="btn btn-sm" onClick={() => void store.pauseTransfer(job.id)}>
                      <Pause size={12} /> Pause
                    </button>
                  )}
                  {job.state === "paused" && (
                    <button className="btn btn-sm" onClick={() => void store.resumeTransfer(job.id)}>
                      <Play size={12} /> Resume
                    </button>
                  )}
                  {(job.state === "running" || job.state === "paused") && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => void store.cancelTransfer(job.id)}
                    >
                      <XCircle size={12} /> Cancel
                    </button>
                  )}
                  {isDone && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                      }}
                    >
                      <ShieldCheck size={14} /> Transfer completed
                    </span>
                  )}
                  {job.state === "failed" && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                      }}
                    >
                      <XCircle size={14} /> Transfer failed: {job.error}
                    </span>
                  )}
                </div>

                {/* Dismiss button when finished */}
                {(isDone || job.state === "failed" || job.state === "cancelled") && (
                  <button
                    className="icon-btn"
                    style={{ width: 22, height: 22, opacity: 0.6 }}
                    onClick={() => store.dismissTransfer(job.id)}
                    title="Dismiss transfer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
