import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database.session import SessionLocal, engine, Base
from app.models.models import User, Intersection, Camera, Alert, Blacklist, RoleEnum
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Create test admin user if missing
        admin = db.query(User).filter(User.username == "test_admin").first()
        if not admin:
            admin = User(
                username="test_admin",
                email="admin@test.com",
                hashed_password=get_password_hash("admin123"),
                role=RoleEnum.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        
        token = create_access_token(admin.username)
        headers = {"Authorization": f"Bearer {token}"}
        yield {"db": db, "headers": headers}
    finally:
        db.close()

def test_health_check_endpoints():
    response = client.get("/")
    assert response.status_code == 200

def test_get_intersections():
    response = client.get("/api/v1/intersections")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_intersection(setup_test_db):
    headers = setup_test_db["headers"]
    payload = {
        "name": f"Test Intersection Hub {uuid.uuid4().hex[:4]}",
        "location": "North Sector",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "active_status": "ACTIVE"
    }
    response = client.post("/api/v1/intersections", json=payload, headers=headers)
    assert response.status_code in [200, 201]
    data = response.json()
    assert "Test Intersection Hub" in data["name"]

def test_get_cameras():
    response = client.get("/api/v1/cameras")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_latest_measurements():
    response = client.get("/api/v1/traffic/measurements")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_trajectories_endpoint():
    response = client.get("/api/v1/trajectories?plate=TN01AB1234")
    assert response.status_code in [200, 404]

def test_get_alerts_endpoint():
    response = client.get("/api/v1/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_blacklist_endpoint():
    response = client.get("/api/v1/blacklist")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_blacklist_item(setup_test_db):
    headers = setup_test_db["headers"]
    unique_plate = f"WANTED{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "plate": unique_plate,
        "reason": "Suspect Vehicle",
        "notes": "Testing endpoint"
    }
    response = client.post("/api/v1/blacklist", json=payload, headers=headers)
    assert response.status_code in [200, 201]
    data = response.json()
    assert data["plate"] == unique_plate

def test_ai_query_assistant():
    payload = {"query": "Show active traffic summary"}
    response = client.post("/api/v1/ai/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
