import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../api/client';

interface RouteAnomalyItem {
  id: number;
  plate_number: string;
  reason: string;
  confidence: number;
  observed_route: string;
  expected_route: string | null;
  timestamp: string;
}

export const RouteAnomalies: React.FC = () => {
  const [anomalies, setAnomalies] = useState<RouteAnomalyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnomalies = async () => {
    try {
      const res = await apiClient.get('/anomalies');
      setAnomalies(res.data);
    } catch (err) {
      console.error('Error fetching route anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  return (
    <div className="p-6 space-y-6 bg-[#FAF7F5]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">ROUTE ANOMALY DETECTION</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Automated Sighting Checks for Suspicious Vehicle Transfer Speeds</p>
        </div>
      </div>

      {/* Grid of Anomalies */}
      <div className="space-y-3">
        {anomalies.map((item) => (
          <div key={item.id} className="bg-[#FFF5F5] p-5 border-l-4 border-l-[#C85D5D] border-y border-r border-[#F3BFC0] rounded flex flex-col md:flex-row md:items-center justify-between gap-5 transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white border border-[#DCE4EA] rounded text-[#C85D5D] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h3 className="font-extrabold text-sm text-slate-800 px-2 py-0.5 border border-[#DCE4EA] rounded bg-white font-mono">
                    {item.plate_number}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs font-semibold text-[#C85D5D] font-mono">{item.reason}</p>
                
                <div className="flex flex-col md:flex-row gap-x-6 text-[10px] font-mono text-slate-550">
                  <p>Observed Pathway: <span className="text-slate-800 font-bold">{item.observed_route}</span></p>
                  {item.expected_route && <p>Baseline Speed: <span className="text-slate-805 font-bold">{item.expected_route}</span></p>}
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] shrink-0 self-end md:self-center">
              <p className="text-slate-450 uppercase">TRIGGER CONFIDENCE</p>
              <p className="font-bold text-[#C85D5D] text-sm mt-0.5">{Math.round(item.confidence * 100)}% Match</p>
            </div>
          </div>
        ))}

        {anomalies.length === 0 && (
          <div className="p-6 text-center bg-white border border-[#DCE4EA] text-xs font-mono text-slate-500 rounded">
            Zero routing sequence anomalies identified in the network.
          </div>
        )}
      </div>
    </div>
  );
};
