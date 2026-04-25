# ARIA

ARIA is a proactive assistant platform based on `ARIA_PRD.md`.

This repository now includes:
- Ingestion from Google Calendar, ActivityWatch, and local notes
- Normalized SQLite storage in `%APPDATA%\ARIA\aria.db`
- 15-minute scheduler loop
- Rule-based nudge generation for "meeting soon, no prep note"
- Local FastAPI endpoints on `127.0.0.1:8742`
- Vector memory scaffolding with ChromaDB + sentence-transformers
- Behavior model scaffold (Markov + cognitive state classifier)
- Desktop shell app (`aria-desktop`) with tray/dashboard/popup wiring
- Mobile companion scaffold (`aria-mobile`) with nudge and quick-task flows

## Quick Start (Windows)

1. Create and activate a virtual environment:
   - `python -m venv .venv`
   - `.venv\Scripts\activate`
2. Install backend dependencies:
   - `pip install -r aria-backend/requirements.txt`
3. Optional environment variables:
   - `GOOGLE_CREDENTIALS_FILE=C:\path\to\credentials.json`
   - `ARIA_NOTES_PATH=C:\path\to\notes`
   - `OPENROUTER_API_KEY=<key>`
4. Run the backend:
   - `python aria-backend/main.py`

## Desktop App

1. `cd aria-desktop`
2. `npm install`
3. Run web UI: `npm run dev`
4. In a second terminal run Electron shell: `npm run electron`

## Mobile App

1. `cd aria-mobile`
2. `npm install`
3. `npx expo start`

## Implemented API

- `GET /api/status`
- `GET /api/nudges/active`
- `GET /api/nudges/history`
- `POST /api/nudges/{id}/feedback`
- `GET /api/schedule/today`
- `POST /api/eval/trigger`

## Notes

- If Google credentials are missing, calendar ingestion degrades gracefully.
- If ActivityWatch is not installed/running, ingestion continues with other sources.
- If OpenRouter key is missing/unavailable, nudges use local rule text fallback.
- Run backend tests with `pytest aria-backend/tests -q`.
