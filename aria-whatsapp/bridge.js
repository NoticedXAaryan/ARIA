const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");

const ARIA_BACKEND = process.env.ARIA_BACKEND || "http://localhost:8742";
const PORT = process.env.BRIDGE_PORT || 3001;

// ─── WhatsApp Client ───

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

let clientReady = false;

client.on("qr", async (qr) => {
  console.log("\n[ARIA-WA] Scan this QR code in WhatsApp:\n");
  qrcode.generate(qr, { small: true });

  // Forward QR data to ARIA backend
  try {
    await fetch(`${ARIA_BACKEND}/api/whatsapp/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_data: qr }),
    });
  } catch (e) {
    console.log("[ARIA-WA] Could not forward QR to backend:", e.message);
  }
});

client.on("ready", async () => {
  clientReady = true;
  const info = client.info;
  const phone = info?.wid?.user || "unknown";
  console.log(`[ARIA-WA] Client ready! Connected as ${phone}`);

  try {
    await fetch(`${ARIA_BACKEND}/api/whatsapp/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "connected", phone }),
    });
  } catch (e) {
    console.log("[ARIA-WA] Could not notify backend:", e.message);
  }
});

client.on("disconnected", (reason) => {
  clientReady = false;
  console.log("[ARIA-WA] Disconnected:", reason);
});

client.on("message", async (msg) => {
  if (msg.fromMe) return; // Skip own messages

  const contact = await msg.getContact();
  const chat = await msg.getChat();

  const payload = {
    from: msg.from,
    from_name: contact.pushname || contact.name || msg.from,
    body: msg.body,
    timestamp: msg.timestamp,
    is_group: chat.isGroup,
    chat_id: chat.id._serialized,
  };

  try {
    await fetch(`${ARIA_BACKEND}/api/whatsapp/incoming`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Backend might be down — that's fine, bridge keeps running
  }
});

client.initialize();

// ─── Express REST Server ───

const app = express();
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: clientReady ? "connected" : "disconnected" });
});

// Send a message
app.post("/send", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "WhatsApp not connected" });

  const { chat_id, message } = req.body;
  if (!chat_id || !message) return res.status(400).json({ error: "chat_id and message required" });

  try {
    await client.sendMessage(chat_id, message);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get recent chats
app.get("/chats", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "WhatsApp not connected" });

  try {
    const chats = await client.getChats();
    const result = chats.slice(0, 20).map((chat) => ({
      id: chat.id._serialized,
      name: chat.name,
      is_group: chat.isGroup,
      unread_count: chat.unreadCount,
      last_message: chat.lastMessage
        ? {
            body: chat.lastMessage.body?.substring(0, 200),
            timestamp: chat.lastMessage.timestamp,
            from_me: chat.lastMessage.fromMe,
          }
        : null,
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get messages for a specific chat
app.get("/messages/:chatId", async (req, res) => {
  if (!clientReady) return res.status(503).json({ error: "WhatsApp not connected" });

  try {
    const chat = await client.getChatById(req.params.chatId);
    const messages = await chat.fetchMessages({ limit: 30 });
    const result = messages.map((msg) => ({
      id: msg.id._serialized,
      body: msg.body,
      from: msg.from,
      from_me: msg.fromMe,
      timestamp: msg.timestamp,
      has_media: msg.hasMedia,
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`[ARIA-WA] REST bridge listening on http://localhost:${PORT}`);
});
