import React from 'react';
import { Siren, AlertTriangle, Info } from 'lucide-react';

export const Notifications: React.FC = () => {
  const notifs = [
    { id: 1, title: 'Emergency Priority Override', msg: 'Ambulance detected at Central Plaza Junction. Signal phase overridden to GREEN for 60s.', type: 'EMERGENCY', time: '3 mins ago' },
    { id: 2, title: 'Traffic Blockage Alert', msg: 'Queue length exceeded 12 vehicles at Tech Park Highway (Lane 2 stalled vehicle).', type: 'WARNING', time: '10 mins ago' },
    { id: 3, title: 'Adaptive Phase Timing Adjusted', msg: 'Signal #01 green duration increased to 55s based on 62% density.', type: 'INFO', time: '15 mins ago' },
  ];

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">SYSTEM NOTIFICATIONS & ALERTS</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Real-Time Operational Audit Feed</p>
        </div>
      </div>

      <div className="space-y-3">
        {notifs.map((n) => (
          <div key={n.id} className="glass-card p-4 rounded-lg border border-surfaceBorder flex items-start gap-4 select-none">
            <div className={`p-2 rounded border ${
              n.type === 'EMERGENCY' ? 'bg-accent-danger/10 text-accent-danger border-accent-danger/25' :
              n.type === 'WARNING' ? 'bg-accent-warning/10 text-accent-warning border-accent-warning/20' :
              'bg-primary-50 text-primary-500 border-primary-500/10'
            }`}>
              {n.type === 'EMERGENCY' ? <Siren className="w-4 h-4" /> : n.type === 'WARNING' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">{n.title}</h3>
                <span className="text-[10px] font-mono text-slate-500">{n.time}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.msg}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
