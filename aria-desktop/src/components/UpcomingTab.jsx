import React, { useState, useEffect } from "react";
import { Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Clock, Users, ExternalLink, Sparkles, Timer } from "lucide-react";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function durationLabel(startTs, endTs) {
  if (!startTs || !endTs) return "";
  const mins = Math.round((endTs - startTs) / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function eventTypeChip(type, metadata) {
  const attendees = metadata?.attendee_count || metadata?.attendees?.length || 0;
  if (type === "meeting" && attendees > 0) return { color: "primary", label: "Meeting" };
  if (type === "focus" || type === "deep_focus") return { color: "success", label: "Focus" };
  if (type === "deadline" || type === "task") return { color: "warning", label: "Deadline" };
  return { color: "default", label: type || "Event" };
}

function TimelineEvent({ event }) {
  const meta = event.metadata || {};
  const chip = eventTypeChip(event.type, meta);
  const attendees = meta.attendee_count || 0;
  const meetingLink = meta.hangoutLink || meta.meeting_link || null;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* Time gutter */}
      <div style={{ width: 48, flexShrink: 0, textAlign: "right", paddingTop: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--aria-text-muted)" }}>
          {formatTime(event.start_ts)}
        </span>
      </div>

      {/* Vertical connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: `var(--heroui-${chip.color})`, border: "2px solid var(--aria-bg-dark)", flexShrink: 0, marginTop: 14 }} />
        <div style={{ width: 2, flex: 1, background: "var(--aria-border)", minHeight: 20 }} />
      </div>

      {/* Event card */}
      <Card className="glass" style={{ flex: 1, border: "1px solid var(--aria-border)", marginBottom: 4 }}>
        <CardBody style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <h4 style={{ fontSize: 13, fontWeight: 500, margin: 0, flex: 1, lineHeight: 1.4 }}>{event.title || "Untitled"}</h4>
            <Chip size="sm" color={chip.color} variant="flat">{chip.label}</Chip>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--aria-text-muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} /> {durationLabel(event.start_ts, event.end_ts)}
            </span>
            {attendees > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={11} /> {attendees}
              </span>
            )}
            {meetingLink && (
              <a href={meetingLink} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--aria-primary)", textDecoration: "none" }}>
                <ExternalLink size={11} /> Join
              </a>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function TimelineAnnotation({ annotation }) {
  const isSnoozed = annotation.type === "snoozed_nudge";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 48, flexShrink: 0, textAlign: "right", paddingTop: 6 }}>
        <span style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>
          {formatTime(annotation.ts)}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: isSnoozed ? "var(--aria-warning)" : "var(--aria-primary)",
          opacity: 0.6, marginTop: 8
        }} />
        <div style={{ width: 2, flex: 1, background: "var(--aria-border)", minHeight: 12 }} />
      </div>

      <div style={{ flex: 1, padding: "4px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
        {isSnoozed ? <Timer size={12} color="var(--aria-warning)" /> : <Sparkles size={12} color="var(--aria-primary)" />}
        <span style={{ fontSize: 12, color: "var(--aria-text-muted)", fontStyle: "italic" }}>
          {annotation.text}
        </span>
      </div>
    </div>
  );
}

export default function UpcomingTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLookahead = async () => {
    try {
      const res = await fetch(`${API}/api/calendar/lookahead?hours=6`);
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLookahead();
    const interval = setInterval(fetchLookahead, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner color="secondary" /></div>;
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--aria-text-muted)", fontSize: 13 }}>Could not load calendar.</div>;
  }

  // Merge events and annotations by timestamp, sort chronologically
  const items = [
    ...(data.events || []).map(e => ({ ...e, _kind: "event", _ts: e.start_ts })),
    ...(data.annotations || []).map(a => ({ ...a, _kind: "annotation", _ts: a.ts })),
  ].sort((a, b) => a._ts - b._ts);

  return (
    <div style={{ padding: "20px 16px", color: "var(--aria-text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Clock size={16} color="var(--aria-primary)" />
        <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--aria-text-muted)", margin: 0 }}>
          Next 6 Hours
        </h3>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "30px 0", textAlign: "center", color: "var(--aria-text-muted)" }}>
          <Sparkles size={24} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
          <p style={{ fontSize: 13 }}>Clear schedule ahead</p>
        </div>
      ) : (
        <div>
          {items.map((item, idx) =>
            item._kind === "event"
              ? <TimelineEvent key={`ev-${item.id || idx}`} event={item} />
              : <TimelineAnnotation key={`an-${idx}`} annotation={item} />
          )}
        </div>
      )}
    </div>
  );
}
