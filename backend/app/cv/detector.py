import cv2
import numpy as np
import logging
from typing import Dict, Any, List
from app.cv.tracker import IoUTracker
from app.cv.anpr import ANPREngine

logger = logging.getLogger(__name__)

# COCO Vehicle Class Mappings & Emergency extensions
VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
    1: "bicycle",
    0: "pedestrian"
}

EMERGENCY_CLASSES = ["ambulance", "fire_truck", "police"]

class TrafficVisionProcessor:
    def __init__(self, confidence_threshold: float = 0.45):
        self.conf_threshold = confidence_threshold
        self.tracker = IoUTracker(iou_threshold=0.3, max_age=15)
        self.yolo_model = None
        self.anpr_engine = ANPREngine()
        self._load_model()

    def _load_model(self):
        try:
            from ultralytics import YOLO
            logger.info("Loading YOLOv8 model for traffic detection...")
            self.yolo_model = YOLO("yolov8n.pt")  # Lightweight nano model
            logger.info("YOLOv8 model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load YOLOv8 model ({e}). Using OpenCV Background Subtractor CV engine.")
            self.yolo_model = None

    def process_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Processes a single video frame.
        Returns detailed analytics: detections, tracks, counts, density, queues, incidents, emergency vehicles, and ANPR results.
        """
        h, w, _ = frame.shape
        raw_detections = []

        if self.yolo_model is not None:
            results = self.yolo_model(frame, verbose=False, conf=self.conf_threshold)[0]
            for box in results.boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = box.xyxy[0].cpu().numpy().tolist()
                label = VEHICLE_CLASSES.get(cls_id, None)

                # Custom rule: check standard vehicle classes
                if label is not None or cls_id in [2, 3, 5, 7]:
                    name = label if label else "car"
                    # Color-based emergency vehicle heuristic mapping
                    x1, y1, x2, y2 = max(0, int(xyxy[0])), max(0, int(xyxy[1])), min(w, int(xyxy[2])), min(h, int(xyxy[3]))
                    crop = frame[y1:y2, x1:x2]
                    if crop.size > 0:
                        avg_color = np.mean(crop, axis=(0, 1))
                        b_avg, g_avg, r_avg = avg_color[0], avg_color[1], avg_color[2]
                        if r_avg > 130 and b_avg < 100:
                            name = "ambulance"
                    raw_detections.append({
                        "bbox": [int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])],
                        "label": name,
                        "confidence": round(conf, 2)
                    })
        else:
            # Fallback CV analysis using contour detection
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            thresh = cv2.threshold(blur, 60, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > 1200:
                    x, y, bw, bh = cv2.boundingRect(cnt)
                    name = "car" if area < 4000 else "bus"
                    # Color-based emergency vehicle heuristic mapping
                    crop = frame[max(0, y):min(h, y+bh), max(0, x):min(w, x+bw)]
                    if crop.size > 0:
                        avg_color = np.mean(crop, axis=(0, 1))
                        b_avg, g_avg, r_avg = avg_color[0], avg_color[1], avg_color[2]
                        if r_avg > 130 and b_avg < 100:
                            name = "ambulance"
                    raw_detections.append({
                        "bbox": [x, y, x + bw, y + bh],
                        "label": name,
                        "confidence": 0.85
                    })

        # Update Tracker
        tracked_objects = self.tracker.update(raw_detections)

        # Vehicle counts by type
        vehicle_counts = {}
        emergency_detected = []
        stopped_vehicles = 0
        total_occupancy_area = 0

        annotated_frame = frame.copy()

        for track in tracked_objects:
            lbl = track.label
            vehicle_counts[lbl] = vehicle_counts.get(lbl, 0) + 1

            # Occupancy
            box = track.bbox
            box_area = (box[2] - box[0]) * (box[3] - box[1])
            total_occupancy_area += box_area

            # Emergency check (labels or red/blue emergency vehicle detection)
            if lbl in EMERGENCY_CLASSES:
                emergency_detected.append({
                    "vehicle_type": lbl,
                    "bbox": box,
                    "confidence": track.confidence
                })

            # Speed / Stopped vehicle check for Incident detection
            if track.speed_kmh < 2.0 and track.hits > 5:
                stopped_vehicles += 1

            # Extract crop and run ANPR OCR
            x1, y1, x2, y2 = max(0, box[0]), max(0, box[1]), min(w, box[2]), min(h, box[3])
            vehicle_crop = frame[y1:y2, x1:x2]
            
            plate_info = None
            if vehicle_crop.size > 0:
                try:
                    plate_info = self.anpr_engine.extract_plate(vehicle_crop)
                except Exception as e:
                    logger.error(f"Error in ANPR OCR crop evaluation: {e}")
            
            track.plate_info = plate_info

            # Draw bounding box & label on annotated frame
            color = (0, 255, 0) if lbl not in EMERGENCY_CLASSES else (0, 0, 255)
            cv2.rectangle(annotated_frame, (box[0], box[1]), (box[2], box[3]), color, 2)
            
            plate_lbl = f" | Plate: {plate_info['plate_number']}" if plate_info else ""
            cv2.putText(annotated_frame, f"#{track.track_id} {lbl} {int(track.confidence*100)}%{plate_lbl}",
                        (box[0], max(15, box[1] - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)

        # Density & Queue Calculation
        total_vehicles = len(tracked_objects)
        frame_area = w * h
        occupancy_pct = min(100.0, round((total_occupancy_area / float(frame_area)) * 300.0, 1))

        if occupancy_pct < 20.0 and total_vehicles < 6:
            density_state = "LOW"
        elif occupancy_pct < 45.0 and total_vehicles < 14:
            density_state = "MODERATE"
        elif occupancy_pct < 70.0 and total_vehicles < 25:
            density_state = "HIGH"
        else:
            density_state = "SEVERE"

        # Queue length estimation (stopped vehicles + clustered vehicles)
        queue_length = stopped_vehicles + int(total_vehicles * 0.4)

        # Incident checks
        incidents = []
        if stopped_vehicles >= 3 and total_vehicles > 8:
            incidents.append({
                "incident_type": "traffic_blockage",
                "severity": "HIGH",
                "description": f"Traffic queue standstill detected ({stopped_vehicles} stopped vehicles)."
            })

        return {
            "total_vehicles": total_vehicles,
            "vehicle_counts": vehicle_counts,
            "occupancy_percentage": occupancy_pct,
            "density_state": density_state,
            "queue_length": queue_length,
            "emergency_detected": emergency_detected,
            "incidents": incidents,
            "tracked_objects": [
                {
                    "track_id": t.track_id,
                    "label": t.label,
                    "bbox": t.bbox,
                    "confidence": t.confidence,
                    "speed_kmh": t.speed_kmh,
                    "direction": getattr(t, "direction", "NORTH"),
                    "lane": getattr(t, "lane", 1),
                    "plate_info": getattr(t, "plate_info", None)
                } for t in tracked_objects
            ],
            "annotated_frame": annotated_frame
        }
