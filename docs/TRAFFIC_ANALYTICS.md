# Traffic Flow & OD Analytics Specification

This document details the macro analytics engine of the VIGITRA platform.

---

## 1. Origin-Destination (OD) Matrix

The OD matrix measures trip frequencies between network zones:
1. For each unique vehicle, its first sighting location is defined as the **Origin** and its last sighting is defined as the **Destination**.
2. The engine groups trips by `(origin, destination)` and calculates:
   - **`vehicle_count`**: Total unique vehicles traversed.
   - **`average_travel_time`**: Average elapsed duration.
   - **`average_speed`**: Estimated speed.

---

## 2. Congestion Bottleneck Ranking

Hotspot ranking uses an automated queue-density scoring algorithm:
1. The latest `queue_length` and `vehicle_count` metrics are fetched for each camera.
2. The engine calculates the **Bottleneck Score**:
   $$\text{Score} = (\text{queue\_length} \times 10) + \text{vehicle\_count}$$
3. Nodes are sorted in descending order of their bottleneck scores, prioritizing signal control overrides at critical junctions.
