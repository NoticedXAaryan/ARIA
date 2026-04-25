import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chip } from "@heroui/react";
import { X, CheckCircle2, Timer, Calendar, Brain, ChevronDown } from "lucide-react";

export default function ExpandedPanel({ nudge, onClose, onFeedback }) {
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose?.(); if (e.key === "Enter") onFeedback?.(nudge?.id, "accepted"); if (e.key.toLowerCase() === "s") onFeedback?.(nudge?.id, "snoozed"); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [nudge]);
  if (!nudge) return null;
  const u = nudge.urgency || 0;
  const ctx = nudge.context || {};
  const reasons = [ctx.starts_in_min != null && `Meeting in ${ctx.starts_in_min} min`, ctx.high_load && "Heavy meeting load", "Based on your recent activity"].filter(Boolean);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }} onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
          style={{ width: 400 }} onClick={e => e.stopPropagation()}>
          <div className="glass-strong glow-accent" style={{ borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--aria-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Chip size="sm" color={u >= 0.7 ? "danger" : u >= 0.4 ? "warning" : "success"} variant="solid">
                  ● {u >= 0.7 ? "URGENT" : u >= 0.4 ? "MEDIUM" : "LOW"}
                </Chip>
                <span style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>Score: {(u * 100).toFixed(0)}%</span>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--aria-text-muted)", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBottom: 16 }}>{nudge.text}</p>
              <div style={{ background: "var(--aria-surface-2)", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--aria-accent-light)", marginBottom: 8 }}>ARIA noticed:</p>
                {reasons.map((r, i) => <p key={i} style={{ fontSize: 12, color: "var(--aria-text-muted)", marginBottom: 3 }}>• {r}</p>)}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                <Chip size="sm" variant="flat" color="primary"><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> Calendar</span></Chip>
                <Chip size="sm" variant="flat" color="secondary"><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Brain size={12} /> {ctx.cognitive_state || "Normal"}</span></Chip>
              </div>
              <div style={{ height: 1, background: "var(--aria-border)", margin: "0 0 16px" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onFeedback?.(nudge.id, "accepted")}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: "#22c55e", border: "none", color: "white", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <CheckCircle2 size={16} /> Accept
                </button>
                <button onClick={() => onFeedback?.(nudge.id, "snoozed")}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: "transparent", border: "1px solid var(--aria-border)", color: "var(--aria-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Timer size={16} /> Snooze
                </button>
                <button onClick={() => onFeedback?.(nudge.id, "dismissed")}
                  style={{ height: 44, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", cursor: "pointer", padding: "0 16px", display: "flex", alignItems: "center", gap: 6 }}>
                  <X size={16} /> Dismiss
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--aria-text-muted)", textAlign: "center", marginTop: 12 }}>↵ Accept • Esc Dismiss • S Snooze</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
