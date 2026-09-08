import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from datetime import datetime, timedelta, timezone
from app.database.session import SessionLocal, engine, Base  # type: ignore
from app.core import security  # type: ignore
from app.models.models import (  # type: ignore
    User, RoleEnum, Intersection, Camera, Signal, TrafficMeasurement,
    CongestionLevelEnum, CameraStatusEnum, Incident, IncidentStatusEnum,
    EmergencyEvent, Violation, NumberPlate, AgentDecision, Road,
    PlateObservation, Blacklist, RouteAnomaly, Alert
)

def seed_database():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Users
        if not db.query(User).filter(User.username == "admin").first():
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
            db.add_all([admin_user, operator_user])
            db.commit()
            print("Seeded default users: 'admin' and 'operator'.")

        # 2. Seed Intersections
        if db.query(Intersection).count() == 0:
            i1 = Intersection(name="Central Plaza Junction", location="Downtown 4th Ave & Main St", latitude=12.9716, longitude=77.5946, current_status=CongestionLevelEnum.HIGH, total_lanes=4)
            i2 = Intersection(name="Metro Station Cross", location="Station Ring Road", latitude=12.9780, longitude=77.6010, current_status=CongestionLevelEnum.MODERATE, total_lanes=4)
            i3 = Intersection(name="North Corridor Flyover", location="Expressway Exit 12", latitude=12.9900, longitude=77.6150, current_status=CongestionLevelEnum.LOW, total_lanes=6)
            i4 = Intersection(name="Tech Park Highway", location="Outer Ring Road Sector 5", latitude=12.9350, longitude=77.6950, current_status=CongestionLevelEnum.SEVERE, total_lanes=6)
            db.add_all([i1, i2, i3, i4])
            db.commit()
            print("Seeded 4 default intersections.")

        # 3. Seed Cameras & Signals
        if db.query(Camera).count() == 0:
            sample_videos = [
                ("sample_traffic_urban.mp4", "NORTH"),
                ("sample_traffic_congested.mp4", "SOUTH"),
                ("sample_traffic_emergency.mp4", "EAST"),
                ("sample_traffic_highway.mp4", "WEST")
            ]
            intersections = db.query(Intersection).all()
            camera_id_counter = 1
            for idx, inter in enumerate(intersections):
                # Create 2 directional cameras per intersection
                for cam_sub_idx in range(2):
                    video_file, dir_name = sample_videos[(idx * 2 + cam_sub_idx) % len(sample_videos)]
                    cam = Camera(
                        name=f"CCTV-{camera_id_counter:02d} {dir_name} ({inter.name})",
                        source_url=video_file,
                        source_type="FILE",
                        intersection_id=inter.id,
                        direction=dir_name,
                        status=CameraStatusEnum.LIVE,
                        fps=30.0
                    )
                    db.add(cam)
                    db.commit()

                    m = TrafficMeasurement(
                        camera_id=cam.id,
                        intersection_id=inter.id,
                        vehicle_count=12 + (camera_id_counter * 5) % 25,
                        queue_length=3 + (camera_id_counter * 2) % 12,
                        occupancy_percentage=25.0 + (camera_id_counter * 8.0) % 60,
                        average_speed_kmh=55.0 - (camera_id_counter * 4.0) % 35,
                        congestion_level=inter.current_status,
                        timestamp=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=camera_id_counter * 3)
                    )
                    db.add(m)
                    camera_id_counter += 1

                sig = Signal(
                    intersection_id=inter.id,
                    current_phase="GREEN" if idx % 2 == 0 else "RED",
                    green_duration=45,
                    red_duration=45,
                    yellow_duration=3,
                    is_adaptive=True,
                    emergency_override=False
                )
                db.add(sig)
                db.commit()

            print(f"Seeded {camera_id_counter - 1} camera sources across {len(intersections)} intersections successfully.")

        # 4. Seed Roads (Edges)
        if db.query(Road).count() == 0:
            r1 = Road(name="Central Metro Link", source_camera_id=1, target_camera_id=2, distance_km=1.2, expected_travel_time_sec=120.0, direction="NORTH")
            r2 = Road(name="Metro Flyover Expressway", source_camera_id=2, target_camera_id=3, distance_km=2.1, expected_travel_time_sec=210.0, direction="EAST")
            r3 = Road(name="Plaza Corridor Highway", source_camera_id=3, target_camera_id=1, distance_km=2.8, expected_travel_time_sec=280.0, direction="SOUTH")
            r4 = Road(name="Outer Ring Expressway", source_camera_id=1, target_camera_id=4, distance_km=8.5, expected_travel_time_sec=850.0, direction="SOUTH")
            r5 = Road(name="Tech Ring Corridor", source_camera_id=4, target_camera_id=2, distance_km=9.2, expected_travel_time_sec=920.0, direction="WEST")
            
            db.add_all([r1, r2, r3, r4, r5])
            db.commit()
            print("Seeded camera graph roads.")

        # 5. Seed Blacklist Plates
        if db.query(Blacklist).count() == 0:
            b1 = Blacklist(plate="KA05MN3821", reason="Stolen Vehicle Alert", created_by="operator", notes="Blue Yamaha motorcycle.")
            b2 = Blacklist(plate="TN01AB1234", reason="Unpaid Traffic Fines", created_by="admin", notes="White Swift DZire sedan.")
            db.add_all([b1, b2])
            db.commit()
            print("Seeded blacklisted plates database.")

        # 6. Seed Plate Observations & Trajectories
        if db.query(PlateObservation).count() == 0:
            base_time = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
            
            # Normal Journey: TN01AB1234
            o1 = PlateObservation(plate_number="TN01AB1234", camera_id=1, timestamp=base_time, ocr_confidence=0.96, plate_detection_confidence=0.98, final_confidence=0.95, vehicle_type="car", lane=2, direction="NORTH", global_vehicle_id="VEH-0001", speed_kmh=0.0)
            o2 = PlateObservation(plate_number="TN01AB1234", camera_id=2, timestamp=base_time + timedelta(seconds=145), ocr_confidence=0.94, plate_detection_confidence=0.97, final_confidence=0.93, vehicle_type="car", lane=1, direction="NORTH", global_vehicle_id="VEH-0001", speed_kmh=29.8)
            o3 = PlateObservation(plate_number="TN01AB1234", camera_id=3, timestamp=base_time + timedelta(seconds=380), ocr_confidence=0.95, plate_detection_confidence=0.98, final_confidence=0.94, vehicle_type="car", lane=3, direction="EAST", global_vehicle_id="VEH-0001", speed_kmh=32.2)
            
            # Blacklisted Journey KA05MN3821 - triggers alert!
            o4 = PlateObservation(plate_number="KA05MN3821", camera_id=2, timestamp=base_time + timedelta(minutes=10), ocr_confidence=0.98, plate_detection_confidence=0.99, final_confidence=0.97, vehicle_type="motorcycle", lane=1, direction="NORTH", global_vehicle_id="VEH-0002", speed_kmh=0.0)
            o5 = PlateObservation(plate_number="KA05MN3821", camera_id=3, timestamp=base_time + timedelta(minutes=14), ocr_confidence=0.97, plate_detection_confidence=0.97, final_confidence=0.96, vehicle_type="motorcycle", lane=2, direction="EAST", global_vehicle_id="VEH-0002", speed_kmh=31.5)
            
            # Route Anomaly DL02CP9012 - travel time is 10s between Camera 1 & 2 (1.2 km path) - impossible speed!
            o6 = PlateObservation(plate_number="DL02CP9012", camera_id=1, timestamp=base_time + timedelta(minutes=20), ocr_confidence=0.92, plate_detection_confidence=0.95, final_confidence=0.90, vehicle_type="car", lane=2, direction="NORTH", global_vehicle_id="VEH-0003", speed_kmh=0.0)
            o7 = PlateObservation(plate_number="DL02CP9012", camera_id=2, timestamp=base_time + timedelta(minutes=20, seconds=10), ocr_confidence=0.93, plate_detection_confidence=0.94, final_confidence=0.91, vehicle_type="car", lane=2, direction="NORTH", global_vehicle_id="VEH-0003", speed_kmh=432.0)
            
            db.add_all([o1, o2, o3, o4, o5, o6, o7])
            db.commit()
            print("Seeded license plate observations.")

            # Add incident/violation links and alerts for seed data
            alert_blacklist = Alert(
                type="BLACKLISTED_VEHICLE",
                severity="CRITICAL",
                timestamp=base_time + timedelta(minutes=10),
                camera_id=2,
                location="Metro Station Cross",
                vehicle_plate="KA05MN3821",
                message="Blacklisted vehicle KA05MN3821 detected at CCTV-02-North. Reason: Stolen Vehicle Alert.",
                status="NEW",
                confidence=0.97
            )
            
            anomaly_info = RouteAnomaly(
                plate_number="DL02CP9012",
                reason="Impossible travel time (10 seconds for 1.2km road: speed ~432km/h)",
                confidence=0.95,
                observed_route="CCTV-01-North -> CCTV-02-North",
                expected_route="Normal journey duration: >90s",
                timestamp=base_time + timedelta(minutes=20, seconds=10)
            )
            db.add(anomaly_info)
            db.commit()
            
            alert_anomaly = Alert(
                type="ROUTE_ANOMALY",
                severity="HIGH",
                timestamp=base_time + timedelta(minutes=20, seconds=10),
                camera_id=2,
                location="Metro Station Cross",
                vehicle_plate="DL02CP9012",
                message="Potential Route Anomaly: DL02CP9012 traveled Central Metro Link at impossible speed (432 km/h).",
                status="NEW",
                confidence=0.95
            )
            db.add_all([alert_blacklist, alert_anomaly])
            db.commit()
            print("Seeded starting blacklist and route anomaly alerts.")

        # 7. Seed Active Alerts
        if db.query(Alert).count() == 0:
            alert1 = Alert(
                type="BLACKLISTED_VEHICLE",
                severity="CRITICAL",
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10),
                camera_id=2,
                location="Metro Station Cross",
                vehicle_plate="KA05MN3821",
                message="Watchlist vehicle KA05MN3821 detected at Metro Station Cross.",
                status="NEW",
                confidence=0.97
            )
            alert2 = Alert(
                type="CONGESTION_ALERT",
                severity="HIGH",
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5),
                camera_id=1,
                location="Central Plaza Junction",
                vehicle_plate="TN01AB1234",
                message="High traffic density queue detected at Central Plaza Junction.",
                status="NEW",
                confidence=0.92
            )
            db.add_all([alert1, alert2])
            db.commit()
            print("Seeded active traffic alerts.")

        # 8. Attempt MongoDB Atlas Sync if configured
        try:
            from sync_mongodb import sync_all_to_mongodb
            sync_all_to_mongodb()
        except Exception as mongo_err:
            print(f"Notice: MongoDB Atlas sync step skipped/deferred ({mongo_err})")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Remove old sqlite file if exists to start fresh
    if os.path.exists("vigitra.db"):
        try:
            os.remove("vigitra.db")
        except Exception as e:
            print(f"Notice: Could not remove existing vigitra.db ({e}), proceeding with existing file...")
    seed_database()

