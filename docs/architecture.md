# ARIA Architecture Reference

## Six-Layer Pipeline

ARIA processes context through a 6-layer pipeline, executing on a 15-minute APScheduler cycle.

```
┌─────────────────────────────────────────────────────┐
│  L1 — Ingestion & Normalization                     │
│  google_calendar.py + activity_watcher.py           │
│  + notes_watcher.py                                 │
│  → NormalizedEvent → SQLite events table            │
└──────────────────────┬──────────────────────────────┘
                       │ every 15 min
┌──────────────────────▼──────────────────────────────┐
│  L2 — Memory                                        │
│  memory.py → ChromaDB (all-MiniLM-L6-v2 embeddings)│
│  db.py → habits table (procedural patterns)         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L3 — Behavior Model                                │
│  behavior_model.py                                  │
│  → Markov chain predictions + cognitive state       │
│  → deep_focus | flow | normal | overloaded          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L4 — Context Fusion                                │
│  context_fusion.py                                  │
│  → unified context object (time + calendar          │
│    + notes + behavior + cognitive state)             │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L5 — Urgency Engine + Interrupt Gate               │
│  urgency_engine.py + interrupt_gate.py              │
│  → urgency score + delivery decision                │
│  → OpenRouter LLM text (optional)                   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  L6 — Delivery Surfaces                             │
│  Electron tray popup + Dashboard + Mobile companion │
└─────────────────────────────────────────────────────┘
```

---

## File-to-Layer Mapping

### Layer 1 — Ingestion

| File | Responsibility |
|---|---|
| `aria-backend/connectors/google_calendar.py` | OAuth2 Google Calendar API → pulls 7 days of events |
| `aria-backend/connectors/activity_watcher.py` | Polls ActivityWatch REST API at `localhost:5600` |
| `aria-backend/connectors/notes_watcher.py` | Scans configured markdown notes folder for changes |
| `aria-backend/storage/models.py` | `NormalizedEvent` and `NudgeCandidate` dataclasses |

### Layer 2 — Memory & Storage

| File | Responsibility |
|---|---|
| `aria-backend/storage/db.py` | SQLite schema, CRUD for events/nudges/habits/settings/tasks |
| `aria-backend/storage/memory.py` | ChromaDB wrapper: embed with `all-MiniLM-L6-v2`, semantic query |

### Layer 3 — Behavior Model

| File | Responsibility |
|---|---|
| `aria-backend/engine/behavior_model.py` | Markov chain `(hour, weekday) → next_activity` + cognitive state classifier |

### Layer 4 — Context Fusion

| File | Responsibility |
|---|---|
| `aria-backend/engine/context_fusion.py` | Builds unified context: upcoming events + notes + behavior prediction + cognitive state |

### Layer 5 — Urgency & Delivery Decision

| File | Responsibility |
|---|---|
| `aria-backend/engine/urgency_engine.py` | Urgency scoring + OpenRouter LLM call + rule-based nudge generation |
| `aria-backend/engine/interrupt_gate.py` | Blocks delivery during `deep_focus` or active meetings |

### Layer 6 — Delivery Surfaces

| File | Responsibility |
|---|---|
| `aria-desktop/electron/main.js` | Electron tray icon, popup window, dashboard window |
| `aria-desktop/electron/preload.js` | IPC bridge for popup data |
| `aria-desktop/src/components/TrayPopup.jsx` | Compact nudge card (360×120) |
| `aria-desktop/src/components/ExpandedPanel.jsx` | Detailed panel with actions (360×420) |
| `aria-desktop/src/components/Dashboard.jsx` | Full dashboard with tab routing |
| `aria-mobile/app/index.jsx` | Phone nudge list |
| `aria-mobile/app/tasks.jsx` | Quick task entry |

### Orchestration

| File | Responsibility |
|---|---|
| `aria-backend/main.py` | Entry point: inits DB, starts scheduler, runs uvicorn |
| `aria-backend/api_main.py` | FastAPI app: all REST + WebSocket endpoints |
| `aria-backend/scheduler.py` | APScheduler: runs ingestion + eval cycle every 15 min |

---

## Data Flow (Single Cycle)

```
scheduler.run_cycle()
  │
  ├─ 1. connector.fetch_events()    → list[NormalizedEvent]
  ├─ 2. db.insert_events()          → SQLite events table (deduplicated)
  ├─ 3. memory.embed_and_store()    → ChromaDB vectors
  │
  ├─ 4. build_context(db)           → unified context dict
  │      ├─ upcoming events (2h window)
  │      ├─ recent notes (24h)
  │      ├─ behavior model prediction
  │      └─ cognitive state classification
  │
  ├─ 5. evaluate_context(context)   → list[NudgeCandidate]
  │      ├─ rule: meeting < 30min + no prep note
  │      ├─ urgency formula: (deadline × impact) / cognitive_load
  │      └─ optional OpenRouter LLM text
  │
  ├─ 6. should_deliver(state, events) → bool
  │      ├─ blocks if deep_focus
  │      └─ blocks if in active meeting
  │
  └─ 7. persist_candidates(db, candidates, surface)
         → nudge_log rows written
```

---

## Database Schema

All data lives in SQLite at `%APPDATA%\ARIA\aria.db`.

| Table | Purpose | Key Columns |
|---|---|---|
| `events` | Normalized ingested data | `external_id` (unique), `source`, `type`, `start_ts`, `end_ts` |
| `nudge_log` | Every suggestion and its outcome | `urgency_score`, `suggestion_text`, `outcome`, `surface` |
| `habits` | Learned patterns (procedural memory) | `habit_type`, `pattern_json`, `confidence` |
| `settings` | User preferences (key-value) | `key`, `value` (JSON-encoded) |
| `tasks` | Quick tasks from mobile companion | `title`, `created_at`, `done` |

---

## Privacy Model

- All raw content embedded **on-device** using `all-MiniLM-L6-v2` (~80MB, CPU-only)
- Only **embedding vectors + structured metadata** stored in ChromaDB / SQLite
- OpenRouter LLM call sends only a **compact context summary** — never raw note text or calendar descriptions
- FastAPI binds to `127.0.0.1` only — no external network exposure
- No analytics, no telemetry, no third-party data sharing

---

## Planned vs Actual Architecture

| Aspect | PRD Spec | Current Reality |
|---|---|---|
| API structure | `api/routes/*.py` (modular route files) | Single flat `api_main.py` with all endpoints |
| Notes watcher | `watchdog` filesystem events | Poll-based `rglob("*.md")` on each 15-min cycle |
| Memory separation | Episodic / Semantic / Procedural | Single `episodic_memory` ChromaDB collection |
| Behavior model | Markov → GNN upgrade path | Markov chain only, GNN not started |
| Desktop UI | HeroUI + Tailwind CSS components | Raw HTML with inline styles |
| Mobile pairing | QR code + token + `expo-secure-store` | Hardcoded localhost, empty token |

---

## Visual References

- System architecture SVG: `./proactive_ai_assistant_system_architecture.svg`
- Behavior model detail SVG: `./aria_behavior_model_detail.svg`
- UI mockup: `./aria_interfaces_mockup.html`
- User journey flow: `./aria_user_journey_flow.html`
- Tray popup mockup: `./aria_tray_popup_mockup.html`
- Free stack overview: `./aria_free_stack.html`

---

## Source of Truth

- Full requirements contract: `ARIA_PRD.md`
- Execution tracker: `ARIA_WORKFLOW_CHECKLIST.md`
