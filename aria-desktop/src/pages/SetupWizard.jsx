import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chip } from "@heroui/react";
import {
  Sparkles, Calendar, Mail, FolderOpen, Bot,
  ChevronRight, ChevronLeft, Check, ExternalLink,
  AlertCircle, Zap, Shield, Brain, Rocket, Key,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "google", title: "Google Services", icon: Calendar },
  { id: "notes", title: "Notes", icon: FolderOpen },
  { id: "ai", title: "AI Engine", icon: Bot },
  { id: "launch", title: "Launch", icon: Rocket },
];

function StepIndicator({ currentStep }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginBottom: 32 }}>
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <motion.div
              animate={{
                background: isActive
                  ? "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))"
                  : isDone ? "var(--aria-success)" : "var(--aria-surface-2)",
                scale: isActive ? 1.1 : 1,
              }}
              style={{
                width: 36, height: 36, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: isActive ? "none" : "1px solid var(--aria-border)",
              }}
            >
              {isDone ? <Check size={16} color="white" /> : <Icon size={16} color={isActive ? "white" : "var(--aria-text-muted)"} />}
            </motion.div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 24, height: 2, borderRadius: 1, background: isDone ? "var(--aria-success)" : "var(--aria-border)", transition: "background 0.3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WelcomeStep() {
  const features = [
    { icon: Brain, title: "Learns Your Patterns", desc: "ARIA watches how you work and adapts to your rhythm" },
    { icon: Zap, title: "Proactive Nudges", desc: "Get smart suggestions before you even ask" },
    { icon: Shield, title: "Privacy First", desc: "Everything stays on your device — your data, your rules" },
  ];
  return (
    <div style={{ textAlign: "center" }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
        style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 32px rgba(99, 102, 241, 0.3)" }}>
        <Sparkles size={40} color="white" />
      </motion.div>
      <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }} className="gradient-text">Let's set up ARIA</h2>
      <p style={{ color: "var(--aria-text-muted)", fontSize: 14, maxWidth: 360, margin: "0 auto 28px" }}>
        We'll connect your apps so ARIA can learn your workflow and deliver smart, timely suggestions.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div key={f.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }} className="glass"
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 14, textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--aria-accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={20} color="var(--aria-accent-light)" />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{f.title}</p>
                <p style={{ fontSize: 12, color: "var(--aria-text-muted)", marginTop: 2 }}>{f.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function GoogleStep({ config, setConfig }) {
  const [status, setStatus] = useState(config.googleLinked ? "linked" : "idle");
  const [linking, setLinking] = useState(false);

  const handleLink = async () => {
    setLinking(true); setStatus("linking");
    try {
      const resp = await fetch(`${API}/api/setup/google/init`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.linked) { setStatus("linked"); setConfig(c => ({ ...c, googleLinked: true })); setLinking(false); return; }
      }
      setStatus("error");
    } catch { setStatus("error"); }
    setLinking(false);
  };

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Connect Google Services</h2>
        <p style={{ color: "var(--aria-text-muted)", fontSize: 13 }}>ARIA reads your calendar events and email metadata to understand your schedule.</p>
      </div>
      {[{ icon: Calendar, color: "#4285F4", title: "Google Calendar", desc: "Read-only access to your events" },
        { icon: Mail, color: "#EA4335", title: "Gmail", desc: "Read email subjects & senders only" }
      ].map(s => (
        <div key={s.title} className="glass" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 14, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <s.icon size={20} color={s.color} />
          </div>
          <div style={{ flex: 1 }}><p style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</p><p style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>{s.desc}</p></div>
          {status === "linked" && <Chip size="sm" color="success" variant="flat">Connected</Chip>}
        </div>
      ))}
      <button onClick={handleLink} disabled={linking || status === "linked"}
        style={{ width: "100%", height: 48, borderRadius: 12, border: "none", cursor: status === "linked" ? "default" : "pointer", fontWeight: 600, fontSize: 14, marginTop: 10, color: status === "linked" ? "var(--aria-success)" : "white", background: status === "linked" ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))" }}>
        {status === "linked" ? "✓ Google Connected" : status === "error" ? "Retry Connection" : linking ? "Connecting..." : "Connect Google Account"}
      </button>
      {status === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.1)" }}>
          <AlertCircle size={16} color="var(--aria-warning)" />
          <p style={{ fontSize: 12, color: "var(--aria-warning)" }}>Backend not reachable. You can skip and connect later in Settings.</p>
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--aria-text-muted)", textAlign: "center", marginTop: 14 }}>You can skip this step and connect later from Settings.</p>
    </div>
  );
}

function NotesStep({ config, setConfig }) {
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Link Your Notes</h2>
        <p style={{ color: "var(--aria-text-muted)", fontSize: 13 }}>Point ARIA to your notes folder. Works with Obsidian, Notion exports, or any markdown files.</p>
      </div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--aria-text-muted)", marginBottom: 6, display: "block" }}>Notes Folder Path</label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <FolderOpen size={16} color="var(--aria-text-muted)" />
        </div>
        <input value={config.notesPath} onChange={e => setConfig(c => ({ ...c, notesPath: e.target.value }))}
          placeholder="C:\Users\you\Documents\Notes"
          style={{ width: "100%", height: 48, borderRadius: 12, background: "var(--aria-surface)", border: "1px solid var(--aria-border)", color: "var(--aria-text)", fontSize: 14, paddingLeft: 40, paddingRight: 14, outline: "none" }}
          onFocus={e => e.target.style.borderColor = "var(--aria-accent)"}
          onBlur={e => e.target.style.borderColor = "var(--aria-border)"}
        />
      </div>
      <div className="glass" style={{ padding: "14px 18px", borderRadius: 14, marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Supported formats</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Obsidian", "Markdown (.md)", "Plain text", "Notion export"].map(f => (
            <Chip key={f} size="sm" variant="flat" color="secondary">{f}</Chip>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 11, color: "var(--aria-text-muted)", textAlign: "center", marginTop: 14 }}>Optional — ARIA works without notes, but they make suggestions much smarter.</p>
    </div>
  );
}

function AIStep({ config, setConfig }) {
  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState(config.openrouterKey ? true : null);

  const validate = async () => {
    setValidating(true);
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${config.openrouterKey}` } });
      setValid(resp.ok);
    } catch { setValid(false); }
    setValidating(false);
  };

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Configure AI Engine</h2>
        <p style={{ color: "var(--aria-text-muted)", fontSize: 13 }}>ARIA uses OpenRouter's free AI models to generate natural-language suggestions.</p>
      </div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--aria-text-muted)", marginBottom: 6, display: "block" }}>OpenRouter API Key</label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Key size={16} color="var(--aria-text-muted)" /></div>
        <input type="password" value={config.openrouterKey} onChange={e => { setConfig(c => ({ ...c, openrouterKey: e.target.value })); setValid(null); }}
          placeholder="sk-or-v1-..."
          style={{ width: "100%", height: 48, borderRadius: 12, background: "var(--aria-surface)", border: "1px solid var(--aria-border)", color: "var(--aria-text)", fontSize: 14, paddingLeft: 40, paddingRight: valid !== null ? 80 : 14, outline: "none" }}
          onFocus={e => e.target.style.borderColor = "var(--aria-accent)"}
          onBlur={e => e.target.style.borderColor = "var(--aria-border)"}
        />
        {valid !== null && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
            <Chip size="sm" color={valid ? "success" : "danger"} variant="flat">{valid ? "Valid" : "Invalid"}</Chip>
          </div>
        )}
      </div>
      <button onClick={validate} disabled={validating}
        style={{ width: "100%", height: 40, borderRadius: 10, background: "transparent", border: "1px solid var(--aria-border)", color: "var(--aria-text)", cursor: "pointer", fontSize: 13, fontWeight: 500, marginTop: 10 }}>
        {validating ? "Validating..." : "Validate Key"}
      </button>
      <div style={{ height: 1, background: "var(--aria-border)", margin: "20px 0" }} />
      <div className="glass" style={{ padding: "14px 18px", borderRadius: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Free AI Models Used</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>Primary: OpenRouter Free Router</span>
          <Chip size="sm" variant="flat" color="primary">Free</Chip>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>Fallback: Ollama (local)</span>
          <Chip size="sm" variant="flat" color="secondary">Optional</Chip>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "var(--aria-text-muted)", textAlign: "center", marginTop: 14 }}>
        Get your free key at <a href="https://openrouter.ai" target="_blank" rel="noreferrer" style={{ color: "var(--aria-accent-light)" }}>openrouter.ai</a> — no credit card required.
      </p>
    </div>
  );
}

function LaunchStep({ config }) {
  const services = [
    { name: "Google Calendar", linked: config.googleLinked, icon: Calendar, color: "#4285F4" },
    { name: "Gmail", linked: config.googleLinked, icon: Mail, color: "#EA4335" },
    { name: "Notes Folder", linked: !!config.notesPath, icon: FolderOpen, color: "#a855f7" },
    { name: "OpenRouter AI", linked: !!config.openrouterKey, icon: Bot, color: "#6366f1" },
  ];
  return (
    <div style={{ textAlign: "center" }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
        style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #22c55e, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 32px rgba(34, 197, 94, 0.3)" }}>
        <Rocket size={40} color="white" />
      </motion.div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>You're all set!</h2>
      <p style={{ color: "var(--aria-text-muted)", fontSize: 13, marginBottom: 24 }}>ARIA will start learning your patterns. Expect your first smart nudge within minutes.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {services.map(s => (
          <div key={s.name} className="glass" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.icon size={16} color={s.color} />
            </div>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textAlign: "left" }}>{s.name}</span>
            <Chip size="sm" variant="flat" color={s.linked ? "success" : "warning"}>{s.linked ? "Ready" : "Skipped"}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SetupWizard() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({
    googleLinked: false,
    notesPath: "",
    watchNotes: true,
    openrouterKey: import.meta.env.VITE_OPENROUTER_API_KEY || "",
  });

  const saveConfig = useCallback(async () => {
    try {
      await fetch(`${API}/api/settings`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { notes_folder_path: config.notesPath, openrouter_api_key: config.openrouterKey, watch_notes: config.watchNotes, google_linked: config.googleLinked } }),
      });
    } catch {}
  }, [config]);

  const handleNext = () => { if (step < STEPS.length - 1) setStep(step + 1); };
  const handleBack = () => { if (step > 0) setStep(step - 1); };
  const handleLaunch = async () => { await saveConfig(); completeSetup(); };

  const stepContent = [
    <WelcomeStep key="welcome" />,
    <GoogleStep key="google" config={config} setConfig={setConfig} />,
    <NotesStep key="notes" config={config} setConfig={setConfig} />,
    <AIStep key="ai" config={config} setConfig={setConfig} />,
    <LaunchStep key="launch" config={config} />,
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "var(--aria-bg)" }}>
      <div className="orb" style={{ width: 300, height: 300, background: "var(--aria-gradient-start)", top: "-8%", right: "-5%", animation: "float 22s ease-in-out infinite" }} />
      <div className="orb" style={{ width: 250, height: 250, background: "var(--aria-gradient-end)", bottom: "-10%", left: "-3%", animation: "float 28s ease-in-out infinite reverse" }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 500, padding: "0 20px", zIndex: 10 }}>
        <StepIndicator currentStep={step} />
        <div className="glass-strong glow-accent" style={{ borderRadius: 20, padding: "28px 28px 20px" }}>
          {/* Progress bar */}
          <div style={{ height: 4, borderRadius: 2, background: "var(--aria-surface-2)", marginBottom: 24, overflow: "hidden" }}>
            <motion.div animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, var(--aria-gradient-start), var(--aria-gradient-end))" }} transition={{ duration: 0.4 }} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button onClick={handleBack}
                style={{ flex: 1, height: 44, borderRadius: 12, background: "transparent", border: "1px solid var(--aria-border)", color: "var(--aria-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 500 }}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={handleNext}
                style={{ flex: 1, height: 44, borderRadius: 12, background: "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
                {step === 0 ? "Get Started" : "Continue"} <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleLaunch}
                style={{ flex: 1, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #22c55e, #06b6d4)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
                Launch ARIA <Rocket size={16} />
              </button>
            )}
          </div>
          {step > 0 && step < STEPS.length - 1 && (
            <button onClick={handleNext}
              style={{ background: "none", border: "none", color: "var(--aria-text-muted)", fontSize: 12, cursor: "pointer", marginTop: 10, width: "100%", textAlign: "center" }}>
              Skip this step →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
