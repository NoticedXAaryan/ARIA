from __future__ import annotations

import json
import os
import time
from typing import Any

import requests

from storage.db import DB
from storage.models import NudgeCandidate


def _note_matches_meeting(meeting_title: str, note_rows: list[dict[str, Any]]) -> bool:
    if not meeting_title:
        return False
    tokens = {t.lower() for t in meeting_title.split() if len(t) > 2}
    for note in note_rows:
        title = (note.get("title") or "").lower()
        if any(t in title for t in tokens):
            return True
    return False


def _generate_text_with_openrouter(context: dict[str, Any]) -> str | None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None
    meeting = context.get("next_meeting") or {}
    prompt = (
        "Generate one short assistant nudge under 35 words. "
        "Do not use private details. "
        f"Meeting starts at unix={meeting.get('start_ts')}. "
        f"Title category hint={meeting.get('type', 'meeting')}."
    )
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "google/gemini-2.0-flash-exp:free",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 90,
            },
            timeout=10,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


def evaluate_context(context: dict[str, Any]) -> list[NudgeCandidate]:
    next_meeting = context.get("next_meeting")
    if not next_meeting:
        return []

    now = int(time.time())
    starts_in_min = max(0, int((next_meeting["start_ts"] - now) / 60))
    recent_notes = context.get("recent_notes", [])
    prep_note_exists = _note_matches_meeting(next_meeting.get("title") or "", recent_notes)
    is_high_load = context.get("calendar_load_next_2h", 0) >= 3

    candidates: list[NudgeCandidate] = []
    if starts_in_min <= 30 and not prep_note_exists:
        deadline_proximity = max(0.1, (30 - starts_in_min + 1) / 31)
        impact_weight = 0.9 if is_high_load else 0.7
        cognitive_load_factor = 1.0 if not is_high_load else 1.2
        urgency = min(1.0, (deadline_proximity * impact_weight) / cognitive_load_factor)
        default_text = f"Meeting in {starts_in_min} min and no prep note found. Draft 3 bullet points now."
        llm_text = _generate_text_with_openrouter(context)
        candidates.append(
            NudgeCandidate(
                reason="meeting_soon_no_prep",
                suggestion_text=llm_text or default_text,
                urgency_score=urgency,
                context={
                    "starts_in_min": starts_in_min,
                    "high_load": is_high_load,
                    "meeting_id": next_meeting.get("external_id"),
                },
            )
        )
    return candidates


def persist_candidates(db: DB, candidates: list[NudgeCandidate], surface: str = "popup") -> list[int]:
    ids: list[int] = []
    for candidate in candidates:
        nudge_id = db.log_nudge(
            urgency_score=candidate.urgency_score,
            context_json=json.dumps(candidate.context),
            suggestion_text=candidate.suggestion_text,
            surface=surface,
        )
        ids.append(nudge_id)
    return ids
