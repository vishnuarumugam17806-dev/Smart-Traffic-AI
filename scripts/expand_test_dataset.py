import os
import sys
import random
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database.session import SessionLocal, engine, Base
from app.core import security
from app.models.models import (
    User, RoleEnum, Intersection, Camera, Signal, TrafficMeasurement,
    CongestionLevelEnum, CameraStatusEnum, Incident, IncidentStatusEnum,
    EmergencyEvent, Violation, NumberPlate, AgentDecision, Road,
    PlateObservation, Blacklist, RouteAnomaly, Alert
)

def expand_dataset():
    print("=" * 60)
    print("VIGITRA Smart Traffic AI - High-Scale Dataset Seed Generator")
    print("=" * 60)

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

        # 2. Seed 10 Intersections
        intersections_data = [
            ("Anna Salai - Spencers Junction", "Downtown Thousand Lights & Binny Rd", 13.0604, 80.2605, CongestionLevelEnum.HIGH, 4),
            ("Chennai Central - Ripon Cross", "EVR Periyar Salai & Wall Tax Rd", 13.0827, 80.2755, CongestionLevelEnum.MODERATE, 4),
            ("Gemini Flyover Circle", "Anna Salai & Cathedral Road", 13.0531, 80.2514, CongestionLevelEnum.LOW, 6),
            ("T. Nagar - Panagal Park Circle", "G.N. Chetty Rd & Usman Rd", 13.0405, 80.2337, CongestionLevelEnum.SEVERE, 4),
            ("Kathipara Cloverleaf Interchange", "GST Road & Inner Ring Rd, Guindy", 13.0067, 80.2026, CongestionLevelEnum.HIGH, 8),
            ("Tidel Park - OMR IT Expressway", "Rajiv Gandhi Salai, Taramani", 12.9892, 80.2476, CongestionLevelEnum.SEVERE, 6),
            ("Koyambedu CMBT Roundabout", "Poonamallee High Rd & Inner Ring Rd", 13.0694, 80.1948, CongestionLevelEnum.SEVERE, 6),
            ("Marina Beach - Kamarajar Salai", "Light House & Kamarajar Promenade", 13.0382, 80.2785, CongestionLevelEnum.LOW, 4),
            ("Velachery Vijayanagar Junction", "Velachery Bypass & Taramani Link Rd", 12.9757, 80.2212, CongestionLevelEnum.HIGH, 4),
            ("Madhavaram Roundabout Interchange", "GNT Road & 200 Feet Rd", 13.1482, 80.2312, CongestionLevelEnum.MODERATE, 6),
        ]

        intersections = []
        for name, loc, lat, lon, status, lanes in intersections_data:
            inter = db.query(Intersection).filter(Intersection.name == name).first()
            if not inter:
                inter = Intersection(name=name, location=loc, latitude=lat, longitude=lon, current_status=status, total_lanes=lanes)
                db.add(inter)
                db.commit()
                db.refresh(inter)
            intersections.append(inter)
        print(f"[+] Verified {len(intersections)} Intersections.")

        # 3. Seed 20 CCTV Cameras & Signals
        sample_videos = [
            "sample_traffic_urban.mp4",
            "sample_traffic_congested.mp4",
            "sample_traffic_emergency.mp4",
            "sample_traffic_highway.mp4",
            "sample_traffic_rainy.mp4",
            "sample_traffic_junction.mp4"
        ]
        directions = ["NORTH", "SOUTH", "EAST", "WEST"]

        cameras = []
        for idx, inter in enumerate(intersections):
            for d_idx, dir_name in enumerate(["NORTH", "SOUTH"]):
                cam_name = f"CCTV-{idx*2 + d_idx + 1:02d} {dir_name} ({inter.name})"
                cam = db.query(Camera).filter(Camera.name == cam_name).first()
                if not cam:
                    cam = Camera(
                        name=cam_name,
                        source_url=sample_videos[(idx*2 + d_idx) % len(sample_videos)],
                        source_type="FILE",
                        intersection_id=inter.id,
                        direction=dir_name,
                        status=CameraStatusEnum.LIVE,
                        fps=30.0
                    )
                    db.add(cam)
                    db.commit()
                    db.refresh(cam)
                cameras.append(cam)

            # Signal
            if not db.query(Signal).filter(Signal.intersection_id == inter.id).first():
                sig = Signal(
                    intersection_id=inter.id,
                    current_phase="GREEN" if idx % 2 == 0 else "RED",
                    green_duration=45 + (idx * 5) % 35,
                    red_duration=45,
                    yellow_duration=3,
                    is_adaptive=True,
                    emergency_override=False
                )
                db.add(sig)
                db.commit()
        print(f"[+] Verified {len(cameras)} Camera feeds and 10 Signal Controllers.")

        # 4. Seed Roads (Directed Graph Edges)
        if db.query(Road).count() < 10:
            road_edges = [
                (1, 3, "Anna Salai - Central Express Link", 3.2, 240.0, "NORTH"),
                (3, 5, "Central - Gemini Arterial", 3.5, 270.0, "SOUTH"),
                (5, 1, "Cathedral Rd - Spencers Connector", 1.8, 140.0, "NORTH"),
                (1, 7, "Mount Road - Panagal Park Link", 3.0, 220.0, "SOUTH"),
                (7, 9, "Guindy - Kathipara Elevated Flyover", 4.5, 300.0, "SOUTH"),
                (9, 11, "Guindy - Tidel Park Link", 5.2, 380.0, "EAST"),
                (11, 13, "OMR - Velachery Bypass Line", 3.8, 260.0, "WEST"),
                (13, 15, "Velachery - Kathipara Transit", 4.2, 310.0, "NORTH"),
                (15, 17, "Periyar Salai - Madhavaram Arc", 8.8, 620.0, "NORTH"),
                (17, 19, "Panagal Park - Gemini Bypass", 2.2, 170.0, "EAST"),
            ]
            for src, tgt, rname, dist, ttime, rdir in road_edges:
                if src <= len(cameras) and tgt <= len(cameras):
                    r = Road(name=rname, source_camera_id=src, target_camera_id=tgt, distance_km=dist, expected_travel_time_sec=ttime, direction=rdir)
                    db.add(r)
            db.commit()
            print(f"[+] Seeded {db.query(Road).count()} Graph Road Edges.")

        # 5. Seed Blacklist Watchlist
        blacklist_plates = [
            ("KA05MN3821", "Stolen Vehicle Alert", "operator", "Blue Yamaha FZ motorcycle reported stolen."),
            ("TN01AB1234", "Unpaid Traffic Fines", "admin", "White Swift DZire sedan with 14 outstanding red-light violations."),
            ("MH12PQ9999", "Security Watchlist", "admin", "Black SUV flagged for unauthorized perimeter access."),
            ("DL03CC4455", "Hit and Run Suspect", "operator", "Silver sedan involved in Anna Salai hit and run incident.")
        ]
        for plate, reason, cb, notes in blacklist_plates:
            if not db.query(Blacklist).filter(Blacklist.plate == plate).first():
                b = Blacklist(plate=plate, reason=reason, created_by=cb, notes=notes)
                db.add(b)
        db.commit()
        print(f"[+] Verified Blacklist Watchlist ({db.query(Blacklist).count()} items).")

        # 6. Generate 50 Unique Vehicles with 250+ ANPR Observations
        vehicle_types = ["car", "suv", "motorcycle", "bus", "truck"]
        states = ["KA", "TN", "MH", "DL", "KL", "AP", "TS"]
        
        # Pre-defined deterministic journey routes for trajectory tracking tests
        journey_vehicles = [
            ("TN01AB1234", [1, 3, 5, 7, 9], "car"),
            ("KA05MN3821", [3, 5, 11, 13], "motorcycle"),
            ("DL02CP9012", [1, 3], "car"),  # Anomaly vehicle
            ("MH12PQ9999", [2, 4, 6, 8, 10], "suv"),
            ("KL07BF5566", [5, 7, 9, 11, 13, 15], "bus"),
            ("AP09CC1122", [1, 2, 3, 4, 5], "truck"),
            ("TS08EE8899", [6, 8, 10, 12, 14], "car"),
        ]

        base_time = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=4)
        obs_count = 0

        # Seed fixed journeys
        for plate, cam_ids, vtype in journey_vehicles:
            cur_time = base_time + timedelta(minutes=random.randint(0, 30))
            for c_idx, cid in enumerate(cam_ids):
                if cid <= len(cameras):
                    travel_delta = 10 if (plate == "DL02CP9012" and c_idx > 0) else random.randint(110, 250)
                    cur_time += timedelta(seconds=travel_delta)
                    speed = 432.0 if (plate == "DL02CP9012" and c_idx > 0) else round(random.uniform(28.0, 65.0), 1)
                    
                    obs = PlateObservation(
                        plate_number=plate,
                        camera_id=cid,
                        timestamp=cur_time,
                        ocr_confidence=round(random.uniform(0.91, 0.99), 2),
                        plate_detection_confidence=round(random.uniform(0.93, 0.99), 2),
                        final_confidence=round(random.uniform(0.90, 0.98), 2),
                        vehicle_type=vtype,
                        lane=random.randint(1, 3),
                        direction="NORTH" if cid % 2 != 0 else "SOUTH",
                        global_vehicle_id=f"VEH-{hash(plate) % 10000:04d}",
                        speed_kmh=speed
                    )
                    db.add(obs)
                    obs_count += 1
        db.commit()

        # Seed additional random high-density observations to reach 250+
        existing_obs = db.query(PlateObservation).count()
        needed = max(0, 260 - existing_obs)
        for i in range(needed):
            state = random.choice(states)
            district = f"{random.randint(1, 15):02d}"
            letters = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=2))
            digits = f"{random.randint(1000, 9999):04d}"
            plate = f"{state}{district}{letters}{digits}"
            
            cam_id = random.randint(1, len(cameras))
            t_offset = random.randint(0, 240)
            obs_time = base_time + timedelta(minutes=t_offset)
            
            obs = PlateObservation(
                plate_number=plate,
                camera_id=cam_id,
                timestamp=obs_time,
                ocr_confidence=round(random.uniform(0.88, 0.99), 2),
                plate_detection_confidence=round(random.uniform(0.90, 0.99), 2),
                final_confidence=round(random.uniform(0.87, 0.98), 2),
                vehicle_type=random.choice(vehicle_types),
                lane=random.randint(1, 4),
                direction="NORTH" if cam_id % 2 != 0 else "SOUTH",
                global_vehicle_id=f"VEH-{i+100:04d}",
                speed_kmh=round(random.uniform(15.0, 75.0), 1)
            )
            db.add(obs)
            obs_count += 1

        db.commit()
        total_obs = db.query(PlateObservation).count()
        print(f"[+] Total ANPR Observations in Database: {total_obs}")

        # 7. Seed Traffic Telemetry & Measurement History
        telemetry_count = 0
        for inter in intersections:
            for cam in [c for c in cameras if c.intersection_id == inter.id]:
                for h in range(10):
                    t = base_time + timedelta(minutes=h * 20)
                    m = TrafficMeasurement(
                        camera_id=cam.id,
                        intersection_id=inter.id,
                        vehicle_count=random.randint(15, 85),
                        queue_length=random.randint(2, 22),
                        occupancy_percentage=round(random.uniform(20.0, 92.0), 1),
                        average_speed_kmh=round(random.uniform(18.0, 62.0), 1),
                        congestion_level=random.choice(list(CongestionLevelEnum)),
                        timestamp=t
                    )
                    db.add(m)
                    telemetry_count += 1
        db.commit()
        print(f"[+] Total System Telemetry Measurements: {db.query(TrafficMeasurement).count()}")

        # 8. Seed Alerts & Route Anomalies
        if db.query(Alert).count() < 10:
            alerts_data = [
                ("BLACKLISTED_VEHICLE", "CRITICAL", 3, "Chennai Central - Ripon Cross", "KA05MN3821", "Watchlist vehicle KA05MN3821 detected at CCTV-03."),
                ("ROUTE_ANOMALY", "HIGH", 3, "Chennai Central - Ripon Cross", "DL02CP9012", "Impossible transit speed (432 km/h) detected between CCTV-01 and CCTV-03."),
                ("BLACKLISTED_VEHICLE", "CRITICAL", 1, "Anna Salai - Spencers Junction", "TN01AB1234", "Unpaid fines watchlist match TN01AB1234."),
                ("CONGESTION_ALERT", "MEDIUM", 7, "Tidel Park - OMR IT Expressway", None, "Critical queue length (>18 vehicles) on South approach."),
                ("EMERGENCY_CORRIDOR", "HIGH", 5, "Kathipara Cloverleaf Interchange", "KA01AM1080", "Emergency ambulance corridor preempted on East lane."),
                ("INCIDENT_DETECTION", "HIGH", 10, "Madhavaram Roundabout Interchange", None, "Vehicle breakdown stalled on Lane 2.")
            ]
            for atype, sev, cid, loc, vplate, msg in alerts_data:
                a = Alert(
                    type=atype,
                    severity=sev,
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=random.randint(5, 120)),
                    camera_id=cid,
                    location=loc,
                    vehicle_plate=vplate,
                    message=msg,
                    status="NEW",
                    confidence=round(random.uniform(0.92, 0.98), 2)
                )
                db.add(a)
            db.commit()
            print(f"[+] Total Active System Alerts: {db.query(Alert).count()}")

        # 9. Sync MongoDB if available
        try:
            from sync_mongodb import sync_all_to_mongodb
            sync_all_to_mongodb()
        except Exception as err:
            print(f"[Notice] MongoDB Atlas sync deferred ({err})")

        print("=" * 60)
        print("[SUCCESS] High-scale dataset seeded successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"[ERROR] Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    expand_dataset()
