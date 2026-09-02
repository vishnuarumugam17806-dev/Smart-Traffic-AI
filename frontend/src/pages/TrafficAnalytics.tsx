import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

export const TrafficAnalytics: React.FC = () => {
  const vehicleDistribution = [
    { name: 'Cars', value: 680, color: '#3B78A5' },
    { name: 'Motorcycles', value: 410, color: '#4F9B98' },
    { name: 'Buses', value: 140, color: '#7B8FB2' },
    { name: 'Trucks', value: 95, color: '#8E7AAE' },
    { name: 'Auto/Rickshaw', value: 157, color: '#C49A4A' },
  ];

  const hourlyFlow = [
    { hour: '00:00', count: 180 },
    { hour: '04:00', count: 90 },
    { hour: '08:00', count: 1120 },
    { hour: '12:00', count: 780 },
    { hour: '16:00', count: 1350 },
    { hour: '20:00', count: 890 },
  ];

  return (
    <div className="p-6 space-y-6 bg-[#F5F8FB]">
      {/* Page Header: bg #EDF5FA, border-left 4px #245B84 */}
      <div className="flex items-center justify-between border-l-4 border-l-[#245B84] bg-[#EDF5FA] p-3 rounded shrink-0">
        <div>
          <h1 className="text-sm font-bold text-[#173F5F] tracking-tight uppercase">TRAFFIC ANALYTICS</h1>
          <p className="text-[10px] text-[#245B84] font-mono mt-0.5">Historical Traffic Flow and Vehicle Classification Distribution Charts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5 rounded-lg border border-[#DCE4EA] space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#3B78A5]" /> VEHICLE CLASS BREAKDOWN
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={vehicleDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {vehicleDistribution.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#DCE4EA', borderRadius: '4px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5 rounded-lg border border-[#DCE4EA] space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#4F9B98]" /> HOURLY TRAFFIC PEAK DISTRIBUTION
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6EBEF" />
                <XAxis dataKey="hour" stroke="#667582" fontSize={10} tickLine={false} />
                <YAxis stroke="#667582" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#DCE4EA', borderRadius: '4px', fontSize: '11px' }} />
                <Bar dataKey="count" fill="#3B78A5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
