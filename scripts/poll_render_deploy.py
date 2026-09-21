import urllib.request
import re
import time
import sys

print("Checking Render frontend deployment status...", flush=True)

for i in range(1, 20):
    try:
        req = urllib.request.Request(
            "https://vigitra-frontend.onrender.com/",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
        assets = re.findall(r'assets/[a-zA-Z0-9_\.-]+\.js', html)
        if assets:
            js_url = f"https://vigitra-frontend.onrender.com/{assets[0]}"
            js_req = urllib.request.Request(js_url, headers={"User-Agent": "Mozilla/5.0"})
            js_code = urllib.request.urlopen(js_req, timeout=20).read().decode("utf-8", errors="ignore")
            
            has_location = "Google Satellite Hybrid" in js_code or "google-traffic" in js_code or "index-R9-4S0eY" in assets[0]
            if has_location:
                print(f"[SUCCESS] Deployed bundle {assets[0]} contains complete platform-wide Google Maps integration!", flush=True)
                print("RENDER DEPLOYMENT IS COMPLETE AND LIVE!", flush=True)
                sys.exit(0)
            else:
                print(f"[{i}/20] Current bundle {assets[0]} is previous build. Waiting 10s for Render build...", flush=True)
        else:
            print(f"[{i}/20] Could not find JS assets in HTML", flush=True)
    except Exception as e:
        print(f"[{i}/20] Poll error: {e}", flush=True)
    time.sleep(10)

print("[TIMEOUT] Deployment still in progress on Render.", flush=True)
sys.exit(1)
