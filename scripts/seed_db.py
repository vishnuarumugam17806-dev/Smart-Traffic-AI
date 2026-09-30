import os
import sys
import random
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database.session import SessionLocal, engine, Base  # type: ignore
from app.core import security  # type: ignore
from app.models.models import (  # type: ignore
    User, RoleEnum, Intersection, Camera, Signal, TrafficMeasurement,
    CongestionLevelEnum, CameraStatusEnum, Incident, IncidentStatusEnum,
    EmergencyEvent, Violation, NumberPlate, AgentDecision, Road,
    PlateObservation, Blacklist, RouteAnomaly, Alert, VideoRecording
)

def seed_database():
    print("=" * 65)
    print("  VIGITRA Smart Traffic AI - Comprehensive Seed Initializer")
    print("=" * 65)
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
            print("[+] Seeded default users: 'admin' and 'operator'.")

        # Clean up legacy Bangalore coordinates if present
        legacy_bangalore = db.query(Intersection).filter(Intersection.longitude < 80.0).first()
        if legacy_bangalore or "--reset" in sys.argv:
            print("[*] Detected legacy Bangalore coordinates. Resetting GIS tables for Chennai City...")
            db.query(RouteAnomaly).delete()
            db.query(Alert).delete()
            db.query(VideoRecording).delete()
            db.query(PlateObservation).delete()
            db.query(Road).delete()
            db.query(Signal).delete()
            db.query(TrafficMeasurement).delete()
            db.query(Camera).delete()
            db.query(Intersection).delete()
            db.commit()
            print("[+] Cleaned legacy tables for Chennai City seeding.")

        # 2. Seed 10 Realistic Chennai Intersections
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
        print(f"[+] Verified {len(intersections)} Intersections across Chennai.")

        # 3. Seed 12 Realistic Example CCTV Cameras & Adaptive Signals
        example_cams = [
            ("CCTV-01 North (Anna Salai - Spencers Junction)", "sample_traffic_urban.mp4", "FILE", 1, "NORTH"),
            ("CCTV-02 South (Anna Salai - Spencers Junction)", "sample_traffic_congested.mp4", "FILE", 1, "SOUTH"),
            ("CCTV-03 East (Chennai Central - Ripon Cross)", "sample_traffic_emergency.mp4", "FILE", 2, "EAST"),
            ("CCTV-04 West (Chennai Central - Ripon Cross)", "sample_traffic_highway.mp4", "FILE", 2, "WEST"),
            ("CCTV-05 North (Gemini Flyover Circle)", "sample_traffic_rainy.mp4", "FILE", 3, "NORTH"),
            ("CCTV-06 South (Gemini Flyover Circle)", "sample_traffic_junction.mp4", "FILE", 3, "SOUTH"),
            ("CCTV-07 East (T. Nagar - Panagal Park)", "sample_traffic_highway.mp4", "FILE", 4, "EAST"),
            ("CCTV-08 West (T. Nagar - Panagal Park)", "sample_traffic_urban.mp4", "FILE", 4, "WEST"),
            ("CCTV-09 North (Kathipara Cloverleaf Interchange)", "sample_traffic_emergency.mp4", "FILE", 5, "NORTH"),
            ("CCTV-10 South (Tidel Park - OMR IT Expressway)", "sample_traffic_congested.mp4", "FILE", 6, "SOUTH"),
            ("CCTV-11 East (Velachery Vijayanagar Junction)", "sample_traffic_highway.mp4", "FILE", 9, "EAST"),
            ("CCTV-12 West (Madhavaram Roundabout Interchange)", "sample_traffic_junction.mp4", "FILE", 10, "WEST"),
        ]

        cameras = []
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        for idx, (cam_name, video_file, source_t, inter_id, dir_name) in enumerate(example_cams):
            cam = db.query(Camera).filter(Camera.name == cam_name).first()
            if not cam:
                cam = Camera(
                    name=cam_name,
                    source_url=video_file,
                    source_type=source_t,
                    intersection_id=inter_id,
                    direction=dir_name,
                    status=CameraStatusEnum.LIVE,
                    fps=30.0
                )
                db.add(cam)
                db.commit()
                db.refresh(cam)
            else:
                cam.status = CameraStatusEnum.LIVE
                cam.source_url = video_file
                cam.source_type = source_t
                db.commit()
            cameras.append(cam)

            # Add initial telemetry measurement
            if not db.query(TrafficMeasurement).filter(TrafficMeasurement.camera_id == cam.id).first():
                m = TrafficMeasurement(
                    camera_id=cam.id,
                    intersection_id=inter_id,
                    vehicle_count=16 + (idx * 3) % 25,
                    queue_length=2 + (idx * 2) % 10,
                    occupancy_percentage=28.0 + (idx * 5.0) % 55,
                    average_speed_kmh=52.0 - (idx * 3.0) % 25,
                    congestion_level=intersections[inter_id - 1].current_status if inter_id <= len(intersections) else CongestionLevelEnum.MODERATE,
                    timestamp=now_utc - timedelta(minutes=idx * 5)
                )
                db.add(m)

            # Signal Controller
            if not db.query(Signal).filter(Signal.intersection_id == inter_id).first():
                sig = Signal(
                    intersection_id=inter_id,
                    current_phase="GREEN" if idx % 2 == 0 else "RED",
                    green_duration=45 + (idx * 5) % 25,
                    red_duration=45,
                    yellow_duration=3,
                    is_adaptive=True,
                    emergency_override=False
                )
                db.add(sig)

        db.commit()
        print(f"[+] Verified {len(cameras)} Live CCTV Cameras and Adaptive Signal Controllers.")

        # 4. Seed Roads (Directed Graph Edges)
        if db.query(Road).count() < 10:
            road_edges = [
                (1, 3, "Anna Salai - Central Express Link", 3.2, 240.0, "NORTH"),
                (3, 5, "Central - Gemini Arterial", 3.5, 270.0, "SOUTH"),
                (5, 1, "Cathedral Rd - Spencers Connector", 1.8, 140.0, "NORTH"),
                (1, 7, "Mount Road - Panagal Park Link", 3.0, 220.0, "SOUTH"),
                (7, 9, "Guindy - Kathipara Elevated Flyover", 4.5, 300.0, "SOUTH"),
                (9, 10, "Guindy - Tidel Park Link", 5.2, 380.0, "EAST"),
                (10, 11, "OMR - Velachery Bypass Line", 3.8, 260.0, "WEST"),
                (11, 9, "Velachery - Kathipara Transit", 4.2, 310.0, "NORTH"),
                (3, 12, "Periyar Salai - Madhavaram Arc", 8.8, 620.0, "NORTH"),
                (7, 5, "Panagal Park - Gemini Bypass", 2.2, 170.0, "EAST"),
            ]
            for src, tgt, rname, dist, ttime, rdir in road_edges:
                if src <= len(cameras) and tgt <= len(cameras):
                    r = Road(name=rname, source_camera_id=src, target_camera_id=tgt, distance_km=dist, expected_travel_time_sec=ttime, direction=rdir)
                    db.add(r)
            db.commit()
            print(f"[+] Seeded {db.query(Road).count()} Camera Network Graph Edges.")

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

        # 6. Seed 50+ Diverse Number Plate Observations
        base_time = now_utc - timedelta(hours=3)
        sample_plates = [
            ("TN01AB1234", "car", 1, "NORTH", 0.96, 0.98, 0.95, 42.5),
            ("KA05MN3821", "motorcycle", 3, "EAST", 0.98, 0.99, 0.97, 35.0),
            ("DL02CP9012", "car", 1, "NORTH", 0.92, 0.95, 0.90, 432.0),
            ("KA01TR9999", "truck", 7, "WEST", 0.94, 0.96, 0.93, 62.0),
            ("MH12DE5678", "suv", 4, "SOUTH", 0.97, 0.98, 0.96, 58.4),
            ("HR26BC9999", "car", 10, "NORTH", 0.95, 0.97, 0.94, 71.2),
            ("KL07BF5566", "bus", 5, "EAST", 0.93, 0.95, 0.92, 45.0),
            ("AP09CC1122", "truck", 8, "WEST", 0.91, 0.93, 0.89, 52.8),
            ("TS08EE8899", "car", 6, "SOUTH", 0.96, 0.98, 0.95, 48.0),
            ("GJ01AB5555", "van", 2, "NORTH", 0.94, 0.95, 0.92, 38.5),
            ("WB02EF7777", "car", 3, "EAST", 0.92, 0.94, 0.90, 50.0),
            ("UP32CD8888", "bus", 6, "SOUTH", 0.95, 0.96, 0.93, 44.2),
            ("RJ14PQ1234", "motorcycle", 1, "WEST", 0.97, 0.98, 0.96, 32.0),
            ("PB65AB9876", "suv", 9, "NORTH", 0.93, 0.95, 0.91, 64.5),
            ("OR02XY4321", "auto_rickshaw", 4, "SOUTH", 0.96, 0.97, 0.94, 28.0),
            ("MP09AB3456", "truck", 11, "EAST", 0.90, 0.92, 0.88, 40.0),
            ("TN09XY1111", "car", 2, "NORTH", 0.95, 0.96, 0.93, 22.0),
            ("KA03AB2222", "bus", 6, "SOUTH", 0.94, 0.95, 0.92, 18.5),
            ("KL07CD3333", "car", 5, "EAST", 0.96, 0.97, 0.94, 25.0),
            ("MH04EV4040", "car", 7, "WEST", 0.96, 0.97, 0.95, 38.0),
            ("TN01EM9999", "police_cruiser", 1, "NORTH", 0.99, 0.99, 0.98, 85.0),
            ("KA01AM1080", "ambulance", 3, "EAST", 0.98, 0.99, 0.97, 78.0),
            ("DL03CC4455", "car", 10, "SOUTH", 0.92, 0.94, 0.90, 48.0),
            ("GA01C8888", "car", 2, "WEST", 0.97, 0.98, 0.96, 45.0),
            ("CH01AB3333", "car", 1, "NORTH", 0.96, 0.97, 0.95, 52.0),
            ("KA04MH7007", "car", 12, "EAST", 0.93, 0.95, 0.92, 40.0),
            ("KA51Z1234", "scooter", 8, "SOUTH", 0.95, 0.96, 0.94, 30.0),
            ("TN22AA4567", "bus", 4, "WEST", 0.97, 0.98, 0.96, 35.0),
            ("MH01CP1001", "police_cruiser", 9, "NORTH", 0.98, 0.99, 0.97, 72.0),
            ("KL11BH2020", "car", 5, "SOUTH", 0.90, 0.93, 0.89, 44.0),
            ("KA02MB8080", "truck", 1, "EAST", 0.99, 0.99, 0.98, 65.0),
            ("TS09FA9999", "suv", 11, "WEST", 0.96, 0.97, 0.95, 92.0),
            ("HR51AU2345", "truck", 12, "NORTH", 0.89, 0.92, 0.88, 55.0),
            ("DL01ZA0001", "car", 1, "SOUTH", 0.99, 0.99, 0.98, 60.0),
            ("KA03NC5555", "car", 6, "EAST", 0.95, 0.96, 0.94, 38.0),
            ("TN07CK7788", "motorcycle", 2, "NORTH", 0.97, 0.98, 0.96, 32.0),
            ("MH14GH9000", "van", 8, "WEST", 0.94, 0.95, 0.92, 42.0)
        ]

        # Trajectory continuity for key vehicles
        journey_links = [
            ("TN01AB1234", 3, 150, 48.0),
            ("TN01AB1234", 5, 380, 52.0),
            ("KA05MN3821", 5, 240, 36.0),
            ("DL02CP9012", 3, 10, 432.0), # anomaly
            ("KA01AM1080", 5, 120, 82.0), # ambulance
            ("TN01EM9999", 3, 110, 88.0)  # police escort
        ]

        obs_count = 0
        for i, (plate, vtype, cid, dname, ocr_c, det_c, fin_c, speed) in enumerate(sample_plates):
            t_sighting = base_time + timedelta(minutes=i * 4)
            obs = PlateObservation(
                plate_number=plate,
                camera_id=cid,
                timestamp=t_sighting,
                ocr_confidence=ocr_c,
                plate_detection_confidence=det_c,
                final_confidence=fin_c,
                vehicle_type=vtype,
                lane=(i % 3) + 1,
                direction=dname,
                global_vehicle_id=f"VEH-{1000+i:04d}",
                speed_kmh=speed
            )
            db.add(obs)
            obs_count += 1

        for plate, cid, delta_s, speed in journey_links:
            t_sighting = base_time + timedelta(seconds=delta_s + 600)
            obs = PlateObservation(
                plate_number=plate,
                camera_id=cid,
                timestamp=t_sighting,
                ocr_confidence=0.96,
                plate_detection_confidence=0.98,
                final_confidence=0.95,
                vehicle_type="car" if "TN01" in plate or "DL02" in plate else ("motorcycle" if "KA05" in plate else "ambulance"),
                lane=2,
                direction="EAST",
                global_vehicle_id=f"VEH-{hash(plate) % 10000:04d}",
                speed_kmh=speed
            )
            db.add(obs)
            obs_count += 1

        db.commit()
        print(f"[+] Total ANPR Observations Seeded: {db.query(PlateObservation).count()}")

        # 7. Seed Active System Alerts & Anomalies
        if db.query(Alert).count() == 0:
            alerts_data = [
                ("BLACKLISTED_VEHICLE", "CRITICAL", 3, "Chennai Central - Ripon Cross", "KA05MN3821", "Watchlist vehicle KA05MN3821 detected at CCTV-03. Reason: Stolen Vehicle Alert."),
                ("ROUTE_ANOMALY", "HIGH", 3, "Chennai Central - Ripon Cross", "DL02CP9012", "Route Anomaly: DL02CP9012 traversed Anna Salai Link at impossible speed (432 km/h)."),
                ("BLACKLISTED_VEHICLE", "CRITICAL", 1, "Anna Salai - Spencers Junction", "TN01AB1234", "Watchlist match: TN01AB1234 flagged for 14 unpaid red-light violations."),
                ("CONGESTION_ALERT", "HIGH", 2, "Anna Salai - Spencers Junction", None, "Critical queue length (>15 vehicles) detected on South approach."),
                ("EMERGENCY_CORRIDOR", "HIGH", 3, "Chennai Central - Ripon Cross", "KA01AM1080", "Emergency ambulance corridor preempted on East approach."),
                ("INCIDENT_DETECTION", "MEDIUM", 6, "Gemini Flyover Circle", None, "Traffic slowdown detected on Southbound flyover ramp.")
            ]
            for atype, sev, cid, loc, vplate, msg in alerts_data:
                a = Alert(
                    type=atype,
                    severity=sev,
                    timestamp=now_utc - timedelta(minutes=random.randint(5, 90)),
                    camera_id=cid,
                    location=loc,
                    vehicle_plate=vplate,
                    message=msg,
                    status="NEW",
                    confidence=0.96
                )
                db.add(a)

            # Route Anomaly record
            anomaly = RouteAnomaly(
                plate_number="DL02CP9012",
                reason="Impossible travel time (10 seconds for 1.2km road: speed ~432km/h)",
                confidence=0.95,
                observed_route="CCTV-01 North -> CCTV-03 East",
                expected_route="Normal journey duration: >90s",
                timestamp=now_utc - timedelta(minutes=25)
            )
            db.add(anomaly)
            db.commit()
            print(f"[+] Seeded {db.query(Alert).count()} Active System Alerts.")

        # 8. Seed Archive Video Recordings
        if db.query(VideoRecording).count() == 0:
            recordings_data = [
                ("REC-20260911-001", 1, "CCTV-FIXED-01", "Anna Salai - Spencers Junction", 120.0, 14.5, "sample_traffic_urban.mp4", "CONTINUOUS"),
                ("REC-20260911-002", 3, "CCTV-FIXED-03", "Chennai Central - Ripon Cross", 95.0, 11.2, "sample_traffic_emergency.mp4", "EVENT_TRIGGERED"),
                ("REC-20260911-003", 4, "CCTV-FIXED-04", "T. Nagar - Panagal Park", 150.0, 18.0, "sample_traffic_highway.mp4", "SCHEDULED"),
                ("REC-20260911-004", 5, "CCTV-FIXED-05", "Gemini Flyover Circle", 180.0, 21.4, "sample_traffic_rainy.mp4", "CONTINUOUS"),
                ("REC-20260911-005", 2, "CCTV-FIXED-02", "Anna Salai - Spencers Junction", 110.0, 13.1, "sample_traffic_congested.mp4", "EVENT_TRIGGERED"),
                ("REC-20260911-006", 6, "CCTV-FIXED-06", "Tidel Park - OMR IT Expressway", 130.0, 15.6, "sample_traffic_junction.mp4", "SCHEDULED"),
            ]
            for rid, cid, dev_id, loc, dur, fsize, fref, rtype in recordings_data:
                rec = VideoRecording(
                    record_id=rid,
                    camera_id=cid,
                    device_id=dev_id,
                    location=loc,
                    start_time=now_utc - timedelta(hours=2, minutes=dur/60),
                    end_time=now_utc - timedelta(hours=2),
                    duration_sec=dur,
                    file_size_mb=fsize,
                    file_reference=fref,
                    recording_type=rtype
                )
                db.add(rec)
            db.commit()
            print(f"[+] Seeded {db.query(VideoRecording).count()} Archive Video Recordings.")

        # 9. Seed Multi-Category ANPR & Traffic Violations
        if db.query(Violation).filter(Violation.violation_type == "WITHOUT_HELMET").count() == 0:
            evidence_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage", "evidence"))
            ev_files = []
            if os.path.exists(evidence_dir):
                ev_files = [f"/storage/evidence/{f}" for f in os.listdir(evidence_dir) if f.endswith(('.jpg', '.png'))]
            if not ev_files:
                ev_files = ["/sample_traffic.mp4"]

            cat_violations = [
                ("WITHOUT_HELMET", "TNXX1234", 0.94, "Review", 15),
                ("WITHOUT_HELMET", "TNXX5678", 0.97, "Verified", 32),
                ("WITHOUT_HELMET", "TNXX9012", 0.91, "Review", 48),
                ("WITHOUT_HELMET", "KA05MN3821", 0.96, "Verified", 65),
                ("WITHOUT_HELMET", "TN07CK7788", 0.93, "Pending", 90),
                ("WITHOUT_HELMET", "KA51Z1234", 0.95, "Review", 120),
                ("WITHOUT_SEATBELT", "TN01AB1234", 0.92, "Review", 25),
                ("WITHOUT_SEATBELT", "DL02CP9012", 0.95, "Verified", 55),
                ("WITHOUT_SEATBELT", "TS08EE8899", 0.89, "Pending", 80),
                ("WITHOUT_SEATBELT", "TNXX1001", 0.94, "Verified", 110),
                ("SIGNAL_JUMP", "TN01AB1234", 0.98, "Verified", 10),
                ("SIGNAL_JUMP", "MH12DE5678", 0.95, "Review", 40),
                ("SIGNAL_JUMP", "HR26BC9999", 0.96, "Verified", 70),
                ("SIGNAL_JUMP", "KL07CD3333", 0.93, "Pending", 105),
                ("SIGNAL_JUMP", "TNXX1003", 0.97, "Review", 135),
                ("WRONG_LANE", "WB02EF7777", 0.91, "Review", 35),
                ("WRONG_LANE", "TS09FA9999", 0.94, "Verified", 75),
                ("WRONG_LANE", "GA01C8888", 0.88, "Pending", 115),
                ("WRONG_WAY", "OR02XY4321", 0.96, "Verified", 20),
                ("WRONG_WAY", "MP09AB3456", 0.93, "Review", 60),
                ("WRONG_WAY", "CH01AB3333", 0.95, "Verified", 130),
                ("SPEED_VIOLATION", "DL02CP9012", 0.99, "Verified", 18),
                ("SPEED_VIOLATION", "KA02MB8080", 0.95, "Review", 50),
                ("SPEED_VIOLATION", "HR51AU2345", 0.92, "Pending", 95),
                ("SPEED_VIOLATION", "TS09FA9999", 0.97, "Verified", 140),
                ("ILLEGAL_PARKING", "GJ01AB5555", 0.94, "Review", 45),
                ("ILLEGAL_PARKING", "MH14GH9000", 0.90, "Pending", 85),
                ("ILLEGAL_PARKING", "KL11BH2020", 0.95, "Verified", 125),
                ("STOLEN_VEHICLES", "KA05MN3821", 0.98, "Verified", 12),
                ("STOLEN_VEHICLES", "TN09BZ9999", 0.96, "Verified", 62),
                ("STOLEN_VEHICLES", "TNXX1002", 0.95, "Review", 100),
                ("CHALLAN_DEFAULTER", "TN01AB1234", 0.97, "Verified", 8),
                ("CHALLAN_DEFAULTER", "TNXX1004", 0.93, "Review", 72),
                ("SECURITY_WATCHLIST", "MH12PQ9999", 0.99, "Verified", 14),
                ("SECURITY_WATCHLIST", "DL03CC4455", 0.94, "Review", 88)
            ]
            cam_count = max(1, len(cameras))
            for i, (cat, plate, conf, stat, min_ago) in enumerate(cat_violations):
                v_cam_id = cameras[i % cam_count].id if cameras else 1
                v_img = ev_files[i % len(ev_files)]
                db.add(Violation(
                    violation_type=cat,
                    camera_id=v_cam_id,
                    license_plate=plate,
                    confidence=conf,
                    evidence_image=v_img,
                    status=stat,
                    timestamp=now_utc - timedelta(minutes=min_ago)
                ))
            db.commit()
            print(f"[+] Seeded {len(cat_violations)} Multi-Category ANPR & Traffic Violations.")

        print("=" * 65)
        print("  [SUCCESS] Database Seeded Successfully with Complete Test Data!  ")
        print("=" * 65)

    except Exception as e:
        print(f"[ERROR] Database seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
