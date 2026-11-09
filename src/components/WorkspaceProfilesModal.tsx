import React from "react";
import { Sliders, Code2, Film, ShieldCheck, Feather, Check, X } from "lucide-react";
import { useAppStore } from "@/state/store";
import type { PaneLayout, ViewMode, SortKey } from "@/types";

interface WorkspaceProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  settings: {
    showHidden: boolean;
    showSystem: boolean;
    previewOpen: boolean;
    sidebarOpen: boolean;
    view: ViewMode;
    sortKey: SortKey;
    sortDesc: boolean;
    paneLayout: PaneLayout;
  };
}

const PROFILES: ProfileConfig[] = [
  {
    id: "dev",
    name: "Developer & DevOps",
    description: "Dual horizontal split, Git badges enabled, dotfiles visible, sorted by recent modifications.",
    icon: <Code2 className="w-5 h-5 text-blue-400" />,
    accent: "border-blue-500/30 bg-blue-500/5",
    settings: {
      showHidden: true,
      showSystem: false,
      previewOpen: true,
      sidebarOpen: true,
      view: "list",
      sortKey: "modified",
      sortDesc: true,
      paneLayout: "dual-h",
    },
  },
  {
    id: "media",
    name: "Media & Creative Studio",
    description: "Grid view with file previews, sorted by name.",
    icon: <Film className="w-5 h-5 text-purple-400" />,
    accent: "border-purple-500/30 bg-purple-500/5",
    settings: {
      showHidden: false,
      showSystem: false,
      previewOpen: true,
      sidebarOpen: true,
      view: "grid",
      sortKey: "name",
      sortDesc: false,
      paneLayout: "single",
    },
  },
  {
    id: "forensics",
    name: "Forensic & Security Audit",
    description: "Full system & hidden files unmasked, sorted by file size, hex editor & ADS streams ready.",
    icon: <ShieldCheck className="w-5 h-5 text-red-400" />,
    accent: "border-red-500/30 bg-red-500/5",
    settings: {
      showHidden: true,
      showSystem: true,
      previewOpen: true,
      sidebarOpen: true,
      view: "list",
      sortKey: "size",
      sortDesc: true,
      paneLayout: "dual-h",
    },
  },
  {
    id: "zen",
    name: "Minimalist & Focus",
    description: "Single pane with the sidebar hidden and file preview visible.",
    icon: <Feather className="w-5 h-5 text-emerald-400" />,
    accent: "border-emerald-500/30 bg-emerald-500/5",
    settings: {
      showHidden: false,
      showSystem: false,
      previewOpen: true,
      sidebarOpen: false,
      view: "list",
      sortKey: "name",
      sortDesc: false,
      paneLayout: "single",
    },
  },
];

export const WorkspaceProfilesModal: React.FC<WorkspaceProfilesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const store = useAppStore();

  if (!isOpen) return null;

  const handleApplyProfile = (profile: ProfileConfig) => {
    void store.updateSettings({
      showHidden: profile.settings.showHidden,
      showSystem: profile.settings.showSystem,
      previewOpen: profile.settings.previewOpen,
      sidebarOpen: profile.settings.sidebarOpen,
      view: profile.settings.view,
      sortKey: profile.settings.sortKey,
      sortDesc: profile.settings.sortDesc,
    });

    store.setView(profile.settings.view);
    store.setSort(profile.settings.sortKey, profile.settings.sortDesc);
    store.setPaneLayout(profile.settings.paneLayout);

    if (profile.settings.sidebarOpen !== store.sidebarOpen) {
      store.toggleSidebar();
    }
    if (profile.settings.previewOpen !== store.previewOpen) {
      store.togglePreview();
    }

    store.pushToast("success", "Workspace Profile Applied", `Switched to "${profile.name}" layout preset.`);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Workspace profiles" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-2xl bg-[#18181b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Workspace Context Profiles</h2>
              <p className="text-xs text-zinc-400">1-click adaptive layouts tailored for different engineering tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Cards */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROFILES.map((profile) => (
            <div
              key={profile.id}
              className={`p-5 rounded-xl border transition flex flex-col justify-between gap-4 hover:border-zinc-600 ${profile.accent}`}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    {profile.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-200">{profile.name}</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {profile.description}
                </p>
              </div>

              <button
                onClick={() => handleApplyProfile(profile)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700/60 transition shadow-sm"
              >
                <Check className="w-3.5 h-3.5 text-cyan-400" />
                <span>Apply Profile</span>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-500">
          <span>Settings persist automatically in session state</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

