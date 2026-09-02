import React, { useState, useEffect } from 'react';
import { TrafficCone, Cpu, RotateCw } from 'lucide-react';
import { apiClient } from '../api/client';

interface SignalControllerCardProps {
  signalId: number;
  intersectionName?: string;
  initialPhase?: string;
  initialGreen?: number;
  initialRed?: number;
  isAdaptive?: boolean;
}

export const SignalControllerCard: React.FC<SignalControllerCardProps> = ({
  signalId,
  intersectionName = 'Central Plaza Junction',
  initialPhase = 'GREEN',
  initialGreen = 45,
  initialRed = 45,
}) => {
  const [phase, setPhase] = useState<string>(initialPhase);
  const [greenDuration, setGreenDuration] = useState<number>(initialGreen);
  const [redDuration, setRedDuration] = useState<number>(initialRed);
  const [timeLeft, setTimeLeft] = useState<number>(initialGreen);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [lastReasoning, setLastReasoning] = useState<string>(
    'Adaptive Optimizer automatically configured 45s green duration based on 18 queued vehicles.'
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 1 ? prev - 1 : greenDuration));
    }, 1000);
    return () => clearInterval(timer);
  }, [greenDuration]);

  const handleOptimizeNow = async () => {
    try {
      setIsOptimizing(true);
      const res = await apiClient.post(`/signals/${signalId}/optimize`);
      if (res.data) {
        setGreenDuration(res.data.recommended_green);
        setRedDuration(res.data.recommended_red);
        setTimeLeft(res.data.recommended_green);
        setLastReasoning(res.data.reasoning);
      }
    } catch (err) {
      console.error('Failed to optimize signal:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="glass-card rounded-lg p-5 border border-surfaceBorder flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-primary-50 border border-primary-500/10 text-primary-500">
              <TrafficCone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">{intersectionName}</h3>
              <p className="text-[10px] font-mono text-slate-500">SIGNAL ID: #{signalId}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[9px] font-bold font-mono rounded bg-accent-info/10 text-accent-info border border-accent-info/20">
            ADAPTIVE AI
          </span>
        </div>

        {/* Signal Light Display & Countdown */}
        <div className="flex items-center justify-around py-4 bg-slate-50 rounded border border-surfaceBorder mb-4">
          {/* Signal Bulbs */}
          <div className="flex flex-col items-center gap-2.5 p-2 bg-slate-100 rounded-full border border-surfaceBorder">
            <div
              className={`w-7 h-7 rounded-full border border-slate-300 transition-all duration-300 ${
                phase === 'RED' ? 'bg-accent-danger shadow-md shadow-accent-danger/25' : 'bg-slate-200'
              }`}
            />
            <div
              className={`w-7 h-7 rounded-full border border-slate-300 transition-all duration-300 ${
                phase === 'YELLOW' ? 'bg-accent-warning shadow-md shadow-accent-warning/25' : 'bg-slate-200'
              }`}
            />
            <div
              className={`w-7 h-7 rounded-full border border-slate-300 transition-all duration-300 ${
                phase === 'GREEN' ? 'bg-accent-success shadow-md shadow-accent-success/25' : 'bg-slate-200'
              }`}
            />
          </div>

          {/* Large Countdown Counter */}
          <div className="text-center">
            <p className="text-[9px] font-mono text-slate-500 uppercase font-bold">ACTIVE PHASE TIME</p>
            <p className="text-4xl font-extrabold font-mono text-slate-800 my-1">
              {timeLeft} <span className="text-xs font-normal text-slate-500">sec</span>
            </p>
            <p className="text-xs font-semibold text-accent-success font-mono">PHASE: {phase}</p>
          </div>
        </div>

        {/* Safety Boundary Enforcer Info */}
        <div className="p-3 bg-slate-50 rounded border border-surfaceBorder mb-4 text-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Safety Limits:</span>
            <span className="font-mono text-slate-700 font-bold">15s Min | 120s Max</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-650">
            <span>Green Phase Duration:</span>
            <span className="font-bold text-slate-800">{greenDuration}s</span>
          </div>
        </div>

        {/* AI Operational Explanation */}
        <div className="p-3 bg-accent-teal/5 rounded border border-accent-teal/20 text-xs">
          <p className="text-[9px] font-bold font-mono text-accent-teal flex items-center gap-1.5 mb-1">
            <Cpu className="w-3.5 h-3.5" /> SYSTEM DECISION LOG
          </p>
          <p className="text-slate-650 text-[11px] leading-relaxed font-medium">{lastReasoning}</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleOptimizeNow}
        disabled={isOptimizing}
        className="mt-4 w-full py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm select-none"
      >
        <RotateCw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
        <span>{isOptimizing ? 'Optimizing Signal...' : 'Trigger Adaptive Optimization'}</span>
      </button>
    </div>
  );
};
