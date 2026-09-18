import time
import logging
import base64
import cv2
import numpy as np
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from app.core.config import settings

logger = logging.getLogger(__name__)

class MobileDeviceManager:
    """
    Manages active mobile camera streaming sessions (WebRTC / Base64 Canvas Ingestion).
    Tracks active devices, frame rate (FPS), latency, battery status, permissions,
    real-time GPS coordinates, accuracy, and stale location protection (Sections 10-17).
    """

    def __init__(self):
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.latest_frames: Dict[str, np.ndarray] = {}
        self.fps_counters: Dict[str, int] = {}
        self.last_fps_calc: Dict[str, float] = {}
        self.measured_fps: Dict[str, float] = {}
        self.latest_plate_info: Dict[str, Optional[Dict[str, Any]]] = {}
        self.device_locations: Dict[str, Dict[str, Any]] = {}
        self.device_permissions: Dict[str, Dict[str, str]] = {}

    def register_device_session(
        self,
        device_id: str,
        camera_id: int,
        operator_id: str,
        location: str,
        device_name: Optional[str] = None,
        platform: Optional[str] = None,
        browser: Optional[str] = None
    ) -> Dict[str, Any]:
        session = {
            "device_id": device_id,
            "device_name": device_name or f"Mobile Patrol {device_id}",
            "camera_id": camera_id,
            "operator_id": operator_id,
            "location": location,
            "connection_status": "CONNECTED",
            "stream_status": "STREAMING",
            "battery_pct": 94,
            "network_type": "5G",
            "platform": platform or "Android / Chrome Mobile",
            "browser": browser or "Chrome Mobile",
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "start_time": time.time()
        }
        self.active_sessions[device_id] = session
        self.fps_counters[device_id] = 0
        self.last_fps_calc[device_id] = time.time()
        self.measured_fps[device_id] = 30.0
        
        if device_id not in self.device_permissions:
            self.device_permissions[device_id] = {
                "permission_camera": "GRANTED",
                "permission_location": "WAITING"
            }
        
        logger.info(f"[MobileDeviceManager] Device session registered for {device_id} (Camera #{camera_id})")
        return session

    def update_permissions(self, device_id: str, camera_perm: Optional[str] = None, location_perm: Optional[str] = None):
        """Updates permissions (GRANTED, DENIED, WAITING) for a device."""
        if device_id not in self.device_permissions:
            self.device_permissions[device_id] = {}
        if camera_perm:
            self.device_permissions[device_id]["permission_camera"] = camera_perm
        if location_perm:
            self.device_permissions[device_id]["permission_location"] = location_perm

    def update_device_location(
        self,
        device_id: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        accuracy_meters: Optional[float] = None,
        source: str = "mobile_device_gps",
        status: str = "AVAILABLE",
        timestamp: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Updates actual device GPS location from mobile browser watchPosition (Sections 10-12).
        NEVER accepts or stores random/mock coordinates for live events.
        """
        epoch_now = time.time()
        iso_now = datetime.now(timezone.utc).isoformat()
        
        if status == "PERMISSION_DENIED":
            loc_data = {
                "latitude": None,
                "longitude": None,
                "accuracy_meters": None,
                "source": "mobile_device_gps",
                "status": "PERMISSION_DENIED",
                "timestamp": iso_now,
                "epoch_time": epoch_now
            }
            self.update_permissions(device_id, location_perm="DENIED")
        elif latitude is not None and longitude is not None:
            loc_data = {
                "latitude": round(float(latitude), 6),
                "longitude": round(float(longitude), 6),
                "accuracy_meters": round(float(accuracy_meters), 1) if accuracy_meters is not None else None,
                "source": source or "mobile_device_gps",
                "status": "AVAILABLE",
                "timestamp": timestamp or iso_now,
                "epoch_time": epoch_now
            }
            self.update_permissions(device_id, location_perm="GRANTED")
        else:
            loc_data = {
                "latitude": None,
                "longitude": None,
                "accuracy_meters": None,
                "source": source or "mobile_device_gps",
                "status": "UNAVAILABLE",
                "timestamp": iso_now,
                "epoch_time": epoch_now
            }
        
        self.device_locations[device_id] = loc_data
        return loc_data

    def get_device_location(self, device_id: str) -> Dict[str, Any]:
        """
        Returns latest location for device with Stale Protection (Section 13).
        If location age exceeds MAX_LOCATION_AGE_SECONDS, status becomes STALE.
        """
        loc = self.device_locations.get(device_id)
        if not loc:
            return {
                "latitude": None,
                "longitude": None,
                "accuracy_meters": None,
                "source": "mobile_device_gps",
                "status": "UNAVAILABLE",
                "timestamp": None,
                "location_age_seconds": None
            }

        epoch_time = loc.get("epoch_time", 0.0)
        age_seconds = round(time.time() - epoch_time, 1)

        if loc.get("status") == "PERMISSION_DENIED":
            return {
                **loc,
                "status": "PERMISSION_DENIED",
                "location_age_seconds": age_seconds
            }

        if loc.get("latitude") is None or loc.get("longitude") is None:
            return {
                **loc,
                "status": "UNAVAILABLE",
                "location_age_seconds": age_seconds
            }

        # Stale Location Protection (Section 13)
        if age_seconds > settings.LOCATION_MAX_AGE_SECONDS:
            return {
                **loc,
                "status": "STALE",
                "location_age_seconds": age_seconds,
                "is_stale": True
            }

        return {
            **loc,
            "status": "AVAILABLE",
            "location_age_seconds": age_seconds,
            "is_stale": False
        }

    def push_frame_base64(self, device_id: str, base64_str: str) -> Optional[np.ndarray]:
        """Decodes incoming JPEG/PNG base64 frame from browser mobile stream."""
        if device_id not in self.active_sessions:
            logger.info(f"[MobileDeviceManager] Auto-registering active session for device {device_id}")
            self.register_device_session(
                device_id=device_id,
                camera_id=0,
                operator_id="PATROL-OFFICER",
                location="Mobile Field Stream"
            )

        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]

            img_bytes = base64.b64decode(base64_str)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is not None:
                self.latest_frames[device_id] = frame
                self.active_sessions[device_id]["connection_status"] = "CONNECTED"
                self.active_sessions[device_id]["stream_status"] = "STREAMING"
                self.active_sessions[device_id]["last_seen"] = datetime.now(timezone.utc).isoformat()

                # Calculate FPS
                now = time.time()
                self.fps_counters[device_id] += 1
                elapsed = now - self.last_fps_calc[device_id]
                if elapsed >= 1.0:
                    self.measured_fps[device_id] = round(self.fps_counters[device_id] / elapsed, 1)
                    self.fps_counters[device_id] = 0
                    self.last_fps_calc[device_id] = now

            return frame
        except Exception as e:
            logger.error(f"[MobileDeviceManager] Error decoding frame from {device_id}: {e}")
            return None

    def update_plate_detection(self, device_id: str, plate_data: Optional[Dict[str, Any]]):
        """Stores latest real-time plate recognition details for this mobile camera."""
        if plate_data:
            self.latest_plate_info[device_id] = {
                **plate_data,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        else:
            self.latest_plate_info[device_id] = None

    def get_latest_frame(self, device_id: str) -> Tuple[Optional[np.ndarray], Dict[str, Any]]:
        frame = self.latest_frames.get(device_id)
        session = self.active_sessions.get(device_id, {})
        fps = self.measured_fps.get(device_id, 24.0 if frame is not None else 0.0)
        plate_info = self.latest_plate_info.get(device_id)
        location_info = self.get_device_location(device_id)
        perms = self.device_permissions.get(device_id, {"permission_camera": "GRANTED", "permission_location": "WAITING"})

        meta = {
            "device_id": device_id,
            "status": session.get("connection_status", "CONNECTED" if frame is not None else "OFFLINE"),
            "stream_status": "STREAMING" if frame is not None else "IDLE",
            "fps": fps,
            "battery_pct": session.get("battery_pct", 94),
            "plate_info": plate_info,
            "location": location_info,
            "permissions": perms
        }
        return frame, meta

    def disconnect_device(self, device_id: str):
        """Immediately terminates mobile camera streaming session upon disconnect."""
        if device_id in self.active_sessions:
            self.active_sessions[device_id]["connection_status"] = "DISCONNECTED"
            self.active_sessions[device_id]["stream_status"] = "STOPPED"
            logger.info(f"[MobileDeviceManager] Disconnected device session {device_id}")

        if device_id in self.latest_frames:
            del self.latest_frames[device_id]

mobile_manager = MobileDeviceManager()
mobile_device_manager = mobile_manager

