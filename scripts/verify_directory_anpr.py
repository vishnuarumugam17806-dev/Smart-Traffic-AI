import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import urllib.request
import json
import time

try:
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    USE_TESTCLIENT = True
except Exception as err:
    print(f"TestClient init error: {err}")
    USE_TESTCLIENT = False

BASE_URL = "http://127.0.0.1:8000/api/v1"

def http_get(endpoint):
    if USE_TESTCLIENT:
        res = client.get(f"/api/v1{endpoint}")
        if res.status_code >= 400:
            raise RuntimeError(f"GET {endpoint} failed with {res.status_code}: {res.text}")
        return res.json()
    else:
        req = urllib.request.Request(f"{BASE_URL}{endpoint}")
        with urllib.request.urlopen(req, timeout=8) as response:
            return json.loads(response.read().decode())

def http_post(endpoint, data=None):
    if USE_TESTCLIENT:
        res = client.post(f"/api/v1{endpoint}", json=data or {})
        if res.status_code >= 400:
            raise RuntimeError(f"POST {endpoint} failed with {res.status_code}: {res.text}")
        return res.json()
    else:
        payload = json.dumps(data or {}).encode('utf-8')
        req = urllib.request.Request(
            f"{BASE_URL}{endpoint}",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            return json.loads(response.read().decode())

def main():
    print("=" * 70)
    print("  VIGITRA ANPR DIRECTORIES & AUTOMATIC ALERT VERIFICATION")
    print("=" * 70)

    # 1. Seed Directories
    print("\n[*] 1. Seeding Multi-Category Directories...")
    seed_res = http_post("/anpr/directories/seed")
    print(f"    -> Message: {seed_res.get('message')}")
    print(f"    -> Total Directory Records: {seed_res.get('total_records')}")

    # 2. Query Directories by category
    print("\n[*] 2. Querying Stolen Vehicles Directory...")
    stolen_list = http_get("/anpr/directories?directory_type=STOLEN_VEHICLES")
    print(f"    -> Found {len(stolen_list)} Stolen Vehicles registered:")
    for s in stolen_list[:3]:
        print(f"       • [{s['plate']}] {s['vehicle_model']} | FIR: {s.get('fir_number')} | Severity: {s['severity']}")

    # 3. Add a new Stolen Vehicle to Directory
    test_stolen_plate = f"TN09STOLEN{int(time.time()) % 10000}"
    print(f"\n[*] 3. Registering New Target in Directory: {test_stolen_plate}...")
    add_payload = {
        "plate": test_stolen_plate,
        "directory_type": "STOLEN_VEHICLES",
        "severity": "CRITICAL",
        "reason": "Commercial Armed Burglary Vehicle",
        "vehicle_model": "Mahindra Thar (Black)",
        "owner_name": "R. Vignesh",
        "fir_number": f"FIR-2026/{int(time.time()) % 999}",
        "police_station": "Anna Salai PS",
        "auto_alert": True,
        "notes": "Armed suspects reported inside vehicle."
    }
    added_entry = http_post("/anpr/directories", add_payload)
    print(f"    -> Successfully Registered ID #{added_entry['id']} with Category: {added_entry['directory_type']}")

    # 4. Scan the Stolen Vehicle & Verify Automatic Real-Time Alert
    print(f"\n[*] 4. Simulating ANPR Live Camera Scan of {test_stolen_plate}...")
    scan_res = http_post("/anpr/scan-check", {
        "plate_number": test_stolen_plate,
        "location": "Anna Salai - Spencers Junction Approach",
        "source": "CCTV_ANPR_SCAN",
        "auto_create_alert": True
    })

    print(f"    -> Scanned Plate         : {scan_res['plate_number']}")
    print(f"    -> Directory Matched     : {scan_res['directory_matched']}")
    print(f"    -> Matched Directory     : {scan_res['matched_directory_type']}")
    print(f"    -> Threat Severity       : {scan_res['severity']}")
    print(f"    -> Alert Triggered       : {scan_res['alert_triggered']}")
    print(f"    -> Recommended Action    : {scan_res['recommended_action']}")
    if scan_res.get('alert'):
        print(f"    -> Automatic Alert Created: ID #{scan_res['alert']['id']} | Msg: {scan_res['alert']['message']}")

    assert scan_res["directory_matched"] is True, "Directory should have matched!"
    assert scan_res["matched_directory_type"] == "STOLEN_VEHICLES", "Category must be STOLEN_VEHICLES"
    assert scan_res["alert_triggered"] is True, "Automatic alert must be triggered!"
    assert scan_res["severity"] == "CRITICAL", "Severity must be CRITICAL"

    # 5. Scan a Clean Compliant Vehicle
    print("\n[*] 5. Simulating ANPR Scan of Clean Compliant Vehicle (TNXX1001)...")
    clean_scan = http_post("/anpr/scan-check", {
        "plate_number": "TNXX1001",
        "location": "Chennai Central Junction",
        "source": "CCTV_ANPR_SCAN",
        "auto_create_alert": True
    })
    print(f"    -> Scanned Plate         : {clean_scan['plate_number']}")
    print(f"    -> Directory Matched     : {clean_scan['directory_matched']}")
    print(f"    -> Threat Severity       : {clean_scan['severity']}")
    print(f"    -> Alert Triggered       : {clean_scan['alert_triggered']}")
    assert clean_scan["directory_matched"] is False, "Unlisted vehicle should not match"
    assert clean_scan["alert_triggered"] is False, "No alert should trigger for compliant vehicle"

    print("\n" + "=" * 70)
    print("  ALL ANPR DIRECTORY MANAGEMENT & AUTOMATIC ALERT TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    main()
