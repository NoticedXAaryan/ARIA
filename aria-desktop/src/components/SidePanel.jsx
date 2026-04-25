import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardContent, Button, Badge, Chip, ProgressBar, Tabs, Tab, Separator } from "@heroui/react";
import { Sparkles, X, Timer, CheckCircle2, ChevronLeft, ArrowUpRight, Reply } from "lucide-react";
import { usePanelStore } from "../store/panelStore";
import ActionsTab from "./ActionsTab";
import SettingsTab from "./SettingsTab";
import UpcomingTab from "./UpcomingTab";
import PatternsTab from "./PatternsTab";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

// 12-Second Countdown Toast
function NudgeToast({ nudge, onAction, onExpand }) {
  const [timeLeft, setTimeLeft] = useState(12);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(timer);
          onAction(nudge.id, "ignored");
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [nudge.id, onAction]);

  const progress = (timeLeft / 12) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        position: "fixed",
        bottom: 24,
        right: 64, // Just outside the 52px strip
        width: 320,
        zIndex: 9999,
      }}
    >
      <Card className="glass-strong" style={{ border: "1px solid var(--aria-border)" }}>
        <div style={{ position: "relative", cursor: "pointer" }} onClick={onExpand}>
          <ProgressBar size="sm" value={progress} color="secondary" style={{ position: "absolute", top: 0, left: 0, right: 0 }} aria-label="Countdown" />
          <CardContent style={{ padding: 16, paddingTop: 20 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--aria-warning)", marginTop: 6 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{nudge.text}</p>
                <p style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>{nudge.reason || "Suggested based on your current context"}</p>
              </div>
            </div>
          </CardContent>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "0 16px 16px 16px" }}>
          <Button size="sm" color="success" variant="flat" onPress={() => onAction(nudge.id, "accepted")} startContent={<CheckCircle2 size={14} />}>Accept</Button>
          <Button size="sm" variant="flat" onPress={() => onAction(nudge.id, "snoozed")} startContent={<Timer size={14} />}>Snooze</Button>
          <Button size="sm" variant="light" onPress={() => onAction(nudge.id, "dismissed")} isIconOnly><X size={14} /></Button>
        </div>
      </Card>
    </motion.div>
  );
}

// Nudge Card in Today Tab
function PanelNudgeCard({ nudge, onAction, onReply }) {
  const urgency = nudge.urgency || 0;
  let urgencyColor = "default";
  let urgencyLabel = "Low";
  if (urgency >= 0.7) { urgencyColor = "danger"; urgencyLabel = "Urgent"; }
  else if (urgency >= 0.4) { urgencyColor = "primary"; urgencyLabel = "Queued"; }

  const isEmail = (nudge.text || "").toLowerCase().includes("email") || (nudge.text || "").toLowerCase().includes("reply");

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, scale: 0.95, height: 0 }} transition={{ duration: 0.2 }}>
      <Card className="glass" style={{ marginBottom: 12, border: "1px solid var(--aria-border)" }}>
        <CardContent style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <h4 style={{ fontSize: 14, fontWeight: 500, margin: 0, flex: 1 }}>{nudge.text}</h4>
            <Badge color={urgencyColor} variant="flat" size="sm">{urgencyLabel}</Badge>
          </div>
          <p style={{ fontSize: 12, color: "var(--aria-text-muted)", marginBottom: 12 }}>
            {nudge.reason || "Relevant to your current workflow."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" color="primary" variant="solid" onPress={() => onAction(nudge.id, "accepted")} style={{ flex: 1 }}>Do it</Button>
            {isEmail && <Button size="sm" color="secondary" variant="flat" onPress={() => onReply(nudge)} startContent={<Reply size={14} />}>Reply</Button>}
            <Button size="sm" variant="flat" onPress={() => onAction(nudge.id, "snoozed")}>Snooze 30m</Button>
            <Button size="sm" variant="light" isIconOnly onPress={() => onAction(nudge.id, "dismissed")}><X size={16} /></Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SidePanel() {
  const { isExpanded, currentTab, nudges, status, setExpanded, setCurrentTab, setNudges, removeNudge, setStatus, setComposeContext } = usePanelStore();
  const [doneToday, setDoneToday] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const [toastNudge, setToastNudge] = useState(null);

  // Polling
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nRes, sRes] = await Promise.all([
          fetch(`${API}/api/nudges/active`),
          fetch(`${API}/api/status`)
        ]);
        if (nRes.ok) {
          const newNudges = await nRes.json();
          setNudges(newNudges);
          
          // Trigger toast for the newest nudge if collapsed
          if (!usePanelStore.getState().isExpanded && newNudges.length > 0) {
            // Find a nudge we haven't toasted yet (simplified: just take the first one if we aren't showing one)
            setToastNudge(prev => prev ? prev : newNudges[0]);
          }
        }
        if (sRes.ok) {
          setStatus(await sRes.json());
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [setNudges, setStatus]);

  // Fetch done nudges when expanded
  useEffect(() => {
    if (isExpanded) {
      fetch(`${API}/api/nudges/history?page=1`)
        .then(r => r.json())
        .then(d => {
          if (d.items) {
            // Filter only resolved for today
            const resolved = d.items.filter(i => ["accepted", "dismissed"].includes(i.outcome));
            setDoneToday(resolved.slice(0, 5));
          }
        })
        .catch(() => {});
    }
  }, [isExpanded]);

  const handleAction = async (id, outcome) => {
    try {
      if (outcome === "snoozed") {
         await fetch(`${API}/api/nudges/${id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "snoozed", snoozed_minutes: 30 }) });
      } else if (outcome === "ignored") {
         await fetch(`${API}/api/nudges/${id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "ignored" }) });
      } else {
         await fetch(`${API}/api/nudges/${id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) });
      }
    } catch (err) {
      console.error(err);
    }
    removeNudge(id);
    if (toastNudge && toastNudge.id === id) setToastNudge(null);
  };

  const openDashboard = () => {
    window.open(window.location.origin, "_blank");
  };

  if (!isExpanded) {
    return (
      <>
        <div 
          onClick={() => setExpanded(true)}
          style={{
            width: 52,
            height: "100vh",
            background: "rgba(20,20,25,0.8)",
            backdropFilter: "blur(20px)",
            borderLeft: "1px solid var(--aria-border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "20px 0",
            cursor: "pointer",
            transition: "background 0.2s"
          }}
          className="hover:bg-default-100"
        >
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Sparkles size={14} color="white" />
          </div>
          
          <Badge content={nudges.length} color="warning" isInvisible={nudges.length === 0}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--aria-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: nudges.length > 0 ? "var(--aria-warning)" : "var(--aria-text-muted)" }} />
            </div>
          </Badge>
          
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {nudges.map((n, i) => (
              <div key={n.id || i} style={{ width: 6, height: 6, borderRadius: "50%", background: n.urgency >= 0.7 ? "var(--aria-danger)" : n.urgency >= 0.4 ? "var(--aria-primary)" : "var(--aria-text-muted)" }} />
            ))}
          </div>
        </div>
        
        <AnimatePresence>
          {toastNudge && (
            <NudgeToast 
              nudge={toastNudge} 
              onAction={handleAction} 
              onExpand={() => { setExpanded(true); setToastNudge(null); }} 
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Focus state bar logic
  const cognitiveState = status?.cognitive_state || "normal";
  let focusBar = null;
  if (cognitiveState === "deep_focus") {
    focusBar = <div style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "10px 16px", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} /> Focus block active</div>;
  } else if (cognitiveState === "overloaded") {
    focusBar = <div style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "10px 16px", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} /> Heavy day ahead</div>;
  }

  return (
    <div style={{
      width: 300,
      height: "100vh",
      background: "rgba(20,20,25,0.95)",
      backdropFilter: "blur(24px)",
      borderLeft: "1px solid var(--aria-border)",
      display: "flex",
      flexDirection: "column",
      boxShadow: "-10px 0 30px rgba(0,0,0,0.5)"
    }}>
      <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--aria-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Button isIconOnly variant="light" size="sm" onPress={() => setExpanded(false)}>
            <ChevronLeft size={18} />
          </Button>
          <span style={{ fontSize: 16, fontWeight: 600 }}>ARIA</span>
        </div>
        <Button isIconOnly variant="light" size="sm" onPress={openDashboard}>
          <ArrowUpRight size={16} />
        </Button>
      </div>

      <div style={{ padding: "8px 16px 0 16px" }}>
        <Tabs selectedKey={currentTab} onSelectionChange={setCurrentTab} aria-label="Panel Tabs" variant="underlined" size="sm" classNames={{ cursor: "w-full", tab: "px-2" }}>
          <Tab key="today" title="Today" />
          <Tab key="upcoming" title="Upcoming" />
          <Tab key="patterns" title="Patterns" />
          <Tab key="actions" title="Actions" />
          <Tab key="settings" title="Settings" />
        </Tabs>
      </div>

      {/* First Week Experience ProgressBar Bar */}
      {status?.days_active < 7 && (
        <div style={{ padding: "8px 16px", background: "rgba(59, 130, 246, 0.1)", borderBottom: "1px solid rgba(59, 130, 246, 0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6" }}>ARIA is learning</span>
            <span style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>Day {status.days_active || 1} of 7</span>
          </div>
          <ProgressBar size="sm" value={((status.days_active || 1) / 7) * 100} color="primary" />
        </div>
      )}
      
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {currentTab === "today" && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            {focusBar}
            
            <div style={{ padding: "20px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--aria-text-muted)" }}>Pending</h3>
                <Badge content={nudges.length} color="primary" />
              </div>
              
              <AnimatePresence>
                {nudges.map(nudge => (
                  <PanelNudgeCard key={nudge.id} nudge={nudge} onAction={handleAction} onReply={(n) => {
                    setComposeContext({ type: "email_reply", nudgeText: n.text, nudgeId: n.id });
                    setCurrentTab("actions");
                  }} />
                ))}
                {nudges.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "30px 0", textAlign: "center", color: "var(--aria-text-muted)" }}>
                    <Sparkles size={24} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                    <p style={{ fontSize: 13 }}>All clear. ARIA is watching in the background.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <Separator />
            
            <div style={{ padding: "16px" }}>
              <div 
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} 
                onClick={() => setShowDone(!showDone)}
              >
                <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--aria-text-muted)" }}>Done Today</h3>
                <span style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>{doneToday.length} {showDone ? '▲' : '▼'}</span>
              </div>
              
              <AnimatePresence>
                {showDone && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", paddingTop: 12 }}>
                    {doneToday.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>No resolved nudges today.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {doneToday.map((n, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                            {n.outcome === "accepted" ? <CheckCircle2 size={14} color="#22c55e" /> : <X size={14} color="var(--aria-text-muted)" />}
                            <span style={{ fontSize: 12, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.suggestion_text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
        
        {currentTab === "upcoming" && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <UpcomingTab />
          </motion.div>
        )}

        {currentTab === "patterns" && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <PatternsTab />
          </motion.div>
        )}

        {currentTab === "actions" && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <ActionsTab />
          </motion.div>
        )}

        {currentTab === "settings" && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <SettingsTab />
          </motion.div>
        )}
      </div>
    </div>
  );
}
