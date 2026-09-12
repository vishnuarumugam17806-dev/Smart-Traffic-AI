import React, { useEffect, useState } from 'react';
import { ShieldAlert, Plus, Trash2, Bell, Shield, Lock } from 'lucide-react';
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

interface WatchlistEntry {
  id: number;
  plate: string;
  reason: string;
  created_by: string;
  created_at: string;
  status: string;
  notes?: string;
}

import { FALLBACK_ALERTS } from '../api/mockFallback';

export const Alerts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'WATCHLIST'>('ALERTS');
  const [alerts, setAlerts] = useState<Alert[]>(FALLBACK_ALERTS as any);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([
    { id: 1, plate: "TN01AB1234", reason: "Suspected Stolen Vehicle", created_by: "Traffic Control ACP", created_at: new Date(Date.now() - 86400000).toISOString(), status: "ACTIVE", notes: "Flagged in Anna Salai FIR-2026/89" },
    { id: 2, plate: "KA05MN3821", reason: "Hit and Run Warrant", created_by: "Central Police Station", created_at: new Date(Date.now() - 172800000).toISOString(), status: "ACTIVE", notes: "Multiple signal violations and hit-and-run incident" },
    { id: 3, plate: "DL02CP9012", reason: "Excessive Speed Repeat Offender", created_by: "Expressway Traffic Cell", created_at: new Date(Date.now() - 259200000).toISOString(), status: "ACTIVE", notes: "Recorded speeds > 140 km/h on GST Road" }
  ]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  
  // New Watchlist Entry Form
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newReason, setNewReason] = useState<string>('Stolen Vehicle Investigation');
  const [newNotes, setNewNotes] = useState<string>('');

  const { activeLiveUpdate } = useStore();

  const fetchAlerts = async () => {
    try {
      const res = await apiClient.get('/alerts');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAlerts(res.data);
      }
    } catch (err) {
      console.warn('Using resilient active alerts while backend connects:', err);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const res = await apiClient.get('/blacklist');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setWatchlist(res.data);
      }
    } catch (err) {
      console.warn('Using resilient watchlist while backend connects:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchWatchlist();
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

  const handleAddToWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;
    try {
      await apiClient.post('/blacklist', {
        plate: newPlate.toUpperCase().replace(' ', ''),
        reason: newReason,
        notes: newNotes
      });
      setShowAddModal(false);
      setNewPlate('');
      setNewNotes('');
      fetchWatchlist();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add plate to watchlist.');
    }
  };

  const handleRemoveFromWatchlist = async (id: number) => {
    if (!window.confirm('Remove vehicle from active watchlist?')) return;
    try {
      await apiClient.delete(`/blacklist/${id}`);
      fetchWatchlist();
    } catch (err) {
      console.error('Error removing from watchlist:', err);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-[#FAF7F6] min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight uppercase">ALERTS & WATCHLIST CENTER</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Real-Time Threat Watchlist Matches, Speed Events & Route Anomalies</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white p-1 rounded-lg border border-[#DCE4EA] text-xs font-mono font-bold select-none">
          <button
            onClick={() => setActiveTab('ALERTS')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'ALERTS' ? 'bg-[#245B84] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> LIVE ALERTS ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('WATCHLIST')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'WATCHLIST' ? 'bg-[#245B84] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> CONTROLLED WATCHLIST ({watchlist.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE ALERTS */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-4">
          {/* Severity Filter */}
          <div className="bg-white p-3.5 sm:p-4 rounded-lg border border-[#DCE4EA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
              Showing {filteredAlerts.length} alarm events
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
                  className={`p-4 sm:p-5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-transform duration-200 hover:shadow-xs ${cardBg}`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="mt-1 p-2 rounded bg-white border border-[#DCE4EA] text-slate-500 shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded border ${tagColor}`}>
                          {alert.type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 leading-relaxed">{alert.message}</p>
                      <p className="text-[10px] font-mono text-slate-500">
                        Location: <span className="text-slate-700 font-semibold">{alert.location || 'N/A'}</span> | Target Vehicle: <span className="text-[#245B84] font-bold">{alert.vehicle_plate || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions & Status controller */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    <div className="text-right font-mono text-[9px] space-y-0.5">
                      <p className="text-slate-400 uppercase">STATUS</p>
                      <p className="font-bold text-slate-800 uppercase">{alert.status}</p>
                    </div>

                    <div className="flex bg-white p-0.5 rounded border border-[#DCE4EA] text-[9px] font-mono select-none shadow-2xs">
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
      )}

      {/* TAB 2: CONTROLLED VEHICLE WATCHLIST */}
      {activeTab === 'WATCHLIST' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h2 className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#245B84]" /> AUTHORIZED VEHICLE WATCHLIST
              </h2>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Plates on this list generate immediate CRITICAL alarms upon camera detection.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-mono font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" /> Add Watchlist Vehicle
            </button>
          </div>

          {/* Watchlist Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((entry) => (
              <div key={entry.id} className="bg-white p-4 rounded-lg border border-[#DCE4EA] shadow-xs space-y-3 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-mono font-extrabold rounded tracking-wider">
                      {entry.plate}
                    </span>
                    <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                      Added: {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]">
                    {entry.status}
                  </span>
                </div>

                <div className="p-2.5 bg-[#F6F8FA] rounded border border-[#DCE4EA] text-xs font-mono space-y-1">
                  <p><span className="text-slate-400">Reason:</span> <b className="text-slate-800">{entry.reason}</b></p>
                  {entry.notes && <p className="text-slate-600 text-[11px]"><span className="text-slate-400">Notes:</span> {entry.notes}</p>}
                </div>

                <div className="flex items-center justify-between border-t border-[#DCE4EA] pt-2.5">
                  <span className="text-[10px] font-mono text-slate-400">By: {entry.created_by}</span>
                  <button
                    onClick={() => handleRemoveFromWatchlist(entry.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove from Watchlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Watchlist Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-md w-full border border-[#DCE4EA] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-mono font-bold text-sm text-slate-800 uppercase flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#245B84]" /> Add Vehicle to Watchlist
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddToWatchlist} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">License Plate Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TN01AB1234"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  className="w-full bg-[#F6F8FA] border border-[#DCE4EA] rounded p-2.5 text-xs text-slate-800 font-bold uppercase focus:border-[#245B84] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reason / Case Reference</label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-[#F6F8FA] border border-[#DCE4EA] rounded p-2.5 text-xs text-slate-800 focus:border-[#245B84] focus:outline-none"
                >
                  <option value="Stolen Vehicle Investigation">Stolen Vehicle Investigation</option>
                  <option value="Hit-and-Run Suspect">Hit-and-Run Suspect</option>
                  <option value="Wanted Flagged Record">Wanted Flagged Record</option>
                  <option value="Speeding / Traffic Offense Priority">Speeding / Traffic Offense Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Optional case reference notes..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-[#F6F8FA] border border-[#DCE4EA] rounded p-2.5 text-xs text-slate-800 focus:border-[#245B84] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#245B84] text-white font-bold rounded hover:bg-[#1E4A6F]"
                >
                  Save Watchlist Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

