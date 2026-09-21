import sys
import os
import base64

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from starlette.testclient import TestClient
from app.api.v1.traffic import router as traffic_router

def run_tests():
    test_app = FastAPI()
    test_app.include_router(traffic_router, prefix="/api/v1")
    client = TestClient(test_app)

    print("==================================================")
    print("VIGITRA PHOTO STORAGE & MUTABLE LOCATION VERIFICATION")
    print("==================================================")

    # 1. Test Admin Mutable Location: update location to a custom checkpoint
    custom_location = "Anna Salai Checkpoint 4 (Admin Mutable Override)"
    print(f"\n[TEST 1] Setting Admin Mutable Location to: '{custom_location}'")
    loc_payload = {
        "user_id": "ADMIN-OPERATOR-01",
        "latitude": 13.0604,
        "longitude": 80.2496,
        "accuracy_meters": 5.0,
        "address_label": custom_location,
        "permission_status": "GRANTED"
    }
    r = client.post("/api/v1/web/location", json=loc_payload)
    assert r.status_code == 200, f"Failed to set location: {r.status_code} {r.text}"
    print("✓ Successfully saved admin mutable location via POST /api/v1/web/location")

    # 2. Retrieve location
    r = client.get("/api/v1/web/location")
    assert r.status_code == 200, f"Failed to get location: {r.status_code} {r.text}"
    fetched_loc = r.json()
    assert fetched_loc["address_label"] == custom_location, f"Mismatch: {fetched_loc}"
    print(f"✓ Verified location retrieval via GET /api/v1/web/location: {fetched_loc['address_label']}")

    # 3. Create a valid test JPEG base64 payload
    import cv2
    import numpy as np
    dummy_img = np.zeros((200, 300, 3), dtype=np.uint8)
    dummy_img[:] = (20, 40, 80)
    cv2.putText(dummy_img, "TN01AB1234", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
    _, buf = cv2.imencode(".jpg", dummy_img)
    test_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("utf-8")

    # 4. Test Field Photo Capture with explicit custom location
    print("\n[TEST 2] Testing Field Photo Capture with explicit location...")
    photo_payload_1 = {
        "operator_id": "ADMIN-OPERATOR",
        "location": custom_location,
        "photo_base64": test_b64,
        "device_id": "WEB-STATION-CAM"
    }
    r = client.post("/api/v1/field/capture-photo", json=photo_payload_1)
    assert r.status_code in [200, 201], f"Photo capture failed: {r.status_code} {r.text}"
    res_1 = r.json()
    print(f"✓ Photo successfully created: Record ID = {res_1['record_id']}")
    print(f"  Location stored: {res_1['location']}")
    print(f"  File URL: {res_1['file_url']}")
    assert res_1['location'] == custom_location, f"Location mismatch in photo: {res_1['location']}"

    # Verify physical file existence on disk
    file_rel_path = res_1['file_url'].lstrip("/")
    disk_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", file_rel_path))
    print(f"  Checking physical disk file: {disk_path}")
    assert os.path.exists(disk_path), f"Disk file does not exist: {disk_path}"
    file_size = os.path.getsize(disk_path)
    assert file_size > 0, f"Disk file is empty: {file_size} bytes"
    print(f"✓ Physical file confirmed on disk ({file_size} bytes)")

    # 5. Test Field Photo Capture WITHOUT location (must fallback to latest web user location)
    print("\n[TEST 3] Testing Field Photo Capture without location (fallback to admin mutable location)...")
    photo_payload_2 = {
        "operator_id": "ADMIN-OPERATOR",
        "photo_base64": test_b64,
        "device_id": "WEB-STATION-CAM"
    }
    r = client.post("/api/v1/field/capture-photo", json=photo_payload_2)
    assert r.status_code in [200, 201], f"Photo capture failed: {r.status_code} {r.text}"
    res_2 = r.json()
    print(f"✓ Photo successfully created with fallback: Record ID = {res_2['record_id']}")
    print(f"  Fallback Location stored: {res_2['location']}")
    assert res_2['location'] == custom_location, f"Fallback location failed: {res_2['location']}"

    # 6. Test Records endpoint retrieves both photos with location
    print("\n[TEST 4] Testing GET /api/v1/records?record_type=PHOTOS...")
    r = client.get("/api/v1/records?record_type=PHOTOS")
    assert r.status_code == 200, f"Records retrieval failed: {r.status_code} {r.text}"
    records = r.json()
    photo_records = [rec for rec in records if rec.get("record_id") in [res_1["record_id"], res_2["record_id"]]]
    assert len(photo_records) >= 2, f"Could not find captured photos in records: {len(photo_records)}"
    for pr in photo_records:
        print(f"✓ Found Record {pr['record_id']} in Records archive: Type={pr['type']}, Location={pr['location']}, Image={pr['file_url']}")

    print("\n==================================================")
    print("ALL TESTS PASSED! Admin Mutable Location & Photo Storage Verified.")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
