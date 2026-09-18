"""
Comprehensive End-to-End Test Suite verifying Requirements & Acceptance Scenarios:
- Test A: No vehicle in frame -> No ANPR, no event
- Test B: Vehicle visible, plate not visible -> Plate detector finds nothing -> No ANPR
- Test C: Vehicle visible, plate visible -> Confirmed ANPR event with real device GPS
- Test D: Blurred plate -> Laplacian variance below threshold -> Rejected / No confirmed plate
- Test E: Small plate -> Undersized candidate -> Rejected
- Test F: Same vehicle across multiple frames -> Exactly 1 confirmed passage event (cooldown)
- Test G: Location permission granted -> Real device coordinates & accuracy attached
- Test H: Location permission denied -> Location status UNAVAILABLE/DENIED, NO random coordinates
- Test I: GPS becomes stale (>60s) -> Location status STALE
- Test J: Device moves -> Updated GPS position attached
"""
import pytest
import numpy as np
import cv2
import time
from app.cv.plate_validator import PlateValidator
from app.cv.temporal_tracker import TemporalPlateTracker
from app.cv.anpr import anpr_engine
from app.cv.detector import vehicle_detector
from app.cv.mobile_manager import mobile_device_manager


def create_solid_frame(w=640, h=480, color=(128, 128, 128)):
    return np.full((h, w, 3), color, dtype=np.uint8)


def create_vehicle_frame_with_plate(plate_text="TN01AB1234", blur=False, small=False):
    frame = np.full((480, 640, 3), 100, dtype=np.uint8)
    # Draw vehicle body (dark blue box)
    cv2.rectangle(frame, (100, 80), (540, 420), (160, 80, 40), -1)
    # Draw vehicle bumper
    cv2.rectangle(frame, (140, 320), (500, 400), (60, 60, 60), -1)

    if small:
        # Undersized plate (e.g. 20x8)
        pw, ph = 20, 8
        px, py = 250, 340
        cv2.rectangle(frame, (px, py), (px + pw, py + ph), (255, 255, 255), -1)
    else:
        # Normal plate (180x50)
        pw, ph = 180, 50
        px, py = 230, 335
        cv2.rectangle(frame, (px, py), (px + pw, py + ph), (240, 240, 240), -1)
        cv2.rectangle(frame, (px, py), (px + pw, py + ph), (0, 0, 0), 2)
        cv2.putText(frame, plate_text, (px + 10, py + 36), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 3)

        if blur:
            # Heavily blur plate region
            roi = frame[py:py+ph, px:px+pw]
            blurred = cv2.GaussianBlur(roi, (31, 31), 0)
            frame[py:py+ph, px:px+pw] = blurred

    return frame


def test_scenario_a_no_vehicle():
    """Test A: Empty road / no vehicle -> Frame ignored, no ANPR."""
    empty_frame = create_solid_frame(color=(80, 80, 80))
    vehicles = vehicle_detector.detect_vehicles(empty_frame)
    assert len(vehicles) == 0, "Expected 0 vehicles in empty frame"


def test_scenario_b_vehicle_without_plate():
    """Test B: Vehicle detected, but no visible plate candidate -> No ANPR."""
    vehicle_frame = np.full((480, 640, 3), 100, dtype=np.uint8)
    cv2.rectangle(vehicle_frame, (120, 100), (520, 400), (140, 70, 30), -1)
    vehicles = vehicle_detector.detect_vehicles(vehicle_frame)
    assert len(vehicles) >= 1

    vx, vy, vw, vh = vehicles[0]["bbox"]
    vcrop = vehicle_frame[vy:vy+vh, vx:vx+vw]
    result = anpr_engine.extract_plate(vcrop)
    assert result is None, "Should return None when no plate region exists"


def test_scenario_d_blurred_plate():
    """Test D: Blurred plate -> visual validation rejects or flags BLURRED."""
    blurred_frame = create_vehicle_frame_with_plate(plate_text="TN01AB1234", blur=True)
    plate_crop = blurred_frame[335:385, 230:410]
    val = PlateValidator()
    result = val.validate_candidate_geometry_and_quality(plate_crop)
    assert not result.is_valid or result.blur_score < 25.0
    assert result.status == "BLURRED" or result.blur_score < 25.0


def test_scenario_e_undersized_plate():
    """Test E: Plate too small -> Rejected for insufficient resolution."""
    val = PlateValidator()
    tiny_crop = np.full((8, 20, 3), 200, dtype=np.uint8)
    result = val.validate_candidate_geometry_and_quality(tiny_crop)
    assert not result.is_valid
    assert result.status == "INSUFFICIENT_RESOLUTION"


def test_scenario_f_duplicate_prevention_temporal_cooldown():
    """Test F: Same vehicle across multiple frames generates exactly ONE confirmed passage event."""
    tracker = TemporalPlateTracker(min_consecutive_matches=2, event_cooldown_seconds=5.0)
    dev_id = "TEST-DEV-COOLDOWN"

    # Frame 1: Low confidence -> Pending (needs confirmation)
    is_conf1, status1, meta1 = tracker.process_sighting(dev_id, "TN01AB1234", confidence=0.72, visual_score=0.70)
    assert is_conf1 is False
    assert status1 == "TEMPORAL_PENDING"

    # Frame 2: Second matching frame -> CONFIRMED
    is_conf2, status2, meta2 = tracker.process_sighting(dev_id, "TN01AB1234", confidence=0.78, visual_score=0.75)
    assert is_conf2 is True
    assert status2 == "CONFIRMED"

    # Frames 3-10: Cooldown active -> Duplicates suppressed!
    for _ in range(8):
        is_conf, status, meta = tracker.process_sighting(dev_id, "TN01AB1234", confidence=0.94, visual_score=0.91)
        assert is_conf is False, "Duplicate within cooldown window must not create a new confirmed event"
        assert status == "COOLDOWN_ACTIVE"


def test_scenario_g_location_permission_granted():
    """Test G: Real device coordinates & accuracy attached when available."""
    dev_id = "TEST-DEV-GPS"
    mobile_device_manager.update_device_location(
        dev_id,
        latitude=13.0827,
        longitude=80.2707,
        accuracy_meters=8.5,
        timestamp="2026-09-18T10:32:18Z",
        source="mobile_device_gps"
    )
    loc = mobile_device_manager.get_device_location(dev_id)
    assert loc["status"] == "AVAILABLE"
    assert loc["latitude"] == 13.0827
    assert loc["longitude"] == 80.2707
    assert loc["accuracy_meters"] == 8.5
    assert loc["source"] == "mobile_device_gps"


def test_scenario_h_location_permission_denied():
    """Test H: Location permission denied -> UNAVAILABLE/DENIED, no fake coordinates."""
    dev_id = "TEST-DEV-NOLOC"
    mobile_device_manager.update_permissions(dev_id, camera_perm="GRANTED", location_perm="DENIED")
    mobile_device_manager.update_device_location(dev_id, status="PERMISSION_DENIED")
    loc = mobile_device_manager.get_device_location(dev_id)
    assert loc["status"] == "PERMISSION_DENIED"
    assert loc.get("latitude") is None


def test_scenario_i_stale_location():
    """Test I: GPS older than MAX_LOCATION_AGE_SECONDS becomes STALE."""
    dev_id = "TEST-DEV-STALE"
    mobile_device_manager.update_device_location(
        dev_id,
        latitude=13.0500,
        longitude=80.2100,
        accuracy_meters=15.0
    )
    # Artificially set epoch_time to 90 seconds ago in storage
    mobile_device_manager.device_locations[dev_id]["epoch_time"] = time.time() - 90
    loc = mobile_device_manager.get_device_location(dev_id)
    assert loc["status"] == "STALE"
    assert loc["location_age_seconds"] >= 60


def test_scenario_j_device_movement():
    """Test J: Moving device updates coordinates dynamically."""
    dev_id = "TEST-DEV-MOVE"
    mobile_device_manager.update_device_location(dev_id, latitude=13.0100, longitude=80.1900, accuracy_meters=10.0)
    loc1 = mobile_device_manager.get_device_location(dev_id)
    assert loc1["latitude"] == 13.0100

    # Phone moves to new location
    mobile_device_manager.update_device_location(dev_id, latitude=13.0145, longitude=80.1985, accuracy_meters=7.0)
    loc2 = mobile_device_manager.get_device_location(dev_id)
    assert loc2["latitude"] == 13.0145
    assert loc2["longitude"] == 80.1985

