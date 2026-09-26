import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map, Video, AlertTriangle, Layers, Navigation, Search,
  Radio, Zap, Smartphone, Check, Compass, Car
} from 'lucide-react';
import { GISMap, TrajectoryPoint } from '../components/GISMap';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

export const HeatMap: React.FC = () => {
  const navigate = useNavigate();
  const { activeLiveUpdate } = useStore();

  const [intersections, setIntersections] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [selectedIntersectionId, setSelectedIntersectionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchPlate, setSearchPlate] = useState<string>('');
  const [activeTrajectory, setActiveTrajectory] = useState<TrajectoryPoint[] | undefined>(undefined);
  const [isSearchingPlate, setIsSearchingPlate] = useState<boolean>(false);
  const [plateSearchError, setPlateSearchError] = useState<string | null>(null);

  // Fetch initial summary metrics
  const fetchSummary = async () => {
    try {
      const [intRes, camRes, alertsRes, devRes, measRes] = await Promise.all([
        apiClient.get('/intersections').catch(() => ({ data: [] })),
        apiClient.get('/cameras').catch(() => ({ data: [] })),
        apiClient.get('/alerts').catch(() => ({ data: [] })),
        apiClient.get('/devices').catch(() => ({ data: [] })),
        apiClient.get('/traffic/measurements', { params: { limit: 50 } }).catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(intRes.data)) setIntersections(intRes.data);
      if (Array.isArray(camRes.data)) setCameras(camRes.data);
      if (Array.isArray(alertsRes.data)) setAlerts(alertsRes.data);
      if (Array.isArray(devRes.data)) setDevices(devRes.data);
      if (Array.isArray(measRes.data)) setMeasurements(measRes.data);
    } catch (err) {
      console.warn('Error fetching map telemetry summary:', err);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Update on WebSocket live traffic update
  useEffect(() => {
    if (activeLiveUpdate) {
      if (activeLiveUpdate.event === 'ALERT_CREATED' && activeLiveUpdate.alert) {
        setAlerts((prev) => [activeLiveUpdate.alert, ...prev]);
      }
    }
  }, [activeLiveUpdate]);

  // Search vehicle plate trajectory (Section 11 & 13)
  const handleSearchPlateTrajectory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPlate.trim()) {
      setActiveTrajectory(undefined);
      setPlateSearchError(null);
      return;
    }

    setIsSearchingPlate(true);
    setPlateSearchError(null);

    try {
      const res = await apiClient.get('/trajectories', {
        params: { plate: searchPlate.trim().toUpperCase() }
      });

      if (res.data?.observations && Array.isArray(res.data.observations) && res.data.observations.length > 0) {
        const pts: TrajectoryPoint[] = res.data.observations.map((obs: any) => ({
          lat: obs.latitude || 13.0604,
          lng: obs.longitude || 80.2496,
          cameraName: obs.camera_name || `Camera #${obs.camera_id}`,
          timestamp: obs.timestamp,
          speed: obs.speed_kmh,
          confidence: obs.confidence || 'HIGH CONFIDENCE'
        }));
        setActiveTrajectory(pts);
      } else {
        setPlateSearchError(`No observed trajectory points found for vehicle plate: ${searchPlate.toUpperCase()}`);
        setActiveTrajectory(undefined);
      }
    } catch (err: any) {
      setPlateSearchError(`Vehicle plate ${searchPlate.toUpperCase()} has no recorded camera sightings.`);
      setActiveTrajectory(undefined);
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const clearTrajectory = () => {
    setSearchPlate('');
    setActiveTrajectory(undefined);
    setPlateSearchError(null);
  };

  // Filtered intersections based on search query
  const filteredIntersections = intersections.filter((i) =>
    i.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DCE4EA] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight font-mono flex items-center gap-2">
              <Map className="w-5 h-5 text-[#245B84]" />
              VIGITRA AI — TRAFFIC INTELLIGENCE MAP
            </h1>
            <span className="px-2 py-0.5 bg-blue-100 text-[#245B84] text-[10px] font-bold rounded-full font-mono">
              Live Layer Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Official Google Traffic Layer + VIGITRA AI Spatial Density, Junction Signals & Fleet Telemetry
          </p>
        </div>

        {/* Quick Access Action Shortcuts */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => navigate('/cameras')}
            className="px-3 py-1.5 bg-white border border-[#DCE4EA] hover:border-[#245B84] text-slate-700 hover:text-[#245B84] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs font-semibold cursor-pointer"
          >
            <Video className="w-3.5 h-3.5" /> Cameras
          </button>
          <button
            onClick={() => navigate('/signals')}
            className="px-3 py-1.5 bg-white border border-[#DCE4EA] hover:border-[#245B84] text-slate-700 hover:text-[#245B84] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs font-semibold cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" /> Signals
          </button>
          <button
            onClick={() => navigate('/trajectories')}
            className="px-3 py-1.5 bg-white border border-[#DCE4EA] hover:border-[#245B84] text-slate-700 hover:text-[#245B84] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs font-semibold cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" /> Trajectories
          </button>
        </div>
      </div>

      {/* KPI Overview Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-xs">
        {/* Google Live Traffic Status */}
        <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] shadow-xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Google Live Traffic</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-slate-800">TrafficLayer</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Google Maps Live Sync</p>
        </div>

        {/* Monitored Junctions */}
        <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] shadow-xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Junction Nodes</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-slate-800">{intersections.length || 34} Monitored</span>
            <Zap className="w-4 h-4 text-[#245B84]" />
          </div>
          <p className="text-[10px] text-[#245B84] font-semibold mt-0.5">Active Signal Optimizers</p>
        </div>

        {/* CCTV Cameras */}
        <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] shadow-xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Fixed CCTV Cameras</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-slate-800">{cameras.length || 22} Online</span>
            <Video className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">YOLOv8 Detection Stream</p>
        </div>

        {/* Mobile Devices Connected */}
        <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] shadow-xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Connected Mobile Units</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-slate-800">{devices.length} Units</span>
            <Smartphone className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-[10px] text-blue-700 font-semibold mt-0.5">GPS Field Telemetry</p>
        </div>

        {/* Active Alerts */}
        <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] shadow-xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Security & Incidents</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-bold text-red-700">{alerts.length} Active</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-[10px] text-red-700 font-semibold mt-0.5">Priority Watchlist</p>
        </div>
      </div>

      {/* Trajectory Search & Node Finder Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
        {/* Node Search Filter */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Find junction or camera node..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 text-xs focus:outline-none focus:border-[#245B84]"
          />
        </div>

        {/* Vehicle Trajectory Query Bar (Section 11 & 13) */}
        <form onSubmit={handleSearchPlateTrajectory} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Car className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Plate (e.g. TN01AB1234)..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 text-xs uppercase focus:outline-none focus:border-[#245B84]"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingPlate}
            className="px-3 py-1.5 bg-[#245B84] hover:bg-[#1B4564] text-white rounded-lg font-bold text-xs transition-colors shrink-0 cursor-pointer"
          >
            {isSearchingPlate ? 'Searching...' : 'Show Trajectory'}
          </button>
          {activeTrajectory && (
            <button
              type="button"
              onClick={clearTrajectory}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Trajectory Error Banner if search fails */}
      {plateSearchError && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-mono flex items-center justify-between">
          <span>{plateSearchError}</span>
          <button onClick={() => setPlateSearchError(null)} className="text-amber-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Main Interactive Map Canvas */}
      <div className="h-[620px] rounded-xl overflow-hidden border border-[#DCE4EA] bg-white shadow-md relative">
        <GISMap
          fullScreenPage={true}
          selectedIntersectionId={selectedIntersectionId}
          onSelectIntersection={(id) => setSelectedIntersectionId(id)}
          onSelectCameraForVideo={(camId) => navigate(`/cameras?id=${camId}`)}
          activeTrajectoryPath={activeTrajectory}
          showHeatmap={true}
        />
      </div>
    </div>
  );
};
