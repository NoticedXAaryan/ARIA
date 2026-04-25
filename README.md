# ARIA

ARIA is a proactive, local-first assistant that learns user rhythms and surfaces nudges without requiring explicit prompts.

## Canonical Docs

- Product requirements: `ARIA_PRD.md`
- Implementation summary: `projectDiscription.md`
- Build/test tracker: `ARIA_WORKFLOW_CHECKLIST.md`
- Agent onboarding: `AGENTS.md`
- Setup and API docs: `docs/setup-guide.md`, `docs/api-reference.md`, `docs/architecture.md`
- Live project state: `docs/PROJECT_STATE.md`

## Current Implementation Coverage

- Data ingestion from Google Calendar, ActivityWatch, and local notes
- SQLite storage in `%APPDATA%\ARIA\aria.db`
- 15-minute scheduler loop
- Rule-based nudge generation
- FastAPI local server on `127.0.0.1:8742`
- Vector memory scaffold with ChromaDB + sentence-transformers
- Behavior model scaffold (Markov + cognitive-state classification)
- Electron desktop shell (`aria-desktop`)
- Expo mobile companion scaffold (`aria-mobile`)

## Quick Start (Windows)

### Backend

1. Create and activate virtual environment:
   - `python -m venv .venv`
   - `.venv\Scripts\activate`
2. Install backend dependencies:
   - `pip install -r aria-backend/requirements.txt`
3. Copy `.env.example` to `.env` and set values as needed:
   - `GOOGLE_CREDENTIALS_FILE=C:\path\to\credentials.json`
   - `ARIA_NOTES_PATH=C:\path\to\notes`
   - `OPENROUTER_API_KEY=<key>`
4. Run backend:
   - `python aria-backend/main.py`

### Desktop App

1. `cd aria-desktop`
2. `npm install`
3. `npm run dev`
4. In a second terminal: `npm run electron`

### Mobile App

1. `cd aria-mobile`
2. `npm install`
3. `npx expo start`

## Verification Commands

- Backend tests: `pytest aria-backend/tests -q`
- Desktop build: `cd aria-desktop && npm run build`
- Mobile export check: `cd aria-mobile && npx expo export --platform android --output-dir dist-test`

## Implemented API Endpoints

- `GET /api/status`
- `GET /api/nudges/active`
- `GET /api/nudges/history?page=1`
- `POST /api/nudges/{id}/feedback`
- `GET /api/schedule/today`
- `POST /api/eval/trigger`
- `GET /api/habits`
- `GET /api/memory/query?q=...`
- `POST /api/tasks`
- `GET /api/settings`
- `PUT /api/settings`
- `WS /ws/nudges`

## Runtime Notes

- Missing Google credentials -> calendar ingestion degrades gracefully.
- Missing ActivityWatch -> other sources continue to ingest.
- Missing OpenRouter key -> rule text fallback is used.
