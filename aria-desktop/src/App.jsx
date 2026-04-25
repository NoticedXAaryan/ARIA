import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import SidePanel from "./components/SidePanel";
import NudgeToast from "./components/NudgeToast";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

function HomeScreen() {
  const [healthState, setHealthState] = useState("checking");

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        let res = await fetch(`${API}/api/health`);
        // Backward compatibility for older backend route.
        if (!res.ok && res.status === 404) {
          res = await fetch(`${API}/health`);
        }
        if (!active) return;
        setHealthState(res.ok ? "ok" : "down");
      } catch (_) {
        if (active) setHealthState("down");
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#fff",
      }}
    >
      <div style={{ textAlign: "center", display: "grid", gap: 12, placeItems: "center" }}>
        <h1 style={{ fontSize: 48, letterSpacing: 2, fontWeight: 700 }}>ARIA</h1>
        <p style={{ color: "#a3a3a3", fontSize: 16 }}>Starting up...</p>
        {healthState === "checking" && <Spinner size="sm" color="secondary" />}
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a3a3a3", fontSize: 13 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              display: "inline-block",
              background: healthState === "ok" ? "#22c55e" : "#ef4444",
              boxShadow:
                healthState === "ok"
                  ? "0 0 12px rgba(34, 197, 94, 0.6)"
                  : "0 0 12px rgba(239, 68, 68, 0.6)",
            }}
          />
          <span>{healthState === "ok" ? "Backend connected" : "Backend unavailable"}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  if (window.location.hash === "#/panel") return <SidePanel />;
  if (window.location.hash === "#/toast") return <NudgeToast />;
  return <HomeScreen />;
}
