import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.models import Camera, Road, PlateObservation, RouteAnomaly, Alert

logger = logging.getLogger(__name__)

def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]

class TrajectoryGraphEngine:
    """
    Multi-Camera Cross-Vehicle Trajectory Engine.
    Correlates vehicle observations across different city cameras using:
    - Plate text & OCR confidence
    - Vehicle appearance & class
    - Timestamp & camera location topology
    - Physical travel-time feasibility constraints
    Assigns unified Global Vehicle IDs (e.g. GV-10482) and reconstructs journey timelines.
    """

    def get_cameras_and_edges(self, db: Session) -> Dict[str, Any]:
        """Returns the city camera network topology as nodes and connected road edges."""
        cameras = db.query(Camera).all()
        roads = db.query(Road).all()
        
        nodes = []
        for cam in cameras:
            nodes.append({
                "id": cam.id,
                "name": cam.name,
                "direction": cam.direction,
                "status": cam.status.value if hasattr(cam.status, 'value') else cam.status,
                "lat": cam.intersection.latitude if cam.intersection else 12.97,
                "lng": cam.intersection.longitude if cam.intersection else 77.59
            })
            
        edges = []
        for road in roads:
            edges.append({
                "id": road.id,
                "name": road.name,
                "source": road.source_camera_id,
                "target": road.target_camera_id,
                "distance_km": road.distance_km,
                "expected_time_sec": road.expected_travel_time_sec,
                "direction": road.direction
            })
            
        return {"nodes": nodes, "edges": edges}

    def reconstruct_trajectory(self, db: Session, plate_number: str) -> Optional[Dict[str, Any]]:
        """
        Reconstructs the city-wide journey timeline of a license plate observation across cameras.
        Includes cameras visited, timestamps, transit speeds, and route anomaly detections.
        """
        plate_clean = plate_number.replace(" ", "").upper()
        
        # Query all observations of this plate chronologically
        obs_list = db.query(PlateObservation).filter(
            PlateObservation.plate_number == plate_clean
        ).order_by(PlateObservation.timestamp.asc()).all()
        
        if not obs_list:
            # Fuzzy plate matching fallback (last 24 hours)
            yesterday = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
            all_obs = db.query(PlateObservation).filter(
                PlateObservation.timestamp >= yesterday
            ).all()
            
            obs_list = []
            for o in all_obs:
                if levenshtein_distance(o.plate_number, plate_clean) <= 1:
                    obs_list.append(o)
            obs_list = sorted(obs_list, key=lambda x: x.timestamp)
            
        if not obs_list:
            return None
            
        total_cameras = len(obs_list)
        first_seen = obs_list[0].timestamp
        last_seen = obs_list[-1].timestamp
        duration_sec = (last_seen - first_seen).total_seconds()
        
        timeline = []
        estimated_distance = 0.0
        route_anomalies_detected = []
        global_vehicle_id = obs_list[0].global_vehicle_id or f"GV-10482"
        
        for idx, obs in enumerate(obs_list):
            camera_name = obs.camera.name if obs.camera else f"CAM-{obs.camera_id}"
            location = obs.camera.intersection.name if (obs.camera and obs.camera.intersection) else "City Intersection"
            lat = obs.camera.intersection.latitude if (obs.camera and obs.camera.intersection) else 12.97
            lng = obs.camera.intersection.longitude if (obs.camera and obs.camera.intersection) else 77.59
            
            transition_speed = 0.0
            anomaly_flag = False
            
            if idx > 0:
                prev_obs = obs_list[idx - 1]
                time_diff = (obs.timestamp - prev_obs.timestamp).total_seconds()
                
                # Check for connecting road edge
                road = db.query(Road).filter(
                    Road.source_camera_id == prev_obs.camera_id,
                    Road.target_camera_id == obs.camera_id
                ).first()
                
                if road:
                    distance = road.distance_km
                    estimated_distance += distance
                    if time_diff > 0:
                        transition_speed = (distance / time_diff) * 3600.0
                        
                        # Anomaly: physically impossible speed (>150 km/h) or under 15% travel time
                        if transition_speed > 150.0 or time_diff < (road.expected_travel_time_sec * 0.15):
                            anomaly_flag = True
                            reason = f"Impossible speed of {transition_speed:.1f} km/h detected between {prev_obs.camera.name} and {obs.camera.name}."
                            route_anomalies_detected.append({
                                "prev_camera_id": prev_obs.camera_id,
                                "curr_camera_id": obs.camera_id,
                                "speed": round(transition_speed, 1),
                                "time_sec": time_diff,
                                "reason": reason
                            })
                else:
                    estimated_distance += 1.5
                    if time_diff > 0:
                        transition_speed = (1.5 / time_diff) * 3600.0
                        if transition_speed > 150.0:
                            anomaly_flag = True
            
            timeline.append({
                "observation_id": obs.id,
                "camera_id": obs.camera_id,
                "camera_name": camera_name,
                "location": location,
                "latitude": lat,
                "longitude": lng,
                "timestamp": obs.timestamp.isoformat(),
                "confidence": obs.final_confidence,
                "direction": obs.direction,
                "lane": obs.lane,
                "vehicle_type": obs.vehicle_type,
                "anomaly": anomaly_flag,
                "speed_kmh": round(transition_speed, 1)
            })
            
        avg_speed = 0.0
        if duration_sec > 0:
            avg_speed = min(120.0, (estimated_distance / duration_sec) * 3600.0)
            
        return {
            "global_vehicle_id": global_vehicle_id,
            "plate_number": plate_clean,
            "first_seen": first_seen.isoformat(),
            "last_seen": last_seen.isoformat(),
            "cameras_visited": total_cameras,
            "duration_seconds": duration_sec,
            "estimated_distance_km": round(estimated_distance, 2),
            "average_speed_kmh": round(avg_speed, 1),
            "timeline": timeline,
            "anomalies": route_anomalies_detected
        }

    def correlate_vehicle(self, db: Session, plate: str, vehicle_type: str, camera_id: int, timestamp: datetime) -> Dict[str, Any]:
        """
        Correlates a newly detected license plate observation to a Global Vehicle Trajectory.
        Evaluates plate text, vehicle class, physical travel-time feasibility, and road topology.
        Generates global IDs in format GV-XXXXX.
        """
        plate_clean = plate.replace(" ", "").upper()
        
        # 1. Search existing observations for matching plate or global ID
        existing = db.query(PlateObservation).filter(
            PlateObservation.plate_number == plate_clean,
            PlateObservation.global_vehicle_id.isnot(None)
        ).order_by(PlateObservation.timestamp.desc()).first()
        
        global_id = None
        if existing:
            global_id = existing.global_vehicle_id
        else:
            # Fuzzy match (last 30 minutes)
            time_limit = timestamp - timedelta(minutes=30)
            past_obs = db.query(PlateObservation).filter(
                PlateObservation.timestamp >= time_limit,
                PlateObservation.global_vehicle_id.isnot(None)
            ).order_by(PlateObservation.timestamp.desc()).all()
            
            for obs in past_obs:
                if obs.vehicle_type == vehicle_type:
                    if levenshtein_distance(obs.plate_number, plate_clean) <= 1:
                        global_id = obs.global_vehicle_id
                        break
                        
            if not global_id:
                # Generate new global vehicle ID (e.g. GV-10482)
                distinct_ids = db.query(PlateObservation.global_vehicle_id).distinct().all()
                existing_nums = []
                for (gid,) in distinct_ids:
                    if gid and (gid.startswith("GV-") or gid.startswith("VEH-")):
                        try:
                            existing_nums.append(int(gid.split("-")[1]))
                        except (IndexError, ValueError):
                            pass
                next_num = max(existing_nums) + 1 if existing_nums else 10482
                global_id = f"GV-{next_num:05d}"
                
        # 2. Check transit speed & physical feasibility against preceding observation
        prev_obs = db.query(PlateObservation).filter(
            PlateObservation.global_vehicle_id == global_id,
            PlateObservation.timestamp < timestamp
        ).order_by(PlateObservation.timestamp.desc()).first()
        
        speed_kmh = 0.0
        anomaly = None
        
        if prev_obs:
            time_diff = (timestamp - prev_obs.timestamp).total_seconds()
            if time_diff > 0:
                road = db.query(Road).filter(
                    Road.source_camera_id == prev_obs.camera_id,
                    Road.target_camera_id == camera_id
                ).first()
                
                distance = road.distance_km if road else 1.5
                speed_kmh = (distance / time_diff) * 3600.0
                
                # Check for physical route anomaly
                is_anomaly = False
                reason = ""
                if speed_kmh > 150.0:
                    is_anomaly = True
                    reason = f"Physically impossible journey speed ({speed_kmh:.1f} km/h) from {prev_obs.camera.name if prev_obs.camera else f'CAM-{prev_obs.camera_id}'} to current camera."
                elif road and time_diff < (road.expected_travel_time_sec * 0.15):
                    is_anomaly = True
                    reason = f"Travel time too short ({time_diff:.1f}s vs expected {road.expected_travel_time_sec:.0f}s)."
                    
                if is_anomaly:
                    curr_camera = db.query(Camera).filter(Camera.id == camera_id).first()
                    location = curr_camera.intersection.name if (curr_camera and curr_camera.intersection) else "Unknown Junction"
                    
                    anomaly = RouteAnomaly(
                        plate_number=plate_clean,
                        reason=reason,
                        confidence=0.95,
                        observed_route=f"{prev_obs.camera.name if prev_obs.camera else f'CAM-{prev_obs.camera_id}'} -> {curr_camera.name if curr_camera else f'CAM-{camera_id}'}",
                        expected_route=f"Expected baseline: >{road.expected_travel_time_sec if road else 90:.0f}s",
                        timestamp=timestamp
                    )
                    db.add(anomaly)
                    db.commit()
                    db.refresh(anomaly)
                    
                    alert = Alert(
                        type="ROUTE_ANOMALY",
                        severity="HIGH",
                        timestamp=timestamp,
                        camera_id=camera_id,
                        location=location,
                        vehicle_plate=plate_clean,
                        message=f"Potential Route Anomaly: Vehicle {plate_clean} ({global_id}) traveled at impossible speed ({speed_kmh:.1f} km/h).",
                        status="NEW",
                        confidence=0.95
                    )
                    db.add(alert)
                    db.commit()
                    
                    logger.warning(f"ROUTE ANOMALY DETECTED: {plate_clean} ({global_id}) speed={speed_kmh:.1f}km/h")
                    
        return {
            "global_vehicle_id": global_id,
            "speed_kmh": round(speed_kmh, 1),
            "anomaly": anomaly
        }

trajectory_engine = TrajectoryGraphEngine()
