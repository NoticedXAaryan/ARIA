import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chip } from "@heroui/react";
import { CheckCircle2, Timer, X, Sparkles } from "lucide-react";

export default function TrayPopup({ nudge, onExpand, onFeedback }) {
  const [timeLeft, setTimeLeft] = useState(12);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!nudge) return;
    setTimeLeft(12);
    timerRef.current = setInterval(() => {
      setTimeLeft(p => { if (p <= 1) { clearInterval(timerRef.current); onFeedback?.(nudge.id, "ignored"); return 0; } return p - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [nudge]);

  if (!nudge) return null;
  const u = nudge.urgency || 0;
  const bc = u >= 0.7 ? "var(--aria-danger)" : u >= 0.4 ? "var(--aria-warning)" : "var(--aria-success)";

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.25 }}
        style={{ position: "fixed", bottom: 16, right: 16, width: 360, zIndex: 9999, cursor: "pointer" }} onClick={() => onExpand?.(nudge)}>
        <div className="glass-strong glow-accent" style={{ borderRadius: 14, borderLeft: `3px solid ${bc}`, padding: "12px 14px 8px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--aria-accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={16} color="var(--aria-accent-light)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--aria-accent-light)" }}>ARIA</span>
                <Chip size="sm" variant="flat" color={u >= 0.7 ? "danger" : u >= 0.4 ? "warning" : "success"}>{u >= 0.7 ? "Urgent" : u >= 0.4 ? "Medium" : "Low"}</Chip>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{nudge.text}</p>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {[{ icon: CheckCircle2, a: "accepted", c: "#22c55e" }, { icon: Timer, a: "snoozed", c: "var(--aria-text-muted)" }, { icon: X, a: "dismissed", c: "var(--aria-text-muted)" }].map(b => (
                <button key={b.a} onClick={e => { e.stopPropagation(); onFeedback?.(nudge.id, b.a); }}
                  style={{ width: 28, height: 28, borderRadius: 6, background: "none", border: "none", color: b.c, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <b.icon size={14} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: "var(--aria-surface-2)" }}>
            <motion.div initial={{ width: "100%" }} animate={{ width: `${(timeLeft / 12) * 100}%` }} transition={{ duration: 1, ease: "linear" }}
              style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, var(--aria-accent), var(--aria-gradient-end))" }} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
