import React, { useState, useEffect } from "react";
import { Card, CardBody, ButtonGroup, Button, Spinner } from "@heroui/react";
import { BarChart3, Target, CheckCircle2, Database } from "lucide-react";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BUCKET_LABELS = {
  "6": "6am", "9": "9am", "11": "11am", "13": "1pm",
  "15": "3pm", "17": "5pm", "19": "7pm", "22": "10pm"
};
const BUCKETS = ["6", "9", "11", "13", "15", "17", "19", "22"];

function getBarColor(weight) {
  if (weight > 0.7) return "#22c55e";
  if (weight >= 0.4) return "#f59e0b";
  return "rgba(255,255,255,0.15)";
}

function getBarLabel(weight) {
  if (weight > 0.7) return "focus";
  if (weight >= 0.5) return "meetings";
  if (weight >= 0.3) return "moderate";
  if (weight > 0) return "low";
  return "—";
}

function RhythmChart({ weights }) {
  const chartHeight = 120;
  const barWidth = 24;
  const gap = 8;
  const totalWidth = BUCKETS.length * (barWidth + gap);

  return (
    <div style={{ overflowX: "auto", padding: "8px 0" }}>
      <svg width={totalWidth + 16} height={chartHeight + 40} style={{ display: "block", margin: "0 auto" }}>
        {BUCKETS.map((bucket, i) => {
          const w = weights[bucket] || 0;
          const barH = Math.max(w * chartHeight, 2);
          const x = i * (barWidth + gap) + 8;
          const y = chartHeight - barH;
          const color = getBarColor(w);

          return (
            <g key={bucket}>
              {/* Bar background */}
              <rect x={x} y={0} width={barWidth} height={chartHeight} rx={4} fill="rgba(255,255,255,0.04)" />
              {/* Active bar */}
              <rect x={x} y={y} width={barWidth} height={barH} rx={4} fill={color} style={{ transition: "all 0.3s ease" }}>
                <animate attributeName="height" from="0" to={barH} dur="0.5s" fill="freeze" />
                <animate attributeName="y" from={chartHeight} to={y} dur="0.5s" fill="freeze" />
              </rect>
              {/* Time label */}
              <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" fontSize={10} fill="var(--aria-text-muted)">
                {BUCKET_LABELS[bucket]}
              </text>
              {/* Activity label */}
              <text x={x + barWidth / 2} y={chartHeight + 28} textAnchor="middle" fontSize={9} fill={color} fontWeight={500}>
                {getBarLabel(w)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 12px",
      textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6
    }}>
      <div style={{ color }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--aria-text-muted)", lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

export default function PatternsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // JS Sunday=0 → our 6

  useEffect(() => {
    fetch(`${API}/api/patterns/rhythm`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner color="secondary" /></div>;
  }

  const rhythm = data?.rhythm || {};
  const stats = data?.stats || {};
  const dayWeights = rhythm[String(selectedDay)] || {};

  // Best focus time for selected day
  let bestHour = "—";
  let bestWeight = 0;
  for (const [bucket, w] of Object.entries(dayWeights)) {
    if (w > bestWeight) {
      bestWeight = w;
      bestHour = BUCKET_LABELS[bucket] || bucket;
    }
  }

  return (
    <div style={{ padding: "20px 16px", color: "var(--aria-text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <BarChart3 size={16} color="var(--aria-secondary)" />
        <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--aria-text-muted)", margin: 0 }}>
          Your Rhythm
        </h3>
      </div>

      {/* Day selector */}
      <div style={{ marginBottom: 16 }}>
        <ButtonGroup size="sm" variant="flat">
          {DAY_LABELS.map((label, i) => (
            <Button
              key={i}
              color={selectedDay === i ? "secondary" : "default"}
              variant={selectedDay === i ? "solid" : "flat"}
              onPress={() => setSelectedDay(i)}
              style={{ minWidth: 32, fontSize: 12 }}
            >
              {label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {/* Chart */}
      <Card className="glass" style={{ border: "1px solid var(--aria-border)", marginBottom: 16 }}>
        <CardBody style={{ padding: 12 }}>
          <RhythmChart weights={dayWeights} />
        </CardBody>
      </Card>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <StatCard
          icon={<Target size={18} />}
          label="Best focus time"
          value={bestHour}
          color="#22c55e"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Nudge accuracy"
          value={`${stats.nudge_accuracy || 0}%`}
          color="var(--aria-primary)"
        />
        <StatCard
          icon={<Database size={18} />}
          label="Days of data"
          value={stats.days_of_data || 0}
          color="var(--aria-secondary)"
        />
      </div>

      {/* Footer note */}
      <p style={{ fontSize: 11, color: "var(--aria-text-muted)", textAlign: "center", fontStyle: "italic" }}>
        Based on {stats.days_of_data || 0} days of data. Model updates nightly.
      </p>
    </div>
  );
}
