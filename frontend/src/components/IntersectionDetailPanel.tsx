import React, { useEffect, useState } from 'react';
import { TrafficCone, Cpu, Activity, ShieldAlert, Check, X, AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

interface IntersectionDetailPanelProps {
  intersectionId: number;
  onClose: () => void;
}

export const IntersectionDetailPanel: React.FC<IntersectionDetailPanelProps> = ({
  intersectionId,
  onClose
}) => {
  const { user, activeLiveUpdate } = useStore();
  const [loading, setLoading] = useState(true);
  const [trafficData, setTrafficData] = useState<any>(null);
  const [signalData, setSignalData] = useState<any>(null);
  const [optData, setOptData] = useState<any>(null);
  const [decisionHistory, setDecisionHistory] = useState<any[]>([]);
  
  // Manual override states
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [targetPhase, setTargetPhase] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchDetails = async () => {
    try {
      const [trafRes, sigRes, optRes, histRes] = await Promise.all([
        apiClient.get(`/intersections/${intersectionId}/traffic`),
        apiClient.get(`/intersections/${intersectionId}/signal`),
        apiClient.get(`/intersections/${intersectionId}/optimization`),
        apiClient.get(`/intersections/${intersectionId}/decision-history?limit=10`)
      ]);
      setTrafficData(trafRes.data);
      setSignalData(sigRes.data);
      setOptData(optRes.data);
      setDecisionHistory(histRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Error loading intersection details:", err);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [intersectionId]);

  // Reactive updates from WebSocket
  useEffect(() => {
    if (activeLiveUpdate) {
      if (activeLiveUpdate.event === 'SIGNAL_STATE_CHANGED' && activeLiveUpdate.intersection_id === intersectionId) {
        setSignalData({
          intersection_id: activeLiveUpdate.intersection_id,
          active_phase: activeLiveUpdate.active_phase,
          state: activeLiveUpdate.state,
          countdown: activeLiveUpdate.countdown,
          mode: activeLiveUpdate.mode,
          approaches: activeLiveUpdate.approaches
        });
        setOptData((prev: any) => ({
          ...prev,
          active_phase: activeLiveUpdate.active_phase,
          explanation: activeLiveUpdate.reasoning
        }));
      } else if (activeLiveUpdate.event === 'TRAFFIC_UPDATE' && activeLiveUpdate.intersection_id === intersectionId) {
        // Refetch traffic data to keep in sync
        apiClient.get(`/intersections/${intersectionId}/traffic`).then(res => setTrafficData(res.data)).catch(console.error);
        apiClient.get(`/intersections/${intersectionId}/decision-history?limit=10`).then(res => setDecisionHistory(res.data)).catch(console.error);
      }
    }
  }, [activeLiveUpdate, intersectionId]);

  const handleOpenOverride = (phase: string) => {
    // Role-based access validation
    const role = user?.role;
    if (role !== 'ADMIN' && role !== 'OPERATOR') {
      setError("Unauthorized access. Only Operators and Administrators are permitted to apply manual overrides.");
      setTimeout(() => setError(""), 5000);
      return;
    }
    setTargetPhase(phase);
    setShowOverrideModal(true);
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setError("Please provide a justification for this override.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/intersections/${intersectionId}/manual-control`, {
        phase: targetPhase,
        reason: overrideReason
      });
      setShowOverrideModal(false);
      setOverrideReason("");
      fetchDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to apply manual override.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnToAuto = async () => {
    const role = user?.role;
    if (role !== 'ADMIN' && role !== 'OPERATOR') {
      setError("Unauthorized access. Only Operators and Administrators are permitted to alter signal states.");
      setTimeout(() => setError(""), 5000);
      return;
    }
    try {
      await apiClient.post(`/intersections/${intersectionId}/return-to-auto`);
      fetchDetails();
    } catch (err: any) {
      setError("Failed to return to auto mode.");
      setTimeout(() => setError(""), 4000);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center select-none font-mono text-xs text-slate-500">
        Loading Command metrics...
      </div>
    );
  }

  return (
    <div className="bg-white border border-surfaceBorder rounded-lg shadow-md p-5 space-y-6 select-none relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-3">
        <div className="flex items-center gap-2">
          <TrafficCone className="w-5 h-5 text-primary-500" />
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 uppercase">Junction Operations</h3>
            <p className="text-[10px] text-slate-500 font-mono">INTERSECTION ID: #{intersectionId}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Badge & Countdown */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border border-surfaceBorder rounded-lg">
        <div className="space-y-1">
          <p className="text-[9px] font-mono font-bold text-slate-450 uppercase">Active Mode</p>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono border ${
            signalData?.mode === 'MANUAL' 
              ? 'bg-accent-warning/15 text-accent-warning border-accent-warning/20' 
              : 'bg-accent-success/15 text-accent-success border-accent-success/20'
          }`}>
            {signalData?.mode || 'AUTOMATIC'}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono font-bold text-slate-450 uppercase">Countdown</p>
          <p className="text-2xl font-extrabold font-mono text-slate-800">
            {signalData?.countdown} <span className="text-[10px] font-normal text-slate-500">sec</span>
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-[#FFF5F5] border border-accent-danger/20 text-accent-danger text-[10px] font-mono rounded flex items-center gap-1.5 animate-shake">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Approaches Overview */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-mono font-extrabold text-slate-600 uppercase tracking-wider">LANE-WISE APPROACH METRICS</h4>
        <div className="grid grid-cols-2 gap-3">
          {trafficData && Object.keys(trafficData.approaches).map((direction) => {
            const app = trafficData.approaches[direction];
            const sigInfo = signalData?.approaches?.[direction];
            const signalColor = sigInfo ? sigInfo.signal : 'RED';
            
            let lightBg = 'bg-slate-200';
            let pulseStyle = '';
            if (signalColor === 'GREEN') {
              lightBg = 'bg-accent-success shadow-sm shadow-accent-success/30';
              pulseStyle = 'border-accent-success/20 animate-pulse';
            } else if (signalColor === 'YELLOW') {
              lightBg = 'bg-accent-warning shadow-sm shadow-accent-warning/30';
            } else if (signalColor === 'RED') {
              lightBg = 'bg-accent-danger shadow-sm shadow-accent-danger/30';
            }

            return (
              <div key={direction} className={`p-3 rounded border border-surfaceBorder bg-white flex flex-col justify-between h-28 relative ${pulseStyle}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-700 font-mono">{direction}</span>
                  <div className={`w-3.5 h-3.5 rounded-full ${lightBg}`} />
                </div>
                <div className="mt-2 space-y-0.5 text-[10px] font-mono text-slate-500">
                  <p>Queue: <span className="font-bold text-slate-800">{app.queue_length} veh</span></p>
                  <p>Volume: <span className="font-bold text-slate-800">{app.vehicle_count}</span></p>
                  <p>Wait Time: <span className="font-bold text-slate-800">{app.waiting_time}s</span></p>
                  {app.emergency_detected && (
                    <span className="mt-1 px-1 py-0.5 text-[8px] font-mono font-extrabold text-[#B84A4A] bg-[#FCEEEF] border border-[#F3BFC0] rounded inline-block animate-pulse">
                      EMERGENCY
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Decision Reasoning */}
      <div className="p-3 bg-accent-teal/5 border border-accent-teal/15 rounded-lg space-y-1">
        <p className="text-[9px] font-mono font-bold text-accent-teal uppercase flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> Adaptive Optimizer decision
        </p>
        <p className="text-slate-650 text-[11px] leading-relaxed font-semibold">
          {optData?.explanation || "Optimization calculations active."}
        </p>
      </div>

      {/* Control Buttons */}
      <div className="space-y-2 border-t border-surfaceBorder pt-4">
        <h4 className="text-[10px] font-mono font-extrabold text-slate-600 uppercase tracking-wider mb-2">MANUAL OVERRIDE PANELS</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleOpenOverride("NORTH_SOUTH")}
            className="py-2 px-3 bg-white border border-[#CBD6DE] hover:bg-[#EAF2F7] text-xs font-bold rounded text-[#245B84] transition-colors"
          >
            Force N/S Green
          </button>
          <button
            onClick={() => handleOpenOverride("EAST_WEST")}
            className="py-2 px-3 bg-white border border-[#CBD6DE] hover:bg-[#EAF2F7] text-xs font-bold rounded text-[#245B84] transition-colors"
          >
            Force E/W Green
          </button>
        </div>
        
        {signalData?.mode === 'MANUAL' ? (
          <button
            onClick={handleReturnToAuto}
            className="w-full py-2.5 bg-[#EAF7EF] hover:bg-[#D2EADA] text-accent-success border border-[#C2E5D0] text-xs font-extrabold rounded flex items-center justify-center gap-1.5 transition-colors"
          >
            <Check className="w-4 h-4" /> Return to Auto adaptive
          </button>
        ) : (
          <button
            disabled
            className="w-full py-2.5 bg-slate-100 border border-slate-200 text-slate-400 text-xs font-bold rounded cursor-not-allowed select-none text-center"
          >
            Running in Auto mode
          </button>
        )}
      </div>

      {/* Decision Logs timeline */}
      <div className="space-y-3 pt-3 border-t border-surfaceBorder">
        <h4 className="text-[10px] font-mono font-extrabold text-slate-600 uppercase tracking-wider">AI RECOMMENDATION TIMELINE</h4>
        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
          {decisionHistory.map((d, index) => (
            <div key={d.id || index} className="p-2 rounded bg-slate-50 border border-surfaceBorder text-[10px] font-mono space-y-0.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-primary-500">{d.recommended_phase}</span>
                <span className="text-slate-500">{new Date(d.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-600 font-medium">{d.reasoning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Manual override confirmation Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-surfaceBorder p-5 rounded-lg shadow-xl w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2 text-accent-warning">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-sm text-slate-800">Confirm Signal Override</h3>
            </div>
            
            <p className="text-slate-600 text-xs leading-relaxed">
              Applying manual override forces the signal to switch states. This override will be recorded in the audit logs.
            </p>

            <form onSubmit={handleApplyOverride} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase">Reason for override</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP corridor, emergency clearance"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-white border border-surfaceBorder rounded p-2 text-xs font-sans text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 text-xs font-bold rounded hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 bg-primary-500 text-white text-xs font-extrabold rounded hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Applying...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
