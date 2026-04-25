# ARIA API Reference

Base URL: `http://127.0.0.1:8742`

## REST Endpoints

### Health and status
- `GET /api/status`  
  Returns daemon status, cognitive state, and last cycle summary.

### Nudges
- `GET /api/nudges/active`  
  Returns active/snoozed nudges.
- `GET /api/nudges/history?page=1`  
  Returns paginated nudge history.
- `POST /api/nudges/{id}/feedback`  
  Accepts outcome: `accepted`, `dismissed`, `snoozed`, `ignored`, `expired`.

### Schedule and evaluation
- `GET /api/schedule/today`  
  Returns upcoming events from local store.
- `POST /api/eval/trigger`  
  Triggers a manual scheduler evaluation cycle.

### Memory and habits
- `GET /api/habits`  
  Returns active learned habits.
- `GET /api/memory/query?q=...`  
  Returns semantic memory query results.

### Tasks and settings
- `POST /api/tasks`  
  Adds a quick task to local DB.
- `GET /api/settings`  
  Reads current settings.
- `PUT /api/settings`  
  Updates settings.

## WebSocket

- `WS /ws/nudges`  
  Bi-directional channel for nudge events and feedback acknowledgements.

## Notes

- API binds locally to loopback and is intended for local desktop/mobile companion use.
- See `api_main.py` for exact request/response models.
