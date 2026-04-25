# ARIA Step-by-Step Workflow and Test Checklist

This checklist is aligned to `ARIA_PRD.md` and your current implementation state.  
Use it as the single execution tracker while building and validating ARIA end-to-end.

Status legend:
- [x] Done (already implemented and verified)
- [~] Partial (implemented but needs PRD alignment hardening)
- [ ] Pending (not implemented yet)

---

## 0) Current Project Snapshot (Already Present)

### Backend (`aria-backend`)
- [x] Project scaffold exists (`connectors`, `engine`, `storage`, scheduler, API entry)
- [x] SQLite schema and helpers exist in `storage/db.py`
- [x] Core API endpoints exist in `api_main.py`
- [x] Rule-based context + urgency + interrupt gate exist
- [x] Basic behavior model exists (Markov-style transition table + state classification)
- [x] Memory store wrapper exists (`storage/memory.py`)
- [x] Pytest suite exists (4 tests currently)
- [~] Queue + expiry + fallback and full PRD NFR details need hardening

### Desktop (`aria-desktop`)
- [x] Electron shell exists (`electron/main.js`, `preload.js`)
- [x] React dashboard and component structure exists
- [x] Build succeeds (`npm run build`)
- [~] PRD-level UX details still need finishing (countdown, exact dimensions, richer actions)

### Mobile (`aria-mobile`)
- [x] Expo app and screens exist (`index`, `tasks`, `settings`)
- [x] Android export now succeeds (`npx expo export --platform android --output-dir dist-test`)
- [x] Missing Expo runtime deps fixed (`expo-status-bar`, `react-native-safe-area-context`, `react-native-screens`, `react-native-gesture-handler`, `expo-linking`, `expo-constants`)
- [~] PRD LAN sync/pairing depth still needs completion and full interaction parity

---

## 1) Environment and Baseline Validation

### Setup checklist
- [ ] Create and activate Python venv for `aria-backend`
- [ ] Install backend deps from `requirements.txt` (and any missing PRD deps)
- [ ] Configure `.env` from `.env.example`
- [ ] Verify ActivityWatch is running on `localhost:5600`
- [ ] Verify Google OAuth credentials are configured
- [ ] Verify notes folder path is configured

### Baseline tests
- [x] Run backend tests: `pytest -q` (currently passes: 4/4)
- [x] Run desktop build: `npm run build` in `aria-desktop`
- [x] Run mobile build check: `npx expo export --platform android --output-dir dist-test` in `aria-mobile`
- [ ] Add CI command set that runs backend tests + desktop build + mobile export in one pipeline

---

## 2) Phase-by-Phase Delivery Workflow (PRD Aligned)

## Phase 1 - Data Pipeline

### Build tasks
- [x] SQLite schema and event ingestion plumbing
- [x] Connectors for Google Calendar, ActivityWatch, Notes watcher files present
- [x] Scheduler cycle exists
- [~] Confirm each connector fully matches PRD requirement details (dedupe keys, watch timing, 7-day pull)
- [ ] Add robust retry/error handling and connector health telemetry

### Tests for this phase
- [ ] Unit: per-connector parse/normalize tests with fixture payloads
- [ ] Integration: run one cycle and assert rows inserted into `events`
- [ ] Validation: dedupe behavior for repeated external IDs
- [ ] Validation: note file change ingested within 60 seconds

---

## Phase 2 - Rule-Based Nudges

### Build tasks
- [x] Context fusion module present
- [x] Rule-based urgency generation present
- [x] Nudge persistence to `nudge_log` present
- [~] Expand rules to exactly match PRD (meeting-prep, load-aware thresholds, richer outcome handling)
- [ ] Add robust nudge queue state transitions

### Tests for this phase
- [x] Existing urgency test (basic candidate generation)
- [ ] Add tests for: meeting <30 min + no prep note -> nudge generated
- [ ] Add tests for: prep note exists -> no nudge
- [ ] Add tests for high-load threshold behavior
- [ ] Add API test for `/api/nudges/{id}/feedback` outcomes and invalid input

---

## Phase 3 - Memory Layer

### Build tasks
- [x] Chroma-based memory wrapper exists
- [~] Add explicit episodic/semantic/procedural separation expected in PRD
- [ ] Add time-window constrained memory query support
- [ ] Implement Ollama fact extraction from notes into `habits`
- [ ] Persist embedding IDs back into events consistently

### Tests for this phase
- [ ] Unit: `embed_and_store` returns deterministic document IDs
- [ ] Unit: `query()` returns ranked results and valid scores
- [ ] Integration: ingest event -> embedding written -> query retrieves it
- [ ] Integration: note change -> extracted facts -> `habits` row inserted

---

## Phase 4 - Behavior Model

### Build tasks
- [x] Initial Markov-style model scaffold present
- [~] Upgrade to PRD-required `(hour_bucket, day_of_week) -> next_activity_type` training from enough history
- [ ] Add weekly retrain workflow over recent window
- [ ] Add data sufficiency gating for optional GNN upgrade
- [ ] Add richer cognitive-state classification signals (app-switching + meeting density + focus duration)

### Tests for this phase
- [ ] Unit: deterministic prediction for controlled event history
- [ ] Unit: cognitive-state classification boundary tests
- [ ] Integration: `/api/status` returns coherent cognitive state from seeded data
- [ ] Regression: model retrain does not crash on sparse data

---

## Phase 5 - LLM Suggestions + Interrupt Gate

### Build tasks
- [x] Interrupt gate logic exists
- [x] OpenRouter call path exists
- [~] Add strict compact prompt constraints and privacy guardrails
- [ ] Add fallback to local Ollama when OpenRouter fails
- [ ] Implement queue re-evaluation and 4-hour expiry
- [ ] Add urgency weight calibration from feedback (EMA)

### Tests for this phase
- [x] Existing interrupt gate tests (deep focus and normal state)
- [ ] Add meeting-active blocking tests
- [ ] Mock OpenRouter failure -> verify fallback path
- [ ] Queue test: blocked nudge re-evaluated next cycle
- [ ] Queue expiry test: pending >4h -> expired outcome

---

## Phase 6 - Desktop App Finish

### Build tasks
- [x] Electron + React shell and components present
- [~] Implement exact compact popup behavior per PRD (12s countdown, dimensions, actions)
- [~] Implement expanded panel full action logic with snooze variants
- [~] Ensure dashboard tabs fully wired to backend routes and live updates
- [ ] Ensure tray states and pause behavior fully match PRD

### Tests for this phase
- [x] Build test passes (`npm run build`)
- [ ] Manual test: tray icon states (idle/active/muted)
- [ ] Manual test: popup shows/auto-dismisses and records ignored
- [ ] Manual test: accept/dismiss/snooze update DB and UI
- [ ] Manual test: WebSocket nudge push displayed in popup/dashboard

---

## Phase 7 - Mobile Companion Finish

### Build tasks
- [x] Expo app scaffolding and screens exist
- [x] Android export build check passes
- [~] Complete desktop pairing (token + IP/QR) and secure persistence
- [~] Ensure action sync parity with desktop outcomes
- [ ] Add away-from-desktop nudge routing logic

### Tests for this phase
- [x] Build/export test currently passes
- [ ] Manual test: pair phone to desktop API
- [ ] Manual test: fetch active nudges from desktop
- [ ] Manual test: phone accept/dismiss updates desktop dashboard
- [ ] Manual test: quick task posts to `/api/tasks`

---

## 3) Cross-Cutting Non-Functional Checklist

- [ ] CPU and memory profile for idle daemon against NFR targets
- [ ] Privacy verification: no raw note/calendar text in remote payloads
- [ ] Reliability tests: network outage, OpenRouter failure, connector failure
- [ ] Security checks: local bind only, token handling, OAuth secret storage
- [ ] Data lifecycle: clear/export data flows from settings

---

## 4) Recommended Command Workflow (Repeat Every Iteration)

- [ ] `cd aria-backend && pytest -q`
- [ ] `cd aria-desktop && npm run build`
- [ ] `cd aria-mobile && npx expo export --platform android --output-dir dist-test`
- [ ] Start backend and manually validate API + websocket flows
- [ ] Trigger one full scheduler cycle and validate DB + UI effects
- [ ] Update this checklist by ticking completed items each session

---

## 5) Immediate Next Actions (Suggested Order)

- [ ] Add missing backend tests for queue/retry/fallback paths first
- [ ] Implement PRD queue lifecycle (blocked -> queued -> re-eval -> expired)
- [ ] Complete desktop popup action parity (countdown + snooze matrix + ignored logging)
- [ ] Complete mobile desktop pairing and bidirectional feedback sync
- [ ] Add one CI workflow that executes all three verification commands automatically

