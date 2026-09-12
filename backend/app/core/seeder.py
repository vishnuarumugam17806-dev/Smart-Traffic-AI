import logging
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.core import security
from app.models.models import (
    User, RoleEnum, Intersection, Camera, Signal, TrafficMeasurement,
    CongestionLevelEnum, CameraStatusEnum, Incident, IncidentStatusEnum,
    EmergencyEvent, Violation, NumberPlate, AgentDecision, Road,
    PlateObservation, Blacklist, RouteAnomaly, Alert, VideoRecording
)

logger = logging.getLogger("VIGITRA.Seeder")

def auto_seed_database(db: Session, force: bool = False) -> None:
    """
    Automatically checks and seeds essential test dataset if tables are empty.
    Includes: Users, Chennai Intersections, 12 CCTV Cameras, Graph Roads,
    Blacklist Watchlist, 50+ ANPR Plate Observations, Alerts, and Recordings.
    """
    try:
        # 1. Seed Users (admin & operator)
        if not db.query(User).filter(User.username == "admin").first():
            admin_user = User(
                username="admin",
                email="admin@vigitra.ai",
                hashed_password=security.get_password_hash("admin123"),
                full_name="System Administrator",
                role=RoleEnum.ADMIN,
                is_active=True,
                is_approved=True
            )
            operator_user = User(
                username="operator",
                email="operator@vigitra.ai",
                hashed_password=security.get_password_hash("operator123"),
                full_name="Traffic Operator",
                role=RoleEnum.OPERATOR,
                is_active=True,
                is_approved=True
            )
            db.add_all([admin_user, operator_user])
            db.commit()
            logger.info("Seeded default users: 'admin' and 'operator'.")

        # 2. Seed 10 Realistic Chennai Intersections
        intersections_data = [
            ("Anna Salai - Spencers Junction", "Downtown Thousand Lights & Binny Rd", 13.0604, 80.2605, CongestionLevelEnum.HIGH, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ]),
            ("Chennai Central - Ripon Cross", "EVR Periyar Salai & Wall Tax Rd", 13.0827, 80.2755, CongestionLevelEnum.MODERATE, 3, [
                {"id": "NORTH", "name": "North Main Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Ramp Approach", "direction": "EAST"},
                {"id": "WEST", "name": "West Express Approach", "direction": "WEST"}
            ]),
            ("Gemini Flyover Circle", "Anna Salai & Cathedral Road", 13.0531, 80.2514, CongestionLevelEnum.LOW, 2, [
                {"id": "NORTH", "name": "Northbound Bridge Approach", "direction": "NORTH"},
                {"id": "SOUTH", "name": "Southbound Bridge Approach", "direction": "SOUTH"}
            ]),
            ("T. Nagar - Panagal Park Circle", "G.N. Chetty Rd & Usman Rd", 13.0405, 80.2337, CongestionLevelEnum.SEVERE, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ]),
            ("Kathipara Cloverleaf Interchange", "GST Road & Inner Ring Rd, Guindy", 13.0067, 80.2026, CongestionLevelEnum.HIGH, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ]),
            ("Tidel Park - OMR IT Expressway", "Rajiv Gandhi Salai, Taramani", 12.9892, 80.2476, CongestionLevelEnum.SEVERE, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ]),
            ("Koyambedu CMBT Roundabout", "Poonamallee High Rd & Inner Ring Rd", 13.0694, 80.1948, CongestionLevelEnum.SEVERE, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ]),
            ("Marina Beach - Kamarajar Salai", "Light House & Kamarajar Promenade", 13.0382, 80.2785, CongestionLevelEnum.LOW, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ]),
            ("Velachery Vijayanagar Junction", "Velachery Bypass & Taramani Link Rd", 12.9757, 80.2212, CongestionLevelEnum.HIGH, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ]),
            ("Madhavaram Roundabout Interchange", "GNT Road & 200 Feet Rd", 13.1482, 80.2312, CongestionLevelEnum.MODERATE, 4, [
                {"id": "NORTH", "name": "North Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Approach", "direction": "EAST"},
                {"id": "SOUTH", "name": "South Approach", "direction": "SOUTH"},
                {"id": "WEST", "name": "West Approach", "direction": "WEST"}
            ])
        ]

        intersections = []
        for name, loc, lat, lon, status, lanes, app_cfg in intersections_data:
            inter = db.query(Intersection).filter(Intersection.name == name).first()
            if not inter:
                inter = Intersection(
                    name=name,
                    location=loc,
                    latitude=lat,
                    longitude=lon,
                    current_status=status,
                    total_lanes=lanes,
                    num_approaches=len(app_cfg),
                    approaches_config=app_cfg
                )
                db.add(inter)
                db.commit()
                db.refresh(inter)
            intersections.append(inter)

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
            ("CCTV-12 West (Madhavaram Roundabout Interchange)", "sample_traffic_junction.mp4", "FILE", 10, "WEST")
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
                    intersection_id=inter_id if inter_id <= len(intersections) else 1,
                    direction=dir_name,
                    status=CameraStatusEnum.LIVE,
                    fps=30.0
                )
                db.add(cam)
                db.commit()
                db.refresh(cam)
            else:
                if cam.status != CameraStatusEnum.LIVE:
                    cam.status = CameraStatusEnum.LIVE
                    db.commit()
            cameras.append(cam)

            # Ensure initial traffic measurement exists
            if not db.query(TrafficMeasurement).filter(TrafficMeasurement.camera_id == cam.id).first():
                m = TrafficMeasurement(
                    camera_id=cam.id,
                    intersection_id=inter_id if inter_id <= len(intersections) else 1,
                    vehicle_count=16 + (idx * 3) % 25,
                    queue_length=2 + (idx * 2) % 10,
                    occupancy_percentage=28.0 + (idx * 5.0) % 55,
                    average_speed_kmh=52.0 - (idx * 3.0) % 25,
                    congestion_level=CongestionLevelEnum.MODERATE,
                    timestamp=now_utc - timedelta(minutes=idx * 5)
                )
                db.add(m)

            # Signal Controller
            target_inter_id = inter_id if inter_id <= len(intersections) else 1
            if not db.query(Signal).filter(Signal.intersection_id == target_inter_id).first():
                sig = Signal(
                    intersection_id=target_inter_id,
                    current_phase="GREEN" if idx % 2 == 0 else "RED",
                    green_duration=45 + (idx * 5) % 25,
                    red_duration=45,
                    yellow_duration=3,
                    is_adaptive=True,
                    emergency_override=False
                )
                db.add(sig)

        db.commit()

        # 4. Seed Roads (Directed Graph Edges)
        if db.query(Road).count() < 5:
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
                    r = Road(
                        name=rname,
                        source_camera_id=src,
                        target_camera_id=tgt,
                        distance_km=dist,
                        expected_travel_time_sec=ttime,
                        direction=rdir
                    )
                    db.add(r)
            db.commit()

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

        # 6. Seed Plate Observations if empty or low
        if db.query(PlateObservation).count() < 10:
            base_time = now_utc - timedelta(hours=2)
            sample_plates = [
                ("TN01AB1234", "car", 1, "NORTH", 0.96, 0.98, 0.95, 42.5),
                ("KA05MN3821", "motorcycle", 3, "EAST", 0.98, 0.99, 0.97, 35.0),
                ("DL02CP9012", "car", 1, "NORTH", 0.92, 0.95, 0.90, 65.0),
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

            journey_links = [
                ("TN01AB1234", 3, 150, 48.0),
                ("TN01AB1234", 5, 380, 52.0),
                ("KA05MN3821", 5, 240, 36.0),
                ("KA01AM1080", 5, 120, 82.0),
                ("TN01EM9999", 3, 110, 88.0)
            ]

            for i, (plate, vtype, cid, dname, ocr_c, det_c, fin_c, speed) in enumerate(sample_plates):
                t_sighting = base_time + timedelta(minutes=i * 3)
                obs = PlateObservation(
                    plate_number=plate,
                    camera_id=cid if cid <= len(cameras) else 1,
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

            for plate, cid, delta_s, speed in journey_links:
                t_sighting = base_time + timedelta(seconds=delta_s + 600)
                obs = PlateObservation(
                    plate_number=plate,
                    camera_id=cid if cid <= len(cameras) else 1,
                    timestamp=t_sighting,
                    ocr_confidence=0.96,
                    plate_detection_confidence=0.98,
                    final_confidence=0.95,
                    vehicle_type="car" if "TN01" in plate else ("motorcycle" if "KA05" in plate else "ambulance"),
                    lane=2,
                    direction="EAST",
                    global_vehicle_id=f"VEH-{abs(hash(plate)) % 10000:04d}",
                    speed_kmh=speed
                )
                db.add(obs)

            db.commit()

        # 7. Seed Active System Alerts & Anomalies
        if db.query(Alert).filter(Alert.type != "CAMERA_OFFLINE").count() == 0:
            alerts_data = [
                ("BLACKLISTED_VEHICLE", "CRITICAL", 3, "Chennai Central - Ripon Cross", "KA05MN3821", "Watchlist vehicle KA05MN3821 detected at CCTV-03. Reason: Stolen Vehicle Alert."),
                ("ROUTE_ANOMALY", "HIGH", 3, "Chennai Central - Ripon Cross", "DL02CP9012", "Route Anomaly: DL02CP9012 traversed Anna Salai Link with rapid transit variance."),
                ("BLACKLISTED_VEHICLE", "CRITICAL", 1, "Anna Salai - Spencers Junction", "TN01AB1234", "Watchlist match: TN01AB1234 flagged for 14 unpaid red-light violations."),
                ("CONGESTION_ALERT", "HIGH", 2, "Anna Salai - Spencers Junction", None, "Critical queue length (>15 vehicles) detected on South approach."),
                ("EMERGENCY_CORRIDOR", "HIGH", 3, "Chennai Central - Ripon Cross", "KA01AM1080", "Emergency ambulance corridor preempted on East approach.")
            ]
            for atype, sev, cid, loc, vplate, msg in alerts_data:
                a = Alert(
                    type=atype,
                    severity=sev,
                    timestamp=now_utc - timedelta(minutes=random.randint(5, 60)),
                    camera_id=cid if cid <= len(cameras) else 1,
                    location=loc,
                    vehicle_plate=vplate,
                    message=msg,
                    status="NEW",
                    confidence=0.96
                )
                db.add(a)

            if db.query(RouteAnomaly).count() == 0:
                anomaly = RouteAnomaly(
                    plate_number="DL02CP9012",
                    reason="Excess speed detected across camera link (speed ~120km/h in 40km/h urban zone)",
                    confidence=0.95,
                    observed_route="CCTV-01 North -> CCTV-03 East",
                    expected_route="Normal journey duration: >180s",
                    timestamp=now_utc - timedelta(minutes=20)
                )
                db.add(anomaly)
            db.commit()

        # 8. Seed Archive Video Recordings
        if db.query(VideoRecording).count() == 0:
            recordings_data = [
                ("REC-20260911-001", 1, "CCTV-FIXED-01", "Anna Salai - Spencers Junction", 120.0, 14.5, "sample_traffic_urban.mp4", "CONTINUOUS"),
                ("REC-20260911-002", 3, "CCTV-FIXED-03", "Chennai Central - Ripon Cross", 95.0, 11.2, "sample_traffic_emergency.mp4", "EVENT_TRIGGERED"),
                ("REC-20260911-003", 4, "CCTV-FIXED-04", "T. Nagar - Panagal Park", 150.0, 18.0, "sample_traffic_highway.mp4", "SCHEDULED"),
                ("REC-20260911-004", 5, "CCTV-FIXED-05", "Gemini Flyover Circle", 180.0, 21.4, "sample_traffic_rainy.mp4", "CONTINUOUS"),
                ("REC-20260911-005", 2, "CCTV-FIXED-02", "Anna Salai - Spencers Junction", 110.0, 13.1, "sample_traffic_congested.mp4", "EVENT_TRIGGERED"),
                ("REC-20260911-006", 6, "CCTV-FIXED-06", "Tidel Park - OMR IT Expressway", 130.0, 15.6, "sample_traffic_junction.mp4", "SCHEDULED")
            ]
            for rid, cid, dev_id, loc, dur, fsize, fref, rtype in recordings_data:
                rec = VideoRecording(
                    record_id=rid,
                    camera_id=cid if cid <= len(cameras) else 1,
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

        logger.info("[+] VIGITRA Auto-Seeder completed successfully. All test data active.")
    except Exception as e:
        logger.error(f"[-] Auto-seeder error: {e}")
        db.rollback()
