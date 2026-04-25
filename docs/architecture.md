# ARIA Architecture

## High-Level Flow

ARIA runs as a local-first daemon on a 15-minute loop:

1. Ingest from Google Calendar, ActivityWatch, and notes folder.
2. Normalize into SQLite (`events`, `nudge_log`, `habits`, `settings`, `tasks`).
3. Build a fused context snapshot.
4. Evaluate urgency and interrupt-gate decisions.
5. Persist candidate nudges and outcomes.
6. Expose state to desktop/mobile via FastAPI + WebSocket.

## Six-Layer Model

1. **Ingestion and normalization**
2. **Memory (episodic, semantic, procedural)**
3. **Behavior modeling**
4. **Context fusion**
5. **Urgency + interrupt gate + nudge generation**
6. **Delivery surfaces (tray popup, dashboard, mobile companion)**

## Delivery Surfaces

- **Tray popup (primary)**: lightweight proactive action card with accept/snooze/dismiss.
- **Dashboard (on-demand)**: inspection and settings, opened from tray.
- **Mobile companion (optional)**: away-from-desk nudge actions and quick tasks.

## Current Implementation State

- Implemented: local ingestion loop, SQLite persistence, rule-based nudge engine, basic behavior model, API, desktop/mobile scaffolds.
- In progress: queue lifecycle, richer interrupt policy, deeper feedback weighting, full UX parity with PRD.

## Source of Truth

- Full contract: `ARIA_PRD.md`
- Practical execution tracker: `ARIA_WORKFLOW_CHECKLIST.md`
- Product overview: `projectDiscription.md`
