from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path

from storage.models import NormalizedEvent


class NotesWatcherConnector:
    def __init__(self, notes_path: str | None = None) -> None:
        self.notes_path = Path(notes_path or os.getenv("ARIA_NOTES_PATH", "")).expanduser()
        self._seen: dict[str, float] = {}

    def fetch_events(self) -> list[NormalizedEvent]:
        if not self.notes_path or not self.notes_path.exists() or not self.notes_path.is_dir():
            raise ValueError(f"Invalid notes path: {self.notes_path}")

        events: list[NormalizedEvent] = []
        for md_file in self.notes_path.rglob("*.md"):
            try:
                stat = md_file.stat()
            except OSError:
                continue
            mtime = stat.st_mtime
            cache_key = str(md_file)
            if self._seen.get(cache_key) == mtime:
                continue
            self._seen[cache_key] = mtime
            ts = int(mtime)
            digest = hashlib.sha1(f"{cache_key}:{ts}".encode("utf-8")).hexdigest()
            events.append(
                NormalizedEvent(
                    external_id=f"notes:{digest}",
                    source="notes",
                    type="note_update",
                    title=md_file.stem,
                    start_ts=ts,
                    end_ts=ts,
                    metadata_json={"path": str(md_file), "size_bytes": stat.st_size},
                )
            )
        return events
