from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import requests

from storage.db import DB
from storage.models import NudgeCandidate
from engine.feedback_weights import FeedbackWeightManager
from engine.suggestion_gen import generate_nudge_text, check_duplicate_nudge, _extract_names_with_llm

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_feedback_manager = None

def get_feedback_manager(db: DB | None) -> FeedbackWeightManager:
    global _feedback_manager
    if _feedback_manager is None:
        db_path = db.db_path if db else None
        _feedback_manager = FeedbackWeightManager(db_path)
    return _feedback_manager


def _note_matches_meeting(meeting_title: str, note_rows: list[dict[str, Any]]) -> bool:
    if not meeting_title:
        return False
    tokens = {t.lower() for t in meeting_title.split() if len(t) > 2}
    for note in note_rows:
        title = (note.get("title") or "").lower()
        if any(t in title for t in tokens):
            return True
    return False


# Removed internal LLM helpers, now using suggestion_gen.py


def evaluate_context(context: dict[str, Any], db: DB | None = None) -> list[NudgeCandidate]:
    """Evaluate context and generate nudge candidates from multiple rules."""
    candidates: list[NudgeCandidate] = []
    now = int(time.time())

    # ─── Rule 1: Meeting soon with no prep note ───
    next_meeting = context.get("next_meeting")
    if next_meeting:
        starts_in_min = max(0, int((next_meeting["start_ts"] - now) / 60))
        recent_notes = context.get("recent_notes", [])
        prep_note_exists = _note_matches_meeting(next_meeting.get("title") or "", recent_notes)
        is_high_load = context.get("calendar_load_next_2h", 0) >= 3

        if starts_in_min <= 30 and not prep_note_exists:
            deadline_proximity = max(0.1, (30 - starts_in_min + 1) / 31)
            impact_weight = 0.9 if is_high_load else 0.7
            cognitive_load_factor = 1.0 if not is_high_load else 1.2
            urgency = min(1.0, (deadline_proximity * impact_weight) / cognitive_load_factor)
            
            entities = _extract_names_with_llm(next_meeting.get("title") or "")
            if not check_duplicate_nudge(db, "meeting_soon_no_prep", entities):
                llm_text = generate_nudge_text(context, "meeting_soon_no_prep", db)
                candidates.append(
                    NudgeCandidate(
                        reason="meeting_soon_no_prep",
                        suggestion_text=llm_text,
                        urgency_score=urgency,
                        context={
                            "starts_in_min": starts_in_min,
                            "high_load": is_high_load,
                            "meeting_id": next_meeting.get("external_id"),
                        },
                    )
                )

    # ─── Rule 2: Unread important emails ───
    emails = context.get("recent_emails", [])
    unread_important = [e for e in emails if e.get("metadata_json", {}).get("is_unread") and e.get("metadata_json", {}).get("is_important")]
    if len(unread_important) >= 3:
        urgency = min(1.0, 0.4 + len(unread_important) * 0.05)
        entities = []
        for em in unread_important[:3]:
            entities.extend(_extract_names_with_llm(em.get("title") or ""))
            
        if not check_duplicate_nudge(db, "unread_important_emails", entities):
            llm_text = generate_nudge_text(context, f"unread_important_emails_count={len(unread_important)}", db)
            candidates.append(
                NudgeCandidate(
                    reason="unread_important_emails",
                    suggestion_text=llm_text,
                    urgency_score=urgency,
                    context={"unread_count": len(unread_important)},
                )
            )

    # ─── Rule 3: Long focus block — suggest break ───
    focus_events = [e for e in context.get("upcoming_events", []) if e.get("type") == "focus"]
    total_focus_min = sum((e.get("end_ts", e["start_ts"]) - e["start_ts"]) / 60 for e in focus_events if e["start_ts"] < now)
    if total_focus_min >= 120:
        if not check_duplicate_nudge(db, "focus_break_reminder", []):
            llm_text = generate_nudge_text(context, f"long_focus_block_minutes={int(total_focus_min)}", db)
            candidates.append(
                NudgeCandidate(
                    reason="focus_break_reminder",
                    suggestion_text=llm_text,
                    urgency_score=0.35,
                    context={"focus_minutes": int(total_focus_min)},
                )
            )

    # ─── Rule 4: High meeting load warning ───
    calendar_load = context.get("calendar_load_next_2h", 0)
    if calendar_load >= 4:
        if not check_duplicate_nudge(db, "high_meeting_load", []):
            llm_text = generate_nudge_text(context, f"high_meeting_load={calendar_load}", db)
            candidates.append(
                NudgeCandidate(
                    reason="high_meeting_load",
                    suggestion_text=llm_text,
                    urgency_score=0.5,
                    context={"meeting_count": calendar_load},
                )
            )

    # ─── Rule 5: Morning planning nudge (8–9 AM) ───
    hour = time.localtime(now).tm_hour
    if hour == 8 or hour == 9:
        upcoming_meetings = len([e for e in context.get("upcoming_events", []) if e.get("type") == "meeting"])
        if upcoming_meetings > 0:
            if not check_duplicate_nudge(db, "morning_planning", []):
                llm_text = generate_nudge_text(context, f"morning_planning_meetings={upcoming_meetings}", db)
                candidates.append(
                    NudgeCandidate(
                        reason="morning_planning",
                        suggestion_text=llm_text,
                        urgency_score=0.3,
                        context={"meeting_count": upcoming_meetings},
                    )
                )

    # Apply feedback weights
    fm = get_feedback_manager(db)
    now_tm = time.localtime(now)
    current_hour = now_tm.tm_hour
    current_day = now_tm.tm_wday
    current_workload = "high" if context.get("calendar_load_next_2h", 0) >= 3 else "normal"

    for candidate in candidates:
        weight = fm.get_weight(candidate.reason, current_hour, current_day, current_workload)
        candidate.urgency_score = candidate.urgency_score * weight

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
