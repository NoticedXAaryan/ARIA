from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class NormalizedEvent:
    external_id: str
    source: str
    type: str
    start_ts: int
    end_ts: int | None = None
    title: str | None = None
    metadata_json: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class NudgeCandidate:
    reason: str
    suggestion_text: str
    urgency_score: float
    context: dict[str, Any]
