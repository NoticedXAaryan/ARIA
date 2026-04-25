from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

from .models import NormalizedEvent


DEFAULT_DB_PATH = Path.home() / "AppData" / "Roaming" / "ARIA" / "aria.db"


class DB:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def initialize(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS events (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  external_id TEXT UNIQUE,
                  source TEXT NOT NULL,
                  type TEXT NOT NULL,
                  title TEXT,
                  start_ts INTEGER NOT NULL,
                  end_ts INTEGER,
                  metadata_json TEXT,
                  embedding_id TEXT,
                  created_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
                CREATE INDEX IF NOT EXISTS idx_events_start_ts ON events(start_ts);
                CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

                CREATE TABLE IF NOT EXISTS nudge_log (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  generated_at INTEGER NOT NULL,
                  delivered_at INTEGER,
                  urgency_score REAL NOT NULL,
                  context_json TEXT NOT NULL,
                  suggestion_text TEXT NOT NULL,
                  reason TEXT,
                  surface TEXT,
                  outcome TEXT,
                  snoozed_until INTEGER,
                  feedback_weight REAL
                );

                CREATE INDEX IF NOT EXISTS idx_nudge_log_generated_at ON nudge_log(generated_at);
                CREATE INDEX IF NOT EXISTS idx_nudge_log_outcome ON nudge_log(outcome);
                CREATE INDEX IF NOT EXISTS idx_nudge_log_active_lookup ON nudge_log(outcome, snoozed_until, generated_at);

                CREATE TABLE IF NOT EXISTS settings (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS habits (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  habit_type TEXT NOT NULL,
                  pattern_json TEXT NOT NULL,
                  confidence REAL NOT NULL,
                  observation_count INTEGER NOT NULL DEFAULT 0,
                  last_seen INTEGER NOT NULL,
                  is_active INTEGER NOT NULL DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS tasks (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  title TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  done INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS connector_health (
                  connector TEXT PRIMARY KEY,
                  status TEXT NOT NULL,
                  last_success INTEGER,
                  error_msg TEXT,
                  failed_at INTEGER,
                  consecutive_failures INTEGER DEFAULT 0,
                  next_retry_at INTEGER
                );

                CREATE TABLE IF NOT EXISTS accounts (
                  id TEXT PRIMARY KEY,
                  provider TEXT NOT NULL,
                  email TEXT,
                  access_token TEXT,
                  refresh_token TEXT,
                  expires_at INTEGER,
                  added_at INTEGER,
                  is_active INTEGER DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS entities (
                  id TEXT PRIMARY KEY,
                  type TEXT NOT NULL,
                  canonical_name TEXT NOT NULL,
                  aliases_json TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS entity_sources (
                  entity_id TEXT NOT NULL,
                  source TEXT NOT NULL,
                  account_id TEXT,
                  reference_id TEXT,
                  last_seen INTEGER NOT NULL,
                  FOREIGN KEY(entity_id) REFERENCES entities(id)
                );

                CREATE TABLE IF NOT EXISTS entity_relations (
                  id TEXT PRIMARY KEY,
                  entity_id_a TEXT NOT NULL,
                  entity_id_b TEXT NOT NULL,
                  relation_type TEXT NOT NULL,
                  weight REAL NOT NULL,
                  last_seen INTEGER NOT NULL,
                  FOREIGN KEY(entity_id_a) REFERENCES entities(id),
                  FOREIGN KEY(entity_id_b) REFERENCES entities(id)
                );

                CREATE TABLE IF NOT EXISTS devices (
                  device_id TEXT PRIMARY KEY,
                  push_token TEXT,
                  platform TEXT,
                  paired_at INTEGER,
                  last_seen INTEGER
                );

                CREATE TABLE IF NOT EXISTS pair_codes (
                  code TEXT PRIMARY KEY,
                  created_at INTEGER NOT NULL,
                  expires_at INTEGER NOT NULL,
                  used INTEGER DEFAULT 0
                );
                """
            )
            defaults = {
                "interrupt_deep_focus": True,
                "interrupt_in_meeting": True,
                "max_nudges_per_day": 8,
                "snooze_default_minutes": 15,
                "openrouter_model": "google/gemini-2.0-flash-exp:free",
            }
            for key, value in defaults.items():
                conn.execute(
                    "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
                    (key, json.dumps(value)),
                )
            # Backward-compatible migration for existing DBs created before `reason` existed.
            cols = {row["name"] for row in conn.execute("PRAGMA table_info(nudge_log)")}
            if "reason" not in cols:
                conn.execute("ALTER TABLE nudge_log ADD COLUMN reason TEXT")
            conn.commit()

    def insert_events(self, events: Iterable[NormalizedEvent]) -> int:
        rows = [
            (
                e.external_id,
                e.source,
                e.type,
                e.title,
                e.start_ts,
                e.end_ts,
                json.dumps(e.metadata_json),
                int(time.time()),
            )
            for e in events
        ]
        if not rows:
            return 0

        with self.connect() as conn:
            conn.executemany(
                """
                INSERT OR IGNORE INTO events
                (external_id, source, type, title, start_ts, end_ts, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()
            return conn.total_changes

    def get_upcoming_events(self, horizon_seconds: int = 7200) -> list[sqlite3.Row]:
        now_ts = int(time.time())
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM events
                    WHERE start_ts BETWEEN ? AND ?
                    ORDER BY start_ts ASC
                    """,
                    (now_ts, now_ts + horizon_seconds),
                )
            )

    def get_recent_note_events(self, lookback_seconds: int = 86400) -> list[sqlite3.Row]:
        now_ts = int(time.time())
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM events
                    WHERE source = 'notes' AND start_ts >= ?
                    ORDER BY start_ts DESC
                    """,
                    (now_ts - lookback_seconds,),
                )
            )

    def get_recent_emails(self, lookback_seconds: int = 86400) -> list[sqlite3.Row]:
        now_ts = int(time.time())
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM events
                    WHERE source = 'gmail' AND start_ts >= ?
                    ORDER BY start_ts DESC
                    """,
                    (now_ts - lookback_seconds,),
                )
            )

    def log_nudge(
        self,
        urgency_score: float,
        context_json: str,
        suggestion_text: str,
        reason: str | None = None,
        surface: str = "popup",
        outcome: str | None = None,
    ) -> int:
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO nudge_log
                (generated_at, delivered_at, urgency_score, context_json, suggestion_text, reason, surface, outcome)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(time.time()),
                    int(time.time()),
                    urgency_score,
                    context_json,
                    suggestion_text,
                    reason,
                    surface,
                    outcome,
                ),
            )
            conn.commit()
            return int(cur.lastrowid)

    def get_active_nudges(self) -> list[sqlite3.Row]:
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT id, suggestion_text, urgency_score, surface, snoozed_until
                    FROM nudge_log
                    WHERE outcome IS NULL OR outcome = 'snoozed'
                    ORDER BY generated_at DESC
                    """
                )
            )

    def get_nudge_history(self, page: int = 1, page_size: int = 20) -> list[sqlite3.Row]:
        offset = max(0, (page - 1) * page_size)
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT * FROM nudge_log
                    ORDER BY generated_at DESC
                    LIMIT ? OFFSET ?
                    """,
                    (page_size, offset),
                )
            )

    def update_nudge_feedback(self, nudge_id: int, outcome: str) -> bool:
        with self.connect() as conn:
            cur = conn.execute(
                "UPDATE nudge_log SET outcome = ? WHERE id = ?",
                (outcome, nudge_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def mark_pair_code_used(self, code: str, now_ts: int | None = None) -> bool:
        now = now_ts if now_ts is not None else int(time.time())
        with self.connect() as conn:
            cur = conn.execute(
                """
                UPDATE pair_codes
                SET used = 1
                WHERE code = ? AND expires_at > ? AND used = 0
                """,
                (code, now),
            )
            conn.commit()
            return cur.rowcount > 0

    def expire_queued_nudges(self, max_age_seconds: int = 14400) -> int:
        cutoff = int(time.time()) - max_age_seconds
        with self.connect() as conn:
            cur = conn.execute(
                """
                UPDATE nudge_log
                SET outcome = 'expired'
                WHERE (outcome IS NULL OR outcome = 'queued') AND generated_at < ?
                """,
                (cutoff,),
            )
            conn.commit()
            return cur.rowcount

    def get_settings(self) -> dict[str, object]:
        with self.connect() as conn:
            rows = list(conn.execute("SELECT key, value FROM settings"))
        return {row["key"]: json.loads(row["value"]) for row in rows}

    def update_settings(self, updates: dict[str, object]) -> None:
        with self.connect() as conn:
            for key, value in updates.items():
                conn.execute(
                    "INSERT INTO settings(key, value) VALUES(?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (key, json.dumps(value)),
                )
            conn.commit()

    def increment_metric(self, key: str) -> None:
        settings = self.get_settings()
        current = settings.get(key, 0)
        if isinstance(current, int):
            self.update_settings({key: current + 1})
        else:
            self.update_settings({key: 1})

    def add_task(self, title: str) -> int:
        with self.connect() as conn:
            cur = conn.execute(
                "INSERT INTO tasks(title, created_at, done) VALUES (?, ?, 0)",
                (title, int(time.time())),
            )
            conn.commit()
            return int(cur.lastrowid)

    def get_habits(self) -> list[sqlite3.Row]:
        with self.connect() as conn:
            return list(
                conn.execute(
                    "SELECT habit_type, pattern_json, confidence FROM habits WHERE is_active=1 ORDER BY confidence DESC"
                )
            )

    def upsert_habit(self, habit_type: str, pattern_json: dict, confidence: float) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO habits(habit_type, pattern_json, confidence, observation_count, last_seen, is_active)
                VALUES (?, ?, ?, 1, ?, 1)
                """,
                (habit_type, json.dumps(pattern_json), confidence, int(time.time())),
            )
            conn.commit()

    def update_connector_success(self, connector_name: str) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO connector_health(connector, status, last_success, consecutive_failures, next_retry_at, error_msg, failed_at)
                VALUES (?, 'ok', ?, 0, NULL, NULL, NULL)
                ON CONFLICT(connector) DO UPDATE SET
                  status = 'ok',
                  last_success = excluded.last_success,
                  consecutive_failures = 0,
                  next_retry_at = NULL,
                  error_msg = NULL,
                  failed_at = NULL
                """,
                (connector_name, int(time.time())),
            )
            conn.commit()

    def update_connector_failure(self, connector_name: str, error_msg: str) -> None:
        with self.connect() as conn:
            row = conn.execute("SELECT consecutive_failures FROM connector_health WHERE connector = ?", (connector_name,)).fetchone()
            failures = (row["consecutive_failures"] if row else 0) + 1
            now = int(time.time())
            
            if failures >= 4:
                status = "down"
                next_retry = None
            else:
                status = "error"
                # Exponential backoff: 1st retry -> 2m, 2nd -> 8m, 3rd -> 30m
                delays = {1: 120, 2: 480, 3: 1800}
                next_retry = now + delays.get(failures, 1800)

            conn.execute(
                """
                INSERT INTO connector_health(connector, status, error_msg, failed_at, consecutive_failures, next_retry_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(connector) DO UPDATE SET
                  status = excluded.status,
                  error_msg = excluded.error_msg,
                  failed_at = excluded.failed_at,
                  consecutive_failures = excluded.consecutive_failures,
                  next_retry_at = excluded.next_retry_at
                """,
                (connector_name, status, error_msg, now, failures, next_retry),
            )
            conn.commit()

    def get_connector_health(self, connector_name: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM connector_health WHERE connector = ?", (connector_name,)).fetchone()
            return dict(row) if row else None

    def get_all_connector_health(self) -> list[dict]:
        with self.connect() as conn:
            return [dict(row) for row in conn.execute("SELECT * FROM connector_health")]

    def reset_connector_health(self, connector_name: str) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE connector_health SET 
                  status = 'ok', 
                  consecutive_failures = 0, 
                  next_retry_at = NULL, 
                  error_msg = NULL 
                WHERE connector = ?
                """,
                (connector_name,)
            )
            conn.commit()

    # ─── Entities ───

    def get_all_entities(self) -> list[sqlite3.Row]:
        with self.connect() as conn:
            return conn.execute("SELECT * FROM entities").fetchall()

    def get_entity_by_name(self, name: str, entity_type: str) -> sqlite3.Row | None:
        with self.connect() as conn:
            return conn.execute(
                "SELECT * FROM entities WHERE type = ? AND (canonical_name = ? OR json_extract(aliases_json, '$') LIKE ?)",
                (entity_type, name, f'%"{name}"%')
            ).fetchone()
            
    def get_entity_by_id(self, entity_id: str) -> sqlite3.Row | None:
        with self.connect() as conn:
            return conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()

    def create_entity(self, entity_id: str, type: str, canonical_name: str, aliases: list[str]) -> None:
        now = int(time.time())
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO entities (id, type, canonical_name, aliases_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (entity_id, type, canonical_name, json.dumps(aliases), now, now)
            )
            conn.commit()

    def update_entity(self, entity_id: str, canonical_name: str, aliases: list[str]) -> None:
        now = int(time.time())
        with self.connect() as conn:
            conn.execute(
                "UPDATE entities SET canonical_name = ?, aliases_json = ?, updated_at = ? WHERE id = ?",
                (canonical_name, json.dumps(aliases), now, entity_id)
            )
            conn.commit()

    def add_entity_source(self, entity_id: str, source: str, account_id: str | None, reference_id: str | None) -> None:
        now = int(time.time())
        with self.connect() as conn:
            existing = conn.execute(
                "SELECT 1 FROM entity_sources WHERE entity_id = ? AND source = ? AND reference_id = ?",
                (entity_id, source, reference_id)
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE entity_sources SET last_seen = ? WHERE entity_id = ? AND source = ? AND reference_id = ?",
                    (now, entity_id, source, reference_id)
                )
            else:
                conn.execute(
                    "INSERT INTO entity_sources (entity_id, source, account_id, reference_id, last_seen) VALUES (?, ?, ?, ?, ?)",
                    (entity_id, source, account_id, reference_id, now)
                )
            conn.commit()

    def upsert_entity_relation(self, entity_id_a: str, entity_id_b: str, relation_type: str, weight_increment: float = 1.0) -> None:
        id_1, id_2 = sorted([entity_id_a, entity_id_b])
        now = int(time.time())
        with self.connect() as conn:
            existing = conn.execute(
                "SELECT id, weight FROM entity_relations WHERE entity_id_a = ? AND entity_id_b = ? AND relation_type = ?",
                (id_1, id_2, relation_type)
            ).fetchone()
            if existing:
                new_weight = existing["weight"] + weight_increment
                conn.execute(
                    "UPDATE entity_relations SET weight = ?, last_seen = ? WHERE id = ?",
                    (new_weight, now, existing["id"])
                )
            else:
                import uuid
                rel_id = str(uuid.uuid4())
                conn.execute(
                    "INSERT INTO entity_relations (id, entity_id_a, entity_id_b, relation_type, weight, last_seen) VALUES (?, ?, ?, ?, ?, ?)",
                    (rel_id, id_1, id_2, relation_type, weight_increment, now)
                )
            conn.commit()

    def get_related_entities(self, entity_id: str) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT e.*, er.relation_type, er.weight, er.last_seen as relation_last_seen
                FROM entity_relations er
                JOIN entities e ON (e.id = er.entity_id_a OR e.id = er.entity_id_b)
                WHERE (er.entity_id_a = ? OR er.entity_id_b = ?) AND e.id != ?
                ORDER BY er.weight DESC
                LIMIT 50
                """,
                (entity_id, entity_id, entity_id)
            ).fetchall()
            return [dict(r) for r in rows]
