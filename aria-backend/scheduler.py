from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from connectors.activity_watcher import ActivityWatchConnector
from connectors.google_calendar import GoogleCalendarConnector
from connectors.gmail_connector import GmailConnector
from connectors.notes_watcher import NotesWatcherConnector
from engine.behavior_model import BehaviorModel
from engine.context_fusion import build_context
from engine.interrupt_gate import should_deliver
from engine.urgency_engine import evaluate_context, persist_candidates
from storage.db import DB
from storage.memory import MemoryStore

logger = logging.getLogger(__name__)


class AriaScheduler:
    def __init__(self, db: DB, interval_minutes: int = 15) -> None:
        self.db = db
        self.interval_minutes = interval_minutes
        self.scheduler = BackgroundScheduler()
        self.google = GoogleCalendarConnector()
        self.activity = ActivityWatchConnector()
        self.notes = NotesWatcherConnector()
        self.gmail = GmailConnector()
        self.behavior_model = BehaviorModel()
        try:
            self.memory = MemoryStore()
        except Exception:
            self.memory = None
        self.last_eval_summary: dict[str, int] = {"events_ingested": 0, "nudges_generated": 0}

    def start(self) -> None:
        self.scheduler.add_job(self.run_cycle, "interval", minutes=self.interval_minutes, id="aria_cycle")
        self.scheduler.start()
        logger.info("Scheduler started. Interval=%s minutes", self.interval_minutes)

    def shutdown(self) -> None:
        self.scheduler.shutdown(wait=False)

    def run_cycle(self) -> dict[str, int]:
        # Phase 0: Expire old queued nudges
        expired_count = self.db.expire_queued_nudges(4 * 3600)
        if expired_count > 0:
            logger.info("Expired %d old nudges", expired_count)

        # Phase 1: Ingest from all connectors
        ingested = 0
        connectors = [self.google, self.activity, self.notes, self.gmail]
        for connector in connectors:
            try:
                events = connector.fetch_events()
                ingested += self.db.insert_events(events)
                if self.memory:
                    for event in events:
                        text = f"{event.type} {event.title or ''}".strip()
                        if text:
                            import hashlib
                            event_id = event.external_id or hashlib.sha1(text.encode("utf-8")).hexdigest()
                            self.memory.add_episodic_event(
                                event_id=event_id,
                                source=event.source,
                                event_type=event.type,
                                timestamp=event.start_ts,
                                title=event.title or "",
                                body=text,
                                entities_json="{}"
                            )
            except Exception as e:
                logger.warning("Connector %s failed: %s", type(connector).__name__, e)

        # Phase 2: Build context with behavior model integration
        context = build_context(self.db, behavior_model=self.behavior_model)
        cognitive_state = context.get("cognitive_state", "normal")

        # Phase 3: Evaluate urgency and generate candidates
        candidates = evaluate_context(context, db=self.db)

        # Phase 4: Check interrupt gate using actual cognitive state
        active_events = [e for e in context["upcoming_events"] if e.get("type") == "meeting"]
        can_deliver = should_deliver(cognitive_state, active_events)

        # Phase 5: Persist candidates with appropriate surface
        created = persist_candidates(self.db, candidates, surface="popup" if can_deliver else "silent")

        self.last_eval_summary = {
            "events_ingested": ingested,
            "nudges_generated": len(created),
            "cognitive_state": cognitive_state,
            "can_deliver": can_deliver,
        }
        logger.info("Cycle complete: %s", self.last_eval_summary)
        return self.last_eval_summary

    def run_manual_eval(self) -> dict[str, int]:
        return self.run_cycle()
