import os
import time
import uuid
import logging
from typing import Dict, List, Any
import requests
from google_auth_oauthlib.flow import Flow
from storage.db import DB

logger = logging.getLogger(__name__)

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
]

OUTLOOK_SCOPES = ["Calendars.Read", "Mail.Read", "offline_access", "User.Read"]

# Default redirect URIs for local usage.
GOOGLE_REDIRECT_URI = "http://localhost:5173/auth/google/callback"
OUTLOOK_REDIRECT_URI = "http://localhost:5173/auth/outlook/callback"

class AccountManager:
    def __init__(self, db: DB):
        self.db = db

    def get_google_auth_url(self) -> str:
        credentials_file = os.getenv("GOOGLE_CREDENTIALS_FILE", "")
        if not credentials_file or not os.path.exists(credentials_file):
            raise ValueError("GOOGLE_CREDENTIALS_FILE not set or missing.")

        flow = Flow.from_client_secrets_file(
            credentials_file,
            scopes=GOOGLE_SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI
        )
        auth_url, _ = flow.authorization_url(prompt="consent")
        return auth_url

    def add_google_account(self, auth_code: str) -> str:
        credentials_file = os.getenv("GOOGLE_CREDENTIALS_FILE", "")
        if not credentials_file or not os.path.exists(credentials_file):
            raise ValueError("GOOGLE_CREDENTIALS_FILE not set or missing.")

        flow = Flow.from_client_secrets_file(
            credentials_file,
            scopes=GOOGLE_SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI
        )
        flow.fetch_token(code=auth_code)
        creds = flow.credentials

        # Fetch email
        userinfo_resp = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {creds.token}"}
        )
        userinfo_resp.raise_for_status()
        email = userinfo_resp.json().get("email", "unknown_google_user")

        account_id = str(uuid.uuid4())
        self._store_account(
            account_id=account_id,
            provider="google",
            email=email,
            access_token=creds.token,
            refresh_token=creds.refresh_token,
            expires_in=creds.expiry.timestamp() - time.time() if creds.expiry else 3600
        )
        return account_id

    def get_outlook_auth_url(self) -> str:
        client_id = os.getenv("OUTLOOK_CLIENT_ID")
        tenant = os.getenv("OUTLOOK_TENANT_ID", "common")
        if not client_id:
            raise ValueError("OUTLOOK_CLIENT_ID missing from environment")

        auth_url = (
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?"
            f"client_id={client_id}&response_type=code&redirect_uri={OUTLOOK_REDIRECT_URI}"
            f"&response_mode=query&scope={' '.join(OUTLOOK_SCOPES)}"
        )
        return auth_url

    def add_outlook_account(self, auth_code: str) -> str:
        client_id = os.getenv("OUTLOOK_CLIENT_ID")
        client_secret = os.getenv("OUTLOOK_CLIENT_SECRET")
        tenant = os.getenv("OUTLOOK_TENANT_ID", "common")

        if not client_id or not client_secret:
            raise ValueError("OUTLOOK_CLIENT_ID or OUTLOOK_CLIENT_SECRET missing")

        token_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
        data = {
            "client_id": client_id,
            "scope": " ".join(OUTLOOK_SCOPES),
            "code": auth_code,
            "redirect_uri": OUTLOOK_REDIRECT_URI,
            "grant_type": "authorization_code",
            "client_secret": client_secret,
        }

        resp = requests.post(token_url, data=data)
        resp.raise_for_status()
        tokens = resp.json()

        # Fetch email
        me_resp = requests.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        me_resp.raise_for_status()
        me_data = me_resp.json()
        email = me_data.get("mail") or me_data.get("userPrincipalName") or "unknown_outlook_user"

        account_id = str(uuid.uuid4())
        self._store_account(
            account_id=account_id,
            provider="outlook",
            email=email,
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            expires_in=tokens.get("expires_in", 3600)
        )
        return account_id

    def _store_account(self, account_id: str, provider: str, email: str, access_token: str, refresh_token: str | None, expires_in: float):
        expires_at = int(time.time() + expires_in)
        added_at = int(time.time())
        with self.db.connect() as conn:
            conn.execute(
                """
                INSERT INTO accounts (id, provider, email, access_token, refresh_token, expires_at, added_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (account_id, provider, email, access_token, refresh_token, expires_at, added_at)
            )
            conn.commit()

    def get_all_accounts(self) -> List[Dict[str, Any]]:
        with self.db.connect() as conn:
            rows = conn.execute("SELECT * FROM accounts WHERE is_active = 1").fetchall()
            return [dict(row) for row in rows]

    def remove_account(self, account_id: str):
        with self.db.connect() as conn:
            conn.execute("UPDATE accounts SET is_active = 0 WHERE id = ?", (account_id,))
            conn.commit()

    def refresh_token_if_needed(self, account_id: str) -> str:
        """Returns the valid access token, refreshing if necessary."""
        with self.db.connect() as conn:
            row = conn.execute("SELECT * FROM accounts WHERE id = ? AND is_active = 1", (account_id,)).fetchone()
            if not row:
                raise ValueError(f"Account {account_id} not found or inactive")
            
            account = dict(row)
            now = int(time.time())
            # Add a 5 minute buffer
            if account["expires_at"] > now + 300:
                return account["access_token"]
            
            # Need refresh
            if account["provider"] == "google":
                return self._refresh_google(account)
            elif account["provider"] == "outlook":
                return self._refresh_outlook(account)
            else:
                raise ValueError(f"Unknown provider: {account['provider']}")

    def _refresh_google(self, account: dict) -> str:
        if not account.get("refresh_token"):
            raise ValueError("No refresh token available for Google account")

        credentials_file = os.getenv("GOOGLE_CREDENTIALS_FILE", "")
        # Since we use the raw endpoints, let's just use requests to refresh
        import json
        with open(credentials_file, 'r') as f:
            creds_data = json.load(f).get("installed", {})
        
        client_id = creds_data.get("client_id")
        client_secret = creds_data.get("client_secret")

        resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": account["refresh_token"],
                "grant_type": "refresh_token"
            }
        )
        resp.raise_for_status()
        data = resp.json()

        new_access_token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        expires_at = int(time.time()) + expires_in

        with self.db.connect() as conn:
            conn.execute(
                "UPDATE accounts SET access_token = ?, expires_at = ? WHERE id = ?",
                (new_access_token, expires_at, account["id"])
            )
            conn.commit()
            
        return new_access_token

    def _refresh_outlook(self, account: dict) -> str:
        if not account.get("refresh_token"):
            raise ValueError("No refresh token available for Outlook account")

        client_id = os.getenv("OUTLOOK_CLIENT_ID")
        client_secret = os.getenv("OUTLOOK_CLIENT_SECRET")
        tenant = os.getenv("OUTLOOK_TENANT_ID", "common")

        resp = requests.post(
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": account["refresh_token"],
                "grant_type": "refresh_token"
            }
        )
        resp.raise_for_status()
        data = resp.json()

        new_access_token = data["access_token"]
        new_refresh_token = data.get("refresh_token", account["refresh_token"])
        expires_in = data.get("expires_in", 3600)
        expires_at = int(time.time()) + expires_in

        with self.db.connect() as conn:
            conn.execute(
                "UPDATE accounts SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?",
                (new_access_token, new_refresh_token, expires_at, account["id"])
            )
            conn.commit()

        return new_access_token
