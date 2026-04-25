const API_BASE_URL = (import.meta.env.VITE_ARIA_API_URL || "http://127.0.0.1:8742").replace(/\/+$/, "");

export const API = API_BASE_URL;
export const WS_API = API_BASE_URL.replace(/^http/i, "ws");

