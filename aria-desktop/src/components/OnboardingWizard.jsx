import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, Button, ProgressBar, Input } from "@heroui/react";
import { CheckCircle2, ChevronRight, Folder, Calendar, Sparkles } from "lucide-react";
import { API } from "../lib/api";

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [googleStatus, setGoogleStatus] = useState("pending"); // pending, polling, success
  const [notesPath, setNotesPath] = useState("");
  const [focusStart, setFocusStart] = useState("09:00");
  const [focusEnd, setFocusEnd] = useState("12:00");

  const totalSteps = 5;

  const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // Poll Google Status
  useEffect(() => {
    if (step === 2 && googleStatus === "polling") {
      const iv = setInterval(async () => {
        try {
          const res = await fetch(`${API}/api/setup/status`);
          const data = await res.json();
          if (data.google_linked) {
            setGoogleStatus("success");
            clearInterval(iv);
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
      return () => clearInterval(iv);
    }
  }, [step, googleStatus]);

  const connectGoogle = async () => {
    try {
      setGoogleStatus("polling");
      const res = await fetch(`${API}/api/accounts/google/start`, { method: "POST" });
      if (!res.ok) {
        throw new Error(`google start failed: ${res.status}`);
      }
      const data = await res.json();
      if (data?.auth_url) {
        window.open(data.auth_url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.error(e);
      setGoogleStatus("pending");
    }
  };

  const handleNotesSet = async () => {
    try {
      if (notesPath) {
        await fetch(`${API}/api/setup/notes/set`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: notesPath })
        });
      }
      nextStep();
    } catch (e) {
      console.error(e);
    }
  };

  const pickFolder = async () => {
    try {
      if (window.ariaDesktop?.selectFolder) {
        const path = await window.ariaDesktop.selectFolder();
        if (path) setNotesPath(path);
      } else if (window.showDirectoryPicker) {
        const dirHandle = await window.showDirectoryPicker();
        setNotesPath(dirHandle.name + " (Local folder selected)"); 
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFocusSet = async () => {
    try {
      await fetch(`${API}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { focus_start: focusStart, focus_end: focusEnd } })
      });
      nextStep();
    } catch (e) {
      console.error(e);
    }
  };

  const completeSetup = async () => {
    try {
      await fetch(`${API}/api/setup/complete`, { method: "POST" });
      onComplete();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(10, 10, 12, 0.95)", backdropFilter: "blur(40px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      zIndex: 99999, overflow: "hidden"
    }}>
      <div style={{ width: 500, maxWidth: "90%", position: "relative" }}>
        
        {/* ProgressBar */}
        <div style={{ marginBottom: 30, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={(step / totalSteps) * 100} size="sm" color="secondary" />
          </div>
          <span style={{ fontSize: 12, color: "var(--aria-text-muted)", fontWeight: 600 }}>{step} / {totalSteps}</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", marginBottom: 30 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, var(--aria-gradient-start), var(--aria-gradient-end))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <Sparkles size={32} color="white" />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }} className="gradient-text">Welcome to ARIA</h2>
                <p style={{ fontSize: 16, color: "var(--aria-text-muted)", lineHeight: 1.5 }}>
                  ARIA learns your patterns and gets ahead of you.<br/>
                  Let's set up a few things to get started.
                </p>
              </div>
              <Button size="lg" color="secondary" fullWidth onPress={nextStep}>Get Started</Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="glass" style={{ padding: 24, borderRadius: 20, border: "1px solid var(--aria-border)" }}>
                <div style={{ textAlign: "center", marginBottom: 30 }}>
                  <Calendar size={48} color="var(--aria-primary)" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Connect Google</h3>
                  <p style={{ fontSize: 14, color: "var(--aria-text-muted)" }}>
                    ARIA reads your calendar and email to understand your day.
                  </p>
                </div>
                
                {googleStatus === "success" ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, background: "rgba(34,197,94,0.1)", borderRadius: 12, color: "#22c55e", marginBottom: 20 }}>
                    <CheckCircle2 size={20} />
                    <span style={{ fontWeight: 600 }}>Google Connected</span>
                  </div>
                ) : (
                  <Button size="lg" color="primary" fullWidth onPress={connectGoogle} isLoading={googleStatus === "polling"} style={{ marginBottom: 12 }}>
                    {googleStatus === "polling" ? "Check Browser to Authenticate..." : "Connect Google"}
                  </Button>
                )}
                
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                  <Button variant="light" onPress={prevStep}>Back</Button>
                  {googleStatus === "success" ? (
                    <Button color="secondary" endContent={<ChevronRight size={16} />} onPress={nextStep}>Continue</Button>
                  ) : (
                    <Button variant="light" onPress={nextStep} style={{ color: "var(--aria-text-muted)" }}>Skip for now</Button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="glass" style={{ padding: 24, borderRadius: 20, border: "1px solid var(--aria-border)" }}>
                <div style={{ textAlign: "center", marginBottom: 30 }}>
                  <Folder size={48} color="var(--aria-warning)" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Connect Notes</h3>
                  <p style={{ fontSize: 14, color: "var(--aria-text-muted)" }}>
                    Point ARIA to where you keep your notes (.md, .txt, .docx).
                  </p>
                </div>
                
                <div style={{ marginBottom: 24, display: "flex", gap: 10 }}>
                  <Input 
                    placeholder="e.g. C:\Users\YourName\Documents\Notes"
                    value={notesPath}
                    onChange={(e) => setNotesPath(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button onPress={pickFolder} isIconOnly color="secondary" variant="flat">
                    <Folder size={18} />
                  </Button>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Button variant="light" onPress={prevStep}>Back</Button>
                  <Button color={notesPath ? "secondary" : "default"} onPress={handleNotesSet} endContent={<ChevronRight size={16} />}>
                    {notesPath ? "Continue" : "Skip"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="glass" style={{ padding: 24, borderRadius: 20, border: "1px solid var(--aria-border)" }}>
                <div style={{ textAlign: "center", marginBottom: 30 }}>
                  <Sparkles size={48} color="var(--aria-accent)" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Set Focus Hours</h3>
                  <p style={{ fontSize: 14, color: "var(--aria-text-muted)" }}>
                    When should ARIA stay quiet?
                  </p>
                </div>
                
                <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                  <Input type="time" label="Focus Start" value={focusStart} onChange={e => setFocusStart(e.target.value)} />
                  <Input type="time" label="Focus End" value={focusEnd} onChange={e => setFocusEnd(e.target.value)} />
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Button variant="light" onPress={prevStep}>Back</Button>
                  <Button color="secondary" onPress={handleFocusSet} endContent={<ChevronRight size={16} />}>Continue</Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", marginBottom: 30 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <CheckCircle2 size={32} color="#22c55e" />
                </div>
                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>You're all set!</h2>
                <p style={{ fontSize: 16, color: "var(--aria-text-muted)", lineHeight: 1.5 }}>
                  ARIA will watch quietly for a few days before making suggestions.<br/>
                  Check back in 48 hours.
                </p>
              </div>
              <Button size="lg" color="success" variant="flat" fullWidth onPress={completeSetup}>Finish Setup</Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
