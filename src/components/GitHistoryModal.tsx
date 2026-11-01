import React, { useState, useEffect } from "react";
import { GitCommit, History, User, Clock, FileText, Copy, Check, X, ShieldAlert } from "lucide-react";
import { ipc } from "@/lib/ipc";
import type { GitCommitInfo, GitBlameLine } from "@/types";

interface GitHistoryModalProps {
  filePath: string;
  isOpen: boolean;
  onClose: () => void;
}

export const GitHistoryModal: React.FC<GitHistoryModalProps> = ({
  filePath,
  isOpen,
  onClose,
}) => {
  const [tab, setTab] = useState<"history" | "blame">("history");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GitCommitInfo[]>([]);
  const [blame, setBlame] = useState<GitBlameLine[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  useEffect(() => {
    if (!isOpen || !filePath) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Get parent dir as repo start point
    const dir = filePath.substring(0, Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\")));

    ipc.toolsGitStatus(dir || filePath)
      .then((status) => {
        if (!isMounted) return;
        if (!status.isRepo || !status.repoRoot) {
          setError("File is not part of a Git repository");
          setLoading(false);
          return;
        }

        const root = status.repoRoot;
        const normalizedFile = filePath.replace(/\\/g, "/");
        const normalizedRoot = root.replace(/\\/g, "/");
        const rel = normalizedFile.startsWith(normalizedRoot)
          ? normalizedFile.substring(normalizedRoot.length).replace(/^\//, "")
          : fileName;

        Promise.all([
          ipc.toolsGitFileHistory(root, rel, 50).catch((e) => {
            console.error(e);
            return [];
          }),
          ipc.toolsGitFileBlame(root, rel).catch((e) => {
            console.error(e);
            return [];
          }),
        ]).then(([hist, blm]) => {
          if (!isMounted) return;
          setHistory(hist);
          setBlame(blm);
          setLoading(false);
        });
      })
      .catch((e) => {
        if (!isMounted) return;
        setError(String(e));
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, filePath, fileName]);

  if (!isOpen) return null;

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatDate = (ms: number) => {
    if (!ms) return "-";
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-4xl h-[85vh] bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                Git Forensics &amp; History
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {fileName}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 truncate max-w-lg">{filePath}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-zinc-800/80 bg-zinc-900/40 text-xs">
          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              tab === "history"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <History className="w-3.5 h-3.5 text-blue-400" />
            Commit Log ({history.length})
          </button>
          <button
            onClick={() => setTab("blame")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              tab === "blame"
                ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            Line-by-Line Blame ({blame.length} lines)
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 font-sans">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-orange-400 rounded-full animate-spin" />
              <p className="text-xs">Inspecting Git revisions &amp; blame graph...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && tab === "history" && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">
                  No Git commit history recorded for this file yet.
                </div>
              ) : (
                history.map((commit, idx) => (
                  <div
                    key={commit.hash + idx}
                    className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium text-zinc-200 font-mono">
                        {commit.message}
                      </p>
                      <button
                        onClick={() => copyHash(commit.hash)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition"
                        title="Copy full hash"
                      >
                        {copiedHash === commit.hash ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-zinc-400" />
                        )}
                        <span>{commit.shortHash}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{commit.authorName}</span>
                        <span className="text-zinc-600">&lt;{commit.authorEmail}&gt;</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{formatDate(commit.timestampMs)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loading && !error && tab === "blame" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 overflow-hidden text-xs font-mono">
              {blame.length === 0 ? (
                <div className="text-center py-16 text-zinc-500">
                  No blame metadata available for this file.
                </div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {blame.map((line) => (
                    <div
                      key={line.lineNumber}
                      className="grid grid-cols-[50px_90px_130px_1fr] hover:bg-zinc-900/40 items-center px-3 py-1 gap-2"
                    >
                      <span className="text-zinc-600 text-right pr-2 select-none">
                        {line.lineNumber}
                      </span>
                      <span className="text-orange-400/80 truncate">
                        {line.shortHash}
                      </span>
                      <span className="text-zinc-400 truncate" title={line.authorName}>
                        {line.authorName}
                      </span>
                      <span className="text-zinc-200 whitespace-pre overflow-x-auto">
                        {line.lineContent}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-500">
          <span>Pure Rust in-process Git analyzer</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

