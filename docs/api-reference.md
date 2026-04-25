# ARIA API Reference

Base URL: `http://127.0.0.1:8742`

All endpoints bind to loopback only. The mobile companion connects over LAN using a Bearer token.

---

## Authentication

```
Authorization: Bearer <token>
```

Token is generated during mobile pairing and stored in Windows Credential Store via `keyring`. Desktop access (Electron) does not require a token since it runs on the same machine.

---

## REST Endpoints

### `GET /api/status`

Returns daemon health, cognitive state, and last evaluation cycle summary.

**Response:**
```json
{
  "status": "ok",
  "cognitive_state": "normal",
  "next_eval_minutes": 15,
  "last_cycle": {
    "events_ingested": 12,
    "nudges_generated": 1
  }
}
```

**`cognitive_state`** values: `deep_focus` | `flow` | `normal` | `overloaded`

```bash
curl http://127.0.0.1:8742/api/status
```

---

### `GET /api/nudges/active`

Returns all suggestions currently active (no outcome) or snoozed.

**Response:**
```json
[
  {
    "id": 1,
    "text": "Meeting in 18 min and no prep note found. Draft 3 bullet points now.",
    "urgency": 0.72,
    "surface": "popup",
    "snoozed_until": null
  }
]
```

```bash
curl http://127.0.0.1:8742/api/nudges/active
```

---

### `GET /api/nudges/history?page=1`

Returns paginated nudge history (20 per page).

**Query params:** `page` (integer, default: 1)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "generated_at": 1745580000,
      "delivered_at": 1745580001,
      "urgency_score": 0.72,
      "context_json": "{...}",
      "suggestion_text": "Meeting in 18 min...",
      "surface": "popup",
      "outcome": "accepted",
      "snoozed_until": null,
      "feedback_weight": null
    }
  ],
  "page": 1,
  "total": 1
}
```

```bash
curl "http://127.0.0.1:8742/api/nudges/history?page=1"
```

---

### `POST /api/nudges/{id}/feedback`

Records user outcome for a suggestion.

**Body:**
```json
{
  "outcome": "accepted"
}
```

**Valid outcomes:** `accepted` | `dismissed` | `snoozed` | `ignored` | `expired`

**Response:**
```json
{ "ok": true }
```

**Error (400):**
```json
{ "detail": "invalid outcome" }
```

```bash
curl -X POST http://127.0.0.1:8742/api/nudges/1/feedback \
  -H "Content-Type: application/json" \
  -d '{"outcome": "accepted"}'
```

---

### `GET /api/schedule/today`

Returns today's upcoming events from local store (24h window).

**Response:**
```json
[
  {
    "id": 5,
    "external_id": "gcal:abc123",
    "source": "google_calendar",
    "type": "meeting",
    "title": "Sprint Review",
    "start_ts": 1745582400,
    "end_ts": 1745586000,
    "metadata_json": "{\"attendee_count\": 6}",
    "embedding_id": null,
    "created_at": 1745580000
  }
]
```

```bash
curl http://127.0.0.1:8742/api/schedule/today
```

---

### `POST /api/eval/trigger`

Manually triggers one full evaluation cycle (ingestion + context + urgency + nudge generation). Useful for development and debugging.

**Response:**
```json
{
  "events_ingested": 5,
  "nudges_generated": 1
}
```

```bash
curl -X POST http://127.0.0.1:8742/api/eval/trigger
```

---

### `GET /api/habits`

Returns all active learned habit patterns.

**Response:**
```json
[
  {
    "habit_type": "focus_block",
    "pattern_json": { "day": "tuesday", "hour": 9, "activity": "focus" },
    "confidence": 0.85
  }
]
```

```bash
curl http://127.0.0.1:8742/api/habits
```

---

### `GET /api/memory/query?q=...`

Semantic search over episodic memory using ChromaDB vector similarity.

**Query params:** `q` (string, required)

**Response:**
```json
[
  {
    "id": "a1b2c3d4e5f6",
    "summary": "meeting Sprint Review",
    "score": 0.87
  }
]
```

Returns empty array `[]` if memory store is unavailable (ChromaDB/sentence-transformers not installed).

```bash
curl "http://127.0.0.1:8742/api/memory/query?q=sprint%20review%20prep"
```

---

### `POST /api/tasks`

Adds a quick task from phone companion or any client.

**Body:**
```json
{
  "title": "Review PR #42 before standup"
}
```

**Response:**
```json
{
  "id": 7
}
```

```bash
curl -X POST http://127.0.0.1:8742/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Review PR #42 before standup"}'
```

---

### `GET /api/settings`

Returns current user settings as key-value pairs.

**Response:**
```json
{
  "interrupt_deep_focus": true,
  "interrupt_in_meeting": true,
  "max_nudges_per_day": 8,
  "snooze_default_minutes": 15,
  "openrouter_model": "google/gemini-2.0-flash-exp:free"
}
```

```bash
curl http://127.0.0.1:8742/api/settings
```

---

### `PUT /api/settings`

Updates one or more settings.

**Body:**
```json
{
  "updates": {
    "max_nudges_per_day": 5,
    "snooze_default_minutes": 30
  }
}
```

**Response:**
```json
{ "ok": true }
```

```bash
curl -X PUT http://127.0.0.1:8742/api/settings \
  -H "Content-Type: application/json" \
  -d '{"updates": {"max_nudges_per_day": 5}}'
```

---

## WebSocket

### `WS /ws/nudges`

Bi-directional channel for real-time nudge delivery and feedback.

**Connect:**
```
ws://127.0.0.1:8742/ws/nudges
```

**Server → Client (nudge event):**
```json
{
  "event": "nudge",
  "data": {
    "id": 3,
    "text": "Meeting in 10 min — no prep note found.",
    "urgency": 0.85,
    "context": { "starts_in_min": 10, "high_load": false }
  }
}
```

**Client → Server (feedback):**
```json
{
  "event": "feedback",
  "data": {
    "id": 3,
    "outcome": "accepted"
  }
}
```

**Server → Client (ack):**
```json
{
  "event": "ack",
  "data": { "id": 3 }
}
```

---

## Error Handling

| Status | When |
|---|---|
| `400` | Invalid outcome value on feedback endpoint |
| `422` | Malformed request body (Pydantic validation) |
| `500` | Unhandled server error |

---

## Notes

- API binds to `127.0.0.1` only — not reachable from network by default
- Mobile companion must know the desktop's LAN IP and use Bearer token auth
- See `aria-backend/api_main.py` for exact Pydantic models
