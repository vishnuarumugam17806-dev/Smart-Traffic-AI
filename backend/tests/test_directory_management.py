import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database.session import SessionLocal, engine, Base
from app.models.models import Alert, Blacklist

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

def test_seed_directories():
    """Test seeding multi-category directories."""
    res = client.post("/api/v1/anpr/directories/seed")
    assert res.status_code == 200
    data = res.json()
    assert "total_records" in data
    assert data["total_records"] >= 9

def test_get_directories_filtered():
    """Test querying directories with category filter."""
    res = client.get("/api/v1/anpr/directories?directory_type=STOLEN_VEHICLES")
    assert res.status_code == 200
    stolen = res.json()
    assert len(stolen) >= 1
    assert all(item["directory_type"] == "STOLEN_VEHICLES" for item in stolen)

def test_add_and_update_directory_entry():
    """Test creating and updating a directory vehicle."""
    test_plate = f"TN09TEST{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "plate": test_plate,
        "reason": "Test armed robbery getaway vehicle",
        "directory_type": "STOLEN_VEHICLES",
        "severity": "CRITICAL",
        "vehicle_model": "Honda Civic (Red)",
        "owner_name": "Test Owner",
        "fir_number": "FIR-2026/TEST1",
        "police_station": "Guindy PS",
        "auto_alert": True,
        "notes": "Urgent intercept required"
    }
    create_res = client.post("/api/v1/anpr/directories", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["plate"] == test_plate
    assert created["directory_type"] == "STOLEN_VEHICLES"
    assert created["severity"] == "CRITICAL"
    assert created["fir_number"] == "FIR-2026/TEST1"
    entry_id = created["id"]

    # Update entry
    update_res = client.put(f"/api/v1/anpr/directories/{entry_id}", json={
        "status": "RESOLVED",
        "notes": "Vehicle recovered by Guindy PS unit"
    })
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["status"] == "RESOLVED"
    assert "Vehicle recovered" in updated["notes"]

def test_scan_check_stolen_vehicle_auto_alerts():
    """Test scanning a stolen vehicle triggers immediate directory match and automated Alert."""
    res = client.post("/api/v1/anpr/scan-check", json={
        "plate_number": "KA05MN3821",
        "location": "Anna Salai Spencers Junction",
        "source": "MANUAL_SCAN",
        "auto_create_alert": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["plate_number"] == "KA05MN3821"
    assert data["directory_matched"] is True
    assert data["matched_directory_type"] == "STOLEN_VEHICLES"
    assert data["severity"] == "CRITICAL"
    assert data["alert_triggered"] is True
    assert data["alert"] is not None
    assert "STOLEN" in data["alert"]["type"] or "STOLEN" in data["alert"]["message"]

def test_scan_check_compliant_unlisted_vehicle():
    """Test scanning an unflagged plate returns clean status."""
    res = client.post("/api/v1/anpr/scan-check", json={
        "plate_number": "TNXX1001",
        "location": "Anna Salai Junction",
        "source": "MANUAL_SCAN",
        "auto_create_alert": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["plate_number"] == "TNXX1001"
    assert data["directory_matched"] is False
    assert data["severity"] == "NORMAL"
    assert data["alert_triggered"] is False
