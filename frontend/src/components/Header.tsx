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
    <header className="h-14 sm:h-16 border-b border-[#DCE4EA] bg-white px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none shadow-xs">
      {/* Left Title & Emergency Banner */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs sm:text-sm font-mono font-extrabold text-[#245B84] uppercase tracking-wide truncate">
              VIGITRA AI
            </span>
          </div>
          <span className="hidden md:inline-block text-[10px] text-slate-500 font-mono mt-0.5 truncate">
            City Traffic Control Center
          </span>
        </div>

      {/* Right Metrics, Connection Status & Controls */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* VIGITRA AI Project Traffic Health Index */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#F2F7FC] border border-[#DCE4EA]" title="Traffic Health Index">
          <Activity className="w-3.5 h-3.5 text-[#245B84]" />
          <div className="flex flex-col text-right font-mono">
            <span className="text-[8px] text-slate-500 uppercase tracking-tight">HEALTH INDEX</span>
            <span className="text-[11px] font-extrabold text-[#245B84]">
              {healthIndex.score} / 100
            </span>
          </div>
        </div>

        {/* System Health / Connection Badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded bg-[#EAF7EF] border border-[#D2EADA] text-xs">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#2E7D5B] shrink-0" />
              <span className="text-[#2E7D5B] font-mono text-[10px] sm:text-[11px] font-bold">ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-amber-600 font-mono text-[10px] sm:text-[11px] font-bold">SYNCING</span>
            </>
          )}
        </div>

        {/* Real-time Clock */}
        <div className="hidden lg:block text-xs font-mono text-slate-700 bg-slate-50 px-3 py-1.5 rounded border border-[#DCE4EA]">
          {timeStr || '00:00:00 AM'}
        </div>

        {/* Notifications Icon */}
        <button className="relative p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-[#EDF5FA] rounded transition-colors" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
};
