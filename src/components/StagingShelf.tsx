import { useAppStore } from "@/state/store";
import StagingShelfWidget from "@/components/StagingShelfWidget";

export default function StagingShelf() {
  const store = useAppStore();
  const activeTab = store.tabs.find((t) => t.id === store.activeTabId);
  const dest = activeTab?.path ?? "";

  if (!store.stagingOpen) return null;

  return (
    <aside className="shelf" data-drop-path={dest}>
      <StagingShelfWidget embedded={false} />
    </aside>
  );
}
