import enum
from datetime import datetime
from typing import Optional, Any
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, JSON
from sqlalchemy.orm import relationship, Mapped
from app.database.session import Base

class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"
    FIELD_OPERATOR = "FIELD_OPERATOR"

class CongestionLevelEnum(str, enum.Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"

class IncidentStatusEnum(str, enum.Enum):
    DETECTED = "DETECTED"
    INVESTIGATING = "INVESTIGATING"
    CONFIRMED = "CONFIRMED"
    RESOLVED = "RESOLVED"

class CameraStatusEnum(str, enum.Enum):
    LIVE = "LIVE"
    SIMULATION = "SIMULATION"
    OFFLINE = "OFFLINE"
    DEGRADED = "DEGRADED"
    ONLINE = "ONLINE"
    MAINTENANCE = "MAINTENANCE"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    username: Mapped[str] = Column(String(50), unique=True, index=True, nullable=False) # type: ignore
    email: Mapped[str] = Column(String(100), unique=True, index=True, nullable=False) # type: ignore
    hashed_password: Mapped[str] = Column(String(255), nullable=False) # type: ignore
    full_name: Mapped[Optional[str]] = Column(String(100), nullable=True) # type: ignore
    role: Mapped[RoleEnum] = Column(Enum(RoleEnum), default=RoleEnum.OPERATOR, nullable=False) # type: ignore
    is_active: Mapped[bool] = Column(Boolean, default=True) # type: ignore
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow) # type: ignore
    updated_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow) # type: ignore

class Intersection(Base):
    __tablename__ = "intersections"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    name: Mapped[str] = Column(String(100), nullable=False) # type: ignore
    location: Mapped[str] = Column(String(255), nullable=False) # type: ignore
    latitude: Mapped[Optional[float]] = Column(Float, nullable=True) # type: ignore
    longitude: Mapped[Optional[float]] = Column(Float, nullable=True) # type: ignore
    current_status: Mapped[CongestionLevelEnum] = Column(Enum(CongestionLevelEnum), default=CongestionLevelEnum.LOW) # type: ignore
    total_lanes: Mapped[int] = Column(Integer, default=4) # type: ignore
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow) # type: ignore

    cameras = relationship("Camera", back_populates="intersection")
    signals = relationship("Signal", back_populates="intersection")
    incidents = relationship("Incident", back_populates="intersection")
    emergency_events = relationship("EmergencyEvent", back_populates="intersection")

class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    name: Mapped[str] = Column(String(100), nullable=False) # type: ignore
    source_url: Mapped[str] = Column(String(255), nullable=False) # type: ignore # RTSP URL, Video File path, Webcam index, or Mobile device ID
    source_type: Mapped[str] = Column(String(50), default="FILE") # type: ignore # RTSP, FILE, WEBCAM, MOBILE_DEVICE, DEMO_SIMULATION
    intersection_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("intersections.id"), nullable=True) # type: ignore
    direction: Mapped[str] = Column(String(50), default="NORTH") # type: ignore # NORTH, SOUTH, EAST, WEST
    status: Mapped[CameraStatusEnum] = Column(Enum(CameraStatusEnum), default=CameraStatusEnum.SIMULATION) # type: ignore
    fps: Mapped[float] = Column(Float, default=30.0) # type: ignore
    is_mobile_backup: Mapped[bool] = Column(Boolean, default=False) # type: ignore
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow) # type: ignore

    intersection = relationship("Intersection", back_populates="cameras")
    detections = relationship("VehicleDetection", back_populates="camera")
    measurements = relationship("TrafficMeasurement", back_populates="camera")

class MobileDevice(Base):
    __tablename__ = "mobile_devices"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    device_id: Mapped[str] = Column(String(100), unique=True, index=True, nullable=False) # type: ignore # e.g. MOBILE-CAM-001
    device_uuid: Mapped[Optional[str]] = Column(String(100), unique=True, index=True, nullable=True) # type: ignore # e.g. VG-MOB-7F92A31C
    camera_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("cameras.id"), nullable=True) # type: ignore
    operator_id: Mapped[str] = Column(String(100), nullable=False) # type: ignore
    name: Mapped[str] = Column(String(100), nullable=False) # type: ignore
    assigned_location: Mapped[str] = Column(String(255), nullable=False) # type: ignore
    connection_status: Mapped[str] = Column(String(50), default="CONNECTED") # type: ignore # CONNECTED, DISCONNECTED, REVOKED
    stream_status: Mapped[str] = Column(String(50), default="IDLE") # type: ignore # IDLE, STREAMING, STOPPED
    battery_pct: Mapped[int] = Column(Integer, default=92) # type: ignore
    network_type: Mapped[str] = Column(String(50), default="5G") # type: ignore
    platform: Mapped[str] = Column(String(50), default="Android / Chrome") # type: ignore
    is_active: Mapped[bool] = Column(Boolean, default=True) # type: ignore
    revocation_reason: Mapped[Optional[str]] = Column(String(255), nullable=True) # type: ignore
    last_seen: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, index=True) # type: ignore
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow) # type: ignore

class Road(Base):
    __tablename__ = "roads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    source_camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    target_camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    distance_km = Column(Float, nullable=False)
    expected_travel_time_sec = Column(Float, nullable=False)
    direction = Column(String(50), default="NORTH")

    source_camera = relationship("Camera", foreign_keys=[source_camera_id])
    target_camera = relationship("Camera", foreign_keys=[target_camera_id])

class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    intersection_id = Column(Integer, ForeignKey("intersections.id"), nullable=False)
    current_phase = Column(String(50), default="RED")  # RED, GREEN, YELLOW
    green_duration = Column(Integer, default=30)
    red_duration = Column(Integer, default=30)
    yellow_duration = Column(Integer, default=3)
    is_adaptive = Column(Boolean, default=True)
    emergency_override = Column(Boolean, default=False)
    last_phase_change = Column(DateTime, default=datetime.utcnow)

    intersection = relationship("Intersection", back_populates="signals")
    decisions = relationship("SignalDecision", back_populates="signal")

class VehicleDetection(Base):
    __tablename__ = "vehicle_detections"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    track_id = Column(Integer, nullable=True)
    vehicle_type = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    bbox = Column(JSON, nullable=True)  # [x1, y1, x2, y2]
    lane = Column(Integer, default=1)
    speed_kmh = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    camera = relationship("Camera", back_populates="detections")

class TrafficMeasurement(Base):
    __tablename__ = "traffic_measurements"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    camera_id: Mapped[int] = Column(Integer, ForeignKey("cameras.id"), nullable=False) # type: ignore
    intersection_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("intersections.id"), nullable=True) # type: ignore
    vehicle_count: Mapped[int] = Column(Integer, default=0) # type: ignore
    queue_length: Mapped[int] = Column(Integer, default=0) # type: ignore
    occupancy_percentage: Mapped[float] = Column(Float, default=0.0) # type: ignore
    average_speed_kmh: Mapped[float] = Column(Float, default=0.0) # type: ignore
    congestion_level: Mapped[CongestionLevelEnum] = Column(Enum(CongestionLevelEnum), default=CongestionLevelEnum.LOW) # type: ignore
    timestamp: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, index=True) # type: ignore

    camera = relationship("Camera", back_populates="measurements")

class EmergencyEvent(Base):
    __tablename__ = "emergency_events"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    vehicle_type: Mapped[str] = Column(String(50), nullable=False) # type: ignore
    camera_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("cameras.id"), nullable=True) # type: ignore
    intersection_id: Mapped[int] = Column(Integer, ForeignKey("intersections.id"), nullable=False) # type: ignore
    priority_level: Mapped[str] = Column(String(50), default="HIGH") # type: ignore
    action_taken: Mapped[Optional[str]] = Column(String(255), nullable=True) # type: ignore
    status: Mapped[str] = Column(String(50), default="ACTIVE") # type: ignore
    detected_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, index=True) # type: ignore
    cleared_at: Mapped[Optional[datetime]] = Column(DateTime, nullable=True) # type: ignore

    intersection = relationship("Intersection", back_populates="emergency_events")

class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    incident_type: Mapped[str] = Column(String(100), nullable=False) # type: ignore
    severity: Mapped[str] = Column(String(50), default="MEDIUM") # type: ignore
    camera_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("cameras.id"), nullable=True) # type: ignore
    intersection_id: Mapped[int] = Column(Integer, ForeignKey("intersections.id"), nullable=False) # type: ignore
    status: Mapped[IncidentStatusEnum] = Column(Enum(IncidentStatusEnum), default=IncidentStatusEnum.DETECTED) # type: ignore
    confidence: Mapped[float] = Column(Float, default=0.90) # type: ignore
    description: Mapped[Optional[str]] = Column(Text, nullable=True) # type: ignore
    detected_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, index=True) # type: ignore
    resolved_at: Mapped[Optional[datetime]] = Column(DateTime, nullable=True) # type: ignore

    intersection = relationship("Intersection", back_populates="incidents")

class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    violation_type = Column(String(100), nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    license_plate = Column(String(50), nullable=True)
    confidence = Column(Float, default=0.85)
    evidence_image = Column(String(255), nullable=True)
    status = Column(String(50), default="PENDING")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class NumberPlate(Base):
    __tablename__ = "number_plates"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(50), nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    vehicle_type = Column(String(50), nullable=True)
    image_path = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class PlateObservation(Base):
    __tablename__ = "plate_observations"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(50), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    ocr_confidence = Column(Float, nullable=False)
    plate_detection_confidence = Column(Float, nullable=False)
    image_quality_score = Column(Float, default=0.9)
    temporal_consistency = Column(Float, default=1.0)
    final_confidence = Column(Float, nullable=False)
    vehicle_type = Column(String(50), nullable=True)
    image_path = Column(String(255), nullable=True)
    lane = Column(Integer, default=1)
    direction = Column(String(50), default="NORTH")
    global_vehicle_id = Column(String(50), nullable=True, index=True)
    speed_kmh = Column(Float, default=0.0)

    camera = relationship("Camera")

class Blacklist(Base):
    __tablename__ = "blacklist"

    id = Column(Integer, primary_key=True, index=True)
    plate = Column(String(50), unique=True, index=True, nullable=False)
    reason = Column(String(255), nullable=False)
    created_by = Column(String(100), default="admin")
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="ACTIVE")
    notes = Column(Text, nullable=True)

class RouteAnomaly(Base):
    __tablename__ = "route_anomalies"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(50), nullable=False, index=True)
    reason = Column(String(255), nullable=False)
    confidence = Column(Float, default=0.85)
    observed_route = Column(Text, nullable=False)
    expected_route = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    type: Mapped[str] = Column(String(50), nullable=False) # type: ignore
    severity: Mapped[str] = Column(String(50), default="MEDIUM") # type: ignore
    timestamp: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, index=True) # type: ignore
    camera_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("cameras.id"), nullable=True) # type: ignore
    location: Mapped[Optional[str]] = Column(String(255), nullable=True) # type: ignore
    vehicle_plate: Mapped[Optional[str]] = Column(String(50), nullable=True) # type: ignore
    message: Mapped[str] = Column(Text, nullable=False) # type: ignore
    status: Mapped[str] = Column(String(50), default="NEW") # type: ignore
    confidence: Mapped[float] = Column(Float, default=1.0) # type: ignore

    camera = relationship("Camera")

class VideoRecording(Base):
    __tablename__ = "video_recordings"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String(100), unique=True, index=True, nullable=False) # e.g. REC-20260901-001
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    device_id = Column(String(100), nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow, index=True)
    end_time = Column(DateTime, nullable=True)
    file_reference = Column(String(255), nullable=False)
    file_size_mb = Column(Float, default=14.5)
    duration_sec = Column(Float, default=120.0)
    location = Column(String(255), nullable=False)
    recording_type = Column(String(50), default="CONTINUOUS") # CONTINUOUS, EVENT, OPERATOR
    created_by = Column(String(100), default="SYSTEM")
    retention_expiry = Column(DateTime, nullable=True)
    file_hash = Column(String(64), nullable=True) # sha256 checksum

    camera = relationship("Camera")

class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True) # type: ignore
    record_id: Mapped[str] = Column(String(100), unique=True, index=True, nullable=False) # type: ignore # e.g. EVD-20260901-001
    timestamp: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, index=True) # type: ignore
    camera_id: Mapped[Optional[int]] = Column(Integer, ForeignKey("cameras.id"), nullable=True) # type: ignore
    device_id: Mapped[Optional[str]] = Column(String(100), nullable=True) # type: ignore
    operator_id: Mapped[str] = Column(String(100), nullable=False) # type: ignore
    location: Mapped[str] = Column(String(255), nullable=False) # type: ignore
    plate_number: Mapped[Optional[str]] = Column(String(50), nullable=True) # type: ignore
    ocr_confidence: Mapped[float] = Column(Float, default=0.92) # type: ignore
    vehicle_type: Mapped[str] = Column(String(50), default="car") # type: ignore
    vehicle_image: Mapped[Optional[str]] = Column(String(255), nullable=True) # type: ignore
    plate_crop: Mapped[Optional[str]] = Column(String(255), nullable=True) # type: ignore
    original_image: Mapped[str] = Column(String(255), nullable=False) # type: ignore
    review_status: Mapped[str] = Column(String(50), default="PENDING") # type: ignore # PENDING, VERIFIED, REJECTED
    notes: Mapped[Optional[str]] = Column(Text, nullable=True) # type: ignore
    file_hash: Mapped[Optional[str]] = Column(String(64), nullable=True) # type: ignore

class TrafficPrediction(Base):
    __tablename__ = "traffic_predictions"

    id = Column(Integer, primary_key=True, index=True)
    intersection_id = Column(Integer, ForeignKey("intersections.id"), nullable=False)
    horizon_minutes = Column(Integer, nullable=False)
    predicted_volume = Column(Integer, nullable=False)
    predicted_density = Column(Enum(CongestionLevelEnum), nullable=False)
    predicted_queue_length = Column(Integer, nullable=False)
    mae = Column(Float, default=2.1)
    rmse = Column(Float, default=3.4)
    r2_score = Column(Float, default=0.91)
    created_at = Column(DateTime, default=datetime.utcnow)

class SignalDecision(Base):
    __tablename__ = "signal_decisions"

    id = Column(Integer, primary_key=True, index=True)
    signal_id = Column(Integer, ForeignKey("signals.id"), nullable=False)
    recommended_green = Column(Integer, nullable=False)
    recommended_red = Column(Integer, nullable=False)
    recommended_phase = Column(String(50), nullable=False)
    priority_level = Column(String(50), default="NORMAL")
    reasoning = Column(Text, nullable=False)
    confidence = Column(Float, default=0.95)
    applied = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    signal = relationship("Signal", back_populates="decisions")

class AgentDecision(Base):
    __tablename__ = "agent_decisions"

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String(100), nullable=False)
    input_summary = Column(JSON, nullable=True)
    decision = Column(String(255), nullable=False)
    reasoning = Column(Text, nullable=False)
    confidence = Column(Float, default=0.92)
    action = Column(String(255), nullable=False)
    result = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(100), default="SYSTEM")
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="INFO")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class WeatherObservation(Base):
    __tablename__ = "weather_observations"

    id = Column(Integer, primary_key=True, index=True)
    condition = Column(String(50), nullable=False)
    temperature_c = Column(Float, nullable=False)
    visibility_km = Column(Float, nullable=False)
    precipitation_mm = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class ODRecord(Base):
    __tablename__ = "od_records"

    id = Column(Integer, primary_key=True, index=True)
    origin = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    vehicle_count = Column(Integer, default=0)
    average_travel_time_sec = Column(Float, default=0.0)
    average_speed_kmh = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    id = Column(Integer, primary_key=True, index=True)
    observation_id = Column(Integer, ForeignKey("plate_observations.id"), nullable=False)
    original_plate = Column(String(50), nullable=False)
    corrected_plate = Column(String(50), nullable=False)
    operator_username = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    applied = Column(Boolean, default=False)

class AIModelMetric(Base):
    __tablename__ = "ai_model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(100), nullable=False)
    exact_accuracy = Column(Float, nullable=False)
    char_accuracy = Column(Float, nullable=False)
    precision = Column(Float, nullable=False)
    recall = Column(Float, nullable=False)
    f1_score = Column(Float, nullable=False)
    latency_ms = Column(Float, nullable=False)
    fps = Column(Float, nullable=False)
    condition = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String(50), nullable=False)
    file_path = Column(String(255), nullable=False)
    file_format = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class DataRetentionSetting(Base):
    __tablename__ = "data_retention_settings"

    id = Column(Integer, primary_key=True, index=True)
    video_retention_days = Column(Integer, default=30)
    image_retention_days = Column(Integer, default=60)
    anpr_retention_days = Column(Integer, default=90)
    incident_retention_days = Column(Integer, default=365)
    auto_delete_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
