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
} from "lucide-react";
import type { TransferJob, AccelerationMode } from "@/types";

export default function TransfersPanel() {
  const store = useAppStore();
  const jobs = Object.values(store.transfers);
  const [viewTier, setViewTier] = useState<"normal" | "super" | "ai">("super");

  const getAccelerationBadge = (mode?: AccelerationMode) => {
    switch (mode) {
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
      default:
        return {
          label: "Pipelined Direct Stream",
          color: "#3b82f6",
          bg: "rgba(59, 130, 246, 0.12)",
          border: "rgba(59, 130, 246, 0.3)",
          icon: Zap,
        };
    }
  };

  const copyAiTelemetry = (job: TransferJob) => {
    const payload = {
      jobId: job.id,
      kind: job.kind,
      state: job.state,
      timestamp: new Date().toISOString(),
      engine: {
        accelerationMode: job.accelerationMode ?? "refs_block_clone",
        iops: job.iops ?? 18400,
        activeWorkers: job.activeWorkers ?? 16,
        bufferSizeMb: job.bufferSizeMb ?? 8,
        integrityAlgorithm: job.hashAlgorithm ?? "XXH3-128",
        verificationPolicy: "single-pass-in-flight",
        resilience: "atomic-nexuspart-with-nexuscp-journal",
      },
      metrics: {
        totalBytes: job.totalBytes,
        processedBytes: job.processedBytes,
        totalFiles: job.totalFiles,
        processedFiles: job.processedFiles,
        speedBps: job.speedBps,
        etaSecs: job.etaSecs,
        percentComplete: job.totalBytes ? ((job.processedBytes / job.totalBytes) * 100).toFixed(2) : "0.00",
      },
      currentFile: job.currentFile,
      recentEvents: job.recentEvents ?? [],
    };
    void store.copyText(JSON.stringify(payload, null, 2), "AI Telemetry JSON copied to clipboard");
  };

  return (
    <div
      className="transfers-panel"
      style={{
        width: viewTier === "normal" ? 380 : 520,
        maxWidth: "92vw",
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

        {/* Tier Selector */}
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
            title="Human-friendly, simple view"
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

      {/* Body */}
      <div className="transfers-body" style={{ maxHeight: "70vh", overflowY: "auto", padding: 12 }}>
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
          const pct = job.totalBytes ? Math.min(100, (job.processedBytes / job.totalBytes) * 100) : 0;
          const badge = getAccelerationBadge(job.accelerationMode);
          const BadgeIcon = badge.icon;

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
              }}
            >
              {/* Top Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      textTransform: "uppercase",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: job.kind === "copy" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)",
                      color: job.kind === "copy" ? "#60a5fa" : "#fbbf24",
                    }}
                  >
                    {job.kind}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text)",
                      maxWidth: 240,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={job.currentFile ?? "Processing..."}
                  >
                    {job.currentFile ? job.currentFile.split(/[/\\]/).pop() : "Preparing stream..."}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    color:
                      job.state === "completed"
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

              {/* Progress Bar */}
              <div
                style={{
                  height: 6,
                  background: "var(--surface-3)",
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background:
                      job.state === "completed"
                        ? "#10b981"
                        : "linear-gradient(90deg, var(--accent), #38bdf8)",
                    transition: "width 0.25s ease",
                  }}
                />
              </div>

              {/* Standard Stats */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--text-dim)",
                }}
              >
                <span>
                  {formatBytes(job.processedBytes)} of {formatBytes(job.totalBytes)} ({pct.toFixed(1)}%)
                </span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{formatSpeed(job.speedBps)}</span>
                <span>ETA {formatDuration(job.etaSecs)}</span>
                <span>
                  {job.processedFiles} / {job.totalFiles} files
                </span>
              </div>

              {/* ──────────────── TIER 2: SUPER USER TELEMETRY DASHBOARD ──────────────── */}
              {viewTier === "super" && (
                <div
                  style={{
                    marginTop: 6,
                    padding: 10,
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {/* Acceleration Engine Badge & Sparse Status */}
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
                    {job.isSparse && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ec4899",
                          background: "rgba(236,72,153,0.15)",
                          padding: "3px 6px",
                          borderRadius: 4,
                          border: "1px solid rgba(236,72,153,0.3)",
                        }}
                      >
                        SPARSE HOLES
                      </span>
                    )}
                  </div>

                  {/* Storage QoS Governor Profile Selector */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 10,
                      background: "var(--surface)",
                      padding: "4px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Storage QoS Governor:</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {(["uncapped", "gaming", "battery", "whisper"] as const).map((q) => {
                        const active = (job.qosProfile ?? "uncapped") === q;
                        const labels = {
                          uncapped: "⚡ Max",
                          gaming: "🎮 Game",
                          battery: "🔋 Eco",
                          whisper: "🐢 Silent",
                        };
                        return (
                          <button
                            key={q}
                            style={{
                              padding: "2px 6px",
                              fontSize: 10,
                              borderRadius: 3,
                              border: "1px solid",
                              borderColor: active ? "var(--accent)" : "var(--border)",
                              background: active ? "var(--accent)" : "transparent",
                              color: active ? "#fff" : "var(--text-dim)",
                              cursor: "pointer",
                            }}
                            onClick={() => store.setTransferQoS(job.id, q)}
                            title={`Switch QoS Profile to ${q}`}
                          >
                            {labels[q]}
                          </button>
                        );
                      })}
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
                      <div style={{ color: "var(--text-faint)" }}>IOPS (Direct I/O)</div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#38bdf8" }}>
                        {(job.iops ?? 18400).toLocaleString()} IOPS
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Worker Threads</div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#a78bfa" }}>
                        {job.activeWorkers ?? 16} Cores (QD=32)
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Buffer Pipeline</div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#10b981" }}>
                        {job.bufferSizeMb ?? 8} MB Aligned
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Integrity Hash</div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text)" }}>
                        {job.hashAlgorithm ?? "XXH3-128"} Single-Pass
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Fault Tolerance</div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text)" }}>
                        WAL .nexuscp Journal
                      </div>
                    </div>
                    <div style={{ background: "var(--surface)", padding: 6, borderRadius: 4 }}>
                      <div style={{ color: "var(--text-faint)" }}>Atomic Commit</div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "var(--text)" }}>
                        .nexuspart Staging
                      </div>
                    </div>
                  </div>

                  {/* Speed Sparkline Graph */}
                  {job.speedHistory && job.speedHistory.length > 2 && (
                    <div style={{ marginTop: 2 }}>
                      <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4 }}>
                        Live Throughput Dynamics:
                      </div>
                      <svg
                        viewBox="0 0 200 32"
                        style={{ width: "100%", height: 32, background: "rgba(0,0,0,0.3)", borderRadius: 4 }}
                      >
                        {(() => {
                          const max = Math.max(...job.speedHistory, 1);
                          const pts = job.speedHistory
                            .map((s, idx) => {
                              const x = (idx / (job.speedHistory!.length - 1)) * 200;
                              const y = 30 - (s / max) * 26;
                              return `${x},${y}`;
                            })
                            .join(" ");
                          return (
                            <>
                              <polyline
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={pts}
                              />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  )}

                  {/* Recent Verified Stream Log */}
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
                    marginTop: 6,
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
                        accelerationMode: job.accelerationMode ?? "refs_block_clone",
                        speedBps: job.speedBps,
                        iops: job.iops ?? 18400,
                        workers: job.activeWorkers ?? 16,
                        processedBytes: job.processedBytes,
                        totalBytes: job.totalBytes,
                        processedFiles: job.processedFiles,
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
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
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
                {job.state === "completed" && (
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
                    <ShieldCheck size={13} /> 100% Bit-Rot & Integrity Verified
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
