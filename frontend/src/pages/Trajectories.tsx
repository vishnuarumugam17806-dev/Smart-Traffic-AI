import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Navigation, Info, Eye, Activity, ShieldAlert,
  CheckCircle, Clock, MapPin, Gauge, Route as RouteIcon,
  X, RotateCcw
} from 'lucide-react';
import { apiClient } from '../api/client';
import { MapStyleSelector } from '../components/MapStyleSelector';
import { MapStyleId, getDefaultMapStyleId, getTileUrlForStyle } from '../utils/mapProviders';
import { EmptyState } from '../components/EmptyState';
import { FALLBACK_GIS_GRAPH } from '../api/mockFallback';

interface GraphNode {
  id: number;
  name: string;
  direction?: string;
  status: string;
  lat: number;
  lng: number;
}

interface GraphEdge {
  id?: number;
  name?: string;
  road_name?: string;
  source: number;
  target: number;
  distance_km?: number;
  length_km?: number;
  expected_time_sec?: number;
  direction?: string;
}

export const Trajectories: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPlate = searchParams.get('plate') || '';

  const defaultPlate = initialPlate || 'TN01AB1234';
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>(FALLBACK_GIS_GRAPH);
  const [plate, setPlate] = useState<string>(defaultPlate);
  const [activePlate, setActivePlate] = useState<string>(defaultPlate);
  const [globalVehicleId, setGlobalVehicleId] = useState<string>('');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);

  // Quick suggestions from watchlist or recent observations
  const [suggestedPlates, setSuggestedPlates] = useState<string[]>([
    'TN01AB1234', 'TNXX1001', 'TNXX1002', 'KA05MN3821', 'TN01EM9999'
  ]);

  const [mapStyle, setMapStyle] = useState<MapStyleId>(getDefaultMapStyleId());
  const tileLayerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const pathLayerRef = useRef<any>(null);
  const markersRef = useRef<any>({});

  const fetchGraph = async () => {
    try {
      const res = await apiClient.get('/gis/graph');
      if (res.data?.nodes && Array.isArray(res.data.nodes)) {
        setGraphData(res.data);
        initMap(res.data.nodes, res.data.edges);
      } else {
        initMap(FALLBACK_GIS_GRAPH.nodes, FALLBACK_GIS_GRAPH.edges);
      }
    } catch (err) {
      console.warn('Using resilient GIS camera graph:', err);
      initMap(FALLBACK_GIS_GRAPH.nodes, FALLBACK_GIS_GRAPH.edges);
    }
    // Auto-search default vehicle to immediately display route
    setTimeout(() => {
      handleSearch(defaultPlate);
    }, 400);
  };

  useEffect(() => {
    fetchGraph();

    // Fetch actual watchlist plates for suggestions
    apiClient.get('/blacklist').then((res) => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        const plates = res.data.map((d: any) => d.plate).slice(0, 6);
        setSuggestedPlates(plates);
      }
    }).catch(() => {});

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  const initMap = (nodes: GraphNode[], edges: GraphEdge[]) => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {}
      mapRef.current = null;
    }

    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    try {
      const map = L.map(container, {
        zoomControl: false
      }).setView([13.0604, 80.2496], 13);
      mapRef.current = map;

      const tileCfg = getTileUrlForStyle(mapStyle);
      const tileLayer = L.tileLayer(tileCfg.url, {
        maxZoom: mapStyle.startsWith('google') ? 20 : 19,
        subdomains: tileCfg.subdomains || ['a', 'b', 'c'],
        attribution: mapStyle.startsWith('google') ? '&copy; Google Maps' : '&copy; OpenStreetMap'
      });

      tileLayer.on('tileerror', (errEvt: any) => {
        if (errEvt.tile && !errEvt.tile.dataset.retried) {
          errEvt.tile.dataset.retried = 'true';
          errEvt.tile.src = `https://tile.openstreetmap.org/${errEvt.coords.z}/${errEvt.coords.x}/${errEvt.coords.y}.png`;
        }
      });

      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

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
    } catch (err) {
      console.warn('Trajectories Leaflet map init warning:', err);
    }
  };

  const handleSearch = async (targetPlate?: string) => {
    const searchTarget = (targetPlate || plate || '').trim().toUpperCase().replace(/[\s-]/g, '');
    if (!searchTarget || !mapRef.current) return;

    setLoading(true);
    setError('');
    setTimeline([]);
    setAnomalies([]);
    setActivePlate(searchTarget);
    const L = (window as any).L;

    if (pathLayerRef.current) {
      mapRef.current.removeLayer(pathLayerRef.current);
      pathLayerRef.current = null;
    }

    try {
      const res = await apiClient.get(`/vehicles/${searchTarget}/trajectory`);
      const data = res.data;

      if (data && data.timeline && data.timeline.length > 0) {
        setTimeline(data.timeline);
        setGlobalVehicleId(data.global_vehicle_id || `GV-${searchTarget.slice(-4)}`);
        setDuration(data.duration_seconds || 480);
        setSpeed(data.average_speed_kmh || 42.5);
        setDistance(data.estimated_distance_km || 3.8);
        setAnomalies(data.anomalies || []);

        const coordinates: [number, number][] = [];
        data.timeline.forEach((item: any) => {
          const node = graphData.nodes.find(n => n.id === item.camera_id);
          if (node) {
            coordinates.push([node.lat, node.lng]);
          } else if (item.latitude && item.longitude) {
            coordinates.push([item.latitude, item.longitude]);
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
      } else {
        setError(`No camera sightings or trajectory points recorded for vehicle plate ${searchTarget}.`);
      }
    } catch (err: any) {
      setError(`No recorded trajectory found for vehicle ${searchTarget}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPlate('');
    setActivePlate('');
    setTimeline([]);
    setAnomalies([]);
    setError('');
    if (pathLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(pathLayerRef.current);
      pathLayerRef.current = null;
    }
  };

  // If initialPlate exists in URL query param, run search once map is ready
  useEffect(() => {
    if (initialPlate && graphData.nodes.length > 0) {
      handleSearch(initialPlate);
    }
  }, [initialPlate, graphData.nodes.length]);

  // Dynamically swap base map tiles on mapStyle change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    if (tileLayerRef.current) {
      try {
        mapRef.current.removeLayer(tileLayerRef.current);
      } catch (e) {}
    }
    const tileCfg = getTileUrlForStyle(mapStyle);
    const newTileLayer = L.tileLayer(tileCfg.url, {
      maxZoom: mapStyle.startsWith('google') ? 20 : 19,
      subdomains: tileCfg.subdomains || ['a', 'b', 'c'],
      attribution: mapStyle.startsWith('google') ? '&copy; Google Maps' : '&copy; OpenStreetMap'
    });
    newTileLayer.on('tileerror', (error: any) => {
      if (error.tile && !error.tile.dataset.retried) {
        error.tile.dataset.retried = 'true';
        error.tile.src = `https://tile.openstreetmap.org/${error.coords.z}/${error.coords.x}/${error.coords.y}.png`;
      }
    });
    newTileLayer.addTo(mapRef.current);
    tileLayerRef.current = newTileLayer;
  }, [mapStyle]);

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-64px)] overflow-x-hidden bg-[#F4F8FA]">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-[380px] border-b lg:border-b-0 lg:border-r border-[#DCE4EA] bg-[#F1F6F8] p-4 sm:p-5 flex flex-col justify-between shrink-0 overflow-y-auto select-none custom-scrollbar">
        <div className="space-y-4">
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight font-sans uppercase">
              VEHICLE TRACKING
            </h1>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Multi-camera route reconstruction and chronological observation timeline
            </p>
          </div>

          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="space-y-2.5"
          >
            <div className="space-y-1">
              <label className="block text-[10px] font-mono font-bold text-slate-600 uppercase">
                Search Vehicle Plate
              </label>
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Enter number plate (e.g. TNXX1234)..."
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className="flex-1 bg-white border border-[#DCE4EA] rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 font-mono focus:border-[#245B84] focus:outline-none uppercase"
                />
                <button
                  type="submit"
                  disabled={loading || !plate.trim()}
                  className="px-3.5 py-2 bg-[#245B84] hover:bg-[#1E4A6F] disabled:bg-slate-300 text-white font-mono font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>
                {activePlate && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Sighted Plate Chips */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Recent Sighted Plates:</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedPlates.map((sPlate) => (
                  <button
                    key={sPlate}
                    type="button"
                    onClick={() => {
                      setPlate(sPlate);
                      handleSearch(sPlate);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                      activePlate === sPlate
                        ? 'bg-[#245B84] text-white border-[#245B84]'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-[#DCE4EA]'
                    }`}
                  >
                    {sPlate}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Loading Indicator */}
          {loading && (
            <div className="p-4 bg-white rounded-lg border border-[#DCE4EA] text-center space-y-2 text-xs font-mono text-slate-600">
              <div className="w-6 h-6 border-2 border-[#245B84]/30 border-t-[#245B84] rounded-full animate-spin mx-auto" />
              <span>Reconstructing route trajectory for {activePlate}...</span>
            </div>
          )}

          {/* Error / Not Found Display */}
          {error && !loading && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-sans rounded-lg">
              {error}
            </div>
          )}

          {/* Initial Empty State (When no vehicle searched) */}
          {!activePlate && !loading && (
            <div className="py-6">
              <EmptyState
                icon={RouteIcon}
                title="SELECT A VEHICLE"
                description="Enter a number plate above or select a tracked vehicle to view its camera observation trajectory."
              />
            </div>
          )}

          {/* Trajectory Details & Observation Timeline */}
          {activePlate && timeline.length > 0 && !loading && (
            <div className="space-y-4">
              {/* Vehicle Details Card */}
              <div className="p-3.5 bg-white rounded-xl border border-[#DCE4EA] space-y-2.5 text-xs shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Tracking Plate</span>
                    <span className="font-mono font-bold text-slate-900 text-sm tracking-wider">{activePlate}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA] font-mono font-bold text-[10px] rounded">
                    {timeline.length} NODES SIGHTED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-2 bg-[#F8FAFC] rounded border border-slate-100">
                    <span className="text-slate-400 text-[10px] block">Global ID</span>
                    <p className="font-bold text-[#245B84]">{globalVehicleId || 'GV-AUTO'}</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded border border-slate-100">
                    <span className="text-slate-400 text-[10px] block">Est. Distance</span>
                    <p className="font-bold text-slate-800">{distance} km</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded border border-slate-100">
                    <span className="text-slate-400 text-[10px] block">Window Duration</span>
                    <p className="font-bold text-slate-800">{duration}s</p>
                  </div>
                  <div className="p-2 bg-[#F8FAFC] rounded border border-slate-100">
                    <span className="text-slate-400 text-[10px] block">Average Speed</span>
                    <p className="font-bold text-emerald-700">{speed} km/h</p>
                  </div>
                </div>
              </div>

              {/* Anomaly Alerts */}
              {anomalies.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold font-mono">
                    <ShieldAlert className="w-4 h-4" /> ROUTE ANOMALY DETECTED
                  </div>
                  {anomalies.map((anom, i) => (
                    <p key={i} className="text-[11px] text-amber-900 font-sans">{anom.reason}</p>
                  ))}
                </div>
              )}

              {/* Chronological Route Timeline */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-mono font-bold text-slate-700 uppercase">
                  Observation Timeline
                </h3>
                <div className="relative border-l-2 border-[#245B84]/30 pl-4 ml-2 space-y-3 py-1 text-xs">
                  {timeline.map((item, idx) => (
                    <div key={idx} className="relative space-y-0.5">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#245B84] border-2 border-white" />
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 text-xs">{item.camera_name || `Camera #${item.camera_id}`}</h4>
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recent'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-sans">
                        Location: {item.location || 'Surveillance Node'}
                      </p>
                      {item.speed_kmh > 0 && (
                        <p className="text-[10px] text-emerald-700 font-mono font-semibold">
                          Speed: {item.speed_kmh} km/h
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Map */}
      <div className="flex-1 h-[360px] sm:h-[480px] lg:h-full relative min-h-[300px]">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <div className="p-2 sm:p-2.5 bg-white/90 backdrop-blur-xs border border-[#DCE4EA] rounded-lg shadow-xs flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#245B84] animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-wider">
              {activePlate ? `TRAJECTORY: ${activePlate}` : 'GIS NETWORK VIEW'}
            </span>
          </div>
        </div>

        {/* Map Style Selector */}
        <div className="absolute top-3 right-3 z-20">
          <MapStyleSelector currentStyle={mapStyle} onStyleChange={setMapStyle} />
        </div>
      </div>
    </div>
  );
};
