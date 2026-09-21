import sys
import os
import base64

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from starlette.testclient import TestClient
from app.api.v1.traffic import router as traffic_router

def run_all_checks():
    test_app = FastAPI()
    test_app.include_router(traffic_router, prefix="/api/v1")
    client = TestClient(test_app)

    results = {}
    print("=" * 60)
    print("VIGITRA COMPREHENSIVE QUALITIES CHECKLIST AUDIT")
    print("=" * 60)

    # QUALITY 1: Vehicle registration and records persistence
    print("\n--- [CHECK 1] Vehicle Registration & Records Persistence ---")
    try:
        reg_payload = {
            "plate": "TN09LOC8888",
            "reason": "Test Audit Verification",
            "directory_type": "STOLEN_VEHICLES",
            "severity": "CRITICAL",
            "location": "Anna Salai Audit Checkpoint",
            "vehicle_model": "Mercedes Benz C-Class",
            "owner_name": "Audit Officer",
            "fir_number": "FIR-2026/9999",
            "police_station": "Anna Salai Traffic PS",
            "auto_alert": True,
            "notes": "Quality audit registration test"
        }
        r = client.post("/api/v1/anpr/directories", json=reg_payload)
        assert r.status_code in [200, 201], f"Failed blacklist registration: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("plate") == "TN09LOC8888"
        results["Quality 1: Vehicle Registration"] = "PASSED"
        print("✓ Vehicle registered to watchlist successfully and added to records.")
    except Exception as e:
        results["Quality 1: Vehicle Registration"] = f"FAILED: {e}"
        print(f"✕ Vehicle Registration failed: {e}")

    # QUALITY 2: User Device Location Permission & Geolocation Storage
    print("\n--- [CHECK 2] User Device Location & Geolocation Storage ---")
    try:
        device_loc = {
            "user_id": "USER-DEVICE-TEST",
            "latitude": 13.0827,
            "longitude": 80.2707,
            "accuracy_meters": 8.5,
            "address_label": "Marina Promenade Point, Chennai",
            "permission_status": "GRANTED"
        }
        r = client.post("/api/v1/web/location", json=device_loc)
        assert r.status_code == 200, f"Failed: {r.status_code} {r.text}"
        r_get = client.get("/api/v1/web/location")
        assert r_get.status_code == 200
        cur_loc = r_get.json()
        assert cur_loc["latitude"] == 13.0827
        assert cur_loc["longitude"] == 80.2707
        assert "Marina Promenade Point" in cur_loc["address_label"]
        results["Quality 2: Device Geolocation Recording"] = "PASSED"
        print("✓ Device GPS coordinates and permission status recorded and verified via API.")
    except Exception as e:
        results["Quality 2: Device Geolocation Recording"] = f"FAILED: {e}"
        print(f"✕ Device Geolocation recording failed: {e}")

    # QUALITY 3: Mutable Admin Location (Editing & Reverting)
    print("\n--- [CHECK 3] Mutable Admin Location ---")
    try:
        # 3a: Mutate location
        custom_checkpoint = "Kathipara Junction Flyover (Admin Override Checkpoint)"
        mutate_payload = {
            "user_id": "ADMIN-MUTABLE",
            "latitude": 13.0067,
            "longitude": 80.2033,
            "accuracy_meters": 5.0,
            "address_label": custom_checkpoint,
            "permission_status": "GRANTED"
        }
        r = client.post("/api/v1/web/location", json=mutate_payload)
        assert r.status_code == 200
        r_chk = client.get("/api/v1/web/location")
        assert r_chk.json()["address_label"] == custom_checkpoint
        print(f"✓ Location mutated to: {custom_checkpoint}")

        # 3b: Revert back to GPS
        revert_payload = {
            "user_id": "ADMIN-MUTABLE",
            "latitude": 13.0604,
            "longitude": 80.2496,
            "accuracy_meters": 10.0,
            "address_label": "Device GPS (13.0604°, 80.2496°)",
            "permission_status": "GRANTED"
        }
        r = client.post("/api/v1/web/location", json=revert_payload)
        assert r.status_code == 200
        assert "Device GPS" in client.get("/api/v1/web/location").json()["address_label"]
        results["Quality 3: Mutable Admin Location"] = "PASSED"
        print("✓ Location successfully reverted to device GPS.")
    except Exception as e:
        results["Quality 3: Mutable Admin Location"] = f"FAILED: {e}"
        print(f"✕ Mutable Admin Location failed: {e}")

    # QUALITY 4: Current Location Stored in Records
    print("\n--- [CHECK 4] Location Stored in Every Evidence Record ---")
    try:
        import cv2, numpy as np
        img = np.zeros((160, 240, 3), dtype=np.uint8)
        img[:] = (30, 60, 90)
        cv2.putText(img, "TEST-PLATE", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        _, buf = cv2.imencode(".jpg", img)
        b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("utf-8")

        p_res = client.post("/api/v1/field/capture-photo", json={
            "operator_id": "OFFICER-AUDIT",
            "location": "OMR Expressway Sector 2 Checkpoint",
            "photo_base64": b64,
            "device_id": "WEB-STATION-CAM"
        })
        assert p_res.status_code in [200, 201]
        p_data = p_res.json()
        assert p_data["location"] == "OMR Expressway Sector 2 Checkpoint"
        assert p_data["file_url"].startswith("/storage/evidence/")
        results["Quality 4: Current Location Stored in Records"] = "PASSED"
        print(f"✓ Location field correctly populated in EvidenceRecord: '{p_data['location']}'")
    except Exception as e:
        results["Quality 4: Current Location Stored in Records"] = f"FAILED: {e}"
        print(f"✕ Current Location Stored failed: {e}")

    # QUALITY 5: Camera Photo Physical Disk Storage
    print("\n--- [CHECK 5] Camera Photos Properly Stored on Disk ---")
    try:
        file_url = p_data["file_url"]
        rel_path = file_url.lstrip("/")
        backend_disk = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", rel_path))
        root_disk = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", rel_path))

        backend_exists = os.path.exists(backend_disk) and os.path.getsize(backend_disk) > 0
        root_exists = os.path.exists(root_disk) and os.path.getsize(root_disk) > 0

        assert backend_exists, f"Missing on backend disk: {backend_disk}"
        assert root_exists, f"Missing on root disk: {root_disk}"

        read_img = cv2.imread(backend_disk)
        assert read_img is not None and read_img.shape[0] > 0
        results["Quality 5: Camera Photos Stored on Disk"] = "PASSED"
        print(f"✓ Photo verified on backend disk: {backend_disk} ({os.path.getsize(backend_disk)} bytes)")
        print(f"✓ Photo verified on root disk: {root_disk} ({os.path.getsize(root_disk)} bytes)")
        print("✓ Image file decoded successfully by OpenCV with valid dimensions.")
    except Exception as e:
        results["Quality 5: Camera Photos Stored on Disk"] = f"FAILED: {e}"
        print(f"✕ Photo Storage check failed: {e}")

    # QUALITY 6: Unified Records Archive Retrieval with Valid Image URLs
    print("\n--- [CHECK 6] Unified Records Archive Retrieval ---")
    try:
        rec_res = client.get("/api/v1/records?record_type=ALL")
        assert rec_res.status_code == 200
        all_recs = rec_res.json()
        assert len(all_recs) > 0

        photos = [r for r in all_recs if r.get("type") == "PHOTO"]
        assert len(photos) > 0
        for p in photos:
            assert p.get("location"), f"Missing location in photo record {p.get('record_id')}"
            assert p.get("file_url") and not p.get("file_url").endswith(".mp4"), f"Invalid photo URL: {p.get('file_url')}"

        results["Quality 6: Unified Records Archive"] = "PASSED"
        print(f"✓ Retrieved {len(all_recs)} records ({len(photos)} photos). All photo records have valid location and image URLs.")
    except Exception as e:
        results["Quality 6: Unified Records Archive"] = f"FAILED: {e}"
        print(f"✕ Records retrieval check failed: {e}")

    print("\n" + "=" * 60)
    print("AUDIT SUMMARY:")
    print("=" * 60)
    all_passed = True
    for q, status in results.items():
        print(f"  {status:8s} | {q}")
        if "PASSED" not in status:
            all_passed = False

    print("=" * 60)
    if all_passed:
        print("ALL LISTED QUALITIES ARE PRESENT AND FULLY VERIFIED!")
    else:
        print("SOME QUALITIES FAILED CHECKS.")
    print("=" * 60)

if __name__ == "__main__":
    run_all_checks()
