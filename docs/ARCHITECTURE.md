# VIGITRA – Architecture Specification

This document details the centralized architecture and data flow of the VIGITRA platform.

---

## 1. System Ingestion Pipeline

The platform runs a unified, linear pipeline that ingests camera inputs and produces Command Center telemetry:

```
Camera Stream (RTSP / Video File)
       ↓
Video Ingestion (cv2.VideoCapture)
       ↓
Vehicle Detection (YOLOv8 / OpenCV Fallback)
       ↓
License Plate Detection & Crop (Morphology)
       ↓
Image Contrast Enhancement (Histogram Equalization)
       ↓
OCR Engine (Binarization & Projection Profiling)
       ↓
Plate Normalization & Verification (Plate regex)
       ↓
Vehicle Identity Sighting Event (Timestamp + GPS coordinates)
       ↓
Cross-Camera Sighting Matching (Database Indexing)
       ↓
Trajectory Journey Reconstruction (Graph Edge traversal)
       ↓
Traffic Analytics & OD Analysis (Matrices calculations)
       ↓
Anomaly Detection (Impossible speeds check)
       ↓
Alert System Logs (Blacklist watchlist alerts)
       ↓
GIS Operator Dashboard (Leaflet UI overlays)
```

---

## 2. Component Layout

- **FastAPI Core (`backend/app/`)**: Runs an asynchronous HTTP API for data queries alongside a persistent background thread that continuously extracts video frames, matches license plates, and pushes real-time events over a WebSocket broadcaster.
- **Zustand React SPA (`frontend/src/`)**: Subscribes to the WebSocket channel to stream live vehicle crossings, alarm notifications, and congestion heatmaps, rendering Leaflet coordinates and Recharts graphs instantly.
- **SQLAlchemy Schema (`backend/app/models/`)**: Manages structural relationships connecting Intersections, Cameras, Roads, PlateObservations, Blacklists, RouteAnomalies, and Active Alerts.
