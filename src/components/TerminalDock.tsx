import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/state/store";
import { ipc, toErrorMessage } from "@/lib/ipc";
import { ChevronDown, ChevronUp, SquareTerminal, Trash2, X } from "lucide-react";

export default function TerminalDock() {
  const store = useAppStore();
  const open = store.terminalOpen;
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shell, setShell] = useState<"powershell" | "cmd">("powershell");
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | null>(null);
  const startedCwd = useRef<string>("");

  sessionRef.current = sessionId;

  const stop = () => {
    const id = sessionRef.current;
    sessionRef.current = null;
    setSessionId(null);
    if (id) void ipc.toolsTerminalClose(id).catch(() => undefined);
  };

  const start = async (which: "powershell" | "cmd", cwd: string) => {
    stop();
    setError(null);
    setOutput("");
    setClosed(false);
    startedCwd.current = cwd;
    try {
      const started = await ipc.toolsTerminalStart(cwd, which);
      setSessionId(started.sessionId);
      sessionRef.current = started.sessionId;
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  // Start a session only while the dock is visible and has no live one.
  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    if (!sessionId) {
      void start(shell, activeTab?.path ?? "C:\\");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Poll for output.
  useEffect(() => {
    if (!open || !sessionId) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const chunk = await ipc.toolsTerminalRead(sessionId);
        if (cancelled) return;
        if (chunk.output) setOutput((current) => (current + chunk.output).slice(-400_000));
        if (chunk.closed) setClosed(true);
      } catch {
        if (!cancelled) setClosed(true);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, sessionId]);

  // Keep the view pinned to the bottom unless the user has scrolled up.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [output]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, collapsed]);

  if (!open) return null;

  const send = async () => {
    if (!sessionId || closed) return;
    const line = input;
    setInput("");
    setOutput((current) => `${current}${line}\n`);
    try {
      await ipc.toolsTerminalWrite(sessionId, line);
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="terminal-dock" style={collapsed ? { height: 34, flexShrink: 0 } : undefined}>
      <div className="terminal-head">
        <SquareTerminal size={13} color="var(--accent)" />
        <span className="terminal-title">
          Terminal · {shell === "powershell" ? "PowerShell" : "Command Prompt"} · {startedCwd.current || activeTab?.path || "—"}
          {closed ? " · session ended" : ""}
        </span>
        <select
          className="input"
          style={{ width: 120, padding: "2px 6px", fontSize: 11 }}
          value={shell}
          onChange={(e) => {
            const next = e.target.value as "powershell" | "cmd";
            setShell(next);
            void start(next, activeTab?.path ?? "C:\\");
          }}
        >
          <option value="powershell">PowerShell</option>
          <option value="cmd">cmd.exe</option>
        </select>
        <button className="icon-btn" title="Restart session" onClick={() => void start(shell, activeTab?.path ?? "C:\\")}>
          <SquareTerminal size={13} />
        </button>
        <button className="icon-btn" title="Clear output" onClick={() => setOutput("")}>
          <Trash2 size={13} />
        </button>
        <button className="icon-btn" title={collapsed ? "Expand" : "Collapse"} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button className="icon-btn" title="Close terminal" onClick={() => store.setTerminalOpen(false)}>
          <X size={14} />
        </button>
      </div>

      {!collapsed && (
        <>
          <pre ref={bodyRef} className="terminal-body">
            {output || (error ? error : "Starting shell…")}
          </pre>
          {error && <div style={{ color: "var(--danger)", fontSize: 11, padding: "4px 10px" }}>{error}</div>}
          <div className="terminal-input-row">
            <span style={{ color: "#6b7688", fontFamily: "var(--font-mono)", fontSize: 12 }}>›</span>
            <input
              ref={inputRef}
              className="terminal-input"
              value={input}
              disabled={closed || !sessionId}
              placeholder={closed ? "Session ended — restart to continue" : "Type a command and press Enter"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                } else if (e.key === "c" && e.ctrlKey) {
                  e.preventDefault();
                  void ipc.toolsTerminalWrite(sessionId ?? "", "\u0003").catch(() => undefined);
                }
              }}
            />
            <button className="btn btn-sm" disabled={closed || !sessionId} onClick={() => void send()}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}
