import urllib.request
import re
import time
import sys

old_bundle = "assets/index-CwsE5NKm.js"
print(f"Monitoring Render for new bundle replacement (current: {old_bundle})...")

for i in range(1, 25):
    try:
        req = urllib.request.Request("https://vigitra-frontend.onrender.com/", headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8")
        matches = re.findall(r'assets/index-[a-zA-Z0-9_\.-]+\.js', html)
        if matches:
            current = matches[0]
            if current != old_bundle:
                print(f"[SUCCESS] Render deployed new bundle: {current} (was {old_bundle})!")
                sys.exit(0)
            else:
                print(f"[{i}/25] Still {current}. Waiting 10s for Render build pipeline...")
    except Exception as e:
        print(f"[{i}/25] Error checking Render: {e}")
    time.sleep(10)

print("[TIMEOUT] Render build did not deploy within window.")
sys.exit(1)
