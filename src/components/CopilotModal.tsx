import React, { useState, useEffect, useRef, useMemo } from "react";
import { Sparkles, ShieldAlert, CheckCircle, CornerDownLeft, Loader2, X, File, Folder, Eye } from "lucide-react";
import { useAppStore } from "@/state/store";
import { dirname } from "@/lib/paths";
import { formatBytes } from "@/lib/format";
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

  const executingRef = useRef(false);
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

    let cancelled = false;
    setPlan(null); setResult(null); setAnalyzing(true);
    const timer = setTimeout(() => {
      setAnalyzing(true);
      setError(null);
      ipc.toolsCopilotPlan(prompt, currentDir)
        .then((p) => {
          if (cancelled) return;
          setPlan(p);
          setAnalyzing(false);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(String(e));
          setAnalyzing(false);
        });
    }, 280);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [prompt, currentDir, isOpen]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!plan || analyzing || executingRef.current) return;
    executingRef.current = true;
    setExecuting(true);
    setError(null);
    try {
      const res = await ipc.toolsCopilotExecute(plan, currentDir);
      setResult(res);
      // D-LinUCB Reinforcement Learning: positive feedback reward
      void ipc.toolsCopilotFeedback(plan.actionKind, res.success ? 1.0 : -0.5).catch(() => undefined);

      // Apply selection in the Explorer view!
      if (plan.matchedFiles && plan.matchedFiles.length > 0) {
        useAppStore.getState().setSelected(plan.matchedFiles);
        if (plan.matchedFiles.length === 1) {
          useAppStore.getState().selectOnly(plan.matchedFiles[0]);
        }
      }

      if (onRefreshDirectory) {
        onRefreshDirectory();
      } else {
        void useAppStore.getState().refreshActive();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      executingRef.current = false;
      setExecuting(false);
    }
  };

  const candidateItems = useMemo(() => {
    if (!plan) return [];
    if (plan.matchedCandidates && plan.matchedCandidates.length > 0) {
      return plan.matchedCandidates;
    }
    return (plan.matchedFiles || []).map((file) => {
      const name = file.split(/[/\\]/).pop() || file;
      return {
        path: file,
        name,
        isDir: false,
        size: 0,
        formattedSize: "",
        ext: name.includes(".") ? name.split(".").pop() : undefined,
      };
    });
  }, [plan]);

  const handleClose = () => {
    if (plan && !result) {
      // D-LinUCB Reinforcement Learning: user dismissed/cancelled without executing
      void ipc.toolsCopilotFeedback(plan.actionKind, -0.5).catch(() => undefined);
    }
    onClose();
  };

  const getActionBadgeColor = (kind?: string) => {
    switch (kind) {
      case "shred":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "organize_by_extension":
      case "move_by_extension":
      case "organize_by_date":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "clone_cow":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "tag":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "archive_zip":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "search":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      default:
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    }
  };

  const presets = [
    "organize files by extension",
    "find files larger than 10MB",
    "what the largest folder",
    "compress .log files and shred originals",
    "tag with ProjectAlpha",
    "duplicate folder with CoW",
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label="Nexus AI Agent" className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4">
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
              if (e.key === "Enter") {
                if (result) {
                  if (plan?.matchedFiles?.[0]) {
                    void useAppStore.getState().navigateTo(dirname(plan.matchedFiles[0])).then(() => {
                      useAppStore.getState().selectOnly(plan.matchedFiles[0]);
                      onClose();
                    });
                  } else {
                    onClose();
                  }
                } else if (plan && !executing && !analyzing && !plan.isDestructive) {
                  handleExecute();
                }
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Ask Nexus Agent (e.g. 'what the largest folder', 'compress .log files and shred originals')..."
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

        {error && !plan && <p role="alert" className="p-5 text-red-300">{error}</p>}
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
                  {(plan.actionKind || "action").replace(/_/g, " ")}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {((plan.confidence ?? 0.9) * 100).toFixed(0)}% confidence
                </span>
                {plan.safetyScore !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                    {((plan.safetyScore ?? 1.0) * 100).toFixed(0)}% safety (GRPO)
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

            {/* Autonomous Multi-Step Execution Pipeline */}
            {plan.steps && plan.steps.length > 1 && (
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Autonomous Multi-Step Pipeline ({plan.steps.length} Steps)</span>
                </div>
                <div className="space-y-1.5 pt-0.5">
                  {plan.steps.map((s) => (
                    <div key={s.stepNumber} className="flex items-center gap-2.5 text-xs bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 text-[10px]">
                        {s.stepNumber}
                      </span>
                      <span className="text-zinc-200 font-medium flex-1">{s.title}</span>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono uppercase">
                        {s.actionKind.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Matched Candidates (Files & Folders) List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Matched Candidates ({candidateItems.length}{" "}
                  {candidateItems.some((c) => c.isDir) ? "items" : "files"})
                </span>
                {(plan.totalMatchedBytes || 0) > 0 && (
                  <span className="font-mono text-cyan-400 font-semibold">
                    {formatBytes(plan.totalMatchedBytes)} total
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 max-h-56 overflow-y-auto space-y-1.5 font-mono text-xs">
                {candidateItems.length === 0 ? (
                  <p className="text-center py-4 text-zinc-500">
                    No files or folders in current directory match the specified criteria.
                  </p>
                ) : (
                  candidateItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/60 transition group text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.isDir ? (
                          <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        )}
                        <span className="font-medium text-zinc-200 truncate">{item.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                            item.isDir
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                          }`}
                        >
                          {item.isDir ? "Folder" : (item.ext || item.name.split(".").pop() || "file").toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.formattedSize && (
                          <span className="font-mono text-xs font-semibold text-cyan-400">
                            {item.formattedSize}
                          </span>
                        )}
                        <button
                          type="button"
                          title="Reveal in Explorer"
                          onClick={() => {
                            void useAppStore.getState().navigateTo(dirname(item.path)).then(() => {
                              useAppStore.getState().selectOnly(item.path);
                              onClose();
                            });
                          }}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-cyan-500/20 text-zinc-400 hover:text-cyan-300 border border-zinc-700/60 text-[10px] transition"
                        >
                          Reveal
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Execution Result */}
            {result && (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                  <span className="truncate">{result.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (plan.matchedFiles?.[0]) {
                      void useAppStore.getState().navigateTo(dirname(plan.matchedFiles[0])).then(() => {
                        useAppStore.getState().selectOnly(plan.matchedFiles[0]);
                        onClose();
                      });
                    } else {
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold border border-emerald-500/40 transition flex items-center gap-1.5 flex-shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Reveal in Explorer
                </button>
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
            result ? (
              <button
                onClick={() => {
                  if (plan.matchedFiles?.[0]) {
                    void useAppStore.getState().navigateTo(dirname(plan.matchedFiles[0])).then(() => {
                      useAppStore.getState().selectOnly(plan.matchedFiles[0]);
                      onClose();
                    });
                  } else {
                    onClose();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Reveal in Explorer</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleExecute}
                disabled={executing || analyzing || ((plan.matchedFiles || []).length === 0 && plan.actionKind !== "clone_cow")}
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
            )
          )}
        </div>
      </div>
    </div>
  );
};
