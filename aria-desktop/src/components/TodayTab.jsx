import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Chip, Spinner } from "@heroui/react";
import { Clock, Calendar, CheckCircle2, X, Timer, Brain, Zap, Sparkles } from "lucide-react";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

function ScheduleTimeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "30px 0", color: "var(--aria-text-muted)" }}>
        <Calendar size={32} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
        <p style={{ fontSize: 13 }}>No events scheduled today</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {events.slice(0, 8).map((event, i) => {
        const time = event.start_ts ? new Date(event.start_ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
        const now = Date.now() / 1000;
        const isActive = event.start_ts <= now && (event.end_ts || event.start_ts + 3600) >= now;
        const isUpcoming = event.start_ts > now && event.start_ts - now < 1800;
        return (
          <motion.div key={event.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12,
              background: isActive ? "rgba(99,102,241,0.1)" : isUpcoming ? "rgba(245,158,11,0.05)" : "transparent",
              borderLeft: isActive ? "3px solid var(--aria-accent)" : isUpcoming ? "3px solid var(--aria-warning)" : "3px solid transparent" }}>
            <span style={{ fontSize: 12, color: "var(--aria-text-muted)", fontFamily: "monospace", minWidth: 50 }}>{time}</span>
            <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 500 }}>{event.title || "Untitled"}</p></div>
            {isActive && <Chip size="sm" color="primary" variant="flat">Now</Chip>}
            {isUpcoming && !isActive && <Chip size="sm" color="warning" variant="flat">Soon</Chip>}
          </motion.div>
        );
      })}
    </div>
  );
}

function NudgeCard({ nudge, onFeedback }) {
  const urgency = nudge.urgency || 0;
  const urgencyClass = urgency >= 0.7 ? "urgency-high" : urgency >= 0.4 ? "urgency-medium" : "urgency-low";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`glass card-hover ${urgencyClass}`} style={{ borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ marginBottom: 6 }}>
        <Chip size="sm" color={urgency >= 0.7 ? "danger" : urgency >= 0.4 ? "warning" : "success"} variant="flat">
          {urgency >= 0.7 ? "Urgent" : urgency >= 0.4 ? "Medium" : "Low"}
        </Chip>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.5 }}>{nudge.text}</p>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {[{ label: "Accept", action: "accepted", icon: CheckCircle2, color: "#22c55e" },
          { label: "Snooze", action: "snoozed", icon: Timer, color: "var(--aria-text-muted)" },
          { label: "Dismiss", action: "dismissed", icon: X, color: "var(--aria-text-muted)" }
        ].map(a => (
          <button key={a.action} onClick={() => onFeedback(nudge.id, a.action)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, background: "var(--aria-surface-2)", border: "none", color: a.color, cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
            <a.icon size={14} /> {a.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function TodayTab({ status }) {
  const [schedule, setSchedule] = useState([]);
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, n] = await Promise.all([
          fetch(`${API}/api/schedule/today`).then(r => r.json()).catch(() => []),
          fetch(`${API}/api/nudges/active`).then(r => r.json()).catch(() => []),
        ]);
        setSchedule(Array.isArray(s) ? s : []);
        setNudges(Array.isArray(n) ? n : []);
      } catch {}
      setLoading(false);
    })();
    const iv = setInterval(async () => {
      try {
        const n = await fetch(`${API}/api/nudges/active`).then(r => r.json()).catch(() => []);
        setNudges(Array.isArray(n) ? n : []);
      } catch {}
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const handleFeedback = async (id, outcome) => {
    try { await fetch(`${API}/api/nudges/${id}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) }); } catch {}
    setNudges(prev => prev.filter(n => n.id !== id));
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size="lg" /></div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 1000 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {status && (
          <div className="glass" style={{ borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Brain size={18} color="var(--aria-accent-light)" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>ARIA Status</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="glass" style={{ padding: "10px 14px", borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>State</p>
                <p style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{status.cognitive_state?.replace("_", " ") || "Normal"}</p>
              </div>
              <div className="glass" style={{ padding: "10px 14px", borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>Next Eval</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{status.next_eval_minutes || 15} min</p>
              </div>
            </div>
          </div>
        )}
        <div className="glass" style={{ borderRadius: 16, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Calendar size={18} color="var(--aria-accent-light)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Today's Schedule</span>
            <Chip size="sm" variant="flat" style={{ marginLeft: "auto", background: "var(--aria-surface-2)" }}>{schedule.length} events</Chip>
          </div>
          <ScheduleTimeline events={schedule} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <Zap size={18} color="var(--aria-accent-light)" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Active Suggestions</span>
          {nudges.length > 0 && <Chip size="sm" color="secondary" variant="flat">{nudges.length}</Chip>}
        </div>
        {nudges.length === 0 ? (
          <div className="glass" style={{ borderRadius: 16, padding: "40px 20px", textAlign: "center" }}>
            <Sparkles size={32} style={{ margin: "0 auto 12px", opacity: 0.3, color: "var(--aria-text-muted)" }} />
            <p style={{ fontSize: 14, color: "var(--aria-text-muted)" }}>No active suggestions</p>
            <p style={{ fontSize: 12, color: "var(--aria-text-muted)", opacity: 0.6, marginTop: 4 }}>ARIA is watching and learning your patterns</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nudges.map(n => <NudgeCard key={n.id} nudge={n} onFeedback={handleFeedback} />)}
          </div>
        )}
      </div>
    </div>
  );
}
