import os
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from engine.urgency_engine import get_nudge_text
from storage.db import DB

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "fake_key"})
@patch("engine.urgency_engine.requests.post")
@patch("engine.urgency_engine.requests.get")
def test_fallback_logic(mock_get, mock_post, tmp_path: Path):
    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()
    
    mock_get.return_value = MagicMock(json=lambda: {"models": [{"name": "phi3"}]})
    mock_get.return_value.raise_for_status = MagicMock()
    
    def post_side_effect(*args, **kwargs):
        url = kwargs.get("url") or (args[0] if args else "")
        if "openrouter" in url:
            raise Exception("OpenRouter down")
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"response": "Ollama text that is definitely long enough"}
        return mock_resp
        
    mock_post.side_effect = post_side_effect
    
    text = get_nudge_text({}, "test", db)
    assert text == "Ollama text that is definitely long enough"
    
    settings = db.get_settings()
    assert settings.get("path_ollama") == 1

@patch("engine.urgency_engine._generate_text_with_openrouter")
@patch("engine.urgency_engine._generate_text_with_ollama")
def test_template_fallback(mock_ollama, mock_openrouter, tmp_path: Path):
    db = DB(db_path=tmp_path / "aria.db")
    db.initialize()
    
    mock_openrouter.side_effect = Exception("OR fail")
    mock_ollama.side_effect = Exception("Ollama fail")
    
    context = {"next_meeting": {"title": "Team Sync"}}
    text = get_nudge_text(context, "meeting", db)
    
    assert text == "Reminder: Team Sync — based on your usual pattern at this time."
    settings = db.get_settings()
    assert settings.get("path_template") == 1
