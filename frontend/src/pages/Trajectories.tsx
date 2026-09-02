import React, { useEffect, useState, useRef } from 'react';
import { Search, Navigation, Info, Eye, Activity, ShieldAlert, CheckCircle, Clock, MapPin, Gauge } from 'lucide-react';
import { apiClient } from '../api/client';

interface GraphNode {
  id: number;
  name: string;
  direction: string;
  status: string;
  lat: number;
  lng: number;
}

interface GraphEdge {
  id: number;
  name: string;
  source: number;
  target: number;
  distance_km: number;
  expected_time_sec: number;
  direction: string;
}

export const Trajectories: React.FC = () => {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [plate, setPlate] = useState<string>('TN01AB1234');
  const [globalVehicleId, setGlobalVehicleId] = useState<string>('GV-10482');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);

  const mapRef = useRef<any>(null);
  const pathLayerRef = useRef<any>(null);
  const markersRef = useRef<any>({});

  const fetchGraph = async () => {
    try {
      const res = await apiClient.get('/gis/graph');
      setGraphData(res.data);
      initMap(res.data.nodes, res.data.edges);
    } catch (err) {
      console.error('Error fetching camera graph:', err);
    }
  };

  useEffect(() => {
    fetchGraph();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const initMap = (nodes: GraphNode[], edges: GraphEdge[]) => {
    const L = (window as any).L;
    if (!L || mapRef.current) return;

    const map = L.map('leaflet-gis-map', {
      zoomControl: false
    }).setView([12.9716, 77.5946], 13);
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    nodes.forEach((node) => {
      let color = '#2E7D5B';
      if (node.status === 'OFFLINE') color = '#C85D5D';
      else if (node.status === 'DEGRADED') color = '#B7791F';

      const htmlIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([node.lat, node.lng], { icon: htmlIcon })
        .addTo(map)
        .on('click', () => {
          setSelectedCamera(node);
        });

      marker.bindTooltip(`<b>${node.name}</b>`, { direction: 'top', offset: [0, -5] });
      markersRef.current[node.id] = node;
    });

    edges.forEach((edge) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        L.polyline([[sourceNode.lat, sourceNode.lng], [targetNode.lat, targetNode.lng]], {
          color: '#CBD5E1',
          weight: 3,
          opacity: 0.6,
          dashArray: '4, 6'
        }).addTo(map);
      }
    });
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!plate || !mapRef.current) return;

    setLoading(true);
    setError('');
    setTimeline([]);
    setAnomalies([]);
    const L = (window as any).L;

    if (pathLayerRef.current) {
      mapRef.current.removeLayer(pathLayerRef.current);
      pathLayerRef.current = null;
    }

    try {
      const cleanPlate = plate.toUpperCase().replace(' ', '');
      const res = await apiClient.get('/vehicles/' + cleanPlate + '/trajectory');
      const data = res.data;
      setTimeline(data.timeline);
      setGlobalVehicleId(data.global_vehicle_id || 'GV-10482');
      setDuration(data.duration_seconds);
      setSpeed(data.average_speed_kmh);
      setDistance(data.estimated_distance_km);
      setAnomalies(data.anomalies || []);

      if (data.timeline && data.timeline.length > 0) {
        const coordinates: [number, number][] = [];

        data.timeline.forEach((item: any) => {
          const node = graphData.nodes.find(n => n.id === item.camera_id);
          if (node) {
            coordinates.push([node.lat, node.lng]);
          } else {
            coordinates.push([item.latitude || 12.9716, item.longitude || 77.5946]);
          }
        });

        if (coordinates.length >= 2) {
          const path = L.polyline(coordinates, {
            color: '#245B84',
            weight: 5,
            opacity: 0.9,
            dashArray: '2, 6'
          }).addTo(mapRef.current);

          pathLayerRef.current = path;
          mapRef.current.fitBounds(path.getBounds(), { padding: [50, 50] });
        }
      }
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setError('No observations found for this license plate.');
      } else {
        setError('Failed to reconstruct vehicle trajectory.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      handleSearch();
    }
  }, [graphData]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-[#F4F8FA]">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-[380px] border-b lg:border-b-0 lg:border-r border-[#DCE4EA] bg-[#F1F6F8] p-5 flex flex-col justify-between shrink-0 overflow-y-auto select-none">
        <div className="space-y-5">
          <div>
            <h1 className="text-sm font-bold text-slate-800 tracking-tight uppercase">CROSS-CAMERA TRAJECTORY RECONSTRUCTION</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Multi-Camera License Plate & Appearance Journey Timeline</p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase">Authorized License Plate Search</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. TN01AB1234"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded pl-3 pr-10 py-2 text-xs text-slate-850 placeholder-slate-400 font-mono focus:border-[#245B84] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-1 top-1 p-1 bg-[#245B84] hover:bg-[#1D4D70] text-white rounded transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-[#FFF5F5] border border-[#DCE4EA] text-[#C85D5D] text-[10px] font-mono rounded">
              {error}
            </div>
          )}

          {/* Trajectory Metadata Card */}
          {timeline.length > 0 && (
            <div className="space-y-4">
              <div className="p-3.5 bg-white rounded border border-[#DCE4EA] space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-mono font-bold text-[#245B84]">GLOBAL ID: {globalVehicleId}</span>
                  <span className="px-2 py-0.5 bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA] font-mono font-bold text-[10px] rounded">
                    VERIFIED MATCH
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[9px]">SIGHTED NODES</span>
                    <p className="font-bold text-slate-700">{timeline.length} Cameras</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[9px]">EST. DISTANCE</span>
                    <p className="font-bold text-slate-700">{distance} km</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[9px]">TRAVEL DURATION</span>
                    <p className="font-bold text-slate-700">{duration} seconds</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[9px]">AVG SPEED</span>
                    <p className="font-bold text-slate-700">{speed} km/h</p>
                  </div>
                </div>
              </div>

              {/* Anomaly Alerts */}
              {anomalies.length > 0 && (
                <div className="p-3 bg-[#FFF5E7] border border-[#DCE4EA] rounded text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[#B7791F] font-bold font-mono">
                    <ShieldAlert className="w-4 h-4" /> ROUTE ANOMALY DETECTED
                  </div>
                  {anomalies.map((anom, i) => (
                    <p key={i} className="text-[10px] text-slate-700 font-sans">{anom.reason}</p>
                  ))}
                </div>
              )}

              {/* Chronological Route Timeline */}
              <h3 className="text-[10px] font-mono font-bold text-slate-600 uppercase">Camera Observation Timeline</h3>
              <div className="relative border-l-2 border-[#245B84]/30 pl-4 ml-2 space-y-4 py-1">
                {timeline.map((item, idx) => (
                  <div key={idx} className="relative space-y-0.5">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#245B84] border-2 border-white" />
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800">{item.camera_name}</h4>
                      <span className="text-[9px] font-mono font-bold text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Location: {item.location} | Lane: {item.lane || 1} ({item.direction})
                    </p>
                    {item.speed_kmh > 0 && (
                      <p className="text-[10px] text-[#2E7D5B] font-mono font-bold">
                        Transit Speed: {item.speed_kmh} km/h
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Map */}
      <div className="flex-1 h-full relative">
        <div id="leaflet-gis-map" className="w-full h-full z-10" />

        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <div className="p-3 bg-white/90 border border-[#DCE4EA] rounded shadow-xs flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#245B84] animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider">
              GIS TRAJECTORY VISUALIZATION
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
