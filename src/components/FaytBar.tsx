import { useState, useEffect, useRef } from "react";
import { Search, Terminal, Filter, Bookmark, X, ArrowRight } from "lucide-react";
import { useAppStore } from "@/state/store";

export function FaytBar() {
  const store = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"filter" | "global" | "command" | "jump">("filter");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = useAppStore.getState();
      if (current.settings.faytEnabled === false || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".overlay, .palette-overlay")) return;
      // Ignore if user is already typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;

      if (e.key === "'" || e.key === "/") {
        e.preventDefault();
        setMode("filter");
        setQuery("");
        setIsOpen(true);
      } else if (e.key === "+") {
        e.preventDefault();
        setMode("global");
        setQuery("");
        setIsOpen(true);
      } else if (e.key === ">") {
        e.preventDefault();
        setMode("command");
        setQuery("");
        setIsOpen(true);
      } else if (e.key === "]") {
        e.preventDefault();
        setMode("jump");
        setQuery("");
        setIsOpen(true);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!query.trim()) return;

    if (mode === "command") {
      useAppStore.setState({ terminalDraft: query, terminalOpen: true });
      setIsOpen(false);
    } else if (mode === "global") {
      store.openSearch();
      void store.runSearch(query);
      setIsOpen(false);
    } else if (mode === "filter") {
      store.setQuickFilter(query);
    } else if (mode === "jump") {
      const fav = store.bookmarks.find((b) => b.name.toLowerCase().includes(query.toLowerCase()));
      if (fav) {
        void store.navigateTo(fav.path);
        setIsOpen(false);
      } else {
        store.pushToast("info", "Jump", `No bookmark found matching "${query}"`);
      }
    }
  };

  const getPrefixIcon = () => {
    switch (mode) {
      case "filter":
        return <Filter size={14} style={{ color: "var(--accent)" }} />;
      case "global":
        return <Search size={14} style={{ color: "#38bdf8" }} />;
      case "command":
        return <Terminal size={14} style={{ color: "#10b981" }} />;
      case "jump":
        return <Bookmark size={14} style={{ color: "#a855f7" }} />;
    }
  };

  const getPlaceholder = () => {
    switch (mode) {
      case "filter":
        return "FAYT: Instant live filter in current folder... (Esc to dismiss)";
      case "global":
        return "Search this folder and subfolders... (Enter to run)";
      case "command":
        return "Prepare a terminal command (Enter to review)...";
      case "jump":
        return "FAYT: Jump to favorite bookmark by name...";
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 34,
        right: 24,
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--bg-2)",
        padding: "6px 12px",
        borderRadius: "var(--radius-sm)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        border: "1px solid var(--accent)",
        width: "min(460px, calc(100vw - 32px))",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      {getPrefixIcon()}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); if (mode === "filter") store.setQuickFilter(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleExecute();
          if (e.key === "Escape") { e.stopPropagation(); if (mode === "filter") store.setQuickFilter(""); setIsOpen(false); }
        }}
        placeholder={getPlaceholder()}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 12,
          color: "var(--text)",
        }}
      />
      <div style={{ display: "flex", gap: 4 }}>
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          onClick={handleExecute}
          title="Execute"
        >
          <ArrowRight size={12} />
        </button>
        <button
          className="icon-btn"
          style={{ width: 20, height: 20 }}
          onClick={() => { if (mode === "filter") store.setQuickFilter(""); setIsOpen(false); }}
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

