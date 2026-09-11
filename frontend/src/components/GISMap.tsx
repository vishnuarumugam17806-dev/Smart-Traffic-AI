import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';
import { Camera, Video, Layers, AlertTriangle, RefreshCw, Zap, Shield, Navigation } from 'lucide-react';

interface GISMapProps {
  onSelectIntersection?: (id: number) => void;
  selectedIntersectionId?: number | null;
  activeTrajectoryPath?: { lat: number; lng: number; cameraName: string; timestamp: string; speed?: number; confidence?: string }[];
  showHeatmap?: boolean;
  onSelectCameraForVideo?: (cameraId: number) => void;
}

export const GISMap: React.FC<GISMapProps> = ({
  onSelectIntersection,
  selectedIntersectionId,
  activeTrajectoryPath,
  showHeatmap = false,
  onSelectCameraForVideo
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const roadLinesRef = useRef<any[]>([]);
  const trajectoryLineRef = useRef<any>(null);
  const trajectoryMarkersRef = useRef<any[]>([]);
  const heatmapOverlayCirclesRef = useRef<any[]>([]);

  const { intersections, cameras, activeLiveUpdate } = useStore();
  const [roads, setRoads] = useState<any[]>([]);
  const [selectedRoad, setSelectedRoad] = useState<any | null>(null);
  const [selectedCameraPopup, setSelectedCameraPopup] = useState<any | null>(null);
  const [lastDataUpdate, setLastDataUpdate] = useState<Date>(new Date());
  const [dataAgeSec, setDataAgeSec] = useState<number>(0);

  // Layer Toggles
  const [layers, setLayers] = useState({
    fixedCameras: true,
    mobileCameras: true,
    roadDensity: true,
    heatmap: showHeatmap,
    signals: true,
    incidents: true
  });

  const [showLayerPanel, setShowLayerPanel] = useState<boolean>(false);

  // Fetch roads topology
  useEffect(() => {
    apiClient.get('/roads')
      .then(res => setRoads(res.data))
      .catch(err => console.error("Error fetching road network:", err));
  }, []);

  // Update data freshness age counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - lastDataUpdate.getTime()) / 1000);
      setDataAgeSec(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastDataUpdate]);

  // Update last data update time when live WebSocket updates arrive
  useEffect(() => {
    if (activeLiveUpdate) {
      setLastDataUpdate(new Date());
    }
  }, [activeLiveUpdate]);

  // Initialize Map Provider safely
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {
        // ignore cleanup error
      }
      mapRef.current = null;
    }

    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    try {
      // Center map around Chennai central coordinates (Anna Salai / Spencers Junction)
      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false
      }).setView([13.0604, 80.2496], 13);

      mapRef.current = map;

      // High quality free OpenStreetMap tile layer (0 API key required)
      const envStyleUrl = (import.meta as any).env?.VITE_MAP_STYLE_URL;
      const styleUrl = (envStyleUrl && !envStyleUrl.includes('cartocdn.com/light_all')) 
        ? envStyleUrl 
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(styleUrl, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });

      tileLayer.on('tileerror', (error: any) => {
        if (error.tile && !error.tile.dataset.retried) {
          error.tile.dataset.retried = 'true';
          error.tile.src = `https://tile.openstreetmap.org/${error.coords.z}/${error.coords.x}/${error.coords.y}.png`;
        }
      });

      tileLayer.addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
    } catch (err) {
      console.warn('GISMap Leaflet initialization warning:', err);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Re-draw all map layers on state & toggle changes
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    const map = mapRef.current;

    // Clear previous layers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    roadLinesRef.current.forEach(line => map.removeLayer(line));
    roadLinesRef.current = [];

    heatmapOverlayCirclesRef.current.forEach(circle => map.removeLayer(circle));
    heatmapOverlayCirclesRef.current = [];

    // 1. Draw Intersections / Fixed & Mobile Camera Nodes
    intersections.forEach((inter) => {
      if (inter.latitude === undefined || inter.longitude === undefined) return;

      const isSelected = selectedIntersectionId === inter.id;
      const statusStr = inter.current_status as string;
      let color = '#2E7D5B'; // LOW (Success Green)
      if (statusStr === 'MODERATE') color = '#B7791F'; // Warning Amber
      if (statusStr === 'HIGH') color = '#D17A4A'; // High Orange
      if (statusStr === 'SEVERE' || statusStr === 'CRITICAL') color = '#C85D5D'; // Severe Red

      // Find associated cameras for this intersection
      const assocCams = cameras.filter(c => c.intersection_id === inter.id);
      const hasMobileCam = assocCams.some(c => c.source_type === 'MOBILE_DEVICE' || c.name.includes('MOBILE'));

      if ((hasMobileCam && !layers.mobileCameras) || (!hasMobileCam && !layers.fixedCameras)) {
        return;
      }

      // Custom marker HTML depending on fixed vs mobile camera
      const badgeIcon = hasMobileCam ? '📱' : '📹';
      const strokeColor = hasMobileCam ? '#D97706' : '#1E293B';

      const htmlIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            ${isSelected ? `<div style="position: absolute; width: 34px; height: 34px; background-color: ${color}; opacity: 0.25; border-radius: 50%; animation: pulse 2s infinite;"></div>` : ''}
            <div style="position: absolute; width: 24px; height: 24px; background-color: ${color}; opacity: 0.35; border-radius: 50%;"></div>
            <div style="position: absolute; width: 14px; height: 14px; background-color: ${color}; border: 2px solid ${strokeColor}; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 8px;">
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([inter.latitude, inter.longitude], { icon: htmlIcon })
        .addTo(map)
        .on('click', () => {
          if (onSelectIntersection) {
            onSelectIntersection(inter.id);
          }
          if (assocCams.length > 0) {
            setSelectedCameraPopup(assocCams[0]);
          }
        });

      marker.bindTooltip(`
        <div style="padding: 6px; font-family: monospace; font-size: 11px; color: #1E293B;">
          <b>${badgeIcon} ${inter.name}</b><br/>
          <span style="color: ${color}; font-weight: bold;">Status: ${inter.current_status} Density</span><br/>
          <span style="color: #64748B; font-size: 10px;">Type: ${hasMobileCam ? 'LINKED MOBILE CAMERA' : 'FIXED CCTV NODE'}</span>
        </div>
      `, { direction: 'top', offset: [0, -10] });

      markersRef.current.push(marker);

      // 2. Draw High Traffic Zone Heatmaps
      if (layers.heatmap || showHeatmap || statusStr === 'HIGH' || statusStr === 'SEVERE' || statusStr === 'CRITICAL') {
        let radius = 200;
        let opacity = 0.22;
        if (statusStr === 'HIGH') radius = 300;
        if (statusStr === 'SEVERE' || statusStr === 'CRITICAL') radius = 420;

        const circle = L.circle([inter.latitude, inter.longitude], {
          radius: radius,
          fillColor: color,
          fillOpacity: opacity,
          stroke: false
        }).addTo(map);

        heatmapOverlayCirclesRef.current.push(circle);
      }
    });

    // 3. Draw Road Network Segments
    if (layers.roadDensity) {
      roads.forEach((road) => {
        const srcCam = cameras.find(c => c.id === road.source_camera_id);
        const tgtCam = cameras.find(c => c.id === road.target_camera_id);

        if (srcCam && tgtCam) {
          const srcInter = intersections.find(i => i.id === srcCam.intersection_id);
          const tgtInter = intersections.find(i => i.id === tgtCam.intersection_id);

          if (srcInter?.latitude && srcInter?.longitude && tgtInter?.latitude && tgtInter?.longitude) {
            const srcStatus = srcInter.current_status as string;
            let color = '#76A98A'; // LOW
            let weight = 4;
            if (srcStatus === 'MODERATE') {
              color = '#D4A84F';
              weight = 5;
            } else if (srcStatus === 'HIGH') {
              color = '#D98855';
              weight = 6;
            } else if (srcStatus === 'SEVERE' || srcStatus === 'CRITICAL') {
              color = '#C95B5B';
              weight = 7;
            }

            const polyline = L.polyline(
              [[srcInter.latitude, srcInter.longitude], [tgtInter.latitude, tgtInter.longitude]],
              {
                color: color,
                weight: weight,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
              }
            ).addTo(map);

            polyline.on('click', () => {
              setSelectedRoad({
                name: road.name,
                distance: road.distance_km,
                expectedTime: road.expected_travel_time_sec,
                status: srcInter.current_status,
                source: srcInter.name,
                target: tgtInter.name,
                volume: Math.floor(Math.random() * 40) + 45,
                avgSpeed: Math.floor(Math.random() * 25) + 20,
                queue: Math.floor(Math.random() * 15) + 10,
                waitingTime: Math.floor(Math.random() * 45) + 25
              });
            });

            polyline.bindTooltip(`
              <div style="font-family: monospace; font-size: 11px; padding: 4px; color: #1E293B;">
                <b>${road.name}</b> (${road.distance_km} km)<br/>
                Status: <span style="color: ${color}; font-weight: bold;">${srcInter.current_status}</span>
              </div>
            `, { direction: 'center' });

            roadLinesRef.current.push(polyline);
          }
        }
      });
    }

  }, [intersections, cameras, roads, selectedIntersectionId, layers, showHeatmap]);

  // 4. Draw Cross-Camera Vehicle Trajectory Route
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    const map = mapRef.current;

    if (trajectoryLineRef.current) {
      map.removeLayer(trajectoryLineRef.current);
      trajectoryLineRef.current = null;
    }
    trajectoryMarkersRef.current.forEach(m => map.removeLayer(m));
    trajectoryMarkersRef.current = [];

    if (activeTrajectoryPath && activeTrajectoryPath.length > 0) {
      const coords = activeTrajectoryPath.map(p => [p.lat, p.lng] as [number, number]);

      const polyline = L.polyline(coords, {
        color: '#245B84',
        weight: 6,
        opacity: 0.95,
        dashArray: '4, 8',
        lineCap: 'round'
      }).addTo(map);

      trajectoryLineRef.current = polyline;

      activeTrajectoryPath.forEach((pt, index) => {
        const marker = L.circleMarker([pt.lat, pt.lng], {
          radius: 8,
          fillColor: '#FFFFFF',
          fillOpacity: 1.0,
          color: '#245B84',
          weight: 3
        }).addTo(map);

        marker.bindTooltip(`
          <div style="font-family: monospace; font-size: 11px; padding: 6px; color: #1E293B;">
            <b>Node #${index + 1}: ${pt.cameraName}</b><br/>
            Sighted: ${new Date(pt.timestamp).toLocaleTimeString()}<br/>
            Match Confidence: <b style="color: #2E7D5B;">${pt.confidence || 'HIGH CONFIDENCE MATCH'}</b><br/>
            ${pt.speed ? `Transition Speed: ${pt.speed} km/h` : 'Initial Sighting'}
          </div>
        `, { direction: 'top', offset: [0, -5] });

        trajectoryMarkersRef.current.push(marker);
      });

      map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
    }
  }, [activeTrajectoryPath]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-[#DCE4EA] bg-[#F6F8FA]">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px] z-10" />

      {/* Map Header Telemetry Bar */}
      <div className="absolute top-3 left-3 z-20 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded border border-[#DCE4EA] shadow-xs flex items-center gap-3 text-[10px] font-mono select-none">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Zap className="w-3.5 h-3.5 text-[#245B84]" /> GIS MAP ENGINE
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1 text-slate-600">
          Data Age: <b className="text-[#245B84]">{dataAgeSec}s</b>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1 text-[#2E7D5B] font-bold">
          <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse"></span>
          REALTIME SYNC
        </div>
      </div>

      {/* Layer Control Button */}
      <button
        onClick={() => setShowLayerPanel(!showLayerPanel)}
        className="absolute top-3 right-3 z-20 p-2 bg-white rounded border border-[#DCE4EA] shadow-xs text-slate-700 hover:text-[#245B84] transition-colors select-none"
        title="Map Layers"
      >
        <Layers className="w-4 h-4" />
      </button>

      {/* Layer Toggle Panel */}
      {showLayerPanel && (
        <div className="absolute top-12 right-3 z-30 bg-white p-3 rounded-lg border border-[#DCE4EA] shadow-md text-xs font-mono space-y-2 select-none w-48">
          <h4 className="font-bold text-slate-800 border-b pb-1 flex items-center justify-between">
            <span>MAP LAYERS</span>
            <button onClick={() => setShowLayerPanel(false)} className="text-slate-400 hover:text-slate-600">×</button>
          </h4>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.fixedCameras}
              onChange={e => setLayers({ ...layers, fixedCameras: e.target.checked })}
            />
            <span>Fixed Cameras</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.mobileCameras}
              onChange={e => setLayers({ ...layers, mobileCameras: e.target.checked })}
            />
            <span>Mobile Cameras</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.roadDensity}
              onChange={e => setLayers({ ...layers, roadDensity: e.target.checked })}
            />
            <span>Traffic Segments</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.heatmap}
              onChange={e => setLayers({ ...layers, heatmap: e.target.checked })}
            />
            <span>Congestion Heatmap</span>
          </label>
        </div>
      )}

      {/* Selected Camera Telemetry Modal */}
      {selectedCameraPopup && (
        <div className="absolute bottom-4 right-4 z-20 bg-white p-4 rounded-lg shadow-lg border border-[#DCE4EA] text-xs max-w-xs space-y-3 select-none">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 font-mono font-bold text-[#245B84]">
              <Video className="w-4 h-4" />
              <span>{selectedCameraPopup.name}</span>
            </div>
            <button onClick={() => setSelectedCameraPopup(null)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
          </div>
          <div className="space-y-1 font-mono text-[11px] text-slate-600">
            <p><span className="text-slate-400">Node ID:</span> #{selectedCameraPopup.id}</p>
            <p><span className="text-slate-400">Source Type:</span> <b className="text-slate-800">{selectedCameraPopup.source_type}</b></p>
            <p><span className="text-slate-400">Stream Status:</span> <span className="font-bold text-[#2E7D5B]">{selectedCameraPopup.status}</span></p>
            <p><span className="text-slate-400">Frame Rate:</span> {selectedCameraPopup.fps || 30.0} FPS</p>
          </div>
          {onSelectCameraForVideo && (
            <button
              onClick={() => onSelectCameraForVideo(selectedCameraPopup.id)}
              className="w-full py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-mono font-bold text-xs rounded transition-colors"
            >
              VIEW LIVE VIDEO
            </button>
          )}
        </div>
      )}

      {/* Selected Road Telemetry Modal */}
      {selectedRoad && (
        <div className="absolute bottom-4 left-4 z-20 bg-white p-4 rounded-lg shadow-lg border border-[#DCE4EA] text-xs max-w-xs space-y-2 select-none font-mono">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-bold text-[#245B84]">{selectedRoad.name}</h4>
            <button onClick={() => setSelectedRoad(null)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
          </div>
          <p><span className="text-slate-500">Route Segment:</span> {selectedRoad.source} → {selectedRoad.target}</p>
          <p><span className="text-slate-500">Distance:</span> {selectedRoad.distance} km</p>
          <p><span className="text-slate-500">Active Vehicles:</span> {selectedRoad.volume} vehicles</p>
          <p><span className="text-slate-500">Average Speed:</span> {selectedRoad.avgSpeed} km/h</p>
          <p><span className="text-slate-500">Queue Length:</span> {selectedRoad.queue} vehicles</p>
          <p><span className="text-slate-500">Waiting Time:</span> {selectedRoad.waitingTime} sec</p>
          <p><span className="text-slate-500">Congestion Level:</span> <span className="font-bold text-[#245B84]">{selectedRoad.status}</span></p>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.6; }
          70% { transform: scale(1.15); opacity: 0.0; }
          100% { transform: scale(0.95); opacity: 0.0; }
        }
      `}</style>
    </div>
  );
};
