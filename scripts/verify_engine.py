import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def http_get(endpoint):
    req = urllib.request.Request(f"{BASE_URL}{endpoint}")
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode())

def http_post(endpoint, data=None):
    payload = json.dumps(data or {}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode())

def main():
    print("=" * 65)
    print("  VIGITRA AI ENGINE VERIFICATION & ACCEPTANCE TEST")
    print("=" * 65)

    # 1. Fetch all intersections
    intersections = http_get("/intersections")
    print(f"\n[+] Total Intersections in System: {len(intersections)}")

    test_junctions = [i for i in intersections if "TEST-JUNCTION" in i["name"]]
    for tj in test_junctions:
        jid = tj["id"]
        jname = tj["name"]
        n_sides = tj["num_approaches"]
        print(f"\n" + "-" * 50)
        print(f"[*] Testing {jname} (ID: {jid}) with {n_sides} Approaches")
        print("-" * 50)

        # Query Signal State
        sig_data = http_get(f"/intersections/{jid}/signal")
        print(f"  - Active Approach : {sig_data.get('active_approach')}")
        print(f"  - State & Countdown: {sig_data.get('state')} ({sig_data.get('countdown')}s)")
        print(f"  - Mode            : {sig_data.get('mode')}")
        print(f"  - Configured Approaches ({len(sig_data['approaches'])}):")
        for app_name, app_val in sig_data["approaches"].items():
            print(f"    * {app_name} [{app_val['direction']}]: Signal={app_val['signal']} | Vehicles={app_val['vehicle_count']} | Queue={app_val['queue_length']} | Score={app_val['priority_score']}pts | Status={app_val['camera_status']}")

        assert len(sig_data["approaches"]) == n_sides, f"Expected {n_sides} approaches, got {len(sig_data['approaches'])}"

        # Query Optimization Metrics
        opt_data = http_get(f"/intersections/{jid}/optimization")
        print(f"  - Priority Scores : {opt_data.get('priority_scores')}")
        print(f"  - Demand Scores   : {opt_data.get('demand_scores')}")
        print(f"  - Explanation     : {opt_data.get('explanation')[:120]}...")

        # Query Decision History
        hist = http_get(f"/intersections/{jid}/decision-history")
        print(f"  - Logged Decisions: {len(hist)} records in database")
        if hist:
            latest = hist[0]
            print(f"    * Latest: [{latest['approach_id']}] Green={latest['green_duration']}s, Queue={latest['queue_length']}, Demand={latest['demand_score']}, Priority={latest['priority_score']}pts")

    print("\n" + "=" * 65)
    print("  ALL TEST JUNCTIONS VERIFIED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    main()
