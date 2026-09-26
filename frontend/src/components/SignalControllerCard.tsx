import React, { useState, useEffect, useCallback, memo } from 'react';
import { TrafficCone, RotateCw } from 'lucide-react';
import { apiClient } from '../api/client';

interface SignalControllerCardProps {
  signalId: number;
  intersectionName?: string;
  initialPhase?: string;
  initialGreen?: number;
  initialRed?: number;
  isAdaptive?: boolean;
}

const SignalControllerCardComponent: React.FC<SignalControllerCardProps> = ({
  signalId,
  intersectionName = 'Anna Salai - Spencers Junction',
  initialPhase = 'GREEN',
  initialGreen = 45,
  initialRed = 45,
}) => {
  const [phase] = useState<string>(initialPhase);
  const [greenDuration, setGreenDuration] = useState<number>(initialGreen);
  const [, setRedDuration] = useState<number>(initialRed);
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

  const handleOptimizeNow = useCallback(async () => {
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
  }, [signalId]);

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

        {/* Reason Explainer */}
        <div className="p-3 bg-slate-50 rounded border border-surfaceBorder">
          <p className="text-[10px] font-mono text-slate-500 mb-1 uppercase font-semibold">AI OPTIMIZATION REASONING</p>
          <p className="text-xs text-slate-700 leading-relaxed">{lastReasoning}</p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleOptimizeNow}
        disabled={isOptimizing}
        className="mt-4 w-full py-3 min-h-[44px] rounded-lg bg-[#245B84] hover:bg-[#1E4A6F] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs select-none"
      >
        <RotateCw className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
        <span>{isOptimizing ? 'Optimizing Signal...' : 'Trigger Adaptive AI Optimization'}</span>
      </button>
    </div>
  );
};

export const SignalControllerCard = memo(SignalControllerCardComponent);
