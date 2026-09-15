import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import User, Alert, EvidenceRecord, AuditLog
from app.api.deps import require_role
from app.services.compliance.vehicle_compliance_service import vehicle_compliance_service
from app.services.compliance.providers.demo_vehicle_provider import demo_vehicle_provider

logger = logging.getLogger(__name__)

router = APIRouter()

class PassageVerifyInput(BaseModel):
    vehicle_number: str
    camera_id: Optional[int] = 0
    junction_id: Optional[int] = None
    approach_id: Optional[str] = None
    anpr_confidence: Optional[float] = 0.95
    vehicle_type: Optional[str] = "car"
    evidence_image_url: Optional[str] = None

@router.post("/verify", status_code=status.HTTP_200_OK)
async def verify_vehicle_passage(
    input_data: PassageVerifyInput,
    db: Session = Depends(get_db)
):
    """
    Asynchronously checks vehicle compliance (RC, Insurance, PUC, Fitness, Watchlist)
    upon junction crossing. Stores passage & verification records, creates prioritized
    alerts if action is required, and notifies desktop control rooms in real-time.
    """
    result = await vehicle_compliance_service.verify_vehicle_passage(
        plate_number=input_data.vehicle_number,
        camera_id=input_data.camera_id or 0,
        junction_id=input_data.junction_id,
        approach_id=input_data.approach_id,
        anpr_confidence=input_data.anpr_confidence or 0.95,
        vehicle_type=input_data.vehicle_type or "car",
        evidence_image_url=input_data.evidence_image_url,
        db=db
    )
    return result

@router.get("/vehicle/{vehicle_number}")
def get_vehicle_compliance_dossier(
    vehicle_number: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves full compliance dossier, individual document status, and date comparisons
    for an authorized vehicle search. Clearly labels source as DEMO or AUTHORIZED.
    """
    clean_plate = vehicle_compliance_service.normalize_plate(vehicle_number)
    provider = vehicle_compliance_service.get_active_provider()
    raw_details = provider.get_vehicle_details(clean_plate)

    if not raw_details:
        return {
            "vehicle_number": clean_plate,
            "source": "UNKNOWN",
            "compliance_status": "DATA_UNAVAILABLE",
            "message": "Vehicle registration not found in registry.",
            "data_source_label": "DATA UNAVAILABLE"
        }

    # Audit log entry for authorized vehicle record access
    try:
        audit = AuditLog(
            user_id=1,
            username="AUTHORIZED_OPERATOR",
            action="VEHICLE_COMPLIANCE_VIEW",
            details=f"Compliance check for plate '{clean_plate}' via {raw_details.get('source')}"
        )
        db.add(audit)
        db.commit()
    except Exception:
        pass

    return raw_details

@router.get("/vehicle/{vehicle_number}/history")
def get_vehicle_passage_history(vehicle_number: str):
    """Returns chronologically ordered junction crossing events for this plate."""
    return vehicle_compliance_service.get_vehicle_history(vehicle_number)

@router.get("/vehicle/{vehicle_number}/alerts")
def get_vehicle_compliance_alerts(vehicle_number: str, db: Session = Depends(get_db)):
    """Returns all compliance and watchlist alerts linked to this vehicle number."""
    clean_plate = vehicle_compliance_service.normalize_plate(vehicle_number)
    alerts = db.query(Alert).filter(Alert.vehicle_plate.like(f"%{clean_plate}%")).order_by(Alert.timestamp.desc()).all()
    return alerts

@router.get("/vehicle/{vehicle_number}/records")
def get_vehicle_compliance_records(vehicle_number: str, db: Session = Depends(get_db)):
    """Returns stored photo and video evidence records linked to this plate in RECORDS."""
    clean_plate = vehicle_compliance_service.normalize_plate(vehicle_number)
    records = db.query(EvidenceRecord).filter(EvidenceRecord.plate_number.like(f"%{clean_plate}%")).order_by(EvidenceRecord.timestamp.desc()).all()
    return records

@router.get("/passages/recent")
def get_recent_passages(limit: int = 50):
    """Returns recent verified vehicle passage events across all cameras."""
    return vehicle_compliance_service.get_recent_passages(limit)

@router.get("/provider/status")
def get_provider_configuration_status():
    """Returns current active vehicle data provider mode, thresholds, and connectivity status."""
    return vehicle_compliance_service.get_provider_status()

@router.post("/seed-demo-registry")
def seed_demo_vehicle_registry():
    """Forces re-seeding of fictional demo vehicles (TNXX1001-TNXX1005) into the registry."""
    count = demo_vehicle_provider.seed_registry()
    return {
        "status": "SUCCESS",
        "message": f"Demo Vehicle Registry seeded successfully with {count} fictional demonstration records.",
        "vehicles": ["TNXX1001", "TNXX1002", "TNXX1003", "TNXX1004", "TNXX1005"]
    }
