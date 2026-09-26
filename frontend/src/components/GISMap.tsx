import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';
import {
  Camera, Video, Layers, AlertTriangle, RefreshCw, Zap, Shield, Navigation,
  Activity, Radio, Smartphone, AlertCircle, Info, Check, Eye, EyeOff, X,
  MapPin, HelpCircle
} from 'lucide-react';
import { MapStyleSelector } from './MapStyleSelector';
import {
  MapStyleId,
  getDefaultMapStyleId,
  getTileUrlForStyle,
  loadGoogleMapsSdk,
  hasGoogleMapsSdk,
  getGoogleMapsApiKey
} from '../utils/mapProviders';

export interface TrajectoryPoint {
  lat: number;
  lng: number;
  cameraName: string;
  timestamp: string;
  speed?: number;
  confidence?: string;
}

export interface GISMapProps {
  onSelectIntersection?: (id: number) => void;
  selectedIntersectionId?: number | null;
  activeTrajectoryPath?: TrajectoryPoint[];
  showHeatmap?: boolean;
  onSelectCameraForVideo?: (cameraId: number) => void;
  fullScreenPage?: boolean;
  initialLayers?: Partial<{
    googleTraffic: boolean;
    vigitraTraffic: boolean;
    fixedCameras: boolean;
    junctions: boolean;
    signals: boolean;
    mobileDevices: boolean;
    trajectories: boolean;
    alerts: boolean;
    roadDensity: boolean;
  }>;
}

// Helper SVG Marker generators for Google Maps
const createSvgIcon = (svgString: string, width = 30, height = 30) => {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgString)}`,
    scaledSize: (window as any).google?.maps?.Size ? new (window as any).google.maps.Size(width, height) : null,
    anchor: (window as any).google?.maps?.Point ? new (window as any).google.maps.Point(width / 2, height / 2) : null
  };
};

const getCameraSvg = (isOnline: boolean, isSelected: boolean) => {
  const stroke = isSelected ? '#3B82F6' : '#0F172A';
  const fill = isOnline ? '#10B981' : '#EF4444';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    ${isSelected ? `<circle cx="16" cy="16" r="15" fill="${fill}" opacity="0.3" stroke="${stroke}" stroke-width="2"/>` : ''}
    <circle cx="16" cy="16" r="11" fill="#FFFFFF" stroke="${stroke}" stroke-width="2"/>
    <circle cx="16" cy="16" r="8" fill="${fill}"/>
    <path d="M12 14v4l3-2-3-2zm5-1h3v6h-3z" fill="#FFFFFF"/>
  </svg>`;
};

const getJunctionSvg = (status: string, isSelected: boolean) => {
  let color = '#10B981'; // LOW
  if (status === 'MODERATE') color = '#F59E0B';
  if (status === 'HIGH') color = '#F97316';
  if (status === 'SEVERE' || status === 'CRITICAL') color = '#EF4444';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    ${isSelected ? `<circle cx="17" cy="17" r="16" fill="${color}" opacity="0.3"/>` : ''}
    <circle cx="17" cy="17" r="12" fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5"/>
    <circle cx="17" cy="17" r="8" fill="${color}"/>
    <circle cx="17" cy="17" r="3.5" fill="#FFFFFF"/>
  </svg>`;
};

export interface NetworkSignalState {
  id: number;
  intersection_id: number;
  current_phase: string;
  state: 'GREEN' | 'YELLOW' | 'RED';
  active_approach: string;
  phase_index: number;
  countdown: number;
  green_duration: number;
  is_adaptive: boolean;
}

export const NETWORK_SIGNAL_PHASES = [
  { phase: 'NORTH_SOUTH_GREEN', state: 'GREEN' as const, approach: 'North-South Arterial', duration: 25 },
  { phase: 'NORTH_SOUTH_YELLOW', state: 'YELLOW' as const, approach: 'North-South Clearance', duration: 4 },
  { phase: 'EAST_WEST_GREEN', state: 'GREEN' as const, approach: 'East-West Crossway', duration: 22 },
  { phase: 'EAST_WEST_YELLOW', state: 'YELLOW' as const, approach: 'East-West Clearance', duration: 4 }
];

const getSignalSvg = (phase: string, state: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN') => {
  const p = (phase || '').toUpperCase();
  const s = (state || '').toUpperCase();

  const isRed = s === 'RED' || p.includes('RED') || p.includes('STOP');
  const isYellow = s === 'YELLOW' || p.includes('YELLOW') || p.includes('CLEARANCE');
  const isGreen = !isRed && !isYellow;

  const redFill = isRed ? '#EF4444' : '#1E293B';
  const yellowFill = isYellow ? '#FBBF24' : '#1E293B';
  const greenFill = isGreen ? '#10B981' : '#1E293B';

  const glowColor = isRed ? '#EF4444' : isYellow ? '#FBBF24' : '#10B981';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="14" fill="${glowColor}" opacity="0.32"/>
    <rect x="7" y="3" width="16" height="24" rx="4" fill="#0F172A" stroke="#475569" stroke-width="1.8"/>
    <circle cx="15" cy="8" r="3.2" fill="${redFill}"/>
    ${isRed ? '<circle cx="15" cy="8" r="1.3" fill="#FFFFFF" opacity="0.8"/>' : ''}
    <circle cx="15" cy="15" r="3.2" fill="${yellowFill}"/>
    ${isYellow ? '<circle cx="15" cy="15" r="1.3" fill="#FFFFFF" opacity="0.8"/>' : ''}
    <circle cx="15" cy="22" r="3.2" fill="${greenFill}"/>
    ${isGreen ? '<circle cx="15" cy="22" r="1.3" fill="#FFFFFF" opacity="0.8"/>' : ''}
  </svg>`;
};

const getMobileDeviceSvg = (isStale: boolean) => {
  const fill = isStale ? '#94A3B8' : '#2563EB';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="14" fill="#FFFFFF" stroke="${fill}" stroke-width="2.5"/>
    <rect x="10" y="7" width="10" height="16" rx="2" fill="${fill}"/>
    <circle cx="15" cy="20.5" r="1" fill="#FFFFFF"/>
    <rect x="12" y="9" width="6" height="9" rx="1" fill="#FFFFFF" opacity="0.9"/>
  </svg>`;
};

const getAlertSvg = (severity: string) => {
  const color = severity === 'CRITICAL' || severity === 'HIGH' ? '#DC2626' : '#D97706';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="${color}" opacity="0.25"/>
    <polygon points="16,4 29,27 3,27" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>
    <rect x="15" y="12" width="2" height="7" fill="#FFFFFF"/>
    <circle cx="16" cy="23" r="1.5" fill="#FFFFFF"/>
  </svg>`;
};

const getTrajectorySvg = (index: number) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="#245B84" stroke="#FFFFFF" stroke-width="2.5"/>
    <text x="14" y="18" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle" font-family="monospace">${index + 1}</text>
  </svg>`;
};

export const GISMapComponent: React.FC<GISMapProps> = ({
  onSelectIntersection,
  selectedIntersectionId,
  activeTrajectoryPath,
  showHeatmap = true,
  onSelectCameraForVideo,
  fullScreenPage = false,
  initialLayers
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet'>('google');
  const [googleTrafficUnavailable, setGoogleTrafficUnavailable] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Google Maps Instance References
  const googleMapRef = useRef<any>(null);
  const googleTrafficLayerRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const googleSignalMarkersRef = useRef<any[]>([]);
  const googleCirclesRef = useRef<any[]>([]);
  const googlePolylinesRef = useRef<any[]>([]);

  // Leaflet Fallback Instance References
  const leafletMapRef = useRef<any>(null);
  const leafletTileLayerRef = useRef<any>(null);
  const leafletMarkersRef = useRef<any[]>([]);
  const leafletSignalMarkersRef = useRef<any[]>([]);
  const leafletCirclesRef = useRef<any[]>([]);
  const leafletPolylinesRef = useRef<any[]>([]);

  // Map Style State
  const [mapStyle, setMapStyle] = useState<MapStyleId>(getDefaultMapStyleId());

  // Store & API Data State
  const activeLiveUpdate = useStore((state) => state.activeLiveUpdate);
  const [intersections, setIntersections] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [signals, setSignals] = useState<NetworkSignalState[]>([]);
  const [measurements, setMeasurements] = useState<Record<number, any>>({});
  const [devices, setDevices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [roads, setRoads] = useState<any[]>([]);

  // Selection & Detail Modals
  const [selectedCameraPopup, setSelectedCameraPopup] = useState<any | null>(null);
  const [selectedIntersectionPopup, setSelectedIntersectionPopup] = useState<any | null>(null);
  const [selectedDevicePopup, setSelectedDevicePopup] = useState<any | null>(null);
  const [selectedAlertPopup, setSelectedAlertPopup] = useState<any | null>(null);
  const [selectedRoadPopup, setSelectedRoadPopup] = useState<any | null>(null);

  // Telemetry Freshness
  const [lastDataUpdate, setLastDataUpdate] = useState<Date>(new Date());
  const [dataAgeSec, setDataAgeSec] = useState<number>(0);

  // Comprehensive 8-Layer Controls (Section 3 & 4)
  const [layers, setLayers] = useState({
    googleTraffic: initialLayers?.googleTraffic ?? true,    // Official Google Maps TrafficLayer
    vigitraTraffic: initialLayers?.vigitraTraffic ?? true,  // VIGITRA AI Spatial Congestion Heatmap Overlays
    fixedCameras: initialLayers?.fixedCameras ?? true,      // Fixed CCTV Cameras
    junctions: initialLayers?.junctions ?? true,            // Intersections / Junctions
    signals: initialLayers?.signals ?? true,                // Signals & Adaptive Phase
    mobileDevices: initialLayers?.mobileDevices ?? true,    // Connected Mobile GPS Units
    trajectories: initialLayers?.trajectories ?? true,      // Vehicle Trajectories
    alerts: initialLayers?.alerts ?? true,                  // System Alerts
    roadDensity: initialLayers?.roadDensity ?? true         // Road network links
  });

  const [showLayerPanel, setShowLayerPanel] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(true);

  // 1. Fetch real application data from backend
  const fetchAllData = async () => {
    try {
      const [intRes, camRes, sigRes, measureRes, devRes, alertRes, roadRes] = await Promise.all([
        apiClient.get('/intersections').catch(() => ({ data: [] })),
        apiClient.get('/cameras').catch(() => ({ data: [] })),
        apiClient.get('/signals').catch(() => ({ data: [] })),
        apiClient.get('/traffic/measurements', { params: { limit: 100 } }).catch(() => ({ data: [] })),
        apiClient.get('/devices').catch(() => ({ data: [] })),
        apiClient.get('/alerts').catch(() => ({ data: [] })),
        apiClient.get('/roads').catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(intRes.data)) {
        setIntersections(intRes.data);

        // Seed dynamic signals across network intersections with staggered phase offsets
        const sigData = Array.isArray(sigRes.data) ? sigRes.data : [];
        const networkSignals: NetworkSignalState[] = intRes.data.map((inter: any, idx: number) => {
          const existing = sigData.find((s: any) => s.intersection_id === inter.id);
          const initialPhaseIdx = (idx * 3) % NETWORK_SIGNAL_PHASES.length;
          const initialCountdown = ((idx * 7) % 22) + 4;
          const phaseCfg = NETWORK_SIGNAL_PHASES[initialPhaseIdx];

          return {
            id: existing?.id || inter.id * 100,
            intersection_id: inter.id,
            current_phase: existing?.current_phase || phaseCfg.phase,
            state: phaseCfg.state,
            active_approach: phaseCfg.approach,
            phase_index: initialPhaseIdx,
            countdown: initialCountdown,
            green_duration: existing?.green_duration || 25,
            is_adaptive: existing?.is_adaptive ?? true
          };
        });
        setSignals(networkSignals);
      }

      if (Array.isArray(camRes.data)) setCameras(camRes.data);
      if (Array.isArray(devRes.data)) setDevices(devRes.data);
      if (Array.isArray(alertRes.data)) setAlerts(alertRes.data);
      if (Array.isArray(roadRes.data)) setRoads(roadRes.data);

      if (Array.isArray(measureRes.data)) {
        const mMap: Record<number, any> = {};
        measureRes.data.forEach((m: any) => {
          if (!mMap[m.camera_id]) {
            mMap[m.camera_id] = m;
          }
        });
        setMeasurements(mMap);
      }
      setLastDataUpdate(new Date());
    } catch (err) {
      console.warn('Error fetching map data from backend:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Dynamic Network Signal Cycling Engine (periodically transitions signals across the network)
  useEffect(() => {
    const timer = setInterval(() => {
      setSignals((prevSignals) => {
        if (!prevSignals || prevSignals.length === 0) return prevSignals;

        return prevSignals.map((sig) => {
          const nextCountdown = (sig.countdown || 10) - 1;

          if (nextCountdown <= 0) {
            const nextIdx = ((sig.phase_index ?? 0) + 1) % NETWORK_SIGNAL_PHASES.length;
            const nextPhaseCfg = NETWORK_SIGNAL_PHASES[nextIdx];

            return {
              ...sig,
              phase_index: nextIdx,
              current_phase: nextPhaseCfg.phase,
              state: nextPhaseCfg.state,
              active_approach: nextPhaseCfg.approach,
              countdown: nextPhaseCfg.duration
            };
          }

          return {
            ...sig,
            countdown: nextCountdown
          };
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update data freshness age counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - lastDataUpdate.getTime()) / 1000);
      setDataAgeSec(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastDataUpdate]);

  // Handle Real-Time WebSocket updates (Section 14)
  useEffect(() => {
    if (!activeLiveUpdate) return;
    setLastDataUpdate(new Date());

    if (activeLiveUpdate.event === 'TRAFFIC_UPDATE') {
      const camId = activeLiveUpdate.camera_id || 1;
      setMeasurements((prev) => ({
        ...prev,
        [camId]: {
          ...prev[camId],
          camera_id: camId,
          vehicle_count: activeLiveUpdate.vehicle_count,
          density_state: activeLiveUpdate.density_state,
          queue_length: activeLiveUpdate.queue_length,
          occupancy_percentage: activeLiveUpdate.occupancy_percentage,
          average_speed_kmh: activeLiveUpdate.average_speed || prev[camId]?.average_speed_kmh,
          timestamp: new Date().toISOString()
        }
      }));

      // Update intersection status if provided
      if (activeLiveUpdate.intersection_id) {
        setIntersections((prev) =>
          prev.map((inter) =>
            inter.id === activeLiveUpdate.intersection_id
              ? { ...inter, current_status: activeLiveUpdate.density_state || inter.current_status }
              : inter
          )
        );
      }
    } else if (activeLiveUpdate.event === 'SIGNAL_STATE_CHANGED' && activeLiveUpdate.intersection_id) {
      const { intersection_id, state, active_phase, active_approach, countdown } = activeLiveUpdate;
      setSignals((prev) =>
        prev.map((s) =>
          s.intersection_id === intersection_id
            ? {
                ...s,
                state: (state === 'YELLOW' ? 'YELLOW' : state === 'RED' ? 'RED' : 'GREEN'),
                current_phase: active_phase || s.current_phase,
                active_approach: active_approach || s.active_approach,
                countdown: countdown !== undefined ? countdown : s.countdown
              }
            : s
        )
      );
    } else if (activeLiveUpdate.event === 'ALERT_CREATED' && activeLiveUpdate.alert) {
      setAlerts((prev) => [activeLiveUpdate.alert, ...prev]);
    } else if (activeLiveUpdate.event === 'DEVICE_LOCATION_UPDATE' && activeLiveUpdate.device) {
      const updated = activeLiveUpdate.device;
      setDevices((prev) =>
        prev.map((d) => (d.id === updated.id || d.device_id === updated.device_id ? { ...d, ...updated } : d))
      );
    }
  }, [activeLiveUpdate]);

  // 2. Initialize Map (Google Maps Primary + Leaflet Resilient Fallback)
  useEffect(() => {
    let isCancelled = false;
    const container = mapContainerRef.current;
    if (!container) return;

    const apiKey = getGoogleMapsApiKey();

    const initMap = async () => {
      if (apiKey) {
        try {
          await loadGoogleMapsSdk(apiKey);
          if (isCancelled) return;

          const google = (window as any).google;
          if (google?.maps) {
            // Clean up any existing leaflet map
            if (leafletMapRef.current) {
              try { leafletMapRef.current.remove(); } catch (e) {}
              leafletMapRef.current = null;
            }

            // Create official Google Maps instance
            const map = new google.maps.Map(container, {
              center: { lat: 13.0604, lng: 80.2496 }, // Chennai Central / Spencers Junction
              zoom: 13,
              mapTypeId: mapStyle === 'google-hybrid'
                ? google.maps.MapTypeId.HYBRID
                : mapStyle === 'google-terrain'
                ? google.maps.MapTypeId.TERRAIN
                : google.maps.MapTypeId.ROADMAP,
              zoomControl: true,
              zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
              },
              mapTypeControl: false,
              scaleControl: true,
              streetViewControl: false,
              fullscreenControl: false,
              gestureHandling: 'greedy'
            });

            googleMapRef.current = map;

            // SECTION 1: Create and manage official Google Maps TrafficLayer
            const trafficLayer = new google.maps.TrafficLayer();
            googleTrafficLayerRef.current = trafficLayer;
            // Attach traffic layer to map based on layer toggle
            trafficLayer.setMap(layers.googleTraffic ? map : null);

            setMapEngine('google');
            setGoogleTrafficUnavailable(false);
            setMapLoaded(true);
            return;
          }
        } catch (err) {
          console.warn('Google Maps JS SDK load warning (switching to resilient GIS mode):', err);
        }
      }

      // Fallback to Leaflet if Google Maps API failed or no key
      if (isCancelled) return;
      setGoogleTrafficUnavailable(true);
      setMapEngine('leaflet');

      const L = (window as any).L;
      if (!L || !container) return;

      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch (e) {}
        leafletMapRef.current = null;
      }
      if ((container as any)._leaflet_id) {
        (container as any)._leaflet_id = null;
      }

      try {
        const map = L.map(container, {
          zoomControl: false,
          attributionControl: false
        }).setView([13.0604, 80.2496], 13);
        leafletMapRef.current = map;

        const tileCfg = getTileUrlForStyle(mapStyle);
        const tileLayer = L.tileLayer(tileCfg.url, {
          maxZoom: 19,
          subdomains: tileCfg.subdomains || ['a', 'b', 'c'],
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        leafletTileLayerRef.current = tileLayer;
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        setMapLoaded(true);
      } catch (e) {
        console.warn('Leaflet fallback initialization error:', e);
      }
    };

    const onAuthFailure = () => {
      setGoogleTrafficUnavailable(true);
    };
    window.addEventListener('vigitra:google_auth_failure', onAuthFailure);

    initMap();

    return () => {
      isCancelled = true;
      window.removeEventListener('vigitra:google_auth_failure', onAuthFailure);
      if (googleTrafficLayerRef.current) {
        try { googleTrafficLayerRef.current.setMap(null); } catch (e) {}
        googleTrafficLayerRef.current = null;
      }
      if (googleMapRef.current) {
        googleMapRef.current = null;
      }
      if (leafletMapRef.current) {
        try { leafletMapRef.current.remove(); } catch (e) {}
        leafletMapRef.current = null;
      }
    };
  }, []);

  // SECTION 1: Toggle Google TrafficLayer independently
  useEffect(() => {
    if (googleTrafficLayerRef.current && googleMapRef.current) {
      googleTrafficLayerRef.current.setMap(layers.googleTraffic ? googleMapRef.current : null);
    }
  }, [layers.googleTraffic]);

  // Handle Map Style switching
  useEffect(() => {
    if (mapEngine === 'google' && googleMapRef.current && (window as any).google?.maps) {
      const google = (window as any).google;
      if (mapStyle === 'google-hybrid') {
        googleMapRef.current.setMapTypeId(google.maps.MapTypeId.HYBRID);
      } else if (mapStyle === 'google-terrain') {
        googleMapRef.current.setMapTypeId(google.maps.MapTypeId.TERRAIN);
      } else {
        googleMapRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      }
    } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
      const L = (window as any).L;
      if (!L) return;
      if (leafletTileLayerRef.current) {
        try { leafletMapRef.current.removeLayer(leafletTileLayerRef.current); } catch (e) {}
      }
      const tileCfg = getTileUrlForStyle(mapStyle);
      const newLayer = L.tileLayer(tileCfg.url, {
        maxZoom: 19,
        subdomains: tileCfg.subdomains || ['a', 'b', 'c']
      }).addTo(leafletMapRef.current);
      leafletTileLayerRef.current = newLayer;
    }
  }, [mapStyle, mapEngine]);

  // 3. Render VIGITRA AI Overlays on Google Maps or Leaflet
  useEffect(() => {
    if (!mapLoaded) return;

    if (mapEngine === 'google' && googleMapRef.current && (window as any).google?.maps) {
      renderGoogleOverlays();
    } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
      renderLeafletOverlays();
    }
  }, [
    mapLoaded,
    mapEngine,
    intersections,
    cameras,
    measurements,
    devices,
    alerts,
    roads,
    layers,
    selectedIntersectionId,
    activeTrajectoryPath
  ]);

  // Clear previous Google Maps overlays
  const clearGoogleOverlays = () => {
    googleMarkersRef.current.forEach((m) => m.setMap(null));
    googleMarkersRef.current = [];
    googleSignalMarkersRef.current.forEach((m) => m.setMap(null));
    googleSignalMarkersRef.current = [];
    googleCirclesRef.current.forEach((c) => c.setMap(null));
    googleCirclesRef.current = [];
    googlePolylinesRef.current.forEach((p) => p.setMap(null));
    googlePolylinesRef.current = [];
  };

  // Clear previous Leaflet overlays
  const clearLeafletOverlays = () => {
    const map = leafletMapRef.current;
    if (!map) return;
    leafletMarkersRef.current.forEach((m) => map.removeLayer(m));
    leafletMarkersRef.current = [];
    leafletSignalMarkersRef.current.forEach((m) => map.removeLayer(m));
    leafletSignalMarkersRef.current = [];
    leafletCirclesRef.current.forEach((c) => map.removeLayer(c));
    leafletCirclesRef.current = [];
    leafletPolylinesRef.current.forEach((p) => map.removeLayer(p));
    leafletPolylinesRef.current = [];
  };

  // Google Maps Overlays Renderer
  const renderGoogleOverlays = () => {
    const google = (window as any).google;
    const map = googleMapRef.current;
    if (!google?.maps || !map) return;

    clearGoogleOverlays();

    // 1. VIGITRA AI Traffic Density Spatial Overlays (Section 4 & 9)
    if (layers.vigitraTraffic) {
      intersections.forEach((inter) => {
        if (inter.latitude === undefined || inter.longitude === undefined) return;
        const status = (inter.current_status || 'LOW').toUpperCase();

        let color = '#10B981'; // LOW (Emerald)
        let radius = 220;
        let opacity = 0.22;

        if (status === 'SEVERE' || status === 'CRITICAL') {
          color = '#EF4444';
          radius = 420;
          opacity = 0.35;
        } else if (status === 'HIGH') {
          color = '#F97316';
          radius = 320;
          opacity = 0.30;
        } else if (status === 'MODERATE') {
          color = '#F59E0B';
          radius = 260;
          opacity = 0.26;
        }

        const circle = new google.maps.Circle({
          strokeWeight: 0,
          fillColor: color,
          fillOpacity: opacity,
          map: map,
          center: { lat: inter.latitude, lng: inter.longitude },
          radius: radius,
          clickable: false,
          zIndex: 5
        });
        googleCirclesRef.current.push(circle);
      });
    }

    // 2. Junction Markers (Section 7)
    if (layers.junctions) {
      intersections.forEach((inter) => {
        if (inter.latitude === undefined || inter.longitude === undefined) return;
        const isSelected = selectedIntersectionId === inter.id;
        const status = inter.current_status || 'LOW';

        const marker = new google.maps.Marker({
          position: { lat: inter.latitude, lng: inter.longitude },
          map: map,
          title: `Junction: ${inter.name}`,
          icon: createSvgIcon(getJunctionSvg(status, isSelected), 34, 34),
          zIndex: isSelected ? 30 : 20
        });

        marker.addListener('click', () => {
          setSelectedIntersectionPopup(inter);
          setSelectedCameraPopup(null);
          setSelectedDevicePopup(null);
          setSelectedAlertPopup(null);
          if (onSelectIntersection) onSelectIntersection(inter.id);
        });

        googleMarkersRef.current.push(marker);
      });
    }

    // 3. Fixed CCTV Camera Markers (Section 6)
    if (layers.fixedCameras) {
      cameras.forEach((cam) => {
        const inter = intersections.find((i) => i.id === cam.intersection_id);
        const lat = cam.latitude !== undefined ? cam.latitude : inter?.latitude;
        const lng = cam.longitude !== undefined ? cam.longitude : inter?.longitude;
        if (lat === undefined || lng === undefined) return;

        // Offset slightly if at exact junction center to avoid complete collision
        const offsetLat = lat + 0.00045;
        const offsetLng = lng - 0.00045;
        const isOnline = cam.status === 'ONLINE';

        const marker = new google.maps.Marker({
          position: { lat: offsetLat, lng: offsetLng },
          map: map,
          title: `Camera: ${cam.name}`,
          icon: createSvgIcon(getCameraSvg(isOnline, false), 30, 30),
          zIndex: 25
        });

        marker.addListener('click', () => {
          setSelectedCameraPopup(cam);
          setSelectedIntersectionPopup(null);
          setSelectedDevicePopup(null);
          setSelectedAlertPopup(null);
        });

        googleMarkersRef.current.push(marker);
      });
    }

    // 4. Traffic Signal Status Indicators: Managed dynamically by dedicated signal updater effect below to animate phase cycles smoothly without base tile redrawing

    // 5. Mobile Device Locations (Section 10)
    if (layers.mobileDevices) {
      devices.forEach((dev) => {
        if (!dev.latitude || !dev.longitude) return;
        const lastSeenMs = dev.last_seen ? new Date(dev.last_seen).getTime() : 0;
        const isStale = Date.now() - lastSeenMs > 120000;

        const marker = new google.maps.Marker({
          position: { lat: dev.latitude, lng: dev.longitude },
          map: map,
          title: `Mobile Device: ${dev.name || dev.device_id}`,
          icon: createSvgIcon(getMobileDeviceSvg(isStale), 28, 28),
          zIndex: 35
        });

        marker.addListener('click', () => {
          setSelectedDevicePopup(dev);
          setSelectedCameraPopup(null);
          setSelectedIntersectionPopup(null);
          setSelectedAlertPopup(null);
        });

        googleMarkersRef.current.push(marker);
      });
    }

    // 6. Active Incident & Security Alerts (Section 12)
    if (layers.alerts) {
      alerts.slice(0, 10).forEach((alert) => {
        // Try to associate alert with known intersection or camera coordinates
        let lat: number | undefined;
        let lng: number | undefined;

        if (alert.camera_id) {
          const cam = cameras.find((c) => c.id === alert.camera_id);
          const inter = intersections.find((i) => i.id === cam?.intersection_id);
          lat = inter?.latitude;
          lng = inter?.longitude;
        }
        if (lat === undefined && alert.location) {
          const inter = intersections.find((i) => i.name.toLowerCase().includes(alert.location.toLowerCase()));
          lat = inter?.latitude;
          lng = inter?.longitude;
        }

        if (lat === undefined || lng === undefined) return;

        const marker = new google.maps.Marker({
          position: { lat: lat + 0.0007, lng: lng },
          map: map,
          title: `Alert: ${alert.type} (${alert.severity})`,
          icon: createSvgIcon(getAlertSvg(alert.severity), 32, 32),
          zIndex: 40
        });

        marker.addListener('click', () => {
          setSelectedAlertPopup(alert);
          setSelectedCameraPopup(null);
          setSelectedIntersectionPopup(null);
          setSelectedDevicePopup(null);
        });

        googleMarkersRef.current.push(marker);
      });
    }

    // 7. Road Network Segments (Section 9)
    if (layers.roadDensity) {
      roads.forEach((road) => {
        const srcCam = cameras.find((c) => c.id === road.source_camera_id);
        const tgtCam = cameras.find((c) => c.id === road.target_camera_id);
        if (!srcCam || !tgtCam) return;

        const srcInter = intersections.find((i) => i.id === srcCam.intersection_id);
        const tgtInter = intersections.find((i) => i.id === tgtCam.intersection_id);

        if (srcInter?.latitude && srcInter?.longitude && tgtInter?.latitude && tgtInter?.longitude) {
          const status = srcInter.current_status || 'LOW';
          let color = '#10B981';
          if (status === 'MODERATE') color = '#F59E0B';
          if (status === 'HIGH') color = '#F97316';
          if (status === 'SEVERE' || status === 'CRITICAL') color = '#EF4444';

          const polyline = new google.maps.Polyline({
            path: [
              { lat: srcInter.latitude, lng: srcInter.longitude },
              { lat: tgtInter.latitude, lng: tgtInter.longitude }
            ],
            strokeColor: color,
            strokeOpacity: 0.85,
            strokeWeight: 5,
            map: map,
            zIndex: 10
          });

          polyline.addListener('click', () => {
            const meas = measurements[srcCam.id];
            setSelectedRoadPopup({
              name: road.name,
              source: srcInter.name,
              target: tgtInter.name,
              distance: road.distance_km,
              expectedTime: road.expected_travel_time_sec,
              status: status,
              volume: meas?.vehicle_count ?? 'N/A',
              avgSpeed: meas?.average_speed_kmh ?? 'N/A',
              queue: meas?.queue_length ?? 'N/A'
            });
          });

          googlePolylinesRef.current.push(polyline);
        }
      });
    }

    // 8. Vehicle Trajectories (Section 11)
    if (layers.trajectories && activeTrajectoryPath && activeTrajectoryPath.length > 0) {
      const coords = activeTrajectoryPath.map((p) => ({ lat: p.lat, lng: p.lng }));

      const polyline = new google.maps.Polyline({
        path: coords,
        strokeColor: '#245B84',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        map: map,
        zIndex: 50
      });
      googlePolylinesRef.current.push(polyline);

      activeTrajectoryPath.forEach((pt, idx) => {
        const marker = new google.maps.Marker({
          position: { lat: pt.lat, lng: pt.lng },
          map: map,
          title: `Stop #${idx + 1}: ${pt.cameraName}`,
          icon: createSvgIcon(getTrajectorySvg(idx), 28, 28),
          zIndex: 55
        });
        googleMarkersRef.current.push(marker);
      });

      // Fit bounds to trajectory
      const bounds = new google.maps.LatLngBounds();
      coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, 50);
    }
  };

  // Leaflet Fallback Overlays Renderer (Section 18)
  const renderLeafletOverlays = () => {
    const L = (window as any).L;
    const map = leafletMapRef.current;
    if (!L || !map) return;

    clearLeafletOverlays();

    // 1. VIGITRA Spatial Heatmap Circles
    if (layers.vigitraTraffic) {
      intersections.forEach((inter) => {
        if (inter.latitude === undefined || inter.longitude === undefined) return;
        const status = (inter.current_status || 'LOW').toUpperCase();
        let color = '#10B981';
        let radius = 220;
        let opacity = 0.24;

        if (status === 'SEVERE' || status === 'CRITICAL') {
          color = '#EF4444';
          radius = 420;
          opacity = 0.35;
        } else if (status === 'HIGH') {
          color = '#F97316';
          radius = 320;
          opacity = 0.30;
        } else if (status === 'MODERATE') {
          color = '#F59E0B';
          radius = 260;
          opacity = 0.26;
        }

        const circle = L.circle([inter.latitude, inter.longitude], {
          color: color,
          fillColor: color,
          fillOpacity: opacity,
          radius: radius,
          stroke: false
        }).addTo(map);

        leafletCirclesRef.current.push(circle);
      });
    }

    // 2. Intersections / Junctions
    if (layers.junctions) {
      intersections.forEach((inter) => {
        if (inter.latitude === undefined || inter.longitude === undefined) return;
        const status = inter.current_status || 'LOW';
        let color = '#10B981';
        if (status === 'MODERATE') color = '#F59E0B';
        if (status === 'HIGH') color = '#F97316';
        if (status === 'SEVERE' || status === 'CRITICAL') color = '#EF4444';

        const marker = L.circleMarker([inter.latitude, inter.longitude], {
          radius: 9,
          fillColor: color,
          fillOpacity: 1.0,
          color: '#0F172A',
          weight: 2
        }).addTo(map);

        marker.on('click', () => {
          setSelectedIntersectionPopup(inter);
          if (onSelectIntersection) onSelectIntersection(inter.id);
        });

        leafletMarkersRef.current.push(marker);
      });
    }

    // 3. Cameras
    if (layers.fixedCameras) {
      cameras.forEach((cam) => {
        const inter = intersections.find((i) => i.id === cam.intersection_id);
        const lat = cam.latitude !== undefined ? cam.latitude : inter?.latitude;
        const lng = cam.longitude !== undefined ? cam.longitude : inter?.longitude;
        if (lat === undefined || lng === undefined) return;

        const isOnline = cam.status === 'ONLINE';
        const marker = L.circleMarker([lat + 0.0004, lng - 0.0004], {
          radius: 7,
          fillColor: isOnline ? '#10B981' : '#EF4444',
          fillOpacity: 1.0,
          color: '#FFFFFF',
          weight: 2
        }).addTo(map);

        marker.on('click', () => setSelectedCameraPopup(cam));
        leafletMarkersRef.current.push(marker);
      });
    }

    // 4. Mobile Devices
    if (layers.mobileDevices) {
      devices.forEach((dev) => {
        if (!dev.latitude || !dev.longitude) return;
        const marker = L.circleMarker([dev.latitude, dev.longitude], {
          radius: 8,
          fillColor: '#2563EB',
          fillOpacity: 1.0,
          color: '#FFFFFF',
          weight: 2
        }).addTo(map);

        marker.on('click', () => setSelectedDevicePopup(dev));
        leafletMarkersRef.current.push(marker);
      });
    }

    // 5. Trajectory
    if (layers.trajectories && activeTrajectoryPath && activeTrajectoryPath.length > 0) {
      const coords = activeTrajectoryPath.map((p) => [p.lat, p.lng] as [number, number]);
      const polyline = L.polyline(coords, {
        color: '#245B84',
        weight: 5,
        opacity: 0.95
      }).addTo(map);
      leafletPolylinesRef.current.push(polyline);
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    }
  };

  // 4. Dedicated Network Signal Dynamic Updater (Google Maps & Leaflet)
  // Dynamically cycles signal phase lights across the network without redrawing base layers or tiles
  useEffect(() => {
    if (!mapLoaded) return;

    if (mapEngine === 'google' && googleMapRef.current && (window as any).google?.maps) {
      const google = (window as any).google;
      const map = googleMapRef.current;

      // Clean up previous signal markers
      googleSignalMarkersRef.current.forEach((m) => m.setMap(null));
      googleSignalMarkersRef.current = [];

      if (layers.signals) {
        signals.forEach((sig) => {
          const inter = intersections.find((i) => i.id === sig.intersection_id);
          if (!inter || inter.latitude === undefined || inter.longitude === undefined) return;

          const offsetLat = inter.latitude - 0.00045;
          const offsetLng = inter.longitude + 0.00045;

          const marker = new google.maps.Marker({
            position: { lat: offsetLat, lng: offsetLng },
            map: map,
            title: `Signal: ${inter.name} [${sig.state}] ${sig.active_approach || sig.current_phase} (${sig.countdown}s remaining)`,
            icon: createSvgIcon(getSignalSvg(sig.current_phase, sig.state), 30, 30),
            zIndex: 32
          });

          marker.addListener('click', () => {
            setSelectedIntersectionPopup(inter);
          });

          googleSignalMarkersRef.current.push(marker);
        });
      }
    } else if (mapEngine === 'leaflet' && leafletMapRef.current && (window as any).L) {
      const L = (window as any).L;
      const map = leafletMapRef.current;

      leafletSignalMarkersRef.current.forEach((m) => map.removeLayer(m));
      leafletSignalMarkersRef.current = [];

      if (layers.signals) {
        signals.forEach((sig) => {
          const inter = intersections.find((i) => i.id === sig.intersection_id);
          if (!inter || inter.latitude === undefined || inter.longitude === undefined) return;

          const offsetLat = inter.latitude - 0.00045;
          const offsetLng = inter.longitude + 0.00045;

          const sigColor = sig.state === 'RED' ? '#EF4444' : sig.state === 'YELLOW' ? '#FBBF24' : '#10B981';

          const marker = L.circleMarker([offsetLat, offsetLng], {
            radius: 9,
            fillColor: sigColor,
            fillOpacity: 0.95,
            color: '#0F172A',
            weight: 2.5
          }).addTo(map);

          marker.bindTooltip(`Signal: ${inter.name} [${sig.state}] ${sig.active_approach || ''} (${sig.countdown}s)`, { direction: 'top' });
          marker.on('click', () => setSelectedIntersectionPopup(inter));

          leafletSignalMarkersRef.current.push(marker);
        });
      }
    }
  }, [signals, layers.signals, mapEngine, mapLoaded, intersections]);

  // Helper to format date safely
  const formatTime = (ts?: string | Date) => {
    if (!ts) return 'N/A';
    try {
      const d = typeof ts === 'string' ? new Date(ts) : ts;
      return d.toLocaleTimeString();
    } catch {
      return 'N/A';
    }
  };

  // Get active measurement for a camera or junction
  const getCameraMeasurement = (cameraId: number) => {
    return measurements[cameraId] || null;
  };

  return (
    <div className={`relative w-full ${fullScreenPage ? 'h-full min-h-[550px]' : 'h-[500px] min-h-[420px]'} rounded-xl overflow-hidden border border-[#DCE4EA] bg-[#F8FAFC] shadow-sm select-none`}>
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Non-Blocking Banner: Google Traffic Layer Status (Section 18) */}
      {googleTrafficUnavailable && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-amber-50/95 border border-amber-300 text-amber-900 px-3.5 py-1.5 rounded-lg shadow-sm text-xs font-mono flex items-center gap-2 max-w-md backdrop-blur-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Google Traffic Layer unavailable. Operating in Resilient VIGITRA GIS Mode.</span>
        </div>
      )}

      {/* Top Left: Telemetry & Demo Mode Bar (Section 17) */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#DCE4EA] shadow-xs flex items-center gap-2.5 text-slate-700">
          <div className="flex items-center gap-1.5 font-bold text-[#245B84]">
            <Zap className="w-3.5 h-3.5 text-[#245B84]" />
            <span>TRAFFIC INTELLIGENCE MAP</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1 text-slate-600">
            <span>Age:</span>
            <b className="text-[#245B84]">{dataAgeSec}s</b>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>REALTIME</span>
          </div>
        </div>

        {/* Demo Mode Transparency Badge (Section 17) */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50/95 border border-blue-200 text-blue-900 shadow-xs font-bold text-[10px]">
          <Video className="w-3.5 h-3.5 text-blue-600" />
          <span>DEMO MODE — Camera Source: Demo Video Feeds</span>
        </div>
      </div>

      {/* Top Right: Map Style Selector & Layer Control Button (Section 3) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <MapStyleSelector currentStyle={mapStyle} onStyleChange={setMapStyle} />

        <button
          type="button"
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono shadow-xs backdrop-blur-md transition-all cursor-pointer ${
            showLayerPanel
              ? 'bg-[#245B84] text-white border-[#245B84]'
              : 'bg-white/95 hover:bg-white text-slate-700 border-[#DCE4EA]'
          }`}
          title="Toggle Map Layers"
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">LAYERS</span>
        </button>
      </div>

      {/* Map Layer Control Panel (Section 3 & 4) */}
      {showLayerPanel && (
        <div className="absolute top-14 right-3 z-30 w-72 bg-white/98 backdrop-blur-md rounded-xl border border-slate-200 shadow-xl p-4 text-xs font-mono space-y-3 animate-in fade-in zoom-in-95 duration-100 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Layers className="w-4 h-4 text-[#245B84]" />
              <span>MAP LAYERS</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLayerPanel(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {/* Google Live Traffic Toggle (Section 1 & 4) */}
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={layers.googleTraffic}
                onChange={(e) => setLayers({ ...layers, googleTraffic: e.target.checked })}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Google Live Traffic</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">Live</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Google Maps official real-time street speeds</p>
              </div>
            </label>

            {/* VIGITRA AI Traffic Toggle (Section 4 & 9) */}
            <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={layers.vigitraTraffic}
                onChange={(e) => setLayers({ ...layers, vigitraTraffic: e.target.checked })}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>VIGITRA AI Traffic</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-semibold">AI Vision</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Spatial density heatmaps from YOLOv8 tracking</p>
              </div>
            </label>

            <div className="border-t border-slate-100 pt-2 space-y-2">
              {/* Cameras Layer */}
              <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.fixedCameras}
                    onChange={(e) => setLayers({ ...layers, fixedCameras: e.target.checked })}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>Fixed Cameras</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{cameras.length} nodes</span>
              </label>

              {/* Junctions Layer */}
              <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.junctions}
                    onChange={(e) => setLayers({ ...layers, junctions: e.target.checked })}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>Junctions</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{intersections.length}</span>
              </label>

              {/* Signals Layer */}
              <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.signals}
                    onChange={(e) => setLayers({ ...layers, signals: e.target.checked })}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>Signals & Phases</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{signals.length}</span>
              </label>

              {/* Mobile Devices Layer */}
              <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.mobileDevices}
                    onChange={(e) => setLayers({ ...layers, mobileDevices: e.target.checked })}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>Mobile Devices</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{devices.filter((d) => d.latitude).length} GPS</span>
              </label>

              {/* Trajectories Layer */}
              <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.trajectories}
                    onChange={(e) => setLayers({ ...layers, trajectories: e.target.checked })}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>Trajectories</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{activeTrajectoryPath?.length ? 'Active' : 'Standby'}</span>
              </label>

              {/* Alerts Layer */}
              <label className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.alerts}
                    onChange={(e) => setLayers({ ...layers, alerts: e.target.checked })}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span>Alerts & Events</span>
                </div>
                <span className="text-[10px] text-red-600 font-bold">{alerts.length}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Map Legend (Section 15) */}
      <div className="absolute bottom-4 left-3 z-20">
        <div className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-md p-3 text-[11px] font-mono select-none">
          <div className="flex items-center justify-between gap-3 font-bold text-slate-800 pb-1.5 border-b border-slate-100">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#245B84]" /> MAP LEGEND
            </span>
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className="text-slate-400 hover:text-slate-600 text-[10px]"
            >
              {showLegend ? 'Hide' : 'Show'}
            </button>
          </div>

          {showLegend && (
            <div className="pt-2 space-y-2.5 max-w-[260px]">
              {/* Google Traffic Legend */}
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Google Live Traffic
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Normal flow
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Medium traffic
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" /> Heavy congestion
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" /> Severe delay
                  </div>
                </div>
              </div>

              {/* VIGITRA AI Legend */}
              <div className="border-t border-slate-100 pt-1.5">
                <div className="text-[9px] font-bold text-[#245B84] uppercase tracking-wider mb-1">
                  VIGITRA AI Intelligence
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-3 h-3 text-slate-700" /> Fixed CCTV
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-[#245B84]" /> Junction Node
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-3 h-3 text-blue-600" /> Mobile Unit
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-600" /> Active Alert
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Telemetry Card Modal (Section 6 & 16) */}
      {selectedCameraPopup && (
        <div className="absolute bottom-4 right-4 z-30 bg-white rounded-xl shadow-2xl border border-slate-200 text-xs w-80 font-mono p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 font-bold text-[#245B84]">
              <Video className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{selectedCameraPopup.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCameraPopup(null)}
              className="text-slate-400 hover:text-slate-700 font-bold text-sm"
            >
              ×
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Node ID:</span>
              <b className="text-slate-800">#{selectedCameraPopup.id}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Stream Status:</span>
              <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                selectedCameraPopup.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {selectedCameraPopup.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Source:</span>
              <span className="text-slate-800">{selectedCameraPopup.source_type} (Demo Video)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Frame Rate:</span>
              <span className="text-slate-800">{selectedCameraPopup.fps || 30.0} FPS</span>
            </div>

            {/* Live Measurements (Section 5 & 6: Real data only, no Math.random) */}
            {selectedCameraPopup.status === 'ONLINE' ? (
              (() => {
                const meas = getCameraMeasurement(selectedCameraPopup.id);
                return (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 bg-slate-50 p-2 rounded-lg">
                    <div className="text-[10px] font-bold text-[#245B84] uppercase">Live AI Telemetry</div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vehicles:</span>
                      <b className="text-slate-800">{meas?.vehicle_count ?? 'Waiting for detection...'}</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Traffic Density:</span>
                      <b className="text-slate-800">{meas?.density_state || meas?.congestion_level || 'ANALYZING'}</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Queue Length:</span>
                      <b className="text-slate-800">{meas?.queue_length !== undefined ? `${meas.queue_length} vehicles` : 'N/A'}</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg Speed:</span>
                      <b className="text-slate-800">{meas?.average_speed_kmh ? `${meas.average_speed_kmh} km/h` : 'N/A'}</b>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>Updated:</span>
                      <span>{formatTime(meas?.timestamp)}</span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-[11px]">
                Camera is currently OFFLINE. Live measurements paused.
              </div>
            )}
          </div>

          {onSelectCameraForVideo && (
            <button
              type="button"
              onClick={() => onSelectCameraForVideo(selectedCameraPopup.id)}
              className="w-full py-2 bg-[#245B84] hover:bg-[#1B4564] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              VIEW LIVE STREAM & DETECTIONS
            </button>
          )}
        </div>
      )}

      {/* Junction Telemetry Card Modal (Section 7, 8 & 16) */}
      {selectedIntersectionPopup && (
        <div className="absolute bottom-4 right-4 z-30 bg-white rounded-xl shadow-2xl border border-slate-200 text-xs w-80 font-mono p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 font-bold text-[#245B84]">
              <MapPin className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{selectedIntersectionPopup.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIntersectionPopup(null)}
              className="text-slate-400 hover:text-slate-700 font-bold text-sm"
            >
              ×
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Junction ID:</span>
              <b className="text-slate-800">#{selectedIntersectionPopup.id}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Approaches:</span>
              <span className="text-slate-800">{selectedIntersectionPopup.num_approaches || 4}-Side Dynamic</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Traffic Density:</span>
              <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                selectedIntersectionPopup.current_status === 'HIGH' || selectedIntersectionPopup.current_status === 'SEVERE'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {selectedIntersectionPopup.current_status || 'LOW'}
              </span>
            </div>

            {/* Signal Optimization Status (Section 8) */}
            {(() => {
              const sig = signals.find((s) => s.intersection_id === selectedIntersectionPopup.id);
              if (sig) {
                const isGreen = sig.state === 'GREEN';
                const isYellow = sig.state === 'YELLOW';
                const badgeBg = isGreen
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : isYellow
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300';
                const dotColor = isGreen ? 'bg-emerald-500' : isYellow ? 'bg-amber-500' : 'bg-rose-500';

                return (
                  <div className="mt-2 pt-2 border-t border-slate-100 bg-slate-50 p-2.5 rounded-lg space-y-1.5 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${dotColor} animate-ping`} />
                        <span>Adaptive Signal</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeBg}`}>
                        {sig.state || 'GREEN'} • {sig.countdown ?? 0}s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Active Flow:</span>
                      <b className="text-slate-800">{sig.active_approach || sig.current_phase}</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phase Code:</span>
                      <code className="text-slate-700 bg-white px-1 rounded border border-slate-200 text-[10px]">{sig.current_phase || 'AUTO_DYNAMIC'}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nominal Green:</span>
                      <b className="text-slate-800">{sig.green_duration || 25}s</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cycle Engine:</span>
                      <span className="text-emerald-700 font-bold">
                        {sig.is_adaptive ? 'VIGITRA ADAPTIVE' : 'FIXED CYCLE'}
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div className="text-[10px] text-slate-400 italic">Signal status unavailable for this node</div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Mobile Device Telemetry Card Modal (Section 10) */}
      {selectedDevicePopup && (
        <div className="absolute bottom-4 right-4 z-30 bg-white rounded-xl shadow-2xl border border-slate-200 text-xs w-80 font-mono p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 font-bold text-blue-700">
              <Smartphone className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{selectedDevicePopup.name || selectedDevicePopup.device_id}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDevicePopup(null)}
              className="text-slate-400 hover:text-slate-700 font-bold text-sm"
            >
              ×
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Device ID:</span>
              <b className="text-slate-800">#{selectedDevicePopup.id}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Platform:</span>
              <span className="text-slate-800">{selectedDevicePopup.platform || 'Android Mobile'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Connection:</span>
              <span className="text-emerald-700 font-bold">{selectedDevicePopup.connection_status || 'ONLINE'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Location Status:</span>
              {(() => {
                const lastSeenMs = selectedDevicePopup.last_seen ? new Date(selectedDevicePopup.last_seen).getTime() : 0;
                const isStale = Date.now() - lastSeenMs > 120000;
                return (
                  <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    isStale ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isStale ? 'LOCATION STALE' : 'LOCATION AVAILABLE'}
                  </span>
                );
              })()}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Coordinates:</span>
              <span className="text-slate-800">
                {selectedDevicePopup.latitude?.toFixed(4)}, {selectedDevicePopup.longitude?.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Accuracy:</span>
              <span className="text-slate-800">±{selectedDevicePopup.accuracy_meters || 12}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Battery:</span>
              <span className="text-slate-800">{selectedDevicePopup.battery_pct || 85}%</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
              <span>Last Reported:</span>
              <span>{formatTime(selectedDevicePopup.last_seen)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Alert Card Modal (Section 12) */}
      {selectedAlertPopup && (
        <div className="absolute bottom-4 right-4 z-30 bg-white rounded-xl shadow-2xl border border-red-200 text-xs w-80 font-mono p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center justify-between border-b border-red-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span>ALERT #{selectedAlertPopup.id}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAlertPopup(null)}
              className="text-slate-400 hover:text-slate-700 font-bold text-sm"
            >
              ×
            </button>
          </div>

          <div className="space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Type:</span>
              <b className="text-slate-800">{selectedAlertPopup.type}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Severity:</span>
              <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                selectedAlertPopup.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {selectedAlertPopup.severity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Location:</span>
              <span className="text-slate-800">{selectedAlertPopup.location || 'Monitored Corridor'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vehicle Plate:</span>
              <b className="text-blue-700 font-mono">{selectedAlertPopup.vehicle_plate || 'N/A'}</b>
            </div>
            <div className="p-2 bg-red-50 text-red-900 rounded text-[11px] leading-relaxed mt-1">
              {selectedAlertPopup.message || 'Automated traffic incident alert triggered by monitoring rules.'}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 pt-1">
              <span>Time:</span>
              <span>{formatTime(selectedAlertPopup.timestamp)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Road Segment Telemetry Card Modal (Section 5 & 16: No fake Math.random) */}
      {selectedRoadPopup && (
        <div className="absolute bottom-4 left-4 z-30 bg-white rounded-xl shadow-2xl border border-slate-200 text-xs w-80 font-mono p-4 space-y-2 animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-bold text-[#245B84] truncate">{selectedRoadPopup.name}</h4>
            <button
              type="button"
              onClick={() => setSelectedRoadPopup(null)}
              className="text-slate-400 hover:text-slate-700 font-bold text-sm"
            >
              ×
            </button>
          </div>
          <div className="space-y-1 text-slate-600">
            <p><span className="text-slate-400">Segment:</span> {selectedRoadPopup.source} → {selectedRoadPopup.target}</p>
            <p><span className="text-slate-400">Length:</span> {selectedRoadPopup.distance} km</p>
            <p><span className="text-slate-400">Expected Travel Time:</span> {selectedRoadPopup.expectedTime} sec</p>
            <p><span className="text-slate-400">Traffic Status:</span> <b className="text-[#245B84]">{selectedRoadPopup.status}</b></p>
            <p><span className="text-slate-400">Vehicles:</span> {selectedRoadPopup.volume}</p>
            <p><span className="text-slate-400">Avg Speed:</span> {selectedRoadPopup.avgSpeed !== 'N/A' ? `${selectedRoadPopup.avgSpeed} km/h` : 'N/A'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const GISMap = React.memo(GISMapComponent);
