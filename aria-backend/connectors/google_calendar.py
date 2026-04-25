import logging
import time
from datetime import datetime, timedelta, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from storage.models import NormalizedEvent
from storage.db import DB
from connectors.account_manager import AccountManager

logger = logging.getLogger(__name__)

class GoogleCalendarConnector:
    def __init__(self, account_id: str, email: str, db: DB) -> None:
        self.account_id = account_id
        self.email = email
        self.db = db
        self.account_manager = AccountManager(self.db)

    def fetch_events(self) -> list[NormalizedEvent]:
        access_token = self.account_manager.refresh_token_if_needed(self.account_id)
        if not access_token:
            raise ValueError(f"No access token for Google Calendar account {self.account_id}")

        creds = Credentials(access_token)
        service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        
        now = datetime.now(timezone.utc).isoformat()
        seven_days = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        
        payload = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now,
                timeMax=seven_days,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )
        
        items = payload.get("items", [])
        normalized: list[NormalizedEvent] = []
        for event in items:
            start = event.get("start", {}).get("dateTime") or event.get("start", {}).get("date")
            end = event.get("end", {}).get("dateTime") or event.get("end", {}).get("date")
            if not start:
                continue
            
            start_ts = int(datetime.fromisoformat(start.replace("Z", "+00:00")).timestamp())
            end_ts = (
                int(datetime.fromisoformat(end.replace("Z", "+00:00")).timestamp()) if end else None
            )
            
            normalized.append(
                NormalizedEvent(
                    external_id=f"gcal:{self.account_id}:{event.get('id', str(time.time()))}",
                    source="google_calendar",
                    type="meeting",
                    title=event.get("summary", "Untitled Event"),
                    start_ts=start_ts,
                    end_ts=end_ts,
                    metadata_json={
                        "account_id": self.account_id,
                        "email": self.email,
                        "attendee_count": len(event.get("attendees", [])),
                        "status": event.get("status", "confirmed"),
                    },
                )
            )
        return normalized
