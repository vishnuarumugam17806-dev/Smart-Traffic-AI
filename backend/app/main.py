import asyncio
import cv2
import numpy as np
import logging
import os
from typing import cast
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import engine, Base, SessionLocal
from app.api.v1.auth import router as auth_router
from app.api.v1.traffic import router as traffic_router
from app.websocket.manager import ws_manager
from app.cv.detector import TrafficVisionProcessor
from app.cv.stream_manager import stream_manager
from app.models.models import (
    Camera, TrafficMeasurement, CongestionLevelEnum, EmergencyEvent, Incident,
    PlateObservation, Blacklist, Alert, SignalDecision, CameraStatusEnum
)
from app.trajectory.graph import trajectory_engine
from app.traffic.signal_controller import signal_optimizer, signal_registry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VIGITRA")

from sqlalchemy import text

# Create database tables automatically on startup
Base.metadata.create_all(bind=engine)

# Migration helper for newly added columns on SQLite
try:
    with engine.connect() as conn:
        for col_def in [
            "ALTER TABLE intersections ADD COLUMN num_approaches INTEGER DEFAULT 4;",
            "ALTER TABLE intersections ADD COLUMN approaches_config JSON;",
            "ALTER TABLE users ADD COLUMN area_jurisdiction VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN police_id VARCHAR(50);",
            "ALTER TABLE users ADD COLUMN mobile_number VARCHAR(20);",
            "ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT 1;"
        ]:
            try:
                conn.execute(text(col_def))
                conn.commit()
            except Exception:
                pass
except Exception as e:
    logger.warning(f"Column migration check notice: {e}")


cv_processor = TrafficVisionProcessor()

async def background_video_processing_loop():
    """
    Background worker loop executing the end-to-end VIGITRA AI Pipeline:
    Camera Ingestion -> Stream Manager Health Check -> YOLOv8 Detection -> ANPR OCR ->
    Cross-Camera Trajectory Correlation -> Traffic Density & Queue Calculation ->
    Adaptive Signal Optimization -> WebSocket Broadcasting.
    """
    logger.info("VIGITRA Real-Time Camera & Traffic AI Processing Pipeline Initialized.")

    while True:
        try:
            await asyncio.sleep(1.5)  # 1.5s interval per processing tick
            db: Session = SessionLocal()
            try:
                cameras = db.query(Camera).filter(Camera.status != "OFFLINE").all()
                if not cameras:
                    # If no cameras found, pull all cameras
                    cameras = db.query(Camera).all()
                    if not cameras:
                        continue

                for cam in cameras:
                    # Ingest frame via CameraStreamManager
                    frame, stream_meta = stream_manager.get_frame(cast(int, cam.id), cast(str, cam.source_url), cast(str, cam.source_type))

                    # Handle camera offline alert if stream drops
                    if stream_meta["status"] == "OFFLINE" and cam.status != CameraStatusEnum.OFFLINE:
                        cam.status = CameraStatusEnum.OFFLINE
                        db.commit()

                        alert = Alert(
                            type="CAMERA_OFFLINE",
                            severity="CRITICAL",
                            camera_id=cam.id,
                            location=cam.intersection.name if cam.intersection else cam.name,
                            message=f"CRITICAL STREAM FAILURE: Camera {cam.name} went OFFLINE. Stream source {cam.source_url} unreachable.",
                            status="NEW",
                            confidence=1.0
                        )
                        db.add(alert)
                        db.commit()

                        await ws_manager.broadcast({
                            "event": "CAMERA_STATUS_CHANGED",
                            "camera_id": cam.id,
                            "status": "OFFLINE",
                            "fps": 0.0
                        })
                        await ws_manager.broadcast({
                            "event": "ALERT_CREATED",
                            "alert": {
                                "id": alert.id,
                                "type": alert.type,
                                "severity": alert.severity,
                                "location": alert.location,
                                "message": alert.message,
                                "timestamp": alert.timestamp.isoformat()
                            }
                        })
                        continue

                    # Fallback to simulated high-quality frame if stream unavailable
                    if frame is None:
                        frame = np.zeros((480, 640, 3), dtype=np.uint8)
                        frame[:] = (40, 40, 40)
                        cv2.line(frame, (213, 0), (213, 480), (255, 255, 255), 2)
                        cv2.line(frame, (426, 0), (426, 480), (255, 255, 255), 2)
                        cv2.rectangle(frame, (110, 180), (170, 260), (220, 100, 50), -1)
                        cv2.putText(frame, "CAR", (115, 215), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
                        cv2.rectangle(frame, (115, 235), (165, 255), (255, 255, 255), -1)
                        cv2.putText(frame, "TN01AB1234", (116, 248), cv2.FONT_HERSHEY_SIMPLEX, 0.28, (0, 0, 0), 1)

                    # Process frame through CV + Tracker + ANPR Pipeline
                    res = cv_processor.process_frame(frame)
                    density_enum = CongestionLevelEnum[res["density_state"]]

                    # 1. Log Traffic Measurement to DB
                    measurement = TrafficMeasurement(
                        camera_id=cam.id,
                        intersection_id=cam.intersection_id,
                        vehicle_count=res["total_vehicles"],
                        queue_length=res["queue_length"],
                        occupancy_percentage=res["occupancy_percentage"],
                        average_speed_kmh=42.5,
                        congestion_level=density_enum
                    )
                    db.add(measurement)
                    db.commit()
                    db.refresh(measurement)

                    # Update camera live metrics
                    cam.fps = stream_meta["fps"]
                    cam.status = CameraStatusEnum(stream_meta["status"]) if stream_meta["status"] in [e.value for e in CameraStatusEnum] else CameraStatusEnum.SIMULATION
                    db.commit()

                    # Broadcast Incidents
                    for inc in res.get("incidents", []):
                        await ws_manager.broadcast({
                            "event": "INCIDENT_CREATED",
                            "camera_id": cam.id,
                            "intersection_id": cam.intersection_id,
                            "incident_type": inc["incident_type"],
                            "severity": inc["severity"],
                            "description": inc["description"],
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })

                    # Broadcast Emergency Vehicle Detections
                    for em in res.get("emergency_detected", []):
                        await ws_manager.broadcast({
                            "event": "EMERGENCY_DETECTED",
                            "camera_id": cam.id,
                            "intersection_id": cam.intersection_id,
                            "vehicle_type": em["vehicle_type"],
                            "confidence": em["confidence"],
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })

                    # 2. ANPR & Cross-Camera Correlation Loop
                    for obj in res["tracked_objects"]:
                        plate_info = obj.get("plate_info")
                        if plate_info:
                            plate_num = plate_info["plate_number"].replace(" ", "").upper()

                            correlate_res = trajectory_engine.correlate_vehicle(
                                db, plate_num, obj["label"], cast(int, cam.id), datetime.now(timezone.utc).replace(tzinfo=None)
                            )
                            global_id = correlate_res["global_vehicle_id"]
                            speed_kmh = correlate_res["speed_kmh"]
                            anomaly = correlate_res["anomaly"]

                            obs = PlateObservation(
                                plate_number=plate_num,
                                camera_id=cam.id,
                                ocr_confidence=plate_info["ocr_confidence"],
                                plate_detection_confidence=plate_info["plate_detection_confidence"],
                                image_quality_score=plate_info["image_quality_score"],
                                temporal_consistency=plate_info["temporal_consistency"],
                                final_confidence=plate_info["final_confidence"],
                                vehicle_type=obj["label"],
                                lane=obj.get("lane", 1),
                                direction=obj.get("direction", cam.direction),
                                global_vehicle_id=global_id,
                                speed_kmh=speed_kmh
                            )
                            db.add(obs)
                            db.commit()

                            # Watchlist / Blacklist Check
                            blacklisted = db.query(Blacklist).filter(
                                Blacklist.plate == plate_num,
                                Blacklist.status == "ACTIVE"
                            ).first()

                            if blacklisted:
                                alert = Alert(
                                    type="BLACKLISTED_VEHICLE",
                                    severity="CRITICAL",
                                    camera_id=cam.id,
                                    location=cam.intersection.name if cam.intersection else cam.name,
                                    vehicle_plate=plate_num,
                                    message=f"CRITICAL WATCHLIST: Blacklisted vehicle {plate_num} ({global_id}) detected at {cam.name}. Reason: {blacklisted.reason}.",
                                    status="NEW",
                                    confidence=plate_info["final_confidence"]
                                )
                                db.add(alert)
                                db.commit()

                                await ws_manager.broadcast({
                                    "event": "ALERT_CREATED",
                                    "alert": {
                                        "id": alert.id,
                                        "type": alert.type,
                                        "severity": alert.severity,
                                        "location": alert.location,
                                        "vehicle_plate": alert.vehicle_plate,
                                        "message": alert.message,
                                        "timestamp": alert.timestamp.isoformat()
                                    }
                                })

                            # Broadcast Plate Sighting
                            await ws_manager.broadcast({
                                "event": "PLATE_DETECTED",
                                "camera_id": cam.id,
                                "global_vehicle_id": global_id,
                                "plate_number": plate_num,
                                "confidence": plate_info["final_confidence"],
                                "vehicle_type": obj["label"],
                                "timestamp": obs.timestamp.isoformat()
                            })

                            # Trajectory Update Broadcast
                            traj = trajectory_engine.reconstruct_trajectory(db, plate_num)
                            if traj:
                                await ws_manager.broadcast({
                                    "event": "TRAJECTORY_UPDATED",
                                    "plate_number": plate_num,
                                    "global_vehicle_id": global_id,
                                    "trajectory": traj
                                })

                    # 3. Dynamic Signal Controller Optimization Tick
                    if cam.intersection_id:
                        controller = signal_registry.get_controller(cast(int, cam.intersection_id), db=db)

                        has_emergency = len(res["emergency_detected"]) > 0
                        if has_emergency:
                            em_type = res["emergency_detected"][0]["vehicle_type"]
                            dir_key = cam.direction.upper() if cam.direction else "NORTH"
                            if dir_key in controller.approaches:
                                controller.approaches[dir_key]["emergency_detected"] = True
                                controller.approaches[dir_key]["emergency_type"] = em_type

                        controller.tick(db, dt=1.5)

                        dir_key = cam.direction.upper() if cam.direction else "NORTH"
                        if dir_key in controller.approaches:
                            controller.approaches[dir_key]["vehicle_count"] = res["total_vehicles"]
                            controller.approaches[dir_key]["queue_length"] = res["queue_length"]

                        await ws_manager.broadcast({
                            "event": "SIGNAL_STATE_CHANGED",
                            "intersection_id": cam.intersection_id,
                            "num_approaches": controller.num_approaches,
                            "active_approach": controller.active_approach,
                            "active_phase": controller.active_phase,
                            "state": controller.state,
                            "countdown": controller.countdown,
                            "mode": controller.mode,
                            "reasoning": controller.last_reasoning,
                            "approaches": {
                                name: {
                                    "name": app.get("name") or f"{name.title()} Approach",
                                    "direction": app["direction"],
                                    "vehicle_count": round(app["vehicle_count"], 1),
                                    "queue_length": app["queue_length"],
                                    "waiting_time": round(app["waiting_time"], 1),
                                    "signal": controller.get_approach_signal(name)
                                } for name, app in controller.approaches.items()
                            }
                        })

                    # 4. Broadcast Real-Time Traffic Update over WebSocket
                    await ws_manager.broadcast({
                        "event": "TRAFFIC_UPDATE",
                        "camera_id": cam.id,
                        "intersection_id": cam.intersection_id,
                        "vehicle_count": res["total_vehicles"],
                        "queue_length": res["queue_length"],
                        "occupancy_percentage": res["occupancy_percentage"],
                        "density_state": res["density_state"],
                        "vehicle_counts": res["vehicle_counts"],
                        "emergency_detected": len(res["emergency_detected"]) > 0,
                        "timestamp": measurement.timestamp.isoformat(),
                        "fps": stream_meta["fps"],
                        "latency_ms": stream_meta["latency_ms"],
                        "camera_health": stream_meta["status"]
                    })

                db.commit()
            except Exception as e:
                logger.error(f"Error in background video processing loop: {e}")
                db.rollback()
            finally:
                db.close()
        except Exception as outer_e:
            logger.error(f"Outer loop error: {outer_e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting VIGITRA AI Platform Engine...")
    # Seed default admin and operator users if missing
    try:
        from app.core import security
        from app.models.models import User, RoleEnum, Intersection, Signal
        db_seed: Session = SessionLocal()
        try:
            if not db_seed.query(User).filter(User.username == "admin").first():
                admin_user = User(
                    username="admin",
                    email="admin@vigitra.ai",
                    hashed_password=security.get_password_hash("admin123"),
                    full_name="System Administrator",
                    role=RoleEnum.ADMIN,
                    is_active=True
                )
                operator_user = User(
                    username="operator",
                    email="operator@vigitra.ai",
                    hashed_password=security.get_password_hash("operator123"),
                    full_name="Traffic Operator",
                    role=RoleEnum.OPERATOR,
                    is_active=True
                )
                db_seed.add_all([admin_user, operator_user])
                db_seed.commit()
                logger.info("Seeded default users: 'admin' and 'operator'.")

            # Seed Default Test Junctions (4-side, 3-side, 2-side)
            if db_seed.query(Intersection).count() == 0:
                j1 = Intersection(
                    id=1,
                    name="Central Plaza Junction (4-Side)",
                    location="MG Road & Park Street Cross",
                    latitude=12.9716,
                    longitude=77.5946,
                    total_lanes=4,
                    num_approaches=4,
                    approaches_config=[
                        {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                        {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                        {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                        {"id": "WEST", "name": "West Approach", "direction": "WEST"}
                    ]
                )
                j2 = Intersection(
                    id=2,
                    name="Expressway Merge T-Junction (3-Side)",
                    location="Outer Ring Road Interchange",
                    latitude=12.9780,
                    longitude=77.6010,
                    total_lanes=3,
                    num_approaches=3,
                    approaches_config=[
                        {"id": "NORTH", "name": "North Main Approach", "direction": "NORTH"},
                        {"id": "EAST", "name": "East Ramp Approach", "direction": "EAST"},
                        {"id": "WEST", "name": "West Express Approach", "direction": "WEST"}
                    ]
                )
                j3 = Intersection(
                    id=3,
                    name="River Bridge Access Junction (2-Side)",
                    location="North Corridor Bridge Toll Gate",
                    latitude=12.9850,
                    longitude=77.6100,
                    total_lanes=2,
                    num_approaches=2,
                    approaches_config=[
                        {"id": "NORTH", "name": "Northbound Bridge Approach", "direction": "NORTH"},
                        {"id": "SOUTH", "name": "Southbound Bridge Approach", "direction": "SOUTH"}
                    ]
                )
                db_seed.add_all([j1, j2, j3])
                db_seed.commit()

                s1 = Signal(intersection_id=1, current_phase="NORTH", green_duration=35, red_duration=35)
                s2 = Signal(intersection_id=2, current_phase="NORTH", green_duration=30, red_duration=30)
                s3 = Signal(intersection_id=3, current_phase="NORTH", green_duration=25, red_duration=25)
                db_seed.add_all([s1, s2, s3])
                db_seed.commit()
                logger.info("Seeded default 4-Side, 3-Side, and 2-Side test junctions.")
        finally:
            db_seed.close()
    except Exception as seed_err:
        logger.error(f"Error seeding default users: {seed_err}")

    bg_task = asyncio.create_task(background_video_processing_loop())
    yield
    bg_task.cancel()
    stream_manager.release_all()
    logger.info("VIGITRA AI Platform shut down successfully.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(traffic_router, prefix=settings.API_V1_STR, tags=["Traffic & AI"])

@app.get("/")
def root():
    return {
        "message": "Welcome to VIGITRA AI Platform API Service",
        "docs": "/docs",
        "version": "2.0.0",
        "system_status": "ONLINE"
    }

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "system_status": "ONLINE",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.websocket("/ws/traffic")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"event": "PONG", "received": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
