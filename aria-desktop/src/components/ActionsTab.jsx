import React, { useState, useEffect } from "react";
import {
  Card, CardBody, Button, Input, Textarea, Divider, Spinner, Chip
} from "@heroui/react";
import {
  Send, Calendar, StickyNote, Trash2, CheckCircle2, Sparkles
} from "lucide-react";
import { usePanelStore } from "../store/panelStore";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

// ─── Quick Reply Composer ───
function EmailComposer({ context, onDone }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");

  useEffect(() => {
    // Fetch accounts for the send dropdown
    fetch(`${API}/api/accounts`)
      .then(r => r.json())
      .then(accs => {
        setAccounts(accs);
        const gmail = accs.find(a => a.provider === "google");
        const outlook = accs.find(a => a.provider === "outlook");
        if (gmail) setSelectedAccount(gmail.id);
        else if (outlook) setSelectedAccount(outlook.id);
      })
      .catch(() => {});

    // Draft the reply via LLM
    fetch(`${API}/api/compose/email_draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: context.nudgeText || "" })
    })
      .then(r => r.json())
      .then(data => {
        setBody(data.draft || "");
        // Try to extract subject from nudge context
        const nudgeText = context.nudgeText || "";
        if (nudgeText.toLowerCase().includes("re:")) {
          const match = nudgeText.match(/re:\s*(.+)/i);
          if (match) setSubject(`Re: ${match[1].substring(0, 60)}`);
        }
        if (!subject) setSubject("Re: (fill in subject)");
        setLoading(false);
      })
      .catch(() => {
        setBody("(Could not generate draft — write your reply here)");
        setLoading(false);
      });
  }, []);

  const handleSend = async () => {
    if (!selectedAccount || !to || !body) return;
    setSending(true);
    try {
      await fetch(`${API}/api/actions/send_email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: selectedAccount, to, subject, body })
      });
      setSent(true);
      setTimeout(() => onDone(), 1500);
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <CheckCircle2 size={32} color="#22c55e" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, fontWeight: 500, color: "#22c55e" }}>Email sent!</p>
      </div>
    );
  }

  return (
    <Card className="glass" style={{ border: "1px solid var(--aria-border)" }}>
      <CardBody style={{ gap: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Send size={16} color="var(--aria-primary)" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Quick Reply</span>
          {loading && <Spinner size="sm" color="secondary" />}
        </div>

        {accounts.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            {accounts.filter(a => a.provider === "google" || a.provider === "outlook").map(a => (
              <Chip
                key={a.id}
                size="sm"
                variant={selectedAccount === a.id ? "solid" : "flat"}
                color={selectedAccount === a.id ? "secondary" : "default"}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedAccount(a.id)}
              >
                {a.email}
              </Chip>
            ))}
          </div>
        )}

        <Input size="sm" label="To" value={to} onValueChange={setTo} placeholder="recipient@example.com" />
        <Input size="sm" label="Subject" value={subject} onValueChange={setSubject} />
        <Textarea
          size="sm"
          label="Body"
          value={body}
          onValueChange={setBody}
          minRows={4}
          maxRows={8}
          placeholder="Composing draft..."
          isDisabled={loading}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button size="sm" variant="flat" onPress={onDone} startContent={<Trash2 size={14} />}>Discard</Button>
          <Button size="sm" color="primary" onPress={handleSend} isLoading={sending} startContent={<Send size={14} />}>Send</Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Event Preview Card ───
function EventPreview({ parsed, onConfirm, onDiscard }) {
  const [title, setTitle] = useState(parsed.title || "");
  const [date, setDate] = useState(parsed.date || "");
  const [time, setTime] = useState(parsed.time || "");
  const [duration, setDuration] = useState(parsed.duration_minutes || 30);
  const [attendees, setAttendees] = useState((parsed.attendees || []).join(", "));
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");

  useEffect(() => {
    fetch(`${API}/api/accounts`)
      .then(r => r.json())
      .then(accs => {
        setAccounts(accs);
        const cal = accs.find(a => a.provider === "google") || accs[0];
        if (cal) setSelectedAccount(cal.id);
      })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!selectedAccount || !title || !date || !time) return;
    setCreating(true);
    try {
      const startIso = `${date}T${time}`;
      const endDate = new Date(`${date}T${time}`);
      endDate.setMinutes(endDate.getMinutes() + parseInt(duration));
      const endIso = endDate.toISOString().slice(0, 19);

      await fetch(`${API}/api/actions/create_event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: selectedAccount,
          title,
          start_iso: startIso,
          end_iso: endIso,
          attendees: attendees.split(",").map(a => a.trim()).filter(Boolean)
        })
      });
      setCreated(true);
      setTimeout(() => onDiscard(), 1500);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  };

  if (created) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <CheckCircle2 size={32} color="#22c55e" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, fontWeight: 500, color: "#22c55e" }}>Event created!</p>
      </div>
    );
  }

  return (
    <Card className="glass" style={{ border: "1px solid var(--aria-border)" }}>
      <CardBody style={{ gap: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Calendar size={16} color="var(--aria-secondary)" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>New Event</span>
        </div>

        {accounts.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
            {accounts.map(a => (
              <Chip key={a.id} size="sm" variant={selectedAccount === a.id ? "solid" : "flat"} color={selectedAccount === a.id ? "secondary" : "default"} style={{ cursor: "pointer" }} onClick={() => setSelectedAccount(a.id)}>
                {a.email}
              </Chip>
            ))}
          </div>
        )}

        <Input size="sm" label="Title" value={title} onValueChange={setTitle} />
        <div style={{ display: "flex", gap: 8 }}>
          <Input size="sm" label="Date" type="date" value={date} onValueChange={setDate} />
          <Input size="sm" label="Time" type="time" value={time} onValueChange={setTime} />
        </div>
        <Input size="sm" label="Duration (min)" type="number" value={String(duration)} onValueChange={(v) => setDuration(parseInt(v) || 30)} />
        <Input size="sm" label="Attendees (comma separated)" value={attendees} onValueChange={setAttendees} />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button size="sm" variant="flat" onPress={onDiscard} startContent={<Trash2 size={14} />}>Discard</Button>
          <Button size="sm" color="success" onPress={handleCreate} isLoading={creating} startContent={<Calendar size={14} />}>Create Event</Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Note Preview Card ───
function NotePreview({ parsed, onDiscard }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const title = parsed.title || "";
    const body = parsed.body || "";
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setContent(`## ${now} ${title}\n${body}`);
  }, [parsed]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/actions/add_note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      setSaved(true);
      setTimeout(() => onDiscard(), 1500);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (saved) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <CheckCircle2 size={32} color="#22c55e" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, fontWeight: 500, color: "#22c55e" }}>Note saved!</p>
      </div>
    );
  }

  return (
    <Card className="glass" style={{ border: "1px solid var(--aria-border)" }}>
      <CardBody style={{ gap: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <StickyNote size={16} color="var(--aria-accent)" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>New Note</span>
        </div>

        <Textarea
          size="sm"
          label="Content (Obsidian Markdown)"
          value={content}
          onValueChange={setContent}
          minRows={4}
          maxRows={10}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button size="sm" variant="flat" onPress={onDiscard} startContent={<Trash2 size={14} />}>Discard</Button>
          <Button size="sm" color="success" onPress={handleSave} isLoading={saving} startContent={<StickyNote size={14} />}>Save Note</Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Main Actions Tab ───
export default function ActionsTab() {
  const { composeContext, setComposeContext } = usePanelStore();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState(null); // "email" | "event" | "note" | null
  const [parsedData, setParsedData] = useState(null);
  const [parsing, setParsing] = useState(false);

  // If composeContext is an email reply from Today tab, auto-trigger email mode
  useEffect(() => {
    if (composeContext && composeContext.type === "email_reply") {
      setMode("email");
    }
  }, [composeContext]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;
    setParsing(true);

    try {
      if (text.toLowerCase().startsWith("note:")) {
        const res = await fetch(`${API}/api/compose/parse_note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.substring(5).trim() })
        });
        const data = await res.json();
        setParsedData(data);
        setMode("note");
      } else {
        // Assume calendar event
        const res = await fetch(`${API}/api/compose/parse_event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });
        const data = await res.json();
        setParsedData(data);
        setMode("event");
      }
    } catch (e) {
      console.error(e);
    }
    setParsing(false);
    setInput("");
  };

  const resetComposer = () => {
    setMode(null);
    setParsedData(null);
    setComposeContext(null);
  };

  return (
    <div style={{ padding: "16px", color: "var(--aria-text)" }}>
      {/* Command bar — always visible when not composing */}
      {!mode && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} color="var(--aria-primary)" />
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--aria-text-muted)" }}>Quick Actions</span>
            </div>
            <Input
              size="sm"
              placeholder='Try "Meeting with Priya tomorrow 3pm" or "Note: follow up on API"'
              value={input}
              onValueChange={setInput}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              endContent={
                parsing ? <Spinner size="sm" /> :
                <Button isIconOnly size="sm" variant="light" onPress={handleSubmit}><Send size={14} /></Button>
              }
            />
          </div>

          <Divider style={{ marginBottom: 16 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12, color: "var(--aria-text-muted)", marginBottom: 4 }}>Or start from scratch:</p>
            <Button size="sm" variant="flat" color="primary" fullWidth startContent={<Calendar size={14} />}
              onPress={() => { setParsedData({ title: "", date: "", time: "", duration_minutes: 30, attendees: [] }); setMode("event"); }}>
              Create Calendar Event
            </Button>
            <Button size="sm" variant="flat" color="secondary" fullWidth startContent={<StickyNote size={14} />}
              onPress={() => { setParsedData({ title: "", body: "" }); setMode("note"); }}>
              Add a Note
            </Button>
          </div>
        </>
      )}

      {/* Dynamic compose area */}
      {mode === "email" && composeContext && (
        <EmailComposer context={composeContext} onDone={resetComposer} />
      )}

      {mode === "event" && parsedData && (
        <EventPreview parsed={parsedData} onConfirm={() => {}} onDiscard={resetComposer} />
      )}

      {mode === "note" && parsedData && (
        <NotePreview parsed={parsedData} onDiscard={resetComposer} />
      )}
    </div>
  );
}
