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
  Zap,
  Footprints,
  Timer,
  AlertOctagon,
  ShieldCheck
} from 'lucide-react';
import { apiClient, resolveVideoUrl } from '../api/client';
import { Intersection } from '../types';
import { useStore } from '../store/useStore';
import { FALLBACK_INTERSECTIONS, FALLBACK_SIGNAL_DATA } from '../api/mockFallback';
import { IntersectionRadiusRadar } from '../components/IntersectionRadiusRadar';
import { PageHeader } from '../components/PageHeader';

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

const APPROACH_ANPR_DATA: Record<string, { plate: string; ocr: string; status: string; statusClass: string; reason: string }> = {
  NORTH: { plate: 'TN01AX1001', ocr: '99.4%', status: 'CLEARED', statusClass: 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40', reason: 'Verified Active' },
  SOUTH: { plate: 'TN09AB1002', ocr: '98.8%', status: 'INSURANCE DUE', statusClass: 'bg-amber-500/30 text-amber-300 border-amber-500/40', reason: 'Insurance Expired' },
  EAST: { plate: 'KA01AM1080', ocr: '99.7%', status: '108 AMBULANCE', statusClass: 'bg-blue-500/30 text-blue-300 border-blue-500/40', reason: 'Emergency Priority' },
  WEST: { plate: 'TN22BZ4455', ocr: '98.2%', status: 'PUC EXPIRED', statusClass: 'bg-orange-500/30 text-orange-300 border-orange-500/40', reason: 'PUC Expired' }
};

export const Signals: React.FC = () => {
  const { activeLiveUpdate } = useStore();
  const [intersections, setIntersections] = useState<Intersection[]>(FALLBACK_INTERSECTIONS);
  const [selectedJunctionId, setSelectedJunctionId] = useState<number>(13); // Default to TEST-JUNCTION-2 for instant demo
  const [signalData, setSignalData] = useState<any>(FALLBACK_SIGNAL_DATA);
  const [trafficData, setTrafficData] = useState<any>(null);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [decisionHistory, setDecisionHistory] = useState<DecisionRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Pedestrian Safety Phase State (Sections 1-13)
  const [pedestrianTelemetry, setPedestrianTelemetry] = useState<any>(null);
  const [showPedestrianConfigModal, setShowPedestrianConfigModal] = useState<boolean>(false);
  const [showEmergencyOverrideModal, setShowEmergencyOverrideModal] = useState<boolean>(false);
  const [showPedestrianEventsModal, setShowPedestrianEventsModal] = useState<boolean>(false);
  const [pedestrianEvents, setPedestrianEvents] = useState<any[]>([]);
  const [emergencyReason, setEmergencyReason] = useState<string>('Emergency 108 Ambulance priority clearance');
  const [emergencyTargetApproach, setEmergencyTargetApproach] = useState<string>('');
  const [emergencyConfirmed, setEmergencyConfirmed] = useState<boolean>(false);

  // Pedestrian Configuration Form State
  const [pedConfigEnabled, setPedConfigEnabled] = useState<boolean>(true);
  const [pedConfigInterval, setPedConfigInterval] = useState<number>(600);
  const [pedConfigDuration, setPedConfigDuration] = useState<number>(30);
  const [pedConfigDemoMode, setPedConfigDemoMode] = useState<boolean>(false);

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
      const [sigRes, trafRes, optRes, histRes, pedRes] = await Promise.all([
        apiClient.get(`/intersections/${selectedJunctionId}/signal`),
        apiClient.get(`/intersections/${selectedJunctionId}/traffic`),
        apiClient.get(`/intersections/${selectedJunctionId}/optimization`),
        apiClient.get(`/intersections/${selectedJunctionId}/decision-history?limit=15`).catch(() => ({ data: [] })),
        apiClient.get(`/intersections/${selectedJunctionId}/pedestrian/status`).catch(() => null)
      ]);
      setSignalData(sigRes.data);
      setTrafficData(trafRes.data);
      setOptimizationData(optRes.data);
      if (pedRes?.data) {
        setPedestrianTelemetry(pedRes.data);
        setPedConfigEnabled(pedRes.data.pedestrian_phase_enabled ?? pedRes.data.pedestrianPhaseEnabled ?? true);
        setPedConfigInterval(pedRes.data.pedestrian_interval_seconds ?? pedRes.data.pedestrianIntervalSeconds ?? 600);
        setPedConfigDuration(pedRes.data.pedestrian_phase_duration ?? pedRes.data.pedestrianPhaseDuration ?? 30);
        setPedConfigDemoMode(pedRes.data.is_demo_mode ?? pedRes.data.isDemoMode ?? false);
      } else if (sigRes.data?.pedestrian_crossing) {
        setPedestrianTelemetry(sigRes.data.pedestrian_crossing);
      }
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
      if (activeLiveUpdate.pedestrian_crossing) {
        setPedestrianTelemetry(activeLiveUpdate.pedestrian_crossing);
        if (activeLiveUpdate.pedestrian_crossing.isDemoMode !== undefined) {
          setPedConfigDemoMode(activeLiveUpdate.pedestrian_crossing.isDemoMode);
        }
      }
      setSignalData((prev: any) => ({
        ...prev,
        active_approach: activeLiveUpdate.active_approach ?? prev?.active_approach,
        active_phase: activeLiveUpdate.active_phase ?? prev?.active_phase,
        state: activeLiveUpdate.state ?? prev?.state,
        countdown: activeLiveUpdate.countdown ?? prev?.countdown,
        mode: activeLiveUpdate.mode ?? prev?.mode,
        reasoning: activeLiveUpdate.reasoning ?? prev?.reasoning,
        elapsed_green_time: activeLiveUpdate.elapsed_green_time ?? prev?.elapsed_green_time,
        current_metrics: activeLiveUpdate.current_metrics ?? prev?.current_metrics,
        approaches: activeLiveUpdate.approaches ?? prev?.approaches,
        pedestrian_crossing: activeLiveUpdate.pedestrian_crossing ?? prev?.pedestrian_crossing
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
      signal: (pedestrianTelemetry?.isActive || pedestrianTelemetry?.is_active) ? 'RED' : (sigInfo.signal || 'RED'),
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
    if (pedestrianTelemetry?.isActive || pedestrianTelemetry?.is_active) {
      setOverrideMessage('⚠️ ACTION BLOCKED: Protected Pedestrian Crossing is ACTIVE. Vehicle green signals are strictly prohibited.');
      return;
    }
    // Optimistic UI update so user sees instant signal change execution
    setSignalData((prev: any) => ({
      ...prev,
      active_approach: approachKey,
      active_phase: approachKey,
      state: 'GREEN',
      countdown: 30,
      mode: 'MANUAL',
      reasoning: `Manual Override: Forced GREEN to ${approachKey} Approach.`,
      approaches: {
        ...(prev?.approaches || {}),
        [approachKey]: {
          ...(prev?.approaches?.[approachKey] || {}),
          signal: 'GREEN'
        }
      }
    }));
    setOverrideMessage(`⚡ Signal forced GREEN for ${approachKey} approach (Executed).`);

    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/manual-override`, {
        phase: approachKey,
        color: 'GREEN',
        reason: `Manual priority requested for ${approachKey} approach`
      });
      fetchJunctionData();
    } catch (err) {
      console.error('Error forcing green:', err);
    }
  };

  // Quick Action: Force red signal for an approach
  const handleForceRed = async (approachKey: string) => {
    if (pedestrianTelemetry?.isActive || pedestrianTelemetry?.is_active) {
      setOverrideMessage('All vehicle approaches are already securely held at RED for pedestrian crossing.');
      return;
    }
    const otherApproaches = approachesList.filter((a) => a.key !== approachKey);
    const nextKey = otherApproaches.length > 0 ? otherApproaches[0].key : approachKey;

    // Optimistic UI state update: set approachKey to RED and nextKey to GREEN
    setSignalData((prev: any) => ({
      ...prev,
      active_approach: nextKey,
      active_phase: nextKey,
      state: 'GREEN',
      countdown: 30,
      mode: 'MANUAL',
      reasoning: `Manual Override: Forced RED on ${approachKey}. Flow transferred to ${nextKey} Approach.`,
      approaches: {
        ...(prev?.approaches || {}),
        [approachKey]: {
          ...(prev?.approaches?.[approachKey] || {}),
          signal: 'RED'
        },
        [nextKey]: {
          ...(prev?.approaches?.[nextKey] || {}),
          signal: 'GREEN'
        }
      }
    }));
    setOverrideMessage(`⚡ Signal forced RED for ${approachKey} approach (Flow transferred to ${nextKey}).`);

    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/manual-override`, {
        phase: approachKey,
        color: 'RED',
        reason: `Manual stop requested for ${approachKey} approach`
      });
      fetchJunctionData();
    } catch (err) {
      console.error('Error forcing red:', err);
    }
  };

  // Format seconds to MM:SS
  const formatTimerSeconds = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Pedestrian Phase Actions (Sections 1, 2, 6, 7, 9, 10, 13)
  const handleTriggerPedestrian = async () => {
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/pedestrian/trigger`, {
        trigger_type: 'MANUAL_DEMO'
      });
      setOverrideMessage('🚶 Protected Pedestrian Crossing Phase triggered! Safely clearing active approach to RED.');
      fetchJunctionData();
    } catch (err: any) {
      console.error('Error triggering pedestrian phase:', err);
      setOverrideMessage('Failed to trigger pedestrian phase: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleToggleDemoMode = async (enableDemo: boolean) => {
    try {
      const res = await apiClient.post(`/intersections/${selectedJunctionId}/pedestrian/configure`, {
        demo_mode: enableDemo,
        interval_seconds: enableDemo ? 10 : 600
      });
      setPedConfigDemoMode(enableDemo);
      if (res.data?.telemetry) {
        setPedestrianTelemetry(res.data.telemetry);
      }
      setOverrideMessage(
        enableDemo
          ? '⚡ DEMO/TEST MODE ACTIVE: Pedestrian interval shortened to 10 seconds for rapid judging evaluation.'
          : '🛡️ PRODUCTION MODE RESTORED: Standard 10-minute interval with 30-second crossing active.'
      );
      fetchJunctionData();
    } catch (err: any) {
      console.error('Error configuring demo mode:', err);
    }
  };

  const handleSavePedestrianConfig = async () => {
    try {
      const res = await apiClient.post(`/intersections/${selectedJunctionId}/pedestrian/configure`, {
        enabled: pedConfigEnabled,
        interval_seconds: Number(pedConfigInterval),
        duration_seconds: Number(pedConfigDuration),
        demo_mode: pedConfigDemoMode
      });
      if (res.data?.telemetry) {
        setPedestrianTelemetry(res.data.telemetry);
      }
      setShowPedestrianConfigModal(false);
      setOverrideMessage(`Pedestrian crossing configuration saved for Junction #${selectedJunctionId}.`);
      fetchJunctionData();
    } catch (err: any) {
      console.error('Error saving pedestrian config:', err);
    }
  };

  const handleEmergencyOverridePedestrian = async () => {
    if (!emergencyConfirmed) {
      alert('Please check the confirmation box to confirm emergency override of pedestrian safety.');
      return;
    }
    try {
      const res = await apiClient.post(`/intersections/${selectedJunctionId}/pedestrian/emergency-override`, {
        confirmed: true,
        reason: emergencyReason,
        target_approach: emergencyTargetApproach || activeApproachKey
      });
      setShowEmergencyOverrideModal(false);
      setEmergencyConfirmed(false);
      setOverrideMessage(
        `🚨 EMERGENCY OVERRIDE EXECUTED: Pedestrian phase terminated. Emergency corridor granted to ${res.data.active_approach} approach.`
      );
      fetchJunctionData();
    } catch (err: any) {
      console.error('Error executing emergency override:', err);
      alert(err.response?.data?.detail || 'Failed to execute emergency override.');
    }
  };

  const handleFetchPedestrianEvents = async () => {
    try {
      const res = await apiClient.get(`/intersections/${selectedJunctionId}/pedestrian/events?limit=25`);
      setPedestrianEvents(Array.isArray(res.data) ? res.data : []);
      setShowPedestrianEventsModal(true);
    } catch (err) {
      console.error('Error fetching pedestrian events:', err);
    }
  };

  // Demo playback controls (Section 12)
  const handleResetDemo = () => {
    handleReturnToAuto();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#F6F8FA] min-h-screen select-none">
      {/* Standardized Page Header */}
      <PageHeader
        title="Signal Control"
        subtitle="Adaptive junction phase management and safety controls"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            {intersections.find((i) => i.id === selectedJunctionId)?.name || 'Junction'} Active
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <History className="w-4 h-4" /> DECISION AUDIT
          </button>
          <button
            onClick={() => {
              if (approachesList.length > 0) setManualApproach(approachesList[0].key);
              setShowOverrideModal(true);
            }}
            className="px-3 py-2 bg-[#B7791F] hover:bg-[#9B6416] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <ShieldAlert className="w-4 h-4" /> MANUAL OVERRIDE
          </button>
          <button
            onClick={handleReturnToAuto}
            className="px-3 py-2 bg-[#2E7D5B] hover:bg-[#236347] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <RotateCcw className="w-4 h-4" /> RETURN TO AUTO
          </button>
        </div>
      </PageHeader>

      {/* Pre-configured Test Junctions Switcher Bar */}
      {testJunctions.length > 0 && (
        <div className="bg-emerald-50/80 border border-emerald-300 p-3.5 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-mono font-extrabold rounded uppercase">
              TEST JUNCTIONS
            </span>
            <span className="text-xs font-mono font-bold text-emerald-950">
              Multi-approach evaluation junctions with test streams:
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

      {/* Camera Display & Scenario Controls */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#245B84]" />
            <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase tracking-wide">
              CAMERA DISPLAY & SCENARIO CONTROLS
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

      {/* SECTION 1, 2, 3, 5, 9, 10 & 13: PEDESTRIAN CROSSING SAFETY PHASE STATUS CARD */}
      {(() => {
        const isPedActive = pedestrianTelemetry?.isActive || pedestrianTelemetry?.is_active || false;
        const pedState = pedestrianTelemetry?.pedestrianPhaseState || pedestrianTelemetry?.pedestrian_phase_state || 'NORMAL';
        const pedStatus = pedestrianTelemetry?.pedestrianPhaseStatus || pedestrianTelemetry?.pedestrian_phase_status || 'SCHEDULED';
        const remainingSec = pedestrianTelemetry?.remainingPedestrianSeconds ?? pedestrianTelemetry?.remaining_seconds ?? 0;
        const timeToNextSec = pedestrianTelemetry?.timeToNextSeconds ?? pedestrianTelemetry?.time_to_next_seconds ?? 600;
        const isDemo = pedestrianTelemetry?.isDemoMode ?? pedestrianTelemetry?.is_demo_mode ?? pedConfigDemoMode;
        const isEnabled = pedestrianTelemetry?.pedestrianPhaseEnabled ?? pedestrianTelemetry?.pedestrian_phase_enabled ?? true;

        return (
          <div
            className={`rounded-lg border p-4 sm:p-5 transition-all shadow-xs ${
              isPedActive
                ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/20 shadow-md'
                : pedState === 'TRANSITION' || pedState === 'ALL_RED'
                ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-400/20'
                : 'bg-white border-[#DCE4EA]'
            }`}
          >
            {/* Header row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-lg ${
                    isPedActive
                      ? 'bg-rose-600 text-white animate-bounce'
                      : 'bg-[#EEF6FC] text-[#245B84]'
                  }`}
                >
                  <Footprints className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-mono font-extrabold text-slate-800 uppercase tracking-tight">
                      PEDESTRIAN CROSSING SAFETY PHASE
                    </h2>
                    {isDemo && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-mono font-extrabold rounded uppercase tracking-wider animate-pulse">
                        DEMO / TEST MODE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Protected Pedestrian Window (10-min scheduled interval / 30s All-Red hold)
                  </p>
                </div>
              </div>

              {/* Status Badges & Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {/* Active Status Badge */}
                {isPedActive ? (
                  <span className="px-3 py-1 bg-rose-600 text-white rounded font-mono font-extrabold text-xs flex items-center gap-1.5 shadow-sm animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    PEDESTRIAN CROSSING ACTIVE
                  </span>
                ) : pedState === 'TRANSITION' || pedState === 'ALL_RED' ? (
                  <span className="px-3 py-1 bg-amber-500 text-white rounded font-mono font-bold text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    CLEARING VEHICLES (ALL-RED PENDING)
                  </span>
                ) : pedState === 'PEDESTRIAN_COMPLETE' || pedState === 'TRANSITION_BACK' ? (
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded font-mono font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    RETURNING TO ADAPTIVE CONTROL
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded font-mono font-bold text-xs flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-[#245B84]" />
                    STATUS: SCHEDULED
                  </span>
                )}

                {/* Demo Mode Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleDemoMode(!isDemo)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors ${
                    isDemo
                      ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                  title={isDemo ? 'Switch to Production 10-Minute interval' : 'Switch to Demo 10-Second interval'}
                >
                  {isDemo ? 'DEMO: 10s (ACTIVE)' : 'PROD: 10m'}
                </button>

                {/* Instant Trigger */}
                <button
                  type="button"
                  onClick={handleTriggerPedestrian}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-mono font-bold text-xs flex items-center gap-1 transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="Manually trigger pedestrian crossing phase now"
                >
                  <Footprints className="w-3.5 h-3.5" /> TRIGGER NOW
                </button>

                {/* Configure */}
                <button
                  type="button"
                  onClick={() => setShowPedestrianConfigModal(true)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-mono font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> CONFIG
                </button>

                {/* Audit Events */}
                <button
                  type="button"
                  onClick={handleFetchPedestrianEvents}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-mono font-bold text-xs flex items-center gap-1 transition-colors"
                >
                  <History className="w-3.5 h-3.5" /> EVENTS
                </button>

                {/* Emergency Override Button */}
                {isPedActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyConfirmed(false);
                      setEmergencyTargetApproach(activeApproachKey);
                      setShowEmergencyOverrideModal(true);
                    }}
                    className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white rounded font-mono font-bold text-xs flex items-center gap-1 shadow-md animate-pulse active:scale-95 cursor-pointer"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" /> EMERGENCY OVERRIDE
                  </button>
                )}
              </div>
            </div>

            {/* Active Pedestrian Phase Display (Section 9) */}
            {isPedActive ? (
              <div className="pt-4 space-y-3 font-mono">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Digital Countdown Box */}
                  <div className="md:col-span-4 bg-rose-600 text-white p-4 rounded-lg flex flex-col items-center justify-center shadow-inner text-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-rose-200">
                      CROSSING COUNTDOWN
                    </span>
                    <div className="text-4xl sm:text-5xl font-extrabold tracking-tighter my-0.5">
                      {remainingSec}
                      <span className="text-xs font-normal text-rose-200 ml-1">sec remaining</span>
                    </div>
                    {/* Linear Countdown Progress Bar */}
                    <div className="w-full bg-rose-800/80 rounded-full h-2 mt-1 overflow-hidden">
                      <div
                        className="bg-white h-2 rounded-full transition-all duration-1000 ease-linear"
                        style={{
                          width: `${Math.min(100, Math.max(0, (remainingSec / (pedestrianTelemetry?.pedestrianPhaseDuration || 30)) * 100))}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* All Vehicle Signals Status Banner */}
                  <div className="md:col-span-8 bg-white border border-rose-300 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                        <span className="text-xs font-extrabold text-rose-950 uppercase tracking-wide">
                          ALL VEHICLE SIGNALS: 🔴 RED
                        </span>
                      </div>
                      <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded">
                        PROTECTED CROSSWALK WINDOW
                      </span>
                    </div>

                    {/* Approaches Grid Showing All RED */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {approachesList.map((app) => (
                        <div
                          key={app.key}
                          className="p-2 bg-red-50 border border-red-200 rounded flex items-center justify-between"
                        >
                          <span className="text-[11px] font-bold text-slate-800">{app.direction}</span>
                          <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-extrabold rounded">
                            🔴 RED
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Adaptive Optimization: <strong className="text-rose-700">PAUSED</strong></span>
                      <span>Manual Green Changes: <strong className="text-rose-700">BLOCKED</strong></span>
                      <span>Next Phase: <strong className="text-emerald-700">ADAPTIVE AUTO</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Scheduled / Inactive Phase Display */
              <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">NEXT PEDESTRIAN CROSSING</span>
                  <div className="text-base font-extrabold text-[#245B84] mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#245B84]" />
                    <span>In {formatTimerSeconds(timeToNextSec)}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Authoritative Server Timer</span>
                </div>

                <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">INTERVAL SCHEDULE</span>
                  <div className="text-base font-extrabold text-slate-800 mt-0.5">
                    {isDemo ? '10 Seconds' : '10 Minutes (600s)'}
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    {isDemo ? 'Simulation Testing Mode' : 'Default Production Setting'}
                  </span>
                </div>

                <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">CROSSING DURATION</span>
                  <div className="text-base font-extrabold text-emerald-700 mt-0.5">
                    {pedestrianTelemetry?.pedestrianPhaseDuration ?? pedConfigDuration} Seconds
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">All-Red Protected Hold</span>
                </div>

                <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">SAFETY STATUS</span>
                  <div className="text-base font-extrabold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{isEnabled ? 'SYSTEM ARMED' : 'DISABLED'}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    Applies to all {approachesList.length} Approaches
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
        onApproachSwitch={(nextApproach: string, nextState: string = 'GREEN') => {
          setSignalData((prev: any) => ({
            ...prev,
            active_approach: nextApproach,
            active_phase: nextApproach,
            state: nextState,
            countdown: 30,
            mode: 'AUTOMATIC',
            reasoning: `Zero-waste automatic transmission: 0 vehicles in 20m radius. Switched to ${nextApproach} Approach.`,
            approaches: {
              ...(prev?.approaches || {}),
              [activeApproachKey]: {
                ...(prev?.approaches?.[activeApproachKey] || {}),
                signal: 'RED',
                vehicle_count: 0,
                queue_length: 0
              },
              [nextApproach]: {
                ...(prev?.approaches?.[nextApproach] || {}),
                signal: nextState
              }
            }
          }));
          setOverrideMessage(`⚡ Automatic transmission: Zero vehicles in radius — Switched green to ${nextApproach} approach.`);
        }}
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
                    {(() => {
                      const anpr = APPROACH_ANPR_DATA[dirKey] || {
                        plate: cam.camera_id % 2 === 0 ? 'TN09AB1002' : 'TN01AX1001',
                        ocr: '99.1%',
                        status: cam.camera_id % 2 === 0 ? 'INSURANCE DUE' : 'CLEARED',
                        statusClass: cam.camera_id % 2 === 0 ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      };
                      return (
                        <div className="px-2 py-1 rounded bg-slate-900/90 backdrop-blur-xs border border-slate-700 text-[9px] font-mono text-white flex items-center gap-1.5 shadow-sm">
                          <span className="font-extrabold text-amber-300">
                            {anpr.plate}
                          </span>
                          <span className="text-slate-400">| {anpr.ocr}</span>
                          <span className={`px-1 rounded text-[8px] font-bold ${anpr.statusClass}`}>
                            {anpr.status}
                          </span>
                        </div>
                      );
                    })()}

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
                      type="button"
                      onClick={() => handleForceGreen(dirKey)}
                      className="py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] font-mono transition-colors shadow-2xs active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                      title="Directly force signal GREEN for this approach (Executes immediately)"
                    >
                      <span>🟢 FORCE GREEN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleForceRed(dirKey)}
                      className="py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] font-mono transition-colors shadow-2xs active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                      title="Directly force signal RED for this approach (Switches flow to next approach)"
                    >
                      <span>🔴 FORCE RED</span>
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

      {/* Pedestrian Configuration Modal (Section 10 & 13) */}
      {showPedestrianConfigModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DCE4EA] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-slate-800">
                <Footprints className="w-5 h-5 text-[#245B84]" />
                <h3 className="font-bold font-mono text-sm uppercase">
                  Junction Pedestrian Safety Configuration
                </h3>
              </div>
              <button
                onClick={() => setShowPedestrianConfigModal(false)}
                className="text-slate-400 hover:text-slate-700 font-mono"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 font-mono">
              Centralized configuration per junction. Configured settings determine scheduled interval, protected crossing duration, and evaluation demo timers.
            </p>

            <div className="space-y-4 font-mono text-xs">
              {/* Enabled Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block">Pedestrian Phase Enabled</span>
                  <span className="text-[10px] text-slate-500">Automatically trigger protected crossing cycles</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPedConfigEnabled(!pedConfigEnabled)}
                  className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                    pedConfigEnabled
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {pedConfigEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Demo Mode Toggle */}
              <div className="flex items-center justify-between p-3 bg-amber-50/80 rounded border border-amber-200">
                <div>
                  <span className="font-bold text-amber-950 block">Demo / Judging Mode (10s Interval)</span>
                  <span className="text-[10px] text-amber-700">Shortens 10-minute timer to 10 seconds for rapid SIH demonstration</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !pedConfigDemoMode;
                    setPedConfigDemoMode(nextVal);
                    if (nextVal) setPedConfigInterval(10);
                    else setPedConfigInterval(600);
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                    pedConfigDemoMode
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {pedConfigDemoMode ? 'DEMO (10s)' : 'PROD (10m)'}
                </button>
              </div>

              {/* Interval & Duration Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Scheduled Interval (seconds)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="3600"
                    value={pedConfigInterval}
                    onChange={(e) => setPedConfigInterval(Number(e.target.value))}
                    className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Default: 600s (10 min)</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Crossing Duration (seconds)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={pedConfigDuration}
                    onChange={(e) => setPedConfigDuration(Number(e.target.value))}
                    className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Default: 30s All-Red hold</span>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-900 leading-relaxed">
                ℹ️ Applies dynamically to all {approachesList.length} configured approaches of Junction #{selectedJunctionId} without hardcoded directional limits.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE4EA]">
              <button
                type="button"
                onClick={() => setShowPedestrianConfigModal(false)}
                className="px-3 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePedestrianConfig}
                className="px-4 py-1.5 bg-[#245B84] hover:bg-[#1C4767] text-white text-xs font-mono font-bold rounded shadow-xs"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Override Modal (Section 7) */}
      {showEmergencyOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border-2 border-red-500 max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-red-600 border-b pb-3">
              <AlertOctagon className="w-6 h-6 animate-pulse shrink-0" />
              <div>
                <h3 className="font-extrabold font-mono text-sm uppercase text-slate-900">
                  CRITICAL EMERGENCY OVERRIDE OF PEDESTRIAN SAFETY
                </h3>
                <span className="text-[10px] text-red-600 font-mono font-bold block">
                  EXPLICIT OPERATOR CONFIRMATION & AUDIT LOG REQUIRED
                </span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs font-mono text-red-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>LIFE-SAFETY WARNING:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Pedestrian crossing is currently <strong>ACTIVE</strong>. Pedestrians may be physically inside the crosswalk. Overriding will force vehicle signals to <strong>GREEN</strong> immediately. Do NOT override unless there is an urgent emergency vehicle approaching!
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Target Approach for Emergency Green Corridor
                </label>
                <select
                  value={emergencyTargetApproach}
                  onChange={(e) => setEmergencyTargetApproach(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800"
                >
                  {approachesList.map((app) => (
                    <option key={app.key} value={app.key}>
                      {app.name} ({app.direction})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Emergency Justification (Recorded in Immutable Audit Log)
                </label>
                <input
                  type="text"
                  required
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800"
                  placeholder="e.g. 108 Ambulance en route to emergency ward"
                />
              </div>

              {/* Explicit Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-300 rounded cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emergencyConfirmed}
                  onChange={(e) => setEmergencyConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-800 font-bold leading-tight">
                  I explicitly confirm that I am overriding pedestrian safety for a verified emergency vehicle corridor.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE4EA]">
              <button
                type="button"
                onClick={() => {
                  setShowEmergencyOverrideModal(false);
                  setEmergencyConfirmed(false);
                }}
                className="px-3 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel & Maintain Pedestrian Safety
              </button>
              <button
                type="button"
                disabled={!emergencyConfirmed}
                onClick={handleEmergencyOverridePedestrian}
                className={`px-4 py-2 rounded text-xs font-mono font-bold transition-all shadow-md ${
                  emergencyConfirmed
                    ? 'bg-red-700 hover:bg-red-800 text-white cursor-pointer active:scale-95'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                CONFIRM EMERGENCY OVERRIDE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pedestrian Phase Audit Event Log Modal (Section 11) */}
      {showPedestrianEventsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DCE4EA] max-w-4xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-slate-800">
                <Footprints className="w-5 h-5 text-[#245B84]" />
                <h3 className="font-bold font-mono text-sm uppercase">
                  Pedestrian Phase Safety Audit Trail (MongoDB Atlas & SQL)
                </h3>
              </div>
              <button
                onClick={() => setShowPedestrianEventsModal(false)}
                className="text-slate-400 hover:text-slate-700 font-mono"
              >
                ✕
              </button>
            </div>

            {pedestrianEvents.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-6 text-center">
                No pedestrian safety phase events recorded for Junction #{selectedJunctionId} yet. Events are stored upon each phase completion or emergency override.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-extrabold">
                    <tr>
                      <th className="p-2 border-b">Time</th>
                      <th className="p-2 border-b">Event Type</th>
                      <th className="p-2 border-b">Status</th>
                      <th className="p-2 border-b">Duration</th>
                      <th className="p-2 border-b">Trigger</th>
                      <th className="p-2 border-b">Approaches Held</th>
                      <th className="p-2 border-b">Operator / Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pedestrianEvents.map((evt, idx) => (
                      <tr key={evt._id || idx} className="hover:bg-slate-50">
                        <td className="p-2 text-[10px] text-slate-500 whitespace-nowrap">
                          {new Date(evt.timestamp || evt.startedAt).toLocaleTimeString()}
                        </td>
                        <td className="p-2 font-bold text-[#245B84]">{evt.eventType}</td>
                        <td className="p-2">
                          <span
                            className={`px-1.5 py-0.5 text-[8px] rounded font-bold ${
                              evt.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : evt.status === 'ACTIVE'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {evt.status}
                          </span>
                        </td>
                        <td className="p-2 font-bold">{evt.duration}s</td>
                        <td className="p-2 text-slate-600">{evt.triggerType}</td>
                        <td className="p-2 text-slate-700">
                          {Array.isArray(evt.affectedApproaches)
                            ? evt.affectedApproaches.join(', ')
                            : 'All Configured'}
                        </td>
                        <td className="p-2 text-[10px] text-slate-600 max-w-xs truncate" title={evt.reason}>
                          {evt.reason || `Operator: ${evt.operator}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowPedestrianEventsModal(false)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-mono text-xs font-bold"
              >
                Close Event Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
