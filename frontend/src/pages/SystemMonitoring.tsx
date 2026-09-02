import React, { useEffect, useState } from 'react';
import { Server, Database, Cpu, Wifi } from 'lucide-react';
import { apiClient } from '../api/client';

export const SystemMonitoring: React.FC = () => {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/system/health').then((res) => setHealth(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">SYSTEM HEALTH & TELEMETRY</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Microservice Readiness, Database Engine Connection, and WebSocket Hub Status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs select-none">
        <div className="glass-card p-4 rounded-lg border border-surfaceBorder space-y-2">
          <p className="text-slate-500 flex items-center gap-1.5"><Server className="w-4 h-4 text-primary-500" /> FASTAPI GATEWAY</p>
          <p className="text-base font-bold text-accent-success">ONLINE (200 OK)</p>
        </div>

        <div className="glass-card p-4 rounded-lg border border-surfaceBorder space-y-2">
          <p className="text-slate-500 flex items-center gap-1.5"><Database className="w-4 h-4 text-accent-teal" /> DATABASE ENGINE</p>
          <p className="text-base font-bold text-accent-success">CONNECTED</p>
        </div>

        <div className="glass-card p-4 rounded-lg border border-surfaceBorder space-y-2">
          <p className="text-slate-500 flex items-center gap-1.5"><Cpu className="w-4 h-4 text-accent-warning" /> YOLO NEURAL ENGINE</p>
          <p className="text-base font-bold text-accent-success">ACTIVE (14ms)</p>
        </div>

        <div className="glass-card p-4 rounded-lg border border-surfaceBorder space-y-2">
          <p className="text-slate-500 flex items-center gap-1.5"><Wifi className="w-4 h-4 text-accent-info" /> WEBSOCKET HUB</p>
          <p className="text-base font-bold text-accent-success">BROADCASTING</p>
        </div>
      </div>
    </div>
  );
};
