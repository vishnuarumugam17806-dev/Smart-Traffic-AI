import { Camera, Intersection } from '../types';

export const FALLBACK_CAMERAS: Camera[] = [
  {
    id: 1,
    name: "CCTV-01 North (Anna Salai - Spencers Junction)",
    source_url: "sample_traffic_urban.mp4",
    source_type: "FILE",
    intersection_id: 1,
    direction: "NORTH",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 2,
    name: "CCTV-02 South (Anna Salai - Spencers Junction)",
    source_url: "sample_traffic_congested.mp4",
    source_type: "FILE",
    intersection_id: 1,
    direction: "SOUTH",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 3,
    name: "CCTV-03 East (Chennai Central - Ripon Cross)",
    source_url: "sample_traffic_emergency.mp4",
    source_type: "FILE",
    intersection_id: 2,
    direction: "EAST",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 4,
    name: "CCTV-04 West (Chennai Central - Ripon Cross)",
    source_url: "sample_traffic_highway.mp4",
    source_type: "FILE",
    intersection_id: 2,
    direction: "WEST",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 5,
    name: "CCTV-05 North (Gemini Flyover Circle)",
    source_url: "sample_traffic_rainy.mp4",
    source_type: "FILE",
    intersection_id: 3,
    direction: "NORTH",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 6,
    name: "CCTV-06 South (Gemini Flyover Circle)",
    source_url: "sample_traffic_junction.mp4",
    source_type: "FILE",
    intersection_id: 3,
    direction: "SOUTH",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 7,
    name: "CCTV-07 East (T. Nagar - Panagal Park)",
    source_url: "sample_traffic_highway.mp4",
    source_type: "FILE",
    intersection_id: 4,
    direction: "EAST",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 8,
    name: "CCTV-08 West (T. Nagar - Panagal Park)",
    source_url: "sample_traffic_urban.mp4",
    source_type: "FILE",
    intersection_id: 4,
    direction: "WEST",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 9,
    name: "CCTV-09 North (Kathipara Cloverleaf Interchange)",
    source_url: "sample_traffic_emergency.mp4",
    source_type: "FILE",
    intersection_id: 5,
    direction: "NORTH",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 10,
    name: "CCTV-10 South (Tidel Park - OMR IT Expressway)",
    source_url: "sample_traffic_congested.mp4",
    source_type: "FILE",
    intersection_id: 6,
    direction: "SOUTH",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 11,
    name: "CCTV-11 East (Velachery Vijayanagar Junction)",
    source_url: "sample_traffic_highway.mp4",
    source_type: "FILE",
    intersection_id: 9,
    direction: "EAST",
    status: "LIVE",
    fps: 30.0
  },
  {
    id: 12,
    name: "CCTV-12 West (Madhavaram Roundabout Interchange)",
    source_url: "sample_traffic_junction.mp4",
    source_type: "FILE",
    intersection_id: 10,
    direction: "WEST",
    status: "LIVE",
    fps: 30.0
  }
];

export const FALLBACK_INTERSECTIONS: Intersection[] = [
  {
    id: 1,
    name: "Anna Salai - Spencers Junction",
    location: "Downtown Thousand Lights & Binny Rd",
    latitude: 13.0604,
    longitude: 80.2605,
    current_status: "HIGH",
    total_lanes: 4,
    num_approaches: 4,
    approaches_config: [
      { id: "NORTH", name: "North Approach", direction: "NORTH" },
      { id: "EAST", name: "East Approach", direction: "EAST" },
      { id: "SOUTH", name: "South Approach", direction: "SOUTH" },
      { id: "WEST", name: "West Approach", direction: "WEST" }
    ]
  },
  {
    id: 2,
    name: "Chennai Central - Ripon Cross",
    location: "EVR Periyar Salai & Wall Tax Rd",
    latitude: 13.0827,
    longitude: 80.2755,
    current_status: "MODERATE",
    total_lanes: 3,
    num_approaches: 3,
    approaches_config: [
      { id: "NORTH", name: "North Main Approach", direction: "NORTH" },
      { id: "EAST", name: "East Ramp Approach", direction: "EAST" },
      { id: "WEST", name: "West Express Approach", direction: "WEST" }
    ]
  },
  {
    id: 3,
    name: "Gemini Flyover Circle",
    location: "Anna Salai & Cathedral Road",
    latitude: 13.0531,
    longitude: 80.2514,
    current_status: "LOW",
    total_lanes: 2,
    num_approaches: 2,
    approaches_config: [
      { id: "NORTH", name: "Northbound Bridge Approach", direction: "NORTH" },
      { id: "SOUTH", name: "Southbound Bridge Approach", direction: "SOUTH" }
    ]
  },
  {
    id: 4,
    name: "T. Nagar - Panagal Park Circle",
    location: "G.N. Chetty Rd & Usman Rd",
    latitude: 13.0405,
    longitude: 80.2337,
    current_status: "SEVERE",
    total_lanes: 4,
    num_approaches: 4,
    approaches_config: [
      { id: "NORTH", name: "North Approach", direction: "NORTH" },
      { id: "EAST", name: "East Approach", direction: "EAST" },
      { id: "SOUTH", name: "South Approach", direction: "SOUTH" },
      { id: "WEST", name: "West Approach", direction: "WEST" }
    ]
  },
  {
    id: 5,
    name: "Kathipara Cloverleaf Interchange",
    location: "GST Road & Inner Ring Rd, Guindy",
    latitude: 13.0067,
    longitude: 80.2026,
    current_status: "HIGH",
    total_lanes: 4,
    num_approaches: 4,
    approaches_config: [
      { id: "NORTH", name: "North Approach", direction: "NORTH" },
      { id: "EAST", name: "East Approach", direction: "EAST" },
      { id: "SOUTH", name: "South Approach", direction: "SOUTH" },
      { id: "WEST", name: "West Approach", direction: "WEST" }
    ]
  },
  {
    id: 6,
    name: "Tidel Park - OMR IT Expressway",
    location: "Rajiv Gandhi Salai, Taramani",
    latitude: 12.9892,
    longitude: 80.2476,
    current_status: "SEVERE",
    total_lanes: 4,
    num_approaches: 4,
    approaches_config: [
      { id: "NORTH", name: "North Approach", direction: "NORTH" },
      { id: "EAST", name: "East Approach", direction: "EAST" },
      { id: "SOUTH", name: "South Approach", direction: "SOUTH" },
      { id: "WEST", name: "West Approach", direction: "WEST" }
    ]
  }
];

export const FALLBACK_ALERTS = [
  {
    id: 1,
    type: "WATCHLIST_MATCH",
    severity: "CRITICAL",
    location: "Anna Salai - Spencers Junction",
    vehicle_plate: "TN01AB1234",
    message: "CRITICAL WATCHLIST: Blacklisted vehicle TN01AB1234 detected at CCTV-01 Anna Salai. Reason: Suspected Stolen Vehicle.",
    timestamp: new Date().toISOString()
  },
  {
    id: 2,
    type: "CONGESTION_SPIKE",
    severity: "HIGH",
    location: "Kathipara Cloverleaf Interchange",
    vehicle_plate: null,
    message: "CONGESTION ALERT: Density reached 84% at GST Road Southbound Approach. Adaptive green time extended to 65s.",
    timestamp: new Date(Date.now() - 120000).toISOString()
  },
  {
    id: 3,
    type: "EMERGENCY_PREEMPTION",
    severity: "CRITICAL",
    location: "Chennai Central - Ripon Cross",
    vehicle_plate: "TN07EM108",
    message: "GREEN WAVE ACTIVE: 108 Emergency Ambulance detected. Priority green preempted on East Corridor.",
    timestamp: new Date(Date.now() - 300000).toISOString()
  }
];

export const FALLBACK_GIS_GRAPH = {
  nodes: [
    { id: 1, name: "Anna Salai - Spencers Junction", lat: 13.0604, lng: 80.2605, status: "HIGH" },
    { id: 2, name: "Chennai Central - Ripon Cross", lat: 13.0827, lng: 80.2755, status: "MODERATE" },
    { id: 3, name: "Gemini Flyover Circle", lat: 13.0531, lng: 80.2514, status: "LOW" },
    { id: 4, name: "T. Nagar - Panagal Park Circle", lat: 13.0405, lng: 80.2337, status: "SEVERE" },
    { id: 5, name: "Kathipara Cloverleaf Interchange", lat: 13.0067, lng: 80.2026, status: "HIGH" },
    { id: 6, name: "Tidel Park - OMR IT Expressway", lat: 12.9892, lng: 80.2476, status: "SEVERE" },
    { id: 7, name: "Koyambedu CMBT Roundabout", lat: 13.0694, lng: 80.1948, status: "SEVERE" },
    { id: 8, name: "Marina Beach - Kamarajar Salai", lat: 13.0382, lng: 80.2785, status: "LOW" },
    { id: 9, name: "Velachery Vijayanagar Junction", lat: 12.9757, lng: 80.2212, status: "HIGH" },
    { id: 10, name: "Madhavaram Roundabout Interchange", lat: 13.1482, lng: 80.2312, status: "MODERATE" }
  ],
  edges: [
    { source: 1, target: 3, road_name: "Anna Salai Arterial", length_km: 1.2 },
    { source: 3, target: 4, road_name: "Cathedral & G.N. Chetty Rd", length_km: 2.1 },
    { source: 4, target: 5, road_name: "Usman Rd to GST Link", length_km: 4.5 },
    { source: 1, target: 2, road_name: "Anna Salai North to Central", length_km: 2.8 },
    { source: 5, target: 6, road_name: "Inner Ring Rd to OMR", length_km: 6.2 },
    { source: 2, target: 7, road_name: "Poonamallee High Rd", length_km: 7.1 }
  ]
};

export const FALLBACK_SIGNAL_DATA = {
  intersection_id: 1,
  mode: "ADAPTIVE",
  current_phase: "NORTH",
  cycle_time: 90,
  approaches: {
    NORTH: { name: "North Approach", direction: "NORTH", signal: "GREEN", green_time: 42, remaining: 18 },
    EAST: { name: "East Approach", direction: "EAST", signal: "RED", green_time: 25, remaining: 0 },
    SOUTH: { name: "South Approach", direction: "SOUTH", signal: "RED", green_time: 30, remaining: 0 },
    WEST: { name: "West Approach", direction: "WEST", signal: "RED", green_time: 20, remaining: 0 }
  }
};
