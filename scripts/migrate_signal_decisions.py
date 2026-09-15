import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.database.session import engine
from sqlalchemy import text

cols = [
    "junction_id INTEGER",
    "approach_id VARCHAR(50)",
    "vehicle_count REAL DEFAULT 0.0",
    "queue_length INTEGER DEFAULT 0",
    "traffic_density VARCHAR(50) DEFAULT 'LOW'",
    "waiting_time REAL DEFAULT 0.0",
    "demand_score REAL DEFAULT 0.0",
    "priority_score REAL DEFAULT 0.0",
    "green_duration INTEGER DEFAULT 30",
    "signal_state VARCHAR(50) DEFAULT 'GREEN'",
    "mode VARCHAR(50) DEFAULT 'AUTOMATIC'",
    "decision_reason TEXT"
]

with engine.connect() as conn:
    for c in cols:
        try:
            conn.execute(text(f"ALTER TABLE signal_decisions ADD COLUMN {c};"))
            conn.commit()
            print(f"Added {c}")
        except Exception as e:
            print(f"Notice on {c}: {e}")
print("MIGRATION COMPLETE")
