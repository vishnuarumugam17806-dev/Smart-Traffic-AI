import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.database.session import SessionLocal
from app.websocket.manager import ws_manager
from app.models.models import Camera, Intersection, Alert, Incident, EmergencyEvent, PlateObservation, MobileDevice, VideoRecording, CameraStatusEnum
from app.traffic.signal_controller import signal_registry
from app.trajectory.graph import trajectory_engine

logger = logging.getLogger(__name__)

class DemoScenarioRunner:
    """
    Executes the 30-step Smart India Hackathon Master Demonstration Scenario:
    1. Fixed traffic cameras active & YOLOv8 vehicle detection
    2. ANPR OCR plate sightings & vehicle tracking
    3. GIS map updating real-time positions
    4. Traffic density increases -> High Traffic Zone alert
    5. Traffic prediction engine predicts congestion
    6. Adaptive Signal Optimizer changes green phase allocation
    7. High-density road clears -> priority shifts to next approach
    8. Fixed camera failure occurs -> camera marked OFFLINE
    9. System prompts "Deploy Authorized Mobile Camera" fallback
    10. Authorized mobile device (MOBILE-CAM-001) linked & streams live
    11. Mobile video frame ingestion active on dashboard
    12. Same AI processing pipeline runs on mobile feed (YOLOv8 + ANPR)
    13. Vehicle trajectory tracking continues uninterrupted
    14. Field Operator mode captures field photo -> ANPR OCR analysis
    15. Result displayed as "AI DETECTION — NOT VERIFIED"
    16. Authorized operator verifies photo observation
    17. Recorded video session saved with sha256 checksum
    18. Incident detection triggers "POSSIBLE INCIDENT" alert
    19. Operator reviews incident & acknowledges alert
    20. Emergency Ambulance detected on approach
    21. Emergency Preemption Corridor activated
    22. Signal Controller executes safe clearance transition
    23. Emergency vehicle passes -> system returns to Automatic mode
    24. Recorded Video page opened -> filter by date/time/camera
    25. Video playback seeking displays timeline event markers
    26. Individual Signal Control panel selected
    27. Authorized manual override requested with safety clearance modal
    28. Audit log entry recorded with user justification
    29. Signal returned to Automatic mode
    30. Automated Daily Traffic Intelligence PDF/CSV Report exported
    """

    def __init__(self):
        self.is_running = False
        self.current_step = 0
        self.steps = [
            "STEP 1: Fixed Traffic Cameras Active & Monitoring Feeds",
            "STEP 2: YOLOv8 Multi-Vehicle Detection & ANPR OCR Active",
            "STEP 3: Real-Time Coordinates Broadcasting to GIS City Map",
            "STEP 4: Traffic Volume Spiking on Central Junction North Approach",
            "STEP 5: High-Traffic Zone Alert & Heatmap Overlay Triggered",
            "STEP 6: AI Prediction Engine Forecasting Peak Congestion",
            "STEP 7: Adaptive Signal Optimizer Awarding 55s Green to North",
            "STEP 8: North Approach Queue Clearing — Priority Shifting to East",
            "STEP 9: CRITICAL: Fixed Camera CCTV-04 Experienced Hardware Stream Failure",
            "STEP 10: Camera CCTV-04 Marked OFFLINE — Fallback Prompt: 'Deploy Authorized Mobile Camera'",
            "STEP 11: Authorized Field Operator Mobile (MOBILE-CAM-001) Linked & Streaming",
            "STEP 12: Unified AI Pipeline Ingesting Live Mobile Video Stream",
            "STEP 13: Vehicle Trajectory Reconstruction Continues Seamlessly (GV-10482)",
            "STEP 14: Field Operator Mode: Field Photo Captured & Uploaded",
            "STEP 15: Photo ANPR Analysis Complete — Label: 'AI DETECTION — NOT VERIFIED'",
            "STEP 16: Authorized Operator Confirms Photo Plate Observation (TN01AB1234)",
            "STEP 17: Recorded Video Session Saved to Storage (sha256 hash verified)",
            "STEP 18: Traffic Anomaly Detected: 'POSSIBLE INCIDENT — Stopped Vehicle'",
            "STEP 19: Command Center Operator Acknowledges Incident Alert",
            "STEP 20: Emergency Ambulance Sighted on East Approach",
            "STEP 21: Emergency Corridor Preemption Override Activated",
            "STEP 22: Signal Controller Executing Safe Clearance Transition (Yellow -> All-Red -> Green)",
            "STEP 23: Emergency Vehicle Passed — Reverting Signal to Automatic Mode",
            "STEP 24: Recorded Video Search Page Filtered by Date & Camera Node",
            "STEP 25: Video Playback Seeking Jumped to Incident Timeline Event Marker",
            "STEP 26: Individual Signal Control Panel Selected (Central Junction)",
            "STEP 27: Authorized Manual Override Requested with Safety Clearance Modal",
            "STEP 28: Audit Log Entry Created with User Justification & Timestamp",
            "STEP 29: Signal Controller Reverted Back to Automatic Adaptive Mode",
            "STEP 30: Automated Daily Traffic Intelligence PDF & CSV Report Generated"
        ]

    async def run_step(self, step_number: int, db: Session) -> Dict[str, Any]:
        """Executes a specific step of the 30-step demonstration workflow."""
        self.current_step = step_number
        step_desc = self.steps[step_number - 1] if 1 <= step_number <= 30 else "Demo Step Active"
        logger.info(f"[DemoScenarioRunner] Executing {step_desc}")

        # Step 9 & 10: Fixed camera failure & mobile backup fallback prompt
        if step_number == 9 or step_number == 10:
            cam = db.query(Camera).filter(Camera.id == 4).first()
            if cam:
                cam.status = CameraStatusEnum.OFFLINE
                db.commit()

            alert = Alert(
                type="CAMERA_OFFLINE",
                severity="CRITICAL",
                camera_id=4,
                location="North Corridor Junction",
                message="CRITICAL FAILURE: Fixed Camera CCTV-04 OFFLINE. Suggested Action: Deploy Authorized Mobile Camera.",
                status="NEW",
                confidence=1.0
            )
            db.add(alert)
            db.commit()

            await ws_manager.broadcast({
                "event": "CAMERA_STATUS_CHANGED",
                "camera_id": 4,
                "status": "OFFLINE",
                "fallback_suggested": "MOBILE_CAMERA"
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

        # Step 11 & 12: Link Mobile Device
        elif step_number == 11 or step_number == 12:
            dev = db.query(MobileDevice).filter(MobileDevice.device_id == "MOBILE-CAM-001").first()
            if not dev:
                dev = MobileDevice(
                    device_id="MOBILE-CAM-001",
                    camera_id=4,
                    operator_id="OFFICER_104",
                    name="Patrol Phone 01",
                    assigned_location="North Corridor Junction",
                    connection_status="CONNECTED",
                    stream_status="STREAMING",
                    battery_pct=94
                )
                db.add(dev)
            else:
                dev.connection_status = "CONNECTED"
                dev.stream_status = "STREAMING"
            db.commit()

            cam = db.query(Camera).filter(Camera.id == 4).first()
            if cam:
                cam.status = CameraStatusEnum.LIVE
                cam.source_type = "MOBILE_DEVICE"
                cam.is_mobile_backup = True
                db.commit()

            await ws_manager.broadcast({
                "event": "MOBILE_DEVICE_CONNECTED",
                "device_id": "MOBILE-CAM-001",
                "camera_id": 4,
                "assigned_location": "North Corridor Junction"
            })

        # Step 20, 21, 22: Emergency vehicle preemption
        elif step_number == 20 or step_number == 21 or step_number == 22:
            controller = signal_registry.get_controller(1)
            controller.approaches["EAST"]["emergency_detected"] = True
            controller.approaches["EAST"]["emergency_type"] = "ambulance"

            em_event = EmergencyEvent(
                vehicle_type="ambulance",
                camera_id=2,
                intersection_id=1,
                priority_level="CRITICAL",
                action_taken="Emergency Green Wave Corridor Preemption Activated",
                status="ACTIVE"
            )
            db.add(em_event)

            alert = Alert(
                type="EMERGENCY_VEHICLE",
                severity="CRITICAL",
                camera_id=2,
                location="Central Plaza Junction - East Approach",
                message="EMERGENCY PREEMPTION: Ambulance detected. Preemption corridor active.",
                status="NEW",
                confidence=1.0
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
                    "message": alert.message,
                    "timestamp": alert.timestamp.isoformat()
                }
            })

        # Step 23: Return to automatic mode
        elif step_number == 23:
            controller = signal_registry.get_controller(1)
            controller.return_to_automatic(db, "DEMO_ADMIN")
            controller.approaches["EAST"]["emergency_detected"] = False

        demo_payload = {
            "event": "DEMO_STEP_CHANGED",
            "step": step_number,
            "total_steps": 30,
            "description": step_desc,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await ws_manager.broadcast(demo_payload)

        return demo_payload

demo_runner = DemoScenarioRunner()
