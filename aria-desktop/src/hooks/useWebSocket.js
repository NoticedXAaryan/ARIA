import { useEffect } from "react";
import { WS_API } from "../lib/api";

export function useWebSocket(onNudge) {
  useEffect(() => {
    const ws = new WebSocket(`${WS_API}/ws/nudges`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.event === "nudge") onNudge(msg.data);
    };
    return () => ws.close();
  }, [onNudge]);
}
