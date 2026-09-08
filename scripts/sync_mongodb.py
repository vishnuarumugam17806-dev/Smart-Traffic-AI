import os
import sys
import logging
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from dotenv import load_dotenv

# Load env variables from backend/.env if present
env_path = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

from app.database.session import SessionLocal
from app.database.mongodb import mongo_manager
from app.models.models import (
    User, Intersection, Camera, Signal, TrafficMeasurement,
    Incident, EmergencyEvent, PlateObservation, Blacklist, RouteAnomaly, Alert, AgentDecision
)
from app.trajectory.graph import trajectory_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VIGITRA_MONGODB_SYNC")

def sync_all_to_mongodb():
    print("=" * 60)
    print("VIGITRA Smart Traffic AI - MongoDB Atlas Cloud Sync Engine")
    print("=" * 60)

    # 1. Check MongoDB Atlas Connection
    ping_res = mongo_manager.ping()
    print(f"MongoDB Status: {ping_res['status']}")
    
    if not ping_res["connected"]:
        print("\n[WARNING] MongoDB Atlas is currently offline or unreachable.")
        print(f"Reason / Error: {ping_res.get('error')}")
        print("\nPlease ensure your MONGODB_URI in backend/.env or Render env vars contains valid MongoDB Atlas credentials and user IP is whitelisted (0.0.0.0/0).")
        return False

    db_sync = SessionLocal()
    mongo_db = mongo_manager.get_sync_db()

    if mongo_db is None:
        print("[ERROR] Could not obtain MongoDB database instance.")
        db_sync.close()
        return False

    try:
        # 2. Sync Intersections Collection
        intersections = db_sync.query(Intersection).all()
        inter_docs = []
        for i in intersections:
            inter_docs.append({
                "_id": i.id,
                "name": i.name,
                "location": i.location,
                "latitude": i.latitude,
                "longitude": i.longitude,
                "current_status": i.current_status.value if hasattr(i.current_status, "value") else str(i.current_status),
                "total_lanes": i.total_lanes,
                "updated_at": datetime.now(timezone.utc)
            })
        if inter_docs:
            mongo_db["intersections"].delete_many({})
            mongo_db["intersections"].insert_many(inter_docs)
            print(f"Synced {len(inter_docs)} Intersections to MongoDB Atlas ('intersections').")

        # 3. Sync Cameras Collection
        cameras = db_sync.query(Camera).all()
        cam_docs = []
        for c in cameras:
            cam_docs.append({
                "_id": c.id,
                "name": c.name,
                "source_url": c.source_url,
                "source_type": c.source_type,
                "intersection_id": c.intersection_id,
                "direction": c.direction,
                "status": c.status.value if hasattr(c.status, "value") else str(c.status),
                "fps": c.fps,
                "updated_at": datetime.now(timezone.utc)
            })
        if cam_docs:
            mongo_db["cameras"].delete_many({})
            mongo_db["cameras"].insert_many(cam_docs)
            print(f"Synced {len(cam_docs)} Cameras to MongoDB Atlas ('cameras').")

        # 4. Sync ANPR Observations Collection
        observations = db_sync.query(PlateObservation).all()
        obs_docs = []
        for o in observations:
            obs_docs.append({
                "_id": o.id,
                "plate_number": o.plate_number,
                "camera_id": o.camera_id,
                "ocr_confidence": o.ocr_confidence,
                "plate_detection_confidence": o.plate_detection_confidence,
                "final_confidence": o.final_confidence,
                "vehicle_type": o.vehicle_type,
                "lane": o.lane,
                "direction": o.direction,
                "global_vehicle_id": o.global_vehicle_id,
                "speed_kmh": o.speed_kmh,
                "timestamp": o.timestamp
            })
        if obs_docs:
            mongo_db["anpr_observations"].delete_many({})
            mongo_db["anpr_observations"].insert_many(obs_docs)
            print(f"Synced {len(obs_docs)} ANPR Plate Observations to MongoDB Atlas ('anpr_observations').")

        # 5. Sync Vehicle Trajectories Collection
        unique_plates = list(set([o.plate_number for o in observations if o.plate_number]))
        traj_docs = []
        for p in unique_plates:
            traj = trajectory_engine.reconstruct_trajectory(db_sync, p)
            if traj:
                traj["_id"] = p
                traj["synced_at"] = datetime.now(timezone.utc)
                traj_docs.append(traj)
        if traj_docs:
            mongo_db["vehicle_trajectories"].delete_many({})
            mongo_db["vehicle_trajectories"].insert_many(traj_docs)
            print(f"Synced {len(traj_docs)} Vehicle Trajectories to MongoDB Atlas ('vehicle_trajectories').")

        # 6. Sync System Telemetry Collection
        measurements = db_sync.query(TrafficMeasurement).all()
        telemetry_docs = []
        for m in measurements:
            telemetry_docs.append({
                "_id": m.id,
                "camera_id": m.camera_id,
                "intersection_id": m.intersection_id,
                "vehicle_count": m.vehicle_count,
                "queue_length": m.queue_length,
                "occupancy_percentage": m.occupancy_percentage,
                "average_speed_kmh": m.average_speed_kmh,
                "congestion_level": m.congestion_level.value if hasattr(m.congestion_level, "value") else str(m.congestion_level),
                "timestamp": m.timestamp
            })
        if telemetry_docs:
            mongo_db["system_telemetry"].delete_many({})
            mongo_db["system_telemetry"].insert_many(telemetry_docs)
            print(f"Synced {len(telemetry_docs)} System Telemetry records to MongoDB Atlas ('system_telemetry').")

        # 7. Sync Alerts Collection
        alerts = db_sync.query(Alert).all()
        alert_docs = []
        for a in alerts:
            alert_docs.append({
                "_id": a.id,
                "type": a.type,
                "severity": a.severity,
                "timestamp": a.timestamp,
                "camera_id": a.camera_id,
                "location": a.location,
                "vehicle_plate": a.vehicle_plate,
                "message": a.message,
                "status": a.status,
                "confidence": a.confidence
            })
        if alert_docs:
            mongo_db["alerts"].delete_many({})
            mongo_db["alerts"].insert_many(alert_docs)
            print(f"Synced {len(alert_docs)} Traffic Alerts to MongoDB Atlas ('alerts').")

        # 8. Sync AI Agent Logs Collection
        agent_decisions = db_sync.query(AgentDecision).all()
        agent_docs = []
        for ad in agent_decisions:
            agent_docs.append({
                "_id": ad.id,
                "intersection_id": ad.intersection_id,
                "timestamp": ad.timestamp,
                "selected_phase": ad.selected_phase,
                "green_duration": ad.green_duration,
                "reward_score": ad.reward_score,
                "reasoning": ad.reasoning
            })
        if agent_docs:
            mongo_db["ai_agent_logs"].delete_many({})
            mongo_db["ai_agent_logs"].insert_many(agent_docs)
            print(f"Synced {len(agent_docs)} AI Agent Decision Logs to MongoDB Atlas ('ai_agent_logs').")

        # 9. Sync Users Collection
        users = db_sync.query(User).all()
        user_docs = []
        for u in users:
            user_docs.append({
                "_id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.value if hasattr(u.role, "value") else str(u.role),
                "is_active": u.is_active,
                "created_at": u.created_at
            })
        if user_docs:
            mongo_db["users"].delete_many({})
            mongo_db["users"].insert_many(user_docs)
            print(f"Synced {len(user_docs)} Users to MongoDB Atlas ('users').")

        print("\n[SUCCESS] Successfully updated all changes and synchronized dataset to MongoDB Atlas Cloud Cluster!")
        return True
    except Exception as e:
        print(f"\n[ERROR] Failed during MongoDB Atlas sync: {e}")
        return False
    finally:
        db_sync.close()

if __name__ == "__main__":
    sync_all_to_mongodb()
