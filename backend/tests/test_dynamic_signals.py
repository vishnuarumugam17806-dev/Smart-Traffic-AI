import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, engine, Base
from app.models.models import User, Intersection, RoleEnum
from app.core.security import get_password_hash, create_access_token
from app.traffic.signal_controller import SignalController, AdaptiveSignalOptimizer

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "test_admin_sig").first()
        if not admin:
            admin = User(
                username="test_admin_sig",
                email="admin_sig@test.com",
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

def test_two_side_junction_optimization(setup_db):
    """Test 2-side junction (North & South) optimization."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=992, num_approaches=2)
    assert len(controller.approaches) == 2
    assert "NORTH" in controller.approaches
    assert "SOUTH" in controller.approaches
    assert "EAST" not in controller.approaches

    controller.approaches["NORTH"]["queue_length"] = 28
    controller.approaches["NORTH"]["vehicle_count"] = 35.0
    controller.approaches["SOUTH"]["queue_length"] = 4
    controller.approaches["SOUTH"]["vehicle_count"] = 6.0

    controller._run_optimization(db)

    assert controller.active_approach == "NORTH"
    assert controller.countdown >= 15

def test_three_side_junction_optimization(setup_db):
    """Test 3-side junction (North, East, West) priority selection."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=993, num_approaches=3)
    assert len(controller.approaches) == 3
    assert "NORTH" in controller.approaches
    assert "EAST" in controller.approaches
    assert "WEST" in controller.approaches
    assert "SOUTH" not in controller.approaches

    controller.approaches["NORTH"]["queue_length"] = 5
    controller.approaches["EAST"]["queue_length"] = 32
    controller.approaches["EAST"]["vehicle_count"] = 40.0
    controller.approaches["WEST"]["queue_length"] = 10

    controller._run_optimization(db)

    assert controller.active_approach == "EAST"

def test_four_side_junction_optimization(setup_db):
    """Test 4-side junction (North, East, South, West) priority selection."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=994, num_approaches=4)
    assert len(controller.approaches) == 4

    controller.approaches["NORTH"]["queue_length"] = 8
    controller.approaches["EAST"]["queue_length"] = 12
    controller.approaches["SOUTH"]["queue_length"] = 4
    controller.approaches["WEST"]["queue_length"] = 45
    controller.approaches["WEST"]["vehicle_count"] = 50.0

    controller._run_optimization(db)

    assert controller.active_approach == "WEST"

def test_anti_starvation_fairness():
    """Test that waiting time increases priority score to prevent starvation."""
    optimizer = AdaptiveSignalOptimizer()

    score_low_wait = optimizer.calculate_priority_score(
        vehicle_count=5, queue_length=4, waiting_time=5.0, queue_growth_rate=0.1, time_since_last_green=10.0, emergency_detected=False
    )
    score_high_wait = optimizer.calculate_priority_score(
        vehicle_count=5, queue_length=4, waiting_time=75.0, queue_growth_rate=0.1, time_since_last_green=75.0, emergency_detected=False
    )

    assert score_high_wait > score_low_wait + 50.0

def test_junction_config_api(setup_db):
    """Test POST /api/v1/intersections/{id}/config API endpoint."""
    headers = setup_db["headers"]
    res = client.post(
        "/api/v1/intersections/1/config",
        headers=headers,
        json={
            "num_approaches": 3,
            "approaches": [
                {"id": "NORTH", "name": "North Main Approach", "direction": "NORTH"},
                {"id": "EAST", "name": "East Bypass Approach", "direction": "EAST"},
                {"id": "WEST", "name": "West Express Approach", "direction": "WEST"}
            ]
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["intersection"]["num_approaches"] == 3

    # Check GET /intersections/1/traffic returns 3 approaches
    traf_res = client.get("/api/v1/intersections/1/traffic")
    assert traf_res.status_code == 200
    traf_data = traf_res.json()
    assert traf_data["num_approaches"] == 3
    assert len(traf_data["approaches"]) == 3
