from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from engine.behavior_model import BehaviorModel
from scheduler import AriaScheduler
from storage.db import DB
from storage.memory import MemoryStore

db = DB()
scheduler = AriaScheduler(db=db)
app = FastAPI(title="ARIA Local API", version="0.1.0")
behavior_model = BehaviorModel()
try:
    memory_store = MemoryStore()
except Exception:
    memory_store = None
ws_clients: set[WebSocket] = set()


class FeedbackPayload(BaseModel):
    outcome: str


class TaskPayload(BaseModel):
    title: str


class SettingsPayload(BaseModel):
    updates: dict[str, Any]


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


@app.post("/api/tasks")
def add_task(payload: TaskPayload) -> dict:
    task_id = db.add_task(payload.title.strip())
    return {"id": task_id}


@app.get("/api/settings")
def get_settings() -> dict:
    return db.get_settings()


@app.put("/api/settings")
def put_settings(payload: SettingsPayload) -> dict:
    db.update_settings(payload.updates)
    return {"ok": True}


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
