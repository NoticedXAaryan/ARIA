from __future__ import annotations

import time
from typing import Any

import requests

from storage.models import NormalizedEvent


class ActivityWatchConnector:
    def __init__(self, base_url: str = "http://127.0.0.1:5600") -> None:
        self.base_url = base_url.rstrip("/")

    def fetch_events(self) -> list[NormalizedEvent]:
        buckets_resp = requests.get(f"{self.base_url}/api/0/buckets", timeout=5)
        buckets_resp.raise_for_status()
        buckets: dict[str, Any] = buckets_resp.json()

        aw_window_bucket = next((k for k in buckets.keys() if "window" in k), None)
        if not aw_window_bucket:
            return []

        now = int(time.time())
        start = now - 900
        events_resp = requests.get(
            f"{self.base_url}/api/0/buckets/{aw_window_bucket}/events",
            params={"start": start, "end": now},
            timeout=5,
        )
        events_resp.raise_for_status()
        raw_events: list[dict[str, Any]] = events_resp.json()

        normalized: list[NormalizedEvent] = []
        for item in raw_events:
            timestamp = int(
                item.get("timestamp_epoch", now)
                if item.get("timestamp_epoch")
                else now
            )
            duration = int(item.get("duration", 0))
            app_name = item.get("data", {}).get("app", "unknown")
            title = item.get("data", {}).get("title", "")
            normalized.append(
                NormalizedEvent(
                    external_id=f"aw:{item.get('id', timestamp)}",
                    source="activitywatch",
                    type="focus",
                    title=title,
                    start_ts=timestamp,
                    end_ts=timestamp + max(duration, 1),
                    metadata_json={"app": app_name, "window_title": title},
                )
            )
        return normalized
