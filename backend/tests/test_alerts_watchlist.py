import pytest
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database.session import SessionLocal, engine, Base
from app.models.models import Alert, Blacklist

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

def test_create_and_query_alerts(db_session: Session):
    # Create test alert
    alert = Alert(
        type="BLACKLIST_MATCH",
        severity="CRITICAL",
        location="Anna Salai Spencers Junction",
        vehicle_plate="KA05MN3821",
        message="Watchlisted Stolen Vehicle Detected",
        status="NEW",
        confidence=0.98
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)

    assert alert.id is not None
    assert alert.status == "NEW"

    # Query alert back
    fetched = db_session.query(Alert).filter(Alert.id == alert.id).first()
    assert fetched is not None
    assert fetched.vehicle_plate == "KA05MN3821"
    assert fetched.severity == "CRITICAL"

def test_update_alert_status_workflow(db_session: Session):
    alert = Alert(
        type="SPEEDING",
        severity="HIGH",
        location="Anna Salai Junction",
        vehicle_plate="TN01AB1234",
        message="Excessive Speeding Detected",
        status="NEW",
        confidence=0.90
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)

    # Transition NEW -> ACKNOWLEDGED
    alert.status = "ACKNOWLEDGED"
    db_session.commit()
    assert alert.status == "ACKNOWLEDGED"

    # Transition ACKNOWLEDGED -> RESOLVED
    alert.status = "RESOLVED"
    db_session.commit()
    assert alert.status == "RESOLVED"

def test_blacklist_watchlist_creation(db_session: Session):
    unique_plate = f"STOLEN{uuid.uuid4().hex[:6].upper()}"
    bl = Blacklist(
        plate=unique_plate,
        reason="Stolen SUV Alert",
        created_by="admin",
        status="ACTIVE",
        notes="High priority watch"
    )
    db_session.add(bl)
    db_session.commit()
    db_session.refresh(bl)

    assert bl.id is not None
    assert bl.plate == unique_plate
    assert bl.status == "ACTIVE"

    # Verify lookup
    found = db_session.query(Blacklist).filter(Blacklist.plate == unique_plate).first()
    assert found is not None
