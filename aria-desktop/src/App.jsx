import { useState, useEffect, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import TrayPopup from "./components/TrayPopup";
import ExpandedPanel from "./components/ExpandedPanel";

export default function App() {
  const [nudge, setNudge] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ariaDesktop) {
      window.ariaDesktop.onPopupData((payload) => setNudge(payload));
    }
  }, []);

  const handleExpand = useCallback(() => setExpanded(true), []);
  const handleCollapse = useCallback(() => setExpanded(false), []);

  return (
    <main>
      <Dashboard />
      <div onClick={handleExpand}>
        <TrayPopup nudge={nudge} />
      </div>
      {expanded && <ExpandedPanel nudge={nudge} onClose={handleCollapse} />}
    </main>
  );
}
