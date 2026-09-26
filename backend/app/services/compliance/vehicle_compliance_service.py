import os
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session

from app.database.mongodb import mongo_manager
from app.database.session import SessionLocal
from app.models.models import Alert, EvidenceRecord, PlateObservation, Camera
from app.websocket.manager import ws_manager
from .providers.vehicle_data_provider import VehicleDataProvider
from .providers.demo_vehicle_provider import demo_vehicle_provider
from .providers.parivahan_provider import AuthorizedParivahanProvider

logger = logging.getLogger(__name__)

class VehicleComplianceService:
    """
    Core AI-based automated vehicle compliance verification engine.
    Orchestrates plate normalization, provider lookup, date arithmetic,
    overall compliance scoring, passage cooldown, prioritized alert creation,
    evidence linkage, and real-time WebSocket notifications.
    """

    def __init__(self):
        self.provider_mode = os.environ.get("VEHICLE_DATA_PROVIDER", "demo").lower()
        self.anpr_min_confidence = float(os.environ.get("ANPR_MIN_CONFIDENCE", "0.85"))
        self.doc_warning_days = int(os.environ.get("DOCUMENT_EXPIRY_WARNING_DAYS", "30"))
        self.cooldown_seconds = int(os.environ.get("VEHICLE_VERIFICATION_COOLDOWN_SECONDS", "60"))

        # Initialize providers
        self.demo_provider = demo_vehicle_provider
        self.parivahan_provider = AuthorizedParivahanProvider()

        # Cooldown tracker: (clean_plate, camera_id) -> (timestamp, verification_result)
        self._cooldown_cache: Dict[Tuple[str, int], Tuple[datetime, Dict[str, Any]]] = {}

        # In-memory passage and verification history fallbacks
        self._passage_history: List[Dict[str, Any]] = []
        self._verification_history: Dict[str, List[Dict[str, Any]]] = {}

    def get_active_provider(self) -> VehicleDataProvider:
        if self.provider_mode == "parivahan" and self.parivahan_provider.is_configured():
            return self.parivahan_provider
        return self.demo_provider

    def get_provider_status(self) -> Dict[str, Any]:
        provider = self.get_active_provider()
        return {
            "mode": self.provider_mode,
            "anpr_min_confidence": self.anpr_min_confidence,
            "document_expiry_warning_days": self.doc_warning_days,
            "cooldown_seconds": self.cooldown_seconds,
            "active_provider_details": provider.get_provider_status(),
            "demo_provider_status": self.demo_provider.get_provider_status(),
            "parivahan_provider_status": self.parivahan_provider.get_provider_status()
        }

    def normalize_plate(self, raw_plate: str) -> str:
        """Standardizes registration numbers by removing punctuation, spaces, and converting to uppercase."""
        if not raw_plate:
            return ""
        return raw_plate.upper().replace(" ", "").replace("-", "").replace(".", "").replace("/", "").strip()

    def _evaluate_date_status(self, valid_until_str: Optional[str], current_date: date) -> Tuple[str, Optional[str]]:
        """
        Backend date comparison against current date.
        Returns (status, valid_until_str) where status in ['VALID', 'EXPIRING_SOON', 'EXPIRED', 'NOT_APPLICABLE']
        """
        if not valid_until_str:
            return ("NOT_APPLICABLE", None)

        try:
            # Handle ISO timestamp or YYYY-MM-DD
            clean_date_str = valid_until_str.split("T")[0]
            doc_date = datetime.strptime(clean_date_str, "%Y-%m-%d").date()

            if doc_date < current_date:
                return ("EXPIRED", clean_date_str)
            elif doc_date - current_date <= timedelta(days=self.doc_warning_days):
                return ("EXPIRING_SOON", clean_date_str)
            else:
                return ("VALID", clean_date_str)
        except Exception as e:
            logger.warning(f"[VehicleComplianceService] Date parsing failed for '{valid_until_str}': {e}")
            return ("VALID", valid_until_str)

    async def verify_vehicle_passage(
        self,
        plate_number: str,
        camera_id: int = 0,
        junction_id: Optional[int] = None,
        approach_id: Optional[str] = None,
        anpr_confidence: float = 0.95,
        vehicle_type: str = "car",
        evidence_image_url: Optional[str] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Executes automated vehicle compliance verification for a vehicle passage event.
        Returns structured verification outcome and dispatches alerts when action is required.
        """
        clean_plate = self.normalize_plate(plate_number)
        now_dt = datetime.now(timezone.utc)
        current_date = now_dt.date()
        cooldown_key = (clean_plate, camera_id)

        # 1. Check Cooldown to avoid duplicate alerts for the same visible vehicle track
        if cooldown_key in self._cooldown_cache:
            last_time, cached_result = self._cooldown_cache[cooldown_key]
            if (now_dt - last_time).total_seconds() < self.cooldown_seconds:
                logger.debug(f"[VehicleComplianceService] Cooldown active for {clean_plate} at Cam #{camera_id}")
                return cached_result

        # 2. Check ANPR Confidence Threshold
        if anpr_confidence < self.anpr_min_confidence:
            unclear_result = {
                "vehicle_number": clean_plate or plate_number,
                "verification_status": "ANPR_UNCLEAR",
                "compliance_status": "DATA_UNAVAILABLE",
                "action_required": False,
                "message": "Plate unclear — manual review required.",
                "anpr_confidence": anpr_confidence,
                "verified_at": now_dt.isoformat()
            }
            return unclear_result

        # 3. Retrieve vehicle records from active provider (Demo or Parivahan with fallback)
        provider = self.get_active_provider()
        vehicle_raw = provider.get_vehicle_details(clean_plate)

        # Resilient fallback: if Parivahan is active but returns no data or fails, query Demo registry
        if not vehicle_raw and provider != self.demo_provider:
            logger.info(
                "[VehicleComplianceService] Primary provider returned no data for %s; attempting fallback to Demo provider.",
                clean_plate,
            )
            vehicle_raw = self.demo_provider.get_vehicle_details(clean_plate)

        # Handle provider failure or unregistered plate
        if not vehicle_raw:
            data_unavailable_result = {
                "vehicle_number": clean_plate,
                "source": "UNKNOWN",
                "verification_status": "UNREGISTERED_OR_UNAVAILABLE",
                "compliance_status": "DATA_UNAVAILABLE",
                "action_required": False,
                "message": "Vehicle record not found or provider data unavailable.",
                "verified_at": now_dt.isoformat(),
                "rc": {"status": "DATA_UNAVAILABLE", "valid_until": None},
                "insurance": {"status": "DATA_UNAVAILABLE", "provider": "Unknown", "valid_until": None},
                "puc": {"status": "DATA_UNAVAILABLE", "valid_until": None},
                "fitness": {"status": "DATA_UNAVAILABLE", "valid_until": None},
                "permit": None,
                "watchlist": {"matched": False, "reference": None, "reason": None}
            }
            return data_unavailable_result

        # 4. Evaluate individual document statuses using actual backend dates
        rc_info = vehicle_raw.get("rc", {})
        rc_status, rc_date = self._evaluate_date_status(rc_info.get("valid_until"), current_date)
        if vehicle_raw.get("registration_status") in ["SUSPENDED", "CANCELLED"]:
            rc_status = vehicle_raw.get("registration_status")

        ins_info = vehicle_raw.get("insurance", {})
        ins_status, ins_date = self._evaluate_date_status(ins_info.get("valid_until"), current_date)

        puc_info = vehicle_raw.get("puc", {})
        puc_status, puc_date = self._evaluate_date_status(puc_info.get("valid_until"), current_date)

        fit_info = vehicle_raw.get("fitness", {})
        fit_status, fit_date = self._evaluate_date_status(fit_info.get("valid_until"), current_date)

        permit_info = vehicle_raw.get("permit")
        permit_status = None
        permit_date = None
        if permit_info:
            permit_status, permit_date = self._evaluate_date_status(permit_info.get("valid_until"), current_date)

        watchlist_info = vehicle_raw.get("watchlist", {"matched": False})
        watchlist_matched = bool(watchlist_info.get("matched"))

        # 5. Determine Overall Compliance Status
        generated_alerts: List[Dict[str, Any]] = []
        action_required = False
        compliance_status = "COMPLIANT"

        # Check for expired documents (Action Required)
        if ins_status == "EXPIRED":
            action_required = True
            compliance_status = "ACTION_REQUIRED"
            generated_alerts.append({
                "type": "INSURANCE_EXPIRED",
                "severity": "MEDIUM",
                "title": "INSURANCE EXPIRED",
                "message": f"Vehicle {clean_plate} has expired insurance policy ({ins_info.get('provider', 'Insurer')}). Expired on {ins_date}."
            })

        if puc_status == "EXPIRED":
            action_required = True
            compliance_status = "ACTION_REQUIRED"
            generated_alerts.append({
                "type": "PUC_EXPIRED",
                "severity": "MEDIUM",
                "title": "PUC CERTIFICATE EXPIRED",
                "message": f"Vehicle {clean_plate} has expired Pollution Under Control (PUC) certificate. Expired on {puc_date}."
            })

        if fit_status == "EXPIRED":
            action_required = True
            compliance_status = "ACTION_REQUIRED"
            generated_alerts.append({
                "type": "FITNESS_EXPIRED",
                "severity": "MEDIUM",
                "title": "FITNESS CERTIFICATE EXPIRED",
                "message": f"Vehicle {clean_plate} has expired vehicle fitness certificate. Expired on {fit_date}."
            })

        if rc_status in ["EXPIRED", "SUSPENDED", "CANCELLED"]:
            action_required = True
            compliance_status = "ACTION_REQUIRED"
            generated_alerts.append({
                "type": "RC_STATUS_ISSUE",
                "severity": "HIGH",
                "title": f"RC {rc_status}",
                "message": f"Vehicle {clean_plate} registration certificate is {rc_status}. Valid until: {rc_date}."
            })

        # Check Watchlist Match (Review Required)
        if watchlist_matched:
            action_required = True
            compliance_status = "REVIEW_REQUIRED"
            generated_alerts.append({
                "type": "WATCHLIST_MATCH",
                "severity": "HIGH",
                "title": "AUTHORIZED WATCHLIST MATCH",
                "message": f"Authorized watchlist match for vehicle {clean_plate}. Reason: {watchlist_info.get('reason', 'Flagged in law enforcement hotlist')}. (AI DETECTION — Officer review required)"
            })

        # Check Expiring Soon (Warning / Low Severity alert)
        if not action_required:
            expiring_docs = []
            if ins_status == "EXPIRING_SOON":
                expiring_docs.append(f"Insurance ({ins_date})")
            if puc_status == "EXPIRING_SOON":
                expiring_docs.append(f"PUC ({puc_date})")
            if fit_status == "EXPIRING_SOON":
                expiring_docs.append(f"Fitness ({fit_date})")

            if expiring_docs:
                generated_alerts.append({
                    "type": "DOCUMENT_EXPIRING_SOON",
                    "severity": "LOW",
                    "title": "DOCUMENT EXPIRING SOON",
                    "message": f"Vehicle {clean_plate} has documents expiring within {self.doc_warning_days} days: {', '.join(expiring_docs)}."
                })

        # 6. Build Consolidated Verification Record
        verification_id = f"VERIF-{clean_plate}-{int(now_dt.timestamp())}"
        passage_id = f"PASS-{clean_plate}-{int(now_dt.timestamp())}"

        verification_record = {
            "verification_id": verification_id,
            "passage_id": passage_id,
            "vehicle_number": clean_plate,
            "source": vehicle_raw.get("source", "DEMO_VEHICLE_REGISTRY"),
            "data_source_label": "DEMO VEHICLE REGISTRY (Fictional Data)" if vehicle_raw.get("source") == "DEMO_VEHICLE_REGISTRY" else "AUTHORIZED PARIVAHAN GATEWAY",
            "registration_status": vehicle_raw.get("registration_status", "ACTIVE"),
            "vehicle_class": vehicle_raw.get("vehicle_class", "LMV"),
            "manufacturer": vehicle_raw.get("manufacturer", "GENERIC"),
            "model": vehicle_raw.get("model", "SEDAN"),
            "registration_date": vehicle_raw.get("registration_date"),
            "fuel_type": vehicle_raw.get("fuel_type", "PETROL"),
            "rc": {
                "status": rc_status,
                "valid_until": rc_date
            },
            "insurance": {
                "status": ins_status,
                "provider": ins_info.get("provider", "Unknown Insurer"),
                "policy_number": ins_info.get("policy_number", "N/A"),
                "valid_until": ins_date
            },
            "puc": {
                "status": puc_status,
                "valid_until": puc_date
            },
            "fitness": {
                "status": fit_status,
                "valid_until": fit_date
            },
            "permit": {
                "status": permit_status,
                "permit_type": permit_info.get("permit_type", "STANDARD") if permit_info else None,
                "valid_until": permit_date
            } if permit_info else None,
            "watchlist": {
                "matched": watchlist_matched,
                "reference": watchlist_info.get("reference"),
                "reason": watchlist_info.get("reason")
            },
            "compliance_status": compliance_status,
            "action_required": action_required,
            "alerts": generated_alerts,
            "camera_id": camera_id,
            "junction_id": junction_id,
            "approach_id": approach_id,
            "anpr_confidence": anpr_confidence,
            "verified_at": now_dt.isoformat(),
            "owner_reference": vehicle_raw.get("owner_reference"),
            "authorized_owner_display_name": vehicle_raw.get("authorized_owner_display_name", "Protected Owner"),
            "evidence_image_url": evidence_image_url or "/videos/sample_traffic_urban.mp4"
        }

        # 7. Persist to MongoDB collections (with memory cache fallback)
        try:
            db_sync = mongo_manager.get_sync_db()
            if db_sync is not None:
                db_sync["vehicle_verifications"].insert_one({**verification_record, "created_at": now_dt})
                db_sync["vehicle_passages"].insert_one({
                    "passage_id": passage_id,
                    "verification_id": verification_id,
                    "vehicle_number": clean_plate,
                    "camera_id": camera_id,
                    "junction_id": junction_id,
                    "approach_id": approach_id,
                    "timestamp": now_dt,
                    "plate_confidence": anpr_confidence,
                    "vehicle_type": vehicle_type,
                    "compliance_status": compliance_status,
                    "alert_count": len(generated_alerts),
                    "created_at": now_dt
                })
        except Exception as e:
            logger.debug(f"[VehicleComplianceService] MongoDB write note: {e}")

        # In-memory history tracking
        self._passage_history.append(verification_record)
        if clean_plate not in self._verification_history:
            self._verification_history[clean_plate] = []
        self._verification_history[clean_plate].append(verification_record)

        # 8. Create Database Alert in SQL if action is required
        created_alert_ids = []
        close_db_session = False
        if action_required and generated_alerts:
            session = db
            if session is None:
                session = SessionLocal()
                close_db_session = True

            try:
                for a in generated_alerts:
                    alert_obj = Alert(
                        type=a["type"],
                        severity=a["severity"],
                        camera_id=camera_id if camera_id > 0 else None,
                        location=f"Junction #{junction_id or 'Demo'} Approach {approach_id or 'Main'}",
                        vehicle_plate=clean_plate,
                        message=a["message"],
                        status="NEW",
                        confidence=anpr_confidence
                    )
                    session.add(alert_obj)
                    session.commit()
                    session.refresh(alert_obj)
                    created_alert_ids.append(alert_obj.id)

                    # Persist Evidence Record into RECORDS
                    evidence_rec = EvidenceRecord(
                        record_id=f"EVID-{clean_plate}-{alert_obj.id}",
                        camera_id=camera_id if camera_id > 0 else None,
                        device_id="FIXED-CCTV" if camera_id > 0 else "MOBILE-PATROL",
                        operator_id="VIGITRA-AI-COMPLIANCE",
                        location=f"Junction #{junction_id or 'Demo'} Approach {approach_id or 'Main'}",
                        plate_number=clean_plate,
                        ocr_confidence=anpr_confidence,
                        vehicle_type=vehicle_type,
                        event_type=a["type"],
                        alert_id=alert_obj.id,
                        original_image=evidence_image_url or "/videos/sample_traffic_urban.mp4",
                        vehicle_image=evidence_image_url or "/videos/sample_traffic_urban.mp4",
                        review_status="PENDING",
                        notes=f"AI DETECTION — {a['title']} (Verification ID: {verification_id})"
                    )
                    session.add(evidence_rec)
                    session.commit()

                    # Broadcast Real-Time Alert to WebSocket clients
                    await ws_manager.broadcast({
                        "event": "ALERT_CREATED",
                        "alert": {
                            "id": alert_obj.id,
                            "type": alert_obj.type,
                            "severity": alert_obj.severity,
                            "location": alert_obj.location,
                            "vehicle_plate": alert_obj.vehicle_plate,
                            "message": alert_obj.message,
                            "timestamp": alert_obj.timestamp.isoformat()
                        }
                    })
            except Exception as e:
                logger.error(f"[VehicleComplianceService] Failed to persist alert: {e}")
                if session:
                    session.rollback()
            finally:
                if close_db_session and session:
                    session.close()

        verification_record["created_alert_ids"] = created_alert_ids

        # 9. Broadcast Compliance Verified event to WebSockets (for Live Signal Overlay & ANPR page)
        await ws_manager.broadcast({
            "event": "VEHICLE_COMPLIANCE_VERIFIED",
            "verification": {
                "verification_id": verification_id,
                "vehicle_number": clean_plate,
                "compliance_status": compliance_status,
                "action_required": action_required,
                "camera_id": camera_id,
                "junction_id": junction_id,
                "approach_id": approach_id,
                "anpr_confidence": anpr_confidence,
                "primary_issue": generated_alerts[0]["title"] if generated_alerts else "All Documents Valid",
                "rc_status": rc_status,
                "insurance_status": ins_status,
                "puc_status": puc_status,
                "fitness_status": fit_status,
                "timestamp": now_dt.isoformat()
            }
        })

        # 10. Update Cooldown Cache
        self._cooldown_cache[cooldown_key] = (now_dt, verification_record)

        return verification_record

    def get_vehicle_history(self, vehicle_number: str) -> List[Dict[str, Any]]:
        """Returns all recorded verification sightings for a vehicle plate."""
        clean_plate = self.normalize_plate(vehicle_number)
        return self._verification_history.get(clean_plate, [])

    def get_recent_passages(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns recent vehicle passage events across all cameras."""
        return list(reversed(self._passage_history[-limit:]))

vehicle_compliance_service = VehicleComplianceService()
