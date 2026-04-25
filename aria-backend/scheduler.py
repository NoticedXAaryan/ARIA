from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from connectors.activity_watcher import ActivityWatchConnector
from connectors.google_calendar import GoogleCalendarConnector
from connectors.gmail_connector import GmailConnector
from connectors.outlook_calendar import OutlookCalendarConnector
from connectors.outlook_mail import OutlookMailConnector
from connectors.notes_watcher import NotesWatcherConnector
from connectors.account_manager import AccountManager
from engine.behavior_model import BehaviorModel
from engine.context_fusion import build_context
from engine.interrupt_gate import should_deliver
from engine.urgency_engine import evaluate_context, persist_candidates
from engine.entity_graph import EntityGraph
from engine.rhythm_gnn import check_data_sufficiency, GNNRhythmModel
from storage.db import DB
from storage.memory import MemoryStore

logger = logging.getLogger(__name__)


class AriaScheduler:
    def __init__(self, db: DB, interval_minutes: int = 15) -> None:
        self.db = db
        self.interval_minutes = interval_minutes
        self.scheduler = BackgroundScheduler()
        self.activity = ActivityWatchConnector()
        self.notes = NotesWatcherConnector()
        self.behavior_model = BehaviorModel()
        self.entity_graph = EntityGraph(db=db)
        try:
            self.memory = MemoryStore()
        except Exception:
            self.memory = None
        self.last_eval_summary: dict[str, int] = {"events_ingested": 0, "nudges_generated": 0}

    def start(self) -> None:
        self.scheduler.add_job(self.run_cycle, "interval", minutes=self.interval_minutes, id="aria_cycle")
        self.scheduler.add_job(self.nightly_retrain, "cron", hour=2, minute=0, id="aria_nightly_retrain")
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
        connectors = [self.activity, self.notes]
        
        # Instantiate account-based connectors dynamically
        account_manager = AccountManager(self.db)
        accounts = account_manager.get_all_accounts()
        for acc in accounts:
            if acc["provider"] == "google":
                connectors.append(GoogleCalendarConnector(acc["id"], acc["email"], self.db))
                connectors.append(GmailConnector(acc["id"], acc["email"], self.db))
            elif acc["provider"] == "outlook":
                connectors.append(OutlookCalendarConnector(acc["id"], acc["email"], self.db))
                connectors.append(OutlookMailConnector(acc["id"], acc["email"], self.db))

        now = int(time.time())
        for connector in connectors:
            c_name = type(connector).__name__
            # Since multiple instances of the same connector class can exist, we should key health by class name + account ID if applicable
            health_key = f"{c_name}_{connector.account_id}" if hasattr(connector, "account_id") else c_name
            health = self.db.get_connector_health(health_key)
            
            if health:
                if health["status"] == "down":
                    logger.warning("Skipping %s: status is down. Manual intervention required.", health_key)
                    continue
                if health["next_retry_at"] and now < health["next_retry_at"]:
                    continue
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
                        # Extract and merge entities into EntityGraph
                        self.entity_graph.extract_entities_from_event(event)
                self.db.update_connector_success(health_key)
            except Exception as e:
                self.db.update_connector_failure(health_key, str(e))
                logger.warning("Connector %s failed: %s", health_key, e)

        # Phase 2: Build context with behavior model integration
        context = build_context(self.db, behavior_model=self.behavior_model)
        cognitive_state = context.get("cognitive_state", "normal")

        # Phase 3: Evaluate urgency and generate candidates
        candidates = evaluate_context(context, db=self.db)

        # Phase 4: Check interrupt gate using actual cognitive state
        active_events = [e for e in context["upcoming_events"] if e.get("type") == "meeting"]
        can_deliver = should_deliver(cognitive_state, active_events)

        # Phase 4.5: Determine routing target — desktop or mobile
        routing_target = self._determine_routing_target()

        # Phase 5: Persist candidates with appropriate surface
        if routing_target == "mobile":
            surface = "mobile"
        elif can_deliver:
            surface = "popup"
        else:
            surface = "silent"

        created = persist_candidates(self.db, candidates, surface=surface)

        # Phase 6: If routed to mobile, fire push notifications
        if routing_target == "mobile" and created:
            self._send_mobile_push(created)

        self.last_eval_summary = {
            "events_ingested": ingested,
            "nudges_generated": len(created),
            "cognitive_state": cognitive_state,
            "can_deliver": can_deliver,
            "routing_target": routing_target,
        }
        logger.info("Cycle complete: %s", self.last_eval_summary)
        return self.last_eval_summary

    def _determine_routing_target(self) -> str:
        """Check ActivityWatch for recent desktop activity. If idle >10min, route to mobile."""
        import time
        try:
            events = self.activity.fetch_events()
            if not events:
                return "mobile"
            # Find most recent activity event
            now = int(time.time())
            latest_ts = max(e.start_ts for e in events) if events else 0
            idle_minutes = (now - latest_ts) / 60
            if idle_minutes > 10:
                # Check if any mobile devices are paired
                with self.db.connect() as conn:
                    device = conn.execute("SELECT 1 FROM devices LIMIT 1").fetchone()
                if device:
                    return "mobile"
        except Exception as e:
            logger.debug("Routing check failed (defaulting to desktop): %s", e)
        return "desktop"

    def _send_mobile_push(self, nudge_ids: list[int]) -> None:
        """Send push notifications to all paired mobile devices via Expo Push API."""
        import requests as _req
        # Get all device push tokens
        with self.db.connect() as conn:
            devices = conn.execute("SELECT push_token FROM devices WHERE push_token IS NOT NULL").fetchall()
        if not devices:
            return

        # Get the nudge texts
        with self.db.connect() as conn:
            placeholders = ",".join(["?"] * len(nudge_ids))
            nudges = conn.execute(
                f"SELECT id, suggestion_text, urgency_score FROM nudge_log WHERE id IN ({placeholders})",
                nudge_ids
            ).fetchall()

        messages = []
        for device in devices:
            token = device["push_token"]
            if not token:
                continue
            for nudge in nudges:
                messages.append({
                    "to": token,
                    "title": "ARIA",
                    "body": nudge["suggestion_text"],
                    "data": {
                        "nudge_id": nudge["id"],
                        "urgency": nudge["urgency_score"],
                    },
                    "sound": "default",
                })

        if not messages:
            return

        try:
            _req.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            logger.info("Sent %d push notifications to %d devices", len(messages), len(devices))
        except Exception as e:
            logger.warning("Push notification failed: %s", e)

    def run_manual_eval(self) -> dict[str, int]:
        return self.run_cycle()

    def nightly_retrain(self) -> None:
        """Run nightly model retraining. Upgrades to GNN if data is sufficient."""
        logger.info("Starting nightly retrain job...")
        
        suff = check_data_sufficiency(self.db)
        if suff["sufficient"]:
            logger.info("Data sufficiency met (%d days, %d events). Training GNN model.", suff["days"], suff["events"])
            try:
                gnn_model = GNNRhythmModel(self.db)
                gnn_model.train_gnn_model()
                logger.info("GNN retrained on %d days of data.", suff["days"])
            except Exception as e:
                logger.error("Failed to train GNN: %s", e)
                # Fallback to updating markov model
                self._update_markov_chain()
        else:
            logger.info("Insufficient data for GNN: %d days, %d events. Updating Markov chain.", suff["days"], suff["events"])
            self._update_markov_chain()
            logger.info("Markov updated, %d days (GNN needs 7+).", suff["days"])

    def _update_markov_chain(self) -> None:
        """Update the existing Markov chain model with recent events."""
        import time
        now_ts = int(time.time())
        lookback = 30 * 86400  # 30 days
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT start_ts, type FROM events WHERE start_ts >= ? ORDER BY start_ts",
                (now_ts - lookback,)
            ).fetchall()
        
        events = [{"start_ts": row["start_ts"], "type": row["type"]} for row in rows]
        if events:
            self.behavior_model.train(events)
