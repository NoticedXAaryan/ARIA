# ARIA — Anticipatory Reasoning & Intelligent Assistance

ARIA is a **proactive, local-first AI assistant** that runs silently in the background on Windows, learns how you work, and surfaces smart suggestions at the right moment — without being asked. It fuses calendar, app activity, and notes data every 15 minutes, scores what matters, and delivers a quiet popup when you're interruptible.

> **v0.1.0** · Phase 2.5 complete · Zero-cost stack · Privacy-first

---

## Documentation Map

| Document | Purpose | Audience |
|---|---|---|
| **This file** | Quick orientation, what's built, how to run | Everyone |
| [AGENTS.md](./AGENTS.md) | Agent onboarding, work loop, priorities, guardrails | Coding agents |
| [ARIA_PRD.md](./ARIA_PRD.md) | Full requirements & architecture contract (930 lines) | Product & engineering |
| [ARIA_WORKFLOW_CHECKLIST.md](./ARIA_WORKFLOW_CHECKLIST.md) | Phase-by-phase build tracker with test status | Active developers |
| [docs/architecture.md](./docs/architecture.md) | System architecture, file mapping, data flow | Engineering reference |
| [docs/api-reference.md](./docs/api-reference.md) | All REST + WebSocket endpoints with schemas | Frontend & mobile devs |
| [docs/setup-guide.md](./docs/setup-guide.md) | Full installation & configuration walkthrough | First-time setup |

---

## What's Built

| Layer | Status | Component |
|---|---|---|
| Backend daemon | ✅ Running | Python + FastAPI + APScheduler on `127.0.0.1:8742` |
| Data ingestion | ✅ Working | Google Calendar, ActivityWatch, Notes folder |
| Storage | ✅ Working | SQLite (`%APPDATA%\ARIA\aria.db`) + ChromaDB vectors |
| Rule engine | ✅ Working | Context fusion → urgency scoring → interrupt gate |
| Behavior model | ⚠️ Basic | Markov chain + cognitive state classifier |
| LLM nudges | ⚠️ Partial | OpenRouter free tier (no Ollama fallback yet) |
| Desktop app | ⚠️ Scaffold | Electron + React + Vite (UI stubs, builds OK) |
| Mobile companion | ⚠️ Scaffold | Expo React Native (builds OK, pairing incomplete) |

---

## Quick Start

> Full walkthrough with prerequisites → [docs/setup-guide.md](./docs/setup-guide.md)

```bash
# 1. Backend
python -m venv .venv && .venv\Scripts\activate
pip install -r aria-backend/requirements.txt
copy .env.example .env        # fill in your values
python aria-backend/main.py

# 2. Desktop (separate terminal)
cd aria-desktop && npm install && npm run dev
# Electron shell (third terminal): npm run electron

# 3. Mobile (separate terminal)
cd aria-mobile && npm install && npx expo start
```

---

## Verification

```bash
pytest aria-backend/tests -q                                              # backend tests
cd aria-desktop && npm run build                                          # desktop build
cd aria-mobile && npx expo export --platform android --output-dir dist-test  # mobile export
```

---

## Runtime Behavior

- Missing Google credentials → calendar ingestion skips gracefully
- Missing ActivityWatch → other sources continue to ingest
- Missing OpenRouter key → nudge text falls back to rule-generated defaults
- Missing Ollama → no local LLM, rules-only mode

---

## Architecture at a Glance

```
Connectors (Calendar, ActivityWatch, Notes)
    ↓ every 15 min
SQLite + ChromaDB (events, memory, habits)
    ↓
Context Fusion → Behavior Model → Urgency Engine
    ↓
Interrupt Gate (blocks during focus/meetings)
    ↓
Delivery: Tray Popup → Dashboard → Mobile Companion
```

> Full architecture reference → [docs/architecture.md](./docs/architecture.md)
