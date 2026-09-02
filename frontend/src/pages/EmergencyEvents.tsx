import React, { useEffect, useState } from 'react';
import { Siren } from 'lucide-react';
import { apiClient } from '../api/client';
import { EmergencyEvent } from '../types';

export const EmergencyEvents: React.FC = () => {
  const [events, setEvents] = useState<EmergencyEvent[]>([]);

  useEffect(() => {
    apiClient.get('/emergency').then((res) => setEvents(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">EMERGENCY VEHICLE PRIORITIZATION</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Ambulance, Fire Truck, and Police Green Wave Preemption Activity Log</p>
        </div>
      </div>

      <div className="glass-panel rounded-lg overflow-hidden border border-surfaceBorder bg-white shadow-sm">
        <table className="w-full text-left text-xs font-mono select-none">
          <thead className="bg-slate-50 text-slate-650 uppercase border-b border-surfaceBorder">
            <tr>
              <th className="p-3.5">EVENT ID</th>
              <th className="p-3.5">VEHICLE TYPE</th>
              <th className="p-3.5">INTERSECTION</th>
              <th className="p-3.5">PRIORITY</th>
              <th className="p-3.5">ACTION TAKEN</th>
              <th className="p-3.5">STATUS</th>
              <th className="p-3.5">DETECTED AT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {events.map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3.5 font-bold text-primary-500">#{ev.id}</td>
                <td className="p-3.5 flex items-center gap-2">
                  <Siren className="w-4 h-4 text-accent-danger" />
                  <span className="font-bold text-slate-850 uppercase">{ev.vehicle_type}</span>
                </td>
                <td className="p-3.5 text-slate-600">Intersection #{ev.intersection_id}</td>
                <td className="p-3.5 font-bold text-accent-danger">{ev.priority_level}</td>
                <td className="p-3.5 text-slate-600">{ev.action_taken}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[9px] rounded bg-accent-danger/15 text-accent-danger font-bold border border-accent-danger/20">
                    {ev.status}
                  </span>
                </td>
                <td className="p-3.5 text-slate-500">{new Date(ev.detected_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
