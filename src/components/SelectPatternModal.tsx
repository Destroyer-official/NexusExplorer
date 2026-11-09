import { useState, useMemo, useRef, useEffect } from "react";
import { useAppStore } from "@/state/store";
import { COMMON_PATTERN_PRESETS, matchPattern } from "@/lib/pattern";
import { CheckSquare, Filter, RefreshCw, X } from "lucide-react";

export function SelectPatternModal() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [pattern, setPattern] = useState("*.ts");
  const [filterType, setFilterType] = useState<"all" | "files" | "folders">("all");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const totalEntries = activeTab?.entries.length ?? 0;

  const matchCount = useMemo(() => {
    if (!activeTab || !pattern.trim()) return 0;
    return activeTab.entries.filter((e) =>
      matchPattern(e.name, pattern, e.isDir, {
        filter: filterType,
        caseSensitive,
      }),
    ).length;
  }, [activeTab, pattern, filterType, caseSensitive]);

  const handleApply = (mode: "replace" | "add" | "remove") => {
    if (!pattern.trim()) return;
    store.selectByPattern(pattern, {
      mode,
      filter: filterType,
      caseSensitive,
    });
    store.setSelectPatternOpen(false);
  };

  return (
    <div className="overlay confirmation-overlay" onClick={() => store.setSelectPatternOpen(false)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="select-pattern-title"
        style={{ width: 480 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") store.setSelectPatternOpen(false);
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleApply("replace");
          }
        }}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <div id="select-pattern-title" className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={16} color="var(--accent)" />
            <span>Select by Pattern</span>
          </div>
          <span style={{ flex: 1 }} />
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={() => store.setSelectPatternOpen(false)}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p className="dialog-description" style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
            Select items matching wildcards (<code style={{ color: "var(--accent)" }}>*</code>, <code style={{ color: "var(--accent)" }}>?</code>), extension (<code style={{ color: "var(--accent)" }}>.ts</code>), or regular expression (<code style={{ color: "var(--accent)" }}>re:^draft_</code>).
          </p>

          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pattern-input" style={{ fontSize: 12, fontWeight: 600 }}>Pattern</label>
            <input
              id="pattern-input"
              ref={inputRef}
              className="input"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. *.ts, report-??.pdf, re:^v\d+"
              style={{ fontFamily: "monospace", fontSize: 13 }}
            />
          </div>

          {/* Quick preset chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COMMON_PATTERN_PRESETS.map((p) => (
              <button
                key={p.pattern}
                type="button"
                className="chip"
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: pattern === p.pattern ? "var(--accent-dim, rgba(56, 189, 248, 0.15))" : "var(--bg-card, rgba(255,255,255,0.05))",
                  border: pattern === p.pattern ? "1px solid var(--accent)" : "1px solid var(--border)",
                  color: pattern === p.pattern ? "var(--accent)" : "var(--text)",
                }}
                onClick={() => setPattern(p.pattern)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Target filter and case sensitivity */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
              <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Target:</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="filterType"
                  checked={filterType === "all"}
                  onChange={() => setFilterType("all")}
                />
                All
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="filterType"
                  checked={filterType === "files"}
                  onChange={() => setFilterType("files")}
                />
                Files only
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="filterType"
                  checked={filterType === "folders"}
                  onChange={() => setFilterType("folders")}
                />
                Folders only
              </label>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              Case sensitive
            </label>
          </div>

          {/* Match counter banner */}
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              background: matchCount > 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
              border: `1px solid ${matchCount > 0 ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
            }}
          >
            <span>
              Matches <strong>{matchCount}</strong> of {totalEntries} item{totalEntries === 1 ? "" : "s"} in folder
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "2px 6px", height: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}
              onClick={() => {
                store.invertSelection();
                store.setSelectPatternOpen(false);
              }}
              title="Invert current selection"
            >
              <RefreshCw size={11} />
              Invert Selection
            </button>
          </div>
        </div>

        <div className="modal-footer" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => store.setSelectPatternOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleApply("remove")}
            disabled={matchCount === 0}
          >
            Deselect Matching
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleApply("add")}
            disabled={matchCount === 0}
          >
            Add to Selection
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleApply("replace")}
            disabled={matchCount === 0}
          >
            <CheckSquare size={14} style={{ marginRight: 4 }} />
            Select Matching
          </button>
        </div>
      </div>
    </div>
  );
}

export default SelectPatternModal;

