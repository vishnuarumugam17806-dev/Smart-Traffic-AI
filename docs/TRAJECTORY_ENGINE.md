# Vehicle Trajectory Engine Specification

The Trajectory Engine tracks plate numbers city-wide using a geographical camera graph.

---

## 1. Camera Network Graph

The camera network is modeled as a directed graph:
- **Nodes**: Monitored Cameras (`latitude`, `longitude`, `direction`).
- **Edges**: Connected roads (`distance_km`, `expected_travel_time_sec`).

---

## 2. Journey Reconstruction

When a plate number is queried, the engine extracts all associated observations sorted by timestamp:
- **First Seen & Last Seen**: Chronological boundaries of the sighting array.
- **Cameras Visited**: Unique camera nodes visited.
- **Estimated Distance**: Cumulative sum of matching road edges traversed.
- **Average Speed**: Total distance divided by elapsed seconds.

---

## 3. Transition Timing Validation (Route Anomalies)

Each sequential sighting `(obs_i, obs_{i+1})` undergoes speed validation:
1. The engine checks if a road connection exists between the two cameras.
2. If present, it calculates elapsed seconds: `time_diff`.
3. If `time_diff` is physically impossible (e.g. less than `15%` of expected travel time, representing speeds >150 km/h), the engine logs a **`ROUTE_ANOMALY`** entry in the database and triggers a real-time **Alert**.
