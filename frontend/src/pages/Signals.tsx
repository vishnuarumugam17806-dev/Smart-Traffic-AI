import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Cpu, RotateCcw, Settings, Check, TrafficCone, Radio, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { Intersection } from '../types';

interface ApproachData {
  name: string;
  direction: string;
  camera_id?: number;
  vehicle_count: number;
  queue_length: number;
  waiting_time: number;
  emergency_detected?: boolean;
  emergency_type?: string;
  signal?: string; // GREEN, YELLOW, RED
  priority_score?: number;
}

import { FALLBACK_INTERSECTIONS, FALLBACK_SIGNAL_DATA } from '../api/mockFallback';

export const Signals: React.FC = () => {
  const [intersections, setIntersections] = useState<Intersection[]>(FALLBACK_INTERSECTIONS);
  const [selectedJunctionId, setSelectedJunctionId] = useState<number>(1);
  const [signalData, setSignalData] = useState<any>(FALLBACK_SIGNAL_DATA);
  const [trafficData, setTrafficData] = useState<any>(null);
  const [optimizationData, setOptimizationData] = useState<any>(null);

  // Manual Override State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [manualApproach, setManualApproach] = useState<string>('');
  const [manualReason, setManualReason] = useState<string>('Heavy congestion clearance');
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
      console.warn('Using resilient intersections for signal control:', err);
    }
  };

  // Fetch live signal, traffic, and optimization data for selected junction
  const fetchJunctionData = useCallback(async () => {
    if (!selectedJunctionId) return;
    try {
      const [sigRes, trafRes, optRes] = await Promise.all([
        apiClient.get(`/intersections/${selectedJunctionId}/signal`),
        apiClient.get(`/intersections/${selectedJunctionId}/traffic`),
        apiClient.get(`/intersections/${selectedJunctionId}/optimization`)
      ]);
      setSignalData(sigRes.data);
      setTrafficData(trafRes.data);
      setOptimizationData(optRes.data);
    } catch (err) {
      console.error(`Error fetching data for junction #${selectedJunctionId}:`, err);
    }
  }, [selectedJunctionId]);

  useEffect(() => {
    fetchIntersections();
  }, []);

  useEffect(() => {
    fetchJunctionData();
    const interval = setInterval(fetchJunctionData, 2000);
    return () => clearInterval(interval);
  }, [fetchJunctionData]);

  const activeJunction = intersections.find((i) => i.id === selectedJunctionId) || intersections[0];

  const openConfigModal = () => {
    const num = signalData?.num_approaches || activeJunction?.num_approaches || 4;
    setConfigNumApproaches(num);
    const existing = activeJunction?.approaches_config || [];
    if (existing.length > 0) {
      setConfigApproaches(existing);
    } else {
      const defaultList = [
        { id: 'NORTH', name: 'North Approach', direction: 'NORTH' },
        { id: 'EAST', name: 'East Approach', direction: 'EAST' },
        { id: 'SOUTH', name: 'South Approach', direction: 'SOUTH' },
        { id: 'WEST', name: 'West Approach', direction: 'WEST' }
      ].slice(0, num);
      setConfigApproaches(defaultList);
    }
    setShowConfigModal(true);
  };

  const handleNumApproachesChange = (num: number) => {
    setConfigNumApproaches(num);
    const defaultLabels = ['North Approach', 'East Approach', 'South Approach', 'West Approach'];
    const defaultDirs = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
    const updated = [];
    for (let i = 0; i < num; i++) {
      updated.push({
        id: defaultDirs[i] || `APPROACH_${i + 1}`,
        name: configApproaches[i]?.name || defaultLabels[i] || `Approach ${i + 1}`,
        direction: defaultDirs[i] || `APPROACH_${i + 1}`
      });
    }
    setConfigApproaches(updated);
  };

  const handleSaveConfig = async () => {
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/config`, {
        num_approaches: configNumApproaches,
        approaches: configApproaches
      });
      setOverrideMessage(`Successfully updated Junction #${selectedJunctionId} to ${configNumApproaches}-side configuration.`);
      setShowConfigModal(false);
      fetchIntersections();
      fetchJunctionData();
    } catch (err) {
      console.error('Error updating junction config:', err);
    }
  };

  const handleApplyManualOverride = async () => {
    if (!manualApproach || !manualReason) return;
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/manual-override`, {
        phase: manualApproach,
        reason: manualReason
      });
      setOverrideMessage(`Manual override applied for Junction #${selectedJunctionId}: Forced green to ${manualApproach} approach.`);
      setShowOverrideModal(false);
      fetchJunctionData();
    } catch (err) {
      console.error('Error applying manual control:', err);
    }
  };

  const handleReturnToAuto = async () => {
    try {
      await apiClient.post(`/intersections/${selectedJunctionId}/return-to-auto`);
      setOverrideMessage(`Junction #${selectedJunctionId} returned to Automatic Multi-Side Adaptive Optimization.`);
      fetchJunctionData();
    } catch (err) {
      console.error('Error returning to auto:', err);
    }
  };

  // Combine approach traffic and signal data
  const approachKeys = signalData?.approaches ? Object.keys(signalData.approaches) : [];
  const approachesList: (ApproachData & { key: string })[] = approachKeys.map((key) => {
    const sigInfo = signalData?.approaches?.[key] || {};
    const trafInfo = trafficData?.approaches?.[key] || {};
    const score = optimizationData?.priority_scores?.[key] || 0;
    return {
      key,
      name: sigInfo.name || trafInfo.name || `${key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()} Approach`,
      direction: trafInfo.direction || key,
      vehicle_count: trafInfo.vehicle_count || 0,
      queue_length: trafInfo.queue_length || 0,
      waiting_time: trafInfo.waiting_time || 0,
      emergency_detected: trafInfo.emergency_detected,
      emergency_type: trafInfo.emergency_type,
      signal: sigInfo.signal || 'RED',
      priority_score: score
    };
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#F6F8FA] min-h-screen">
      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#DCE4EA] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase">DYNAMIC MULTI-SIDE SIGNAL CONTROL</h1>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Adaptive Traffic Signal Optimization for 2-Side, 3-Side & 4-Side Junctions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={openConfigModal}
            className="flex-1 md:flex-initial px-3 py-2 min-h-[44px] md:min-h-0 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Settings className="w-4 h-4" /> CONFIGURE SIDES
          </button>
          <button
            onClick={() => {
              if (approachesList.length > 0) setManualApproach(approachesList[0].key);
              setShowOverrideModal(true);
            }}
            className="flex-1 md:flex-initial px-3 py-2 min-h-[44px] md:min-h-0 bg-[#B7791F] hover:bg-[#9B6416] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <ShieldAlert className="w-4 h-4" /> MANUAL OVERRIDE
          </button>
          <button
            onClick={handleReturnToAuto}
            className="flex-1 md:flex-initial px-3 py-2 min-h-[44px] md:min-h-0 bg-[#2E7D5B] hover:bg-[#236347] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <RotateCcw className="w-4 h-4" /> RETURN TO AUTO
          </button>
        </div>
      </div>

      {/* Junction Selector Bar */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase whitespace-nowrap">SELECT JUNCTION:</span>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {intersections.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJunctionId(j.id)}
                className={`px-3 py-2 rounded text-xs font-mono font-bold border transition-all flex items-center gap-2 ${
                  selectedJunctionId === j.id
                    ? 'bg-[#245B84] text-white border-[#245B84] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#DCE4EA]'
                }`}
              >
                <span>{j.name}</span>
                <span
                  className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${
                    selectedJunctionId === j.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {j.num_approaches || 4}-SIDE
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Junction Operational Status */}
        {signalData && (
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#DCE4EA]">
            <div className="text-left md:text-right">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">MODE</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    signalData.mode === 'AUTOMATIC' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-mono font-extrabold text-slate-800">{signalData.mode}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="text-left md:text-right">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">ACTIVE APPROACH</span>
              <p className="text-xs font-mono font-extrabold text-emerald-700 uppercase">
                {signalData.active_approach || signalData.active_phase}
              </p>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="text-left md:text-right">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">COUNTDOWN</span>
              <p className="text-xs font-mono font-extrabold text-slate-800">{signalData.countdown}s</p>
            </div>
          </div>
        )}
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

      {/* Explainable AI Decision Model Card */}
      {optimizationData && (
        <div className="bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#245B84]" />
              <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase">
                EXPLAINABLE MULTI-SIDE OPTIMIZATION DECISION MODEL
              </h2>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono font-bold text-xs">
              EVALUATED {signalData?.num_approaches || approachesList.length} APPROACHES
            </span>
          </div>

          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA] text-xs font-mono text-slate-700 space-y-1">
            <span className="font-bold text-[#245B84]">DECISION REASONING:</span>
            <p className="leading-relaxed">{optimizationData.explanation}</p>
          </div>

          {/* Dynamic Priority Score Breakdown (Renders ONLY configured sides) */}
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase mb-2 block">
              APPROACH PRIORITY SCORE BREAKDOWN ({approachesList.length}-SIDE JUNCTION):
            </span>
            <div className={`grid gap-3 ${
              approachesList.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
              approachesList.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
            }`}>
              {approachesList.map((app) => {
                const isSelected = signalData?.active_approach === app.key || signalData?.active_phase === app.key;
                return (
                  <div
                    key={app.key}
                    className={`p-3 rounded border space-y-1 transition-all ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                        : 'bg-[#F2F7FC] border-[#DCE4EA]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">{app.name}</span>
                      {isSelected && (
                        <span className="px-1.5 py-0.2 text-[8px] font-bold font-mono bg-emerald-600 text-white rounded">
                          ACTIVE GREEN
                        </span>
                      )}
                    </div>
                    <p className="text-xl font-bold font-mono text-[#245B84]">{app.priority_score || 0} pts</p>
                    <div className="flex justify-between text-[9px] font-mono text-slate-650">
                      <span>Queue: {app.queue_length} veh</span>
                      <span>Wait: {app.waiting_time}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Approach Control Grid (Shows ONLY configured approaches: 2, 3, or 4 cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <TrafficCone className="w-4 h-4 text-[#245B84]" />
            JUNCTION #{selectedJunctionId} CONFIGURABLE APPROACHES ({approachesList.length} SIDES)
          </h2>
        </div>

        <div className={`grid gap-4 ${
          approachesList.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          approachesList.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}>
          {approachesList.map((app) => {
            const isGreen = app.signal === 'GREEN';
            const isYellow = app.signal === 'YELLOW';
            const isRed = app.signal === 'RED';

            return (
              <div
                key={app.key}
                className="bg-white rounded-lg p-5 border border-[#DCE4EA] shadow-xs flex flex-col justify-between space-y-4"
              >
                {/* Approach Header */}
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">{app.name}</h3>
                      <p className="text-[10px] font-mono text-slate-500">DIRECTION: {app.direction}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[9px] font-bold font-mono rounded ${
                        isGreen ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        isYellow ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      SIGNAL: {app.signal}
                    </span>
                  </div>

                  {/* Signal Light Bulb & Metrics Display */}
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded border border-[#DCE4EA] mb-3">
                    {/* Signal Bulbs */}
                    <div className="flex flex-col items-center gap-2 p-2 bg-slate-100 rounded-full border border-slate-200">
                      <div
                        className={`w-6 h-6 rounded-full border transition-all ${
                          isRed ? 'bg-red-600 shadow-md shadow-red-500/40' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`w-6 h-6 rounded-full border transition-all ${
                          isYellow ? 'bg-amber-500 shadow-md shadow-amber-500/40' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`w-6 h-6 rounded-full border transition-all ${
                          isGreen ? 'bg-emerald-600 shadow-md shadow-emerald-500/40' : 'bg-slate-200'
                        }`}
                      />
                    </div>

                    {/* Approach Metrics */}
                    <div className="space-y-1 font-mono text-xs flex-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-[10px]">Vehicles:</span>
                        <span className="font-bold text-slate-800">{app.vehicle_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-[10px]">Queue Length:</span>
                        <span className="font-bold text-slate-800">{app.queue_length} veh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-[10px]">Wait Time:</span>
                        <span className="font-bold text-slate-800">{app.waiting_time}s</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                        <span className="text-slate-500 text-[10px]">Priority Score:</span>
                        <span className="font-extrabold text-[#245B84]">{app.priority_score || 0} pts</span>
                      </div>
                    </div>
                  </div>

                  {app.emergency_detected && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-[10px] font-mono text-red-700 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>EMERGENCY DETECTED ({app.emergency_type || 'Vehicle'})</span>
                    </div>
                  )}
                </div>

                {/* Touch-Friendly Approach Controls */}
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block">APPROACH CONTROL</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setManualApproach(app.key);
                        handleApplyManualOverride();
                      }}
                      className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs font-mono transition-colors shadow-xs"
                    >
                      🟢 FORCE GREEN
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await apiClient.post(`/intersections/${selectedJunctionId}/manual-override`, {
                            phase: app.key,
                            reason: 'Manual Red Signal Stop'
                          });
                          fetchJunctionData();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="py-2.5 px-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-xs font-mono transition-colors shadow-xs"
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

            <p className="text-xs text-slate-600">
              Select approach to force GREEN and confirm justification for audit log.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                  Target Approach ({approachesList.length}-Side Junction)
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
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                  Justification Reason
                </label>
                <input
                  type="text"
                  required
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800 focus:outline-none"
                  placeholder="e.g. Emergency vehicle clearance / Heavy congestion priority"
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
                className="px-4 py-1.5 bg-[#B7791F] hover:bg-[#9B6416] text-white text-xs font-mono font-bold rounded"
              >
                Confirm & Apply Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Junction Sides Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DCE4EA] max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-slate-800 border-b pb-3">
              <Settings className="w-5 h-5 text-[#245B84]" />
              <h3 className="font-bold font-mono text-sm uppercase">Configure Junction Approaches</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1.5">
                  NUMBER OF APPROACHES (SIDES)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleNumApproachesChange(num)}
                      className={`py-3 rounded border font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        configNumApproaches === num
                          ? 'bg-[#245B84] text-white border-[#245B84]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {configNumApproaches === num && <Check className="w-3.5 h-3.5" />}
                      <span>{num}-SIDE JUNCTION</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                  APPROACH NAMES & DIRECTIONS ({configNumApproaches} APPROACHES)
                </span>
                {configApproaches.map((app, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-500 w-16">
                      Side #{idx + 1}:
                    </span>
                    <input
                      type="text"
                      value={app.name}
                      onChange={(e) => {
                        const updated = [...configApproaches];
                        updated[idx].name = e.target.value;
                        setConfigApproaches(updated);
                      }}
                      className="flex-1 bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800 focus:outline-none"
                      placeholder={`Approach ${idx + 1} Name`}
                    />
                    <span className="text-xs font-mono text-slate-400 font-bold uppercase w-16 text-right">
                      {app.direction}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE4EA]">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white text-xs font-mono font-bold rounded"
              >
                Save Junction Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
