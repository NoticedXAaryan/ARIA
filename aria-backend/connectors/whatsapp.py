import logging
import time
import requests

from storage.models import NormalizedEvent

logger = logging.getLogger(__name__)

BRIDGE_URL = "http://localhost:3001"


class WhatsAppConnector:
    """Talks to the local whatsapp-web.js bridge on port 3001."""

    def is_connected(self) -> bool:
        try:
            resp = requests.get(f"{BRIDGE_URL}/health", timeout=3)
            return resp.ok and resp.json().get("status") == "connected"
        except Exception:
            return False

    def get_recent_chats(self) -> list[dict]:
        try:
            resp = requests.get(f"{BRIDGE_URL}/chats", timeout=5)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning("WhatsApp get_recent_chats failed: %s", e)
            return []

    def get_messages(self, chat_id: str) -> list[dict]:
        try:
            resp = requests.get(f"{BRIDGE_URL}/messages/{chat_id}", timeout=5)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning("WhatsApp get_messages failed: %s", e)
            return []

    def send_message(self, chat_id: str, text: str) -> bool:
        try:
            resp = requests.post(
                f"{BRIDGE_URL}/send",
                json={"chat_id": chat_id, "message": text},
                timeout=10,
            )
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.warning("WhatsApp send_message failed: %s", e)
            return False

    def ingest_incoming(self, message: dict) -> NormalizedEvent:
        """Normalise an incoming WhatsApp message into a unified event."""
        return NormalizedEvent(
            external_id=f"whatsapp:{message.get('chat_id')}:{message.get('timestamp')}",
            source="whatsapp",
            type="message",
            title=f"Message from {message.get('from_name', 'Unknown')}",
            start_ts=message.get("timestamp") or int(time.time()),
            end_ts=message.get("timestamp") or int(time.time()),
            metadata_json={
                "from": message.get("from"),
                "from_name": message.get("from_name"),
                "body": (message.get("body") or "")[:500],
                "is_group": message.get("is_group", False),
                "chat_id": message.get("chat_id"),
            },
        )
