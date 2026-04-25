import sqlite3
import time
from pathlib import Path

# Fallback path if none provided
DEFAULT_DB_PATH = Path.home() / "AppData" / "Roaming" / "ARIA" / "aria.db"

class FeedbackWeightManager:
    def __init__(self, db_path: Path | str | None = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self.weights = {}
        self.last_computed = 0

    def compute_weights(self) -> dict:
        # reads last 30 days of feedback from SQLite
        # groups by (nudge_type, hour_bucket, day_of_week, workload_state)
        # for each group: score = (accepts - dismisses) / total
        # returns a weights dict keyed by those four dimensions
        
        thirty_days_ago = int(time.time()) - (30 * 24 * 3600)
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT outcome, nudge_type, hour_of_day, day_of_week, workload_state 
                    FROM feedback 
                    WHERE timestamp >= ?
                    """,
                    (thirty_days_ago,)
                )
                rows = cursor.fetchall()
        except sqlite3.OperationalError:
            # Table might not exist yet, return empty weights safely
            rows = []

        stats = {}
        for row in rows:
            key = (row["nudge_type"], row["hour_of_day"], row["day_of_week"], row["workload_state"])
            if key not in stats:
                stats[key] = {"accepts": 0, "dismisses": 0, "total": 0}
            
            stats[key]["total"] += 1
            if row["outcome"] == "accepted":
                stats[key]["accepts"] += 1
            elif row["outcome"] == "dismissed":
                stats[key]["dismisses"] += 1
                
        weights = {}
        for key, data in stats.items():
            if data["total"] > 0:
                score = (data["accepts"] - data["dismisses"]) / data["total"]
                # Convert score from [-1, 1] range to a weight, avoiding 0 multiplier
                # If score=1 (all accepts), weight = 1.0. If score=-1 (all dismisses), weight = ~0.1
                # If score=0 (equal accepts/dismisses, or just neutral), weight = 0.5
                weight = 0.5 + (score * 0.5)
                weights[key] = max(0.1, min(1.0, weight))
                
        self.weights = weights
        self.last_computed = int(time.time())
        return self.weights

    def get_weight(self, nudge_type: str, hour: int, day: int, workload: str) -> float:
        # looks up computed_weights, returns 0.5 as default if no data yet
        now = int(time.time())
        # Recompute weights once per day (cache the result)
        if now - self.last_computed >= 86400:
            self.compute_weights()
            
        key = (nudge_type, hour, day, workload)
        return self.weights.get(key, 0.5)
