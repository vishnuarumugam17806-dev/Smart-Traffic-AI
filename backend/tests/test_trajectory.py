import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.database.session import SessionLocal, engine, Base
from app.trajectory.graph import TrajectoryGraphEngine, levenshtein_distance, trajectory_engine
from app.models.models import Camera, Intersection, Road, PlateObservation, RouteAnomaly, Alert, CameraStatusEnum

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()

def test_levenshtein_distance():
    assert levenshtein_distance("TN01AB1234", "TN01AB1234") == 0
    assert levenshtein_distance("TN01AB1234", "TN01AB1235") == 1
    assert levenshtein_distance("TN01AB1234", "KA05MN3821") > 3
    assert levenshtein_distance("", "TEST") == 4

def test_get_cameras_and_edges(db_session: Session):
    engine_inst = TrajectoryGraphEngine()
    result = engine_inst.get_cameras_and_edges(db_session)
    assert "nodes" in result
    assert "edges" in result
    assert isinstance(result["nodes"], list)
    assert isinstance(result["edges"], list)

def test_correlate_vehicle_new_id(db_session: Session):
    engine_inst = TrajectoryGraphEngine()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    plate = "TEST9999XY"

    # Correlate first sighting
    res1 = engine_inst.correlate_vehicle(db_session, plate, "car", 1, now)
    assert res1 is not None
    assert "global_vehicle_id" in res1
    assert res1["global_vehicle_id"].startswith("GV-")

    # Add plate observation to DB
    obs = PlateObservation(
        plate_number=plate,
        camera_id=1,
        timestamp=now,
        global_vehicle_id=res1["global_vehicle_id"],
        vehicle_type="car",
        ocr_confidence=0.95,
        plate_detection_confidence=0.95,
        final_confidence=0.95
    )
    db_session.add(obs)
    db_session.commit()

    # Correlate second sighting (same vehicle plate)
    now2 = now + timedelta(minutes=5)
    res2 = engine_inst.correlate_vehicle(db_session, plate, "car", 2, now2)
    assert res2["global_vehicle_id"] == res1["global_vehicle_id"]

def test_reconstruct_trajectory(db_session: Session):
    engine_inst = TrajectoryGraphEngine()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    plate = "TN01AB1234"

    # Seed observations if not present
    obs1 = PlateObservation(
        plate_number=plate,
        camera_id=1,
        timestamp=now - timedelta(minutes=10),
        global_vehicle_id="GV-10001",
        vehicle_type="car",
        ocr_confidence=0.95,
        plate_detection_confidence=0.95,
        final_confidence=0.95,
        direction="NORTH",
        lane=1
    )
    obs2 = PlateObservation(
        plate_number=plate,
        camera_id=2,
        timestamp=now - timedelta(minutes=5),
        global_vehicle_id="GV-10001",
        vehicle_type="car",
        ocr_confidence=0.94,
        plate_detection_confidence=0.94,
        final_confidence=0.94,
        direction="NORTH",
        lane=1
    )
    db_session.add_all([obs1, obs2])
    db_session.commit()

    traj = engine_inst.reconstruct_trajectory(db_session, plate)
    assert traj is not None
    assert traj["plate_number"] == plate
    assert traj["cameras_visited"] >= 2
    assert "timeline" in traj
    assert len(traj["timeline"]) >= 2
    assert "global_vehicle_id" in traj

def test_route_anomaly_detection(db_session: Session):
    engine_inst = TrajectoryGraphEngine()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    plate = "FAST0001XX"
    gid = "GV-99999"

    # Save first observation
    obs1 = PlateObservation(
        plate_number=plate,
        camera_id=1,
        timestamp=now - timedelta(seconds=2),  # 2 seconds ago
        global_vehicle_id=gid,
        vehicle_type="car",
        ocr_confidence=0.95,
        plate_detection_confidence=0.95,
        final_confidence=0.95
    )
    db_session.add(obs1)
    db_session.commit()

    # Second observation 2 seconds later (1.5 km distance in 2 sec -> 2700 km/h impossible speed)
    now2 = now
    res = engine_inst.correlate_vehicle(db_session, plate, "car", 2, now2)
    assert res is not None
    assert res["speed_kmh"] > 150.0
    assert res["anomaly"] is not None
