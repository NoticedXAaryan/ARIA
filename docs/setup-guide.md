# ARIA Setup Guide

Complete walkthrough for setting up ARIA from scratch on Windows.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | `python --version` to check |
| Node.js | 18+ | `node --version` to check |
| npm | 9+ | Comes with Node.js |
| Git | Any | For cloning the repository |

### Optional (enhance ARIA's capabilities)

| Tool | Purpose | Install |
|---|---|---|
| ActivityWatch | App focus time tracking | [activitywatch.net](https://activitywatch.net) — runs as background service |
| Google Calendar OAuth | Calendar event ingestion | Google Cloud Console → enable Calendar API → create Desktop credentials |
| OpenRouter API key | LLM-generated nudge text | [openrouter.ai](https://openrouter.ai) → free tier → get API key |
| Ollama | Local LLM fallback | [ollama.com](https://ollama.com) → `ollama pull llama3.2:3b` |

---

## 1. Clone and Navigate

```bash
git clone <repository-url>
cd FunctionalARIA
```

---

## 2. Backend Setup

### Create virtual environment

```bash
python -m venv .venv
.venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r aria-backend/requirements.txt
```

### Configure environment

```bash
copy .env.example .env
```

Edit `.env` and fill in your values:

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CREDENTIALS_FILE` | Optional | Path to your Google OAuth `credentials.json` |
| `ARIA_NOTES_PATH` | Optional | Path to your markdown notes folder (e.g. Obsidian vault) |
| `OPENROUTER_API_KEY` | Optional | OpenRouter free-tier API key for LLM nudge text |
| `ARIA_API_PORT` | Optional | API port (default: `8742`) |

### Run the backend

```bash
python aria-backend/main.py
```

The daemon will:
1. Initialize SQLite database at `%APPDATA%\ARIA\aria.db`
2. Start the 15-minute scheduler loop
3. Run one immediate evaluation cycle
4. Start FastAPI on `http://127.0.0.1:8742`

### Verify it's running

```bash
curl http://127.0.0.1:8742/api/status
```

Expected: `{"status": "ok", "cognitive_state": "normal", ...}`

---

## 3. Desktop App Setup

```bash
cd aria-desktop
npm install
```

### Development mode (two terminals)

Terminal 1 — Vite dev server:
```bash
npm run dev
```

Terminal 2 — Electron shell:
```bash
npm run electron
```

### Production build

```bash
npm run build
```

---

## 4. Mobile App Setup

```bash
cd aria-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone (must be on the same WiFi network).

---

## 5. Verification Commands

Run these after any code changes to ensure nothing is broken:

```bash
# Backend tests
pytest aria-backend/tests -q

# Desktop build check
cd aria-desktop && npm run build

# Mobile export check
cd aria-mobile && npx expo export --platform android --output-dir dist-test
```

---

## Google Calendar Setup (Detailed)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Download the `credentials.json` file
7. Set `GOOGLE_CREDENTIALS_FILE=C:\path\to\credentials.json` in your `.env`
8. On first run, ARIA will open a browser window for OAuth consent
9. Token is saved to `%APPDATA%\ARIA\google_token.json` (auto-refreshes)

---

## ActivityWatch Setup

1. Download from [activitywatch.net](https://activitywatch.net)
2. Install and run — it starts as a system tray application
3. Verify it's running: open `http://localhost:5600` in your browser
4. ARIA automatically detects it on each 15-minute cycle

No configuration needed — ARIA reads the ActivityWatch REST API directly.

---

## Troubleshooting

### Backend won't start

| Symptom | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError` | Dependencies not installed | `pip install -r aria-backend/requirements.txt` |
| `No module named 'api_main'` | Wrong working directory | Run from repo root: `python aria-backend/main.py` |
| Port 8742 in use | Another process on that port | Change `ARIA_API_PORT` in `.env` |

### Graceful degradation

ARIA is designed to work with partial configuration:

| Missing | Behavior |
|---|---|
| Google credentials | Calendar ingestion skips, other sources continue |
| ActivityWatch not running | App activity data unavailable, calendar + notes still work |
| Notes path not set | Note ingestion skips, calendar + activity still work |
| OpenRouter API key | Nudge text uses hardcoded rule-generated messages |
| ChromaDB/sentence-transformers | Memory queries return empty, core loop still runs |

### Desktop app issues

| Symptom | Fix |
|---|---|
| Blank Electron window | Ensure Vite dev server is running on port 5173 first |
| No tray icon visible | The tray icon uses an empty image fallback — this is expected in dev mode |
| `npm run build` fails | Delete `node_modules` and run `npm install` again |

### Mobile app issues

| Symptom | Fix |
|---|---|
| Can't connect to desktop API | Phone must be on same WiFi. Use desktop's LAN IP, not `127.0.0.1` |
| Expo start fails | Run `npm install` first. Check Node.js version ≥ 18 |

---

## Data Locations

| Data | Path |
|---|---|
| SQLite database | `%APPDATA%\ARIA\aria.db` |
| ChromaDB vectors | `%APPDATA%\ARIA\chroma\` |
| Google OAuth token | `%APPDATA%\ARIA\google_token.json` |
| Environment config | `.env` in project root |
