import sys
import os

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.models import Camera, Blacklist, EvidenceRecord, PlateObservation

client = TestClient(app)

print("--- TEST 1: Registering target vehicle in directory ---")
payload = {
    "plate": "TN09LOC7777",
    "reason": "Stolen Luxury Sedan Tracked at Live Checkpoint",
    "directory_type": "STOLEN_VEHICLES",
    "severity": "CRITICAL",
    "location": "Live GPS Checkpoint (13.0827°, 80.2707°)",
    "vehicle_model": "BMW 3 Series (Dark Blue)",
    "owner_name": "Karthik Raja",
    "fir_number": "FIR-2026/8890",
    "police_station": "Anna Salai Traffic PS",
    "auto_alert": True,
    "notes": "High priority interception order"
}
res = client.post("/api/v1/anpr/directories", json=payload)
print("Directory Registration Status:", res.status_code)
assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
data = res.json()
print("Registered Plate:", data["plate"])
print("Registered Location:", data["location"])
print("Registered Category:", data["directory_type"])

print("\n--- TEST 2: Verifying EvidenceRecord in DB ---")
db = SessionLocal()
evd = db.query(EvidenceRecord).filter(EvidenceRecord.plate_number == "TN09LOC7777").first()
assert evd is not None, "EvidenceRecord not found in DB!"
print("Found EvidenceRecord ID:", evd.record_id)
print("Evidence Location:", evd.location)
print("Evidence Event Type:", evd.event_type)

print("\n--- TEST 3: Verifying /records API endpoint returns registered evidence ---")
rec_res = client.get("/api/v1/records?plate_number=TN09LOC7777")
assert rec_res.status_code == 200, f"Expected 200, got {rec_res.status_code}"
rec_items = rec_res.json()
print("Records returned count:", len(rec_items))
assert len(rec_items) >= 1, "Record not found in /records API response!"
rec_first = rec_items[0]
print("Record ID:", rec_first["record_id"])
print("Record Type:", rec_first["type"])
print("Record Location:", rec_first["location"])
print("Record File URL:", rec_first["file_url"])

print("\n--- TEST 4: Verifying /web/location API endpoint ---")
loc_payload = {
    "user_id": "WEB-OPERATOR-TEST",
    "latitude": 13.0827,
    "longitude": 80.2707,
    "accuracy_meters": 8.5,
    "address_label": "Anna Salai Spencers Junction, Chennai (13.0827°, 80.2707°)",
    "permission_status": "GRANTED"
}
loc_res = client.post("/api/v1/web/location", json=loc_payload)
print("Web Location POST Status:", loc_res.status_code)
assert loc_res.status_code == 200, f"Expected 200, got {loc_res.status_code}"
loc_data = loc_res.json()
print("Location saved status:", loc_data["status"])
print("Location accuracy:", loc_data["location"]["accuracy_meters"])
print("Location address:", loc_data["location"]["address_label"])

get_loc_res = client.get("/api/v1/web/location")
assert get_loc_res.status_code == 200
print("Web Location GET Verified:", get_loc_res.json()["permission_status"])

db.close()
print("\n>>> ALL 4 VERIFICATION TESTS PASSED SUCCESSFULLY! <<<")
