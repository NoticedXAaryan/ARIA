import logging
import time
from datetime import datetime, timedelta, timezone

import requests

from storage.models import NormalizedEvent
from storage.db import DB
from connectors.account_manager import AccountManager

logger = logging.getLogger(__name__)

class OutlookCalendarConnector:
    def __init__(self, account_id: str, email: str, db: DB) -> None:
        self.account_id = account_id
        self.email = email
        self.db = db
        self.account_manager = AccountManager(self.db)

    def fetch_events(self) -> list[NormalizedEvent]:
        access_token = self.account_manager.refresh_token_if_needed(self.account_id)
        if not access_token:
            raise ValueError(f"No access token for Outlook account {self.account_id}")

        now_str = datetime.now(timezone.utc).isoformat()
        seven_days_str = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        
        # https://graph.microsoft.com/v1.0/me/calendarView?startDateTime={start}&endDateTime={end}
        url = f"https://graph.microsoft.com/v1.0/me/calendarView"
        params = {
            "startDateTime": now_str,
            "endDateTime": seven_days_str,
            "$select": "id,subject,start,end,attendees,showAs",
            "$top": 50
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        }
        
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
        
        items = data.get("value", [])
        normalized: list[NormalizedEvent] = []
        
        for event in items:
            start_dict = event.get("start", {})
            end_dict = event.get("end", {})
            
            start_time_str = start_dict.get("dateTime")
            end_time_str = end_dict.get("dateTime")
            
            if not start_time_str:
                continue
                
            # Graph API returns e.g. "2023-10-15T10:00:00.0000000" without Z sometimes if timeZone is UTC
            # It's safer to parse and assume UTC if timeZone is UTC.
            try:
                start_ts = int(datetime.fromisoformat(start_time_str[:19]).replace(tzinfo=timezone.utc).timestamp())
                end_ts = int(datetime.fromisoformat(end_time_str[:19]).replace(tzinfo=timezone.utc).timestamp()) if end_time_str else None
            except ValueError:
                continue
            
            normalized.append(
                NormalizedEvent(
                    external_id=f"outlookcal:{self.account_id}:{event.get('id')}",
                    source="outlook_calendar",
                    type="meeting",
                    title=event.get("subject", "Untitled Event"),
                    start_ts=start_ts,
                    end_ts=end_ts,
                    metadata_json={
                        "account_id": self.account_id,
                        "email": self.email,
                        "attendee_count": len(event.get("attendees", [])),
                        "status": event.get("showAs", "busy")
                    },
                )
            )
            
        return normalized
