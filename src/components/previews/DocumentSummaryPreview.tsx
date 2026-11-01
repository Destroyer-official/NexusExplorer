import React, { useState, useEffect } from "react";
import { Sparkles, Clock, BookOpen, Hash, Tag, ListTree, Loader2, ShieldAlert } from "lucide-react";
import { ipc } from "@/lib/ipc";
import type { DocumentSummary } from "@/types";

interface DocumentSummaryPreviewProps {
  filePath: string;
}

export const DocumentSummaryPreview: React.FC<DocumentSummaryPreviewProps> = ({ filePath }) => {
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    ipc.toolsSummarizeDocument(filePath, 5)
      .then((data) => {
        if (!isMounted) return;
        setSummary(data);
        setLoading(false);
      })
      .catch((e) => {
        if (!isMounted) return;
        setError(String(e));
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2 text-zinc-400 text-xs">
        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        <span>Extracting document salience &amp; outline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="flex flex-col gap-4 text-xs font-sans text-zinc-200 w-full">
      {/* Metric Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-zinc-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>~{summary.readingTimeSeconds}s read</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-zinc-300">
          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
          <span>{summary.totalWords} words</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-zinc-300">
          <Hash className="w-3.5 h-3.5 text-emerald-400" />
          <span>{summary.totalLines} lines</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          {summary.detectedType}
        </span>
      </div>

      {/* Key Topics / Concepts */}
      {summary.keyTopics.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
            <Tag className="w-3 h-3" />
            <span>Extracted Concepts</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.keyTopics.map((topic, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px]"
              >
                #{topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Executive Summary Bullets */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Executive Highlights</span>
        </div>
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
          {summary.summaryBullets.length === 0 ? (
            <p className="text-zinc-500">No representative highlights extracted.</p>
          ) : (
            summary.summaryBullets.map((bullet, i) => (
              <div key={i} className="flex items-start gap-2 text-zinc-300">
                <span className="text-cyan-400 mt-0.5">•</span>
                <span className="leading-relaxed">{bullet}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Document Outline / AST Symbols */}
      {summary.outline.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
            <ListTree className="w-3 h-3 text-emerald-400" />
            <span>Document Outline ({summary.outline.length})</span>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/80 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1">
            {summary.outline.map((node, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-2 py-1 rounded hover:bg-zinc-800/40 text-zinc-300"
                style={{ paddingLeft: `${node.level * 12}px` }}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[10px] text-zinc-500 px-1 rounded bg-zinc-800">
                    {node.kind}
                  </span>
                  <span className="truncate">{node.title}</span>
                </div>
                <span className="text-zinc-500 text-[10px] flex-shrink-0">
                  L{node.lineNumber}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

