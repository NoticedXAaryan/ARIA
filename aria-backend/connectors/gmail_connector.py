from __future__ import annotations

import logging
import time

from storage.models import NormalizedEvent
from connectors.google_oauth import get_oauth_manager

logger = logging.getLogger(__name__)


class GmailConnector:
    """Pulls recent email metadata (subject, sender, timestamp) — never body content."""

    def __init__(self) -> None:
        self._last_history_id: str | None = None

    def fetch_events(self) -> list[NormalizedEvent]:
        oauth = get_oauth_manager()
        service = oauth.get_gmail_service()
        if not service:
            return []

        try:
            # Get recent messages (last 24h)
            results = (
                service.users()
                .messages()
                .list(userId="me", maxResults=20, q="newer_than:1d")
                .execute()
            )
            messages = results.get("messages", [])
        except Exception as e:
            logger.warning("Gmail fetch error: %s", e)
            return []

        events: list[NormalizedEvent] = []
        for msg_summary in messages:
            try:
                msg = (
                    service.users()
                    .messages()
                    .get(
                        userId="me",
                        id=msg_summary["id"],
                        format="metadata",
                        metadataHeaders=["Subject", "From", "Date"],
                    )
                    .execute()
                )
                headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                subject = headers.get("Subject", "(no subject)")
                sender = headers.get("From", "unknown")
                # Parse internal date (epoch ms)
                internal_date = int(msg.get("internalDate", 0)) // 1000
                if internal_date == 0:
                    internal_date = int(time.time())

                events.append(
                    NormalizedEvent(
                        external_id=f"gmail:{msg_summary['id']}",
                        source="gmail",
                        type="email",
                        title=subject,
                        start_ts=internal_date,
                        end_ts=internal_date,
                        metadata_json={
                            "sender": sender,
                            "is_unread": "UNREAD" in msg.get("labelIds", []),
                            "is_important": "IMPORTANT" in msg.get("labelIds", []),
                        },
                    )
                )
            except Exception as e:
                logger.debug("Gmail message parse error: %s", e)
                continue

        return events
