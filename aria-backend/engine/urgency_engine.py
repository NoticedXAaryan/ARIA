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


def _generate_text_with_openrouter(context: dict[str, Any], rule_hint: str) -> str:
    """Generate a natural language suggestion using OpenRouter free models."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("No OPENROUTER_API_KEY")

    # Build a compact, privacy-safe prompt
    meeting = context.get("next_meeting") or {}
    cognitive = context.get("cognitive_state", "normal")
    email_count = context.get("unread_email_count", 0)
    calendar_load = context.get("calendar_load_next_2h", 0)

    prompt = (
        f"You are ARIA, a proactive AI assistant. Generate one concise, actionable nudge under 40 words.\n"
        f"Context: cognitive_state={cognitive}, calendar_events_next_2h={calendar_load}, "
        f"unread_emails={email_count}.\n"
        f"Rule triggered: {rule_hint}\n"
        f"Be specific, helpful, and encouraging. Don't use private details. End with a clear action step."
    )

    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "http://localhost:8742",
            "X-Title": "ARIA Assistant",
        },
        json={
            "model": "openrouter/auto",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 100,
        },
        timeout=15,
    )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"].strip()
    if len(text) <= 10:
        raise ValueError("Response too short")
    return text


def _generate_text_with_ollama(context: dict[str, Any], rule_hint: str) -> str:
    """Fallback: generate suggestion text using local Ollama."""
    ollama_url = os.getenv("ARIA_OLLAMA_URL", "http://127.0.0.1:11434")
    
    # Check available models
    model = "llama3.2"
    try:
        resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
        resp.raise_for_status()
        models = [m.get("name", "") for m in resp.json().get("models", [])]
        if not any(m.startswith("llama3.2") for m in models):
            if any(m.startswith("phi3") for m in models):
                model = "phi3"
    except Exception as e:
        logger.warning("Could not fetch Ollama models: %s", e)

    cognitive = context.get("cognitive_state", "normal")
    prompt = (
        f"Generate one short AI assistant nudge under 35 words. "
        f"Context: state={cognitive}. Rule: {rule_hint}. "
        f"Be helpful and actionable."
    )
    response = requests.post(
        f"{ollama_url}/api/generate",
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=30,
    )
    response.raise_for_status()
    text = response.json().get("response", "").strip()
    if len(text) <= 10:
        raise ValueError("Response too short")
    return text


def get_nudge_text(context: dict[str, Any], rule_hint: str, db: DB | None) -> str:
    # 1. Try OpenRouter
    try:
        text = _generate_text_with_openrouter(context, rule_hint)
        if db:
            db.increment_metric("path_openrouter")
        return text
    except Exception as e:
        logger.warning("OpenRouter failed: %s", e)
    
    # 2. Try Ollama
    try:
        text = _generate_text_with_ollama(context, rule_hint)
        if db:
            db.increment_metric("path_ollama")
        return text
    except Exception as e:
        logger.warning("Ollama failed: %s", e)
        
    # 3. Fallback template
    if db:
        db.increment_metric("path_template")
    title = "Upcoming activity"
    if "meeting" in rule_hint and context.get("next_meeting"):
        title = context["next_meeting"].get("title", "Upcoming meeting")
    elif "email" in rule_hint:
        title = "Unread emails"
    elif "focus" in rule_hint:
        title = "Focus block"
    return f"Reminder: {title} — based on your usual pattern at this time."


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
            default_text = f"Meeting in {starts_in_min} min and no prep note found. Draft 3 bullet points now."
            llm_text = get_nudge_text(context, "meeting_soon_no_prep", db)
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

    # ─── Rule 2: Unread important emails ───
    emails = context.get("recent_emails", [])
    unread_important = [e for e in emails if e.get("metadata_json", {}).get("is_unread") and e.get("metadata_json", {}).get("is_important")]
    if len(unread_important) >= 3:
        urgency = min(1.0, 0.4 + len(unread_important) * 0.05)
        default_text = f"You have {len(unread_important)} unread important emails. Take 5 minutes to triage them."
        llm_text = get_nudge_text(context, f"unread_important_emails_count={len(unread_important)}", db)
        candidates.append(
            NudgeCandidate(
                reason="unread_important_emails",
                suggestion_text=llm_text or default_text,
                urgency_score=urgency,
                context={"unread_count": len(unread_important)},
            )
        )

    # ─── Rule 3: Long focus block — suggest break ───
    focus_events = [e for e in context.get("upcoming_events", []) if e.get("type") == "focus"]
    total_focus_min = sum((e.get("end_ts", e["start_ts"]) - e["start_ts"]) / 60 for e in focus_events if e["start_ts"] < now)
    if total_focus_min >= 120:
        default_text = f"You've been focused for {int(total_focus_min)} minutes. A short break boosts productivity."
        llm_text = get_nudge_text(context, f"long_focus_block_minutes={int(total_focus_min)}", db)
        candidates.append(
            NudgeCandidate(
                reason="focus_break_reminder",
                suggestion_text=llm_text or default_text,
                urgency_score=0.35,
                context={"focus_minutes": int(total_focus_min)},
            )
        )

    # ─── Rule 4: High meeting load warning ───
    calendar_load = context.get("calendar_load_next_2h", 0)
    if calendar_load >= 4:
        default_text = f"Heads up: {calendar_load} meetings in the next 2 hours. Consider blocking prep time."
        llm_text = get_nudge_text(context, f"high_meeting_load={calendar_load}", db)
        candidates.append(
            NudgeCandidate(
                reason="high_meeting_load",
                suggestion_text=llm_text or default_text,
                urgency_score=0.5,
                context={"meeting_count": calendar_load},
            )
        )

    # ─── Rule 5: Morning planning nudge (8–9 AM) ───
    hour = time.localtime(now).tm_hour
    if hour == 8 or hour == 9:
        upcoming_meetings = len([e for e in context.get("upcoming_events", []) if e.get("type") == "meeting"])
        if upcoming_meetings > 0:
            default_text = f"Good morning! You have {upcoming_meetings} meetings today. Review your schedule and plan your focus blocks."
            llm_text = get_nudge_text(context, f"morning_planning_meetings={upcoming_meetings}", db)
            candidates.append(
                NudgeCandidate(
                    reason="morning_planning",
                    suggestion_text=llm_text or default_text,
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
