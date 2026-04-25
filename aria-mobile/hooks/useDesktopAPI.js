export function createDesktopAPI(baseUrl, token) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || ""}`
  };
  return {
    getActiveNudges: async () => {
      const r = await fetch(`${baseUrl}/api/nudges/active`, { headers });
      return r.json();
    },
    sendFeedback: async (id, outcome) => {
      const r = await fetch(`${baseUrl}/api/nudges/${id}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ outcome })
      });
      return r.json();
    },
    addTask: async (title) => {
      const r = await fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title })
      });
      return r.json();
    },
    getLookahead: async (hours = 6) => {
      const r = await fetch(`${baseUrl}/api/calendar/lookahead?hours=${hours}`, { headers });
      return r.json();
    },
    verifyPairCode: async (token) => {
      const r = await fetch(`${baseUrl}/api/pair/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token })
      });
      return r.json();
    },
    registerDevice: async (device_id, push_token, platform) => {
      const r = await fetch(`${baseUrl}/api/pair/register`, {
        method: "POST",
        headers,
        body: JSON.stringify({ device_id, push_token, platform })
      });
      return r.json();
    },
    getStatus: async () => {
      const r = await fetch(`${baseUrl}/api/status`, { headers });
      return r.json();
    }
  };
}
