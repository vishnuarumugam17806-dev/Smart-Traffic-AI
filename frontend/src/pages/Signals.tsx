import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  Cpu,
  RotateCcw,
  Settings,
  Check,
  TrafficCone,
  Radio,
  AlertCircle,
  Video,
  Clock,
  Car,
  Activity,
  CheckCircle2,
  AlertTriangle,
  History,
  Layers,
  Play,
  Pause,
  Sliders,
  ChevronDown,
  Monitor,
  Eye,
  Sparkles,
  Zap
} from 'lucide-react';
import { apiClient, resolveVideoUrl } from '../api/client';
import { Intersection } from '../types';
import { useStore } from '../store/useStore';
import { FALLBACK_INTERSECTIONS, FALLBACK_SIGNAL_DATA } from '../api/mockFallback';
import { IntersectionRadiusRadar } from '../components/IntersectionRadiusRadar';

interface ApproachData {
  key: string;
  name: string;
  direction: string;
  camera_id?: number;
  camera_status?: string; // DATA_AVAILABLE, DATA_STALE, CAMERA_OFFLINE, NO_DETECTION
  vehicle_count: number;
  queue_length: number;
  waiting_time: number;
  traffic_density?: string;
  demand_score?: number;
  priority_score?: number;
  green_duration?: number;
  signal?: string; // GREEN, YELLOW, RED
  emergency_detected?: boolean;
  emergency_type?: string;
  is_queue_available?: boolean;
}

interface DemoCamera {
  camera_id: number;
  camera_name: string;
  junction_id: number;
  approach_id: string;
  source_type: string;
  video_source: string;
  status: string;
  direction: string;
  location: string;
  enabled: boolean;
  demo_mode: boolean;
}

interface DecisionRecord {
  id: number;
  junction_id: number;
  approach_id: string;
  vehicle_count: number;
  queue_length: number;
  traffic_density: string;
  waiting_time: number;
  demand_score: number;
  priority_score: number;
  green_duration: number;
  signal_state: string;
  mode: string;
  decision_reason: string;
  timestamp: string;
}

export const Signals: React.FC = () => {
  const { activeLiveUpdate } = useStore();
  const [intersections, setIntersections] = useState<Intersection[]>(FALLBACK_INTERSECTIONS);
  const [selectedJunctionId, setSelectedJunctionId] = useState<number>(13); // Default to TEST-JUNCTION-2 for instant demo
  const [signalData, setSignalData] = useState<any>(FALLBACK_SIGNAL_DATA);
  const [trafficData, setTrafficData] = useState<any>(null);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [decisionHistory, setDecisionHistory] = useState<DecisionRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Demo Camera State (Sections 3 & 4: Dynamic Camera Display Selection)
  const [junctionCameras, setJunctionCameras] = useState<DemoCamera[]>([]);
  const [numCamerasToDisplay, setNumCamerasToDisplay] = useState<number>(2);
  const [selectedCameraIds, setSelectedCameraIds] = useState<number[]>([]);
  const [isDemoPlaying, setIsDemoPlaying] = useState<boolean>(true);
  const [isAutoOptimizing, setIsAutoOptimizing] = useState<boolean>(true);

  // Video playback & signal counter interaction refs & notification
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const [vehiclePassNotice, setVehiclePassNotice] = useState<{ approach: string; text: string } | null>(null);

  // Manual Override State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [manualApproach, setManualApproach] = useState<string>('');
  const [manualReason, setManualReason] = useState<string>('Heavy congestion queue clearance');
  const [overrideMessage, setOverrideMessage] = useState<string>('');

  // Configure Junction Modal State
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configNumApproaches, setConfigNumApproaches] = useState<number>(4);
  const [configApproaches, setConfigApproaches] = useState<{ id: string; name: string; direction: string }[]>([]);

  // Fetch list of intersections
  const fetchIntersections = async () => {
    try {
      const res = await apiClient.get('/intersections');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setIntersections(res.data);
      }
    } catch (err) {
      console.warn('Using resilient fallback intersections for signal control:', err);
    }
  };

  // Fetch live signal, traffic, and optimization data for selected junction
  const fetchJunctionData = useCallback(async () => {
    if (!selectedJunctionId) return;
    try {
      const [sigRes, trafRes, optRes, histRes] = await Promise.all([
        apiClient.get(`/intersections/${selectedJunctionId}/signal`),
        apiClient.get(`/intersections/${selectedJunctionId}/traffic`),
        apiClient.get(`/intersections/${selectedJunctionId}/optimization`),
        apiClient.get(`/intersections/${selectedJunctionId}/decision-history?limit=15`).catch(() => ({ data: [] }))
      ]);
      setSignalData(sigRes.data);
      setTrafficData(trafRes.data);
      setOptimizationData(optRes.data);
      if (Array.isArray(histRes.data)) {
        setDecisionHistory(histRes.data);
      }
    } catch (err) {
      console.error(`Error fetching data for junction #${selectedJunctionId}:`, err);
    }
  }, [selectedJunctionId]);

  // Fetch demo cameras for the selected junction (Section 3 & 4)
  const fetchJunctionCameras = useCallback(async () => {
    if (!selectedJunctionId) return;
    try {
      const res = await apiClient.get(`/intersections/${selectedJunctionId}/cameras`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setJunctionCameras(res.data);
        // Default select the first N cameras
        const initialCount = Math.min(numCamerasToDisplay, res.data.length);
        setSelectedCameraIds(res.data.slice(0, initialCount).map((c: DemoCamera) => c.camera_id));
      } else {
        // Fallback demo cameras mapped to test traffic videos
        const fallbackCams: DemoCamera[] = [
          {
            camera_id: 101,
            camera_name: 'CCTV-01 North Approach',
            junction_id: selectedJunctionId,
            approach_id: 'NORTH',
            source_type: 'DEMO_SIMULATION',
            video_source: '/videos/sample_traffic_urban.mp4',
            status: 'LIVE',
            direction: 'NORTH',
            location: 'Main North Corridor',
            enabled: true,
            demo_mode: true
          },
          {
            camera_id: 102,
            camera_name: 'CCTV-02 South Approach',
            junction_id: selectedJunctionId,
            approach_id: 'SOUTH',
            source_type: 'DEMO_SIMULATION',
            video_source: '/videos/sample_traffic_congested.mp4',
            status: 'LIVE',
            direction: 'SOUTH',
            location: 'South Flyover Entry',
            enabled: true,
            demo_mode: true
          },
          {
            camera_id: 103,
            camera_name: 'CCTV-03 East Approach',
            junction_id: selectedJunctionId,
            approach_id: 'EAST',
            source_type: 'DEMO_SIMULATION',
            video_source: '/videos/sample_traffic_highway.mp4',
            status: 'LIVE',
            direction: 'EAST',
            location: 'East Express Link',
            enabled: true,
            demo_mode: true
          },
          {
            camera_id: 104,
            camera_name: 'CCTV-04 West Approach',
            junction_id: selectedJunctionId,
            approach_id: 'WEST',
            source_type: 'DEMO_SIMULATION',
            video_source: '/videos/sample_traffic_junction.mp4',
            status: 'LIVE',
            direction: 'WEST',
            location: 'West Arterial',
            enabled: true,
            demo_mode: true
          }
        ];
        setJunctionCameras(fallbackCams);
        setSelectedCameraIds(fallbackCams.slice(0, numCamerasToDisplay).map((c) => c.camera_id));
      }
    } catch (err) {
      console.warn('Error fetching junction cameras:', err);
    }
  }, [selectedJunctionId, numCamerasToDisplay]);

  useEffect(() => {
    fetchIntersections();
  }, []);

  useEffect(() => {
    fetchJunctionData();
    fetchJunctionCameras();
    const interval = setInterval(fetchJunctionData, 2000);
    return () => clearInterval(interval);
  }, [fetchJunctionData, fetchJunctionCameras]);

  // Real-time instant updates via WebSocket (Section 14 & 32)
  useEffect(() => {
    if (!activeLiveUpdate) return;
    if (
      activeLiveUpdate.event === 'SIGNAL_STATE_CHANGED' &&
      Number(activeLiveUpdate.intersection_id) === Number(selectedJunctionId)
    ) {
      setSignalData((prev: any) => ({
        ...prev,
        active_approach: activeLiveUpdate.active_approach,
        active_phase: activeLiveUpdate.active_phase,
        state: activeLiveUpdate.state,
        countdown: activeLiveUpdate.countdown,
        mode: activeLiveUpdate.mode,
        reasoning: activeLiveUpdate.reasoning,
        elapsed_green_time: activeLiveUpdate.elapsed_green_time,
        current_metrics: activeLiveUpdate.current_metrics,
        approaches: activeLiveUpdate.approaches
      }));
    }
  }, [activeLiveUpdate, selectedJunctionId]);

  const activeJunction = useMemo(() => {
    return intersections.find((i) => i.id === selectedJunctionId) || intersections[0];
  }, [intersections, selectedJunctionId]);

  // Quick switch between Section 25 Test Junctions
  const testJunctions = useMemo(() => {
    return intersections.filter((i) => i.name.startsWith('TEST-JUNCTION'));
  }, [intersections]);

  const standardJunctions = useMemo(() => {
    return intersections.filter((i) => !i.name.startsWith('TEST-JUNCTION'));
  }, [intersections]);

  // Automatically adjust default number of cameras displayed when switching junctions
  const handleSelectJunction = (junctionId: number) => {
    setSelectedJunctionId(junctionId);
    const target = intersections.find((i) => i.id === junctionId);
    if (target) {
      const num = target.num_approaches || 2;
      setNumCamerasToDisplay(num);
    }
  };

  // Section 3: Flow for operator to select NUMBER OF CAMERAS to display
  const handleNumCamerasChange = (count: number) => {
    setNumCamerasToDisplay(count);
    if (junctionCameras.length > 0) {
      const updated = junctionCameras.slice(0, count).map((c) => c.camera_id);
      setSelectedCameraIds(updated);
    }
  };

  // Toggle specific camera inclusion in the display
  const toggleCameraSelection = (camId: number) => {
    setSelectedCameraIds((prev) => {
      if (prev.includes(camId)) {
        if (prev.length <= 1) return prev; // Keep at least one camera
        return prev.filter((id) => id !== camId);
      } else {
        return [...prev, camId];
      }
    });
  };

  const handleApplyManualOverride = async () => {
    if (!manualApproach || !manualReason) return;
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/manual-override`, {
        phase: manualApproach,
        reason: manualReason
      });
      setOverrideMessage(`Manual override initiated for ${manualApproach} approach. Transitioning safely via clearance state.`);
      setShowOverrideModal(false);
      fetchJunctionData();
    } catch (err) {
      console.error('Error applying manual control:', err);
    }
  };

  const handleReturnToAuto = async () => {
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/return-to-auto`);
      setOverrideMessage(`Junction #${selectedJunctionId} reverted to Automatic Multi-Approach Adaptive Optimization.`);
      fetchJunctionData();
    } catch (err) {
      console.error('Error returning to auto:', err);
    }
  };

  // Section 21 & Section 2: Derive approach data
  const approachKeys = signalData?.approaches ? Object.keys(signalData.approaches) : [];
  const approachesList: ApproachData[] = approachKeys.map((key) => {
    const sigInfo = signalData?.approaches?.[key] || {};
    const trafInfo = trafficData?.approaches?.[key] || {};
    const score = optimizationData?.priority_scores?.[key] ?? sigInfo.priority_score ?? 0;
    const demand = optimizationData?.demand_scores?.[key] ?? trafInfo.demand_score ?? 0;

    return {
      key,
      name: sigInfo.name || trafInfo.name || `${key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()} Approach`,
      direction: trafInfo.direction || sigInfo.direction || key,
      camera_id: trafInfo.camera_id || sigInfo.camera_id,
      camera_status: sigInfo.camera_status || trafInfo.camera_status || 'DATA_AVAILABLE',
      vehicle_count: trafInfo.vehicle_count ?? sigInfo.vehicle_count ?? 0,
      queue_length: trafInfo.queue_length ?? sigInfo.queue_length ?? 0,
      waiting_time: trafInfo.waiting_time ?? sigInfo.waiting_time ?? 0,
      traffic_density: trafInfo.traffic_density || sigInfo.traffic_density || 'MODERATE',
      demand_score: demand,
      priority_score: score,
      green_duration: trafInfo.green_duration || sigInfo.green_duration || 30,
      emergency_detected: trafInfo.emergency_detected,
      emergency_type: trafInfo.emergency_type,
      signal: sigInfo.signal || 'RED',
      is_queue_available: trafInfo.is_queue_available ?? true
    };
  });

  // Current active approach data for Section 20 Automatic Mode display
  const activeApproachKey = signalData?.active_approach || signalData?.active_phase || (approachesList[0]?.key ?? 'NORTH');
  const activeApproachData = approachesList.find((a) => a.key === activeApproachKey) || approachesList[0];

  // Map cameras to be displayed according to operator selection
  const displayedCameras = useMemo(() => {
    return junctionCameras.filter((c) => selectedCameraIds.includes(c.camera_id));
  }, [junctionCameras, selectedCameraIds]);

  // Section: Smooth local 1-second countdown decrement between backend polls
  useEffect(() => {
    const timer = setInterval(() => {
      setSignalData((prev: any) => {
        if (!prev || typeof prev.countdown !== 'number') return prev;
        if (prev.countdown <= 1) return { ...prev, countdown: 0 };
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Section: Synchronize live video footage playback and physical speed with running signal counter
  useEffect(() => {
    displayedCameras.forEach((cam) => {
      const el = videoRefs.current.get(cam.camera_id);
      if (!el) return;
      const dirKey = cam.direction.toUpperCase();
      const isCurrentActive =
        signalData?.active_approach === dirKey || signalData?.active_phase === dirKey;
      const currentSignal = isCurrentActive ? (signalData?.state || 'GREEN') : 'RED';

      if (!isDemoPlaying) {
        el.pause();
        return;
      }

      if (currentSignal === 'GREEN') {
        // Full normal flow speed
        el.playbackRate = 1.0;
        el.play().catch(() => {});
      } else if (currentSignal === 'YELLOW') {
        // Decelerating clearance flow speed
        el.playbackRate = 0.35;
        el.play().catch(() => {});
      } else {
        // RED: Halted flow at stop line (0 km/h)
        el.pause();
      }
    });
  }, [
    signalData?.state,
    signalData?.active_approach,
    signalData?.active_phase,
    signalData?.countdown,
    isDemoPlaying,
    displayedCameras
  ]);

  // Quick Action: Simulate 1 vehicle passing 20m radius on specified approach
  const handlePassVehicle = async (approachKey: string) => {
    try {
      const res = await apiClient.post(`/intersections/${selectedJunctionId}/vehicle-pass`, {
        approach: approachKey
      });
      const remaining = res.data?.vehicles_remaining ?? 0;
      setVehiclePassNotice({
        approach: approachKey,
        text: `⚡ Vehicle passed 20m radius (${remaining} veh remaining)`
      });
      setTimeout(() => setVehiclePassNotice(null), 2500);
      fetchJunctionData();
    } catch (err) {
      console.error('Error passing vehicle:', err);
    }
  };

  // Quick Action: Clear all vehicles on specified approach (triggers instant auto-switch)
  const handleClearApproach = async (approachKey: string) => {
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/clear-approach`, {
        approach: approachKey
      });
      setVehiclePassNotice({
        approach: approachKey,
        text: `⚡ Approach cleared (0 veh)! Switching to next phase...`
      });
      setTimeout(() => setVehiclePassNotice(null), 2500);
      fetchJunctionData();
    } catch (err) {
      console.error('Error clearing approach:', err);
    }
  };

  // Quick Action: Force green signal priority for an approach
  const handleForceGreen = async (approachKey: string) => {
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/manual-override`, {
        phase: approachKey,
        reason: `Manual priority requested for ${approachKey} approach via camera feed`
      });
      setOverrideMessage(`Signal forced GREEN for ${approachKey} approach.`);
      fetchJunctionData();
    } catch (err) {
      console.error('Error forcing green:', err);
    }
  };

  // Demo playback controls (Section 12)
  const handleResetDemo = () => {
    handleReturnToAuto();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#F6F8FA] min-h-screen select-none">
      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#DCE4EA] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase font-mono">
              DYNAMIC SIGNAL CONTROL ROOM & SIMULATION
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Production Adaptive Engine supporting 2-Side, 3-Side, 4-Side & Configurable N-Way Junctions with Live Video Ingestion
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex-1 md:flex-initial px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <History className="w-4 h-4" /> DECISION AUDIT
          </button>
          <button
            onClick={() => {
              if (approachesList.length > 0) setManualApproach(approachesList[0].key);
              setShowOverrideModal(true);
            }}
            className="flex-1 md:flex-initial px-3 py-2 bg-[#B7791F] hover:bg-[#9B6416] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <ShieldAlert className="w-4 h-4" /> MANUAL OVERRIDE
          </button>
          <button
            onClick={handleReturnToAuto}
            className="flex-1 md:flex-initial px-3 py-2 bg-[#2E7D5B] hover:bg-[#236347] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <RotateCcw className="w-4 h-4" /> RETURN TO AUTO
          </button>
        </div>
      </div>

      {/* Section 25: Test Junctions Switcher Bar */}
      {testJunctions.length > 0 && (
        <div className="bg-emerald-50/80 border border-emerald-300 p-3.5 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-mono font-extrabold rounded uppercase">
              DEMO LAB JUNCTIONS
            </span>
            <span className="text-xs font-mono font-bold text-emerald-950">
              Judge Demonstration Scenarios (Pre-configured with Multi-Camera Test Streams):
            </span>
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {testJunctions.map((tj) => (
              <button
                key={tj.id}
                onClick={() => handleSelectJunction(tj.id)}
                className={`px-3.5 py-2 rounded text-xs font-mono font-bold border transition-all flex items-center gap-2 ${
                  selectedJunctionId === tj.id
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}
              >
                <span>{tj.name}</span>
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-emerald-200/90 text-emerald-900">
                  {tj.num_approaches}-WAY
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section 3 & 12: DEMO MODE CONTROLS & CAMERA DISPLAY SELECTION */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#245B84]" />
            <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase tracking-wide">
              SECTION 3 & 12 – CAMERA DISPLAY SELECTION & DEMO CONTROLS
            </h2>
          </div>

          {/* Demo Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsDemoPlaying((prev) => !prev)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
                isDemoPlaying
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
              }`}
            >
              {isDemoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isDemoPlaying ? 'PAUSE DEMO' : 'START DEMO'}</span>
            </button>

            <button
              onClick={handleResetDemo}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-[#DCE4EA] rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> RESET DEMO
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

            <button
              onClick={() => setIsAutoOptimizing((prev) => !prev)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                isAutoOptimizing
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              AUTO OPTIMIZE: {isAutoOptimizing ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Dynamic Display Selector Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 font-mono text-xs">
          {/* 1. Junction Selector (4 cols) */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">1. SELECT JUNCTION</label>
            <select
              value={selectedJunctionId}
              onChange={(e) => handleSelectJunction(Number(e.target.value))}
              className="w-full bg-slate-50 border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#245B84]"
            >
              {intersections.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} ({j.num_approaches || 4} Approaches)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Number of Cameras Selection (3 cols) */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">
              2. NUMBER OF CAMERAS TO DISPLAY
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumCamerasChange(num)}
                  className={`py-2 rounded border font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                    numCamerasToDisplay === num
                      ? 'bg-[#245B84] text-white border-[#245B84] shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#DCE4EA]'
                  }`}
                >
                  <span>{num} CAMS</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Camera Selection Checkboxes (5 cols) */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase block">
              3. SELECT ACTUAL CAMERAS ({selectedCameraIds.length} ACTIVE)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {junctionCameras.map((cam) => {
                const isSelected = selectedCameraIds.includes(cam.camera_id);
                return (
                  <button
                    key={cam.camera_id}
                    onClick={() => toggleCameraSelection(cam.camera_id)}
                    className={`px-2.5 py-1.5 rounded text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-400 shadow-2xs'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-600' : 'bg-slate-300'}`}
                    />
                    <span>{cam.direction}</span>
                    <span className="text-[9px] text-slate-400">({cam.camera_name.split(' ')[0]})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {overrideMessage && (
        <div className="p-3 bg-[#EEF6FC] border border-[#DCE4EA] text-[#245B84] text-xs font-mono font-bold rounded flex items-center justify-between">
          <span>{overrideMessage}</span>
          <button onClick={() => setOverrideMessage('')} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* SECTION 20 & 7: ACTIVE ADAPTIVE OPTIMIZER INTELLIGENCE CARD */}
      <div className="bg-white rounded-lg border border-[#DCE4EA] shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#245B84]" />
            <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase">
              REAL-TIME ADAPTIVE OPTIMIZER TELEMETRY
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded font-mono font-bold text-xs">
              JUNCTION #{selectedJunctionId} ({approachesList.length}-APPROACH DYNAMIC)
            </span>
          </div>
        </div>

        {/* Real-time telemetry row matching prompt Section 20 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase block">MODE</span>
            <span className="text-sm font-extrabold font-mono text-slate-800">{signalData?.mode || 'AUTOMATIC'}</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
            <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase block">CURRENT APPROACH</span>
            <span className="text-sm font-extrabold font-mono text-emerald-800 uppercase truncate block">
              {activeApproachData?.name || activeApproachKey}
            </span>
          </div>

          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase block">QUEUE</span>
            <span className="text-sm font-extrabold font-mono text-[#245B84]">
              {activeApproachData?.queue_length ?? 0} veh
            </span>
          </div>

          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase block">VEHICLES</span>
            <span className="text-sm font-extrabold font-mono text-slate-800">
              {activeApproachData?.vehicle_count ?? 0}
            </span>
          </div>

          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase block">WAITING</span>
            <span className="text-sm font-extrabold font-mono text-slate-800">
              {activeApproachData?.waiting_time ?? 0} sec
            </span>
          </div>

          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase block">DENSITY</span>
            <span className="text-sm font-extrabold font-mono text-slate-800">
              {activeApproachData?.traffic_density ?? 'MODERATE'}
            </span>
          </div>

          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase block">PRIORITY SCORE</span>
            <span className="text-sm font-extrabold font-mono text-[#245B84]">
              {activeApproachData?.priority_score ?? 0} pts
            </span>
          </div>

          <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
            <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase block">GREEN TIME</span>
            <span className="text-sm font-extrabold font-mono text-emerald-800">
              {signalData?.countdown}s ({activeApproachData?.green_duration ?? 30}s max)
            </span>
          </div>
        </div>

        {/* Explainable Decision Reasoning & Next Step (Section 13 & 20) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 p-3 bg-slate-50 rounded border border-slate-200 text-xs font-mono space-y-1">
            <span className="font-bold text-[#245B84] uppercase">DECISION REASON:</span>
            <p className="text-slate-700 leading-relaxed font-semibold">
              {signalData?.reasoning || optimizationData?.explanation || 'Optimal multi-approach balance evaluated based on queue length and accumulated wait.'}
            </p>
          </div>
          <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs font-mono space-y-1">
            <span className="font-bold text-amber-800 uppercase">NEXT REASSESSMENT:</span>
            <p className="text-amber-900 leading-relaxed">
              Dynamic recalculation triggers upon phase expiry or early queue clearance (Anti-waste active).
            </p>
          </div>
        </div>
      </div>

      {/* SECTION: INTERACTIVE DETECTION RADIUS (20m) & ZERO-WASTE AUTO-SWITCH RADAR */}
      <IntersectionRadiusRadar
        junctionId={selectedJunctionId}
        junctionName={activeJunction?.name || `Junction #${selectedJunctionId}`}
        activeApproach={activeApproachKey}
        activeSignal={signalData?.state || 'GREEN'}
        countdown={signalData?.countdown || 30}
        approaches={approachesList.map((a) => ({
          key: a.key,
          name: a.name,
          direction: a.direction,
          vehicle_count: a.vehicle_count,
          queue_length: a.queue_length,
          signal: a.signal,
          priority_score: a.priority_score
        }))}
        onRefresh={fetchJunctionData}
      />

      {/* SECTION 1, 3, 8 & 13: DYNAMIC VIDEO PANELS WITH MOVEMENT VS STOPPING SIMULATION LAYER */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Monitor className="w-4 h-4 text-[#245B84]" />
            LIVE SIMULATED TRAFFIC CAMERA FEEDS ({displayedCameras.length} PANELS ACTIVE)
          </h2>
          <span className="text-[10px] font-mono text-slate-500">
            Normalized Formula: Queue 45% + Vehicles 25% + Wait 20% + Density 10%
          </span>
        </div>

        {/* Dynamic Panel Grid: Automatically resizes based on displayed camera count */}
        <div
          className={`grid gap-4 ${
            displayedCameras.length === 1
              ? 'grid-cols-1 max-w-3xl mx-auto'
              : displayedCameras.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : displayedCameras.length === 3
              ? 'grid-cols-1 md:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {displayedCameras.map((cam) => {
            const dirKey = cam.direction.toUpperCase();
            const appData = approachesList.find((a) => a.key === dirKey || a.direction === dirKey) || {
              key: dirKey,
              name: `${dirKey.charAt(0) + dirKey.slice(1).toLowerCase()} Approach`,
              direction: dirKey,
              signal: signalData?.active_approach === dirKey ? signalData?.state : 'RED',
              vehicle_count: 14,
              queue_length: 5,
              waiting_time: 15,
              traffic_density: 'MODERATE',
              priority_score: 25.0
            };

            const isGreen = appData.signal === 'GREEN';
            const isYellow = appData.signal === 'YELLOW';
            const isRed = appData.signal === 'RED' || !appData.signal;

            return (
              <div
                key={cam.camera_id}
                className={`bg-white rounded-xl border shadow-xs overflow-hidden flex flex-col justify-between transition-all ${
                  isGreen
                    ? 'border-emerald-500 ring-2 ring-emerald-500/25'
                    : isYellow
                    ? 'border-amber-400 ring-2 ring-amber-400/25'
                    : 'border-[#DCE4EA]'
                }`}
              >
                {/* Panel Header */}
                <div className="p-3 bg-[#EEF4F8] border-b border-[#DCE4EA] flex items-center justify-between">
                  <div>
                    <h3 className="font-mono font-bold text-xs text-slate-800">{cam.camera_name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-[#245B84] font-bold">
                        APPROACH: {dirKey}
                      </span>
                      <span className="px-1.5 py-0.2 text-[8px] font-mono font-extrabold rounded bg-slate-200 text-slate-700 uppercase">
                        SIMULATED CAMERA
                      </span>
                    </div>
                  </div>

                  {/* Signal Badge */}
                  <span
                    className={`px-2.5 py-1 text-[10px] font-mono font-extrabold rounded flex items-center gap-1 border ${
                      isGreen
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : isYellow
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-red-600 text-white border-red-700'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isGreen ? 'bg-white animate-pulse' : isYellow ? 'bg-slate-900' : 'bg-white/80'
                      }`}
                    />
                    <span>{appData.signal || 'RED'}</span>
                  </span>
                </div>

                {/* Video Feed with Signal Physics & Running Counter Interaction */}
                <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden group">
                  <video
                    src={resolveVideoUrl(cam.video_source)}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover transition-opacity duration-300"
                    ref={(el) => {
                      if (el) {
                        videoRefs.current.set(cam.camera_id, el);
                        if (!isDemoPlaying) {
                          el.pause();
                        } else if (isGreen) {
                          el.playbackRate = 1.0;
                          el.play().catch(() => {});
                        } else if (isYellow) {
                          el.playbackRate = 0.35;
                          el.play().catch(() => {});
                        } else {
                          el.pause();
                        }
                      } else {
                        videoRefs.current.delete(cam.camera_id);
                      }
                    }}
                  />

                  {/* VISUAL STOP LINE / FLOW CORRIDOR BARRIER OVERLAY (Interacting with signal & counter) */}
                  {isRed && (
                    <div className="absolute inset-x-0 bottom-10 z-10 pointer-events-none flex flex-col items-center">
                      <div className="w-full py-1 bg-red-600/85 backdrop-blur-xs border-y border-red-400 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse">
                        <span className="text-[10px] font-mono font-black text-white tracking-wider flex items-center gap-1.5">
                          🛑 STOP LINE ENFORCEMENT [HALTED 0 KM/H] • QUEUE: {appData.queue_length} VEH
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
                    </div>
                  )}

                  {isYellow && (
                    <div className="absolute inset-x-0 bottom-10 z-10 pointer-events-none flex flex-col items-center">
                      <div className="w-full py-1 bg-amber-500/85 backdrop-blur-xs border-y border-amber-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.7)] animate-pulse">
                        <span className="text-[10px] font-mono font-black text-slate-950 tracking-wider flex items-center gap-1.5">
                          ⚠️ CLEARANCE INTERVAL [DECELERATING 14 KM/H] • PREPARE TO STOP
                        </span>
                      </div>
                    </div>
                  )}

                  {isGreen && (
                    <div className="absolute inset-x-0 bottom-10 z-10 pointer-events-none flex flex-col items-center">
                      <div className="w-full py-0.5 bg-emerald-600/75 backdrop-blur-xs border-y border-emerald-400 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                        <span className="text-[9px] font-mono font-black text-emerald-100 tracking-wider flex items-center gap-1">
                          🟢 FLOW CORRIDOR ACTIVE [48 KM/H] • 20m DETECTION RADAR ARMED
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Vehicle Passed Radius Floating Notification Badge */}
                  {vehiclePassNotice && vehiclePassNotice.approach === dirKey && (
                    <div className="absolute top-11 inset-x-4 z-20 pointer-events-none flex justify-center animate-bounce">
                      <span className="px-3 py-1.5 bg-emerald-500 text-slate-950 font-mono font-black text-xs rounded-full shadow-lg border border-emerald-300 flex items-center gap-1.5">
                        {vehiclePassNotice.text}
                      </span>
                    </div>
                  )}

                  {/* TOP BAR: SIGNAL STATUS & RUNNING COUNTDOWN VISOR */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
                    <div
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-extrabold flex items-center gap-1.5 shadow-md backdrop-blur-sm border ${
                        isGreen
                          ? 'bg-emerald-950/85 text-emerald-300 border-emerald-400'
                          : isYellow
                          ? 'bg-amber-950/85 text-amber-300 border-amber-400'
                          : 'bg-red-950/85 text-red-300 border-red-500'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isGreen ? 'bg-emerald-400 animate-ping' : isYellow ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
                        }`}
                      />
                      <span>
                        {isGreen
                          ? 'FLOW: 48 KM/H (ACTIVE)'
                          : isYellow
                          ? 'FLOW: 14 KM/H (DECEL)'
                          : 'FLOW: 0 KM/H (STOPPED)'}
                      </span>
                    </div>

                    {/* LIVE RUNNING SIGNAL COUNTDOWN BADGE */}
                    <div
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-extrabold flex items-center gap-1 shadow-md backdrop-blur-sm border ${
                        isGreen
                          ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400/50'
                          : isYellow
                          ? 'bg-amber-950/90 border-amber-400 text-amber-300 ring-1 ring-amber-400/50'
                          : 'bg-red-950/90 border-red-500 text-red-300'
                      }`}
                    >
                      <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '6s' }} />
                      <span>
                        {isGreen
                          ? `⏱ ${signalData?.countdown ?? 25}s REMAINING`
                          : isYellow
                          ? `⏱ ${signalData?.countdown ?? 3}s CLEARANCE`
                          : `⏱ WAIT ${appData.waiting_time || signalData?.countdown || 15}s`}
                      </span>
                    </div>
                  </div>

                  {/* QUICK INTERACTIVE ACTION CONTROLS (Interact with footage & running signal) */}
                  <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    {/* Compliance tag on left */}
                    <div className="px-2 py-1 rounded bg-slate-900/90 backdrop-blur-xs border border-slate-700 text-[9px] font-mono text-white flex items-center gap-1.5 shadow-sm">
                      <span className="font-extrabold text-amber-300">
                        {cam.camera_id % 2 === 0 ? 'TN09AB1002' : 'TN01AX1001'}
                      </span>
                      <span className="text-slate-400">| 98%</span>
                      <span className={`px-1 rounded text-[8px] font-bold ${
                        cam.camera_id % 2 === 0
                          ? 'bg-red-500/30 text-red-300 border border-red-500/40'
                          : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {cam.camera_id % 2 === 0 ? 'INSURANCE DUE' : 'CLEARED'}
                      </span>
                    </div>

                    {/* Interactive Action Buttons */}
                    <div className="flex items-center gap-1 pointer-events-auto">
                      {isGreen ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePassVehicle(dirKey);
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[9px] font-bold rounded shadow-md border border-emerald-400 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            title="Simulate 1 vehicle crossing 20m radius and passing the stop line"
                          >
                            <Zap className="w-2.5 h-2.5 text-yellow-300" />
                            <span>PASS VEHICLE (-1)</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearApproach(dirKey);
                            }}
                            className="px-2 py-1 bg-teal-700 hover:bg-teal-600 text-white font-mono text-[9px] font-bold rounded shadow-md border border-teal-400 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            title="Clear all vehicles on this approach: triggers zero-waste auto-switch immediately"
                          >
                            <span>CLEAR (0)</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleForceGreen(dirKey);
                          }}
                          className="px-2 py-1 bg-slate-800/90 hover:bg-emerald-600 text-slate-200 hover:text-white font-mono text-[9px] font-bold rounded shadow-md border border-slate-600 hover:border-emerald-400 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          title="Force signal GREEN for this approach: video will begin moving and countdown starts"
                        >
                          <Play className="w-2.5 h-2.5 text-emerald-400" />
                          <span>FORCE GREEN</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Corner Watermark */}
                  <div className="hidden sm:block absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 text-white/80 font-mono text-[8px] rounded pointer-events-none">
                    VIGITRA AI CV
                  </div>
                </div>

                {/* Approach Telemetry Grid */}
                <div className="p-3.5 space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-[#DCE4EA]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[10px]">Vehicles:</span>
                      <span className="font-bold text-slate-800">{appData.vehicle_count}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[10px]">Queue Length:</span>
                      <span className="font-extrabold text-[#245B84]">{appData.queue_length} veh</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[10px]">Wait Delay:</span>
                      <span className="font-bold text-slate-800">{appData.waiting_time}s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[10px]">Density:</span>
                      <span className="font-bold text-slate-700">{appData.traffic_density}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                    <span className="text-slate-500 font-bold">Priority Score:</span>
                    <span className="font-extrabold text-[#245B84] bg-slate-100 px-2 py-0.5 rounded">
                      {appData.priority_score || 0} pts
                    </span>
                  </div>

                  {/* Starvation Warning Badge */}
                  {appData.waiting_time > 60 && isRed && (
                    <div className="p-1.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-mono text-amber-800 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Anti-Starvation Escalating (Wait {appData.waiting_time}s)</span>
                    </div>
                  )}

                  {/* Force Controls */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        setManualApproach(dirKey);
                        setShowOverrideModal(true);
                      }}
                      className="py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] font-mono transition-colors shadow-2xs"
                    >
                      🟢 FORCE GREEN
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await apiClient.post(`/intersections/${selectedJunctionId}/manual-override`, {
                            phase: dirKey,
                            reason: 'Manual Red Signal Stop'
                          });
                          fetchJunctionData();
                        } catch (err) {}
                      }}
                      className="py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] font-mono transition-colors shadow-2xs"
                    >
                      🔴 FORCE RED
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Override Confirmation Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DCE4EA] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-slate-800 border-b pb-3">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold font-mono text-sm uppercase">Manual Approach Signal Control</h3>
            </div>

            <p className="text-xs text-slate-600 font-mono">
              Select approach to force GREEN. Safety interlocks will transition active approach safely through YELLOW and clearance states before granting GREEN.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Target Approach
                </label>
                <select
                  value={manualApproach}
                  onChange={(e) => setManualApproach(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800 focus:outline-none"
                >
                  {approachesList.map((app) => (
                    <option key={app.key} value={app.key}>
                      {app.name} ({app.direction})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Justification Reason
                </label>
                <input
                  type="text"
                  required
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800 focus:outline-none"
                  placeholder="e.g. Heavy queue clearance / Field dispatch"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE4EA]">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyManualOverride}
                className="px-4 py-1.5 bg-[#B7791F] hover:bg-[#9B6416] text-white text-xs font-mono font-bold rounded shadow-xs"
              >
                Confirm & Apply Safe Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Audit History Modal (Section 17 & 31) */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DCE4EA] max-w-4xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-slate-800">
                <History className="w-5 h-5 text-[#245B84]" />
                <h3 className="font-bold font-mono text-sm uppercase">
                  Signal Decision Audit Log (Junction #{selectedJunctionId})
                </h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-700 font-mono">
                ✕
              </button>
            </div>

            {decisionHistory.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-6 text-center">
                No signal decision history recorded for Junction #{selectedJunctionId} yet. Decisions are stored automatically after each phase cycle.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-extrabold">
                    <tr>
                      <th className="p-2 border-b">Time</th>
                      <th className="p-2 border-b">Approach</th>
                      <th className="p-2 border-b">Queue</th>
                      <th className="p-2 border-b">Vehicles</th>
                      <th className="p-2 border-b">Wait Time</th>
                      <th className="p-2 border-b">Priority</th>
                      <th className="p-2 border-b">Green Time</th>
                      <th className="p-2 border-b">Mode</th>
                      <th className="p-2 border-b">Reasoning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {decisionHistory.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-2 text-[10px] text-slate-500 whitespace-nowrap">
                          {new Date(d.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-2 font-bold text-emerald-700">{d.approach_id}</td>
                        <td className="p-2">{d.queue_length}</td>
                        <td className="p-2">{d.vehicle_count}</td>
                        <td className="p-2">{d.waiting_time}s</td>
                        <td className="p-2 font-bold text-[#245B84]">{d.priority_score} pts</td>
                        <td className="p-2 font-bold">{d.green_duration}s</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 text-[8px] rounded font-bold ${
                              d.mode === 'AUTOMATIC' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.mode}
                          </span>
                        </td>
                        <td className="p-2 text-[10px] text-slate-600 max-w-xs truncate" title={d.decision_reason}>
                          {d.decision_reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-mono text-xs font-bold"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
