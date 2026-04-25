import logging
import time
from datetime import datetime, timezone

import requests

from storage.models import NormalizedEvent
from storage.db import DB
from connectors.account_manager import AccountManager

logger = logging.getLogger(__name__)

class OutlookMailConnector:
    def __init__(self, account_id: str, email: str, db: DB) -> None:
        self.account_id = account_id
        self.email = email
        self.db = db
        self.account_manager = AccountManager(self.db)

    def fetch_events(self) -> list[NormalizedEvent]:
        access_token = self.account_manager.refresh_token_if_needed(self.account_id)
        if not access_token:
            raise ValueError(f"No access token for Outlook account {self.account_id}")

        # Fetch recent messages (e.g. from the last 24 hours, but we'll just get top 20 for simplicity)
        url = "https://graph.microsoft.com/v1.0/me/messages"
        params = {
            "$select": "id,subject,from,receivedDateTime,isRead,importance",
            "$top": 20,
            "$orderby": "receivedDateTime desc"
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
        
        for msg in items:
            received_str = msg.get("receivedDateTime")
            if not received_str:
                continue
                
            try:
                received_ts = int(datetime.fromisoformat(received_str[:19]).replace(tzinfo=timezone.utc).timestamp())
            except ValueError:
                received_ts = int(time.time())
                
            sender_dict = msg.get("from", {}).get("emailAddress", {})
            sender = sender_dict.get("address", "unknown")
            
            normalized.append(
                NormalizedEvent(
                    external_id=f"outlookmail:{self.account_id}:{msg.get('id')}",
                    source="outlook_mail",
                    type="email",
                    title=msg.get("subject", "(no subject)"),
                    start_ts=received_ts,
                    end_ts=received_ts,
                    metadata_json={
                        "account_id": self.account_id,
                        "email": self.email,
                        "sender": sender,
                        "is_unread": not msg.get("isRead", True),
                        "is_important": msg.get("importance") == "high",
                    },
                )
            )
            
        return normalized
