# Project Audit: VIGITRA

This document contains a comprehensive audit of the existing VIGITRA repository, analyzing the architectural layout, modules, features, dependencies, and outlining what is required to transform it into a national hackathon-ready vehicle tracking and traffic intelligence platform.

---

## 1. Existing Architecture

The existing project uses a decoupled React SPA + FastAPI backend stack, configured with PostgreSQL (and a local SQLite fallback), Redis, and RabbitMQ:

- **Frontend**: Vite + TypeScript + React + Tailwind CSS. Uses Recharts for basic data visualizations. Employs a custom HTML5 canvas to draw mock intersections.
- **Backend**: FastAPI with async router setup. Exposes standard authentication and traffic query routes. Contains a background async worker loop (`app/main.py`) which invokes a computer vision processor.
- **Database**: SQLAlchemy models mapping standard schemas (User, Intersection, Camera, Signal, TrafficMeasurement, EmergencyEvent, Incident, Violation, NumberPlate, TrafficPrediction, SignalDecision, AgentDecision, AuditLog, Notification).
- **Computer Vision (CV)**: Loads `yolov8n.pt` using Ultralytics YOLOv8. Falls back to a custom cv2-based contour detector if YOLOv8 initialization fails. Tracks detected bounding boxes using a simple Intersection-over-Union (IoU) tracker (`cv/tracker.py`).
- **Signal Control & Agents**: Rule-based adaptive phase duration optimizer and coordinators that produce mock explanations for signal adjustments.
- **AI Assistant**: A pattern-matching query answers generator that prints contextual information extracted from the database.

---

## 2. Existing Features

- User authentication (JWT tokens and role-based permissions).
- Basic YOLOv8 vehicle detection, tracking, speed calculation, and counts.
- Background worker loop that broadcasts traffic telemetry over WebSockets to updates on the dashboard.
- Emergency vehicle priority override flag triggering green wave signal times.
- Congestion prediction via Scikit-Learn RandomForestRegressor.
- Coordinator agent capturing decisions from sub-agents.
- Multi-page operator panel structure.

---

## 3. Working Features

- JWT token verification and secure endpoints (`/auth/login`).
- Real-time WebSocket broadcasting system for traffic updates.
- Random Forest model training and inference.
- Multi-agent decision coordinator mapping.
- Core signal controller safety checks (constraining green phase limits between 15s and 120s).

---

## 4. Broken Features

- **Background Video Ingestion**: The background worker loop in `app/main.py` ignores camera URLs and creates blank black arrays (`np.zeros(...)`) for CV inference. Real frames from `sample_traffic.mp4` are never read or analyzed during background processing.
- **ANPR Execution**: No license plate extraction or OCR logic is integrated into the computer vision pipeline. The `ANPREngine` class in `cv/anpr.py` is defined but never imported, instantiated, or used in `detector.py` or the background processing worker. It generates mock KA plate strings based on bounding box positions.

---

## 5. Incomplete Features

- **ANPR OCR Pipeline**: Lacks true OCR (e.g. character recognition or deep learning character classifications).
- **Trajectory Reconstruction**: No single-plate trajectory tracking engine exists. Vehicle plate sightings are not connected across cameras, roads, or junctions.
- **Alert System**: The system only tracks static `violations` and `notifications`. There is no dedicated Alert Center that handles real-time blacklist matches, route anomalies, and wrong-way detections with Acknowledged/Resolved workflow states.
- **Geographic Information System (GIS)**: The Geographic Heatmap is a mockup rendering standard circles on a HTML5 canvas. It does not use Leaflet or show vehicle paths, bottlenecks, or real-time spatial densities.
- **Macro Traffic Flow & OD Analytics**: There is no road-network or camera-network graph. No Origin-Destination (OD) matrix or bottleneck scoring is calculated using real database history.

---

## 6. Duplicate Files
- None. The file layout is clean, but directories are empty or missing critical components.

---

## 7. Dependency Problems
- `leaflet` and CSS stylesheets are not linked in the frontend, preventing the rendering of true interactive GIS layouts.
- Heavy OCR packages (e.g., EasyOCR or Tesseract) are not currently configured for offline usage. We will implement a modular, pluggable OCR pipeline that can use a lightweight pattern recognition classifier or easyocr/tesseract when available, and standard OpenCV character segmentation.

---

## 8. Database Problems

- Lacks tables to record:
  - **Roads**: Representation of edges connecting camera nodes (with distance, expected travel time, and direction constraints).
  - **PlateObservations**: Detailed plate detection events (raw text, normalized text, ocr confidence, detection confidence, camera ID, timestamp, lane, direction).
  - **Blacklist**: Plates marked for monitoring with associated reasons and creator logs.
  - **RouteAnomalies**: Anomalous paths (unexpected camera transitions, impossible travel times).
  - **Alerts**: Dedicated alerts table supporting `BLACKLISTED_VEHICLE`, `ROUTE_ANOMALY`, `LOW_CONFIDENCE_ANPR`, etc.
  - **OriginDestination**: Generated trip counts and travel times between zone matrices.

---

## 9. Frontend Problems

- Missing critical navigation tabs and sub-pages requested for the national hackathon.
- Visual elements rely on static canvas drawings.
- Heatmap page does not render geographical data.
- Search box does not query vehicle history or draw routes.

---

## 10. Backend Problems

- Fast API routers do not expose endpoints for:
  - `/api/v1/trajectories` (single vehicle route timelines).
  - `/api/v1/blacklist` (CRUD for license plate blacklists).
  - `/api/v1/alerts` (management of network-wide alerts).
  - `/api/v1/origin-destination` (OD flow matrix extraction).
  - `/api/v1/bottlenecks` (congestion bottleneck rankings).
  - `/api/v1/anomalies` (route anomaly logs).

---

## 11. AI/CV Problems

- The YOLOv8 model runs on synthetic black frames, meaning it detects zero objects in real operation.
- No evaluation metrics framework (`ai-engine/evaluation/`) to compute Character Accuracy, F1 Score, Precision, and Recall for ANPR performance reporting.

---

## 12. Features Satisfying Hackathon Requirements

- Core database models are mostly well-defined.
- JWT Authentication flow is secure and operational.
- Base YOLOv8 detector and IoU Tracker code are solid starting points.
- ML forecasting engine and multi-agent structures are operational.

---

## 13. Features That Must Be Added

1. **ANPR Pipeline**: Perspective correction, plate crop, character segmentation, modular OCR, and temporal confidence voting.
2. **Trajectory Engine**: Multi-camera cross matching, speed validation, and graph-based route integrity checking.
3. **Traffic Flow & OD Matrix**: Origin-Destination analysis and Bottleneck scoring algorithm.
4. **Alerts & Blacklist Panel**: Real-time alerts for route anomalies and blacklisted license plates.
5. **Interactive GIS Map**: Complete Leaflet map integration displaying cameras, heatmaps, and animated trajectory routes.
6. **Model Evaluation Framework**: Actual mathematical checks for precision, recall, character accuracy, and conditions performance.

---

## 14. Files That Must Be Modified

- `backend/app/models/models.py`: Add tables for Blacklist, Alert, PlateObservation, RouteAnomaly, and Road.
- `backend/app/database/session.py`: Verify model generation.
- `backend/app/cv/detector.py` & `backend/app/cv/anpr.py`: Hook up the vehicle tracks to the license plate recognizer.
- `backend/app/main.py`: Update the background task to read from real video streams/test files (like `sample_traffic.mp4`) and run the full CV + ANPR + Trajectory + Alerts pipeline.
- `backend/app/api/v1/traffic.py`: Add the endpoints for ANPR, trajectories, GIS, alerts, blacklist, anomalies, bottlenecks, and OD flows.
- `backend/app/ai/assistant.py`: Expand assistant query parser to answer queries using real database records.
- `frontend/index.html`: Inject Leaflet stylesheet and script assets.
- `frontend/src/routes/AppRoutes.tsx`: Map new routes.
- `frontend/src/components/Sidebar.tsx`: Update the sidebar options.
- `frontend/src/pages/Dashboard.tsx` & `frontend/src/pages/HeatMap.tsx`: Redesign map and cards around the new GIS capability.

---

## 15. Files That Should Be Removed
- None.

---

## 16. Recommended Final Architecture

We will implement a clean, decoupled architecture:

```
VIGITRA/
├── backend/
│   ├── app/
│   │   ├── api/v1/           # Exposed routes (auth, traffic, ANPR, trajectories, alerts, assistant)
│   │   ├── core/             # Configuration & security
│   │   ├── database/         # Database engine session
│   │   ├── models/           # SQLAlchemy models including new alert/blacklist/trajectory tables
│   │   ├── cv/               # Computer vision processor, YOLO detector, and IoU tracker
│   │   ├── anpr/             # Modular license plate extraction and OCR pipeline
│   │   ├── trajectory/       # Camera graph engine and physical route validation logic
│   │   ├── services/         # Predictions and Operations reports generator
│   │   ├── websocket/        # Real-time message broadcaster
│   │   └── main.py           # Video stream ingestion and pipeline orchestrator
│   └── tests/                # Pipeline, trajectory, ANPR, and signal optimizer tests
├── frontend/
│   ├── src/
│   │   ├── components/       # Custom GIS maps, charts, and signal indicators
│   │   ├── pages/            # Dashboard, Search, Trajectories, Alerts, OD, Bottlenecks, etc.
│   │   └── store/            # Zustand global state store
│   └── package.json
└── ai-engine/
    └── evaluation/           # Accuracy, precision, recall, and character evaluation framework
```
