import React, { useState, useEffect } from "react";
import { 
  Card, CardBody, Button, Switch, Slider, Input, Divider, Avatar, 
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Spinner
} from "@heroui/react";
import { 
  CheckCircle2, XCircle, Settings, Mail, Calendar, Trash2, Smartphone, MonitorPlay, Activity, Brain, Link as LinkIcon
} from "lucide-react";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

export default function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [health, setHealth] = useState([]);
  const [settings, setSettings] = useState({});
  const [memoryStats, setMemoryStats] = useState({ events: 0, facts: 0, habits: 0 });
  const [pairData, setPairData] = useState(null);
  const {isOpen, onOpen, onOpenChange} = useDisclosure();
  const {isOpen: isPairOpen, onOpen: onPairOpen, onOpenChange: onPairChange} = useDisclosure();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accRes, healthRes, setRes, memRes] = await Promise.all([
        fetch(`${API}/api/accounts`),
        fetch(`${API}/api/health`),
        fetch(`${API}/api/settings`),
        fetch(`${API}/api/memory/stats`)
      ]);
      setAccounts(await accRes.json());
      setHealth(await healthRes.json());
      setSettings(await setRes.json());
      setMemoryStats(await memRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await fetch(`${API}/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { [key]: value } })
      });
    } catch (e) {
      console.error("Failed to update setting", e);
    }
  };

  const addGoogleAccount = async () => {
    try {
      const res = await fetch(`${API}/api/accounts/google/start`, { method: "POST" });
      const data = await res.json();
      if (data.auth_url) window.open(data.auth_url, "_blank");
    } catch (e) {
      console.error(e);
    }
  };

  const addOutlookAccount = async () => {
    try {
      const res = await fetch(`${API}/api/accounts/outlook/start`, { method: "POST" });
      const data = await res.json();
      if (data.auth_url) window.open(data.auth_url, "_blank");
    } catch (e) {
      console.error(e);
    }
  };

  const removeAccount = async (id) => {
    try {
      await fetch(`${API}/api/accounts/${id}`, { method: "DELETE" });
      setAccounts(accounts.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const clearMemory = async (onClose) => {
    try {
      await fetch(`${API}/api/memory/clear`, { method: "DELETE" });
      setMemoryStats({ events: 0, facts: 0, habits: 0 });
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const changeNotesFolder = async () => {
    if (window.ariaDesktop?.selectFolder) {
      const path = await window.ariaDesktop.selectFolder();
      if (path) updateSetting("notes_folder_path", path);
    } else {
      alert("Folder selection requires the desktop app.");
    }
  };

  const getHealthStatus = (connectorName) => {
    const status = health.find(h => h.connector.startsWith(connectorName));
    if (!status) return null;
    return status.status;
  };

  const generatePairCode = async () => {
    try {
      const res = await fetch(`${API}/api/pair/code`);
      if (res.ok) {
        setPairData(await res.json());
        onPairOpen();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate pair code");
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner color="secondary" /></div>;
  }

  return (
    <div style={{ padding: "0 16px 24px", color: "var(--aria-text)" }}>
      {/* 1. Connected Accounts */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--aria-text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Connected Accounts</h3>
        <Card className="glass" style={{ marginBottom: 16 }}>
          <CardBody style={{ gap: 12, padding: 16 }}>
            {accounts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--aria-text-muted)" }}>No accounts connected.</p>
            ) : (
              accounts.map(acc => (
                <div key={acc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar name={acc.email} size="sm" src={acc.provider === "google" ? "https://www.google.com/favicon.ico" : "https://outlook.live.com/favicon.ico"} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{acc.email}</div>
                      <div style={{ fontSize: 12, color: "var(--aria-text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ textTransform: "capitalize" }}>{acc.provider}</span>
                        <span>•</span>
                        {getHealthStatus(acc.provider === "google" ? "GoogleCalendar" : "OutlookCalendar") === "down" ? (
                          <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}><XCircle size={12}/> Error</span>
                        ) : (
                          <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={12}/> Syncing</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button isIconOnly variant="light" color="danger" size="sm" onPress={() => removeAccount(acc.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))
            )}
          </CardBody>
        </Card>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" color="secondary" variant="flat" onPress={addGoogleAccount} startContent={<Mail size={16} />}>Add Google</Button>
          <Button size="sm" color="secondary" variant="flat" onPress={addOutlookAccount} startContent={<Calendar size={16} />}>Add Outlook</Button>
          <Button size="sm" color="primary" variant="flat" onPress={generatePairCode} startContent={<Smartphone size={16} />}>Connect Phone</Button>
        </div>
      </section>

      {/* 2. Data Sources */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--aria-text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Data Sources</h3>
        <Card className="glass">
          <CardBody style={{ gap: 16, padding: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Notes Folder</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input size="sm" isReadOnly value={settings.notes_folder_path || "Not configured"} style={{ flex: 1 }} />
                <Button size="sm" variant="flat" color="secondary" onPress={changeNotesFolder}>Change</Button>
              </div>
            </div>
            
            <Divider />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MonitorPlay size={18} color="var(--aria-text-muted)" />
                <span style={{ fontSize: 14 }}>ActivityWatch</span>
              </div>
              {getHealthStatus("ActivityWatch") === "ok" ? (
                <div style={{ color: "#22c55e", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={12}/> Running</div>
              ) : (
                <Button size="sm" variant="light" color="primary" onPress={() => window.open("https://activitywatch.net/downloads/", "_blank")}>Install</Button>
              )}
            </div>

            <Divider />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Smartphone size={18} color="var(--aria-text-muted)" />
                <span style={{ fontSize: 14 }}>WhatsApp</span>
              </div>
              <Button size="sm" variant="light" color="secondary" onPress={() => window.open("https://web.whatsapp.com", "_blank")}>Connect</Button>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* 3. Behaviour */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--aria-text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Behaviour</h3>
        <Card className="glass">
          <CardBody style={{ gap: 20, padding: 16 }}>
            <div style={{ display: "flex", gap: 16 }}>
              <Input type="time" label="Focus Start" size="sm" value={settings.focus_start || "09:00"} onChange={(e) => updateSetting("focus_start", e.target.value)} />
              <Input type="time" label="Focus End" size="sm" value={settings.focus_end || "12:00"} onChange={(e) => updateSetting("focus_end", e.target.value)} />
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Nudge Intensity</div>
              <Slider 
                step={1} 
                maxValue={3} 
                minValue={1} 
                defaultValue={settings.nudge_intensity === "low" ? 1 : settings.nudge_intensity === "high" ? 3 : 2}
                marks={[
                  {value: 1, label: "Low"},
                  {value: 2, label: "Med"},
                  {value: 3, label: "High"},
                ]}
                onChangeEnd={(val) => updateSetting("nudge_intensity", val === 1 ? "low" : val === 3 ? "high" : "medium")}
                color="secondary"
                size="sm"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 14 }}>Silent on Weekends</span>
              <Switch size="sm" color="secondary" isSelected={settings.silent_weekends !== "false"} onValueChange={(val) => updateSetting("silent_weekends", val ? "true" : "false")} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>EOD Summary</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input type="time" size="sm" value={settings.eod_time || "17:30"} onChange={(e) => updateSetting("eod_time", e.target.value)} style={{ width: 100 }} />
                <Switch size="sm" color="secondary" isSelected={settings.eod_enabled !== "false"} onValueChange={(val) => updateSetting("eod_enabled", val ? "true" : "false")} />
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* 4. ARIA Memory */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--aria-text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>ARIA Memory</h3>
        <Card className="glass">
          <CardBody style={{ gap: 16, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Brain size={18} color="var(--aria-primary)" />
              <span style={{ fontSize: 14, fontWeight: 500 }}>What ARIA knows</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
              <div style={{ background: "rgba(255,255,255,0.05)", padding: "12px 8px", borderRadius: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--aria-primary)" }}>{memoryStats.events}</div>
                <div style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>EVENTS</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", padding: "12px 8px", borderRadius: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--aria-secondary)" }}>{memoryStats.facts}</div>
                <div style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>FACTS</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", padding: "12px 8px", borderRadius: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--aria-accent)" }}>{memoryStats.habits}</div>
                <div style={{ fontSize: 11, color: "var(--aria-text-muted)" }}>HABITS</div>
              </div>
            </div>
            <Button size="sm" color="danger" variant="flat" onPress={onOpen} fullWidth style={{ marginTop: 8 }}>
              Clear All Memory
            </Button>
          </CardBody>
        </Card>
      </section>

      {/* 5. About */}
      <section>
        <div style={{ textAlign: "center", padding: "16px 0", color: "var(--aria-text-muted)", fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: "var(--aria-text)", marginBottom: 4 }}>ARIA Desktop v0.2.0</div>
          <div>Model: {settings.openrouter_api_key ? "OpenRouter" : "Ollama Local"}</div>
          <div>Engine: Native Python</div>
        </div>
      </section>

      {/* Clear Memory Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent style={{ background: "var(--aria-bg-dark)", border: "1px solid var(--aria-border)" }}>
          {(onClose) => (
            <>
              <ModalHeader style={{ color: "#ef4444" }}>Clear ARIA's Memory?</ModalHeader>
              <ModalBody>
                <p style={{ fontSize: 14 }}>
                  This will permanently delete all events, facts, and habits ARIA has learned about you. It cannot be undone.
                </p>
                <p style={{ fontSize: 14, color: "var(--aria-text-muted)" }}>
                  (OAuth connections and settings will not be affected.)
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="danger" onPress={() => clearMemory(onClose)}>Delete Everything</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Pair Phone Modal */}
      <Modal isOpen={isPairOpen} onOpenChange={onPairChange} backdrop="blur">
        <ModalContent style={{ background: "var(--aria-bg-dark)", border: "1px solid var(--aria-border)" }}>
          {(onClose) => (
            <>
              <ModalHeader>Pair Mobile App</ModalHeader>
              <ModalBody style={{ textAlign: "center", paddingBottom: 20 }}>
                <p style={{ fontSize: 14, color: "var(--aria-text-muted)", marginBottom: 16 }}>
                  Enter this 6-digit code in the ARIA mobile app.
                </p>
                {pairData && (
                  <>
                    <div style={{ fontSize: 40, fontWeight: "800", letterSpacing: 8, color: "var(--aria-primary)", marginBottom: 16 }}>
                      {pairData.code}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--aria-text-muted)" }}>
                      Desktop IP: {pairData.desktop_ip}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--aria-warning)", marginTop: 8 }}>
                      Expires in {Math.floor(pairData.expires_in / 60)} minutes
                    </div>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

    </div>
  );
}
