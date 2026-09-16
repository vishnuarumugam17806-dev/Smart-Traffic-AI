import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, engine, Base
from app.traffic.signal_controller import SignalController, signal_registry
from app.core.config import settings

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.close()

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

def test_vehicle_passed_radius_decrements_count(db_session):
    """
    Verify vehicle passing radius decrements approach vehicle count and increments passed count.
    """
    controller = SignalController(intersection_id=901, num_approaches=2)
    controller.approaches["NORTH"]["vehicle_count"] = 5.0
    controller.approaches["NORTH"]["queue_length"] = 4
    controller.active_approach = "NORTH"
    controller.state = "GREEN"

    res = controller.vehicle_passed_radius(db_session, "NORTH", "CAR_01")
    assert res["vehicles_remaining"] == 4.0
    assert res["passed_radius_count"] == 1
    assert res["auto_switched_to_next"] is False
    assert controller.state == "GREEN"

def test_vehicle_passed_radius_triggers_auto_switch_when_empty(db_session):
    """
    Verify that when the last vehicle passes the radius and 0 vehicles remain,
    the signal immediately changes to YELLOW and initiates switch to next approach.
    """
    controller = SignalController(intersection_id=902, num_approaches=2)
    controller.approaches["NORTH"]["vehicle_count"] = 1.0
    controller.approaches["NORTH"]["queue_length"] = 1
    controller.approaches["SOUTH"]["vehicle_count"] = 10.0
    controller.approaches["SOUTH"]["queue_length"] = 8
    controller.active_approach = "NORTH"
    controller.state = "GREEN"

    # Vehicle passes radius -> 0 vehicles remaining
    res = controller.vehicle_passed_radius(db_session, "NORTH", "CAR_LAST")
    assert res["vehicles_remaining"] == 0.0
    assert res["auto_switched_to_next"] is True
    assert controller.state == "YELLOW"
    assert controller.countdown == settings.YELLOW_TIME

    # Advance Yellow to Red Clearance
    controller._handle_state_transition(db_session)
    assert controller.state == "RED_CLEARANCE"
    assert controller.countdown == settings.ALL_RED_TIME

    # Advance Red Clearance to next Green phase -> South MUST receive Green!
    controller._handle_state_transition(db_session)
    assert controller.state == "GREEN"
    assert controller.active_approach == "SOUTH"
    assert controller.get_approach_signal("SOUTH") == "GREEN"
    assert controller.get_approach_signal("NORTH") == "RED"

def test_clear_approach_vehicles_method(db_session):
    """
    Verify clear_approach_vehicles marks 0 vehicles remaining and triggers immediate switch.
    """
    controller = SignalController(intersection_id=903, num_approaches=3)
    controller.approaches["NORTH"]["vehicle_count"] = 8.0
    controller.approaches["NORTH"]["queue_length"] = 6
    controller.active_approach = "NORTH"
    controller.state = "GREEN"

    res = controller.clear_approach_vehicles(db_session, "NORTH")
    assert res["vehicles_remaining"] == 0
    assert res["auto_switched_to_next"] is True
    assert controller.state == "YELLOW"
    assert "0 vehicles remaining" in controller.last_reasoning

def test_api_vehicle_pass_and_clear_endpoints(client, db_session):
    """
    Test REST API endpoints POST /api/v1/intersections/{id}/vehicle-pass
    and POST /api/v1/intersections/{id}/clear-approach.
    """
    # Setup junction controller
    controller = signal_registry.get_controller(14, db=db_session)
    controller.mode = "AUTOMATIC"
    controller.state = "GREEN"
    controller.active_approach = "NORTH"
    controller.approaches["NORTH"]["vehicle_count"] = 2.0
    controller.approaches["NORTH"]["queue_length"] = 2

    # 1. Pass first vehicle
    res1 = client.post("/api/v1/intersections/14/vehicle-pass", json={"approach": "NORTH", "vehicle_id": "TN01A100"})
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["vehicles_remaining"] == 1.0
    assert data1["auto_switched_to_next"] is False

    # 2. Pass second (last) vehicle
    res2 = client.post("/api/v1/intersections/14/vehicle-pass", json={"approach": "NORTH", "vehicle_id": "TN01A101"})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["vehicles_remaining"] == 0.0
    assert data2["auto_switched_to_next"] is True
    assert data2["state"] == "YELLOW"

    # 3. Test clear approach endpoint
    controller.state = "GREEN"
    controller.active_approach = "EAST"
    controller.approaches["EAST"]["vehicle_count"] = 5.0
    res3 = client.post("/api/v1/intersections/14/clear-approach", json={"approach": "EAST"})
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["vehicles_remaining"] == 0
    assert data3["auto_switched_to_next"] is True
