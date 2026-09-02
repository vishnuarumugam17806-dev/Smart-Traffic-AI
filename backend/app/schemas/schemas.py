from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr
from app.models.models import RoleEnum, CongestionLevelEnum, IncidentStatusEnum, CameraStatusEnum

# Token
class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"

class TokenData(BaseModel):
    username: Optional[str] = None

# User
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    role: Optional[RoleEnum] = RoleEnum.OPERATOR

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    role: RoleEnum
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Intersection
class IntersectionCreate(BaseModel):
    name: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    total_lanes: int = 4

class IntersectionOut(BaseModel):
    id: int
    name: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    current_status: CongestionLevelEnum
    total_lanes: int
    created_at: datetime

    class Config:
        from_attributes = True

# Camera
class CameraCreate(BaseModel):
    name: str
    source_url: str
    source_type: str = "FILE"
    intersection_id: Optional[int] = None
    direction: str = "NORTH"

class CameraOut(BaseModel):
    id: int
    name: str
    source_url: str
    source_type: str
    intersection_id: Optional[int]
    direction: str
    status: CameraStatusEnum
    fps: float
    created_at: datetime

    class Config:
        from_attributes = True

# Road
class RoadOut(BaseModel):
    id: int
    name: str
    source_camera_id: int
    target_camera_id: int
    distance_km: float
    expected_travel_time_sec: float
    direction: str

    class Config:
        from_attributes = True

# Signal
class SignalOut(BaseModel):
    id: int
    intersection_id: int
    current_phase: str
    green_duration: int
    red_duration: int
    yellow_duration: int
    is_adaptive: bool
    emergency_override: bool
    last_phase_change: datetime

    class Config:
        from_attributes = True

class SignalUpdate(BaseModel):
    green_duration: Optional[int] = None
    red_duration: Optional[int] = None
    is_adaptive: Optional[bool] = None
    current_phase: Optional[str] = None

# Detection & Measurement
class TrafficMeasurementOut(BaseModel):
    id: int
    camera_id: int
    intersection_id: Optional[int]
    vehicle_count: int
    queue_length: int
    occupancy_percentage: float
    average_speed_kmh: float
    congestion_level: CongestionLevelEnum
    timestamp: datetime

    class Config:
        from_attributes = True

# Emergency & Incidents
class EmergencyEventOut(BaseModel):
    id: int
    vehicle_type: str
    camera_id: Optional[int]
    intersection_id: int
    priority_level: str
    action_taken: Optional[str]
    status: str
    detected_at: datetime

    class Config:
        from_attributes = True

class IncidentOut(BaseModel):
    id: int
    incident_type: str
    severity: str
    camera_id: Optional[int]
    intersection_id: int
    status: IncidentStatusEnum
    confidence: float
    description: Optional[str]
    detected_at: datetime

    class Config:
        from_attributes = True

# Violation & ANPR
class ViolationOut(BaseModel):
    id: int
    violation_type: str
    camera_id: int
    license_plate: Optional[str]
    confidence: float
    evidence_image: Optional[str]
    status: str
    timestamp: datetime

    class Config:
        from_attributes = True

class NumberPlateOut(BaseModel):
    id: int
    plate_number: str
    confidence: float
    camera_id: int
    vehicle_type: Optional[str]
    image_path: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

# Plate Sighting / Observation
class PlateObservationOut(BaseModel):
    id: int
    plate_number: str
    camera_id: int
    timestamp: datetime
    ocr_confidence: float
    plate_detection_confidence: float
    image_quality_score: float
    temporal_consistency: float
    final_confidence: float
    vehicle_type: Optional[str]
    lane: int
    direction: str

    class Config:
        from_attributes = True

# Blacklist Watchlist
class BlacklistCreate(BaseModel):
    plate: str
    reason: str
    notes: Optional[str] = None

class BlacklistOut(BaseModel):
    id: int
    plate: str
    reason: str
    created_by: str
    created_at: datetime
    status: str
    notes: Optional[str]

    class Config:
        from_attributes = True

# Route Anomaly
class RouteAnomalyOut(BaseModel):
    id: int
    plate_number: str
    reason: str
    confidence: float
    observed_route: str
    expected_route: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

# Alert Schema
class AlertOut(BaseModel):
    id: int
    type: str
    severity: str
    timestamp: datetime
    camera_id: Optional[int]
    location: Optional[str]
    vehicle_plate: Optional[str]
    message: str
    status: str
    confidence: float

    class Config:
        from_attributes = True

class AlertStatusUpdate(BaseModel):
    status: str

    class Config:
        from_attributes = True

class PredictionOut(BaseModel):
    id: int
    intersection_id: int
    horizon_minutes: int
    predicted_volume: int
    predicted_density: CongestionLevelEnum
    predicted_queue_length: int
    mae: float
    rmse: float
    r2_score: float
    created_at: datetime
    explanation: Optional[Any] = None

    class Config:
        from_attributes = True

class AgentDecisionOut(BaseModel):
    id: int
    agent_name: str
    input_summary: Optional[Any]
    decision: str
    reasoning: str
    confidence: float
    action: str
    result: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

# AI Assistant Query
class AIQueryRequest(BaseModel):
    query: str

class AIQueryResponse(BaseModel):
    query: str
    answer: str
    sources: List[str]
    context_data: Optional[Any] = None
    timestamp: datetime

# Camera Update & Stream Actions
class CameraUpdate(BaseModel):
    name: Optional[str] = None
    source_url: Optional[str] = None
    source_type: Optional[str] = None
    direction: Optional[str] = None
    status: Optional[CameraStatusEnum] = None
    fps: Optional[float] = None

class CameraStreamAction(BaseModel):
    action: str  # start, stop, reconnect

# AI Feedback Loops
class AIFeedbackCreate(BaseModel):
    observation_id: int
    corrected_plate: str

class AIFeedbackOut(BaseModel):
    id: int
    observation_id: int
    original_plate: str
    corrected_plate: str
    operator_username: str
    timestamp: datetime
    applied: bool

    class Config:
        from_attributes = True

# AI Model Performance Metrics
class AIModelPerformanceOut(BaseModel):
    exact_accuracy: float
    char_accuracy: float
    precision: float
    recall: float
    f1_score: float
    latency_ms: float
    fps: float
    condition_breakdown: Any
    timestamp: datetime

# Scenario Simulation & What-If
class ScenarioSimulationInput(BaseModel):
    intersection_id: int
    closed_lanes: int = 0
    green_time_delta: int = 0

class ScenarioSimulationOutput(BaseModel):
    intersection_id: int
    predicted_volume_before: int
    predicted_volume_after: int
    predicted_queue_before: int
    predicted_queue_after: int
    average_travel_time_before_sec: float
    average_travel_time_after_sec: float

# Weather Observation
class WeatherObservationOut(BaseModel):
    id: int
    condition: str
    temperature_c: float
    visibility_km: float
    precipitation_mm: float
    timestamp: datetime

    class Config:
        from_attributes = True

