import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map, Video, AlertTriangle, Layers, Navigation, Search,
  Radio, Zap, Smartphone, Check, Compass, Car
} from 'lucide-react';
import { GISMap, TrajectoryPoint } from '../components/GISMap';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';
import { PageHeader } from '../components/PageHeader';

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
    <div className="p-3 sm:p-5 space-y-3 bg-[#F8FAFC] min-h-screen font-sans select-none">
      {/* Page Header */}
      <PageHeader
        title="Traffic Map"
        subtitle="Live congestion layers, camera locations and active incidents"
        badge={
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]">
            {intersections.length || 34} JUNCTIONS • {cameras.length || 22} CAMERAS • {alerts.length} ALERTS
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-blue-50 text-[#245B84] border border-blue-200 text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#245B84] animate-pulse" />
              GOOGLE TRAFFIC LIVE
            </span>
          </div>
        }
      />

      {/* Unified Search & Trajectory Toolbar */}
      <div className="bg-white p-2.5 rounded-lg border border-[#DCE4EA] shadow-2xs flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Node Search Filter */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Filter junction / node..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 bg-[#F8FAFC] border border-slate-200 rounded-md text-slate-700 placeholder-slate-400 text-xs focus:outline-none focus:border-[#245B84]"
          />
        </div>

        {/* Vehicle Trajectory Query Bar */}
        <form onSubmit={handleSearchPlateTrajectory} className="flex items-center gap-1.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <Car className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Track Plate (e.g. TN01AB1234)..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 bg-[#F8FAFC] border border-slate-200 rounded-md text-slate-700 placeholder-slate-400 text-xs uppercase focus:outline-none focus:border-[#245B84]"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingPlate}
            className="px-2.5 py-1 bg-[#245B84] hover:bg-[#1B4564] text-white rounded-md font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
          >
            {isSearchingPlate ? 'Searching...' : 'Show Path'}
          </button>
          {activeTrajectory && (
            <button
              type="button"
              onClick={clearTrajectory}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-semibold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Trajectory Error Banner if search fails */}
      {plateSearchError && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs font-mono flex items-center justify-between">
          <span>{plateSearchError}</span>
          <button onClick={() => setPlateSearchError(null)} className="text-amber-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* Main Interactive Map Canvas */}
      <div className="h-[calc(100vh-190px)] min-h-[580px] rounded-lg overflow-hidden border border-[#DCE4EA] bg-white shadow-2xs relative">
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
