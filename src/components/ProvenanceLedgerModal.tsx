import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import type { ProvenanceEvent, ProvenanceVerification } from "@/types";
import {
  ShieldCheck,
  ShieldAlert,
  History,
  X,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  Lock,
  Trash2,
  Copy,
  PlusCircle,
  Edit3,
} from "lucide-react";

interface ProvenanceLedgerModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProvenanceLedgerModal({ open, onClose }: ProvenanceLedgerModalProps) {
  const [records, setRecords] = useState<ProvenanceEvent[]>([]);
  const [verification, setVerification] = useState<ProvenanceVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const loadLog = async () => {
    setLoading(true);
    try {
      const data = await ipc.toolsProvenanceLog();
      setRecords(data);
      const v = await ipc.toolsProvenanceVerify();
      setVerification(v);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadLog();
    }
  }, [open]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await ipc.toolsProvenanceVerify();
      setVerification(res);
    } finally {
      setVerifying(false);
    }
  };

  if (!open) return null;

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "CREATE":
        return <span className="flex items-center gap-1 text-emerald-400 font-semibold"><PlusCircle className="h-3 w-3" /> CREATE</span>;
      case "MODIFY":
        return <span className="flex items-center gap-1 text-sky-400 font-semibold"><Edit3 className="h-3 w-3" /> MODIFY</span>;
      case "SHRED":
        return <span className="flex items-center gap-1 text-rose-400 font-semibold"><Trash2 className="h-3 w-3" /> SHRED</span>;
      case "VAULT_ENCRYPT":
      case "VAULT_DECRYPT":
        return <span className="flex items-center gap-1 text-purple-400 font-semibold"><Lock className="h-3 w-3" /> VAULT</span>;
      case "CLONE":
        return <span className="flex items-center gap-1 text-amber-400 font-semibold"><Copy className="h-3 w-3" /> CoW CLONE</span>;
      default:
        return <span className="text-slate-300 font-semibold">{eventType}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Tamper-Evident Cryptographic Provenance Ledger
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
                  BLAKE3 Merkle-Chain
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Append-only forensic audit trail recording every file modification, shred, and cryptographic operation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              {verifying ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : verification?.isValid ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              )}
              <span>Verify Chain Integrity</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Verification Status Banner */}
        {verification && (
          <div
            className={`px-6 py-2.5 border-b text-xs flex items-center justify-between ${
              verification.isValid
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                : "bg-rose-950/30 border-rose-500/40 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {verification.isValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>
                {verification.isValid
                  ? `Cryptographic Merkle Chain is fully intact and verified across ${verification.totalRecords} event blocks.`
                  : `CHAIN INTEGRITY ALERT: ${verification.errorMessage}`}
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              Latest Hash: {verification.latestChainHash?.slice(0, 16) ?? "N/A"}...
            </span>
          </div>
        )}

        {/* Ledger Event List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 text-xs select-text">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
              <span>Verifying and parsing provenance audit ledger...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400 text-center">
              <History className="h-8 w-8 text-slate-600 mb-1" />
              <span className="font-medium text-slate-300">No Provenance Records Yet</span>
              <p className="text-[11px] max-w-sm">
                Operations like file creation, modifications, shredding, and encryption will automatically append tamper-evident cryptographic blocks here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div
                  key={r.sequence}
                  className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 hover:bg-slate-800/70 transition space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded">
                        #{r.sequence}
                      </span>
                      {getEventBadge(r.eventType)}
                      <span className="text-[11px] text-slate-400 font-mono">{r.timestamp}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Actor: {r.actor}</span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-200 truncate max-w-md" title={r.filePath}>
                      {r.filePath}
                    </span>
                    <span className="text-slate-400">{formatBytes(r.fileSize)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-700/30">
                    <div>
                      <span className="text-slate-500">BLAKE3: </span>
                      <span className="text-sky-300">{r.blake3Digest ? `${r.blake3Digest.slice(0, 24)}...` : "—"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500">Chain Hash: </span>
                      <span className="text-emerald-300">{r.chainHash ? `${r.chainHash.slice(0, 24)}...` : "—"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

