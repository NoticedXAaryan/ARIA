from __future__ import annotations

import logging
import os

import uvicorn
from dotenv import load_dotenv

from api_main import app, db, scheduler


def main() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
    db.initialize()
    scheduler.start()
    scheduler.run_cycle()
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.getenv("ARIA_API_PORT", "8742")),
        log_level="info",
    )


if __name__ == "__main__":
    main()
