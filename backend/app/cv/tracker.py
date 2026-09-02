import numpy as np

class TrackedObject:
    def __init__(self, track_id: int, bbox: list, label: str, confidence: float):
        self.track_id = track_id
        self.bbox = bbox  # [x1, y1, x2, y2]
        self.label = label
        self.confidence = confidence
        self.hits = 1
        self.time_since_update = 0
        self.centroid = [(bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0]
        self.history = [self.centroid]
        self.speed_kmh = 0.0
        self.velocity = [0.0, 0.0]
        self.direction = "NORTH"
        self.lane = int(self.centroid[0] / 200) % 3 + 1

    def update(self, bbox: list, confidence: float):
        new_centroid = [(bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0]
        dx = new_centroid[0] - self.centroid[0]
        dy = new_centroid[1] - self.centroid[1]
        self.velocity = [dx, dy]
        
        # Calculate speed estimate based on centroid movement
        dist_px = np.sqrt(dx*dx + dy*dy)
        # Convert px movement to estimated km/h (rough scaling factor for 30fps)
        self.speed_kmh = round(float(dist_px * 0.8), 1)

        # Estimate direction
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

        # Re-evaluate lane based on new centroid
        self.lane = int(self.centroid[0] / 200) % 3 + 1

    def predict(self):
        """Project current state forward when occluded/missed using velocity."""
        vx, vy = self.velocity
        self.bbox = [
            self.bbox[0] + vx,
            self.bbox[1] + vy,
            self.bbox[2] + vx,
            self.bbox[3] + vy
        ]
        self.centroid = [(self.bbox[0] + self.bbox[2]) / 2.0, (self.bbox[1] + self.bbox[3]) / 2.0]
        self.history.append(self.centroid)
        if len(self.history) > 30:
            self.history.pop(0)
        self.lane = int(self.centroid[0] / 200) % 3 + 1

class IoUTracker:
    def __init__(self, iou_threshold: float = 0.3, max_age: int = 15):
        self.iou_threshold = iou_threshold
        self.max_age = max_age
        self.tracked_objects = []
        self.next_id = 1

    def compute_iou(self, boxA, boxB):
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
        boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

        iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
        return iou

    def update(self, detections: list):
        # Format of detections: [{'bbox': [x1, y1, x2, y2], 'label': 'car', 'confidence': 0.85}, ...]
        updated_tracks = []
        unmatched_detections = list(range(len(detections)))

        for track in self.tracked_objects:
            track.time_since_update += 1
            best_iou = 0.0
            best_det_idx = -1

            for idx in unmatched_detections:
                det = detections[idx]
                if det['label'] == track.label:
                    iou = self.compute_iou(track.bbox, det['bbox'])
                    if iou > best_iou:
                        best_iou = iou
                        best_det_idx = idx

            if best_iou >= self.iou_threshold and best_det_idx != -1:
                det = detections[best_det_idx]
                track.update(det['bbox'], det['confidence'])
                updated_tracks.append(track)
                unmatched_detections.remove(best_det_idx)
            elif track.time_since_update <= self.max_age:
                # Project forward using linear velocity model
                track.predict()
                updated_tracks.append(track)

        # Create new tracks for unmatched detections
        for idx in unmatched_detections:
            det = detections[idx]
            new_track = TrackedObject(self.next_id, det['bbox'], det['label'], det['confidence'])
            self.next_id += 1
            updated_tracks.append(new_track)

        self.tracked_objects = updated_tracks
        return self.tracked_objects
