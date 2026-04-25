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
    }
  };
}
