from __future__ import annotations

import json
import os
from typing import Any

import requests
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from connectors.account_manager import AccountManager
from connectors.whatsapp import WhatsAppConnector
from engine.behavior_model import BehaviorModel
from engine.entity_graph import EntityGraph
from engine.action_engine import ActionEngine
from scheduler import AriaScheduler
from storage.db import DB
from storage.memory import MemoryStore, migrate_existing_to_episodic

# Trigger migration from old ChromaDB collection to new episodic collection
migrate_existing_to_episodic()

db = DB()
scheduler = AriaScheduler(db=db)
app = FastAPI(title="ARIA Local API", version="0.2.0")

# CORS middleware for desktop + mobile companion access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

behavior_model = BehaviorModel()
try:
    memory_store = MemoryStore()
except Exception:
    memory_store = None
ws_clients: set[WebSocket] = set()


# ─── Payload Models ───

class FeedbackPayload(BaseModel):
    outcome: str

class AuthCodePayload(BaseModel):
    code: str

class TaskPayload(BaseModel):
    title: str


class SettingsPayload(BaseModel):
    updates: dict[str, Any]


class OpenRouterValidatePayload(BaseModel):
    api_key: str


class NotesPathPayload(BaseModel):
    path: str

class ComposeContextPayload(BaseModel):
    context: str

class ComposeParsePayload(BaseModel):
    text: str

class SendEmailPayload(BaseModel):
    account_id: str
    to: str
    subject: str
    body: str

class CreateEventPayload(BaseModel):
    account_id: str
    title: str
    start_iso: str
    end_iso: str
    attendees: list[str]

class AddNotePayload(BaseModel):
    content: str

class WhatsAppQRPayload(BaseModel):
    qr_data: str

class WhatsAppStatusPayload(BaseModel):
    status: str
    phone: str

class WhatsAppIncomingPayload(BaseModel):
    from_: str = ""
    from_name: str = ""
    body: str = ""
    timestamp: int = 0
    is_group: bool = False
    chat_id: str = ""

    class Config:
        populate_by_name = True
        fields = {"from_": {"alias": "from"}}

class WhatsAppSendPayload(BaseModel):
    chat_id: str
    message: str

# In-memory QR + status store (ephemeral, no DB needed)
_whatsapp_state = {"qr_data": None, "status": "disconnected", "phone": None}
wa_connector = WhatsAppConnector()

class PairVerifyPayload(BaseModel):
    token: str

class PairRegisterPayload(BaseModel):
    device_id: str
    push_token: str
    platform: str


# ─── Status & Core Endpoints ───

@app.get("/api/health")
def health() -> list[dict]:
    return db.get_all_connector_health()

@app.get("/api/status")
def status() -> dict:
    events = [dict(r) for r in db.get_upcoming_events(horizon_seconds=4 * 3600)]
    behavior_model.train(events)
    cognitive_state = behavior_model.classify_cognitive_state(events)
    return {
        "status": "ok",
        "cognitive_state": cognitive_state,
        "next_eval_minutes": scheduler.interval_minutes,
        "last_cycle": scheduler.last_eval_summary,
    }


@app.get("/api/nudges/active")
def nudges_active() -> list[dict]:
    return [
        {
            "id": row["id"],
            "text": row["suggestion_text"],
            "urgency": row["urgency_score"],
            "surface": row["surface"],
            "snoozed_until": row["snoozed_until"],
        }
        for row in db.get_active_nudges()
    ]


@app.get("/api/nudges/history")
def nudges_history(page: int = 1) -> dict:
    items = [dict(row) for row in db.get_nudge_history(page=page)]
    return {"items": items, "page": page, "total": len(items)}


@app.post("/api/nudges/{nudge_id}/feedback")
def nudge_feedback(nudge_id: int, payload: FeedbackPayload) -> dict:
    if payload.outcome not in {"accepted", "dismissed", "snoozed", "ignored", "expired"}:
        raise HTTPException(status_code=400, detail="invalid outcome")
    db.update_nudge_feedback(nudge_id=nudge_id, outcome=payload.outcome)
    return {"ok": True}


@app.get("/api/schedule/today")
def schedule_today() -> list[dict]:
    return [dict(row) for row in db.get_upcoming_events(horizon_seconds=24 * 3600)]


@app.get("/api/calendar/lookahead")
def calendar_lookahead(hours: int = 6) -> dict:
    """Return upcoming events with ARIA prediction annotations."""
    import time as _t
    horizon = hours * 3600
    rows = db.get_upcoming_events(horizon_seconds=horizon)
    events_out = []
    for row in rows:
        e = dict(row)
        e["metadata"] = json.loads(e.get("metadata_json") or "{}")
        events_out.append(e)

    # Annotate gaps between events with predictions
    annotations = []
    now_ts = int(_t.time())
    snoozed = [
        dict(n) for n in db.get_active_nudges()
        if n["snoozed_until"] and n["snoozed_until"] > now_ts and n["snoozed_until"] < now_ts + horizon
    ]
    for sn in snoozed:
        annotations.append({
            "type": "snoozed_nudge",
            "ts": sn["snoozed_until"],
            "text": sn["suggestion_text"],
            "nudge_id": sn["id"],
        })

    # Add behavioural predictions for each hour in the window
    for h_offset in range(hours):
        pred_ts = now_ts + h_offset * 3600
        pred = behavior_model.predict(pred_ts)
        if pred["confidence"] > 0.3:
            annotations.append({
                "type": "prediction",
                "ts": pred_ts,
                "text": f"ARIA predicts: {pred['predicted_next_activity']} (conf {pred['confidence']:.0%})",
            })

    return {"events": events_out, "annotations": annotations}


@app.get("/api/patterns/rhythm")
def patterns_rhythm() -> dict:
    """Return hour-of-day activity weights grouped by weekday, plus summary stats."""
    import time as _t
    from datetime import datetime
    from collections import defaultdict, Counter

    # Fetch all events from the last 90 days
    lookback = 90 * 86400
    now_ts = int(_t.time())
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT start_ts, type FROM events WHERE start_ts >= ? ORDER BY start_ts",
            (now_ts - lookback,)
        ).fetchall()

    # Count events per (weekday, hour_bucket)
    buckets = [6, 9, 11, 13, 15, 17, 19, 22]
    def to_bucket(hour):
        for i in range(len(buckets) - 1, -1, -1):
            if hour >= buckets[i]:
                return buckets[i]
        return buckets[0]

    counts = defaultdict(lambda: defaultdict(int))
    days_seen = set()
    for row in rows:
        dt = datetime.fromtimestamp(row["start_ts"])
        dow = dt.weekday()  # 0=Mon
        bucket = to_bucket(dt.hour)
        counts[dow][bucket] += 1
        days_seen.add(dt.strftime("%Y-%m-%d"))

    # Normalise to 0-1 weights per day
    rhythm = {}
    for dow in range(7):
        day_counts = counts[dow]
        max_c = max(day_counts.values()) if day_counts else 1
        weights = {}
        for b in buckets:
            raw = day_counts.get(b, 0)
            weights[str(b)] = round(raw / max_c, 2) if max_c else 0
        rhythm[str(dow)] = weights

    # Summary stats
    total_days = len(days_seen)
    # Nudge accuracy this week
    week_start = now_ts - 7 * 86400
    with db.connect() as conn:
        total_nudges = conn.execute(
            "SELECT COUNT(*) FROM nudge_log WHERE generated_at >= ?", (week_start,)
        ).fetchone()[0]
        accepted_nudges = conn.execute(
            "SELECT COUNT(*) FROM nudge_log WHERE generated_at >= ? AND outcome = 'accepted'", (week_start,)
        ).fetchone()[0]

    accuracy = round((accepted_nudges / total_nudges * 100), 1) if total_nudges else 0

    return {
        "rhythm": rhythm,
        "stats": {
            "days_of_data": total_days,
            "nudge_accuracy": accuracy,
            "total_nudges_this_week": total_nudges,
        }
    }


@app.post("/api/eval/trigger")
def eval_trigger() -> dict:
    return scheduler.run_manual_eval()


@app.get("/api/habits")
def habits() -> list[dict]:
    return [
        {
            "habit_type": row["habit_type"],
            "pattern_json": json.loads(row["pattern_json"]),
            "confidence": row["confidence"],
        }
        for row in db.get_habits()
    ]


@app.get("/api/memory/query")
def memory_query(q: str) -> list[dict]:
    if not memory_store:
        return []
    return memory_store.query(q)

@app.get("/api/entities")
def get_entities() -> list[dict]:
    rows = db.get_all_entities()
    return [dict(r) for r in rows]

@app.get("/api/entities/{name}/context")
def get_entity_context(name: str) -> dict:
    graph = EntityGraph(db)
    return graph.get_context_for_entity(name)

@app.get("/api/memory/stats")
def memory_stats() -> dict:
    if not memory_store:
        return {"events": 0, "facts": 0, "habits": 0}
    return memory_store.get_stats()

@app.delete("/api/memory/clear")
def memory_clear() -> dict:
    if memory_store:
        memory_store.clear_all()
    return {"ok": True}


@app.post("/api/tasks")
def add_task(payload: TaskPayload) -> dict:
    task_id = db.add_task(payload.title.strip())
    return {"id": task_id}


@app.get("/api/settings")
def get_settings() -> dict:
    return db.get_settings()


@app.put("/api/settings")
@app.patch("/api/settings")
def put_settings(payload: SettingsPayload) -> dict:
    db.update_settings(payload.updates)
    # If OpenRouter key was updated, set it in env for the urgency engine
    if "openrouter_api_key" in payload.updates:
        os.environ["OPENROUTER_API_KEY"] = str(payload.updates["openrouter_api_key"])
    if "notes_folder_path" in payload.updates:
        os.environ["ARIA_NOTES_PATH"] = str(payload.updates["notes_folder_path"])
    return {"ok": True}


# ─── Setup Endpoints ───

@app.get("/api/setup/status")
def setup_status() -> dict:
    """Check which services are linked."""
    manager = AccountManager(db)
    accounts = manager.get_all_accounts()
    settings = db.get_settings()
    return {
        "google_linked": any(a["provider"] == "google" for a in accounts),
        "outlook_linked": any(a["provider"] == "outlook" for a in accounts),
        "notes_configured": bool(settings.get("notes_folder_path")),
        "openrouter_configured": bool(os.getenv("OPENROUTER_API_KEY") or settings.get("openrouter_api_key")),
        "is_configured": bool(settings.get("is_configured", False)),
    }


# ─── Accounts Endpoints ───

@app.get("/api/accounts")
def get_accounts():
    manager = AccountManager(db)
    return manager.get_all_accounts()

@app.post("/api/accounts/google/start")
def google_start():
    manager = AccountManager(db)
    return {"auth_url": manager.get_google_auth_url()}

@app.post("/api/accounts/google/complete")
def google_complete(payload: AuthCodePayload):
    manager = AccountManager(db)
    account_id = manager.add_google_account(payload.code)
    return {"ok": True, "account_id": account_id}

@app.post("/api/accounts/outlook/start")
def outlook_start():
    manager = AccountManager(db)
    return {"auth_url": manager.get_outlook_auth_url()}

@app.post("/api/accounts/outlook/complete")
def outlook_complete(payload: AuthCodePayload):
    manager = AccountManager(db)
    account_id = manager.add_outlook_account(payload.code)
    return {"ok": True, "account_id": account_id}

@app.get("/api/accounts/{account_id}/status")
def account_status(account_id: str):
    manager = AccountManager(db)
    accounts = manager.get_all_accounts()
    for acc in accounts:
        if acc["id"] == account_id:
            return {"status": "active", "provider": acc["provider"], "email": acc["email"]}
    return {"status": "not_found"}

@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: str):
    manager = AccountManager(db)
    manager.remove_account(account_id)
    return {"ok": True}

# ─── Compose & Action Endpoints ───

@app.post("/api/compose/email_draft")
def compose_email_draft(payload: ComposeContextPayload):
    engine = ActionEngine(db)
    draft = engine.draft_email_reply(payload.context)
    return {"draft": draft}

@app.post("/api/compose/parse_event")
def compose_parse_event(payload: ComposeParsePayload):
    engine = ActionEngine(db)
    parsed = engine.parse_event(payload.text)
    return parsed

@app.post("/api/compose/parse_note")
def compose_parse_note(payload: ComposeParsePayload):
    engine = ActionEngine(db)
    parsed = engine.parse_note(payload.text)
    return parsed

@app.post("/api/actions/send_email")
def action_send_email(payload: SendEmailPayload):
    engine = ActionEngine(db)
    success = engine.send_email(payload.account_id, payload.to, payload.subject, payload.body)
    return {"ok": success}

@app.post("/api/actions/create_event")
def action_create_event(payload: CreateEventPayload):
    engine = ActionEngine(db)
    success = engine.create_event(payload.account_id, payload.title, payload.start_iso, payload.end_iso, payload.attendees)
    return {"ok": success}

@app.post("/api/actions/add_note")
def action_add_note(payload: AddNotePayload):
    engine = ActionEngine(db)
    success = engine.add_note(payload.content)
    return {"ok": success}


@app.post("/api/setup/notes/set")
def set_notes_path(payload: NotesPathPayload) -> dict:
    db.update_settings({"notes_folder_path": payload.path})
    os.environ["ARIA_NOTES_PATH"] = payload.path
    db.reset_connector_health("NotesWatcherConnector")
    return {"ok": True}

@app.post("/api/setup/complete")
def setup_complete() -> dict:
    db.update_settings({"is_configured": True})
    return {"ok": True}


@app.post("/api/setup/openrouter/validate")
def validate_openrouter(payload: OpenRouterValidatePayload) -> dict:
    """Test an OpenRouter API key."""
    try:
        resp = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {payload.api_key}"},
            timeout=10,
        )
        if resp.ok:
            os.environ["OPENROUTER_API_KEY"] = payload.api_key
            db.update_settings({"openrouter_api_key": payload.api_key})
            return {"valid": True}
        return {"valid": False, "error": "Invalid API key"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


# ─── WhatsApp Endpoints ───

@app.get("/api/whatsapp/status")
def whatsapp_status():
    connected = wa_connector.is_connected()
    return {
        "connected": connected,
        "phone": _whatsapp_state["phone"],
        "bridge_status": _whatsapp_state["status"],
    }

@app.post("/api/whatsapp/qr")
def whatsapp_qr_receive(payload: WhatsAppQRPayload):
    _whatsapp_state["qr_data"] = payload.qr_data
    _whatsapp_state["status"] = "awaiting_scan"
    return {"ok": True}

@app.get("/api/whatsapp/qr")
def whatsapp_qr_poll():
    return {"qr_data": _whatsapp_state["qr_data"], "status": _whatsapp_state["status"]}

@app.post("/api/whatsapp/status")
def whatsapp_status_update(payload: WhatsAppStatusPayload):
    _whatsapp_state["status"] = payload.status
    _whatsapp_state["phone"] = payload.phone
    _whatsapp_state["qr_data"] = None  # Clear QR once connected
    return {"ok": True}

@app.post("/api/whatsapp/incoming")
def whatsapp_incoming(payload: WhatsAppIncomingPayload):
    msg_dict = {
        "from": payload.from_,
        "from_name": payload.from_name,
        "body": payload.body,
        "timestamp": payload.timestamp,
        "is_group": payload.is_group,
        "chat_id": payload.chat_id,
    }
    event = wa_connector.ingest_incoming(msg_dict)
    db.insert_events([event])
    # Also push to episodic memory
    if memory_store:
        text = f"WhatsApp from {payload.from_name}: {payload.body[:200]}"
        memory_store.add_episodic_event(
            event_id=event.external_id,
            source="whatsapp",
            event_type="message",
            timestamp=payload.timestamp,
            title=f"Message from {payload.from_name}",
            body=text,
            entities_json="{}"
        )
    return {"ok": True}

@app.get("/api/whatsapp/chats")
def whatsapp_chats():
    return wa_connector.get_recent_chats()

@app.post("/api/whatsapp/send")
def whatsapp_send(payload: WhatsAppSendPayload):
    success = wa_connector.send_message(payload.chat_id, payload.message)
    if not success:
        raise HTTPException(status_code=502, detail="WhatsApp bridge unavailable")
    return {"ok": True}


# ─── Pairing Endpoints ───

@app.get("/api/pair/code")
def pair_generate_code():
    import random, time as _t, socket
    code = str(random.randint(100000, 999999))
    now = int(_t.time())
    with db.connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO pair_codes (code, created_at, expires_at, used) VALUES (?, ?, ?, 0)",
            (code, now, now + 300)  # expires in 5 min
        )
        conn.commit()
    # Get local IP for display
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "127.0.0.1"
    return {"code": code, "expires_in": 300, "desktop_ip": local_ip, "port": 8742}

@app.post("/api/pair/verify")
def pair_verify(payload: PairVerifyPayload):
    import time as _t, socket
    now = int(_t.time())
    with db.connect() as conn:
        row = conn.execute(
            "SELECT * FROM pair_codes WHERE code = ? AND expires_at > ? AND used = 0",
            (payload.token, now)
        ).fetchone()
    if not row:
        return {"success": False, "error": "Invalid or expired code"}
    # Mark as used
    with db.connect() as conn:
        conn.execute("UPDATE pair_codes SET used = 1 WHERE code = ?", (payload.token,))
        conn.commit()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "127.0.0.1"
    return {"success": True, "desktop_ip": local_ip, "port": 8742}

@app.post("/api/pair/register")
def pair_register(payload: PairRegisterPayload):
    import time as _t
    now = int(_t.time())
    with db.connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO devices (device_id, push_token, platform, paired_at, last_seen) VALUES (?, ?, ?, ?, ?)",
            (payload.device_id, payload.push_token, payload.platform, now, now)
        )
        conn.commit()
    return {"ok": True}

@app.get("/api/pair/devices")
def pair_devices():
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM devices").fetchall()
        return [dict(r) for r in rows]


# ─── WebSocket ───

@app.websocket("/ws/nudges")
async def nudges_socket(ws: WebSocket) -> None:
    await ws.accept()
    ws_clients.add(ws)
    try:
        while True:
            message = await ws.receive_json()
            if message.get("event") == "feedback":
                data = message.get("data", {})
                nudge_id = int(data.get("id"))
                outcome = str(data.get("outcome"))
                db.update_nudge_feedback(nudge_id=nudge_id, outcome=outcome)
                await ws.send_json({"event": "ack", "data": {"id": nudge_id}})
    except WebSocketDisconnect:
        ws_clients.discard(ws)
