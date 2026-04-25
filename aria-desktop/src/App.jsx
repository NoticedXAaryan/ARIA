import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Spinner } from "@heroui/react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import SetupWizard from "./pages/SetupWizard";
import Dashboard from "./components/Dashboard";
import TrayPopup from "./components/TrayPopup";
import ExpandedPanel from "./components/ExpandedPanel";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

function LoadingScreen() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--aria-bg)",
        gap: 16,
      }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Spinner size="lg" color="secondary" />
      </motion.div>
      <p style={{ color: "var(--aria-text-muted)", fontSize: 13 }}>
        Loading ARIA...
      </p>
    </div>
  );
}

export default function App() {
  const { user, loading, setupComplete } = useAuth();
  const [popupNudge, setPopupNudge] = useState(null);
  const [expandedNudge, setExpandedNudge] = useState(null);

  const handlePopupFeedback = useCallback(
    async (id, outcome) => {
      try {
        await fetch(`${API}/api/nudges/${id}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome }),
        });
      } catch (_) {}
      setPopupNudge(null);
      setExpandedNudge(null);
    },
    []
  );

  const handleExpand = useCallback((nudge) => {
    setPopupNudge(null);
    setExpandedNudge(nudge);
  }, []);

  const handleCollapseExpanded = useCallback(() => {
    setExpandedNudge(null);
  }, []);

  // Loading state
  if (loading) return <LoadingScreen />;

  // Not authenticated → Login
  if (!user) return <LoginPage />;

  // Authenticated but not set up → Setup Wizard
  if (!setupComplete) return <SetupWizard />;

  // Fully authenticated and set up → Dashboard + popups
  return (
    <>
      <Dashboard />
      <TrayPopup
        nudge={popupNudge}
        onExpand={handleExpand}
        onFeedback={handlePopupFeedback}
      />
      <AnimatePresence>
        {expandedNudge && (
          <ExpandedPanel
            nudge={expandedNudge}
            onClose={handleCollapseExpanded}
            onFeedback={handlePopupFeedback}
          />
        )}
      </AnimatePresence>
    </>
  );
}
