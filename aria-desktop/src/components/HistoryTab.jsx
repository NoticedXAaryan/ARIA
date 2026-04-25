import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Chip, Spinner } from "@heroui/react";
import { History, CheckCircle2, XCircle, Timer, AlertCircle, Clock } from "lucide-react";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

const OUTCOME_CFG = {
  accepted: { color: "success", icon: CheckCircle2, label: "Accepted" },
  dismissed: { color: "danger", icon: XCircle, label: "Dismissed" },
  snoozed: { color: "warning", icon: Timer, label: "Snoozed" },
  ignored: { color: "default", icon: AlertCircle, label: "Ignored" },
  expired: { color: "default", icon: Clock, label: "Expired" },
};

export default function HistoryTab() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/api/nudges/history?page=${page}`);
        if (r.ok) { const d = await r.json(); setItems(d.items || []); }
      } catch {}
      setLoading(false);
    })();
  }, [page]);

  const filtered = filter === "all" ? items : items.filter(i => i.outcome === filter);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size="lg" /></div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <History size={18} color="var(--aria-accent-light)" />
        <span style={{ fontSize: 16, fontWeight: 600 }}>Suggestion History</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["all", "accepted", "dismissed", "snoozed", "ignored", "expired"].map(f => (
          <Chip key={f} size="sm" variant={filter === f ? "solid" : "flat"} color={filter === f ? "secondary" : "default"}
            style={{ cursor: "pointer", textTransform: "capitalize" }} onClick={() => setFilter(f)}>{f}</Chip>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="glass" style={{ borderRadius: 16, padding: "40px 20px", textAlign: "center" }}>
          <History size={32} style={{ margin: "0 auto 12px", opacity: 0.3, color: "var(--aria-text-muted)" }} />
          <p style={{ fontSize: 14, color: "var(--aria-text-muted)" }}>No history yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((item, i) => {
            const oc = OUTCOME_CFG[item.outcome] || OUTCOME_CFG.ignored;
            const Icon = oc.icon;
            const time = item.generated_at ? new Date(item.generated_at * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "--";
            const urgency = item.urgency_score || 0;
            return (
              <motion.div key={item.id || i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="glass card-hover" style={{ borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${urgency >= 0.7 ? "rgba(239,68,68,0.1)" : urgency >= 0.4 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={16} color={oc.color === "success" ? "#22c55e" : oc.color === "danger" ? "#ef4444" : oc.color === "warning" ? "#f59e0b" : "var(--aria-text-muted)"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.suggestion_text}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>{time}</span>
                      <span style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>•</span>
                      <span style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>Score: {(urgency * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <Chip size="sm" color={oc.color} variant="flat">{oc.label}</Chip>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ padding: "6px 14px", borderRadius: 8, background: "var(--aria-surface-2)", border: "none", color: "var(--aria-text)", cursor: "pointer", fontSize: 12 }}>← Prev</button>
          <span style={{ padding: "6px 12px", fontSize: 12, color: "var(--aria-text-muted)" }}>Page {page}</span>
          <button onClick={() => setPage(p => p + 1)}
            style={{ padding: "6px 14px", borderRadius: 8, background: "var(--aria-surface-2)", border: "none", color: "var(--aria-text)", cursor: "pointer", fontSize: 12 }}>Next →</button>
        </div>
      )}
    </div>
  );
}
