import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Play } from "lucide-react";
import { Button } from "@heroui/react";

const API = import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742";

export default function NudgeToast() {
  const [queue, setQueue] = useState([]);
  const [nudge, setNudge] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  // When a toast hides, check the queue
  useEffect(() => {
    if (!isVisible && queue.length > 0) {
      const nextNudge = queue[0];
      setQueue(q => q.slice(1));
      setNudge(nextNudge);
      setIsVisible(true);
      if (window.ariaDesktop?.showToast) {
        window.ariaDesktop.showToast(nextNudge);
      }
    }
  }, [isVisible, queue]);

  useEffect(() => {
    if (window.ariaDesktop?.onToastData) {
      window.ariaDesktop.onToastData((data) => {
        setQueue(q => [...q, data]);
      });
    }

    // Connect to WebSocket to receive new nudges if needed, 
    // but the backend sends 'toast:show' via IPC through main.js
    // Let's actually connect WebSocket to get new nudges, because the backend doesn't know about Electron IPC directly.
    // Wait, the prompt says: "Backend -> scheduler detects new high-urgency nudge -> POST to Electron main process via a local websocket or named pipe -> main.js sends 'toast:show' to toast window".
    // Alternatively, the dashboard or panel window already receives the WebSocket, and it can send `toast:show` via IPC!
    // Let's use the same WebSocket logic here, or just wait for `onToastData` from IPC.
    // If we use WebSocket directly here:
    let ws;
    const connectWS = () => {
      ws = new WebSocket(API.replace("http", "ws") + "/ws/nudges");
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.event === "nudge_created" && msg.data) {
          if (msg.data.surface === "popup" || msg.data.urgency_score > 0.5) {
            setQueue(q => [...q, msg.data]);
          }
        }
      };
      ws.onclose = () => setTimeout(connectWS, 2000);
    };
    connectWS();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const hideToast = () => {
    setIsVisible(false);
    setTimeout(() => {
      setNudge(null);
      if (window.ariaDesktop?.hideToast) {
        window.ariaDesktop.hideToast();
      }
    }, 400); // Wait for exit animation
  };

  const handleAction = async (outcome) => {
    if (!nudge) return;
    try {
      await fetch(`${API}/api/nudges/${nudge.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome })
      });
    } catch (e) {
      console.error("Feedback error", e);
    }
    hideToast();
  };

  // Auto-hide when progress bar finishes
  useEffect(() => {
    if (isVisible && nudge) {
      const timer = setTimeout(() => {
        handleAction("ignored");
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, nudge]);

  return (
    <div style={{
      width: "100%", height: "100vh", overflow: "hidden", 
      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
      padding: 0, margin: 0,
      background: "transparent"
    }}>
      <AnimatePresence>
        {isVisible && nudge && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              width: 280,
              background: "rgba(10, 10, 15, 0.85)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              color: "#fff",
              position: "relative"
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px 6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ background: "#3b82f6", color: "#fff", fontSize: 9, fontWeight: "bold", padding: "2px 6px", borderRadius: 4, letterSpacing: 0.5 }}>
                  ARIA
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#eee" }} className="truncate">
                  {nudge.title || "Notification"}
                </div>
              </div>
              <button 
                onClick={() => handleAction("dismissed")}
                style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "0 12px 12px" }}>
              <div style={{ fontSize: 13, color: "#ddd", lineHeight: 1.4, marginBottom: 8, maxHeight: 40, overflow: "hidden" }}>
                {nudge.suggestion_text}
              </div>
              
              <div style={{ display: "flex", gap: 6 }}>
                <Button 
                  size="sm" 
                  color="primary" 
                  variant="flat" 
                  style={{ flex: 1, height: 28, fontSize: 12 }}
                  onPress={() => handleAction("accepted")}
                  startContent={<Play size={12} />}
                >
                  Action
                </Button>
                <Button 
                  size="sm" 
                  style={{ background: "rgba(255,255,255,0.1)", color: "#fff", height: 28, fontSize: 12 }}
                  onPress={() => handleAction("snoozed")}
                  startContent={<Clock size={12} />}
                >
                  Snooze
                </Button>
              </div>
            </div>

            {/* ProgressBar Bar */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 12, ease: "linear" }}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: 3,
                background: "#3b82f6",
                boxShadow: "0 0 8px #3b82f6"
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
