import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import type { DevDriveReport, BitLockerVolumeStatus } from "@/types";
import {
  Cpu,
  HardDrive,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldAlert,
  ArrowRight,
  Zap,
} from "lucide-react";

interface DevDriveModalProps {
  open: boolean;
  onClose: () => void;
}

export function DevDriveModal({ open, onClose }: DevDriveModalProps) {
  const [report, setReport] = useState<DevDriveReport | null>(null);
  const [bitlocker, setBitlocker] = useState<BitLockerVolumeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockDrive, setUnlockDrive] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devRep, bitRep] = await Promise.allSettled([
        ipc.toolsDevdriveReport(),
        ipc.toolsBitlockerStatus(),
      ]);
      if (devRep.status === "fulfilled") setReport(devRep.value);
      if (bitRep.status === "fulfilled") setBitlocker(bitRep.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const handleUnlock = async () => {
    if (!unlockDrive || !unlockPassword) return;
    setUnlocking(true);
    setUnlockMsg(null);
    try {
      const res = await ipc.toolsBitlockerUnlock(unlockDrive, unlockPassword);
      setUnlockMsg(`Unlocked: ${res}`);
      setUnlockPassword("");
      setUnlockDrive(null);
      loadData();
    } catch (err) {
      setUnlockMsg(`Failed: ${err}`);
    } finally {
      setUnlocking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Storage & Dev Drive Acceleration Manager
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/30">
                  2027 Pro
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Audit Windows 11 Dev Drives, ReFS partitions, BitLocker encryption, and package cache CoW acceleration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 text-xs">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
              <span>Scanning volumes and auditing developer environments...</span>
            </div>
          ) : (
            <>
              {/* Dev Drives & ReFS Section */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4 text-indigo-400" />
                  Detected Dev Drives & Storage Volumes
                </h3>
                {report && report.devDrivesDetected && report.devDrivesDetected.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {report.devDrivesDetected.map((v) => (
                      <div
                        key={v.driveLetter}
                        className={`p-3 rounded-lg border ${
                          v.isDevDrive || v.cowSupported
                            ? "bg-indigo-950/20 border-indigo-500/40"
                            : "bg-slate-800/40 border-slate-700/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-100">
                            {v.driveLetter} [{v.volumeLabel || "Local Disk"}]
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              v.cowSupported
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {v.filesystem}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                          <div className="flex justify-between">
                            <span>Free Space:</span>
                            <span className="font-mono text-slate-200">
                              {formatBytes(v.freeBytes)} / {formatBytes(v.totalBytes)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Instant CoW Cloning:</span>
                            <span className={v.cowSupported ? "text-emerald-400 font-medium" : "text-slate-500"}>
                              {v.cowSupported ? "Supported (ReFS)" : "Disabled (NTFS)"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded bg-slate-800/40 border border-slate-700 text-slate-400">
                    No physical storage partitions queried.
                  </div>
                )}
              </div>

              {/* BitLocker Volumes Section */}
              {bitlocker.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-sky-400" />
                    BitLocker Volume Encryption
                  </h3>
                  <div className="space-y-2">
                    {bitlocker.map((b) => (
                      <div
                        key={b.driveLetter}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/60"
                      >
                        <div className="flex items-center gap-3">
                          {b.lockStatus === "Locked" ? (
                            <Lock className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Unlock className="h-4 w-4 text-emerald-400" />
                          )}
                          <div>
                            <span className="font-semibold text-slate-200 mr-2">{b.driveLetter}</span>
                            <span className="text-[11px] text-slate-400">({b.volumeType})</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Status: <span className="text-slate-300">{b.encryptionStatus}</span> ({b.percentageEncrypted}%) | Protection: {b.protectionStatus}
                            </div>
                          </div>
                        </div>

                        <div>
                          {b.lockStatus === "Locked" ? (
                            <button
                              onClick={() => {
                                setUnlockDrive(b.driveLetter);
                                setUnlockMsg(null);
                              }}
                              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition"
                            >
                              Unlock...
                            </button>
                          ) : (
                            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Unlocked
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Unlock popup prompt */}
                  {unlockDrive && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-800 border border-amber-500/40 flex items-center gap-2">
                      <input
                        type="password"
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        placeholder={`Password or recovery key for ${unlockDrive}...`}
                        className="flex-1 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs focus:outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={handleUnlock}
                        disabled={unlocking}
                        className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition"
                      >
                        {unlocking ? "Unlocking..." : "Submit"}
                      </button>
                      <button
                        onClick={() => setUnlockDrive(null)}
                        className="px-2 py-1.5 rounded hover:bg-slate-700 text-slate-400 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {unlockMsg && (
                    <div className="mt-1 text-[11px] text-sky-400 font-mono">{unlockMsg}</div>
                  )}
                </div>
              )}

              {/* Developer Package Caches */}
              {report && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Package Cache Zero-Copy CoW Status
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {report.packageCaches.map((c) => (
                      <div
                        key={c.ecosystem}
                        className="p-2.5 rounded bg-slate-800/40 border border-slate-700/50 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200">{c.ecosystem}</span>
                          {c.isOnDevDrive ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3 w-3" /> CoW Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                              <AlertTriangle className="h-3 w-3" /> Standard
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono truncate" title={c.currentPath}>
                          {c.currentPath}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optimization Recommendations */}
              {report && report.recommendedActions.length > 0 && (
                <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/30">
                  <span className="font-semibold text-indigo-300 block mb-1">
                    Performance Optimization Recommendations:
                  </span>
                  <ul className="space-y-1 text-slate-300">
                    {report.recommendedActions.map((act, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px]">
                        <ArrowRight className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
