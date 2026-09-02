import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client';
import { Incident } from '../types';

export const Incidents: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    apiClient.get('/incidents').then((res) => setIncidents(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">TRAFFIC INCIDENT PIPELINE</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Sudden Stoppage, Blockage, and Abnormal Movement Detector Logs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {incidents.map((inc) => (
          <div key={inc.id} className="glass-card p-5 rounded-lg border border-surfaceBorder space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-accent-warning/15 border border-accent-warning/25 text-accent-warning">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 uppercase">{inc.incident_type}</h3>
                  <p className="text-[10px] font-mono text-slate-500">INCIDENT ID: #{inc.id}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 text-[9px] font-mono font-bold rounded bg-accent-warning/15 text-accent-warning border border-accent-warning/20">
                {inc.status}
              </span>
            </div>

            <p className="text-xs text-slate-650 bg-slate-50 p-3 rounded border border-surfaceBorder leading-relaxed">
              {inc.description}
            </p>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 select-none">
              <span>Confidence: <span className="text-accent-success font-bold">{(inc.confidence * 100).toFixed(0)}%</span></span>
              <span>Intersection: <span className="text-primary-500 font-bold">#{inc.intersection_id}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
