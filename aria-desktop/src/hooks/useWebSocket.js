import { useEffect } from "react";

export function useWebSocket(onNudge) {
  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8742/ws/nudges");
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.event === "nudge") onNudge(msg.data);
    };
    return () => ws.close();
  }, [onNudge]);
}
