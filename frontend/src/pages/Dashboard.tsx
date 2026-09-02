import React, { useEffect, useState } from 'react';
import {
  Camera, Car, Siren, AlertTriangle, TrafficCone, Activity, Play, SkipForward,
  CheckCircle2, ShieldAlert, Search, Filter, Grid, LayoutGrid, Radio, ArrowUpRight,
  TrendingUp, Clock, UserCheck, RefreshCw, Zap
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';
import { SignalControllerCard } from '../components/SignalControllerCard';
import { GISMap } from '../components/GISMap';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

export const Dashboard: React.FC = () => {
  const { intersections, cameras, setIntersections, setCameras, setEmergencyEvents, setIncidents, activeLiveUpdate } = useStore();
  const [loading, setLoading] = useState<boolean>(true);
  
  // Active Selected Node & Camera state
  const [selectedIntersectionId, setSelectedIntersectionId] = useState<number | null>(1);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(1);

  // Search & Filter state for Left Selector Panel
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'EMERGENCY' | 'HIGH'>('ALL');

  // Multi-Camera Grid View Layout state (1 = Single, 2 = Dual Grid, 4 = Quad Grid)
  const [gridViewLayout, setGridViewLayout] = useState<1 | 2 | 4>(1);

  // Live KPI Metrics
  const [activeDetections, setActiveDetections] = useState<number>(1482);
  const [incidentCount, setIncidentCount] = useState<number>(1);
  const [emergencyCount, setEmergencyCount] = useState<number>(1);

  // Live camera stream stats
  const [liveStreamStats, setLiveStreamStats] = useState({
    vehicleCount: 18,
    densityState: 'HIGH',
    queueLength: 7,
    occupancyPct: 62.4,
    fps: 29.8,
    status: 'ONLINE'
  });

  // Hackathon Master Demo Controller State
  const [demoStep, setDemoStep] = useState<number>(1);
  const [demoDescription, setDemoDescription] = useState<string>("Step 1: System Online");
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);

  // Realtime Alerts Feed
  const [alertsFeed, setAlertsFeed] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [intRes, camRes, emRes, incRes, alertsRes] = await Promise.all([
          apiClient.get('/intersections'),
          apiClient.get('/cameras'),
          apiClient.get('/emergency'),
          apiClient.get('/incidents'),
          apiClient.get('/alerts')
        ]);
        setIntersections(intRes.data);
        setCameras(camRes.data);
        setEmergencyEvents(emRes.data);
        setIncidents(incRes.data);
        setIncidentCount(incRes.data.filter((i: any) => i.status !== 'RESOLVED').length || 1);
        setEmergencyCount(emRes.data.filter((e: any) => e.status === 'ACTIVE').length || 1);
        setAlertsFeed(alertsRes.data.slice(0, 10));

        if (intRes.data.length > 0) {
          setSelectedIntersectionId(intRes.data[0].id);
        }
        if (camRes.data.length > 0) {
          setSelectedCameraId(camRes.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching control room telemetry:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handle WebSocket updates
  useEffect(() => {
    if (activeLiveUpdate) {
      if (activeLiveUpdate.event === 'TRAFFIC_UPDATE') {
        setLiveStreamStats({
          vehicleCount: activeLiveUpdate.vehicle_count,
          densityState: activeLiveUpdate.density_state,
          queueLength: activeLiveUpdate.queue_length,
          occupancyPct: activeLiveUpdate.occupancy_percentage,
          fps: activeLiveUpdate.fps || 30.0,
          status: activeLiveUpdate.camera_health || 'ONLINE'
        });

        setActiveDetections(prev => {
          const delta = (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 3);
          return Math.max(100, prev + delta);
        });
      } else if (activeLiveUpdate.event === 'ALERT_CREATED') {
        setAlertsFeed(prev => [activeLiveUpdate.alert, ...prev.slice(0, 9)]);
        if (activeLiveUpdate.alert.type === 'POTENTIAL_INCIDENT' || activeLiveUpdate.alert.type === 'CONGESTION') {
          setIncidentCount(prev => prev + 1);
        } else if (activeLiveUpdate.alert.type === 'EMERGENCY_VEHICLE' || activeLiveUpdate.alert.type === 'EMERGENCY_DETECTED') {
          setEmergencyCount(prev => prev + 1);
        }
      } else if (activeLiveUpdate.event === 'DEMO_STEP_CHANGED') {
        setDemoStep(activeLiveUpdate.step);
        setDemoDescription(activeLiveUpdate.description);
      }
    }
  }, [activeLiveUpdate]);

  const handleNextDemoStep = async () => {
    const nextStep = demoStep >= 30 ? 1 : demoStep + 1;
    try {
      const res = await apiClient.post(`/demo/step/${nextStep}`);
      setDemoStep(res.data.step);
      setDemoDescription(res.data.description);
    } catch (err) {
      console.error("Error triggering demo step:", err);
    }
  };

  const toggleAutoDemo = async () => {
    setIsDemoRunning(!isDemoRunning);
  };

  useEffect(() => {
    let interval: any;
    if (isDemoRunning) {
      interval = setInterval(() => {
        handleNextDemoStep();
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isDemoRunning, demoStep]);

  // Currently selected intersection and camera objects
  const currentIntersection = intersections.find(i => i.id === selectedIntersectionId) || intersections[0];
  const currentCamera = cameras.find(c => c.id === selectedCameraId) || cameras[0];

  // Filtered cameras / intersections for Left Panel
  const filteredCameras = cameras.filter(cam => {
    const matchesSearch = cam.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeFilter === 'ONLINE') return cam.status === 'ONLINE' || cam.status === 'LIVE' || cam.status === 'SIMULATION';
    if (activeFilter === 'OFFLINE') return cam.status === 'OFFLINE';
    if (activeFilter === 'EMERGENCY') return emergencyCount > 0;
    if (activeFilter === 'HIGH') return liveStreamStats.densityState === 'HIGH' || liveStreamStats.densityState === 'SEVERE';
    return true;
  });

  return (
    <div className="p-5 space-y-5 bg-[#F6F8FA] min-h-screen text-slate-800 font-sans select-none">
      
      {/* 1. TOP BAR: Traffic Control Room */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded bg-[#245B84] text-white">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">
                TRAFFIC CONTROL ROOM
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                Monitor traffic, vehicles and signals in real time.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse"></span>
              System Online
            </div>
            <div className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 border border-[#DCE4EA] font-bold flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#245B84]" />
              Traffic Operator
            </div>
          </div>
        </div>

        {/* Demonstration Mode Controller */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-[#EEF6FC] text-[#245B84] font-bold text-xs border border-[#DCE4EA]">
              Demo Step {demoStep} of 30
            </span>
            <span className="text-xs font-bold text-slate-800">{demoDescription}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoDemo}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isDemoRunning ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-[#245B84] text-white hover:bg-[#1E4A6F]'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              {isDemoRunning ? 'Pause Demo' : 'Run Demo'}
            </button>

            <button
              onClick={handleNextDemoStep}
              className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-[#DCE4EA] text-xs font-bold flex items-center gap-1.5"
            >
              <SkipForward className="w-3.5 h-3.5" /> Next Step
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">CAMERAS</p>
            <h3 className="text-xl font-bold text-[#245B84] mt-0.5">{cameras.length || 4} Connected</h3>
            <p className="text-xs text-[#2E7D5B] font-bold mt-0.5">3 Online | 1 Mobile</p>
          </div>
          <div className="p-2.5 rounded bg-[#EEF6FC] text-[#245B84]">
            <Camera className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">VEHICLES DETECTED</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{activeDetections}</h3>
            <p className="text-xs text-[#245B84] font-bold mt-0.5">Real-time detection</p>
          </div>
          <div className="p-2.5 rounded bg-[#EEF6FC] text-[#245B84]">
            <Car className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">INCIDENTS</p>
            <h3 className="text-xl font-bold text-amber-700 mt-0.5">{incidentCount} Active</h3>
            <p className="text-xs text-amber-700 font-bold mt-0.5">Requires attention</p>
          </div>
          <div className="p-2.5 rounded bg-amber-50 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">EMERGENCIES</p>
            <h3 className="text-xl font-bold text-red-700 mt-0.5">{emergencyCount} Active</h3>
            <p className="text-xs text-red-700 font-bold mt-0.5 animate-pulse">Priority granted</p>
          </div>
          <div className="p-2.5 rounded bg-red-50 text-red-700">
            <Siren className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Panel: Camera Selector */}
        <div className="lg:col-span-3 bg-white p-4 rounded-lg border border-[#DCE4EA] space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#245B84]" /> SELECT CAMERA
              </h2>
              <span className="text-xs text-slate-500">{filteredCameras.length} Cameras</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search cameras..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F6F8FA] border border-[#DCE4EA] rounded pl-8 pr-2 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#245B84]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1 select-none text-xs font-bold">
              {(['ALL', 'ONLINE', 'OFFLINE', 'EMERGENCY', 'HIGH'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-2 py-1 rounded transition-colors ${
                    activeFilter === f ? 'bg-[#245B84] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'HIGH' ? 'HIGH TRAFFIC' : f}
                </button>
              ))}
            </div>

            {/* Camera List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredCameras.map((cam) => {
                const isSelected = selectedCameraId === cam.id;
                const isMobile = cam.source_type === 'MOBILE_DEVICE' || cam.name.includes('MOBILE');
                return (
                  <div
                    key={cam.id}
                    onClick={() => {
                      setSelectedCameraId(cam.id);
                      if (cam.intersection_id) setSelectedIntersectionId(cam.intersection_id);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#EEF6FC] border-[#245B84] shadow-xs'
                        : 'bg-white border-[#DCE4EA] hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{isMobile ? '📱' : '📹'}</span>
                        <h4 className="font-bold text-xs text-slate-800">{cam.name}</h4>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        cam.status === 'OFFLINE' ? 'bg-red-100 text-red-700' : 'bg-[#EAF7EF] text-[#2E7D5B]'
                      }`}>
                        {cam.status}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Direction: {cam.direction}</span>
                      <span className="font-bold text-[#245B84]">{isMobile ? 'MOBILE' : 'FIXED'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Panel: Live Cameras */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#245B84]" /> LIVE CAMERAS
            </h2>

            {/* Layout Grid Switcher */}
            <div className="flex items-center gap-1 select-none text-xs font-bold">
              <button
                onClick={() => setGridViewLayout(1)}
                className={`px-2 py-1 rounded border flex items-center gap-1 ${
                  gridViewLayout === 1 ? 'bg-[#245B84] text-white border-[#245B84]' : 'bg-white text-slate-700 border-[#DCE4EA]'
                }`}
              >
                1 CAMERA
              </button>
              <button
                onClick={() => setGridViewLayout(2)}
                className={`px-2 py-1 rounded border flex items-center gap-1 ${
                  gridViewLayout === 2 ? 'bg-[#245B84] text-white border-[#245B84]' : 'bg-white text-slate-700 border-[#DCE4EA]'
                }`}
              >
                2 CAMERAS
              </button>
              <button
                onClick={() => setGridViewLayout(4)}
                className={`px-2 py-1 rounded border flex items-center gap-1 ${
                  gridViewLayout === 4 ? 'bg-[#245B84] text-white border-[#245B84]' : 'bg-white text-slate-700 border-[#DCE4EA]'
                }`}
              >
                4 CAMERAS
              </button>
            </div>
          </div>

          {/* Render Camera Feed */}
          {gridViewLayout === 1 && (
            <CameraCanvasFeed
              cameraName={currentCamera ? currentCamera.name : "CCTV-01 Central Plaza North"}
              sourceType={currentCamera ? currentCamera.source_type : "DEMO"}
              vehicleCount={liveStreamStats.vehicleCount}
              densityState={liveStreamStats.densityState}
              queueLength={liveStreamStats.queueLength}
              occupancyPct={liveStreamStats.occupancyPct}
              emergencyDetected={emergencyCount > 0}
            />
          )}

          {gridViewLayout === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CameraCanvasFeed
                cameraName={cameras[0]?.name || "CCTV-01 Central Plaza North"}
                sourceType={cameras[0]?.source_type || "DEMO"}
                vehicleCount={14}
                densityState="MODERATE"
              />
              <CameraCanvasFeed
                cameraName={cameras[1]?.name || "CCTV-02 Metro Station Cross"}
                sourceType={cameras[1]?.source_type || "DEMO"}
                vehicleCount={22}
                densityState="HIGH"
              />
            </div>
          )}

          {gridViewLayout === 4 && (
            <div className="grid grid-cols-2 gap-3">
              {cameras.slice(0, 4).map((cam, idx) => (
                <CameraCanvasFeed
                  key={idx}
                  cameraName={cam.name}
                  sourceType={cam.source_type}
                  vehicleCount={12 + idx * 4}
                  densityState={idx % 2 === 0 ? "MODERATE" : "HIGH"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Traffic Status & Smart Signal Control */}
        <div className="lg:col-span-3 space-y-3 select-none">
          <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#245B84]" /> TRAFFIC STATUS
          </h2>

          <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] space-y-3 text-xs">
            <div className="border-b border-[#DCE4EA] pb-2 flex items-center justify-between">
              <span className="font-bold text-slate-700">VEHICLES</span>
              <span className="text-[#245B84] font-bold">{liveStreamStats.vehicleCount} Total</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-sans">
              <div className="p-2 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                <p className="text-slate-500 text-[10px]">Cars</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{Math.floor(liveStreamStats.vehicleCount * 0.6)}</p>
              </div>
              <div className="p-2 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                <p className="text-slate-500 text-[10px]">Bikes</p>
                <p className="font-bold text-[#2E7D5B] text-sm mt-0.5">{Math.floor(liveStreamStats.vehicleCount * 0.2)}</p>
              </div>
              <div className="p-2 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                <p className="text-slate-500 text-[10px]">Buses</p>
                <p className="font-bold text-[#245B84] text-sm mt-0.5">{Math.floor(liveStreamStats.vehicleCount * 0.1)}</p>
              </div>
              <div className="p-2 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                <p className="text-slate-500 text-[10px]">Trucks</p>
                <p className="font-bold text-amber-700 text-sm mt-0.5">{Math.floor(liveStreamStats.vehicleCount * 0.1)}</p>
              </div>
            </div>

            <div className="border-t border-[#DCE4EA] pt-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Traffic Level:</span>
                <span className="font-bold text-[#245B84]">{liveStreamStats.densityState}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Queue Length:</span>
                <span className="font-bold text-amber-700">{liveStreamStats.queueLength} vehicles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Average Speed:</span>
                <span className="font-bold text-[#2E7D5B]">34 km/h</span>
              </div>
            </div>
          </div>

          {/* Smart Signal Control */}
          <SignalControllerCard
            signalId={selectedIntersectionId || 1}
            intersectionName={currentIntersection ? currentIntersection.name : "Central Junction"}
            initialGreen={55}
            isAdaptive={true}
          />
        </div>
      </div>

      {/* Bottom Panel: Traffic Map */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] space-y-3">
        <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#245B84]" /> TRAFFIC MAP
          </h2>
          <span className="text-xs text-slate-500">Click any camera on map to select</span>
        </div>

        <div className="h-[380px] w-full rounded-lg overflow-hidden border border-[#DCE4EA]">
          <GISMap
            onSelectIntersection={(id) => setSelectedIntersectionId(id)}
            selectedIntersectionId={selectedIntersectionId}
            showHeatmap={demoStep >= 9}
            onSelectCameraForVideo={(camId) => setSelectedCameraId(camId)}
          />
        </div>
      </div>
    </div>
  );
};
