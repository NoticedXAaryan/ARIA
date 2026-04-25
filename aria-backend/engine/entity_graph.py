import json
import logging
import os
import time
import uuid
import difflib
import requests

from storage.db import DB
from storage.models import NormalizedEvent

logger = logging.getLogger(__name__)

class EntityGraph:
    def __init__(self, db: DB):
        self.db = db

    def extract_entities_from_event(self, event: NormalizedEvent) -> None:
        """Extracts entities from a single event and builds relations."""
        text = f"{event.title or ''}\n{event.body or ''}".strip()
        if not text or len(text) < 10:
            return

        try:
            result_json = self._call_llm(text)
            parsed = json.loads(result_json)
            people = parsed.get("people", [])
            projects = parsed.get("projects", [])
            
            extracted_ids = []

            for p in people:
                if isinstance(p, str) and len(p) > 2:
                    eid = self.merge_entity(p, "person", event.source, event.external_id)
                    if eid:
                        extracted_ids.append(eid)
                        
            for p in projects:
                if isinstance(p, str) and len(p) > 2:
                    eid = self.merge_entity(p, "project", event.source, event.external_id)
                    if eid:
                        extracted_ids.append(eid)

            # Build relations between all entities found in this single event
            for i in range(len(extracted_ids)):
                for j in range(i + 1, len(extracted_ids)):
                    self.db.upsert_entity_relation(
                        extracted_ids[i],
                        extracted_ids[j],
                        relation_type="mentioned_together",
                        weight_increment=1.0
                    )

        except Exception as e:
            logger.warning(f"Entity extraction failed for event {event.external_id}: {e}")

    def merge_entity(self, name: str, entity_type: str, source: str, ref_id: str) -> str | None:
        """Fuzzy match entity, insert/update DB, and record source. Returns the entity UUID."""
        name_clean = name.strip()
        if not name_clean:
            return None

        # Check existing entities of this type
        existing_rows = self.db.connect().execute("SELECT * FROM entities WHERE type = ?", (entity_type,)).fetchall()
        
        best_match_id = None
        best_ratio = 0.0
        best_canonical = ""
        best_aliases = []

        for row in existing_rows:
            canonical = row["canonical_name"]
            aliases = json.loads(row["aliases_json"])
            
            # Check canonical
            ratio = difflib.SequenceMatcher(None, name_clean.lower(), canonical.lower()).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match_id = row["id"]
                best_canonical = canonical
                best_aliases = aliases

            # Check aliases
            for alias in aliases:
                ratio = difflib.SequenceMatcher(None, name_clean.lower(), alias.lower()).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match_id = row["id"]
                    best_canonical = canonical
                    best_aliases = aliases

        if best_ratio > 0.85 and best_match_id:
            # Update existing
            if name_clean not in best_aliases and name_clean.lower() != best_canonical.lower():
                best_aliases.append(name_clean)
                self.db.update_entity(best_match_id, best_canonical, best_aliases)
            entity_id = best_match_id
        else:
            # Create new
            entity_id = str(uuid.uuid4())
            self.db.create_entity(entity_id, entity_type, name_clean, [])

        # Add source reference
        account_id = None # Could extract from ref_id if formatted as source:account_id:id
        if ":" in ref_id:
            parts = ref_id.split(":")
            if len(parts) >= 3:
                account_id = parts[1]
                
        self.db.add_entity_source(entity_id, source, account_id, ref_id)
        return entity_id

    def get_context_for_entity(self, entity_name: str) -> dict:
        """Aggregates unified context for an entity."""
        # Find exact or partial match
        row = self.db.connect().execute(
            "SELECT * FROM entities WHERE canonical_name LIKE ? OR json_extract(aliases_json, '$') LIKE ?",
            (f"%{entity_name}%", f'%"{entity_name}"%')
        ).fetchone()
        
        if not row:
            return {"entity": None}
            
        entity_id = row["id"]
        entity_dict = dict(row)
        entity_dict["aliases"] = json.loads(entity_dict["aliases_json"])
        del entity_dict["aliases_json"]

        # Get sources where this entity was seen
        sources = self.db.connect().execute(
            "SELECT * FROM entity_sources WHERE entity_id = ? ORDER BY last_seen DESC LIMIT 20",
            (entity_id,)
        ).fetchall()
        
        # Hydrate actual events from external_ids
        ref_ids = [s["reference_id"] for s in sources]
        events = []
        if ref_ids:
            placeholders = ",".join(["?"] * len(ref_ids))
            events = self.db.connect().execute(
                f"SELECT * FROM events WHERE external_id IN ({placeholders}) ORDER BY start_ts DESC",
                ref_ids
            ).fetchall()
            
        recent_emails = [dict(e) for e in events if e["type"] == "email"]
        upcoming_meetings = [dict(e) for e in events if e["type"] == "meeting" and e["start_ts"] > time.time()]
        recent_messages = [dict(e) for e in events if e["type"] == "message"]

        return {
            "entity": entity_dict,
            "recent_emails": recent_emails,
            "upcoming_meetings": upcoming_meetings,
            "recent_messages": recent_messages,
            "related_entities": self.db.get_related_entities(entity_id)
        }

    def _call_llm(self, text: str) -> str:
        prompt = (
            "Extract all people names and project names from this text. "
            "Return ONLY valid JSON matching this schema: {\"people\": [\"name1\"], \"projects\": [\"project1\"]}\n\n"
            f"Text: {text}"
        )
        
        api_key = os.getenv("OPENROUTER_API_KEY")
        if api_key:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "openrouter/auto",
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=10
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        else:
            # Fallback to Ollama
            ollama_url = os.getenv("ARIA_OLLAMA_URL", "http://127.0.0.1:11434")
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=10
            )
            response.raise_for_status()
            return response.json()["response"].strip()
