import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

interface Alert {
  id: number;
  type: string;
  severity: string;
  timestamp: string;
  camera_id: number | null;
  location: string | null;
  vehicle_plate: string | null;
  message: string;
  status: string;
  confidence: number;
}

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const { activeLiveUpdate } = useStore();

  const fetchAlerts = async () => {
    try {
      const res = await apiClient.get('/alerts');
      setAlerts(res.data);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (activeLiveUpdate && activeLiveUpdate.event === 'ALERT_CREATED') {
      fetchAlerts();
    }
  }, [activeLiveUpdate]);

  const handleUpdateStatus = async (alertId: number, nextStatus: string) => {
    try {
      await apiClient.put(`/alerts/${alertId}`, { status: nextStatus });
      fetchAlerts();
    } catch (err) {
      console.error('Error updating alert status:', err);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 bg-[#FAF7F6]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">ALERTS CENTER</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Real-Time Threat Watchlist Matches and Route Sequence Anomalies Log</p>
        </div>
      </div>

      {/* Severity Filter */}
      <div className="bg-white p-4 rounded border border-[#DCE4EA] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase">Filter Severity:</span>
          <div className="flex bg-[#F6F8FA] p-0.5 rounded border border-[#DCE4EA] text-[10px] font-mono">
            <button
              onClick={() => setFilterSeverity('ALL')}
              className={`px-3 py-1.5 rounded font-bold transition-colors ${filterSeverity === 'ALL' ? 'bg-[#245B84] text-white' : 'text-slate-650 hover:text-slate-900'}`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterSeverity('CRITICAL')}
              className={`px-3 py-1.5 rounded font-bold transition-colors ${filterSeverity === 'CRITICAL' ? 'bg-[#FCEBEC] text-[#B84A4A] border border-[#F5C2C2]' : 'text-slate-650 hover:text-slate-900'}`}
            >
              CRITICAL
            </button>
            <button
              onClick={() => setFilterSeverity('HIGH')}
              className={`px-3 py-1.5 rounded font-bold transition-colors ${filterSeverity === 'HIGH' ? 'bg-[#FFF5DD] text-[#9A6B1E] border border-[#FCE1A2]' : 'text-slate-650 hover:text-slate-900'}`}
            >
              HIGH
            </button>
            <button
              onClick={() => setFilterSeverity('MEDIUM')}
              className={`px-3 py-1.5 rounded font-bold transition-colors ${filterSeverity === 'MEDIUM' ? 'bg-[#EAF4FB] text-[#245B84] border border-[#DCEAF2]' : 'text-slate-650 hover:text-slate-900'}`}
            >
              MEDIUM
            </button>
          </div>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Active: {filteredAlerts.length} alarm event logs
        </span>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => {
          let cardBg = 'bg-[#F4F8FA] border-l-4 border-l-[#6A8FA8]'; // Normal/Medium
          let tagColor = 'text-slate-600 bg-slate-100 border-slate-200';

          if (alert.severity === 'CRITICAL') {
            cardBg = 'bg-[#FCEEEE] border-l-4 border-l-[#C85D5D] border-y border-r border-[#F3BFC0]';
            tagColor = 'text-[#C85D5D] bg-[#F7DCDD] border-[#F3BFC0]';
          } else if (alert.severity === 'HIGH') {
            cardBg = 'bg-[#FFF6E5] border-l-4 border-l-[#C49A4A] border-y border-r border-[#FCE1A2]';
            tagColor = 'text-[#C49A4A] bg-[#FFF1C9] border-[#FCE1A2]';
          } else if (alert.severity === 'MEDIUM') {
            cardBg = 'bg-[#F4F8FA] border-l-4 border-l-[#6A8FA8] border-y border-r border-[#DCEAF2]';
            tagColor = 'text-[#245B84] bg-[#EAF4FB] border-[#DCEAF2]';
          }

          return (
            <div
              key={alert.id}
              className={`p-5 rounded flex flex-col md:flex-row md:items-center justify-between gap-5 transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-sm ${cardBg}`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 p-2 rounded bg-white border border-[#DCE4EA] text-slate-500">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded border ${tagColor}`}>
                      {alert.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-450">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-805 leading-relaxed">{alert.message}</p>
                  <p className="text-[10px] font-mono text-slate-500">
                    Location: <span className="text-slate-700 font-semibold">{alert.location || 'N/A'}</span> | Target Vehicle: <span className="text-[#245B84] font-bold">{alert.vehicle_plate || 'N/A'}</span>
                  </p>
                </div>
              </div>

              {/* Actions & Status controller */}
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                <div className="text-right font-mono text-[9px] space-y-0.5">
                  <p className="text-slate-450 uppercase">STATUS</p>
                  <p className="font-bold text-slate-800 uppercase">{alert.status}</p>
                </div>

                <div className="flex bg-white p-0.5 rounded border border-[#DCE4EA] text-[9px] font-mono select-none shadow-sm">
                  {alert.status === 'NEW' && (
                    <button
                      onClick={() => handleUpdateStatus(alert.id, 'ACKNOWLEDGED')}
                      className="px-2.5 py-1 bg-[#245B84] hover:bg-[#1D4D70] text-white rounded font-bold transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status === 'ACKNOWLEDGED' && (
                    <button
                      onClick={() => handleUpdateStatus(alert.id, 'RESOLVED')}
                      className="px-2.5 py-1 bg-[#EAF7EF] hover:bg-[#D4EFDD] text-[#2E7D5B] border border-[#C2E5D0] rounded font-bold transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                  {alert.status === 'RESOLVED' && (
                    <span className="px-2.5 py-1 text-slate-400 font-semibold uppercase">
                      CLOSED
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
