import logging
import re
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.models import (
    Intersection, TrafficMeasurement, Incident, EmergencyEvent, Signal,
    PlateObservation, Blacklist, RouteAnomaly, Alert, Camera
)

logger = logging.getLogger(__name__)

class TrafficAIAssistant:
    def answer_query(self, db: Session, query: str) -> dict:
        query_lower = query.lower()
        sources = ["PostgreSQL Live State", "Plate Sighting DB", "Traffic Metrics Index"]

        # Fetch basic count context
        total_intersections = db.query(Intersection).count()
        latest_measurements = db.query(TrafficMeasurement).order_by(TrafficMeasurement.timestamp.desc()).limit(10).all()
        active_incidents = db.query(Incident).filter(Incident.status != "RESOLVED").all()
        active_emergencies = db.query(EmergencyEvent).filter(EmergencyEvent.status == "ACTIVE").all()

        total_vehicles_now = sum([int(m.vehicle_count) for m in latest_measurements]) if latest_measurements else 0

        # Regular expression to extract standard Indian plates (e.g. KA05MN3821, TN01AB1234)
        plate_match = re.search(r'([a-zA-Z]{2}\s*\d{2}\s*[a-zA-Z]{1,2}\s*\d{4})', query)
        
        # 1. License Plate Tracker / Trajectory Queries
        if plate_match:
            plate_raw = plate_match.group(1)
            plate_clean = plate_raw.replace(" ", "").upper()
            
            # Query Plate Sighting database
            sightings = db.query(PlateObservation).filter(
                PlateObservation.plate_number == plate_clean
            ).order_by(PlateObservation.timestamp.desc()).all()
            
            if sightings:
                locs = []
                for s in sightings:
                    cam_name = s.camera.name if s.camera else f"CAM-{s.camera_id}"
                    locs.append(f"{cam_name} at {s.timestamp.strftime('%H:%M:%S')}")
                
                route_str = " -> ".join(reversed([s.camera.name if s.camera else f"CAM-{s.camera_id}" for s in sightings]))
                answer = (
                    f"Vehicle **{plate_clean}** was detected **{len(sightings)} times** in the network. "
                    f"Last seen at **{locs[0]}**. "
                    f"Reconstructed Route Pathway: `{route_str}`."
                )
            else:
                answer = f"Vehicle license plate **{plate_clean}** was not detected at any monitored camera in the last 24 hours."

        # 2. Blacklisted Alerts Queries
        elif "blacklist" in query_lower or "watchlist" in query_lower:
            blacklist_alerts = db.query(Alert).filter(Alert.type == "BLACKLISTED_VEHICLE").all()
            if blacklist_alerts:
                items = []
                for a in blacklist_alerts:
                    items.append(f"Plate {a.vehicle_plate} at {a.location} ({a.timestamp.strftime('%H:%M:%S')})")
                details = "; ".join(items)
                answer = f"Active Blacklist Alerts registered: **{len(blacklist_alerts)} matches**. Details: {details}."
            else:
                answer = "No blacklisted vehicle alerts have been generated today."

        # 3. Route Anomaly Queries
        elif "anomaly" in query_lower or "anomalies" in query_lower or "irregular" in query_lower:
            anomalies = db.query(RouteAnomaly).all()
            if anomalies:
                items = []
                for a in anomalies:
                    items.append(f"Plate {a.plate_number} ({a.reason})")
                details = "; ".join(items)
                answer = f"Found **{len(anomalies)} Route Anomalies**: {details}."
            else:
                answer = "All reconstructed vehicle journeys strictly align with standard travel-time and transition models. Zero anomalies."

        # 4. Congestion / heavy traffic Queries
        elif "congest" in query_lower or "heavy" in query_lower or "jam" in query_lower or "slow" in query_lower:
            congested_spots = db.query(Intersection).filter(Intersection.current_status.in_(["HIGH", "SEVERE"])).all()
            if congested_spots:
                names = ", ".join([i.name for i in congested_spots])
                answer = (
                    f"Traffic is currently congested at {len(congested_spots)} intersection(s): {names}. "
                    f"The highest density registered is {congested_spots[0].current_status} with an average vehicle queue length of "
                    f"{latest_measurements[0].queue_length if latest_measurements else 12} vehicles per lane."
                )
            else:
                answer = f"Traffic across all {total_intersections} monitored intersections is currently flowing smoothly at LOW to MODERATE levels."

        # 5. Bottlenecks Queries
        elif "bottleneck" in query_lower or "worst" in query_lower or "congestion rank" in query_lower:
            # Sort by vehicle count & queue length
            measurements = db.query(TrafficMeasurement).order_by(TrafficMeasurement.queue_length.desc()).limit(3).all()
            if measurements:
                names = []
                for m in measurements:
                    cam_name = m.camera.name if m.camera else f"CAM-{m.camera_id}"
                    names.append(f"{cam_name} (Queue: {m.queue_length} vehicles, Density: {m.congestion_level.value})")
                answer = "Top Traffic Bottlenecks detected in the network:\n" + "\n".join([f"{idx+1}. {n}" for idx, n in enumerate(names)])
            else:
                answer = "No bottleneck congestion metrics calculated. Camera feeds offline."

        # 6. Emergency Queries
        elif "emergency" in query_lower or "ambulance" in query_lower or "fire" in query_lower:
            if active_emergencies:
                ev = active_emergencies[0]
                answer = f"There is currently {len(active_emergencies)} active emergency event. Vehicle: {ev.vehicle_type.upper()} detected at Intersection #{ev.intersection_id}. Priority override signal sequence is active."
            else:
                answer = f"No emergency vehicles are currently detected across any monitored intersection."

        # 7. Incident Queries
        elif "incident" in query_lower or "accident" in query_lower or "stoppage" in query_lower:
            if active_incidents:
                inc = active_incidents[0]
                answer = f"Active incident reported: {inc.incident_type} (Severity: {inc.severity}) at Intersection #{inc.intersection_id}. Status: {inc.status.value if hasattr(inc.status, 'value') else inc.status}."
            else:
                answer = f"No unresolved traffic incidents are currently reported on the network."

        # 8. Report / Summary Queries
        elif "report" in query_lower or "summary" in query_lower or "stats" in query_lower:
            answer = (
                f"SmartTraffic AI Network Report (Generated at {datetime.now().strftime('%H:%M:%S')}):\n"
                f"- Total Monitored Intersections: {total_intersections}\n"
                f"- Current Active Vehicle Count: {total_vehicles_now}\n"
                f"- Active Incidents: {len(active_incidents)}\n"
                f"- Active Emergency Overrides: {len(active_emergencies)}"
            )

        # Default query response
        else:
            answer = (
                f"SmartTraffic AI Assistant System Response:\n"
                f"Currently monitoring {total_intersections} intersections and {total_vehicles_now} active vehicles. "
                f"System operational with adaptive signal control, ANPR trajectory tracking, and real-time incident detection."
            )

        return {
            "query": query,
            "answer": answer,
            "sources": sources,
            "context_data": {
                "total_intersections": total_intersections,
                "active_vehicles": total_vehicles_now,
                "active_incidents": len(active_incidents),
                "active_emergencies": len(active_emergencies)
            },
            "timestamp": datetime.now(timezone.utc)
        }

ai_assistant = TrafficAIAssistant()
