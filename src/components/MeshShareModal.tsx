import React, { useState, useEffect } from "react";
import { Share2, Wifi, Send, CheckCircle2, ShieldAlert, Monitor, Smartphone, Server, Loader2, X, File } from "lucide-react";
import { ipc } from "@/lib/ipc";
import type { MeshPeer, MeshTransferReport } from "@/types";

interface MeshShareModalProps {
  isOpen: boolean;
  filePaths: string[];
  onClose: () => void;
}

export const MeshShareModal: React.FC<MeshShareModalProps> = ({
  isOpen,
  filePaths,
  onClose,
}) => {
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<MeshPeer | null>(null);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<MeshTransferReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setReport(null);
    setError(null);

    // Initialize discovery background service
    ipc.toolsMeshStart().catch((e) => console.error("Mesh start error:", e));

    const poll = () => {
      ipc.toolsMeshGetPeers()
        .then((p) => {
          if (isMounted) {
            setPeers(p);
            if (p.length > 0 && !selectedPeer) {
              setSelectedPeer(p[0]);
            }
          }
        })
        .catch(console.error);
    };

    poll();
    const interval = setInterval(poll, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedPeer || filePaths.length === 0) return;
    setSending(true);
    setError(null);
    setReport(null);

    try {
      const rep = await ipc.toolsMeshSendFiles(
        selectedPeer.ipAddress,
        selectedPeer.tcpPort,
        filePaths
      );
      setReport(rep);
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  };

  const getDeviceIcon = (os: string) => {
    const lower = os.toLowerCase();
    if (lower.includes("android") || lower.includes("ios")) {
      return <Smartphone className="w-5 h-5 text-emerald-400" />;
    }
    if (lower.includes("linux") || lower.includes("server")) {
      return <Server className="w-5 h-5 text-amber-400" />;
    }
    return <Monitor className="w-5 h-5 text-blue-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-xl bg-[#18181b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                Nexus Local Mesh Sharing
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Wifi className="w-3 h-3 animate-pulse" /> LAN P2P
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Zero-config direct device-to-device streaming</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Files to Send Summary */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Files to Stream ({filePaths.length})
            </label>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 max-h-28 overflow-y-auto space-y-1 font-mono text-xs">
              {filePaths.length === 0 ? (
                <p className="text-zinc-500 text-center py-2">No files selected for sharing.</p>
              ) : (
                filePaths.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-zinc-300 truncate">
                    <File className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="truncate">{f.split(/[/\\]/).pop()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Discovered LAN Peers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider">Discovered LAN Peers</span>
              <span className="font-mono text-[11px] text-zinc-500">
                Listening UDP:52491 / TCP:52492
              </span>
            </div>

            {peers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 text-center space-y-2">
                <div className="w-7 h-7 border-2 border-zinc-700 border-t-purple-400 rounded-full animate-spin" />
                <p className="text-xs text-zinc-400">
                  Broadcasting beacon... looking for other Nexus devices on this network.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-48 overflow-y-auto">
                {peers.map((peer) => {
                  const isSelected = selectedPeer?.deviceId === peer.deviceId;
                  return (
                    <button
                      key={peer.deviceId}
                      onClick={() => setSelectedPeer(peer)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                        isSelected
                          ? "bg-purple-500/10 border-purple-500/40 text-purple-200"
                          : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-zinc-800">
                          {getDeviceIcon(peer.os)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{peer.deviceName}</p>
                          <p className="text-xs text-zinc-500 font-mono">
                            {peer.ipAddress}:{peer.tcpPort} ({peer.os})
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        Online
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transfer Report */}
          {report && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-200">Transfer Completed Successfully</p>
                <p className="text-emerald-300/80 mt-0.5">
                  Streamed {report.totalFiles} files ({(report.totalBytes / 1024 / 1024).toFixed(2)} MB) to {report.targetPeer} in {report.durationMs} ms.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <span className="text-xs text-zinc-500">XXH3 chunk verification on receive</span>
          <button
            onClick={handleSend}
            disabled={!selectedPeer || filePaths.length === 0 || sending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Streaming Payload...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send to {selectedPeer?.deviceName || "Device"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

