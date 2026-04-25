from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import chromadb
from sentence_transformers import SentenceTransformer


class MemoryStore:
    def __init__(self, data_dir: Path | None = None) -> None:
        # Keep all three ChromaDB collections in the same local persistent directory
        base = data_dir or (Path.cwd() / "aria_memory")
        base.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(base))
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        
        self.episodic = self.client.get_or_create_collection(name="aria_episodic")
        self.semantic = self.client.get_or_create_collection(name="aria_semantic")
        self.procedural = self.client.get_or_create_collection(name="aria_procedural")

    def _embed(self, text: str) -> list[float]:
        return self.model.encode([text])[0].tolist()

    def add_episodic_event(
        self,
        event_id: str,
        source: str,
        event_type: str,
        timestamp: int,
        title: str,
        body: str,
        entities_json: str
    ) -> str:
        text_to_embed = f"{title}\n{body}".strip()
        embedding = self._embed(text_to_embed)
        metadata = {
            "source": source,
            "type": event_type,
            "timestamp": timestamp,
            "title": title,
            "entities_json": entities_json
        }
        self.episodic.upsert(
            ids=[str(event_id)],
            documents=[body],
            metadatas=[metadata],
            embeddings=[embedding]
        )
        return str(event_id)

    def get_events_in_window(self, start_ts: int, end_ts: int) -> list[dict[str, Any]]:
        result = self.episodic.get(
            where={"$and": [{"timestamp": {"$gte": start_ts}}, {"timestamp": {"$lte": end_ts}}]}
        )
        
        items: list[dict[str, Any]] = []
        ids = result.get("ids", [])
        docs = result.get("documents", [])
        metadatas = result.get("metadatas", [])
        
        for i, doc_id in enumerate(ids):
            meta = metadatas[i] if metadatas and i < len(metadatas) else {}
            items.append({
                "id": doc_id,
                "source": meta.get("source"),
                "type": meta.get("type"),
                "timestamp": meta.get("timestamp"),
                "title": meta.get("title"),
                "body": docs[i] if docs and i < len(docs) else "",
                "entities_json": meta.get("entities_json")
            })
        return items

    def add_semantic_fact(
        self,
        fact_id: str,
        entity_type: str,
        entity_name: str,
        fact: str,
        confidence: float,
        updated_at: int
    ) -> str:
        embedding = self._embed(fact)
        metadata = {
            "entity_type": entity_type,
            "entity_name": entity_name,
            "confidence": confidence,
            "updated_at": updated_at
        }
        self.semantic.upsert(
            ids=[str(fact_id)],
            documents=[fact],
            metadatas=[metadata],
            embeddings=[embedding]
        )
        return str(fact_id)

    def get_facts_about(self, entity_name: str) -> list[dict[str, Any]]:
        result = self.semantic.get(
            where={"entity_name": entity_name}
        )
        
        items: list[dict[str, Any]] = []
        ids = result.get("ids", [])
        docs = result.get("documents", [])
        metadatas = result.get("metadatas", [])
        
        for i, doc_id in enumerate(ids):
            meta = metadatas[i] if metadatas and i < len(metadatas) else {}
            items.append({
                "id": doc_id,
                "entity_type": meta.get("entity_type"),
                "entity_name": meta.get("entity_name"),
                "fact": docs[i] if docs and i < len(docs) else "",
                "confidence": meta.get("confidence"),
                "updated_at": meta.get("updated_at")
            })
        return items

    def add_procedural_pattern(
        self,
        pattern_id: str,
        pattern_type: str,
        day_of_week: int,
        hour_bucket: int,
        activity: str,
        weight: float,
        updated_at: int
    ) -> str:
        embedding = self._embed(activity)
        metadata = {
            "pattern_type": pattern_type,
            "day_of_week": day_of_week,
            "hour_bucket": hour_bucket,
            "weight": weight,
            "updated_at": updated_at
        }
        self.procedural.upsert(
            ids=[str(pattern_id)],
            documents=[activity],
            metadatas=[metadata],
            embeddings=[embedding]
        )
        return str(pattern_id)

    def get_patterns_for(self, day: int, hour: int) -> list[dict[str, Any]]:
        result = self.procedural.get(
            where={"$and": [{"day_of_week": day}, {"hour_bucket": hour}]}
        )
        
        items: list[dict[str, Any]] = []
        ids = result.get("ids", [])
        docs = result.get("documents", [])
        metadatas = result.get("metadatas", [])
        
        for i, doc_id in enumerate(ids):
            meta = metadatas[i] if metadatas and i < len(metadatas) else {}
            items.append({
                "id": doc_id,
                "pattern_type": meta.get("pattern_type"),
                "day_of_week": meta.get("day_of_week"),
                "hour_bucket": meta.get("hour_bucket"),
                "activity": docs[i] if docs and i < len(docs) else "",
                "weight": meta.get("weight"),
                "updated_at": meta.get("updated_at")
            })
        return items

    def query(self, text: str, n: int = 5) -> list[dict[str, Any]]:
        """Backward compatibility: perform semantic search on episodic memory."""
        embedding = self._embed(text)
        result = self.episodic.query(query_embeddings=[embedding], n_results=n)
        
        items: list[dict[str, Any]] = []
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]
        
        for i, doc_id in enumerate(ids):
            if i < len(docs):
                summary = docs[i]
                if metadatas and i < len(metadatas):
                    meta = metadatas[i]
                    if meta.get("title"):
                        summary = f"{meta.get('title')}: {summary}"
                score = 1 - float(dists[i]) if dists and i < len(dists) else 0.0
                items.append({"id": doc_id, "summary": summary, "score": score})
        return items


def migrate_existing_to_episodic() -> None:
    old_base = Path.home() / "AppData" / "Roaming" / "ARIA" / "chroma"
    marker_file = old_base / ".migrated_to_aria_memory"
    
    if not old_base.exists() or marker_file.exists():
        return
        
    try:
        old_client = chromadb.PersistentClient(path=str(old_base))
        try:
            old_collection = old_client.get_collection(name="episodic_memory")
        except Exception:
            return  # Collection does not exist
            
        old_data = old_collection.get()
        if not old_data or not old_data.get("ids"):
            return
            
        new_store = MemoryStore()
        
        ids = old_data.get("ids", [])
        docs = old_data.get("documents", [])
        metadatas = old_data.get("metadatas", [])
        
        for i, doc_id in enumerate(ids):
            text = docs[i] if docs and i < len(docs) and docs[i] else ""
            meta = metadatas[i] if metadatas and i < len(metadatas) and metadatas[i] else {}
            
            source = meta.get("source", "unknown")
            timestamp = meta.get("ts", 0)  # The old metadata used "ts"
            
            # Since the old system combined title and type into `text`, we pass `text` as `body`.
            new_store.add_episodic_event(
                event_id=doc_id,
                source=source,
                event_type="migrated",
                timestamp=int(timestamp) if timestamp else 0,
                title="",
                body=text,
                entities_json="{}"
            )
            
        # Create marker file to prevent duplicate migrations
        marker_file.touch(exist_ok=True)
    except Exception as e:
        print(f"Migration failed: {e}")
