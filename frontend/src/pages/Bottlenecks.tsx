import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';

interface BottleneckItem {
  camera_name: string;
  location: string;
  queue_length: number;
  vehicle_count: number;
  congestion_level: string;
  bottleneck_score: number;
}

export const Bottlenecks: React.FC = () => {
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchBottlenecks = async () => {
    try {
      const res = await apiClient.get('/congestion/bottlenecks');
      setBottlenecks(res.data);
    } catch (err) {
      console.error('Error fetching bottlenecks data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBottlenecks();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">TRAFFIC BOTTLENECK DETECTOR</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Automated Road Network Hotspot Ranking and Queue Length Statistics</p>
        </div>
      </div>

      {/* Advisory Banner: #FFF5DD (Soft Amber) */}
      <div className="bg-[#FFF5DD] p-4 rounded border border-[#DCE4EA] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white border border-[#DCE4EA] text-[#B7791F] rounded shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-[#9A6B1E] font-mono uppercase">ADAPTIVE CONTROL ADJUSTMENTS</h4>
            <p className="text-[10px] text-[#9A6B1E] font-mono leading-relaxed mt-0.5">
              Signals override cycle green phase durations automatically on monitored links when bottleneck ratings exceed safety bounds.
            </p>
          </div>
        </div>
      </div>

      {/* Bottlenecks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bottlenecks.map((item, idx) => {
          let cardBg = 'bg-[#DFF1E5] border-[#C2E5D0] text-[#2E7D5B]'; // LOW (Pale Green)
          
          if (item.congestion_level === 'SEVERE') {
            cardBg = 'bg-[#F7DCDD] border-[#F3BFC0] text-[#C85D5D]'; // SEVERE (Pale Red)
          } else if (item.congestion_level === 'HIGH') {
            cardBg = 'bg-[#FBE3D3] border-[#F8CBB1] text-[#D17A4A]'; // HIGH (Pale Orange)
          } else if (item.congestion_level === 'MODERATE') {
            cardBg = 'bg-[#FFF1C9] border-[#FCE1A2] text-[#C49A4A]'; // MODERATE (Pale Yellow)
          }

          return (
            <div key={idx} className={`p-5 rounded border flex flex-col justify-between space-y-4 transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-sm ${cardBg}`}>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-white/80 border border-current">
                  RANK #{idx + 1}
                </span>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-white/80 border border-current">
                  {item.congestion_level}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-850">{item.location}</h3>
                <p className="text-[10px] font-mono text-slate-600 mt-0.5">{item.camera_name}</p>
              </div>

              <div className="p-3 bg-white/90 rounded border border-[#DCE4EA] space-y-2 font-mono text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>BOTTLENECK INDEX:</span>
                  <span className="font-bold text-slate-805">{item.bottleneck_score} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>VEHICLE QUEUE:</span>
                  <span className="font-bold text-slate-805">{item.queue_length} veh/lane</span>
                </div>
                <div className="flex justify-between">
                  <span>ACTIVE VOLUME:</span>
                  <span className="font-bold text-slate-850">{item.vehicle_count} active</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
