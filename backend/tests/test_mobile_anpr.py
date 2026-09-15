import pytest
import cv2
import base64
import numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.models.models import PlateObservation, EvidenceRecord, Alert

client = TestClient(app)

def test_mobile_camera_stream_anpr_and_records():
    # 1. Generate synthetic frame with text
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = (30, 30, 30)
    cv2.putText(img, "CAR", (100, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
    cv2.rectangle(img, (200, 300), (440, 380), (255, 255, 255), -1)
    cv2.putText(img, "TN01AB1234", (210, 350), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
    
    _, buffer = cv2.imencode('.jpg', img)
    b64_frame = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

    # 2. Post frame to /api/v1/mobile-camera/stream-frame
    res = client.post("/api/v1/mobile-camera/stream-frame", json={
        "device_id": "TEST-PATROL-01",
        "frame_base64": b64_frame
    })

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "FRAME_ACCEPTED"
    assert data["device_id"] == "TEST-PATROL-01"
    assert data["plate_detected"] is True
    assert data["plate_number"] is not None
    assert data["flag"] in ["WATCHLIST_MATCH", "COMPLIANCE_VIOLATION", "VERIFIED_COMPLIANT", "ANPR_CAPTURED"]
    assert data["record_id"] is not None
    assert data["evidence_url"] is not None

    # 3. Verify desktop live frame endpoint returns plate_info
    desktop_res = client.get("/api/v1/mobile-camera/TEST-PATROL-01/live-frame")
    assert desktop_res.status_code == 200
    desktop_data = desktop_res.json()
    assert desktop_data["has_frame"] is True
    assert desktop_data["plate_info"] is not None
    assert desktop_data["plate_info"]["plate_number"] == data["plate_number"]
