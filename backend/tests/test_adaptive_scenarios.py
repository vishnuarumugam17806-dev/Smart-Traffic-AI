import pytest
from app.database.session import SessionLocal, engine, Base
from app.models.models import Signal, SignalDecision, Intersection, Camera, CameraStatusEnum
from app.traffic.signal_controller import SignalController, AdaptiveSignalOptimizer
from app.core.config import settings

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.close()

def test_scenario_two_way_junction(db_session):
    """
    Test Scenario 26: Two-Way Junction (North vs South).
    North has higher traffic demand (Vehicles=40, Queue=30, Waiting=25).
    South has lower traffic demand (Vehicles=15, Queue=8, Waiting=15).
    Expect:
    1. North receives priority.
    2. Green duration is interpolated between MIN_GREEN_TIME and MAX_GREEN_TIME.
    3. Safe transition to YELLOW and RED_CLEARANCE occurs before South can be served.
    """
    controller = SignalController(intersection_id=882, num_approaches=2)
    assert len(controller.approaches) == 2
    assert "NORTH" in controller.approaches
    assert "SOUTH" in controller.approaches

    controller.approaches["NORTH"]["vehicle_count"] = 40.0
    controller.approaches["NORTH"]["queue_length"] = 30
    controller.approaches["NORTH"]["waiting_time"] = 25.0
    controller.approaches["NORTH"]["traffic_density"] = "HIGH"

    controller.approaches["SOUTH"]["vehicle_count"] = 15.0
    controller.approaches["SOUTH"]["queue_length"] = 8
    controller.approaches["SOUTH"]["waiting_time"] = 15.0
    controller.approaches["SOUTH"]["traffic_density"] = "MODERATE"

    controller._run_optimization(db_session)

    assert controller.active_approach == "NORTH"
    assert controller.active_phase == "NORTH"
    assert settings.MIN_GREEN_TIME <= controller.countdown <= settings.MAX_GREEN_TIME
    assert controller.get_approach_signal("NORTH") == "GREEN"
    assert controller.get_approach_signal("SOUTH") == "RED"

    # Advance state: safe transition via YELLOW
    controller._handle_state_transition(db_session)
    assert controller.state == "YELLOW"
    assert controller.get_approach_signal("NORTH") == "YELLOW"
    assert controller.get_approach_signal("SOUTH") == "RED"
    assert controller.countdown == settings.YELLOW_TIME

    # Advance state: safe transition via RED_CLEARANCE
    controller._handle_state_transition(db_session)
    assert controller.state == "RED_CLEARANCE"
    assert controller.get_approach_signal("NORTH") == "RED"
    assert controller.get_approach_signal("SOUTH") == "RED"
    assert controller.countdown == settings.ALL_RED_TIME

def test_scenario_waiting_fairness_anti_starvation(db_session):
    """
    Test Scenario 27: Waiting Fairness & Anti-Starvation.
    North: Queue=25, Waiting=15s.
    South: Queue=5, Waiting=85s (high wait time).
    Even though North has 5x the queue of South, South's accumulated waiting time
    and starvation prevention bonus must elevate its priority score above North.
    Expect: NO STARVATION - South receives priority green.
    """
    controller = SignalController(intersection_id=883, num_approaches=2)
    controller.approaches["NORTH"]["queue_length"] = 25
    controller.approaches["NORTH"]["vehicle_count"] = 30.0
    controller.approaches["NORTH"]["waiting_time"] = 15.0

    controller.approaches["SOUTH"]["queue_length"] = 5
    controller.approaches["SOUTH"]["vehicle_count"] = 8.0
    controller.approaches["SOUTH"]["waiting_time"] = 85.0  # > 50% of MAX_ALLOWED_WAIT (120s)

    controller._run_optimization(db_session)

    assert controller.active_approach == "SOUTH", (
        f"South should win priority to prevent starvation! "
        f"North priority: {controller.approaches['NORTH']['priority_score']}, "
        f"South priority: {controller.approaches['SOUTH']['priority_score']}"
    )
    assert controller.countdown >= settings.MIN_GREEN_TIME

def test_scenario_three_way_junction(db_session):
    """
    Test Scenario 28: Three-Approach Junction (North, East, West).
    North: Queue=5
    East: Queue=25, Vehicles=35
    West: Queue=12, Vehicles=16
    Expect:
    1. East receives highest priority.
    2. Recalculate all three approaches after cycle.
    3. Order is NOT hard-coded round-robin.
    """
    controller = SignalController(intersection_id=884, num_approaches=3)
    assert len(controller.approaches) == 3
    assert set(controller.approaches.keys()) == {"NORTH", "EAST", "WEST"}

    controller.approaches["NORTH"]["queue_length"] = 5
    controller.approaches["NORTH"]["vehicle_count"] = 8.0
    controller.approaches["NORTH"]["waiting_time"] = 10.0

    controller.approaches["EAST"]["queue_length"] = 25
    controller.approaches["EAST"]["vehicle_count"] = 35.0
    controller.approaches["EAST"]["waiting_time"] = 15.0

    controller.approaches["WEST"]["queue_length"] = 12
    controller.approaches["WEST"]["vehicle_count"] = 16.0
    controller.approaches["WEST"]["waiting_time"] = 12.0

    controller._run_optimization(db_session)
    assert controller.active_approach == "EAST"

    # Now simulate traffic evolution: East queue cleared, West accumulated high queue
    controller.approaches["EAST"]["queue_length"] = 2
    controller.approaches["EAST"]["vehicle_count"] = 4.0
    controller.approaches["WEST"]["queue_length"] = 28
    controller.approaches["WEST"]["vehicle_count"] = 32.0
    controller.approaches["WEST"]["waiting_time"] = 45.0

    controller._run_optimization(db_session)
    assert controller.active_approach == "WEST", "West should now win priority based on dynamic recalculation"

def test_scenario_four_way_junction(db_session):
    """
    Test Scenario 29: Four-Approach Junction (North, East, South, West).
    North: Queue=30, Vehicles=40
    East: Queue=18, Vehicles=22
    South: Queue=10, Vehicles=12
    West: Queue=5, Vehicles=7
    Expect:
    North receives highest priority.
    """
    controller = SignalController(intersection_id=885, num_approaches=4)
    assert len(controller.approaches) == 4

    controller.approaches["NORTH"]["queue_length"] = 30
    controller.approaches["NORTH"]["vehicle_count"] = 40.0

    controller.approaches["EAST"]["queue_length"] = 18
    controller.approaches["EAST"]["vehicle_count"] = 22.0

    controller.approaches["SOUTH"]["queue_length"] = 10
    controller.approaches["SOUTH"]["vehicle_count"] = 12.0

    controller.approaches["WEST"]["queue_length"] = 5
    controller.approaches["WEST"]["vehicle_count"] = 7.0

    controller._run_optimization(db_session)
    assert controller.active_approach == "NORTH"
    assert controller.countdown >= 30

def test_scenario_traffic_shift(db_session):
    """
    Test Scenario 30: Traffic Shift.
    At T1: North = HIGH, South = LOW -> North selected.
    At T2: Traffic shifts so North = LOW, South = HIGH -> South selected.
    """
    controller = SignalController(intersection_id=886, num_approaches=2)

    # T1
    controller.approaches["NORTH"]["queue_length"] = 35
    controller.approaches["NORTH"]["vehicle_count"] = 45.0
    controller.approaches["SOUTH"]["queue_length"] = 4
    controller.approaches["SOUTH"]["vehicle_count"] = 6.0
    controller._run_optimization(db_session)
    assert controller.active_approach == "NORTH"

    # T2 - Sudden Traffic Shift
    controller.approaches["NORTH"]["queue_length"] = 2
    controller.approaches["NORTH"]["vehicle_count"] = 5.0
    controller.approaches["SOUTH"]["queue_length"] = 38
    controller.approaches["SOUTH"]["vehicle_count"] = 48.0
    controller.approaches["SOUTH"]["waiting_time"] = 30.0
    controller._run_optimization(db_session)
    assert controller.active_approach == "SOUTH"

def test_do_not_waste_green_time(db_session):
    """
    Test Section 17: Do Not Waste Green Time.
    If an approach becomes clear during green:
    After MIN_GREEN_TIME has elapsed, if queue is 0 and competing approaches have waiting demand,
    early transition to YELLOW is triggered safely.
    """
    controller = SignalController(intersection_id=887, num_approaches=2)
    controller.active_approach = "NORTH"
    controller.active_phase = "NORTH"
    controller.state = "GREEN"
    controller.countdown = 45

    # North approach queue clears to 0 after minimum green has elapsed
    controller.elapsed_green_time = float(settings.MIN_GREEN_TIME + 2)
    controller.approaches["NORTH"]["queue_length"] = 0
    controller.approaches["SOUTH"]["queue_length"] = 15
    controller.approaches["SOUTH"]["waiting_time"] = 25.0

    controller._reassess_green_phase(db_session)
    assert controller.state == "YELLOW"
    assert controller.countdown == settings.YELLOW_TIME
    assert "queue cleared" in controller.last_reasoning

def test_camera_failure_graceful_handling():
    """
    Test Section 24: Camera Failure Handling.
    Verify controller supports camera failure status (CAMERA_OFFLINE, DATA_STALE)
    without crashing or halting optimization.
    """
    controller = SignalController(intersection_id=888, num_approaches=2)
    controller.update_approach_observation(
        approach_key="NORTH",
        vehicle_count=0.0,
        queue_length=0,
        traffic_density="LOW",
        camera_status="CAMERA_OFFLINE",
        is_queue_available=False
    )
    assert controller.approaches["NORTH"]["camera_status"] == "CAMERA_OFFLINE"
    assert controller.approaches["NORTH"]["is_queue_available"] is False

    # Optimizer still runs safely with fallback
    optimizer = AdaptiveSignalOptimizer()
    score = optimizer.calculate_priority_score(
        vehicle_count=controller.approaches["NORTH"]["vehicle_count"],
        queue_length=controller.approaches["NORTH"]["queue_length"],
        waiting_time=10.0
    )
    assert score >= 0.0

def test_database_decision_persistence(db_session):
    """
    Test Section 31: Database Storage.
    Verifies every decision record stores:
    junction_id, approach_id, timestamp, vehicle_count, queue_length,
    traffic_density, waiting_time, demand_score, priority_score,
    green_duration, signal_state, mode, decision_reason.
    """
    controller = SignalController(intersection_id=889, num_approaches=2)
    controller.approaches["NORTH"]["queue_length"] = 22
    controller.approaches["NORTH"]["vehicle_count"] = 28.0
    controller.approaches["NORTH"]["waiting_time"] = 15.0

    controller._run_optimization(db_session)

    record = db_session.query(SignalDecision).filter(
        SignalDecision.junction_id == 889
    ).order_by(SignalDecision.id.desc()).first()

    assert record is not None
    assert record.junction_id == 889
    assert record.approach_id in ["NORTH", "SOUTH"]
    assert record.vehicle_count is not None
    assert record.queue_length is not None
    assert record.traffic_density is not None
    assert record.waiting_time is not None
    assert record.demand_score is not None
    assert record.priority_score is not None
    assert record.green_duration >= settings.MIN_GREEN_TIME
    assert record.signal_state == "GREEN"
    assert record.mode == "AUTOMATIC"
    assert len(record.decision_reason) > 10
