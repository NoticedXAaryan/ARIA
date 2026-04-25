import os
import time
import logging
from datetime import datetime
from collections import defaultdict
import sqlite3

logger = logging.getLogger(__name__)

# Check for PyTorch availability
try:
    import torch
    import torch.nn.functional as F
    from torch_geometric.nn import GCNConv
    from torch_geometric.data import Data
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def check_data_sufficiency(db) -> dict:
    """
    Check if enough data exists for GNN:
    - At least 7 distinct days of ActivityWatch data
    - At least 50 events in episodic memory (which we approximate by total events in DB)
    """
    try:
        with db.connect() as conn:
            # Check distinct days from activitywatch
            days_count = conn.execute(
                "SELECT COUNT(DISTINCT date(start_ts, 'unixepoch')) FROM events WHERE source = 'activitywatch'"
            ).fetchone()[0]

            # Check total events
            events_count = conn.execute(
                "SELECT COUNT(*) FROM events"
            ).fetchone()[0]

            sufficient = days_count >= 7 and events_count >= 50
            return {
                "sufficient": sufficient,
                "days": days_count,
                "events": events_count
            }
    except Exception as e:
        logger.warning("Data sufficiency check failed: %s", e)
        return {"sufficient": False, "days": 0, "events": 0}


if TORCH_AVAILABLE:
    class RhythmGNN(torch.nn.Module):
        def __init__(self, num_node_features, num_classes):
            super().__init__()
            self.conv1 = GCNConv(num_node_features, 16)
            self.conv2 = GCNConv(16, num_classes)

        def forward(self, data):
            x, edge_index = data.x, data.edge_index
            x = self.conv1(x, edge_index)
            x = F.relu(x)
            x = F.dropout(x, training=self.training)
            x = self.conv2(x, edge_index)
            return F.log_softmax(x, dim=1)


class GNNRhythmModel:
    def __init__(self, db, model_path="engine/rhythm_model.pt"):
        self.db = db
        self.model_path = model_path
        self.model = None
        self.activity_types = ["focus", "meeting", "admin", "break", "offline"]
        self.type_to_idx = {t: i for i, t in enumerate(self.activity_types)}
        self.idx_to_type = {i: t for i, t in enumerate(self.activity_types)}
        
        self.buckets = [6, 9, 11, 13, 15, 17, 19, 22]
        if TORCH_AVAILABLE and os.path.exists(self.model_path):
            try:
                self.model = RhythmGNN(3, len(self.activity_types))
                self.model.load_state_dict(torch.load(self.model_path))
                self.model.eval()
            except Exception as e:
                logger.error("Failed to load GNN model: %s", e)

    def _to_bucket(self, hour: int) -> int:
        for i in range(len(self.buckets) - 1, -1, -1):
            if hour >= self.buckets[i]:
                return i
        return 0

    def _get_week_pattern(self, weekday: int) -> int:
        # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
        if weekday == 0:
            return 0  # Early week
        elif 1 <= weekday <= 3:
            return 1  # Mid week
        else:
            return 2  # End week

    def build_graph_data(self) -> tuple:
        """
        Build PyTorch Geometric Data object from the last 30 days of data.
        """
        if not TORCH_AVAILABLE:
            return None

        now_ts = int(time.time())
        lookback = 30 * 86400
        with self.db.connect() as conn:
            rows = conn.execute(
                "SELECT start_ts, source, type FROM events WHERE start_ts >= ? ORDER BY start_ts",
                (now_ts - lookback,)
            ).fetchall()

        # Gather features
        # Hour nodes: 8
        # Weekday nodes: 7
        # Week-pattern nodes: 3
        # Total nodes: 18
        # Node mapping:
        # 0-7: Hour nodes
        # 8-14: Weekday nodes
        # 15-17: Week-pattern nodes

        hour_features = defaultdict(lambda: {"activity": 0, "meeting": 0, "focus": 0, "total": 0})
        day_features = defaultdict(lambda: {"events": 0, "meeting": 0, "focus": 0, "total_days": 0})
        week_features = defaultdict(lambda: {"deadline": 0, "workload": 0})

        edges = []
        labels = []

        seen_days = set()

        for row in rows:
            ts = row["start_ts"]
            dt = datetime.fromtimestamp(ts)
            hour_idx = self._to_bucket(dt.hour)
            dow = dt.weekday()
            week_idx = self._get_week_pattern(dow)
            
            seen_days.add(dt.strftime("%Y-%m-%d"))
            
            day_features[dow]["events"] += 1
            if row["type"] == "meeting":
                hour_features[hour_idx]["meeting"] += 1
                day_features[dow]["meeting"] += 1
            elif row["type"] in ["focus", "deep_focus"]:
                hour_features[hour_idx]["focus"] += 1
                day_features[dow]["focus"] += 1
            elif row["type"] == "deadline":
                week_features[week_idx]["deadline"] += 1
                
            hour_features[hour_idx]["activity"] += 1
            hour_features[hour_idx]["total"] += 1

            # Connect hour -> weekday
            edges.append([hour_idx, 8 + dow])
            # Connect weekday -> week_pattern
            edges.append([8 + dow, 15 + week_idx])

            # Label for the hour node: what was the dominant activity?
            # We'll just append it to a list and process later to assign labels to hour nodes.
            # Simplified: target is the next activity type. We'll assign labels to hour nodes based on majority.
        
        # Build node features tensor X
        x = torch.zeros((18, 3), dtype=torch.float)
        
        # Normalize features
        for i in range(8):
            tot = hour_features[i]["total"] or 1
            x[i, 0] = hour_features[i]["activity"] / tot
            x[i, 1] = hour_features[i]["meeting"] / tot
            x[i, 2] = hour_features[i]["focus"] / tot
            
        num_days = len(seen_days) or 1
        for i in range(7):
            x[8 + i, 0] = day_features[i]["events"] / num_days
            x[8 + i, 1] = day_features[i]["meeting"] / num_days
            x[8 + i, 2] = day_features[i]["focus"] / num_days
            
        for i in range(3):
            x[15 + i, 0] = week_features[i]["deadline"] / num_days
            x[15 + i, 1] = week_features[i]["workload"] / num_days  # Dummy workload

        # Build edge index tensor
        if not edges:
            edge_index = torch.empty((2, 0), dtype=torch.long)
        else:
            edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()

        # Build labels tensor y (only for hour nodes)
        y = torch.zeros(18, dtype=torch.long)
        for i in range(8):
            f = hour_features[i]
            if f["focus"] >= f["meeting"] and f["focus"] > 0:
                y[i] = self.type_to_idx["focus"]
            elif f["meeting"] > f["focus"]:
                y[i] = self.type_to_idx["meeting"]
            elif f["activity"] > 0:
                y[i] = self.type_to_idx["admin"]
            else:
                y[i] = self.type_to_idx["offline"]

        data = Data(x=x, edge_index=edge_index, y=y)
        # Create a mask for training (we only train to predict hour nodes)
        train_mask = torch.zeros(18, dtype=torch.bool)
        train_mask[:8] = True
        data.train_mask = train_mask
        
        return data

    def train_gnn_model(self):
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch not available, skipping GNN training.")
            return

        data = self.build_graph_data()
        if data is None or data.edge_index.numel() == 0:
            logger.warning("No data to train GNN.")
            return

        self.model = RhythmGNN(3, len(self.activity_types))
        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.01, weight_decay=5e-4)

        self.model.train()
        for epoch in range(50):
            optimizer.zero_grad()
            out = self.model(data)
            loss = F.nll_loss(out[data.train_mask], data.y[data.train_mask])
            loss.backward()
            optimizer.step()

        torch.save(self.model.state_dict(), self.model_path)
        logger.info("GNN training complete. Saved to %s", self.model_path)
        self.model.eval()

    def get_predicted_activity(self, current_hour: int, current_day: int) -> tuple[str, float]:
        if not TORCH_AVAILABLE or self.model is None:
            return "focus", 0.25

        data = self.build_graph_data()
        if data is None:
            return "focus", 0.25

        self.model.eval()
        with torch.no_grad():
            out = self.model(data)
            probs = torch.exp(out)
            
            hour_idx = self._to_bucket(current_hour)
            node_probs = probs[hour_idx]
            max_prob, max_idx = node_probs.max(dim=0)
            
            activity = self.idx_to_type[max_idx.item()]
            return activity, max_prob.item()

