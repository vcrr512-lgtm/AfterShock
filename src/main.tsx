import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DashboardPage from "./VoicePage";
import HistoryPage from "./HistoryPage";
import { isXRMode } from "./xrMode";

// Apply WebSpatial class only when running as a standalone PWA / XR scene.
if (isXRMode) {
  document.documentElement.classList.add("is-spatial");
}

const isHistory = window.location.pathname === "/history";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isHistory ? <HistoryPage /> : <DashboardPage />}
  </StrictMode>,
);
