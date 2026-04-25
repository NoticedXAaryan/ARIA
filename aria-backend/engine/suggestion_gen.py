import json
import logging
import os
import time
from typing import Any
import requests

from storage.db import DB
from engine.entity_graph import EntityGraph

logger = logging.getLogger(__name__)
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

def _extract_names_with_llm(text: str) -> list[str]:
    """Helper to extract people names from text using LLM."""
    if not text.strip():
        return []
    prompt = (
        "Extract all people names from this text. "
        "Return ONLY valid JSON matching this schema: {\"people\": [\"name1\"]}\n\n"
        f"Text: {text}"
    )
    api_key = os.getenv("OPENROUTER_API_KEY")
    try:
        if api_key:
            response = requests.post(
                OPENROUTER_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "openrouter/auto",
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=5
            )
            response.raise_for_status()
            res = response.json()["choices"][0]["message"]["content"].strip()
            return json.loads(res).get("people", [])
        else:
            ollama_url = os.getenv("ARIA_OLLAMA_URL", "http://127.0.0.1:11434")
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=5
            )
            response.raise_for_status()
            res = response.json().get("response", "").strip()
            return json.loads(res).get("people", [])
    except Exception as e:
        logger.debug(f"Failed to extract names: {e}")
        return []

def generate_nudge_text(context: dict[str, Any], rule_hint: str, db: DB) -> str:
    # STEP 1 — Enrich context with entity graph
    entity_graph = EntityGraph(db)
    mentioned_names = set()

    next_meeting = context.get("next_meeting", {})
    if next_meeting and next_meeting.get("title"):
        mentioned_names.update(_extract_names_with_llm(next_meeting["title"]))

    open_tasks = context.get("tasks", [])  # assuming tasks might be passed in context
    task_title = ""
    task_due = ""
    if open_tasks:
        task_title = open_tasks[0].get("title", "")
        task_due = open_tasks[0].get("due", "soon")
        mentioned_names.update(_extract_names_with_llm(task_title))

    entity_context_list = []
    for name in mentioned_names:
        if len(name) < 3:
            continue
        ent_ctx = entity_graph.get_context_for_entity(name)
        if ent_ctx.get("entity"):
            info = f"Name: {ent_ctx['entity'].get('canonical_name')}"
            if ent_ctx.get("recent_emails"):
                info += f" | Last email: {ent_ctx['recent_emails'][0].get('title')}."
            if ent_ctx.get("recent_messages"):
                info += f" | Last message: {ent_ctx['recent_messages'][0].get('body')[:50]}."
            entity_context_list.append(info)

    entity_context_json = json.dumps(entity_context_list)

    # STEP 2 — Build a rich prompt
    time_str = time.strftime("%I:%M %p")
    workload_state = context.get("cognitive_state", "normal")
    next_event_title = next_meeting.get("title", "None")
    minutes = max(0, int((next_meeting.get("start_ts", time.time()) - time.time()) / 60)) if next_meeting else 0

    sys_prompt = (
        "You are ARIA, a proactive personal assistant. Generate a single short, specific, "
        "actionable nudge (max 2 sentences). Be specific — use the person's name, the actual "
        "task name, and a concrete reason based on timing. Do not be generic. "
        "Never say 'you might want to' or 'consider'. Just say what to do and why now."
    )

    user_prompt = (
        f"Current time: {time_str}. Workload: {workload_state}.\n"
        f"Upcoming: {next_event_title} in {minutes} minutes.\n"
        f"Open task: {task_title} (due: {task_due}).\n"
        f"Relevant people: {entity_context_json}.\n"
        f"Rule triggered: {rule_hint}.\n"
        f"Generate a nudge."
    )

    api_key = os.getenv("OPENROUTER_API_KEY")
    nudge_text = ""

    try:
        if api_key:
            response = requests.post(
                OPENROUTER_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "openrouter/auto",
                    "messages": [
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": 100,
                },
                timeout=10
            )
            response.raise_for_status()
            nudge_text = response.json()["choices"][0]["message"]["content"].strip()
        else:
            ollama_url = os.getenv("ARIA_OLLAMA_URL", "http://127.0.0.1:11434")
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.2",
                    "system": sys_prompt,
                    "prompt": user_prompt,
                    "stream": False
                },
                timeout=20
            )
            response.raise_for_status()
            nudge_text = response.json().get("response", "").strip()

    except Exception as e:
        logger.warning(f"LLM generation failed: {e}")

    # STEP 3 — Quality gate
    if not nudge_text or len(nudge_text) > 200 or len(nudge_text) < 10:
        nudge_text = _fallback_nudge(mentioned_names, next_event_title)

    # Check for specific noun (basic heuristic: checking for capitalized words not at start of sentence, or just presence of names)
    has_noun = False
    for name in mentioned_names:
        if name.lower() in nudge_text.lower():
            has_noun = True
            break
    if not has_noun and task_title and any(word in nudge_text.lower() for word in task_title.split() if len(word) > 3):
        has_noun = True

    if not has_noun:
        nudge_text = _fallback_nudge(mentioned_names, next_event_title)

    return nudge_text

def _fallback_nudge(names: set, event_title: str) -> str:
    name_str = ", ".join(list(names)[:2])
    if name_str and event_title != "None":
        return f"Follow up with {name_str} regarding {event_title}."
    elif event_title != "None":
        return f"Prepare for your upcoming event: {event_title}."
    elif name_str:
        return f"You have pending items related to {name_str}."
    return "Please review your upcoming schedule and pending tasks."

def check_duplicate_nudge(db: DB, nudge_type: str, entities: list[str]) -> bool:
    """Check if a similar nudge was delivered in the last 4 hours."""
    # STEP 4 — Nudge deduplication
    now = int(time.time())
    four_hours_ago = now - (4 * 3600)
    
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT suggestion_text, reason FROM nudge_log WHERE generated_at >= ?",
            (four_hours_ago,)
        ).fetchall()
        
    for row in rows:
        if row["reason"] == nudge_type:
            # Check if entities overlap
            text_lower = row["suggestion_text"].lower()
            for entity in entities:
                if entity.lower() in text_lower:
                    logger.info("Duplicate nudge suppressed.")
                    return True
    return False
