import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Car, Bell, TrafficCone, Activity, Radio, Search,
  ArrowRight, ShieldCheck, Map, Route, Video, Play, SkipForward
} from 'lucide-react';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';
import { SignalControllerCard } from '../components/SignalControllerCard';
import { GISMap } from '../components/GISMap';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { intersections, cameras, setIntersections, setCameras, activeLiveUpdate } = useStore();
  const [loading, setLoading] = useState<boolean>(true);
  
  // Selection state
  const [selectedIntersectionId, setSelectedIntersectionId] = useState<number | null>(1);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'HIGH'>('ALL');

  // Live KPI Metrics
  const [activeDetections, setActiveDetections] = useState<number>(1482);

  // Live camera stream stats
  const [liveStreamStats, setLiveStreamStats] = useState({
    vehicleCount: 18,
    densityState: 'HIGH',
    queueLength: 7,
    occupancyPct: 62.4,
    fps: 29.8,
    status: 'ONLINE'
  });

  // Demo state
  const [demoStep, setDemoStep] = useState<number>(1);
  const [demoDescription, setDemoDescription] = useState<string>("Step 1: System Online");
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);
  const [alertsFeed, setAlertsFeed] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [intRes, camRes, alertsRes] = await Promise.all([
          apiClient.get('/intersections'),
          apiClient.get('/cameras'),
          apiClient.get('/alerts')
        ]);
        setIntersections(intRes.data);
        setCameras(camRes.data);
        setAlertsFeed(alertsRes.data.slice(0, 5));

        if (intRes.data.length > 0) setSelectedIntersectionId(intRes.data[0].id);
        if (camRes.data.length > 0) setSelectedCameraId(camRes.data[0].id);
      } catch (err) {
        console.error('Error fetching telemetry:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
        setActiveDetections(prev => Math.max(100, prev + (Math.random() > 0.5 ? 1 : -1)));
      } else if (activeLiveUpdate.event === 'ALERT_CREATED') {
        setAlertsFeed(prev => [activeLiveUpdate.alert, ...prev.slice(0, 4)]);
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

  const toggleAutoDemo = () => setIsDemoRunning(!isDemoRunning);

  useEffect(() => {
    let interval: any;
    if (isDemoRunning) {
      interval = setInterval(() => handleNextDemoStep(), 4000);
    }
    return () => clearInterval(interval);
  }, [isDemoRunning, demoStep]);

  const currentIntersection = intersections.find(i => i.id === selectedIntersectionId) || intersections[0];
  const currentCamera = cameras.find(c => c.id === selectedCameraId) || cameras[0];

  const filteredCameras = cameras.filter(cam => {
    const matchesSearch = cam.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'ONLINE') return cam.status === 'ONLINE' || cam.status === 'LIVE';
    if (activeFilter === 'OFFLINE') return cam.status === 'OFFLINE';
    if (activeFilter === 'HIGH') return liveStreamStats.densityState === 'HIGH' || liveStreamStats.densityState === 'SEVERE';
    return true;
  });

  return (
    <div className="p-3 sm:p-5 space-y-4 bg-[#F6F8FA] min-h-screen text-slate-800 font-sans select-none overflow-x-hidden">
      
      {/* 1. TOP HEADER & OPERATOR CONTROL STATUS */}
      <div className="bg-white p-3.5 rounded-lg border border-[#DCE4EA] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-extrabold text-slate-800 uppercase tracking-tight font-mono">
            CITY TRAFFIC CONTROL CENTER
          </h1>
          <p className="text-xs text-slate-500 font-mono">Real-Time Operational Monitoring & Signal Optimization</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1 rounded bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA] font-bold font-mono flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
            SYSTEM ONLINE
          </div>

          <div className="flex items-center gap-1.5 bg-[#EEF6FC] px-2.5 py-1 rounded border border-[#DCE4EA] text-xs font-mono font-bold text-[#245B84]">
            <span>Demo {demoStep}/30</span>
            <button onClick={toggleAutoDemo} className="p-1 hover:text-slate-900" title={isDemoRunning ? "Pause Demo" : "Run Demo"}>
              <Play className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleNextDemoStep} className="p-1 hover:text-slate-900" title="Next Step">
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. OPERATIONAL KPI METRICS & QUICK ACTIONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Connected Cameras */}
        <div 
          onClick={() => navigate('/cameras')}
          className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#245B84] transition-colors"
        >
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase font-mono">CONNECTED CAMERAS</p>
            <h3 className="text-xl font-bold text-[#245B84] mt-0.5">{cameras.length || 4} Active</h3>
            <p className="text-[11px] text-[#2E7D5B] font-bold mt-0.5">3 Fixed | 1 Mobile</p>
          </div>
          <div className="p-2.5 rounded bg-[#EEF6FC] text-[#245B84]">
            <Video className="w-5 h-5" />
          </div>
        </div>

        {/* Vehicles Detected */}
        <div 
          onClick={() => navigate('/anpr')}
          className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#245B84] transition-colors"
        >
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase font-mono">VEHICLES DETECTED</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{activeDetections}</h3>
            <p className="text-[11px] text-[#245B84] font-bold mt-0.5">Live ANPR & Tracking</p>
          </div>
          <div className="p-2.5 rounded bg-[#EEF6FC] text-[#245B84]">
            <Car className="w-5 h-5" />
          </div>
        </div>

        {/* Live Traffic Density */}
        <div 
          onClick={() => navigate('/heatmap')}
          className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#245B84] transition-colors"
        >
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase font-mono">CURRENT DENSITY</p>
            <h3 className="text-xl font-bold text-amber-700 mt-0.5">{liveStreamStats.densityState}</h3>
            <p className="text-[11px] text-amber-700 font-bold mt-0.5">Queue: {liveStreamStats.queueLength} Vehicles</p>
          </div>
          <div className="p-2.5 rounded bg-amber-50 text-amber-700">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Active Alerts */}
        <div 
          onClick={() => navigate('/alerts')}
          className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex items-center justify-between shadow-xs cursor-pointer hover:border-[#245B84] transition-colors"
        >
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase font-mono">ACTIVE ALERTS</p>
            <h3 className="text-xl font-bold text-red-700 mt-0.5">{alertsFeed.length || 2} Active</h3>
            <p className="text-[11px] text-red-700 font-bold mt-0.5">Priority Watchlist</p>
          </div>
          <div className="p-2.5 rounded bg-red-50 text-red-700">
            <Bell className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* QUICK ACCESS ACTION SHORTCUTS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold font-mono">
        <button
          onClick={() => navigate('/cameras')}
          className="p-2.5 rounded-lg bg-white border border-[#DCE4EA] hover:border-[#245B84] text-[#245B84] flex items-center justify-center gap-2 shadow-2xs transition-all"
        >
          <Video className="w-4 h-4" /> Live Cameras
        </button>
        <button
          onClick={() => navigate('/heatmap')}
          className="p-2.5 rounded-lg bg-white border border-[#DCE4EA] hover:border-[#245B84] text-[#245B84] flex items-center justify-center gap-2 shadow-2xs transition-all"
        >
          <Map className="w-4 h-4" /> Traffic Map
        </button>
        <button
          onClick={() => navigate('/trajectories')}
          className="p-2.5 rounded-lg bg-white border border-[#DCE4EA] hover:border-[#245B84] text-[#245B84] flex items-center justify-center gap-2 shadow-2xs transition-all"
        >
          <Route className="w-4 h-4" /> Vehicle Tracking
        </button>
        <button
          onClick={() => navigate('/signals')}
          className="p-2.5 rounded-lg bg-white border border-[#DCE4EA] hover:border-[#245B84] text-[#245B84] flex items-center justify-center gap-2 shadow-2xs transition-all"
        >
          <TrafficCone className="w-4 h-4" /> Signal Control
        </button>
      </div>

      {/* 3. MAIN OPERATIONAL DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left: Camera Selector Panel */}
        <div className="lg:col-span-3 bg-white p-3.5 rounded-lg border border-[#DCE4EA] space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 font-mono">
                <Radio className="w-3.5 h-3.5 text-[#245B84]" /> SELECT CAMERA
              </h2>
              <span className="text-xs text-slate-500 font-mono">{filteredCameras.length} Nodes</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search camera..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F6F8FA] border border-[#DCE4EA] rounded pl-8 pr-2 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#245B84]"
              />
            </div>

            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
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
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#EEF6FC] border-[#245B84] shadow-xs'
                        : 'bg-white border-[#DCE4EA] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-xs">{isMobile ? '📱' : '📹'}</span>
                        <h4 className="font-bold text-xs text-slate-800 truncate">{cam.name}</h4>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded font-mono ${
                        cam.status === 'OFFLINE' ? 'bg-red-100 text-red-700' : 'bg-[#EAF7EF] text-[#2E7D5B]'
                      }`}>
                        {cam.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Live Camera Video Stream */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 font-mono">
              <Camera className="w-4 h-4 text-[#245B84]" /> LIVE VIDEO FEED
            </h2>
            <span className="text-xs font-mono font-bold text-[#245B84]">
              {currentCamera ? currentCamera.name : "CCTV-01 Anna Salai"}
            </span>
          </div>

          <CameraCanvasFeed
            cameraName={currentCamera ? currentCamera.name : "CCTV-01 Anna Salai North"}
            sourceUrl={currentCamera ? currentCamera.source_url : undefined}
            sourceType={currentCamera ? currentCamera.source_type : "DEMO"}
            vehicleCount={liveStreamStats.vehicleCount}
            densityState={liveStreamStats.densityState}
            queueLength={liveStreamStats.queueLength}
            occupancyPct={liveStreamStats.occupancyPct}
          />
        </div>

        {/* Right: Smart Signal Controller */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 font-mono">
            <TrafficCone className="w-4 h-4 text-[#245B84]" /> SIGNAL CONTROL
          </h2>

          <SignalControllerCard
            signalId={selectedIntersectionId || 1}
            intersectionName={currentIntersection ? currentIntersection.name : "Central Junction"}
            initialGreen={55}
            isAdaptive={true}
          />
        </div>
      </div>

      {/* 4. TRAFFIC MAP MATRIX PANEL */}
      <div className="bg-white p-3.5 sm:p-4 rounded-lg border border-[#DCE4EA] space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-2 font-mono">
          <h2 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
            <Map className="w-4 h-4 text-[#245B84]" /> CITY TRAFFIC MAP
          </h2>
          <button 
            onClick={() => navigate('/heatmap')}
            className="text-xs font-bold text-[#245B84] hover:underline flex items-center gap-1"
          >
            Full Screen Map <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-[320px] sm:h-[380px] w-full rounded-lg overflow-hidden border border-[#DCE4EA]">
          <GISMap
            onSelectIntersection={(id) => setSelectedIntersectionId(id)}
            selectedIntersectionId={selectedIntersectionId}
            showHeatmap={true}
            onSelectCameraForVideo={(camId) => setSelectedCameraId(camId)}
          />
        </div>
      </div>
    </div>
  );
};

