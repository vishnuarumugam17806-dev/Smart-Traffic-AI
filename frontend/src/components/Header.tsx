import React, { useState, useEffect } from 'react';
import { Siren, Wifi, WifiOff, Bell, ShieldCheck, Activity, Cpu } from 'lucide-react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';

export const Header: React.FC = () => {
  const { isConnected, emergencyEvents } = useStore();
  const [timeStr, setTimeStr] = useState<string>('');
  const [healthIndex, setHealthIndex] = useState<{ score: number; status: string }>({ score: 84.5, status: 'GOOD' });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString() + ' | ' + now.toLocaleDateString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchHealthIndex = async () => {
      try {
        const res = await apiClient.get('/traffic/health-index');
        if (res.data && res.data.health_index !== undefined) {
          setHealthIndex({ score: res.data.health_index, status: res.data.status });
        }
      } catch (err) {
        // Fallback default
      }
    };
    fetchHealthIndex();
    const interval = setInterval(fetchHealthIndex, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeEmergency = emergencyEvents.find((e) => e.status === 'ACTIVE');

  return (
    <header className="h-16 border-b border-[#DCE4EA] bg-white px-6 flex items-center justify-between sticky top-0 z-30 select-none shadow-xs">
      {/* Left Title & Emergency Banner */}
      <div className="flex items-center gap-4">
        {activeEmergency ? (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded bg-[#FCEBEC] border border-[#F5C2C2] text-[#B84A4A] text-xs font-bold animate-pulse">
            <Siren className="w-4 h-4 text-[#B84A4A]" />
            <span>CRITICAL OVERRIDE: Emergency preemption corridor active at Intersection #{activeEmergency.intersection_id}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-extrabold text-[#245B84] uppercase tracking-wide">
                VIGITRA PLATFORM
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#EEF6FC] text-[#245B84] border border-[#DCE4EA]">
                DEMO / SIMULATION MODE
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-slate-500" /> Signal Control: Simulation
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
              Intelligent City-Wide Traffic Management & Vehicle Intelligence Console
            </span>
          </div>
        )}
      </div>

      {/* Right Metrics, Health Index & Controls */}
      <div className="flex items-center gap-4">
        {/* VIGITRA AI Project Traffic Health Index */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#F2F7FC] border border-[#DCE4EA]" title="VIGITRA AI Project Traffic Health Index (Project Defined Metric)">
          <Activity className="w-3.5 h-3.5 text-[#245B84]" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tight">TRAFFIC HEALTH INDEX</span>
            <span className="text-xs font-mono font-extrabold text-[#245B84]">
              {healthIndex.score} / 100 ({healthIndex.status})
            </span>
          </div>
        </div>

        {/* System Health / Connection Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#EAF7EF] border border-[#D2EADA] text-xs">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span className="text-[#2E7D5B] font-mono text-[11px] font-bold">WS ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-amber-600 font-mono text-[11px] font-bold">WS RECONNECTING</span>
            </>
          )}
        </div>

        {/* Operational Security Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-slate-500 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-[#245B84]" />
          <span>SAFETY LIMITS ENFORCED</span>
        </div>

        {/* Real-time Clock */}
        <div className="text-xs font-mono text-slate-700 bg-slate-50 px-3 py-1.5 rounded border border-[#DCE4EA]">
          {timeStr || '00:00:00 AM'}
        </div>

        {/* Notifications Icon */}
        <button className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-[#EDF5FA] rounded transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
};
