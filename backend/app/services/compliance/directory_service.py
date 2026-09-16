import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.models import Blacklist, Alert, PlateObservation, Violation
from app.services.compliance.providers.demo_vehicle_provider import demo_vehicle_provider

logger = logging.getLogger("VIGITRA.DirectoryService")

class DirectoryService:
    """
    Centralized Number Plate Directory Management & Automatic Alerting Service.
    Cross-checks scanned plates against Stolen Vehicles, Security Watchlist,
    Challan/Impound Defaulters, Compliance Flags, and VIP Whitelist directories.
    """

    @staticmethod
    def normalize_plate(plate: str) -> str:
        if not plate:
            return ""
        return plate.upper().replace(" ", "").replace("-", "").strip()

    @classmethod
    async def check_plate_in_directories(
        cls,
        plate_number: str,
        db: Session,
        camera_id: Optional[int] = 1,
        location: Optional[str] = "Main Surveillance Junction",
        source: str = "MANUAL_SCAN",
        confidence: float = 0.95,
        auto_create_alert: bool = True
    ) -> Dict[str, Any]:
        """
        Scans and cross-references a plate against all active directories and RTO compliance.
        If a match is found and auto_alert is enabled, automatically creates an Alert and
        broadcasts it to connected dashboards in real time.
        """
        clean_plate = cls.normalize_plate(plate_number)
        if not clean_plate:
            return {
                "plate_number": "",
                "detected_via": source,
                "confidence": 0.0,
                "directory_matched": False,
                "matched_directory_type": None,
                "severity": "NORMAL",
                "match_reason": "No plate number provided",
                "directory_entry": None,
                "compliance_details": None,
                "alert_triggered": False,
                "alert": None,
                "recommended_action": "NO_ACTION",
                "scan_timestamp": datetime.now(timezone.utc).isoformat(),
                "sightings_count": 0
            }

        # 1. Query Active Directory Records (Stolen, Watchlist, Defaulters, Compliance, Whitelist)
        directory_match = db.query(Blacklist).filter(
            Blacklist.plate == clean_plate,
            Blacklist.status == "ACTIVE"
        ).first()

        # 2. Query RTO Vehicle Compliance Details
        compliance_dossier = demo_vehicle_provider.get_vehicle_details(clean_plate)

        # 3. Query Past Sightings & Unpaid Violations
        past_sightings_count = db.query(PlateObservation).filter(
            PlateObservation.plate_number == clean_plate
        ).count() + 1

        unpaid_violations = db.query(Violation).filter(
            Violation.license_plate == clean_plate,
            Violation.status == "UNPAID"
        ).all()
        unpaid_count = len(unpaid_violations)

        # 4. Determine Match Findings, Directory Type & Threat Severity
        directory_matched = False
        matched_type = None
        severity = "NORMAL"
        match_reason = "Standard vehicle flow - No directory flags"
        recommended_action = "CONTINUE_MONITORING"
        entry_dict = None
        should_alert = False

        if directory_match:
            directory_matched = True
            matched_type = getattr(directory_match, "directory_type", "SECURITY_WATCHLIST") or "SECURITY_WATCHLIST"
            severity = getattr(directory_match, "severity", "CRITICAL") or "CRITICAL"
            match_reason = directory_match.reason or "Active surveillance flag"
            should_alert = bool(getattr(directory_match, "auto_alert", True)) and auto_create_alert

            # Tailor recommended action based on directory category
            if matched_type == "STOLEN_VEHICLES":
                recommended_action = "IMMEDIATE_POLICE_INTERCEPT"
                match_reason = f"🚨 STOLEN VEHICLE: {directory_match.reason}"
                if getattr(directory_match, "fir_number", None):
                    match_reason += f" (FIR: {directory_match.fir_number})"
            elif matched_type == "SECURITY_WATCHLIST":
                recommended_action = "DISPATCH_PATROL_UNIT"
                match_reason = f"🛡️ SECURITY WATCHLIST: {directory_match.reason}"
            elif matched_type == "CHALLAN_DEFAULTER":
                recommended_action = "ISSUE_IMPOUND_NOTICE"
                match_reason = f"⚠️ IMPOUND / CHALLAN DEFAULTER: {directory_match.reason}"
            elif matched_type == "VIP_WHITELIST":
                severity = "LOW"
                recommended_action = "PRIORITY_GREEN_CORRIDOR"
                match_reason = f"🟢 VIP / EMERGENCY WHITELIST: {directory_match.reason}"
                should_alert = False  # Whitelisted vehicles do not trigger alert sirens
            elif matched_type == "RTO_COMPLIANCE":
                recommended_action = "ISSUE_AUTOMATED_CHALLAN"
                match_reason = f"📋 RTO COMPLIANCE FLAG: {directory_match.reason}"

            entry_dict = {
                "id": directory_match.id,
                "plate": directory_match.plate,
                "directory_type": matched_type,
                "severity": severity,
                "reason": directory_match.reason,
                "vehicle_model": getattr(directory_match, "vehicle_model", None),
                "owner_name": getattr(directory_match, "owner_name", None),
                "fir_number": getattr(directory_match, "fir_number", None),
                "police_station": getattr(directory_match, "police_station", None),
                "auto_alert": getattr(directory_match, "auto_alert", True),
                "status": directory_match.status,
                "created_by": directory_match.created_by,
                "created_at": directory_match.created_at.isoformat() if directory_match.created_at else None,
                "notes": directory_match.notes
            }

            # Update directory scan statistics
            try:
                directory_match.scan_count = (getattr(directory_match, "scan_count", 0) or 0) + 1
                directory_match.last_scanned_at = datetime.now(timezone.utc).replace(tzinfo=None)
                db.commit()
            except Exception as e:
                db.rollback()
                logger.warning(f"Error updating directory scan stats: {e}")

        elif compliance_dossier:
            # Check for compliance infractions if not in explicit directory
            c_status = compliance_dossier.get("compliance_status")
            if c_status in ["ACTION_REQUIRED", "NON_COMPLIANT"]:
                directory_matched = True
                matched_type = "RTO_COMPLIANCE"
                severity = "HIGH"
                expired_items = []
                for k in ["insurance", "puc", "fitness", "rc"]:
                    doc = compliance_dossier.get(k)
                    if isinstance(doc, dict) and doc.get("status") in ["EXPIRED", "ACTION_REQUIRED"]:
                        expired_items.append(f"{k.upper()} Expired")
                match_reason = f"RTO Compliance Violation: {', '.join(expired_items) if expired_items else 'Unverified Docs'}"
                recommended_action = "ISSUE_AUTOMATED_CHALLAN"
                should_alert = auto_create_alert
            elif c_status == "REVIEW_REQUIRED":
                directory_matched = True
                matched_type = "RTO_COMPLIANCE"
                severity = "MEDIUM"
                match_reason = "RTO Compliance Flagged for Operator Verification"
                recommended_action = "MANUAL_OPERATOR_REVIEW"
                should_alert = auto_create_alert
        elif unpaid_count >= 5:
            # Unregistered repeat violator
            directory_matched = True
            matched_type = "CHALLAN_DEFAULTER"
            severity = "HIGH"
            match_reason = f"Challan Defaulter: {unpaid_count} Unpaid Fines on Record"
            recommended_action = "FLAG_FOR_INTERCEPT"
            should_alert = auto_create_alert

        # 5. Automatically Create Alert in Database & Broadcast if Triggered
        alert_dict = None
        alert_triggered = False

        if should_alert:
            alert_type = matched_type or "WATCHLIST_MATCH"
            alert_msg = f"{match_reason} — Identified at {location}. Action: {recommended_action}"

            try:
                alert_obj = Alert(
                    type=alert_type,
                    severity=severity if severity != "NORMAL" else "HIGH",
                    camera_id=camera_id,
                    location=location,
                    vehicle_plate=clean_plate,
                    message=alert_msg,
                    status="NEW",
                    confidence=confidence
                )
                db.add(alert_obj)
                db.commit()
                db.refresh(alert_obj)

                alert_triggered = True
                alert_dict = {
                    "id": alert_obj.id,
                    "type": alert_obj.type,
                    "severity": alert_obj.severity,
                    "location": alert_obj.location,
                    "vehicle_plate": alert_obj.vehicle_plate,
                    "message": alert_obj.message,
                    "status": alert_obj.status,
                    "confidence": alert_obj.confidence,
                    "timestamp": alert_obj.timestamp.isoformat() if alert_obj.timestamp else datetime.now(timezone.utc).isoformat()
                }

                # Real-time WebSocket Broadcast to Control Room & Mobile Patrol
                from app.websocket.manager import ws_manager
                await ws_manager.broadcast({
                    "event": "ALERT_CREATED",
                    "alert": alert_dict,
                    "directory_matched": True,
                    "matched_directory_type": matched_type
                })

                await ws_manager.broadcast({
                    "event": "PLATE_SCANNED_MATCH",
                    "plate_number": clean_plate,
                    "directory_type": matched_type,
                    "severity": severity,
                    "location": location,
                    "reason": match_reason,
                    "alert_id": alert_obj.id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            except Exception as ae:
                db.rollback()
                logger.error(f"Failed to auto-create alert for plate {clean_plate}: {ae}")

        # 6. Record Plate Observation for Trajectory Tracking
        try:
            obs = PlateObservation(
                plate_number=clean_plate,
                camera_id=camera_id or 1,
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
                ocr_confidence=confidence,
                plate_detection_confidence=0.95,
                image_quality_score=0.92,
                temporal_consistency=1.0,
                final_confidence=confidence,
                vehicle_type=(compliance_dossier.get("vehicle_type") if compliance_dossier else "car") or "car",
                lane=1,
                direction="SCANNED_CHECK",
                global_vehicle_id=f"VEH-DIR-{clean_plate[-4:]}",
                speed_kmh=35.0
            )
            db.add(obs)
            db.commit()
        except Exception as oe:
            db.rollback()
            logger.warning(f"Note on plate observation logging: {oe}")

        return {
            "plate_number": clean_plate,
            "detected_via": source,
            "confidence": confidence,
            "directory_matched": directory_matched,
            "matched_directory_type": matched_type,
            "severity": severity,
            "match_reason": match_reason,
            "directory_entry": entry_dict,
            "compliance_details": compliance_dossier,
            "alert_triggered": alert_triggered,
            "alert": alert_dict,
            "recommended_action": recommended_action,
            "scan_timestamp": datetime.now(timezone.utc).isoformat(),
            "sightings_count": past_sightings_count
        }

directory_service = DirectoryService()
