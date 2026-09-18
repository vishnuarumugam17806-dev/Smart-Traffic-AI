import os
import time
import logging
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.database.mongodb import mongo_manager
from app.models.models import MobileDevice, PlateObservation, EvidenceRecord, Alert, Violation, Blacklist
from app.cv.mobile_manager import mobile_manager
from app.websocket.manager import ws_manager
from app.core.config import settings

logger = logging.getLogger(__name__)

class MobileEventService:
    """
    Manages end-to-end lifecycle of validated mobile camera ANPR events (Sections 17, 18, 29, 30, 32).
    Attaches current device GPS, creates MongoDB event documents, logs SQL Evidence and Observations,
    triggers alerts on watchlist/compliance matches, and broadcasts real-time telemetry over WebSockets.
    """

    def __init__(self):
        self.memory_events_cache: List[Dict[str, Any]] = []

    async def create_and_persist_event(
        self,
        db: Session,
        device_id: str,
        plate_number: str,
        vehicle_type: str,
        vehicle_confidence: float,
        plate_confidence: float,
        plate_det_confidence: float,
        visual_validation_score: float,
        tracking_id: Optional[str],
        frame_url: Optional[str] = None,
        plate_crop_url: Optional[str] = None,
        source_mode: str = "LIVE"
    ) -> Dict[str, Any]:
        """
        Builds the production ANPR event document, binds valid device GPS,
        saves to MongoDB, SQL, and sends real-time WebSocket alerts.
        """
        now_dt = datetime.now(timezone.utc)
        iso_now = now_dt.isoformat()
        event_id = f"EVT-MOB-{uuid.uuid4().hex[:10].upper()}"

        # 1. Fetch current device GPS reading and calculate location timing (Section 17)
        loc_info = mobile_manager.get_device_location(device_id)
        loc_status = loc_info.get("status", "UNAVAILABLE")
        loc_age = loc_info.get("location_age_seconds")

        # Distinguish device_location vs vehicle_observation_location (Section 34)
        if loc_status in ["AVAILABLE", "VALID"] and loc_info.get("latitude") is not None:
            device_loc = {
                "latitude": loc_info["latitude"],
                "longitude": loc_info["longitude"],
                "accuracy_meters": loc_info.get("accuracy_meters"),
                "timestamp": loc_info.get("timestamp") or iso_now,
                "source": loc_info.get("source", "mobile_device_gps"),
                "status": "VALID"
            }
            vehicle_obs_loc_desc = f"Mobile Device GPS ({device_loc['latitude']:.4f}, {device_loc['longitude']:.4f} ±{device_loc['accuracy_meters'] or 10}m)"
        else:
            device_loc = {
                "latitude": None,
                "longitude": None,
                "accuracy_meters": None,
                "source": "mobile_device_gps",
                "status": loc_status  # PERMISSION_DENIED, STALE, UNAVAILABLE
            }
            vehicle_obs_loc_desc = f"Mobile Field Unit {device_id} (GPS: {loc_status})"

        # 2. Check Directories & Compliance
        from app.services.compliance.providers.demo_vehicle_provider import demo_vehicle_provider
        blacklist_match = db.query(Blacklist).filter(
            Blacklist.plate == plate_number,
            Blacklist.status == "ACTIVE"
        ).first()

        compliance_dossier = demo_vehicle_provider.get_vehicle_details(plate_number)
        
        flag_type = "ANPR_CAPTURED"
        severity = "NORMAL"
        reason = "Standard vehicle flow"
        alert_needed = False

        if blacklist_match:
            flag_type = "WATCHLIST_MATCH"
            severity = getattr(blacklist_match, "severity", "CRITICAL") or "CRITICAL"
            reason = f"Directory Watchlist: {blacklist_match.reason}"
            alert_needed = True
        elif compliance_dossier:
            c_status = compliance_dossier.get("compliance_status")
            if c_status in ["ACTION_REQUIRED", "NON_COMPLIANT"]:
                flag_type = "COMPLIANCE_VIOLATION"
                severity = "HIGH"
                reason = "Document Compliance Infraction"
                alert_needed = True
            elif c_status == "REVIEW_REQUIRED":
                flag_type = "REVIEW_REQUIRED"
                severity = "MEDIUM"
                reason = "Review Recommended"

        # 3. Assemble production event document (Section 18)
        event_doc = {
            "event_id": event_id,
            "source_type": "mobile_camera",
            "source_mode": source_mode,
            "device_id": device_id,
            "plate_number": plate_number,
            "vehicle_type": vehicle_type,
            "plate_confidence": plate_confidence,
            "vehicle_detection_confidence": vehicle_confidence,
            "plate_detection_confidence": plate_det_confidence,
            "visual_validation_score": visual_validation_score,
            "tracking_id": tracking_id or f"TRK-{plate_number[-4:]}",
            "event_timestamp": iso_now,
            "device_location": device_loc,
            "location_timestamp": loc_info.get("timestamp"),
            "location_age_seconds": loc_age,
            "vehicle_observation_location": vehicle_obs_loc_desc,
            "flag_type": flag_type,
            "severity": severity,
            "reason": reason,
            "camera_frame": frame_url,
            "plate_crop": plate_crop_url,
            "vehicle_image": frame_url,
            "status": "CONFIRMED"
        }

        # 4. Persist to MongoDB collection 'mobile_anpr_events'
        try:
            db_sync = mongo_manager.get_sync_db()
            if db_sync is not None:
                db_sync["mobile_anpr_events"].insert_one(dict(event_doc))
        except Exception as me:
            logger.warning(f"[MobileEventService] Note on MongoDB persistence: {me}")

        # In-memory circular cache
        self.memory_events_cache.insert(0, event_doc)
        if len(self.memory_events_cache) > 200:
            self.memory_events_cache.pop()

        # 5. Persist to SQL (PlateObservation, EvidenceRecord, Alert, Violation)
        dev = db.query(MobileDevice).filter(MobileDevice.device_id == device_id).first()
        cam_id = dev.camera_id if dev and dev.camera_id else 1
        loc_str = dev.assigned_location if dev and dev.assigned_location else vehicle_obs_loc_desc

        try:
            obs = PlateObservation(
                plate_number=plate_number,
                camera_id=cam_id,
                location=loc_str,
                ocr_confidence=plate_confidence,
                plate_detection_confidence=plate_det_confidence,
                image_quality_score=visual_validation_score,
                temporal_consistency=1.0,
                final_confidence=plate_confidence,
                vehicle_type=vehicle_type,
                lane=1,
                direction="MOBILE_FIELD",
                global_vehicle_id=f"VEH-MOB-{plate_number[-4:]}",
                speed_kmh=0.0
            )
            db.add(obs)
            db.commit()
            db.refresh(obs)

            # Evidence Record
            rec_id = f"PHO-MOB-{now_dt.strftime('%Y%m%d_%H%M%S')}-{obs.id:03d}"
            evd = EvidenceRecord(
                record_id=rec_id,
                camera_id=cam_id,
                device_id=device_id,
                operator_id=dev.operator_id if dev else "OFFICER-FIELD",
                location=loc_str,
                plate_number=plate_number,
                vehicle_type=vehicle_type,
                timestamp=now_dt.replace(tzinfo=None),
                original_image=frame_url or "/storage/evidence/placeholder.jpg",
                vehicle_image=frame_url or "/storage/evidence/placeholder.jpg",
                ocr_confidence=plate_confidence,
                event_type=flag_type,
                notes=f"Mobile Patrol ANPR: {reason} (Device: {device_id}, GPS: {loc_status})",
                review_status="FLAGGED" if severity in ["CRITICAL", "HIGH"] else "VERIFIED"
            )
            db.add(evd)

            # Alert if applicable
            alert_obj = None
            if alert_needed:
                alert_obj = Alert(
                    type=flag_type,
                    severity=severity,
                    camera_id=cam_id,
                    location=loc_str,
                    vehicle_plate=plate_number,
                    message=f"MOBILE PATROL ANPR ALERT: Vehicle {plate_number} identified ({reason}).",
                    status="NEW",
                    confidence=plate_confidence
                )
                db.add(alert_obj)

            db.commit()

            # 6. WebSocket Real-Time Broadcast
            await ws_manager.broadcast({
                "event": "MOBILE_ANPR_EVENT",
                "data": event_doc
            })

            if alert_obj:
                await ws_manager.broadcast({
                    "event": "ALERT_CREATED",
                    "alert": {
                        "id": alert_obj.id,
                        "type": alert_obj.type,
                        "severity": alert_obj.severity,
                        "location": alert_obj.location,
                        "vehicle_plate": alert_obj.vehicle_plate,
                        "message": alert_obj.message,
                        "timestamp": alert_obj.timestamp.isoformat() if alert_obj.timestamp else iso_now
                    }
                })

        except Exception as sqle:
            db.rollback()
            logger.error(f"[MobileEventService] Error writing SQL records: {sqle}")

        return event_doc

    def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Queries recent mobile events from MongoDB Atlas with memory cache fallback."""
        try:
            db_sync = mongo_manager.get_sync_db()
            if db_sync is not None:
                cursor = db_sync["mobile_anpr_events"].find({}, {"_id": 0}).sort("event_timestamp", -1).limit(limit)
                events = list(cursor)
                if events:
                    return events
        except Exception as e:
            logger.debug(f"[MobileEventService] Query fallback: {e}")

        return self.memory_events_cache[:limit]

mobile_event_service = MobileEventService()
