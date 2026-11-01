import { useAppStore } from "@/state/store";
import { ACCENTS } from "@/lib/theme";
import { X } from "lucide-react";

export default function SettingsDialog() {
  const store = useAppStore();
  const s = store.settings;
  const appInfo = store.appInfo;

  const Toggle = ({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        {desc && <div className="settings-desc">{desc}</div>}
      </div>
      <button className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} />
    </div>
  );

  return (
    <div className="overlay" onClick={() => store.setSettingsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 620 }}>
        <div className="modal-header" style={{ display: "flex", alignItems: "center" }}>
          <div className="modal-title">Settings</div>
          <span style={{ flex: 1 }} />
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => store.setSettingsOpen(false)}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <h4>Appearance</h4>
            <div className="settings-row">
              <div className="settings-label">Theme</div>
              <div className="seg">
                {(["dark", "light", "system", "mica", "acrylic"] as const).map((t) => (
                  <button key={t} className={`seg-btn ${s.theme === t ? "active" : ""}`} onClick={() => void store.updateSettings({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-label">Accent</div>
              <div className="swatch-grid">
                {ACCENTS.map((a) => (
                  <button key={a.id} className={`swatch ${s.accent === a.id ? "active" : ""}`} style={{ background: a.hue }} onClick={() => void store.updateSettings({ accent: a.id })} title={a.name} />
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-label">Density</div>
              <div className="seg">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button key={d} className={`seg-btn ${s.density === d ? "active" : ""}`} onClick={() => void store.updateSettings({ density: d })}>{d[0].toUpperCase() + d.slice(1)}</button>
                ))}
              </div>
            </div>
            <Toggle checked={s.animations} onChange={(v) => void store.updateSettings({ animations: v })} label="Animations" desc="Motion and transitions" />
          </div>

          <div className="modal-section">
            <h4>Browsing</h4>
            <Toggle checked={s.showHidden} onChange={(v) => void store.updateSettings({ showHidden: v })} label="Show hidden files" />
            <Toggle checked={s.showSystem} onChange={(v) => void store.updateSettings({ showSystem: v })} label="Show system files" />
            <Toggle checked={s.showExtensions} onChange={(v) => void store.updateSettings({ showExtensions: v })} label="Show file extensions" />
            <Toggle checked={s.confirmDelete} onChange={(v) => void store.updateSettings({ confirmDelete: v })} label="Confirm before delete" />
            <Toggle checked={s.restoreSession} onChange={(v) => void store.updateSettings({ restoreSession: v })} label="Restore session on launch" />
          </div>

          <div className="modal-section">
            <h4>2027+ Power User Modes</h4>
            <div className="settings-row">
              <div className="settings-label">Default View</div>
              <div className="seg">
                {(["list", "grid", "columns"] as const).map((vm) => (
                  <button
                    key={vm}
                    className={`seg-btn ${s.view === vm ? "active" : ""}`}
                    onClick={() => {
                      void store.updateSettings({ view: vm });
                      store.setView(vm);
                    }}
                  >
                    {vm[0].toUpperCase() + vm.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              checked={s.faytEnabled !== false}
              onChange={(v) => void store.updateSettings({ faytEnabled: v })}
              label="Find-As-You-Type (FAYT)"
              desc="Instant keyboard activation with ', +, >, ]"
            />
            <Toggle
              checked={s.chromaticHeatmap !== false}
              onChange={(v) => void store.updateSettings({ chromaticHeatmap: v })}
              label="Chromatic Age Heatmaps"
              desc="Color-code recently modified files (<24h emerald, <7d cyan, <30d blue)"
            />
            <Toggle
              checked={s.vimModeEnabled !== false}
              onChange={(v) => void store.updateSettings({ vimModeEnabled: v })}
              label="Vim Modal Navigation"
              desc="Navigate active lists using h/j/k/l, gg, G, y, p"
            />
          </div>

          <div className="modal-section">
            <h4>Layout</h4>
            <Toggle checked={s.sidebarOpen} onChange={(v) => void store.updateSettings({ sidebarOpen: v })} label="Sidebar" />
            <Toggle checked={s.previewOpen} onChange={(v) => void store.updateSettings({ previewOpen: v })} label="Preview pane" />
          </div>

          {appInfo && (
            <div className="modal-section">
              <h4>About</h4>
              <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.7 }}>
                <div>Nexus Explorer {appInfo.version}</div>
                <div>Engine {appInfo.engineVersion} · {appInfo.platform} / {appInfo.arch}</div>
                <div>User: {appInfo.user} @ {appInfo.hostname}</div>
                <div>Data: {appInfo.dataDir}</div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => void store.resetSettings()}>Reset appearance</button>
          <button className="btn btn-primary" onClick={() => store.setSettingsOpen(false)}>Done</button>
        </div>
      </div>
    </div>
  );
}