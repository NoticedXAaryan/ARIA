from __future__ import annotations

import time
from typing import Iterable


def should_deliver(cognitive_state: str, active_events: Iterable[dict]) -> bool:
    if cognitive_state == "deep_focus":
        return False
    now_ts = int(time.time())
    for event in active_events:
        start_ts = int(event.get("start_ts", 0))
        end_ts = int(event.get("end_ts", start_ts))
        if start_ts <= now_ts <= end_ts:
            return False
    return True
