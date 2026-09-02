import pytest
import cv2
import base64
import numpy as np
from app.cv.mobile_manager import MobileDeviceManager, mobile_manager

def test_register_device_session():
    manager = MobileDeviceManager()
    session = manager.register_device_session(
        device_id="device_cam_01",
        camera_id=1,
        operator_id="operator_john",
        location="Silk Board Flyover"
    )
    assert session is not None
    assert session["device_id"] == "device_cam_01"
    assert session["camera_id"] == 1
    assert session["connection_status"] == "CONNECTED"
    assert session["battery_pct"] == 94
    assert "device_cam_01" in manager.active_sessions

def test_push_frame_base64_valid():
    manager = MobileDeviceManager()
    manager.register_device_session("device_cam_02", 2, "op_02", "Indiranagar 100ft Rd")

    # Create synthetic frame and convert to base64 JPEG string
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.circle(img, (50, 50), 30, (0, 255, 0), -1)
    _, buffer = cv2.imencode('.jpg', img)
    b64_str = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

    decoded_frame = manager.push_frame_base64("device_cam_02", b64_str)
    assert decoded_frame is not None
    assert decoded_frame.shape == (100, 100, 3)

    frame_retrieved, meta = manager.get_latest_frame("device_cam_02")
    assert frame_retrieved is not None
    assert meta["device_id"] == "device_cam_02"
    assert meta["status"] == "CONNECTED"

def test_push_frame_unregistered_device():
    manager = MobileDeviceManager()
    decoded = manager.push_frame_base64("unknown_device", "invalid_base64_data")
    assert decoded is None

def test_disconnect_device():
    manager = MobileDeviceManager()
    manager.register_device_session("device_cam_03", 3, "op_03", "Koramangala")
    manager.disconnect_device("device_cam_03")

    session = manager.active_sessions.get("device_cam_03")
    assert session["connection_status"] == "DISCONNECTED"
    assert session["stream_status"] == "STOPPED"
    assert "device_cam_03" not in manager.latest_frames
