import logging
import time

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from storage.models import NormalizedEvent
from storage.db import DB
from connectors.account_manager import AccountManager

logger = logging.getLogger(__name__)

class GmailConnector:
    """Pulls recent email metadata (subject, sender, timestamp) — never body content."""

    def __init__(self, account_id: str, email: str, db: DB) -> None:
        self.account_id = account_id
        self.email = email
        self.db = db
        self.account_manager = AccountManager(self.db)

    def fetch_events(self) -> list[NormalizedEvent]:
        access_token = self.account_manager.refresh_token_if_needed(self.account_id)
        if not access_token:
            raise ValueError(f"No access token for Gmail account {self.account_id}")

        creds = Credentials(access_token)
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)

        # Get recent messages (last 24h)
        results = (
            service.users()
            .messages()
            .list(userId="me", maxResults=20, q="newer_than:1d")
            .execute()
        )
        messages = results.get("messages", [])

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
                        external_id=f"gmail:{self.account_id}:{msg_summary['id']}",
                        source="gmail",
                        type="email",
                        title=subject,
                        start_ts=internal_date,
                        end_ts=internal_date,
                        metadata_json={
                            "account_id": self.account_id,
                            "email": self.email,
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
