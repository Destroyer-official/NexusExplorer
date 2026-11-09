import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAppStore } from "@/state/store";
import { iconForEntry } from "@/lib/fileIcons";
import { formatBytes } from "@/lib/format";
import { entryMenu } from "@/lib/menus";
import { Search, X } from "lucide-react";

export default function SearchResults() {
  const store = useAppStore();
  const search = store.search;
  const [query, setQuery] = useState(search.query);
  const inputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setQuery(search.query); }, [search.query]);

  const trigger = (q: string) => {
    setQuery(q);
    store.setSearchQuery(q);
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = window.setTimeout(() => { void store.runSearch(q.trim()); }, 280);
  };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const rows = search.results;
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 32, overscan: 12 });

  return (
    <div className="search-pane">
      <div className="search-header">
        <Search size={16} color="var(--text-faint)" />
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          onChange={(e) => trigger(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void store.runSearch(); if (e.key === "Escape") store.closeSearch(); }}
          placeholder={`Search files (*.ext, doc?.txt, ext:pdf, regex:...) in ${search.root || "current folder"}…`}
        />
        {search.running && <span className="search-meta">Searching…</span>}
        {!search.running && search.results.length > 0 && <span className="search-meta">{search.total} results · {search.elapsedMs}ms</span>}
        <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Close search" onClick={store.closeSearch}><X size={14} /></button>
      </div>
      <div className="viewport" ref={parentRef} style={{ flex: 1 }}>
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>{search.running ? "Searching…" : (search.query ? "No results" : "Type to search")}</h3>
            {search.error && <p style={{ color: "var(--danger)" }}>{search.error}</p>}
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const entry = rows[vi.index];
              const { Icon, tone } = iconForEntry(entry, false);
              return (
                <div
                  key={entry.path + vi.index}
                  className="search-row"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 32, transform: `translateY(${vi.start}px)` }}
                  onDoubleClick={() => { if (entry.isDir) { void store.navigateTo(entry.path); store.closeSearch(); } else void store.openEntry(entry); }}
                  onContextMenu={(e) => { e.preventDefault(); store.selectOnly(entry.path); store.openContextMenu(e.clientX, e.clientY, entryMenu([entry.path], store)); }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span className={`file-icon tone-${tone}`}><Icon size={15} strokeWidth={1.7} /></span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                  </div>
                  <div className="search-path" title={entry.path}>{entry.path}</div>
                  <div style={{ color: "var(--text-faint)", fontSize: 12 }}>{entry.isDir ? "Folder" : formatBytes(entry.size)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}