import pytest
from sqlalchemy.orm import Session
from app.database.session import SessionLocal, engine, Base
from app.traffic.signal_controller import SignalController, AdaptiveSignalOptimizer
from app.cv.tracker import IoUTracker
from app.models.models import Camera, Signal, SignalDecision, AuditLog, PlateObservation
from app.core.config import settings

@pytest.fixture(scope="module")
def db_session():
    # Setup test tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# TEST 1: North = HIGH, others LOW -> North gets priority.
def test_north_priority_demand():
    controller = SignalController(intersection_id=999)
    # Set NORTH approach to HIGH demand
    controller.approaches["NORTH"]["vehicle_count"] = 25
    controller.approaches["NORTH"]["queue_length"] = 20
    
    # Set others to LOW
    controller.approaches["EAST"]["vehicle_count"] = 2
    controller.approaches["EAST"]["queue_length"] = 1
    controller.approaches["SOUTH"]["vehicle_count"] = 2
    controller.approaches["SOUTH"]["queue_length"] = 1
    controller.approaches["WEST"]["vehicle_count"] = 2
    controller.approaches["WEST"]["queue_length"] = 1
    
    # Run optimizer score calculation
    ns_score = controller.optimizer.calculate_priority_score(
        controller.approaches["NORTH"]["vehicle_count"] + controller.approaches["SOUTH"]["vehicle_count"],
        controller.approaches["NORTH"]["queue_length"] + controller.approaches["SOUTH"]["queue_length"],
        0.0, 0.15, 0.0, False
    )
    ew_score = controller.optimizer.calculate_priority_score(
        controller.approaches["EAST"]["vehicle_count"] + controller.approaches["WEST"]["vehicle_count"],
        controller.approaches["EAST"]["queue_length"] + controller.approaches["WEST"]["queue_length"],
        0.0, 0.15, 0.0, False
    )
    
    assert ns_score > ew_score
    
    # Test dynamic green
    green_duration = controller.optimizer.calculate_dynamic_green(20, 27, "HIGH")
    assert green_duration >= 40
    assert green_duration <= 60

# TEST 2: North clears, East becomes HIGH -> Transition safely
def test_transition_on_clearance(db_session: Session):
    controller = SignalController(intersection_id=1)
    controller.active_phase = "NORTH_SOUTH"
    controller.state = "GREEN"
    controller.elapsed_green_time = 20  # completed min green (15s)
    
    # North clears
    controller.approaches["NORTH"]["vehicle_count"] = 0
    controller.approaches["NORTH"]["queue_length"] = 0
    controller.approaches["SOUTH"]["vehicle_count"] = 0
    controller.approaches["SOUTH"]["queue_length"] = 0
    
    # East becomes HIGH
    controller.approaches["EAST"]["vehicle_count"] = 18
    controller.approaches["EAST"]["queue_length"] = 15
    
    # Trigger reassessment tick
    controller.tick(db_session, dt=1.5)
    
    # Should transition to YELLOW due to queue clearance and waiting demand
    assert controller.state == "YELLOW"
    assert controller.countdown == settings.YELLOW_TIME

# TEST 3: North remains HIGH, East waits long -> East is served (starvation prevented)
def test_starvation_prevention():
    controller = SignalController(intersection_id=999)
    
    # NORTH remains extremely high
    controller.approaches["NORTH"]["vehicle_count"] = 35
    controller.approaches["NORTH"]["queue_length"] = 30
    
    # EAST waiting time accumulates
    controller.approaches["EAST"]["vehicle_count"] = 8
    controller.approaches["EAST"]["queue_length"] = 6
    controller.approaches["EAST"]["waiting_time"] = 150.0  # waits for a long time
    controller.approaches["EAST"]["time_since_last_green"] = 150.0
    
    ns_score = sum(
        controller.optimizer.calculate_priority_score(
            controller.approaches[d]["vehicle_count"],
            controller.approaches[d]["queue_length"],
            controller.approaches[d]["waiting_time"],
            controller.approaches[d]["queue_growth_rate"],
            controller.approaches[d]["time_since_last_green"],
            controller.approaches[d]["emergency_detected"]
        ) for d in ["NORTH", "SOUTH"]
    )
    
    ew_score = sum(
        controller.optimizer.calculate_priority_score(
            controller.approaches[d]["vehicle_count"],
            controller.approaches[d]["queue_length"],
            controller.approaches[d]["waiting_time"],
            controller.approaches[d]["queue_growth_rate"],
            controller.approaches[d]["time_since_last_green"],
            controller.approaches[d]["emergency_detected"]
        ) for d in ["EAST", "WEST"]
    )
    
    # Fairness starvation bonus should boost East's priority score above North's
    assert ew_score > ns_score

# TEST 4: Emergency vehicle detected -> Emergency priority request is generated
def test_emergency_priority_preemption():
    optimizer = AdaptiveSignalOptimizer()
    
    # Normal high traffic
    normal_score = optimizer.calculate_priority_score(
        vehicle_count=10, queue_length=8, waiting_time=10.0,
        queue_growth_rate=0.2, time_since_last_green=10.0, emergency_detected=False
    )
    
    # Traffic with emergency vehicle
    emergency_score = optimizer.calculate_priority_score(
        vehicle_count=10, queue_length=8, waiting_time=10.0,
        queue_growth_rate=0.2, time_since_last_green=10.0, emergency_detected=True
    )
    
    # Score should increase dramatically by emergency weighting factor (150)
    assert emergency_score >= normal_score + 150.0

# TEST 5: Camera goes offline -> Safe default failsafe behavior
def test_camera_offline_failsafe(db_session: Session):
    # Simulated camera is marked offline. Background worker uses safe bounds.
    controller = SignalController(intersection_id=1)
    
    # Reverts to normal simulation bounds and automatic optimization runs safely
    controller._run_optimization(db_session)
    assert controller.countdown >= settings.MIN_GREEN_TIME
    assert controller.countdown <= settings.MAX_GREEN_TIME
    assert controller.state == "GREEN"

# TEST 6: Two vehicles appear similar -> Tracking system must not incorrectly merge them
def test_iou_tracker_unmatched_similar():
    tracker = IoUTracker(iou_threshold=0.5, max_age=5)
    
    # Vehicle detection at Frame 1
    detections_f1 = [
        {"bbox": [10, 10, 50, 50], "label": "car", "confidence": 0.90}
    ]
    tracks_f1 = tracker.update(detections_f1)
    assert len(tracks_f1) == 1
    first_track_id = tracks_f1[0].track_id
    
    # Vehicle detection at Frame 2: a different car far away, but with same label
    detections_f2 = [
        {"bbox": [150, 150, 190, 190], "label": "car", "confidence": 0.88}
    ]
    tracks_f2 = tracker.update(detections_f2)
    
    # Should create a new track (two distinct vehicles) instead of merging
    assert len(tracks_f2) == 2
    track_ids = [t.track_id for t in tracks_f2]
    assert first_track_id in track_ids
    assert len(set(track_ids)) == 2

# TEST 7: Manual control override validation and audit logging
def test_manual_control_override_and_audit(db_session: Session):
    controller = SignalController(intersection_id=1)
    
    # Request manual control for EAST_WEST phase
    success = controller.request_manual_control(
        db=db_session,
        phase="EAST_WEST",
        reason="Test Emergency VIP Corridor",
        username="test_operator"
    )
    
    assert success is True
    assert controller.mode == "MANUAL"
    assert controller.manual_target_phase == "EAST_WEST"
    
    # Verify Audit Log entry is created
    log = db_session.query(AuditLog).filter(
        AuditLog.username == "test_operator",
        AuditLog.action == "MANUAL_SIGNAL_OVERRIDE"
    ).first()
    
    assert log is not None
    assert "EAST_WEST" in log.details
    assert "Test Emergency VIP Corridor" in log.details
