from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from storage.models import NormalizedEvent


SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


class GoogleCalendarConnector:
    def __init__(self, credentials_file: str | None = None, token_file: str | None = None) -> None:
        self.credentials_file = credentials_file or os.getenv("GOOGLE_CREDENTIALS_FILE", "")
        appdata = Path.home() / "AppData" / "Roaming" / "ARIA"
        appdata.mkdir(parents=True, exist_ok=True)
        self.token_file = token_file or str(appdata / "google_token.json")

    def _get_credentials(self) -> Credentials | None:
        creds: Credentials | None = None
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            Path(self.token_file).write_text(creds.to_json(), encoding="utf-8")
            return creds
        if creds and creds.valid:
            return creds
        if not self.credentials_file or not os.path.exists(self.credentials_file):
            return None

        flow = InstalledAppFlow.from_client_secrets_file(self.credentials_file, SCOPES)
        creds = flow.run_local_server(port=0)
        Path(self.token_file).write_text(creds.to_json(), encoding="utf-8")
        return creds

    def fetch_events(self) -> list[NormalizedEvent]:
        creds = self._get_credentials()
        if not creds:
            return []

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
                    external_id=f"gcal:{event.get('id', str(time.time()))}",
                    source="google_calendar",
                    type="meeting",
                    title=event.get("summary", "Untitled Event"),
                    start_ts=start_ts,
                    end_ts=end_ts,
                    metadata_json={
                        "attendee_count": len(event.get("attendees", [])),
                        "status": event.get("status", "confirmed"),
                    },
                )
            )
        return normalized
