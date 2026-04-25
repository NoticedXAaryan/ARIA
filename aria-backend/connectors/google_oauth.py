from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from storage.models import NormalizedEvent

# Combined scopes for Calendar + Gmail
SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
]


class GoogleOAuthManager:
    """Manages Google OAuth credentials for both Calendar and Gmail."""

    def __init__(self, credentials_file: str | None = None, token_file: str | None = None) -> None:
        self.credentials_file = credentials_file or os.getenv("GOOGLE_CREDENTIALS_FILE", "")
        appdata = Path.home() / "AppData" / "Roaming" / "ARIA"
        appdata.mkdir(parents=True, exist_ok=True)
        self.token_file = token_file or str(appdata / "google_token.json")
        self._creds: Credentials | None = None

    def get_credentials(self) -> Credentials | None:
        if self._creds and self._creds.valid:
            return self._creds

        creds: Credentials | None = None
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)

        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            Path(self.token_file).write_text(creds.to_json(), encoding="utf-8")
            self._creds = creds
            return creds

        if creds and creds.valid:
            self._creds = creds
            return creds

        return None

    def start_auth_flow(self) -> str | None:
        """Start OAuth flow and return the auth URL. Returns None if no credentials file."""
        if not self.credentials_file or not os.path.exists(self.credentials_file):
            return None

        flow = InstalledAppFlow.from_client_secrets_file(self.credentials_file, SCOPES)
        creds = flow.run_local_server(port=0)
        Path(self.token_file).write_text(creds.to_json(), encoding="utf-8")
        self._creds = creds
        return "completed"

    def is_linked(self) -> bool:
        creds = self.get_credentials()
        return creds is not None and creds.valid

    def get_calendar_service(self):
        creds = self.get_credentials()
        if not creds:
            return None
        return build("calendar", "v3", credentials=creds, cache_discovery=False)

    def get_gmail_service(self):
        creds = self.get_credentials()
        if not creds:
            return None
        return build("gmail", "v1", credentials=creds, cache_discovery=False)


# Global singleton
_oauth_manager: GoogleOAuthManager | None = None


def get_oauth_manager() -> GoogleOAuthManager:
    global _oauth_manager
    if _oauth_manager is None:
        _oauth_manager = GoogleOAuthManager()
    return _oauth_manager
