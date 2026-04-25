import { useState } from "react";
import Dashboard from "./components/Dashboard";
import TrayPopup from "./components/TrayPopup";
import ExpandedPanel from "./components/ExpandedPanel";

export default function App() {
  const [nudge, setNudge] = useState(null);
  const [expanded, setExpanded] = useState(false);

  if (typeof window !== "undefined" && window.ariaDesktop) {
    window.ariaDesktop.onPopupData((payload) => setNudge(payload));
  }

  return (
    <main>
      <Dashboard />
      <div onClick={() => setExpanded(true)}>
        <TrayPopup nudge={nudge} />
      </div>
      {expanded && <ExpandedPanel nudge={nudge} />}
    </main>
  );
}
