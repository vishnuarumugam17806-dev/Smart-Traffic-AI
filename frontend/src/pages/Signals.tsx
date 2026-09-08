import React, { useEffect, useState } from 'react';
import { TrafficCone, ShieldAlert, Cpu, CheckCircle2, RotateCcw, AlertTriangle, HelpCircle } from 'lucide-react';
import { SignalControllerCard } from '../components/SignalControllerCard';
import { apiClient } from '../api/client';
import { Signal } from '../types';

export const Signals: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [manualPhase, setManualPhase] = useState<string>('NORTH_SOUTH');
  const [manualReason, setManualReason] = useState<string>('High congestion clearance');
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideMessage, setOverrideMessage] = useState<string>('');

  const fetchSignals = async () => {
    try {
      const res = await apiClient.get('/signals');
      setSignals(res.data);
      if (res.data.length > 0) {
        const optRes = await apiClient.get(`/intersections/${res.data[0].intersection_id}/optimization`);
        setOptimizationData(optRes.data);
      }
    } catch (err) {
      console.error('Error fetching signals:', err);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyManualOverride = async () => {
    if (!manualReason) return;
    try {
      await apiClient.post('/intersections/1/manual-control', {
        phase: manualPhase,
        reason: manualReason
      });
      setOverrideMessage(`Manual override applied: Forced phase ${manualPhase}. Audit log created.`);
      setShowOverrideModal(false);
      fetchSignals();
    } catch (err) {
      console.error('Error overriding signal:', err);
    }
  };

  const handleReturnToAuto = async () => {
    try {
      await apiClient.post('/intersections/1/return-to-auto');
      setOverrideMessage('Signal control returned to Automatic Adaptive AI Optimization.');
      fetchSignals();
    } catch (err) {
      console.error('Error returning to auto:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight uppercase">EXPLAINABLE ADAPTIVE SIGNAL CONTROL</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Multi-Factor AI Optimization, Safety Boundaries & Authorized Manual Override</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowOverrideModal(true)}
            className="flex-1 sm:flex-initial px-3 py-2 min-h-[44px] sm:min-h-0 bg-[#B7791F] hover:bg-[#9B6416] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <ShieldAlert className="w-4 h-4" /> MANUAL CONTROL
          </button>
          <button
            onClick={handleReturnToAuto}
            className="flex-1 sm:flex-initial px-3 py-2 min-h-[44px] sm:min-h-0 bg-[#2E7D5B] hover:bg-[#236347] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <RotateCcw className="w-4 h-4" /> RETURN TO AUTO
          </button>
        </div>
      </div>

      {/* Override Alert Notification */}
      {overrideMessage && (
        <div className="p-3 bg-[#EEF6FC] border border-[#DCE4EA] text-[#245B84] text-xs font-mono font-bold rounded flex items-center justify-between">
          <span>{overrideMessage}</span>
          <button onClick={() => setOverrideMessage('')} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Explainable AI Decision Card */}
      {optimizationData && (
        <div className="bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#245B84]" />
              <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase">
                EXPLAINABLE AI SIGNAL DECISION MODEL
              </h2>
            </div>
            <span className="px-2.5 py-1 bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA] rounded font-mono font-bold text-xs">
              SYSTEM CONFIDENCE: 98%
            </span>
          </div>

          <div className="p-3 bg-[#F6F8FA] rounded border border-[#DCE4EA] text-xs font-mono text-slate-700 space-y-1">
            <span className="font-bold text-[#245B84]">DECISION REASONING:</span>
            <p className="leading-relaxed">{optimizationData.explanation}</p>
          </div>

          {/* Priority Score Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {Object.entries(optimizationData.priority_scores || {}).map(([dir, score]: any) => (
              <div key={dir} className="p-3 bg-[#F2F7FC] rounded border border-[#DCE4EA] space-y-1">
                <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">{dir} APPROACH</span>
                <p className="text-lg font-bold font-mono text-[#245B84]">{score} pts</p>
                <span className="text-[9px] font-mono text-slate-500">Multi-Factor Weight Score</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal Controller Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {signals.map((sig) => (
          <SignalControllerCard
            key={sig.id}
            signalId={sig.id}
            intersectionName={`Central Plaza Junction #${sig.intersection_id}`}
            initialPhase={sig.current_phase}
            initialGreen={sig.green_duration}
            initialRed={sig.red_duration}
            isAdaptive={sig.is_adaptive}
          />
        ))}
      </div>

      {/* Manual Override Confirmation Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#DCE4EA] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-slate-800 border-b pb-3">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold font-mono text-sm uppercase">Authorized Manual Signal Control</h3>
            </div>

            <p className="text-xs text-slate-600">
              Before applying manual control, confirm target phase and supply audit justification.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">Target Phase</label>
                <select
                  value={manualPhase}
                  onChange={(e) => setManualPhase(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800 focus:outline-none"
                >
                  <option value="NORTH_SOUTH">NORTH_SOUTH Phase (Green N/S)</option>
                  <option value="EAST_WEST">EAST_WEST Phase (Green E/W)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">Justification Reason</label>
                <input
                  type="text"
                  required
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs font-mono text-slate-800 focus:outline-none"
                  placeholder="e.g. VIP convoy movement / Heavy congestion clearance"
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
                Confirm & Log Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
