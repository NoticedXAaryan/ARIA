import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Spinner, Button } from "@heroui/react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import SetupWizard from "./pages/SetupWizard";
import Dashboard from "./components/Dashboard";
import TrayPopup from "./components/TrayPopup";
import ExpandedPanel from "./components/ExpandedPanel";
import SidePanel from "./components/SidePanel";
import OnboardingWizard from "./components/OnboardingWizard";
import NudgeToast from "./components/NudgeToast";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

function LoadingScreen({ error, onRetry }) {
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
      {!error ? (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Spinner size="lg" color="secondary" />
          </motion.div>
          <p style={{ color: "var(--aria-text-muted)", fontSize: 13 }}>
            Starting ARIA Daemon...
          </p>
        </>
      ) : (
        <>
          <div style={{ color: "#ef4444", fontSize: 14, fontWeight: "bold" }}>Daemon Error</div>
          <p style={{ color: "var(--aria-text-muted)", fontSize: 12, textAlign: "center", maxWidth: 250 }}>
            ARIA backend could not be reached. Ensure Python is installed and try again.
          </p>
          <Button size="sm" color="primary" onPress={onRetry}>Retry</Button>
        </>
      )}
    </div>
  );
}

function OfflineBanner() {
  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
      background: "rgba(20,20,20,0.9)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
      padding: "6px 12px", display: "flex", alignItems: "center", gap: 8,
      zIndex: 9999, pointerEvents: "none"
    }}>
      <Spinner size="sm" color="warning" />
      <span style={{ fontSize: 12, color: "#aaa" }}>Reconnecting...</span>
    </div>
  );
}

export default function App() {
  const { user, loading, setupComplete } = useAuth();
  const [popupNudge, setPopupNudge] = useState(null);
  const [expandedNudge, setExpandedNudge] = useState(null);
  const [isConfigured, setIsConfigured] = useState(null); // null means loading
  const [daemonState, setDaemonState] = useState("loading"); // loading, ready, error
  const [isOffline, setIsOffline] = useState(false);

  // Poll daemon health on startup
  const checkDaemon = useCallback(async () => {
    setDaemonState("loading");
    let attempts = 0;
    while (attempts < 20) { // 10 seconds total (500ms * 20)
      try {
        const res = await fetch(`${API}/api/setup/status`);
        if (res.ok) {
          const d = await res.json();
          setIsConfigured(d.is_configured);
          setDaemonState("ready");
          setIsOffline(false);
          return;
        }
      } catch (e) {
        // Ignore and retry
      }
      attempts++;
      await new Promise(r => setTimeout(r, 500));
    }
    setDaemonState("error");
  }, []);

  useEffect(() => {
    checkDaemon();
  }, [checkDaemon]);

  // Offline detection poll every 30s once ready
  useEffect(() => {
    if (daemonState !== "ready") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/setup/status`);
        if (res.ok) setIsOffline(false);
        else setIsOffline(true);
      } catch (e) {
        setIsOffline(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [daemonState]);

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
  if (loading || daemonState === "loading" || isConfigured === null) {
    // Only show error if daemon check failed, else standard loading
    if (daemonState === "error") return <LoadingScreen error={true} onRetry={checkDaemon} />;
    return <LoadingScreen error={false} />;
  }

  // Not authenticated → Login
  if (!user) return <LoginPage />;

  // Fully authenticated and set up → Dashboard + popups
  // Handle onboarding modal
  if (isConfigured === false) {
    return <OnboardingWizard onComplete={() => setIsConfigured(true)} />;
  }
  // Handle hash routing for the SidePanel
  if (window.location.hash === "#/panel") {
    return <SidePanel />;
  }
  
  if (window.location.hash === "#/toast") {
    return <NudgeToast />;
  }

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
      {isOffline && window.location.hash !== "#/toast" && <OfflineBanner />}
    </>
  );
}
