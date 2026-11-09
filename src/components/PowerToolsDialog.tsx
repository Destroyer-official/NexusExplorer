import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc, toErrorMessage } from "@/lib/ipc";
import { formatBytes, formatDate } from "@/lib/format";
import { basename, dirname } from "@/lib/paths";
import type {
  AlternateDataStream,
  BitLockerVolumeStatus,
  ContentSearchReport,
  DuplicateGroup,
  DuplicateReport,
  HashVerifyReport,
  ImageOptimizeBatch,
  LinkItem,
  LockingProcess,
  PluginInfo,
  SplitResult,
  TimestampInfo,
  UsnJournalInfo,
  UsnRecordsBatch,
  VssSnapshot,
  MerkleTreeReport,
  MerkleProof,
  MerkleDiffReport,
} from "@/types";
import { X } from "lucide-react";

type TabId =
  | "duplicates"
  | "merkle"
  | "content"
  | "images"
  | "ads"
  | "links"
  | "unlocker"
  | "splitter"
  | "timestamps"
  | "usn"
  | "vss"
  | "bitlocker"
  | "hash"
  | "plugins";

const TABS: { id: TabId; label: string }[] = [
  { id: "duplicates", label: "Duplicates" },
  { id: "merkle", label: "Merkle Tree Integrity" },
  { id: "content", label: "Content search" },
  { id: "images", label: "Image optimizer" },
  { id: "ads", label: "ADS streams" },
  { id: "links", label: "Links" },
  { id: "unlocker", label: "Unlocker" },
  { id: "splitter", label: "Split / Join" },
  { id: "timestamps", label: "Timestamps" },
  { id: "usn", label: "USN journal" },
  { id: "vss", label: "Snapshots" },
  { id: "bitlocker", label: "BitLocker" },
  { id: "hash", label: "Checksums" },
  { id: "plugins", label: "Plugins" },
];

const IMAGE_RE = /\.(png|jpe?g|bmp|tiff|tif|webp|gif)$/i;

function toLocalInput(ms: number): string {
  if (!ms) return "";
  const offset = new Date(ms).getTimezoneOffset() * 60_000;
  return new Date(ms - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{error}</div>;
}

export default function PowerToolsDialog() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [tabId, setTabId] = useState<TabId>((store.powerToolsTab as TabId) || "duplicates");

  useEffect(() => {
    setTabId((store.powerToolsTab as TabId) || "duplicates");
  }, [store.powerToolsTab]);

  if (!store.powerToolsOpen) return null;

  return (
    <div className="overlay" onClick={() => store.setPowerTools(false)}>
      <div
        className="modal"
        style={{ width: "min(1060px, 96vw)", height: "min(760px, 92vh)", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="modal-title">Power Tools</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>
              {tab?.path ?? "No folder"}
            </div>
          </div>
          <button className="icon-btn" onClick={() => store.setPowerTools(false)}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ width: 178, borderRight: "1px solid var(--border)", padding: 8, overflow: "auto", flexShrink: 0 }}>
            {TABS.map((entry) => (
              <button
                key={entry.id}
                className={`side-item ${tabId === entry.id ? "active" : ""}`}
                style={{ width: "100%", border: "none", background: tabId === entry.id ? "var(--selection)" : "transparent", textAlign: "left" }}
                onClick={() => { setTabId(entry.id); store.setPowerTools(true, entry.id); }}
              >
                <span className="side-item-name">{entry.label}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 18 }}>
            {tabId === "duplicates" && <DuplicatesPanel />}
            {tabId === "merkle" && <MerklePanel />}
            {tabId === "content" && <ContentPanel />}
            {tabId === "images" && <ImagesPanel />}
            {tabId === "ads" && <AdsPanel />}
            {tabId === "links" && <LinksPanel />}
            {tabId === "unlocker" && <UnlockerPanel />}
            {tabId === "splitter" && <SplitterPanel />}
            {tabId === "timestamps" && <TimestampsPanel />}
            {tabId === "usn" && <UsnPanel />}
            {tabId === "vss" && <VssPanel />}
            {tabId === "bitlocker" && <BitLockerPanel />}
            {tabId === "hash" && <HashPanel />}
            {tabId === "plugins" && <PluginsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DuplicatesPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [minSize, setMinSize] = useState(1024);
  const [report, setReport] = useState<DuplicateReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [groupIndex, setGroupIndex] = useState(0);

  const scan = async () => {
    if (!tab) return;
    setBusy(true);
    setError(null);
    setReport(null);
    setChecked(new Set());
    try {
      const result = await ipc.toolsFindDuplicates(tab.path, minSize, undefined);
      setReport(result);
      setGroupIndex(0);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const active: DuplicateGroup | undefined = report?.groups[groupIndex];

  const toggle = (path: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ width: 180 }}>
          <label>Minimum file size (KB)</label>
          <input className="input" type="number" min={0} value={minSize} onChange={(e) => setMinSize(Number(e.target.value || 0))} />
        </div>
        <button className="btn btn-primary" disabled={busy || !tab} onClick={() => void scan()}>
          {busy ? "Scanning…" : "Find duplicates"}
        </button>
        {report && (
          <div style={{ display: "flex", gap: 20, marginLeft: "auto" }}>
            <Stat label="Groups" value={String(report.totalGroups)} />
            <Stat label="Duplicates" value={String(report.duplicateFiles)} />
            <Stat label="Reclaimable" value={formatBytes(report.reclaimableBytes)} />
          </div>
        )}
      </div>
      <ErrorLine error={error} />
      {report && report.groups.length === 0 && (
        <div style={{ padding: 24, color: "var(--text-faint)", fontSize: 13 }}>No duplicates found under this folder.</div>
      )}
      {report && report.groups.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, marginTop: 14, minHeight: 300 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "auto", maxHeight: 480 }}>
            {report.groups.map((group, index) => (
              <button
                key={`${group.hash}-${index}`}
                onClick={() => { setGroupIndex(index); setChecked(new Set()); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  background: index === groupIndex ? "var(--selection)" : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{group.files.length} × {formatBytes(group.size)}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{formatBytes(group.wastedBytes)} reclaimable</div>
              </button>
            ))}
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, overflow: "auto", maxHeight: 480 }}>
            {active && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 8 }}>
                  Keep one copy, tick the copies to recycle:
                </div>
                {active.files.map((file, index) => (
                  <label key={file.path} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 2px", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={checked.has(file.path)}
                      onChange={() => toggle(file.path)}
                      disabled={index === 0}
                    />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.path}>
                      {file.path}
                    </span>
                    <span style={{ color: "var(--text-faint)" }}>{formatDate(file.modifiedMs)}</span>
                  </label>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    className="btn btn-primary"
                    disabled={checked.size === 0}
                    onClick={() => {
                      const paths = [...checked];
                      store.openConfirm({
                        title: `Recycle ${paths.length} duplicate(s)?`,
                        description: `They will be moved to the Recycle Bin. ${formatBytes(active.wastedBytes)} can be recovered.`,
                        confirmLabel: "Recycle duplicates",
                        onConfirm: async () => {
                          await store.startDelete(paths, false);
                          setChecked(new Set());
                          await scan();
                        },
                      });
                    }}
                  >
                    Recycle selected ({checked.size})
                  </button>
                  <button className="btn" onClick={() => setChecked(new Set(active.files.slice(1).map((f) => f.path)))}>
                    Select all but first
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContentPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [pattern, setPattern] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [report, setReport] = useState<ContentSearchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!tab || !pattern.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await ipc.toolsSearchContent(tab.path, pattern, regex, caseSensitive, 500));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, minWidth: 240 }}>
          <label>Search text or pattern inside files</label>
          <input
            className="input"
            value={pattern}
            placeholder="e.g. invoice total or ^TODO:"
            onChange={(e) => setPattern(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
          />
        </div>
        <label style={{ display: "flex", gap: 5, fontSize: 12, alignItems: "center" }}>
          <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} /> Regex
        </label>
        <label style={{ display: "flex", gap: 5, fontSize: 12, alignItems: "center" }}>
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Case sensitive
        </label>
        <button className="btn btn-primary" disabled={busy || !tab || !pattern.trim()} onClick={() => void run()}>
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      <ErrorLine error={error} />
      {report && (
        <div style={{ display: "flex", gap: 22, marginTop: 14 }}>
          <Stat label="Matches" value={String(report.totalMatches)} />
          <Stat label="Files scanned" value={String(report.filesSearched)} />
          <Stat label="Elapsed" value={`${report.elapsedMs} ms`} />
        </div>
      )}
      {report && (
        <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 470, overflow: "auto" }}>
          {report.matches.length === 0 && (
            <div style={{ padding: 20, color: "var(--text-faint)", fontSize: 13 }}>No matches.</div>
          )}
          {report.matches.map((match, index) => (
            <div
              key={`${match.filePath}-${match.lineNumber}-${index}`}
              style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
              onClick={() => void store.openPaths([match.filePath])}
              title={match.filePath}
            >
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-faint)" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{match.filePath}</span>
                <span>line {match.lineNumber}</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", marginTop: 3, whiteSpace: "pre-wrap" }}>{match.lineText.trim()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImagesPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const selected = tab?.selected ?? [];
  const [format, setFormat] = useState("webp");
  const [quality, setQuality] = useState(85);
  const [batch, setBatch] = useState<ImageOptimizeBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(() => {
    if (selected.length) return selected.filter((p) => IMAGE_RE.test(p));
    return (tab?.entries ?? []).filter((e) => !e.isDir && IMAGE_RE.test(e.name)).map((e) => e.path);
  }, [selected, tab?.entries]);

  const run = async () => {
    if (candidates.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setBatch(await ipc.toolsOptimizeImages(candidates, format, quality));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ width: 140 }}>
          <label>Output format</label>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="webp">WebP (lossless)</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
        <div className="field" style={{ width: 120 }}>
          <label>Quality: {quality}</label>
          <input type="range" min={30} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
        </div>
        <button className="btn btn-primary" disabled={busy || candidates.length === 0} onClick={() => void run()}>
          {busy ? "Optimizing…" : `Optimize ${candidates.length} image(s)`}
        </button>
        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
          Output is written beside each source as <code>*.optimized.ext</code>; originals are never overwritten.
        </div>
      </div>
      <ErrorLine error={error} />
      {batch && (
        <>
          <div style={{ display: "flex", gap: 22, marginTop: 14 }}>
            <Stat label="Files" value={String(batch.results.length)} />
            <Stat label="Before" value={formatBytes(batch.totalInputBytes)} />
            <Stat label="After" value={formatBytes(batch.totalOutputBytes)} />
            <Stat label="Saved" value={`${formatBytes(Math.max(0, batch.totalSavedBytes))} (${batch.savingsPercent}%)`} />
          </div>
          <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 360, overflow: "auto" }}>
            {batch.results.map((result) => (
              <div key={result.inputPath} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", fontSize: 12, display: "flex", gap: 10 }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{basename(result.outputPath)}</span>
                <span style={{ color: result.savedBytes >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {result.savingsPercent}%
                </span>
                <span style={{ color: "var(--text-faint)" }}>{result.width}×{result.height}</span>
              </div>
            ))}
            {batch.errors.map((message) => (
              <div key={message} style={{ padding: "6px 10px", fontSize: 12, color: "var(--danger)" }}>{message}</div>
            ))}
          </div>
          <button className="btn" style={{ marginTop: 10 }} onClick={() => void store.refreshActive()}>Refresh folder</button>
        </>
      )}
    </div>
  );
}

function AdsPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [path, setPath] = useState(tab?.selected[0] ?? "");
  const [streams, setStreams] = useState<AlternateDataStream[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPath(tab?.selected[0] ?? "");
  }, [tab?.selected]);

  const load = async () => {
    if (!path) return;
    setBusy(true);
    setError(null);
    try {
      setStreams(await ipc.toolsListAds(path));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label>File path</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={path} onChange={(e) => setPath(e.target.value)} placeholder="Select one file in the Explorer" />
          <button className="btn btn-primary" disabled={busy || !path} onClick={() => void load()}>List streams</button>
        </div>
      </div>
      <ErrorLine error={error} />
      {streams.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
          {streams.map((stream) => (
            <div key={stream.streamFullName} style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <strong style={{ flex: 1 }}>:{stream.streamName}</strong>
                <span style={{ color: "var(--text-faint)" }}>{formatBytes(stream.sizeBytes)}</span>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    try {
                      await ipc.toolsDeleteAds(path, stream.streamName);
                      await load();
                      store.pushToast("success", "Stream deleted", stream.streamName);
                    } catch (err) {
                      setError(toErrorMessage(err));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              {stream.isZoneIdentifier && (
                <div style={{ color: "var(--warning)", fontSize: 11, marginTop: 2 }}>Mark-of-the-Web / Zone.Identifier</div>
              )}
              {stream.contentPreview && (
                <pre style={{ fontSize: 11, color: "var(--text-faint)", margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{stream.contentPreview}</pre>
              )}
            </div>
          ))}
        </div>
      )}
      {streams.length === 0 && path && !busy && (
        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No alternate data streams reported (or not loaded yet).</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className="btn"
          disabled={!path}
          onClick={async () => {
            try {
              const removed = await ipc.toolsUnblockFile(path);
              store.pushToast(removed ? "success" : "info", removed ? "File unblocked" : "No Mark-of-the-Web", path);
              await load();
            } catch (err) {
              setError(toErrorMessage(err));
            }
          }}
        >
          Unblock file (remove Zone.Identifier)
        </button>
      </div>
    </div>
  );
}

function LinksPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [path, setPath] = useState(tab?.selected[0] ?? "");
  const [info, setInfo] = useState<LinkItem | null>(null);
  const [kind, setKind] = useState<"hardlink" | "junction" | "symlink_dir" | "symlink_file">("junction");
  const [linkPath, setLinkPath] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPath(tab?.selected[0] ?? "");
  }, [tab?.selected]);

  const inspect = async () => {
    if (!path) return;
    setError(null);
    try {
      setInfo(await ipc.toolsGetLinkInfo(path));
      setLinkPath(path);
      setTargetPath(info?.targetPath || dirname(path));
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="input" value={path} onChange={(e) => setPath(e.target.value)} placeholder="Link or file path" />
        <button className="btn btn-primary" disabled={!path} onClick={() => void inspect()}>Inspect</button>
      </div>
      <ErrorLine error={error} />
      {info && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Type" value={info.linkType} />
          <Stat label="Target" value={info.targetPath || "—"} />
          <Stat label="Broken" value={info.isBroken ? "Yes" : "No"} />
          <Stat label="Hardlink count" value={String(info.hardlinkCount)} />
        </div>
      )}
      <div className="modal-section">
        <h4>Create a link</h4>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center" }}>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="junction">Directory junction</option>
            <option value="symlink_dir">Directory symlink</option>
            <option value="symlink_file">File symlink</option>
            <option value="hardlink">Hardlink</option>
          </select>
          <input className="input" value={targetPath} onChange={(e) => setTargetPath(e.target.value)} placeholder="Target path" />
          <span />
          <input className="input" value={linkPath} onChange={(e) => setLinkPath(e.target.value)} placeholder="New link path" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-primary"
            disabled={!linkPath || !targetPath}
            onClick={async () => {
              try {
                await ipc.toolsCreateLink(linkPath, targetPath, kind);
                store.pushToast("success", "Link created", linkPath);
                await store.refreshActive();
              } catch (err) {
                setError(toErrorMessage(err));
              }
            }}
          >
            Create link
          </button>
          <button
            className="btn btn-danger"
            disabled={!info || info.linkType === "regular"}
            onClick={async () => {
              try {
                await ipc.toolsRemoveLink(info!.path);
                store.pushToast("success", "Link removed", info!.path);
                setInfo(null);
                await store.refreshActive();
              } catch (err) {
                setError(toErrorMessage(err));
              }
            }}
          >
            Remove link (keeps target)
          </button>
        </div>
      </div>
    </div>
  );
}

function UnlockerPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [path, setPath] = useState(tab?.selected[0] ?? "");
  const [procs, setProcs] = useState<LockingProcess[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPath(tab?.selected[0] ?? "");
  }, [tab?.selected]);

  const check = async () => {
    if (!path) return;
    setBusy(true);
    setError(null);
    try {
      setProcs(await ipc.toolsGetLockingProcesses(path));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="input" value={path} onChange={(e) => setPath(e.target.value)} placeholder="File or folder path" />
        <button className="btn btn-primary" disabled={busy || !path} onClick={() => void check()}>
          {busy ? "Checking…" : "Find locking processes"}
        </button>
      </div>
      <ErrorLine error={error} />
      {procs.length === 0 && !busy && (
        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>No locking processes reported.</div>
      )}
      {procs.map((proc) => (
        <div key={proc.pid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>{proc.name} <span style={{ color: "var(--text-faint)" }}>(PID {proc.pid})</span></div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{proc.appType}{proc.isSystem ? " · system process" : ""}</div>
          </div>
          <button
            className="btn btn-sm btn-danger"
            disabled={proc.isSystem}
            onClick={() => {
              store.openConfirm({
                title: `Terminate ${proc.name}?`,
                description: `PID ${proc.pid} will be ended so the lock is released. Unsaved work in that process may be lost.`,
                confirmLabel: "Terminate process",
                danger: true,
                onConfirm: async () => {
                  try {
                    await ipc.toolsTerminateProcess(proc.pid);
                    await check();
                  } catch (err) {
                    setError(toErrorMessage(err));
                  }
                },
              });
            }}
          >
            Terminate
          </button>
        </div>
      ))}
    </div>
  );
}

function SplitterPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [path, setPath] = useState(tab?.selected[0] ?? "");
  const [chunkMb, setChunkMb] = useState(100);
  const [manifest, setManifest] = useState("");
  const [split, setSplit] = useState<SplitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPath(tab?.selected[0] ?? "");
  }, [tab?.selected]);

  return (
    <div>
      <div className="modal-section">
        <h4>Split file</h4>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 240 }} value={path} onChange={(e) => setPath(e.target.value)} placeholder="Source file" />
          <div className="field" style={{ width: 150 }}>
            <label>Chunk size (MB)</label>
            <input className="input" type="number" min={1} value={chunkMb} onChange={(e) => setChunkMb(Number(e.target.value || 1))} />
          </div>
          <button
            className="btn btn-primary"
            disabled={busy || !path}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await ipc.toolsSplitFile(path, chunkMb * 1024 * 1024);
                setSplit(result);
                setManifest(result.manifestPath);
                store.pushToast("success", "File split", `${result.partsCreated.length} parts created`);
                await store.refreshActive();
              } catch (err) {
                setError(toErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Split
          </button>
        </div>
        {split && (
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8 }}>
            {split.partsCreated.length} parts · SHA-256 {split.sha256.slice(0, 16)}… · manifest {basename(split.manifestPath)}
          </div>
        )}
      </div>
      <div className="modal-section">
        <h4>Join parts</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={manifest} onChange={(e) => setManifest(e.target.value)} placeholder="Manifest path (.split.json)" />
          <button
            className="btn btn-primary"
            disabled={busy || !manifest}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await ipc.toolsJoinFiles(manifest);
                store.pushToast("success", "File rejoined", `${result.outputPath} · hash ${result.hashVerified ? "verified" : "mismatch"}`);
                await store.refreshActive();
              } catch (err) {
                setError(toErrorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Join
          </button>
        </div>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

function TimestampsPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [path, setPath] = useState(tab?.selected[0] ?? "");
  const [info, setInfo] = useState<TimestampInfo | null>(null);
  const [created, setCreated] = useState("");
  const [modified, setModified] = useState("");
  const [accessed, setAccessed] = useState("");
  const [attrs, setAttrs] = useState({ readonly: false, hidden: false, system: false, archive: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPath(tab?.selected[0] ?? "");
  }, [tab?.selected]);

  const load = async () => {
    if (!path) return;
    setError(null);
    try {
      const result = await ipc.toolsGetTimestamps(path);
      setInfo(result);
      setCreated(toLocalInput(result.createdMs));
      setModified(toLocalInput(result.modifiedMs));
      setAccessed(toLocalInput(result.accessedMs));
      setAttrs({ readonly: result.isReadonly, hidden: result.isHidden, system: result.isSystem, archive: result.isArchive });
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="input" value={path} onChange={(e) => setPath(e.target.value)} placeholder="File or folder path" />
        <button className="btn btn-primary" disabled={!path} onClick={() => void load()}>Read</button>
      </div>
      <ErrorLine error={error} />
      {info && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div className="field"><label>Created</label><input className="input" type="datetime-local" value={created} onChange={(e) => setCreated(e.target.value)} /></div>
            <div className="field"><label>Modified</label><input className="input" type="datetime-local" value={modified} onChange={(e) => setModified(e.target.value)} /></div>
            <div className="field"><label>Accessed</label><input className="input" type="datetime-local" value={accessed} onChange={(e) => setAccessed(e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 16, margin: "14px 0", flexWrap: "wrap" }}>
            {(["readonly", "hidden", "system", "archive"] as const).map((key) => (
              <label key={key} style={{ display: "flex", gap: 5, fontSize: 12, alignItems: "center" }}>
                <input type="checkbox" checked={attrs[key]} onChange={(e) => setAttrs({ ...attrs, [key]: e.target.checked })} />
                {key}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={async () => {
                setError(null);
                try {
                  await ipc.toolsSetTimestamps(path, fromLocalInput(created), fromLocalInput(modified), fromLocalInput(accessed));
                  await ipc.toolsSetAttributes(path, attrs.readonly, attrs.hidden, attrs.system, attrs.archive);
                  store.pushToast("success", "Timestamps & attributes updated", basename(path));
                  await store.refreshActive();
                } catch (err) {
                  setError(toErrorMessage(err));
                }
              }}
            >
              Apply
            </button>
            <button
              className="btn"
              onClick={async () => {
                setError(null);
                try {
                  await ipc.toolsSetAttributes(path, false, false, false, false);
                  store.pushToast("success", "Attributes cleared", basename(path));
                  await load();
                } catch (err) {
                  setError(toErrorMessage(err));
                }
              }}
            >
              Clear attributes
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function UsnPanel() {
  const store = useAppStore();
  const [volume, setVolume] = useState(store.drives[0]?.path ?? "C:\\");
  const [info, setInfo] = useState<UsnJournalInfo | null>(null);
  const [records, setRecords] = useState<UsnRecordsBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = async () => {
    setBusy(true);
    setError(null);
    try {
      setInfo(await ipc.toolsUsnQuery(volume));
      setRecords(await ipc.toolsUsnRecords(volume, undefined, 100));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div className="field" style={{ width: 160 }}>
          <label>Volume</label>
          <select className="input" value={volume} onChange={(e) => setVolume(e.target.value)}>
            {store.drives.map((drive) => <option key={drive.path} value={drive.path}>{drive.label || drive.path}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={() => void query()}>
          {busy ? "Reading…" : "Read USN journal"}
        </button>
      </div>
      <ErrorLine error={error} />
      {info && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
          <Stat label="Journal ID" value={String(info.journalId)} />
          <Stat label="Lowest valid USN" value={String(info.lowestValidUsn)} />
          <Stat label="Next USN" value={String(info.nextUsn)} />
          <Stat label="Maximum USN" value={String(info.maximumUsn)} />
          <Stat label="Maximum size" value={formatBytes(info.maximumSize)} />
          <Stat label="Allocation delta" value={formatBytes(info.allocationDelta)} />
        </div>
      )}
      {records && (
        <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 340, overflow: "auto" }}>
          {records.records.map((record) => (
            <div key={record.usn} style={{ padding: "5px 10px", borderBottom: "1px solid var(--border)", fontSize: 12, display: "flex", gap: 10 }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.fileName}</span>
              <span style={{ color: "var(--text-faint)" }}>{record.reasons.join(", ")}</span>
              <span style={{ color: "var(--text-faint)" }}>{record.timestamp}</span>
            </div>
          ))}
          {records.records.length === 0 && <div style={{ padding: 16, color: "var(--text-faint)", fontSize: 13 }}>No USN records.</div>}
        </div>
      )}
    </div>
  );
}

function VssPanel() {
  const store = useAppStore();
  const [volume, setVolume] = useState(store.drives[0]?.path ?? "C:\\");
  const [snapshots, setSnapshots] = useState<VssSnapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setSnapshots(await ipc.toolsVssList(volume));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div className="field" style={{ width: 160 }}>
          <label>Volume</label>
          <select className="input" value={volume} onChange={(e) => setVolume(e.target.value)}>
            {store.drives.map((drive) => <option key={drive.path} value={drive.path}>{drive.label || drive.path}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={() => void load()}>
          {busy ? "Loading…" : "List shadow copies"}
        </button>
      </div>
      <ErrorLine error={error} />
      {snapshots.length === 0 && !busy && (
        <div style={{ color: "var(--text-faint)", fontSize: 13, marginTop: 12 }}>No snapshots loaded (administrator rights may be required).</div>
      )}
      {snapshots.map((snapshot) => (
        <div key={snapshot.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
          <div style={{ fontWeight: 600 }}>{snapshot.creationTime} · {snapshot.provider}</div>
          <div style={{ color: "var(--text-faint)", overflowWrap: "anywhere" }}>{snapshot.snapshotPath}</div>
        </div>
      ))}
    </div>
  );
}

function BitLockerPanel() {
  const store = useAppStore();
  const [volumes, setVolumes] = useState<BitLockerVolumeStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setVolumes(await ipc.toolsBitlockerStatus());
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button className="btn btn-primary" disabled={busy} onClick={() => void load()}>
        {busy ? "Reading…" : "Refresh BitLocker status"}
      </button>
      <ErrorLine error={error} />
      {volumes.map((volume) => (
        <div key={volume.driveLetter} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{volume.driveLetter} · {volume.encryptionStatus}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {volume.lockStatus} · {volume.protectionStatus} · {volume.percentageEncrypted}% encrypted · {volume.volumeType}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{volume.keyProtectors.join(", ") || "no key protectors"}</div>
          </div>
          <button
            className="btn btn-sm"
            onClick={async () => {
              try {
                const message = await ipc.toolsBitlockerLock(volume.driveLetter);
                store.pushToast("success", "BitLocker lock", message);
                await load();
              } catch (err) {
                setError(toErrorMessage(err));
              }
            }}
          >
            Lock
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              store.openPrompt({
                title: `Unlock ${volume.driveLetter}`,
                description: "Enter the BitLocker password (leave empty to use a recovery key).",
                label: "Password or 48-digit recovery key",
                value: "",
                confirmLabel: "Unlock",
                onConfirm: async (value) => {
                  try {
                    const isRecovery = value.replace(/[\s-]/g, "").length >= 48;
                    const message = isRecovery
                      ? await ipc.toolsBitlockerUnlock(volume.driveLetter, undefined, value)
                      : await ipc.toolsBitlockerUnlock(volume.driveLetter, value, undefined);
                    store.pushToast("success", "BitLocker unlock", message);
                    await load();
                  } catch (err) {
                    setError(toErrorMessage(err));
                  }
                },
              });
            }}
          >
            Unlock
          </button>
        </div>
      ))}
    </div>
  );
}

function HashPanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [algorithm, setAlgorithm] = useState("sha256");
  const [manifest, setManifest] = useState("");
  const [verifyPath, setVerifyPath] = useState("");
  const [report, setReport] = useState<HashVerifyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!tab) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ipc.toolsHashCreateManifest(tab.path, algorithm, manifest || undefined);
      setManifest(result.manifestPath);
      setVerifyPath(result.manifestPath);
      store.pushToast("success", "Manifest generated", `${result.entries} files → ${basename(result.manifestPath)}`);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!verifyPath) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await ipc.toolsHashVerifyManifest(verifyPath));
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="modal-section">
        <h4>Generate manifest for the current folder</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="input" style={{ width: 150 }} value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
            <option value="sha256">SHA-256</option>
            <option value="sha512">SHA-512</option>
            <option value="sha1">SHA-1</option>
            <option value="md5">MD5</option>
            <option value="crc32">CRC32 / SFV</option>
            <option value="blake3">BLAKE3</option>
            <option value="xxh3">XXH3</option>
          </select>
          <input className="input" style={{ flex: 1, minWidth: 240 }} value={manifest} onChange={(e) => setManifest(e.target.value)} placeholder="Manifest path (optional — defaults beside the folder)" />
          <button className="btn btn-primary" disabled={busy || !tab} onClick={() => void generate()}>Generate</button>
        </div>
      </div>
      <div className="modal-section">
        <h4>Verify manifest</h4>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" value={verifyPath} onChange={(e) => setVerifyPath(e.target.value)} placeholder="Manifest to verify" />
          <button className="btn btn-primary" disabled={busy || !verifyPath} onClick={() => void verify()}>Verify</button>
        </div>
      </div>
      <ErrorLine error={error} />
      {report && (
        <>
          <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
            <Stat label="Total" value={String(report.total)} />
            <Stat label="Matched" value={String(report.matched)} />
            <Stat label="Mismatched" value={String(report.mismatched)} />
            <Stat label="Missing" value={String(report.missing)} />
            <Stat label="Algorithm" value={report.algorithm} />
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, maxHeight: 340, overflow: "auto" }}>
            {report.items.filter((item) => item.status !== "match").map((item) => (
              <div key={item.path} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", fontSize: 12, display: "flex", gap: 8 }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.path}</span>
                <span style={{ color: item.status === "missing" ? "var(--warning)" : "var(--danger)" }}>{item.status}</span>
              </div>
            ))}
            {report.items.every((item) => item.status === "match") && (
              <div style={{ padding: 14, color: "var(--success)", fontSize: 13 }}>All checksums match.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PluginsPanel() {
  const store = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => void run(store.createSamplePlugin)}>Create sample plugin</button>
        <button className="btn" disabled={busy} onClick={() => void run(store.refreshPlugins)}>Reload</button>
        <span style={{ fontSize: 11, color: "var(--text-faint)", alignSelf: "center" }}>
          Plugins live in %LOCALAPPDATA%\NexusExplorer\plugins
        </span>
      </div>
      <ErrorLine error={error} />
      {store.plugins.length === 0 && (
        <div style={{ color: "var(--text-faint)", fontSize: 13 }}>
          No plugins installed. Create the sample to see the manifest format, then add your own folders with a plugin.json.
        </div>
      )}
      {store.plugins.map((plugin: PluginInfo) => (
        <div key={plugin.manifest.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {plugin.manifest.name} <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>v{plugin.manifest.version}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{plugin.manifest.description || plugin.pluginDir}</div>
              {plugin.error && <div style={{ fontSize: 11, color: "var(--danger)" }}>{plugin.error}</div>}
            </div>
            <label style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={plugin.enabled}
                disabled={!plugin.valid || busy}
                onChange={(e) => void run(() => store.setPluginEnabled(plugin.manifest.id, e.target.checked))}
              />
              Enabled
            </label>
          </div>
          {plugin.enabled && plugin.manifest.commands.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {plugin.manifest.commands.map((command) => (
                <button
                  key={command.id}
                  className="btn btn-sm"
                  disabled={busy}
                  title={command.description ?? command.id}
                  onClick={() => void run(() => store.runPluginCommand(plugin.manifest.id, command.id))}
                >
                  {command.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MerklePanel() {
  const store = useAppStore();
  const tab = store.tabs.find((t) => t.id === store.activeTabId);
  const [targetDir, setTargetDir] = useState(tab?.path ?? "");
  const [report, setReport] = useState<MerkleTreeReport | null>(null);
  const [proof, setProof] = useState<MerkleProof | null>(null);
  const [snapshotA, setSnapshotA] = useState<MerkleTreeReport | null>(null);
  const [diffReport, setDiffReport] = useState<MerkleDiffReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    if (tab?.path && !targetDir) {
      setTargetDir(tab.path);
    }
  }, [tab?.path, targetDir]);

  const computeTree = async () => {
    if (!targetDir.trim()) return;
    setBusy(true);
    setError(null);
    setProof(null);
    try {
      const res = await ipc.toolsMerkleBuild(targetDir.trim());
      setReport(res);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const getInclusionProof = async (relPath: string) => {
    if (!targetDir.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await ipc.toolsMerkleProof(targetDir.trim(), relPath);
      setProof(res);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const snapshotCurrent = () => {
    if (!report) return;
    setSnapshotA(report);
    setDiffReport(null);
  };

  const runDiff = async () => {
    if (!snapshotA || !report) return;
    setBusy(true);
    setError(null);
    try {
      const diff = await ipc.toolsMerkleDiff(snapshotA, report);
      setDiffReport(diff);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const filteredLeaves = useMemo(() => {
    if (!report) return [];
    if (!searchFilter.trim()) return report.leaves;
    const q = searchFilter.toLowerCase();
    return report.leaves.filter((l) => l.relativePath.toLowerCase().includes(q));
  }, [report, searchFilter]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          className="input"
          style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
          value={targetDir}
          placeholder="Target folder path..."
          onChange={(e) => setTargetDir(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !targetDir.trim()} onClick={() => void computeTree()}>
          {busy ? "Computing..." : "Compute Merkle Tree"}
        </button>
        {report && (
          <button className="btn" disabled={busy} onClick={snapshotCurrent} title="Store current tree snapshot for differential audit">
            {snapshotA ? "Update Snapshot A" : "Snapshot A"}
          </button>
        )}
        {snapshotA && report && (
          <button className="btn" disabled={busy} onClick={() => void runDiff()}>
            Compare with Snapshot A
          </button>
        )}
      </div>

      <ErrorLine error={error} />

      {report && (
        <div style={{ display: "grid", gap: 14 }}>
          {/* Header Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>TOTAL FILES</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{report.totalFiles.toLocaleString()}</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>TOTAL PAYLOAD</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{formatBytes(report.totalBytes)}</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>TREE DEPTH</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{report.treeDepth} levels</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>COMPUTATION TIME</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{report.elapsedMs} ms</div>
            </div>
          </div>

          {/* Root Hash Banner */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--bg-card)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em" }}>
                BLAKE3 MERKLE ROOT COMMITMENT HASH
              </div>
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--success-bg)", color: "var(--success)", fontWeight: 600 }}>
                AUTHENTIC
              </span>
            </div>
            <code style={{ fontSize: 12, wordBreak: "break-all", color: "var(--text)" }}>{report.merkleRootHash}</code>
          </div>

          {/* Differential Audit Report if present */}
          {diffReport && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: diffReport.isIdentical ? "var(--success-bg)" : "var(--card-bg)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {diffReport.isIdentical ? "Snapshot Comparison: Identical (Zero Drift)" : "Snapshot Comparison: Cryptographic Differences Detected"}
              </div>
              <div style={{ fontSize: 12, display: "flex", gap: 16 }}>
                <span>Unmodified: <strong>{diffReport.unmodifiedCount}</strong></span>
                <span style={{ color: "var(--accent)" }}>Modified: <strong>{diffReport.modifiedFiles.length}</strong></span>
                <span style={{ color: "var(--success)" }}>Added: <strong>{diffReport.addedFiles.length}</strong></span>
                <span style={{ color: "var(--danger)" }}>Removed: <strong>{diffReport.removedFiles.length}</strong></span>
              </div>
              {diffReport.modifiedFiles.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  <strong>Modified files:</strong> {diffReport.modifiedFiles.join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Inclusion Proof Card if generated */}
          {proof && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, background: "var(--card-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  Cryptographic Inclusion Proof (O(log N)): <code>{proof.targetRelativePath}</code>
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontWeight: 700,
                    background: proof.isValid ? "var(--success-bg)" : "var(--danger-bg)",
                    color: proof.isValid ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {proof.isValid ? "PROVABLY AUTHENTIC" : "PROOF INVALID"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 16 }}>
                <span>Leaf Index: #{proof.leafIndex + 1} of {proof.totalLeaves}</span>
                <span>Audit Path Steps: {proof.auditPath.length} hashes</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
                Leaf Hash: {proof.leafHash}
              </div>
            </div>
          )}

          {/* Leaves Explorer */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Leaf Nodes ({report.leaves.length})</div>
              <input
                type="text"
                className="input"
                style={{ width: 220, fontSize: 11 }}
                placeholder="Filter files..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "6px 10px" }}>Path</th>
                    <th style={{ padding: "6px 10px" }}>Size</th>
                    <th style={{ padding: "6px 10px" }}>BLAKE3 Leaf Hash</th>
                    <th style={{ padding: "6px 10px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.slice(0, 50).map((l) => (
                    <tr key={l.relativePath} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{l.relativePath}</td>
                      <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{formatBytes(l.fileSize)}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "var(--text-faint)" }}>
                        {l.leafHash.substring(0, 16)}...
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 10, padding: "2px 6px" }}
                          disabled={busy}
                          onClick={() => void getInclusionProof(l.relativePath)}
                        >
                          Verify Proof
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
