import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import type { SftpProfile, RemoteFileEntry } from "@/types";
import {
  Server,
  Folder,
  File,
  Plus,
  Trash2,
  RefreshCw,
  X,
  ArrowLeft,
  Globe,
} from "lucide-react";

interface SftpExplorerModalProps {
  open: boolean;
  onClose: () => void;
}

export function SftpExplorerModal({ open, onClose }: SftpExplorerModalProps) {
  const [profiles, setProfiles] = useState<SftpProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SftpProfile | null>(null);
  const [currentRemotePath, setCurrentRemotePath] = useState("/");
  const [remoteEntries, setRemoteEntries] = useState<RemoteFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New profile state
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("");
  const [authType, setAuthType] = useState("key");
  const [privateKeyPath, setPrivateKeyPath] = useState("");
  const [remotePath, setRemotePath] = useState("/home");

  const loadProfiles = async () => {
    try {
      const data = await ipc.toolsSftpListProfiles();
      setProfiles(data);
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  const handleConnect = async (profile: SftpProfile, path?: string) => {
    setSelectedProfile(profile);
    const target = path || profile.remotePath || "/";
    setCurrentRemotePath(target);
    setLoading(true);
    setError(null);
    try {
      const entries = await ipc.toolsSftpListDirectory(profile.id, target);
      setRemoteEntries(entries);
    } catch (err) {
      setError(`Connection failed: ${err}`);
      setRemoteEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name || !host || !username) return;
    const newProfile: SftpProfile = {
      id: `sftp-${Date.now()}`,
      name,
      host,
      port,
      username,
      authType,
      privateKeyPath: privateKeyPath || null,
      remotePath,
    };
    try {
      await ipc.toolsSftpSaveProfile(newProfile);
      setShowAddForm(false);
      setName("");
      setHost("");
      setUsername("");
      loadProfiles();
    } catch (err) {
      setError(`Failed to save: ${err}`);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    try {
      await ipc.toolsSftpDeleteProfile(id);
      if (selectedProfile?.id === id) {
        setSelectedProfile(null);
        setRemoteEntries([]);
      }
      loadProfiles();
    } catch (err) {
      setError(`Failed to delete: ${err}`);
    }
  };

  const handleNavigate = (entry: RemoteFileEntry) => {
    if (!entry.isDir || !selectedProfile) return;
    const nextPath =
      currentRemotePath === "/"
        ? `/${entry.name}`
        : `${currentRemotePath.replace(/\/$/, "")}/${entry.name}`;
    handleConnect(selectedProfile, nextPath);
  };

  const handleNavigateUp = () => {
    if (!selectedProfile || currentRemotePath === "/") return;
    const parts = currentRemotePath.split("/").filter(Boolean);
    parts.pop();
    const upPath = parts.length === 0 ? "/" : `/${parts.join("/")}`;
    handleConnect(selectedProfile, upPath);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Remote SFTP / SSH Filesystem Explorer
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300 border border-cyan-500/30">
                  Zero-Mount
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Browse remote Linux/cloud infrastructure over secure SSH without third-party drivers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row text-xs">
          {/* Sidebar: Server Profiles */}
          <div className="w-full md:w-64 border-r border-slate-800 p-4 space-y-3 flex flex-col bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
                Saved Servers ({profiles.length})
              </span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="p-1 rounded hover:bg-slate-800 text-cyan-400"
                title="Add New Server Profile"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleConnect(p)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between group ${
                    selectedProfile?.id === p.id
                      ? "bg-cyan-950/30 border-cyan-500/40 text-cyan-200"
                      : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 text-slate-300"
                  }`}
                >
                  <div className="truncate">
                    <div className="font-medium text-xs text-slate-200 truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {p.username}@{p.host}:{p.port}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProfile(p.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 transition"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main Area: Remote Files or Add Form */}
          <div className="flex-1 p-4 flex flex-col overflow-hidden">
            {showAddForm ? (
              <div className="space-y-3 max-w-md">
                <h3 className="text-sm font-semibold text-slate-200">Add New Remote Server</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Profile Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Production App"
                      className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Host / IP</label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="192.168.1.10"
                      className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Port</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="root"
                      className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Auth Type</label>
                    <select
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
                    >
                      <option value="key">SSH Key</option>
                      <option value="agent">SSH Agent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Private Key Path (optional)</label>
                  <input
                    type="text"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Initial Remote Directory</label>
                  <input
                    type="text"
                    value={remotePath}
                    onChange={(e) => setRemotePath(e.target.value)}
                    placeholder="/var/www"
                    className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition"
                  >
                    Save Server Profile
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 rounded hover:bg-slate-800 text-slate-400 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selectedProfile ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Remote path navigation bar */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleNavigateUp}
                      disabled={currentRemotePath === "/"}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30"
                      title="Parent Directory"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="font-mono text-cyan-300 font-semibold">{currentRemotePath}</span>
                  </div>
                  <button
                    onClick={() => handleConnect(selectedProfile, currentRemotePath)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
                  </button>
                </div>

                {error && (
                  <div className="p-2 mb-2 rounded bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
                    {error}
                  </div>
                )}

                {/* Directory table */}
                <div className="flex-1 overflow-y-auto font-mono">
                  {loading ? (
                    <div className="flex h-48 items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
                      <span>Listing remote directory...</span>
                    </div>
                  ) : remoteEntries.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">Directory is empty or inaccessible.</div>
                  ) : (
                    <div className="space-y-1">
                      {remoteEntries.map((e, idx) => (
                        <div
                          key={idx}
                          onDoubleClick={() => handleNavigate(e)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-800/80 cursor-pointer text-[11px] ${
                            e.isDir ? "text-cyan-200" : "text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate max-w-sm">
                            {e.isDir ? (
                              <Folder className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                            ) : (
                              <File className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{e.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-slate-500 text-[10px]">
                            <span>{e.permissions}</span>
                            <span>{e.owner}</span>
                            <span className="w-16 text-right font-mono">
                              {e.isDir ? "DIR" : formatBytes(e.size)}
                            </span>
                            <span className="w-24 text-right text-slate-400">{e.modified}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8">
                <Server className="h-10 w-10 mb-2 text-slate-600" />
                <span className="text-sm font-medium text-slate-300">Select a server to connect</span>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Choose a saved SSH profile or click '+' to configure a new remote server.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
