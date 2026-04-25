import { useState, useEffect } from "react";
import { Chip } from "@heroui/react";
import { Settings, FolderOpen, Calendar, Mail, Bot, LogOut, Save, CheckCircle2, Key, Bell, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { logout } from "../lib/firebase";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

function Section({ icon: Icon, title, color = "var(--aria-accent-light)", children }) {
  return (
    <div className="glass" style={{ borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function SettingsTab() {
  const { resetSetup } = useAuth();
  const [s, setS] = useState({ notes_folder_path: "", max_nudges_per_day: 8, openrouter_api_key: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { (async () => { try { const r = await fetch(`${API}/api/settings`); if (r.ok) { const data = await r.json(); setS(prev => ({ ...prev, ...data })); } } catch {} })(); }, []);

  const save = async () => {
    setSaving(true);
    try { await fetch(`${API}/api/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ updates: s }) }); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch {}
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Settings size={18} color="var(--aria-accent-light)" /><span style={{ fontSize: 16, fontWeight: 600 }}>Settings</span>
      </div>

      <Section icon={Calendar} title="Connected Services" color="#4285F4">
        {[{ name: "Google Calendar", icon: Calendar, c: "#4285F4" }, { name: "Gmail", icon: Mail, c: "#EA4335" }].map(svc => (
          <div key={svc.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><svc.icon size={14} color={svc.c} /><span style={{ fontSize: 13 }}>{svc.name}</span></div>
            <Chip size="sm" color={s.google_linked ? "success" : "warning"} variant="flat">{s.google_linked ? "Connected" : "Not linked"}</Chip>
          </div>
        ))}
      </Section>

      <Section icon={FolderOpen} title="Notes Folder" color="#a855f7">
        <input value={s.notes_folder_path || ""} onChange={e => setS(p => ({ ...p, notes_folder_path: e.target.value }))} placeholder="C:\Users\you\Documents\Notes"
          style={{ width: "100%", height: 40, borderRadius: 10, background: "var(--aria-surface)", border: "1px solid var(--aria-border)", color: "var(--aria-text)", fontSize: 13, padding: "0 14px", outline: "none" }}
          onFocus={e => e.target.style.borderColor = "var(--aria-accent)"} onBlur={e => e.target.style.borderColor = "var(--aria-border)"} />
      </Section>

      <Section icon={Bot} title="AI Configuration" color="#6366f1">
        <input type="password" value={s.openrouter_api_key || ""} onChange={e => setS(p => ({ ...p, openrouter_api_key: e.target.value }))} placeholder="sk-or-v1-..."
          style={{ width: "100%", height: 40, borderRadius: 10, background: "var(--aria-surface)", border: "1px solid var(--aria-border)", color: "var(--aria-text)", fontSize: 13, padding: "0 14px", outline: "none" }}
          onFocus={e => e.target.style.borderColor = "var(--aria-accent)"} onBlur={e => e.target.style.borderColor = "var(--aria-border)"} />
      </Section>

      <Section icon={Bell} title="Notifications" color="#f59e0b">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>Max nudges/day: {s.max_nudges_per_day}</span>
          <input type="range" min={1} max={20} value={s.max_nudges_per_day} onChange={e => setS(p => ({ ...p, max_nudges_per_day: Number(e.target.value) }))} style={{ width: 120, accentColor: "var(--aria-accent)" }} />
        </div>
      </Section>

      <button onClick={save} disabled={saving}
        style={{ width: "100%", height: 44, borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: saved ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))", color: saved ? "#22c55e" : "white" }}>
        {saved ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> {saving ? "Saving..." : "Save Settings"}</>}
      </button>

      <Section icon={LogOut} title="Account" color="#ef4444">
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={resetSetup} style={{ flex: 1, height: 36, borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <RefreshCw size={12} /> Re-run Setup
          </button>
          <button onClick={logout} style={{ flex: 1, height: 36, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </Section>
    </div>
  );
}
