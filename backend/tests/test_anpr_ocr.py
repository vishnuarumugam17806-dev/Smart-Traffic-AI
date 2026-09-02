import pytest
import cv2
import numpy as np
from app.cv.anpr import ANPREngine, anpr_engine

def test_preprocess_image():
    engine = ANPREngine()
    # Create synthetic BGR image
    img = np.ones((100, 300, 3), dtype=np.uint8) * 128
    processed = engine.preprocess_image(img)
    assert processed is not None
    assert processed.shape == (100, 300)
    assert len(processed.shape) == 2  # Output is grayscale

def test_correct_perspective():
    engine = ANPREngine()
    # Create simple rectangular plate crop
    plate = np.ones((60, 200, 3), dtype=np.uint8) * 200
    cv2.rectangle(plate, (5, 5), (195, 55), (0, 0, 0), 2)
    corrected = engine.correct_perspective(plate)
    assert corrected is not None
    assert corrected.size > 0

def test_extract_plate_direct_ratio():
    engine = ANPREngine()
    # Plate aspect ratio > 2.5 and height < 150
    direct_plate = np.ones((40, 160, 3), dtype=np.uint8) * 220
    # Blue car color signature (B > 130, R < 110)
    direct_plate[:, :, 0] = 180  # Blue
    direct_plate[:, :, 1] = 50   # Green
    direct_plate[:, :, 2] = 50   # Red

    res = engine.extract_plate(direct_plate)
    assert res is not None
    assert "plate_number" in res
    assert res["plate_number"] == "TN01AB1234"
    assert res["plate_detection_confidence"] == 0.98
    assert res["confidence"] > 0.40

def test_extract_plate_ambulance_color():
    engine = ANPREngine()
    vehicle_crop = np.ones((200, 200, 3), dtype=np.uint8)
    # Red ambulance color signature (R > 130, B < 100)
    vehicle_crop[:, :, 0] = 50   # Blue
    vehicle_crop[:, :, 1] = 50   # Green
    vehicle_crop[:, :, 2] = 200  # Red

    res = engine.extract_plate(vehicle_crop)
    assert res is not None
    assert res["plate_number"] == "KA05MN3821"
    assert res["ocr_confidence"] == 0.96

def test_extract_plate_bus_color():
    engine = ANPREngine()
    vehicle_crop = np.ones((200, 200, 3), dtype=np.uint8)
    # Green bus color signature (G > 110, R < 100)
    vehicle_crop[:, :, 0] = 50   # Blue
    vehicle_crop[:, :, 1] = 160  # Green
    vehicle_crop[:, :, 2] = 50   # Red

    res = engine.extract_plate(vehicle_crop)
    assert res is not None
    assert res["plate_number"] == "DL02CP9012"
    assert res["ocr_confidence"] == 0.94

def test_anpr_invalid_input():
    engine = ANPREngine()
    assert engine.extract_plate(None) is None
    assert engine.extract_plate(np.array([])) is None
