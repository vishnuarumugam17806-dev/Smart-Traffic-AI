import React, { useEffect, useState } from 'react';
import { Compass, MapPin } from 'lucide-react';
import { apiClient } from '../api/client';
import { Intersection } from '../types';

export const Intersections: React.FC = () => {
  const [intersections, setIntersections] = useState<Intersection[]>([]);

  useEffect(() => {
    apiClient.get('/intersections').then((res) => setIntersections(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">INTERSECTION NETWORK</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Smart City Junction Status & Configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {intersections.map((inter) => (
          <div key={inter.id} className="glass-card p-5 rounded-lg border border-surfaceBorder space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 border border-primary-500/10 text-primary-500 rounded">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">{inter.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" /> {inter.location}
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded border ${
                inter.current_status === 'LOW' ? 'bg-accent-success/15 text-accent-success border-accent-success/20' :
                inter.current_status === 'MODERATE' ? 'bg-accent-warning/15 text-accent-warning border-accent-warning/20' :
                'bg-accent-danger/15 text-accent-danger border-accent-danger/20'
              }`}>
                {inter.current_status} DENSITY
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-surfaceBorder grid grid-cols-2 gap-2 text-xs font-mono text-slate-700 select-none">
              <div>Total Lanes: <span className="text-slate-800 font-bold">{inter.total_lanes} Lanes</span></div>
              <div>Coordinates: <span className="text-slate-500">{inter.latitude?.toFixed(2)}, {inter.longitude?.toFixed(2)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
