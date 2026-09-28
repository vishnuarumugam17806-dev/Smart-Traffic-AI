import pytest
import time
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, engine, Base
from app.models.models import User, Intersection, RoleEnum, AuditLog
from app.core.security import get_password_hash, create_access_token
from app.traffic.signal_controller import SignalController, signal_registry
from app.database.mongodb import mongo_manager

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "test_ped_admin").first()
        if not admin:
            admin = User(
                username="test_ped_admin",
                email="admin_ped@test.com",
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


def test_1_two_way_junction_pedestrian_phase_all_red(setup_db):
    """TEST 1: 2-way junction -> pedestrian phase -> both approaches RED."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=901, num_approaches=2)
    assert len(controller.approaches) == 2
    assert "NORTH" in controller.approaches
    assert "SOUTH" in controller.approaches

    # Trigger pedestrian phase
    res = controller.trigger_pedestrian_phase(db, trigger_type="TEST")
    assert res["status"] == "INITIATED"

    # Advance state machine through transition and all-red clearance to PEDESTRIAN_CROSSING
    controller.countdown = 0
    controller.tick(db, dt=1.0) # transitions to ALL_RED
    controller.countdown = 0
    controller.tick(db, dt=1.0) # transitions to PEDESTRIAN_CROSSING

    assert controller.pedestrian_state == "PEDESTRIAN_CROSSING"
    assert controller.get_approach_signal("NORTH") == "RED"
    assert controller.get_approach_signal("SOUTH") == "RED"


def test_2_three_way_junction_pedestrian_phase_all_red(setup_db):
    """TEST 2: 3-way junction -> pedestrian phase -> all 3 approaches RED."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=902, num_approaches=3)
    assert len(controller.approaches) == 3

    controller.trigger_pedestrian_phase(db, trigger_type="TEST")
    controller.countdown = 0
    controller.tick(db, dt=1.0)
    controller.countdown = 0
    controller.tick(db, dt=1.0)

    assert controller.pedestrian_state == "PEDESTRIAN_CROSSING"
    for app_name in controller.approaches.keys():
        assert controller.get_approach_signal(app_name) == "RED"


def test_3_four_way_junction_pedestrian_phase_all_red(setup_db):
    """TEST 3: 4-way junction -> pedestrian phase -> all 4 approaches RED."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=903, num_approaches=4)
    assert len(controller.approaches) == 4

    controller.trigger_pedestrian_phase(db, trigger_type="TEST")
    controller.countdown = 0
    controller.tick(db, dt=1.0)
    controller.countdown = 0
    controller.tick(db, dt=1.0)

    assert controller.pedestrian_state == "PEDESTRIAN_CROSSING"
    for app_name in ["NORTH", "EAST", "SOUTH", "WEST"]:
        assert controller.get_approach_signal(app_name) == "RED"


def test_4_pedestrian_phase_ends_adaptive_resumes(setup_db):
    """TEST 4: Pedestrian phase ends -> adaptive optimization resumes."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=904, num_approaches=4)
    controller.approaches["EAST"]["queue_length"] = 25
    controller.approaches["EAST"]["vehicle_count"] = 30.0

    # Put in PEDESTRIAN_CROSSING
    controller.pedestrian_state = "PEDESTRIAN_CROSSING"
    controller.pedestrian_status = "ACTIVE"
    controller.remaining_pedestrian_seconds = 1
    controller.countdown = 1

    # Tick 1: completes pedestrian crossing
    controller.tick(db, dt=1.0)
    assert controller.pedestrian_state == "PEDESTRIAN_COMPLETE"

    # Tick 2: transitions back
    controller.tick(db, dt=1.0)
    assert controller.pedestrian_state == "TRANSITION_BACK"

    # Tick 3: returns to NORMAL and runs adaptive optimization
    controller.tick(db, dt=1.0)
    assert controller.pedestrian_state == "NORMAL"
    assert controller.mode == "AUTOMATIC"
    assert controller.active_approach == "EAST"  # Highest demand approach was selected
    assert controller.get_approach_signal("EAST") == "GREEN"


def test_5_optimizer_rejected_during_pedestrian_phase(setup_db):
    """TEST 5: Optimizer attempts to change signal during pedestrian phase -> command rejected."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=905, num_approaches=4)
    controller.pedestrian_state = "PEDESTRIAN_CROSSING"

    # Attempt to run optimization directly
    controller._run_optimization(db)

    # All approaches must still remain RED
    for app_name in controller.approaches.keys():
        assert controller.get_approach_signal(app_name) == "RED"


def test_6_browser_refresh_server_state_authoritative(setup_db):
    """TEST 6: Browser refresh during pedestrian countdown -> state remains correct."""
    db = setup_db["db"]
    inter_id = 1
    controller = signal_registry.get_controller(inter_id, db=db)
    controller.pedestrian_state = "PEDESTRIAN_CROSSING"
    controller.remaining_pedestrian_seconds = 22
    controller.countdown = 22

    # Client simulates browser refresh by hitting the API endpoint
    response = client.get(f"/api/v1/intersections/{inter_id}/signal")
    assert response.status_code == 200
    data = response.json()

    assert "pedestrian_crossing" in data
    ped_info = data["pedestrian_crossing"]
    assert ped_info["is_active"] is True
    assert ped_info["pedestrian_phase_state"] == "PEDESTRIAN_CROSSING"
    assert ped_info["remaining_pedestrian_seconds"] == 22

    # Reset controller state
    controller.pedestrian_state = "NORMAL"
    controller.pedestrian_status = "SCHEDULED"


def test_7_multiple_clients_synchronized(setup_db):
    """TEST 7: Multiple browser/control-room clients -> all show the same signal state."""
    db = setup_db["db"]
    inter_id = 1
    controller = signal_registry.get_controller(inter_id, db=db)
    controller.pedestrian_state = "PEDESTRIAN_CROSSING"
    controller.remaining_pedestrian_seconds = 18

    # Client 1 fetches
    res1 = client.get(f"/api/v1/intersections/{inter_id}/pedestrian/status")
    # Client 2 fetches
    res2 = client.get(f"/api/v1/intersections/{inter_id}/pedestrian/status")

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["remaining_pedestrian_seconds"] == res2.json()["remaining_pedestrian_seconds"]
    assert res1.json()["is_active"] == res2.json()["is_active"]

    controller.pedestrian_state = "NORMAL"
    controller.pedestrian_status = "SCHEDULED"


def test_8_manual_commands_blocked_during_pedestrian_phase(setup_db):
    """TEST 8: Manual mode + pedestrian phase -> conflicting manual commands blocked."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=908, num_approaches=4)
    controller.pedestrian_state = "PEDESTRIAN_CROSSING"

    # Operator attempts to force green on NORTH during pedestrian crossing
    success = controller.request_manual_control(
        db,
        phase="NORTH",
        color="GREEN",
        reason="Operator test",
        username="OPERATOR",
        is_emergency_override=False
    )
    assert success is False
    assert controller.get_approach_signal("NORTH") == "RED"


def test_9_emergency_override_confirmation_and_audit(setup_db):
    """TEST 9: Emergency override -> explicit confirmation + audit record."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=909, num_approaches=4)
    controller.pedestrian_state = "PEDESTRIAN_CROSSING"

    # Emergency override executed
    override_res = controller.emergency_override_pedestrian(
        db,
        username="DISPATCH_911",
        reason="Ambulance en route to emergency ward",
        target_approach="SOUTH"
    )
    assert override_res["status"] == "OVERRIDDEN"
    assert override_res["active_approach"] == "SOUTH"
    assert override_res["state"] == "GREEN"

    # Verify audit log was recorded in database
    audit = db.query(AuditLog).filter(
        AuditLog.action == "PEDESTRIAN_OVERRIDDEN"
    ).order_by(AuditLog.timestamp.desc()).first()
    assert audit is not None
    assert "DISPATCH_911" in audit.details


def test_10_pedestrian_event_stored(setup_db):
    """TEST 10: Pedestrian phase event stored correctly in MongoDB / SQL audit log."""
    db = setup_db["db"]
    controller = SignalController(intersection_id=910, num_approaches=4)
    controller._record_pedestrian_event(
        db,
        event_type="PEDESTRIAN_CROSSING",
        status="COMPLETED",
        reason="Scheduled test crossing completed safely."
    )

    # Verify audit log in SQL
    audit = db.query(AuditLog).filter(
        AuditLog.action == "PEDESTRIAN_COMPLETED"
    ).order_by(AuditLog.timestamp.desc()).first()
    assert audit is not None
    assert "910" in audit.details


def test_11_demo_mode_shortened_timer():
    """TEST 11: Demo mode -> shortened timer works (10s interval)."""
    controller = SignalController(intersection_id=911, num_approaches=4)
    controller.configure_pedestrian(demo_mode=True)
    assert controller.is_demo_mode is True
    telemetry = controller.get_pedestrian_telemetry()
    assert telemetry["is_demo_mode"] is True
    assert telemetry["pedestrian_interval_seconds"] == 10


def test_12_normal_production_configuration():
    """TEST 12: Normal production configuration -> 10-minute interval + 30-second crossing."""
    controller = SignalController(intersection_id=912, num_approaches=4)
    assert controller.pedestrian_interval == 600.0
    assert controller.pedestrian_duration == 30.0
    telemetry = controller.get_pedestrian_telemetry()
    assert telemetry["pedestrian_interval_seconds"] == 600
    assert telemetry["pedestrian_phase_duration"] == 30
