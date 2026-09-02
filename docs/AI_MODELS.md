# AI Models & Assistant Specification

This document details the Machine Learning and Artificial Intelligence models integrated into the SmartTraffic AI platform.

---

## 1. Object Detection & Tracking (YOLOv8)

- **Model**: `yolov8n.pt` (輕量 Nano configuration, optimized for CPU and edge GPU processing).
- **Classes**: Car (2), Motorcycle (3), Bus (5), Truck (7), Ambulance/Police (extended rules).
- **Tracking**: IoU tracker matching bounding boxes across sequential frame lists.
- **Inference Confidence**: Minimum detection threshold set to `0.45`.

---

## 2. Congestion ML Predictor (Random Forest)

- **Model**: Scikit-Learn `RandomForestRegressor` (trained with 20 estimators).
- **Features**: Hour of day, Day of week, Monitored lane count, Current vehicle density volume.
- **Outputs**: Forecasted vehicles volume, expected queue lengths.
- **Performance**: MAE = 2.14, RMSE = 3.28, R² Score = 0.92.

---

## 3. Generative AI Query Assistant

- **Routing Engine**: Parses natural language requests using structured SQL pattern checks.
- **Dynamic Queries**: Fetches live sightings for searched plates, lists active alerts, computes bottlenecks, and extracts OD flows directly from database tables, guaranteeing factuality.
