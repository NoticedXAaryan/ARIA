import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Chip, Avatar, Spinner, Tabs, TabList, Tab, TabPanel, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { LayoutDashboard, History, BarChart3, Settings, LogOut, Sparkles, Brain, RefreshCw } from "lucide-react";
import TodayTab from "./TodayTab";
import HistoryTab from "./HistoryTab";
import HabitsTab from "./HabitsTab";
import SettingsTab from "./SettingsTab";
import { useAuth } from "../context/AuthContext";
import { logout } from "../lib/firebase";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("today");
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    try {
      const r = await fetch(`${API}/api/status`);
      if (r.ok) setStatus(await r.json());
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 30000);
    return () => clearInterval(iv);
  }, []);

  const triggerEval = async () => {
    setRefreshing(true);
    try { await fetch(`${API}/api/eval/trigger`, { method: "POST" }); await fetchStatus(); } catch {}
    setRefreshing(false);
  };

  const cognitiveColors = {
    deep_focus: { bg: "rgba(99,102,241,0.15)", text: "#818cf8", label: "Deep Focus" },
    flow: { bg: "rgba(6,182,212,0.15)", text: "#22d3ee", label: "Flow State" },
    normal: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", label: "Normal" },
    overloaded: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", label: "Overloaded" },
  };
  const cs = cognitiveColors[status?.cognitive_state] || cognitiveColors.normal;

  const TABS = [
    { key: "today", label: "Today", icon: LayoutDashboard },
    { key: "history", label: "History", icon: History },
    { key: "habits", label: "Habits", icon: BarChart3 },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--aria-bg)", overflow: "hidden" }}>
      {/* Top Bar */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong"
        style={{ padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--aria-border)", zIndex: 50, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.2 }} className="gradient-text">ARIA</h1>
            <p style={{ fontSize: 10, color: "var(--aria-text-muted)", margin: 0 }}>Anticipatory Intelligence</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Chip size="sm" variant="flat" style={{ background: cs.bg, color: cs.text }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Brain size={12} /> {cs.label}</span>
          </Chip>
          <button onClick={triggerEval} disabled={refreshing}
            style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "1px solid var(--aria-border)", color: "var(--aria-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {refreshing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--aria-surface-2)", border: "2px solid var(--aria-border)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {user?.photoURL ? <img src={user.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 13, fontWeight: 600 }}>{(user?.displayName || user?.email || "U")[0].toUpperCase()}</span>}
            </div>
            <button onClick={logout} title="Sign Out"
              style={{ width: 28, height: 28, borderRadius: 6, background: "transparent", border: "none", color: "var(--aria-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Tab Selector */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--aria-border)", background: "transparent", paddingLeft: 24, flexShrink: 0 }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: isActive ? "2px solid var(--aria-accent)" : "2px solid transparent", color: isActive ? "var(--aria-accent-light)" : "var(--aria-text-muted)", cursor: "pointer", fontSize: 13, fontWeight: isActive ? 600 : 400, transition: "all 0.2s" }}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {tab === "today" && <TodayTab status={status} />}
          {tab === "history" && <HistoryTab />}
          {tab === "habits" && <HabitsTab />}
          {tab === "settings" && <SettingsTab />}
        </motion.div>
      </div>
    </div>
  );
}
