import React, { useEffect, useState } from 'react';
import { GitCompare, ArrowRight, Activity, TrendingUp, Clock } from 'lucide-react';
import { apiClient } from '../api/client';

interface ODFlow {
  origin: string;
  destination: string;
  vehicle_count: number;
  average_travel_time: string;
  average_speed: string;
}

export const OriginDestination: React.FC = () => {
  const [flows, setFlows] = useState<ODFlow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchODFlows = async () => {
    try {
      const res = await apiClient.get('/origin-destination');
      setFlows(res.data);
    } catch (err) {
      console.error('Error fetching OD matrix flows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchODFlows();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">ORIGIN-DESTINATION ANALYSIS</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Macro Traffic Flow Matrices and Inter-Zone Trip Duration Diagnostics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#EEF6FC] p-4 rounded border border-[#DCE4EA] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wide">Monitored Flow Corridors</p>
            <h3 className="text-2xl font-bold text-[#245B84] font-mono mt-1">
              {flows.length} Active Edges
            </h3>
          </div>
          <div className="p-2.5 rounded bg-white border border-[#DCE4EA] text-[#245B84]">
            <GitCompare className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-[#EAF4FB] p-4 rounded border border-[#DCE4EA] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wide">Top Density Flow Route</p>
            <h3 className="text-xs font-bold text-[#173F5F] font-mono mt-2 truncate max-w-[200px]">
              {flows.length > 0 ? `${flows[0].origin} → ${flows[0].destination}` : 'Plaza → Metro'}
            </h3>
          </div>
          <div className="p-2.5 rounded bg-white border border-[#DCE4EA] text-accent-teal">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-[#EDF8F2] p-4 rounded border border-[#DCE4EA] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wide">Average Corridor Duration</p>
            <h3 className="text-2xl font-bold text-accent-success font-mono mt-1">
              3.1 Minutes
            </h3>
          </div>
          <div className="p-2.5 rounded bg-white border border-[#DCE4EA] text-accent-success">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: List of flows and Matrix mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow List */}
        <div className="lg:col-span-2 bg-white p-5 rounded border border-[#DCE4EA] space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-500" /> Measured Vehicle Flows
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#EEF4F7] text-slate-650 uppercase border-b border-[#DCE4EA]">
                  <th className="p-3">Origin Intersection</th>
                  <th className="p-3 text-center"><ArrowRight className="w-3.5 h-3.5 mx-auto" /></th>
                  <th className="p-3">Destination Intersection</th>
                  <th className="p-3 text-center">Volume (Vehicles)</th>
                  <th className="p-3 text-right">Avg Duration</th>
                  <th className="p-3 text-right">Avg Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {flows.map((flow, idx) => {
                  const isTopRow = idx === 0;
                  const rowClass = isTopRow ? 'bg-[#E7F1F7] hover:bg-[#D9EAF2]' : 'hover:bg-[#F0F6FA]';
                  return (
                    <tr key={idx} className={`${rowClass} transition-colors`}>
                      <td className="p-3 font-semibold text-slate-805">{flow.origin}</td>
                      <td className="p-3 text-center text-slate-400">→</td>
                      <td className="p-3 font-semibold text-slate-805">{flow.destination}</td>
                      <td className="p-3 text-center text-[#245B84] font-bold">{flow.vehicle_count}</td>
                      <td className="p-3 text-right text-accent-success font-bold">{flow.average_travel_time}</td>
                      <td className="p-3 text-right text-slate-650">{flow.average_speed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual Matrix Heat Legend */}
        <div className="bg-white p-5 rounded border border-[#DCE4EA] space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-accent-teal" /> Corridor Health Grid
            </h2>
            <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
              System flags routing speed profiles across municipal junctions. Operational controls can trigger preemptive signal changes for congested nodes.
            </p>
          </div>

          <div className="bg-[#F6F8FA] p-4 border border-[#DCE4EA] rounded space-y-3 font-mono text-[10px] select-none">
            <div className="flex justify-between items-center border-b border-[#DCE4EA] pb-2">
              <span className="text-[#3D5364]">Plaza → Metro</span>
              <span className="px-2 py-0.5 rounded bg-[#DFF1E5] text-[#2E7D5B] border border-[#C2E5D0] font-bold">NORMAL SPEEDS</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#DCE4EA] pb-2">
              <span className="text-[#3D5364]">Metro → Flyover</span>
              <span className="px-2 py-0.5 rounded bg-[#FFF1C9] text-[#C49A4A] border border-[#FCE1A2] font-bold">MODERATE SPEEDS</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-[#3D5364]">Outer Ring Link</span>
              <span className="px-2 py-0.5 rounded bg-[#F7DCDD] text-[#C85D5D] border border-[#F3BFC0] font-bold">HEAVY VOLUME</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
