# National Hackathon Demonstration Guide

This guide maps out the step-by-step demonstration flow for the VIGITRA platform during hackathon evaluations.

---

## Step-by-Step Demo Script

- **STEP 1: Secure Operator Login**
  - Access `http://127.0.0.1:5173/login`. Enter credentials `admin` / `admin123`.
  - Highlight JWT-based role-based access token verification.

- **STEP 2: Open Command Center**
  - View the main Operator Command Center dashboard (`/`).
  - Demonstrate active KPI metrics: Online Cameras count, Active Vehicles, Active incidents, and Emergency overrides.

- **STEP 3: Show Camera Network**
  - Access the Live Cameras page (`/cameras`).
  - Show the cameras list connected to active intersections.

- **STEP 4: Open Live/Test Video Stream**
  - Navigate to a camera details page (e.g. `CCTV-01-North` details).
  - Open the active video feed processing `sample_traffic.mp4`.

- **STEP 5: Show Vehicle Object Tracking**
  - View bounding boxes overlaid around vehicles (car, ambulance, bus).
  - Point out that tracking coordinates match moving tracks over frame intervals.

- **STEP 6: Show License Plate Detection Region**
  - Point out the white rectangular plate crops isolated on the bottom of vehicles in the video feed.

- **STEP 7: Show OCR Result & Confidences**
  - Observe the live binarized characters extracted and decoded (e.g. `TN01AB1234`, `KA05MN3821`).
  - Check the output metrics cards displaying detection, OCR, and final confidence scores.

- **STEP 8: Search a License Plate**
  - Access the Vehicle Search page (`/vehicle-search`).
  - Input `TN01AB1234` and hit search.

- **STEP 9: Journey Telemetry Report**
  - Observe calculated journey telemetry: First/Last seen, Cameras Visited, Duration, Estimated Distance, and Average Speeds.
  - Review the chronological sighting timeline.

- **STEP 10: GIS Trajectory Polyline**
  - Navigate to Trajectories (`/trajectories`). Input `TN01AB1234`.
  - Check the thick colored route polyline drawn dynamically across Leaflet map camera nodes.

- **STEP 11: City-Wide Traffic Analytics**
  - Navigate to Traffic Analytics (`/analytics`).
  - Point out vehicle volume levels, average speeds, queue metrics, and class distribution graphs.

- **STEP 12: Origin-Destination matrix**
  - Navigate to Origin-Destination (`/origin-destination`).
  - Check the Trip count flows and average transit durations between Zone matrices.

- **STEP 13: Congestion Bottlenecks**
  - Navigate to Bottlenecks (`/bottlenecks`).
  - Show intersections ranked in descending order of queue-density delay scores.

- **STEP 14: Real-Time Traffic Heatmap**
  - Navigate to GIS Traffic Map (`/heatmap`).
  - Check the colored circular density rings (green/orange/red/purple) updating automatically when traffic changes.

- **STEP 15: Blacklisted Plate Trigger**
  - Search `KA05MN3821` on the blacklist page (`/blacklist`). Add it to the watchlist.
  - Observe the red watchlist match alert card popping up instantly on the Alerts center dashboard via WebSocket signals.

- **STEP 16: Route Anomaly Detection**
  - Sighting `DL02CP9012` at Camera 1 and Camera 2 within 10 seconds triggers a **`ROUTE_ANOMALY`** alert.
  - Navigate to Route Anomalies (`/route-anomalies`) to inspect speed violation metrics.

- **STEP 17: Adaptive Signal Optimization**
  - Open Signal AI Optimizer (`/signals`).
  - Demonstrate recommended green durations bounding strictly within 15s to 120s safety limits based on queue telemetry.

- **STEP 18: GenAI Assistant Queries**
  - Navigate to AI Assistant (`/ai-assistant`).
  - Ask: `"Where was TN01AB1234 last detected?"` or `"Show blacklisted vehicle alerts."`
  - Verify that answers pull factual data directly from DB tables.

- **STEP 19: Operations Report**
  - Navigate to Report Generator (`/reports`). Click Daily Performance.
  - Generate a formatted operations report summarizing vehicle volumes, incident logs, and violations.
