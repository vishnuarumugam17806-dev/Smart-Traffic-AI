# GIS Map Specification

The GIS layout provides interactive real-time mapping of network telemetry.

---

## 1. Leaflet Map Engine Binding

To avoid asset loading or loader errors in Vite builds, the GIS page integrates Leaflet dynamically via a CDN:
- Stylesheet: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- Script: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`

---

## 2. Spatial Overlays & Visuals

- **Base Layer**: CartoDB Dark Matter tileset for high contrast dashboard aesthetics.
- **Markers (Nodes)**: Custom SVG pins color-coded by real-time status.
- **Rings (Heatmap)**: Pulsing circles (`L.circle`) whose radii scale based on congestion levels:
  - LOW: Green, radius 100m.
  - MODERATE: Orange, radius 160m.
  - HIGH: Red, radius 220m.
  - SEVERE: Purple, radius 280m.
- **Polylines (Trajectories)**: High-contrast polylines (`L.polyline`) drawn chronologically. Fits bounds to path automatically.
