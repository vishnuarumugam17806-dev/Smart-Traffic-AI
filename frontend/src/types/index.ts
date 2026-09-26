/**
 * Core TypeScript type definitions for Vigitra / Smart Traffic AI.
 * Single source of truth for API models, WebSocket live update payloads,
 * junction approaches, and compliance records.
 */

export type Role = 'ADMIN' | 'OPERATOR' | 'ANALYST' | 'VIEWER' | 'FIELD_OPERATOR';

export type CongestionLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export type CameraStatus = 'LIVE' | 'SIMULATION' | 'OFFLINE' | 'DEGRADED' | 'ONLINE' | 'MAINTENANCE';

export type IncidentStatus = 'DETECTED' | 'INVESTIGATING' | 'CONFIRMED' | 'RESOLVED';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: Role;
  is_active: boolean;
  police_id?: string;
  area_jurisdiction?: string;
  mobile_number?: string;
  is_approved?: boolean;
  created_at: string;
}

export interface ApproachConfig {
  id?: string;
  name: string;
  direction: string;
  camera_id?: number | null;
  lanes?: number;
}

export interface Intersection {
  id: number;
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  current_status: CongestionLevel;
  total_lanes: number;
  num_approaches?: number;
  approaches_config?: ApproachConfig[];
  created_at?: string;
}

export interface Camera {
  id: number;
  name: string;
  source_url: string;
  source_type: string;
  intersection_id?: number;
  direction: string;
  status: CameraStatus;
  fps: number;
  created_at?: string;
}

export interface Signal {
  id: number;
  intersection_id: number;
  current_phase: string;
  green_duration: number;
  red_duration: number;
  yellow_duration: number;
  is_adaptive: boolean;
  emergency_override: boolean;
  last_phase_change: string;
}

export interface TrafficMeasurement {
  id: number;
  camera_id: number;
  intersection_id?: number;
  vehicle_count: number;
  queue_length: number;
  occupancy_percentage: number;
  average_speed_kmh: number;
  congestion_level: CongestionLevel;
  timestamp: string;
}

export interface EmergencyEvent {
  id: number;
  vehicle_type: string;
  camera_id?: number;
  intersection_id: number;
  priority_level: string;
  action_taken?: string;
  status: string;
  detected_at: string;
}

export interface Incident {
  id: number;
  incident_type: string;
  severity: string;
  camera_id?: number;
  intersection_id: number;
  status: IncidentStatus;
  confidence: number;
  description?: string;
  detected_at: string;
}

export interface Violation {
  id: number;
  violation_type: string;
  camera_id: number;
  license_plate?: string;
  confidence: number;
  evidence_image?: string;
  status: string;
  timestamp: string;
}

export interface Alert {
  id: number;
  type: string;
  severity: AlertSeverity;
  timestamp: string;
  camera_id?: number | null;
  location?: string | null;
  vehicle_plate?: string | null;
  message: string;
  status: string;
  confidence?: number;
  is_read?: boolean;
}

export interface NumberPlate {
  id: number;
  plate_number: string;
  confidence: number;
  camera_id: number;
  vehicle_type?: string;
  image_path?: string;
  timestamp: string;
}

export interface TrafficPrediction {
  id: number;
  intersection_id: number;
  horizon_minutes: number;
  predicted_volume: number;
  predicted_density: CongestionLevel;
  predicted_queue_length: number;
  mae: number;
  rmse: number;
  r2_score: number;
  created_at: string;
}

export interface AgentDecision {
  id: number;
  agent_name: string;
  input_summary?: Record<string, unknown>;
  decision: string;
  reasoning: string;
  confidence: number;
  action: string;
  result?: string;
  timestamp: string;
}

export interface AIQueryResponse {
  query: string;
  answer: string;
  sources: string[];
  context_data?: Record<string, unknown>;
  timestamp: string;
}

export interface SystemHealth {
  status: string;
  services: Record<string, string>;
  system_load: string;
  uptime: string;
}

export interface TrackedVehicle {
  track_id: number;
  label: string;
  bbox: [number, number, number, number];
  confidence: number;
  speed_kmh: number;
  direction?: string;
  lane?: number;
  plate_info?: {
    plate_number: string;
    final_confidence?: number;
    ocr_confidence?: number;
  } | null;
}

export interface LiveTrafficUpdate {
  event: string;
  camera_id?: number;
  intersection_id?: number;
  total_vehicles?: number;
  vehicle_count?: number;
  queue_length?: number;
  occupancy_percentage?: number;
  density_state?: CongestionLevel | string;
  average_speed?: number;
  fps?: number;
  camera_health?: string;
  alert?: Alert;
  step?: number;
  description?: string;
  status?: string;
  tracked_objects?: TrackedVehicle[];
  signal?: {
    current_phase: string;
    state?: string;
    countdown?: number;
    green_duration?: number;
  };
  timestamp?: string;
  [key: string]: any;
}

export interface DirectoryEntry {
  id: number;
  plate: string;
  reason: string;
  directory_type: string;
  severity: AlertSeverity;
  location?: string | null;
  vehicle_model?: string | null;
  owner_name?: string | null;
  fir_number?: string | null;
  police_station?: string | null;
  auto_alert?: boolean;
  scan_count?: number;
  last_scanned_at?: string | null;
  created_by?: string;
  created_at?: string;
  status?: string;
  notes?: string | null;
}
