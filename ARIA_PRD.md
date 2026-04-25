# ARIA — Product Requirements Document
### Anticipatory Reasoning & Intelligent Assistance
**Version:** 1.0 | **Status:** Draft | **Budget:** $0 (open source + free tier only)

---

## Table of Contents
1. [What We're Building](#1-what-were-building)
2. [The Problem](#2-the-problem)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Who Uses This](#4-who-uses-this)
5. [How The System Works](#5-how-the-system-works)
6. [What The App Does — Functional Requirements](#6-what-the-app-does--functional-requirements)
7. [How The App Behaves — Non-Functional Requirements](#7-how-the-app-behaves--non-functional-requirements)
8. [Tech Stack](#8-tech-stack)
9. [UI & Screens](#9-ui--screens)
10. [Project Folder Structure](#10-project-folder-structure)
11. [Database Schema](#11-database-schema)
12. [API Endpoints](#12-api-endpoints)
13. [Build Plan — Phase by Phase](#13-build-plan--phase-by-phase)
14. [Risks](#14-risks)
15. [Success Metrics](#15-success-metrics)
16. [Open Questions](#16-open-questions)
17. [Glossary](#17-glossary)
18. [Dependencies & Licenses](#18-dependencies--licenses)

---

## 1. What We're Building

ARIA is a **proactive AI personal assistant** that runs silently in the background on Windows, learns how the user works, and surfaces smart suggestions at the right moment — without being asked.

Every other assistant waits to be spoken to. ARIA watches patterns across the user's day (calendar, notes, app activity) and gets ahead of them before they drop the ball.

**The core loop:**
1. Every 15 minutes, ARIA reads calendar + app activity + notes
2. It compares the current moment against learned behavioral patterns
3. It scores whether something needs to be surfaced right now
4. If the user is interruptible, a small popup appears bottom-right
5. The user acts or dismisses — ARIA learns from both

**The user experience in one sentence:** You install it, forget about it, and occasionally a little card appears at exactly the right time with exactly the right thing.

---

## 2. The Problem

### Why existing assistants fail

| Problem | What happens today |
|---|---|
| Pull-only model | You must ask. Nobody reminds you of what you forgot to ask about. |
| Context blindness | Suggestions fire without knowing you're in a meeting, in flow, or overloaded. |
| Interrupt indifference | Notifications arrive when the rule triggers, not when you can actually receive them. |
| No behavior learning | Every session starts from zero. The assistant doesn't know your rhythms. |

### What's been tried

- **ChatGPT Pulse (Sep 2025)** — proactive research, but still pull-model, no behavioral adaptation
- **Limitless / Rewind** — captures everything locally, but fundamentally reactive (you search it)
- **Microsoft Copilot** — strong calendar integration, zero behavioral modeling, cloud-only

**The gap:** Nothing currently fuses behavioral modeling + multi-source context + interrupt gating into a background-running, privacy-first, zero-cost assistant.

---

## 3. Goals & Non-Goals

### Goals ✅

- Surface suggestions **without being asked**
- Learn **per-user behavioral patterns** from real data, not generic defaults
- Fuse context: **time + calendar + notes + app activity + workload state**
- Gate interruptions: **never surface during deep focus or active meetings**
- Maintain **persistent memory** across sessions (episodic, semantic, procedural)
- Run **entirely on-device** for privacy — only LLM text generation touches a free cloud API
- Deliver a native **Windows tray app** with expandable notification panel (React + HeroUI)
- Provide a **React Native phone companion** (Expo) for nudges when away from desktop
- **Zero recurring cost** — open source + free tier only

### Non-Goals ❌

- ARIA is **not a chatbot** — users don't type queries into it
- ARIA does **not record screen or audio**
- ARIA does **not execute actions autonomously** (no sending emails, no booking meetings without confirmation)
- ARIA does **not store raw content in any cloud** — only embeddings and metadata leave the device
- ARIA is **not a team / enterprise tool** in v1 — single user only
- ARIA is **not a replacement** for your calendar or task app — it reads from them

---

## 4. Who Uses This

### Persona 1 — The Overloaded Knowledge Worker
- 6–9 meetings/day, dozens of open tasks, constant Slack pings
- Forgets to prep for meetings, drops follow-ups, can't prioritize in the moment
- **ARIA value:** Detects meeting in 20 min with no prep note → fires a focused nudge

### Persona 2 — The Independent Developer
- Works alone, deep focus sessions, async communication
- Loses track of time, misses async replies, forgets to commit or write notes
- **ARIA value:** Detects 3-hour focus block ending → surfaces wrap-up checklist

### Persona 3 — The Student / Researcher
- Juggling coursework, research, personal tasks across irregular hours
- Deadlines sneak up, poor awareness of personal time rhythm
- **ARIA value:** Learns weekly patterns → reminds about recurring deadlines before they're urgent

---

## 5. How The System Works

ARIA is a **6-layer pipeline**. Each layer has one job and feeds the next.

```
┌─────────────────────────────────────────────────────┐
│  L1 — Ingestion & Normalization                     │
│  Google Calendar + ActivityWatch + Notes Folder     │
│  → normalized event schema → SQLite                 │
└──────────────────────┬──────────────────────────────┘
                       │ every 15 min
┌──────────────────────▼──────────────────────────────┐
│  L2 — Three-Part Memory                             │
│  Episodic (what happened) + Semantic (facts/prefs)  │
│  + Procedural (habits/routines)                     │
│  → ChromaDB + SQLite                                │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L3 — Behavior Model                                │
│  Temporal rhythm (GNN) + Next-action prediction     │
│  + Cognitive state classifier                       │
│  → temporal_context_vector + cognitive_state        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L4 — Context Fusion Core                           │
│  time + calendar_lookahead + open_tasks             │
│  + behavior_model_output + cognitive_state          │
│  → unified context object                           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L5 — Urgency Engine                                │
│  Score urgency → Interrupt Gate → LLM text gen      │
│  (OpenRouter gemini-2.0-flash-exp:free)             │
│  → suggestion string + urgency score                │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L6 — Delivery Surfaces                             │
│  Electron tray popup → Expandable panel             │
│  → Dashboard (React + HeroUI)                       │
│  → Phone companion (Expo React Native)              │
└─────────────────────────────────────────────────────┘
```

### Privacy model
- All raw content is **embedded on-device** using `all-MiniLM-L6-v2` (~80MB, CPU-only)
- Only **embedding vectors + structured metadata** go to ChromaDB / SQLite
- The LLM call sends only a **compact context summary** — never raw note text or calendar descriptions
- No analytics, no telemetry, no third-party data sharing

### Urgency formula
```
urgency = (deadline_proximity × impact_weight) / cognitive_load_factor
```

### Interrupt gate rules
```
BLOCK if cognitive_state == "deep_focus"
BLOCK if a calendar event is currently active (user is in meeting)
QUEUE blocked suggestions → re-evaluate next cycle
DISCARD if queued for > 4 hours
```

### Feedback loop
Every user action (accept / dismiss / snooze / ignore) updates urgency weights via exponential moving average. ARIA gets calibrated to each individual over time.

---

## 6. What The App Does — Functional Requirements

### 6.1 Data Ingestion (L1)

| ID | Requirement |
|---|---|
| REQ-ING-01 | Connect to Google Calendar via OAuth 2.0 and pull events for the next 7 days on each 15-min cycle |
| REQ-ING-02 | Read ActivityWatch local REST API (`localhost:5600`) — pull app name, window title, duration per focus session |
| REQ-ING-03 | Watch a configurable notes folder (Obsidian / plain markdown) with `watchdog`; ingest changed files within 60 seconds |
| REQ-ING-04 | Normalize all events into a common schema: `{ source, type, timestamp, duration, title, metadata_json }` |
| REQ-ING-05 | Run ingestion every 15 minutes via APScheduler (configurable interval) |
| REQ-ING-06 | Deduplicate events by `source + external_id` before writing to SQLite |

### 6.2 Memory (L2)

| ID | Requirement |
|---|---|
| REQ-MEM-01 | Episodic memory stores every event with timestamp — supports time-range queries ("what happened last Tuesday morning?") |
| REQ-MEM-02 | Semantic memory extracts structured facts from notes via Ollama (Llama 3.2 3B) — e.g. recurring participants, project names, goals |
| REQ-MEM-03 | Procedural memory tracks: typical start time, app-focus sequences by hour/day, average meeting load per weekday |
| REQ-MEM-04 | All memory persists across restarts (ChromaDB persistent path + SQLite file) |
| REQ-MEM-05 | Supports relevance query: given a context vector, return top-K most similar past episodes within a time window |

### 6.3 Behavior Model (L3)

| ID | Requirement |
|---|---|
| REQ-BHV-01 | Phase 4a (first 2 weeks): Markov chain over `(hour_bucket, day_of_week) → next_activity_type` |
| REQ-BHV-02 | Phase 4b (after 3+ weeks of data): upgrade to PyTorch Geometric GNN on hierarchical calendar graph (hour → weekday → week-pattern nodes) |
| REQ-BHV-03 | Model outputs a `temporal_context_vector` representing the current moment's predicted state for this specific user |
| REQ-BHV-04 | Classify cognitive state as: `deep_focus` / `flow` / `normal` / `overloaded` — based on app-switching rate, meeting density, focus duration |
| REQ-BHV-05 | Re-train or re-weight weekly using the most recent 8 weeks of activity data |

### 6.4 Context Fusion (L4)

| ID | Requirement |
|---|---|
| REQ-CTX-01 | Fuse on every cycle: current timestamp + calendar events (next 2 hours) + open tasks with deadlines + behavior model output + cognitive state |
| REQ-CTX-02 | Output a structured context object passed to the Urgency Engine |
| REQ-CTX-03 | Detect named context pattern: "meeting in < 30 min + no prep note exists" → flag with elevated urgency |

### 6.5 Urgency Engine (L5)

| ID | Requirement |
|---|---|
| REQ-URG-01 | Compute urgency score per candidate suggestion using the formula above |
| REQ-URG-02 | Interrupt Gate blocks delivery during `deep_focus` or active calendar event |
| REQ-URG-03 | Blocked suggestions queue and re-evaluate next cycle; expire after 4 hours |
| REQ-URG-04 | LLM prompt to OpenRouter ≤ 300 tokens; use model `google/gemini-2.0-flash-exp:free` |
| REQ-URG-05 | After each feedback event, re-calibrate urgency weights via exponential moving average |

### 6.6 Delivery Surfaces (L6)

| ID | Requirement |
|---|---|
| REQ-DEL-01 | System tray icon always visible on Windows while daemon is running |
| REQ-DEL-02 | Compact popup: frameless Electron window, 360×120px, bottom-right, always-on-top |
| REQ-DEL-03 | Clicking popup body expands to detailed panel (360×420px) with full suggestion + reasoning + action buttons |
| REQ-DEL-04 | Popup auto-dismisses after 12 seconds with countdown bar; auto-dismiss recorded as "ignored" |
| REQ-DEL-05 | Clicking tray icon opens full dashboard in a separate Electron window |
| REQ-DEL-06 | Dashboard shows: today's schedule + active suggestions + suggestion history + learned habits + settings |
| REQ-DEL-07 | Phone companion receives nudges via local WiFi (direct IP, no cloud relay); syncs accept/dismiss back to desktop |

---

## 7. How The App Behaves — Non-Functional Requirements

| Category | ID | Spec |
|---|---|---|
| Performance | NFR-01 | Background CPU ≤ 2% on idle cycles (mid-range Windows machine, i5, 8GB RAM) |
| Performance | NFR-02 | End-to-end latency (context eval → popup): < 3s without LLM, < 8s with LLM |
| Performance | NFR-03 | Electron popup renders within 200ms of IPC signal from Python backend |
| Privacy | NFR-04 | Raw note content, calendar descriptions, email subjects never transmitted to any remote server |
| Privacy | NFR-05 | OpenRouter payload contains only structured metadata + synthetic context summary — no literal user content |
| Privacy | NFR-06 | All local data (SQLite, ChromaDB) stored in `%APPDATA%\ARIA`, deletable from settings UI |
| Reliability | NFR-07 | Python daemon auto-restarts on crash via pm2 |
| Reliability | NFR-08 | If OpenRouter unavailable → fall back to local Ollama for suggestion generation |
| Reliability | NFR-09 | Network loss doesn't crash daemon; calendar sync queues and retries next cycle |
| Usability | NFR-10 | First-time setup completable in < 10 minutes (Google OAuth + ActivityWatch install) |
| Usability | NFR-11 | Zero configuration required after OAuth — ARIA works out of the box |
| Security | NFR-12 | Google OAuth tokens stored in Windows Credential Store via `keyring` library — never plaintext |
| Security | NFR-13 | FastAPI binds to `127.0.0.1` only; phone companion authenticates with a shared secret Bearer token |
| Compatibility | NFR-14 | Desktop: Windows 10 (1903+) and Windows 11 |
| Compatibility | NFR-15 | Mobile: Android 9+ and iOS 14+ |

---

## 8. Tech Stack

### Backend — Python daemon

| What | Tool | Why |
|---|---|---|
| Scheduler | `APScheduler 3.x` | Runs all periodic jobs (ingest, eval, retrain) |
| Calendar | `google-auth-oauthlib` + `googleapiclient` | OAuth2 Google Calendar API v3 |
| Activity tracking | `ActivityWatch` (external daemon) | Free, local, logs app focus time — ARIA reads via REST at `localhost:5600` |
| Notes watcher | `watchdog 3.x` | File system events on notes folder |
| Database | `sqlite3` (stdlib) | Zero config, zero cost, stores everything |
| Vector store | `ChromaDB 0.5.x` | Local persistent vector DB for memory retrieval |
| Embeddings | `sentence-transformers` + `all-MiniLM-L6-v2` | ~80MB, CPU-only, fully on-device |
| Local LLM | `Ollama` + `llama3.2:3b` | On-device fact extraction + LLM fallback |
| Cloud LLM | `OpenRouter` free tier | `gemini-2.0-flash-exp:free` for natural-language suggestion text |
| ML | `PyTorch 2.x` + `PyTorch Geometric` | GNN training for temporal rhythm model (Phase 4b) |
| Credentials | `keyring 24.x` | Stores OAuth tokens in Windows Credential Store |
| API server | `FastAPI` + `uvicorn` | Serves dashboard + phone companion endpoints |
| IPC | `websockets` | Pushes suggestions from Python → Electron renderer in real time |
| Process manager | `pm2` | Auto-restart on crash; runs daemon as managed background process |

### Desktop UI — Electron + React

| What | Tool | Why |
|---|---|---|
| App shell | `Electron 30.x` | System tray, frameless windows, IPC, Windows installer |
| UI framework | `React 18` + `Vite` | Component-based UI, fast dev server |
| Component library | `HeroUI` (formerly NextUI) | Pre-built Cards, Chips, Badges, Modals, Buttons — no custom styling |
| Styling | `Tailwind CSS 3.x` | Required by HeroUI; utility-first |
| State | `Zustand` | Lightweight global state for suggestions + settings |
| Data fetching | `TanStack Query` | Queries FastAPI; caching + background refresh |
| Charts | `Recharts` | Habit timelines + suggestion history in dashboard |
| Icons | `Lucide React` | Consistent open-source icons throughout |

### Phone companion — React Native

| What | Tool | Why |
|---|---|---|
| Framework | `Expo SDK 51` | Android + iOS from one codebase; no Mac needed for Android |
| UI + navigation | `NativeWind` + `Expo Router` | Tailwind-style utilities + file-based routing |
| Notifications | `expo-notifications` | Push nudges when phone is away from desktop WiFi |
| Networking | `fetch()` over LAN | Direct HTTP to desktop FastAPI on local IP — no cloud relay |
| Auth | Bearer token in `expo-secure-store` | Validates desktop connection |

---

## 9. UI & Screens

### 9.1 System Tray Icon

```
States:
  ● Gray dot     → idle, daemon running, no pending nudge
  ● Blue dot     → suggestion queued or recently delivered
  ● Gray muted   → suppressed (user paused ARIA)

Right-click menu:
  Open Dashboard
  Pause for 1 hour
  Settings
  Quit ARIA

Left-click → open full dashboard window
```

### 9.2 Compact Tray Popup

```
┌──────────────────────────────────────────┐
│ ▌ [ARIA]  Meeting in 18 min              │  ← 360×120px
│   No prep note found for Sprint Review   │    frameless
│                      ✓  ⏰  ✕           │    always-on-top
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░  │  ← 12s countdown bar
└──────────────────────────────────────────┘
  ↑ left color bar = urgency (green/amber/red)
  
Click anywhere on card body → expand to detail panel
```

**Component:** HeroUI `Card` with custom left border, three `IconButton` components, animated slide-in from bottom-right (180ms cubic-ease).

### 9.3 Expanded Detail Panel

```
┌──────────────────────────────────────────┐
│ ● URGENT                    [×]          │  ← 360×420px
│                                          │    expands from compact
│ Sprint Review in 18 minutes              │    (220ms animation)
│                                          │
│ ARIA noticed:                            │
│ • Meeting starts at 2:00 PM              │
│ • No prep note found in /notes/sprint    │
│ • You usually prep 30 min before         │
│   meetings with > 3 attendees            │
│                                          │
│ [calendar chip] [deep_focus chip]        │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │  ✓ Accept   │  Snooze ▾  │  Dismiss │ │
│ └──────────────────────────────────────┘ │
│                                          │
│   Snooze: 15 min | 1 hour | After mtg   │
└──────────────────────────────────────────┘

Keyboard: Enter = Accept  |  Esc = Dismiss  |  S = Snooze 15 min
```

**Components:** HeroUI `Card`, `Badge`, `Chip`, `Button`, `Dropdown` for snooze options.

### 9.4 Full Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  ARIA                            ⚙  [Today] [History] [...]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tab 1 — Today                                              │
│  ┌─────────────────┐  ┌───────────────────────────────────┐ │
│  │ Focus state     │  │ Schedule timeline                 │ │
│  │ 🟢 Normal       │  │ 9:00  Standup                     │ │
│  │                 │  │ 11:00 Focus block ████████        │ │
│  │ Next eval: 8min │  │ 14:00 Sprint Review ← upcoming   │ │
│  └─────────────────┘  └───────────────────────────────────┘ │
│                                                             │
│  Active suggestions (2)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ● Meeting in 18 min — No prep note found  [Act] [×] │   │
│  │ ○ 3 unread Slack messages from @team       [Snooze]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Tab 2 — History                                            │
│  Filter: [All ▾]  [This week ▾]                             │
│  Table: suggestion | outcome | timestamp | urgency score    │
│                                                             │
│  Tab 3 — Habits                                             │
│  Recharts bar chart: activity by hour/day                   │
│  Detected routines:                                         │
│  "You typically start deep work at 9:30am on Tuesdays"      │
│  "Meetings cluster Wednesday afternoons"                    │
│                                                             │
│  Tab 4 — Settings                                           │
│  Notes folder path | Google account | Thresholds           │
│  Phone pairing (QR code) | Data export | Clear all data     │
└─────────────────────────────────────────────────────────────┘
```

**Window:** Separate Electron BrowserWindow, 1100×700px, resizable. React SPA with HeroUI `Tabs`, `Table`, `Card`, `Switch`, `Slider` components.

### 9.5 Phone Companion Screens

```
Screen 1 — Home (nudge list)
  Today's nudges, each tappable to expand
  Accept / Dismiss syncs back to desktop

Screen 2 — Quick Task
  Minimal text input → adds task to ARIA's store

Screen 3 — Settings
  Desktop IP pairing (manual entry or QR scan)
  Notification preferences
```

---

## 10. Project Folder Structure

```
aria/
├── aria-backend/                    # Python daemon
│   ├── connectors/
│   │   ├── google_calendar.py       # OAuth2, pulls next 7 days of events
│   │   ├── activity_watcher.py      # Reads ActivityWatch REST API at localhost:5600
│   │   └── notes_watcher.py         # watchdog on configured notes folder
│   ├── storage/
│   │   ├── db.py                    # SQLite schema + query helpers
│   │   ├── memory.py                # ChromaDB interface (embed, store, query)
│   │   └── models.py                # Python dataclasses for all data types
│   ├── engine/
│   │   ├── behavior_model.py        # Markov chain (v1) → GNN (v2) temporal model
│   │   ├── context_fusion.py        # Merges all signals into unified context object
│   │   ├── urgency_engine.py        # Scoring formula + LLM call to OpenRouter
│   │   └── interrupt_gate.py        # Blocks/queues based on cognitive state
│   ├── api/
│   │   ├── main.py                  # FastAPI app + WebSocket endpoint
│   │   ├── routes/
│   │   │   ├── nudges.py            # GET /nudges/active, POST /nudges/{id}/feedback
│   │   │   ├── schedule.py          # GET /schedule/today
│   │   │   ├── habits.py            # GET /habits
│   │   │   ├── memory.py            # GET /memory/query
│   │   │   ├── tasks.py             # POST /tasks
│   │   │   └── settings.py          # GET/PUT /settings
│   │   └── websocket.py             # WS /ws/nudges → push to Electron
│   ├── scheduler.py                 # APScheduler setup — registers all periodic jobs
│   ├── main.py                      # Entry point — starts daemon + scheduler + uvicorn
│   └── requirements.txt
│
├── aria-desktop/                    # Electron + React frontend
│   ├── electron/
│   │   ├── main.js                  # Tray icon, window management, IPC handlers
│   │   ├── preload.js               # Electron contextBridge — exposes IPC to renderer
│   │   └── icons/                   # Tray icon PNGs (idle, active, muted)
│   ├── src/
│   │   ├── components/
│   │   │   ├── TrayPopup.jsx        # Compact 360×120 nudge card
│   │   │   ├── ExpandedPanel.jsx    # Detailed 360×420 panel with actions
│   │   │   ├── Dashboard.jsx        # Full dashboard shell with tab routing
│   │   │   ├── TodayTab.jsx         # Schedule timeline + active suggestions
│   │   │   ├── HistoryTab.jsx       # Suggestion log with filters
│   │   │   ├── HabitsTab.jsx        # Recharts + detected routines text
│   │   │   └── SettingsTab.jsx      # All settings controls
│   │   ├── store/
│   │   │   └── useARIA.js           # Zustand store — suggestions, settings, state
│   │   ├── hooks/
│   │   │   ├── useNudges.js         # TanStack Query — fetches active nudges
│   │   │   ├── useSchedule.js       # TanStack Query — fetches today's calendar
│   │   │   └── useWebSocket.js      # WebSocket connection to Python backend
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── aria-mobile/                     # Expo React Native companion
│   ├── app/
│   │   ├── index.jsx                # Home screen — nudge list
│   │   ├── tasks.jsx                # Quick task input screen
│   │   └── settings.jsx             # Desktop pairing + notification prefs
│   ├── components/
│   │   ├── NudgeCard.jsx            # Tappable nudge item with accept/dismiss
│   │   └── QuickTaskInput.jsx       # Minimal task entry component
│   ├── hooks/
│   │   └── useDesktopAPI.js         # fetch() to desktop FastAPI over LAN
│   ├── app.json
│   └── package.json
│
└── docs/
    ├── architecture.md
    ├── api-reference.md
    └── setup-guide.md
```

---

## 11. Database Schema

All data lives in SQLite at `%APPDATA%\ARIA\aria.db`.

### Table: `events`
Normalized ingested data from all sources.

```sql
CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id  TEXT UNIQUE,           -- Source system ID for deduplication
  source       TEXT NOT NULL,         -- 'google_calendar' | 'activitywatch' | 'notes'
  type         TEXT NOT NULL,         -- 'meeting' | 'focus' | 'note_update' | 'task' | 'break'
  title        TEXT,                  -- Human-readable title (never sent to cloud)
  start_ts     INTEGER NOT NULL,      -- Unix timestamp
  end_ts       INTEGER,               -- Unix timestamp (NULL for point-in-time events)
  metadata_json TEXT,                 -- JSON blob: attendees, app name, file path, etc.
  embedding_id TEXT,                  -- ChromaDB document ID for this event
  created_at   INTEGER NOT NULL       -- When this row was inserted
);

CREATE INDEX idx_events_source ON events(source);
CREATE INDEX idx_events_start_ts ON events(start_ts);
CREATE INDEX idx_events_type ON events(type);
```

### Table: `nudge_log`
Every suggestion generated, delivered, and its outcome.

```sql
CREATE TABLE nudge_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  generated_at    INTEGER NOT NULL,   -- When suggestion was created
  delivered_at    INTEGER,            -- When popup was shown (NULL if queued/suppressed)
  urgency_score   REAL NOT NULL,      -- Computed score 0.0–1.0
  context_json    TEXT NOT NULL,      -- Snapshot of fused context that triggered this
  suggestion_text TEXT NOT NULL,      -- Natural-language text shown to user
  surface         TEXT,               -- 'popup' | 'phone' | 'silent'
  outcome         TEXT,               -- 'accepted' | 'dismissed' | 'snoozed' | 'ignored' | 'expired'
  snoozed_until   INTEGER,            -- Re-evaluate timestamp (NULL if not snoozed)
  feedback_weight REAL                -- Weight contribution to urgency recalibration
);

CREATE INDEX idx_nudge_log_generated_at ON nudge_log(generated_at);
CREATE INDEX idx_nudge_log_outcome ON nudge_log(outcome);
```

### Table: `habits`
Learned procedural memory — user routines and patterns.

```sql
CREATE TABLE habits (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_type        TEXT NOT NULL,    -- 'start_time' | 'focus_block' | 'meeting_pattern' | 'app_sequence'
  pattern_json      TEXT NOT NULL,    -- JSON: {day: 'tuesday', hour: 9, activity: 'focus'}
  confidence        REAL NOT NULL,    -- 0.0–1.0 based on observed frequency
  observation_count INTEGER NOT NULL DEFAULT 0,
  last_seen         INTEGER NOT NULL, -- Most recent observation (unix timestamp)
  is_active         INTEGER NOT NULL DEFAULT 1  -- 1 = in use by behavior model
);
```

### Table: `settings`
Key-value store for user preferences.

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL               -- JSON-encoded value
);

-- Default rows inserted on first run:
-- notes_folder_path | interrupt_deep_focus | interrupt_in_meeting
-- max_nudges_per_day | snooze_default_minutes | openrouter_model
```

---

## 12. API Endpoints

All endpoints on `http://127.0.0.1:8742`. Auth: `Authorization: Bearer <token>` (token stored in Windows Credential Store).

### REST

| Method | Endpoint | Description | Response |
|---|---|---|---|
| `GET` | `/api/status` | Daemon health, cognitive state, next eval time | `{ status, cognitive_state, next_eval_ts }` |
| `GET` | `/api/nudges/active` | All suggestions currently queued or snoozed | `[{ id, text, urgency, surface, snoozed_until }]` |
| `GET` | `/api/nudges/history` | Paginated suggestion history with outcome filter | `{ items, total, page }` |
| `POST` | `/api/nudges/{id}/feedback` | Record user outcome for a suggestion | `{ ok: true }` |
| `GET` | `/api/schedule/today` | Today's calendar events from local store | `[{ title, start_ts, end_ts, type }]` |
| `GET` | `/api/habits` | All active habit patterns with confidence | `[{ habit_type, pattern_json, confidence }]` |
| `GET` | `/api/memory/query?q=...` | Semantic search over episodic memory | `[{ event_id, score, summary }]` |
| `POST` | `/api/tasks` | Add quick task from phone companion | `{ id, created_at }` |
| `GET` | `/api/settings` | Current user settings | settings object |
| `PUT` | `/api/settings` | Update settings | `{ ok: true }` |
| `POST` | `/api/eval/trigger` | Manually trigger evaluation cycle (dev/debug) | `{ suggestions_generated: N }` |

### WebSocket

| Endpoint | Direction | Payload |
|---|---|---|
| `WS /ws/nudges` | Server → Electron | `{ event: "nudge", data: { id, text, urgency, context } }` |
| `WS /ws/nudges` | Electron → Server | `{ event: "feedback", data: { id, outcome } }` |

---

## 13. Build Plan — Phase by Phase

> Build in order. Each phase is a working, testable product on its own. Don't skip ahead.

---

### Phase 1 — Data Pipeline `Week 1`

**Goal:** Real data flowing into SQLite. No AI yet.

**What to build:**
- `connectors/google_calendar.py` — OAuth2 flow, pull next 7 days, write to `events` table
- `connectors/activity_watcher.py` — poll `localhost:5600/api/0/buckets`, parse app focus, write to `events`
- `connectors/notes_watcher.py` — watchdog on configured folder, write note-change events
- `storage/db.py` — SQLite schema creation + insert/query helpers
- `scheduler.py` — APScheduler, 15-min ingestion loop
- `main.py` — entry point, starts everything

**Done when:** Running `python main.py` fills `aria.db` with real calendar events and app activity. You can query the DB and see your day.

**Prerequisites:**
```
1. Install ActivityWatch → https://activitywatch.net (runs as background service on Windows)
2. Google Cloud Console → create project → enable Calendar API → create OAuth Desktop credentials
3. pip install google-auth-oauthlib google-api-python-client apscheduler watchdog
```

---

### Phase 2 — Rule-Based Nudges `Week 2`

**Goal:** First working nudges using hardcoded rules. Proves the end-to-end pipeline.

**What to build:**
- `engine/context_fusion.py` — reads DB, builds a context object every 15 min
- `engine/urgency_engine.py` — hardcoded rules (no ML yet):
  - If meeting in < 30 min AND no file modified in `/notes/` with meeting title keywords → generate nudge
  - If day has 5+ meetings → flag as high-load, adjust urgency threshold
- OS notification via `notify-py` (no UI yet, just system notification)
- `storage/nudge_log` writes — record every generated suggestion

**Done when:** ARIA fires a Windows notification 25 minutes before a meeting when you have no prep note. You can see the suggestion in the DB.

```
pip install notify-py
```

---

### Phase 3 — Memory Layer `Week 3`

**Goal:** ARIA remembers things across sessions and can retrieve relevant past context.

**What to build:**
- `storage/memory.py` — ChromaDB wrapper:
  - `embed_and_store(text, metadata)` — encode with all-MiniLM-L6-v2, store in Chroma
  - `query(text, n=5, time_window=None)` — semantic similarity search
- Ingest pipeline calls `memory.py` on every new event
- Ollama integration in `connectors/notes_watcher.py`:
  - On each note change, call Ollama `llama3.2:3b` to extract facts → write to `habits` table
- `habits` table population for procedural memory (start times, focus patterns)

**Done when:** You can run `memory.query("sprint review prep")` and get relevant past episodes back. The `habits` table has real entries.

```
pip install chromadb sentence-transformers
# Install Ollama: https://ollama.com
ollama pull llama3.2:3b
```

---

### Phase 4 — Behavior Model `Week 4–5`

**Goal:** ARIA predicts what you need based on your personal patterns, not generic rules.

**What to build:**

**Phase 4a — Markov chain (start immediately):**
```python
# In behavior_model.py
# Build transition table: (hour_bucket, day_of_week) → most_likely_next_activity
# From last 3+ weeks of events table
# Output: predicted_next_activity + confidence
```

**Phase 4b — GNN (after 3 weeks of data, optional upgrade):**
- Build hierarchical calendar graph: hour_nodes → weekday_nodes → week_pattern_nodes
- Train PyTorch Geometric GNN on this graph using event sequences as supervision
- Output replaces Markov chain: richer `temporal_context_vector`

**Also build:**
- Cognitive state classifier in `behavior_model.py`:
  - Count app switches per 30-min window → high = `overloaded`, low sustained = `deep_focus`
  - Combine with meeting density → classify as `deep_focus` / `flow` / `normal` / `overloaded`

**Done when:** `behavior_model.predict(now)` returns a state + predicted next activity that matches your real patterns.

```
pip install torch torch-geometric
```

---

### Phase 5 — LLM Suggestion Generator + Interrupt Gate `Week 5–6`

**Goal:** Natural-language nudges generated by an LLM, gated so they only appear when you can receive them.

**What to build:**
- `engine/interrupt_gate.py`:
  ```python
  def should_deliver(cognitive_state, active_events) -> bool:
      if cognitive_state in ("deep_focus",):
          return False
      if any(e.start_ts <= now <= e.end_ts for e in active_events):
          return False  # In a meeting
      return True
  ```
- LLM call in `urgency_engine.py`:
  ```python
  def generate_suggestion(context: dict) -> str:
      prompt = build_compact_prompt(context)  # ≤ 300 tokens, no raw user content
      response = requests.post(
          "https://openrouter.ai/api/v1/chat/completions",
          headers={"Authorization": f"Bearer {OPENROUTER_KEY}"},
          json={
              "model": "google/gemini-2.0-flash-exp:free",
              "messages": [{"role": "user", "content": prompt}]
          }
      )
      return response.json()["choices"][0]["message"]["content"]
  ```
- Snooze queue — suggestions blocked by gate go to queue, re-evaluated next cycle
- Fallback to Ollama if OpenRouter call fails

**Done when:** ARIA generates a natural-language nudge, checks the gate (won't fire during a meeting), and the nudge text is specific and readable.

```
pip install requests
# Sign up at openrouter.ai → free tier → get API key
```

---

### Phase 6 — Desktop App (Electron + React + HeroUI) `Week 6–7`

**Goal:** Real installable Windows app with tray icon, popup, expandable panel, and full dashboard.

**What to build:**

**Electron shell (`aria-desktop/electron/main.js`):**
```javascript
// System tray icon
const tray = new Tray(path.join(__dirname, 'icons/idle.png'))
tray.on('click', () => dashboardWindow.show())

// Popup window — frameless, always-on-top, bottom-right
const popupWin = new BrowserWindow({
  width: 360, height: 120,
  frame: false, alwaysOnTop: true, skipTaskbar: true,
  x: screen.width - 376, y: screen.height - 136,
  webPreferences: { preload: path.join(__dirname, 'preload.js') }
})

// WebSocket client — listens for nudges from Python backend
// On nudge received → show popup window, load nudge data via IPC
```

**React components:**
- `TrayPopup.jsx` — HeroUI `Card`, left urgency bar, text, 3 icon buttons, countdown bar
- `ExpandedPanel.jsx` — HeroUI `Card` with full reasoning, `Chip` for context tags, `Button` group with `Dropdown` for snooze
- `Dashboard.jsx` — HeroUI `Tabs` → `TodayTab`, `HistoryTab`, `HabitsTab`, `SettingsTab`
- `TodayTab.jsx` — schedule timeline (Recharts), active suggestions list
- `HistoryTab.jsx` — HeroUI `Table` with pagination + outcome filter
- `HabitsTab.jsx` — Recharts bar chart, habits list as readable sentences
- `SettingsTab.jsx` — HeroUI `Input`, `Switch`, `Slider`, `Button` for QR pairing

**FastAPI dashboard API** — connect all routes from Phase 5.

**Done when:** `npm start` opens a real Electron app. Tray icon is visible. A test nudge shows as a popup. Clicking expands it. Accepting updates the DB.

```
npm create vite@latest aria-desktop -- --template react
npm install electron @heroui/react tailwindcss zustand @tanstack/react-query recharts lucide-react
```

---

### Phase 7 — Phone Companion (Expo React Native) `Week 8`

**Goal:** Android/iOS app that receives nudges when you're away from the desktop.

**What to build:**
- `app/index.jsx` — list of today's nudges from `GET /api/nudges/active`, each with Accept/Dismiss
- `app/tasks.jsx` — simple text input → `POST /api/tasks`
- `app/settings.jsx` — manual IP entry or QR code scan to pair with desktop
- `hooks/useDesktopAPI.js` — wraps `fetch()` to desktop LAN IP with Bearer token
- Desktop: add logic to skip phone delivery if popup was already interacted with

**Done when:** Phone app shows the same nudges as desktop. Dismissing on phone is reflected in desktop dashboard.

```
npx create-expo-app aria-mobile
cd aria-mobile
npx expo install expo-notifications expo-secure-store expo-router nativewind
```

---

## 14. Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Not enough data for behavior model in first 2 weeks | High | Rule-based engine (Phase 2) provides real value immediately. Model is an upgrade layer, not a dependency. |
| 2 | OpenRouter free tier rate limits | Medium | Local Ollama fallback. Cache suggestion text for repeated contexts. Max 4 eval cycles/hour. |
| 3 | Google OAuth token expires or gets revoked | Medium | Refresh tokens via `google-auth-oauthlib`. Dashboard shows reconnect prompt. Daemon continues on cached data. |
| 4 | ActivityWatch not installed | Medium | Graceful degradation — system runs on calendar only. Clear onboarding prompt during setup. |
| 5 | Electron app too heavy on low-spec machines | Low–Med | Keep renderer process minimal. Dashboard loads lazily. Popup is a separate lightweight window. |
| 6 | Phone LAN discovery fails (VPN, firewall) | Medium | Manual IP entry. QR scan option. Phase 7 is optional — desktop-only is a complete product. |
| 7 | GNN needs more data than available | Low | Markov chain is the permanent fallback. GNN gated behind explicit data sufficiency check (≥ 3 weeks). |
| 8 | Interrupt gate too aggressive | Low | All suppressed suggestions queue and surface next window. Dashboard shows full queue. Thresholds configurable in settings. |

---

## 15. Success Metrics

All measured from the `nudge_log` table — no external analytics.

| Metric | Week 4 Target | Week 8 Target |
|---|---|---|
| Suggestion acceptance rate | ≥ 30% | ≥ 50% |
| Active dismissal rate | ≤ 35% | ≤ 20% |
| Auto-ignored rate | ≤ 40% | ≤ 25% |
| Gate suppression rate | 40–70% | 50–75% |
| Nudges delivered per day | 3–8 | 4–10 |

**System health:**
- Daemon uptime > 99% during active hours (8am–10pm)
- Ingestion cycle success rate > 98%
- P95 end-to-end latency < 5s with LLM, < 1s without
- Local DB growth < 50 MB/month

---

## 16. Open Questions

1. **Multi-account Google Calendar** — scope to one account in v1, add multi-account in v1.1
2. **Explicit user labels** ("this was a focus session") vs pure implicit signals — recommend implicit-only in v1 to reduce user burden
3. **Deep focus interrupt threshold** — block all nudges, or allow urgency > 0.9 to break through? Default: block all, configurable
4. **Phone relay mode** — desktop-required in v1 for privacy; optional cloud relay considered for v1.1
5. **LAN discovery** — mDNS vs manual IP vs QR code → recommend QR code in settings for simplicity
6. **Re-surface dismissed suggestions** — recommend: same suggestion type suppressed for 24h after explicit dismiss, configurable
7. **Windows startup** — should ARIA start on Windows login by default? Recommend: ask during first-run setup

---

## 17. Glossary

| Term | Definition |
|---|---|
| **Behavior model** | ML component that learns per-user temporal patterns and predicts next likely activity |
| **ChromaDB** | Open-source local vector database for semantic memory storage |
| **Cognitive state** | Current classification of user's mental load: `deep_focus` / `flow` / `normal` / `overloaded` |
| **Context Fusion Core** | Component that merges all real-time signals into a unified context object |
| **Episodic memory** | Memory of specific past events — what, when, with whom |
| **GNN** | Graph Neural Network — used to model temporal rhythms on a hierarchical calendar graph |
| **Interrupt Gate** | Logic that decides whether a suggestion is delivered now or queued |
| **Nudge** | A proactive suggestion surfaced by ARIA without being explicitly requested |
| **Ollama** | Free tool for running LLMs locally on consumer hardware |
| **OpenRouter** | Free-tier LLM API router providing access to Gemini Flash at no cost |
| **Procedural memory** | Memory of habits and routines — how the user behaves at given times |
| **Semantic memory** | Memory of facts and preferences extracted from notes |
| **Urgency score** | Real number 0.0–1.0: `(deadline_proximity × impact_weight) / cognitive_load_factor` |
| **ActivityWatch** | Free, open-source, privacy-first app that logs application focus data locally |

---

## 18. Dependencies & Licenses

All free for personal use. Zero paid licenses required.

| Package | License | Use |
|---|---|---|
| ActivityWatch | MPL 2.0 | Local activity tracking daemon |
| Ollama | MIT | Local LLM inference server |
| Llama 3.2 3B | Meta Community License (free) | On-device LLM for fact extraction + fallback |
| sentence-transformers | Apache 2.0 | all-MiniLM-L6-v2 on-device embedding |
| ChromaDB | Apache 2.0 | Local vector store |
| PyTorch | BSD 3-Clause | GNN and ML model training |
| PyTorch Geometric | MIT | GNN layer implementations |
| APScheduler | MIT | Background job scheduling |
| FastAPI | MIT | Internal API server |
| google-auth-oauthlib | Apache 2.0 | Google Calendar OAuth 2.0 |
| watchdog | Apache 2.0 | File system monitoring |
| keyring | MIT | OS credential storage |
| notify-py | MIT | OS notifications (Phase 2 only) |
| Electron | MIT | Desktop app shell |
| React 18 | MIT | UI framework |
| HeroUI | MIT | React UI component library |
| Tailwind CSS | MIT | Utility CSS framework |
| Zustand | MIT | React state management |
| TanStack Query | MIT | Data fetching + caching |
| Recharts | MIT | Chart components |
| Expo SDK 51 | MIT | React Native toolchain |
| OpenRouter API | SaaS free tier | Cloud LLM routing — no cost on free tier |

> **OpenRouter free tier note:** `gemini-2.0-flash-exp:free` has a daily request quota. At the default 15-minute evaluation cycle, ARIA makes at most 96 LLM calls per day — well within the free limit for a single user.

---

*ARIA PRD v1.0 — Built for vibe coding. Each phase is self-contained. Start at Phase 1 and ship something real every week.*
