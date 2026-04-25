# Setup Guide

## Prerequisites

- Python 3.10+
- Node.js 18+
- ActivityWatch installed and running (`http://localhost:5600`)
- Optional: Google Calendar OAuth desktop credentials
- Optional: OpenRouter API key

## 1) Backend Setup

1. Create virtual environment:
   - `python -m venv .venv`
2. Activate environment:
   - `.venv\Scripts\activate`
3. Install dependencies:
   - `pip install -r aria-backend/requirements.txt`
4. Configure environment:
   - Copy `.env.example` -> `.env`
   - Fill values as needed (`GOOGLE_CREDENTIALS_FILE`, `ARIA_NOTES_PATH`, `OPENROUTER_API_KEY`)
5. Run backend:
   - `python aria-backend/main.py`

## 2) Desktop Setup (`aria-desktop`)

1. `cd aria-desktop`
2. `npm install`
3. Run renderer: `npm run dev`
4. In another terminal run shell: `npm run electron`

## 3) Mobile Setup (`aria-mobile`)

1. `cd aria-mobile`
2. `npm install`
3. `npx expo start`

## 4) Verification

- Backend tests: `pytest aria-backend/tests -q`
- Desktop build check: `cd aria-desktop && npm run build`
- Mobile export check: `cd aria-mobile && npx expo export --platform android --output-dir dist-test`

## Troubleshooting

- If Google auth is missing, ingestion still works from available sources.
- If ActivityWatch is unavailable, calendar/notes ingestion continues.
- If OpenRouter is unavailable, nudges fall back to local rule-generated text.
