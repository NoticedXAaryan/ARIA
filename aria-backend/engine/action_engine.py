import json
import logging
import os
import datetime
from pathlib import Path
from email.message import EmailMessage
import base64

import requests
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

from storage.db import DB
from connectors.account_manager import AccountManager

logger = logging.getLogger(__name__)

class ActionEngine:
    def __init__(self, db: DB):
        self.db = db
        self.account_manager = AccountManager(self.db)

    def _call_llm_json(self, prompt: str) -> dict:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if api_key:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "openrouter/auto",
                    "response_format": {"type": "json_object"},
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=15
            )
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"].strip()
        else:
            ollama_url = os.getenv("ARIA_OLLAMA_URL", "http://127.0.0.1:11434")
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={"model": "llama3.2", "prompt": prompt, "stream": False, "format": "json"},
                timeout=15
            )
            response.raise_for_status()
            text = response.json()["response"].strip()
            
        return json.loads(text)

    def _call_llm_text(self, prompt: str) -> str:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if api_key:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "openrouter/auto",
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=15
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        else:
            ollama_url = os.getenv("ARIA_OLLAMA_URL", "http://127.0.0.1:11434")
            response = requests.post(
                f"{ollama_url}/api/generate",
                json={"model": "llama3.2", "prompt": prompt, "stream": False},
                timeout=15
            )
            response.raise_for_status()
            return response.json()["response"].strip()

    # ─── Compositions ───

    def draft_email_reply(self, context_text: str) -> str:
        prompt = (
            "You are drafting a quick email reply for a proactive AI assistant. "
            "Based on the following context, write a concise, polite, and direct reply body. "
            "Do not include the subject line or To field, just the body text.\n\n"
            f"Context:\n{context_text}"
        )
        return self._call_llm_text(prompt)

    def parse_event(self, text: str) -> dict:
        now = datetime.datetime.now().isoformat()
        prompt = (
            f"Extract meeting details from this text. Current time is {now}. "
            "Return valid JSON matching this schema exactly: {\"title\": \"string\", \"date\": \"YYYY-MM-DD\", "
            "\"time\": \"HH:MM:SS\", \"duration_minutes\": integer, \"attendees\": [\"email_or_name\"]}\n\n"
            f"Text: {text}"
        )
        return self._call_llm_json(prompt)

    def parse_note(self, text: str) -> dict:
        prompt = (
            "Extract the title and main body for a note from this text. "
            "Return valid JSON matching this schema exactly: {\"title\": \"string\", \"body\": \"string\"}\n\n"
            f"Text: {text}"
        )
        return self._call_llm_json(prompt)

    # ─── Actions ───

    def send_email(self, account_id: str, to: str, subject: str, body: str) -> bool:
        access_token = self.account_manager.refresh_token_if_needed(account_id)
        
        # Get provider
        provider = None
        with self.db.connect() as conn:
            row = conn.execute("SELECT provider FROM accounts WHERE id = ?", (account_id,)).fetchone()
            if row:
                provider = row["provider"]
                
        if not provider:
            raise ValueError(f"Account {account_id} not found")

        if provider == "google":
            creds = Credentials(token=access_token)
            service = build("gmail", "v1", credentials=creds)
            message = EmailMessage()
            message.set_content(body)
            message["To"] = to
            message["Subject"] = subject
            
            encoded = base64.urlsafe_b64encode(message.as_bytes()).decode()
            service.users().messages().send(userId="me", body={"raw": encoded}).execute()
            return True
            
        elif provider == "outlook":
            url = "https://graph.microsoft.com/v1.0/me/sendMail"
            headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
            payload = {
                "message": {
                    "subject": subject,
                    "body": {"contentType": "Text", "content": body},
                    "toRecipients": [{"emailAddress": {"address": to}}]
                },
                "saveToSentItems": "true"
            }
            resp = requests.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return True

        return False

    def create_event(self, account_id: str, title: str, start_iso: str, end_iso: str, attendees: list[str]) -> bool:
        access_token = self.account_manager.refresh_token_if_needed(account_id)
        
        provider = None
        with self.db.connect() as conn:
            row = conn.execute("SELECT provider FROM accounts WHERE id = ?", (account_id,)).fetchone()
            if row:
                provider = row["provider"]
                
        if not provider:
            raise ValueError(f"Account {account_id} not found")

        if provider == "google":
            creds = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=creds)
            event_body = {
                "summary": title,
                "start": {"dateTime": start_iso, "timeZone": "UTC"},
                "end": {"dateTime": end_iso, "timeZone": "UTC"},
                "attendees": [{"email": a} for a in attendees if "@" in a]
            }
            service.events().insert(calendarId="primary", body=event_body).execute()
            return True
            
        elif provider == "outlook":
            url = "https://graph.microsoft.com/v1.0/me/events"
            headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
            payload = {
                "subject": title,
                "start": {"dateTime": start_iso, "timeZone": "UTC"},
                "end": {"dateTime": end_iso, "timeZone": "UTC"},
                "attendees": [{"emailAddress": {"address": a}, "type": "required"} for a in attendees if "@" in a]
            }
            resp = requests.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return True
            
        return False

    def add_note(self, content: str) -> bool:
        path_str = os.getenv("ARIA_NOTES_PATH")
        if not path_str:
            settings = self.db.get_settings()
            path_str = settings.get("notes_folder_path")
            
        if not path_str:
            raise ValueError("Notes folder path not configured")
            
        base = Path(path_str)
        if not base.exists():
            base.mkdir(parents=True, exist_ok=True)
            
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        note_file = base / f"{today_str}.md"
        
        with open(note_file, "a", encoding="utf-8") as f:
            f.write(f"\n\n{content}\n")
            
        return True
