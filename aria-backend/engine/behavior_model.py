from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime


class BehaviorModel:
    def __init__(self) -> None:
        self.transitions: dict[tuple[int, int], Counter[str]] = defaultdict(Counter)

    def train(self, events: list[dict]) -> None:
        ordered = sorted(events, key=lambda e: e.get("start_ts", 0))
        for event in ordered:
            ts = int(event.get("start_ts", 0))
            dt = datetime.fromtimestamp(ts)
            state = (dt.hour, dt.weekday())
            next_type = event.get("type", "unknown")
            self.transitions[state][next_type] += 1

    def predict(self, ts: int) -> dict[str, object]:
        dt = datetime.fromtimestamp(ts)
        state = (dt.hour, dt.weekday())
        counts = self.transitions.get(state)
        if not counts:
            return {"predicted_next_activity": "focus", "confidence": 0.25}
        label, freq = counts.most_common(1)[0]
        total = sum(counts.values()) or 1
        return {"predicted_next_activity": label, "confidence": freq / total}

    def classify_cognitive_state(self, events: list[dict]) -> str:
        meetings = sum(1 for e in events if e.get("type") == "meeting")
        focus_events = sum(1 for e in events if e.get("type") == "focus")
        if meetings >= 3:
            return "overloaded"
        if focus_events >= 8 and meetings == 0:
            return "deep_focus"
        if focus_events >= 4:
            return "flow"
        return "normal"
