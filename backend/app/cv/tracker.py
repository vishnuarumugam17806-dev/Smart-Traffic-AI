"""
Multi-object IoU Tracker for vehicle trajectories.
Tracks detected vehicle bounding boxes across consecutive frames using Intersection over Union (IoU)
and a constant-velocity kinematic projection model for occluded objects.
"""

from typing import List, Tuple, Dict, Any, Optional
import numpy as np


class TrackedObject:
    """Represents a tracked vehicle with identity, spatial trajectory history, velocity, and speed."""

    def __init__(self, track_id: int, bbox: List[int], label: str, confidence: float) -> None:
        self.track_id: int = track_id
        self.bbox: List[int] = bbox  # [x1, y1, x2, y2]
        self.label: str = label
        self.confidence: float = confidence
        self.hits: int = 1
        self.time_since_update: int = 0
        self.centroid: List[float] = [(bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0]
        self.history: List[List[float]] = [self.centroid]
        self.speed_kmh: float = 0.0
        self.velocity: List[float] = [0.0, 0.0]
        self.direction: str = "NORTH"
        self.lane: int = int(self.centroid[0] / 200) % 3 + 1
        self.plate_info: Optional[Dict[str, Any]] = None

    def update(self, bbox: List[int], confidence: float) -> None:
        """Updates track with newly matched detection bounding box and recomputes velocity and lane."""
        new_centroid = [(bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0]
        dx = new_centroid[0] - self.centroid[0]
        dy = new_centroid[1] - self.centroid[1]
        self.velocity = [dx, dy]

        # Convert 2D pixel displacement to estimated speed in km/h based on empirical camera calibration
        dist_px = float(np.sqrt(dx * dx + dy * dy))
        self.speed_kmh = round(dist_px * 0.8, 1)

        # Estimate cardinal direction of movement
        if dist_px > 1.0:
            if abs(dx) > abs(dy):
                self.direction = "EAST" if dx > 0 else "WEST"
            else:
                self.direction = "SOUTH" if dy > 0 else "NORTH"

        self.bbox = bbox
        self.confidence = confidence
        self.hits += 1
        self.time_since_update = 0
        self.centroid = new_centroid
        self.history.append(self.centroid)
        if len(self.history) > 30:
            self.history.pop(0)

        self.lane = int(self.centroid[0] / 200) % 3 + 1

    def predict(self) -> None:
        """Projects current state forward when temporarily occluded using the last known velocity vector."""
        vx, vy = self.velocity
        self.bbox = [
            int(self.bbox[0] + vx),
            int(self.bbox[1] + vy),
            int(self.bbox[2] + vx),
            int(self.bbox[3] + vy),
        ]
        self.centroid = [(self.bbox[0] + self.bbox[2]) / 2.0, (self.bbox[1] + self.bbox[3]) / 2.0]
        self.history.append(self.centroid)
        if len(self.history) > 30:
            self.history.pop(0)
        self.lane = int(self.centroid[0] / 200) % 3 + 1


class IoUTracker:
    """Associates detections between frames based on Intersection over Union (IoU) overlap."""

    def __init__(self, iou_threshold: float = 0.3, max_age: int = 15) -> None:
        self.iou_threshold: float = iou_threshold
        self.max_age: int = max_age
        self.tracked_objects: List[TrackedObject] = []
        self.next_id: int = 1

    @staticmethod
    def compute_iou(box_a: List[int], box_b: List[int]) -> float:
        """Computes Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2]."""
        x_a = max(box_a[0], box_b[0])
        y_a = max(box_a[1], box_b[1])
        x_b = min(box_a[2], box_b[2])
        y_b = min(box_a[3], box_b[3])

        inter_w = max(0, x_b - x_a)
        inter_h = max(0, y_b - y_a)
        inter_area = inter_w * inter_h

        box_a_area = max(0, box_a[2] - box_a[0]) * max(0, box_a[3] - box_a[1])
        box_b_area = max(0, box_b[2] - box_b[0]) * max(0, box_b[3] - box_b[1])

        denominator = float(box_a_area + box_b_area - inter_area)
        if denominator <= 0:
            return 0.0

        return inter_area / (denominator + 1e-6)

    def update(self, detections: List[Dict[str, Any]]) -> List[TrackedObject]:
        """
        Matches detections to existing tracks using greedy IoU matching.
        Unmatched existing tracks are predicted forward until max_age is exceeded.
        """
        updated_tracks: List[TrackedObject] = []
        unmatched_detections: List[int] = list(range(len(detections)))

        for track in self.tracked_objects:
            track.time_since_update += 1
            best_iou = 0.0
            best_det_idx = -1

            for idx in unmatched_detections:
                det = detections[idx]
                if det.get("label") == track.label:
                    iou = self.compute_iou(track.bbox, det["bbox"])
                    if iou > best_iou:
                        best_iou = iou
                        best_det_idx = idx

            if best_iou >= self.iou_threshold and best_det_idx != -1:
                det = detections[best_det_idx]
                track.update(det["bbox"], det.get("confidence", 0.85))
                updated_tracks.append(track)
                unmatched_detections.remove(best_det_idx)
            elif track.time_since_update <= self.max_age:
                track.predict()
                updated_tracks.append(track)

        # Create new tracks for unmatched detections
        for idx in unmatched_detections:
            det = detections[idx]
            new_track = TrackedObject(
                self.next_id,
                det["bbox"],
                det.get("label", "car"),
                det.get("confidence", 0.85),
            )
            self.next_id += 1
            updated_tracks.append(new_track)

        self.tracked_objects = updated_tracks
        return self.tracked_objects
