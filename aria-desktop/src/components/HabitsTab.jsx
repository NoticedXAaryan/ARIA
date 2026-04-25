import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Chip, Spinner } from "@heroui/react";
import { BarChart3, Brain, Clock, Repeat, TrendingUp, Lightbulb } from "lucide-react";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";
const HI = { start_time: Clock, focus_block: Brain, meeting_pattern: Repeat, app_sequence: TrendingUp };
const HC = { start_time: "#6366f1", focus_block: "#06b6d4", meeting_pattern: "#f59e0b", app_sequence: "#22c55e" };

function HabitCard({ habit, index }) {
  const Icon = HI[habit.habit_type] || Lightbulb;
  const color = HC[habit.habit_type] || "#6366f1";
  const conf = Math.round((habit.confidence || 0) * 100);
  const p = habit.pattern_json || {};
  const desc = habit.habit_type === "start_time" ? `Start ${p.activity||"work"} at ${p.hour||"?"}:00` :
    habit.habit_type === "focus_block" ? `Focus sessions avg ${p.duration_min||"?"}min` :
    habit.habit_type === "meeting_pattern" ? `Meetings on ${p.day||"?"} at ${p.hour||"?"}:00` : JSON.stringify(p);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <div className="glass card-hover" style={{ borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <Chip size="sm" variant="flat" style={{ background: `${color}15`, color, textTransform: "capitalize", marginBottom: 4 }}>{habit.habit_type?.replace("_", " ")}</Chip>
          <p style={{ fontSize: 13 }}>{desc}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div style={{ width: 100, height: 4, borderRadius: 2, background: "var(--aria-surface-2)", overflow: "hidden" }}>
              <div style={{ width: `${conf}%`, height: "100%", background: conf >= 70 ? "#22c55e" : "#f59e0b" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>{conf}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function HabitsTab() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const r = await fetch(`${API}/api/habits`); if (r.ok) setHabits(await r.json()); } catch {} setLoading(false); })(); }, []);
  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size="lg" /></div>;
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <BarChart3 size={18} color="var(--aria-accent-light)" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>Learned Patterns</span>
      </div>
      {habits.length === 0 ? (
        <div className="glass" style={{ borderRadius: 16, padding: "50px 20px", textAlign: "center" }}>
          <Brain size={40} style={{ margin: "0 auto 14px", opacity: 0.3, color: "var(--aria-text-muted)" }} />
          <p style={{ fontSize: 15, fontWeight: 500 }}>Learning your patterns...</p>
          <p style={{ fontSize: 13, color: "var(--aria-text-muted)", marginTop: 6 }}>ARIA needs a few days of data.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{habits.map((h, i) => <HabitCard key={i} habit={h} index={i} />)}</div>
      )}
    </div>
  );
}
