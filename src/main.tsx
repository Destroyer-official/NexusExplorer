import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/tailwind.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/glass.css";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAppStore } from "@/state/store";

if (typeof window !== "undefined") {
  (window as any).__nexus_store = useAppStore;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
