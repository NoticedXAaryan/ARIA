from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import chromadb
from sentence_transformers import SentenceTransformer


class MemoryStore:
    def __init__(self, data_dir: Path | None = None) -> None:
        base = data_dir or (Path.home() / "AppData" / "Roaming" / "ARIA" / "chroma")
        base.mkdir(parents=True, exist_ok=True)
        self.client = chromadb.PersistentClient(path=str(base))
        self.collection = self.client.get_or_create_collection(name="episodic_memory")
        self.model = SentenceTransformer("all-MiniLM-L6-v2")

    def embed_and_store(self, text: str, metadata: dict[str, Any]) -> str:
        doc_id = hashlib.sha1(text.encode("utf-8")).hexdigest()
        embedding = self.model.encode([text])[0].tolist()
        self.collection.upsert(
            ids=[doc_id],
            documents=[text],
            metadatas=[metadata],
            embeddings=[embedding],
        )
        return doc_id

    def query(self, text: str, n: int = 5) -> list[dict[str, Any]]:
        embedding = self.model.encode([text])[0].tolist()
        result = self.collection.query(query_embeddings=[embedding], n_results=n)
        items: list[dict[str, Any]] = []
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        dists = result.get("distances", [[]])[0]
        for i, doc_id in enumerate(ids):
            items.append({"id": doc_id, "summary": docs[i], "score": 1 - float(dists[i])})
        return items
