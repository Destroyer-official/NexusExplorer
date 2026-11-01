import React, { useState, useEffect, useRef } from "react";
import { Sparkles, ShieldAlert, CheckCircle, CornerDownLeft, Loader2, X, File } from "lucide-react";
import { ipc } from "@/lib/ipc";
import type { CopilotPlan, CopilotExecutionResult } from "@/types";

interface CopilotModalProps {
  isOpen: boolean;
  currentDir: string;
  onClose: () => void;
  onRefreshDirectory?: () => void;
}

export const CopilotModal: React.FC<CopilotModalProps> = ({
  isOpen,
  currentDir,
  onClose,
  onRefreshDirectory,
}) => {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<CopilotPlan | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<CopilotExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  // Debounced natural language intent analysis
  useEffect(() => {
    if (!prompt.trim() || !isOpen) {
      setPlan(null);
      setAnalyzing(false);
      return;
    }

    const timer = setTimeout(() => {
      setAnalyzing(true);
      setError(null);
      ipc.toolsCopilotPlan(prompt, currentDir)
        .then((p) => {
          setPlan(p);
          setAnalyzing(false);
        })
        .catch((e) => {
          setError(String(e));
          setAnalyzing(false);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [prompt, currentDir, isOpen]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!plan) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await ipc.toolsCopilotExecute(plan, currentDir);
      setResult(res);
      // D-LinUCB Reinforcement Learning: positive feedback reward
      void ipc.toolsCopilotFeedback(plan.actionKind, 1.0);
      if (res.success && onRefreshDirectory) {
        onRefreshDirectory();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = () => {
    if (plan && !result) {
      // D-LinUCB Reinforcement Learning: user dismissed/cancelled without executing
      void ipc.toolsCopilotFeedback(plan.actionKind, -0.5);
    }
    onClose();
  };

  const getActionBadgeColor = (kind: string) => {
    switch (kind) {
      case "shred":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "organize_by_extension":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "clone_cow":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "tag":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "archive_zip":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    }
  };

  const presets = [
    "organize files by extension",
    "find files larger than 10MB",
    "shred all .log files",
    "tag with ProjectAlpha",
    "duplicate folder with CoW",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-2xl bg-[#18181b] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Search / Command Prompt Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && plan && !executing) {
                handleExecute();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Ask Copilot (e.g. 'organize downloads', 'shred .tmp files', 'find photos > 5MB')..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {analyzing ? (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          ) : (
            <button
              onClick={handleClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Suggestion Chips */}
        {!plan && !prompt && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Popular Natural Language Actions
            </p>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPrompt(preset)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-xs text-zinc-300 hover:text-zinc-100 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Plan Preview Section */}
        {plan && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Intent & Confidence Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2.5 py-1 rounded-md font-medium border uppercase tracking-wider ${getActionBadgeColor(
                    plan.actionKind
                  )}`}
                >
                  {plan.actionKind.replace(/_/g, " ")}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {(plan.confidence * 100).toFixed(0)}% confidence
                </span>
                {plan.safetyScore !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                    {(plan.safetyScore * 100).toFixed(0)}% safety (GRPO)
                  </span>
                )}
              </div>
              <span className="text-xs text-zinc-500 truncate max-w-xs font-mono">
                {currentDir}
              </span>
            </div>

            {/* Explanation Card */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-sm space-y-1">
              <p className="font-medium text-zinc-200">{plan.intentSummary}</p>
              <p className="text-xs text-zinc-400">{plan.explanation}</p>
            </div>

            {/* Safety Warnings */}
            {plan.warnings && plan.warnings.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                {plan.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-amber-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Destructive Warning */}
            {plan.isDestructive && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <div>
                  <p className="font-semibold text-red-200">Destructive File Operation</p>
                  <p className="text-red-300/80 mt-0.5">
                    This plan will permanently overwrite and wipe matched files beyond recovery.
                    Please review candidate files below before executing.
                  </p>
                </div>
              </div>
            )}

            {/* Matched Files List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Matched Candidates ({plan.matchedFiles.length} files)</span>
                {plan.totalMatchedBytes > 0 && (
                  <span className="font-mono">
                    {(plan.totalMatchedBytes / 1024 / 1024).toFixed(2)} MB total
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
                {plan.matchedFiles.length === 0 ? (
                  <p className="text-center py-4 text-zinc-500">
                    No files in current folder match the specified criteria.
                  </p>
                ) : (
                  plan.matchedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-zinc-800/40 text-zinc-300 truncate"
                    >
                      <File className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      <span className="truncate">{file.split(/[/\\]/).pop()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Execution Result */}
            {result && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                <span>{result.message}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Action Bar */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px]">
              Esc
            </kbd>
            <span>to close</span>
          </div>
          {plan && (
            <button
              onClick={handleExecute}
              disabled={executing || (plan.matchedFiles.length === 0 && plan.actionKind !== "clone_cow")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition ${
                plan.isDestructive
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {executing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Plan...</span>
                </>
              ) : (
                <>
                  <span>Execute Plan</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
