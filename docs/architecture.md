# ARIA Architecture

ARIA runs as a local-first Windows daemon with a 15-minute cycle:

1. Ingest data from Google Calendar, ActivityWatch, and Notes
2. Normalize to SQLite `events`
3. Build context and evaluate urgency rules
4. Generate nudges and persist to `nudge_log`
5. Expose data to desktop/mobile via FastAPI and WebSocket

Current implementation includes a Markov-based behavior model scaffold and local vector memory fallback.
