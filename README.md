# VIGITRA – City-Wide Intelligent ANPR, Vehicle Trajectory and Traffic Flow Analytics Platform

**VIGITRA** is a centralized smart-city traffic intelligence platform. Reorganized around four primary capabilities—High-Accuracy ANPR/OCR, Single-Plate Trajectory Tracking, Macro Traffic Flow & Movement Analytics, and Real-Time Blacklist/Route Anomaly Alerts—the system ingests distributed CCTV feeds, tracks vehicles using deep learning, reconstructs geographical journey pathways, indexes traffic congestion indices, and broadcasts telemetry to an interactive GIS Command Center.

---

## 🌟 Core Hackathon Features

1. **High-Accuracy ANPR/OCR**: Morphological plate location, Otsu character binarization, projection profiling, and structural OCR classification. Benchmarked via an evaluation framework.
2. **Single-Plate Trajectory tracking**: Camera network graph representation mapping physical coordinates, reconstructing travel time, estimated distance, and speed.
3. **Macro Traffic Flow Analytics**: Dynamic Origin-Destination (OD) trip matrices, queue length estimation, and prioritized congestion bottleneck rankings.
4. **Real-Time Alert Center**: Active watchlists alerts (blacklist matches) and timing transition checks (speed route anomalies) pushed over WebSocket pipelines.

---

## 📁 Project Documentation

All system layouts, algorithms, and presentation guides are documented under `docs/`:

- [**System Architecture**](docs/ARCHITECTURE.md) – Processing ingestion dataflow and backend component maps.
- [**ANPR OCR Pipeline**](docs/ANPR.md) – Morphology filters, Otsu thresholds, and character recognition profiles.
- [**Trajectory Engine**](docs/TRAJECTORY_ENGINE.md) – Directed camera graphs and physical transition speed anomalies.
- [**Traffic & OD Flow**](docs/TRAFFIC_ANALYTICS.md) – Matrix calculations and hotspot bottlenecks ranking algorithms.
- [**Alerts Engine**](docs/ALERT_ENGINE.md) – Watchlist alarms schema and status lifecycle workflows.
- [**GIS Map Binding**](docs/GIS.md) – Leaflet tiles integration, spatial heatmaps, and route polylines.
- [**AI Models & Assistant**](docs/AI_MODELS.md) – YOLOv8 tracking, Random Forest predictions, and factual query parsing.
- [**Security & RBAC**](docs/SECURITY.md) – User permission scopes, JWT, and database audit logs.
- [**Production Deployment**](docs/DEPLOYMENT.md) – Docker Compose configs, environments, and container links.
- [**QA Testing Suite**](docs/TESTING.md) – Pytest commands and ANPR scorecard evaluator.
- [**Hackathon Presentation Script**](docs/HACKATHON_DEMO.md) – Step-by-step 19-step demo guide.
- [**Project Audit Report**](PROJECT_AUDIT.md) – Initial repository code review and roadmap.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js v18+ & npm

### Setup and Seed
Recreate the database and generate high-contrast plates video:
```bash
python scripts/generate_test_video.py
python scripts/seed_db.py
```

### Run Servers (Development)
```bash
python start_all.py
```
- **GIS Command Dashboard**: `http://127.0.0.1:5173`
- **FastAPI OpenAPI Docs**: `http://127.0.0.1:8000/docs`
- **Credentials**: `admin` / `admin123` or `operator` / `operator123`

---

## 🧪 Testing

Run backend tests:
```bash
$env:PYTHONPATH="backend"; python -m pytest backend/tests
```

Run ANPR model benchmark evaluation:
```bash
python ai-engine/evaluation/anpr_evaluator.py
```
Scorecard output is saved at `ANPR_EVALUATION.md`.
