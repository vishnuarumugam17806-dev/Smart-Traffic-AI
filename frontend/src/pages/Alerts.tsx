import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Bell,
  Shield,
  Lock,
  Radio,
  MapPin,
  Navigation,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  SlidersHorizontal,
  ChevronRight,
  Filter
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { DetailDrawer } from '../components/DetailDrawer';
import { Alert } from '../types';

interface WatchlistEntry {
  id: number;
  plate: string;
  reason: string;
  created_by: string;
  created_at: string;
  status: string;
  notes?: string;
  total_crossings?: number;
  last_crossing_location?: string;
  last_crossing_time?: string;
  sighted?: boolean;
}

export const Alerts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'WATCHLIST'>('ALERTS');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  // New Watchlist Entry Form
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newReason, setNewReason] = useState<string>('Stolen Vehicle Investigation');
  const [newLocation, setNewLocation] = useState<string>('Anna Salai - Spencers Junction');
  const [newNotes, setNewNotes] = useState<string>('');

  const { activeLiveUpdate } = useStore();

  const fetchAlerts = async () => {
    try {
      const res = await apiClient.get('/alerts');
      if (Array.isArray(res.data)) {
        setAlerts(res.data);
      }
    } catch (err) {
      console.warn('Backend alerts error:', err);
    }
  };

  const fetchWatchlist = async () => {
    try {
      const res = await apiClient.get('/blacklist');
      if (Array.isArray(res.data)) {
        setWatchlist(res.data);
      }
    } catch (err) {
      console.warn('Backend watchlist error:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchWatchlist();
    const interval = setInterval(fetchAlerts, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeLiveUpdate && activeLiveUpdate.event === 'ALERT_CREATED') {
      if (activeLiveUpdate.alert) {
        setAlerts((prev) => [activeLiveUpdate.alert, ...prev.filter((a: any) => a.id !== activeLiveUpdate.alert.id)]);
      }
      fetchAlerts();
    }
  }, [activeLiveUpdate]);

  const handleUpdateStatus = async (alertId: number, nextStatus: string) => {
    try {
      await apiClient.put(`/alerts/${alertId}`, { status: nextStatus });
      if (selectedAlert && selectedAlert.id === alertId) {
        setSelectedAlert({ ...selectedAlert, status: nextStatus });
      }
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
        location: newLocation,
        notes: newNotes
      });
      setShowAddModal(false);
      setNewPlate('');
      setNewNotes('');
      fetchWatchlist();
      fetchAlerts();
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

  // Distinct alert types for filter dropdown
  const alertTypes = Array.from(new Set(alerts.map((a) => a.type).filter(Boolean)));

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    if (filterType !== 'ALL' && a.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPlate = a.vehicle_plate?.toLowerCase().includes(q);
      const matchLoc = a.location?.toLowerCase().includes(q);
      const matchMsg = a.message?.toLowerCase().includes(q);
      const matchType = a.type?.toLowerCase().includes(q);
      if (!matchPlate && !matchLoc && !matchMsg && !matchType) return false;
    }
    return true;
  });

  return (
    <div className="p-3 sm:p-5 space-y-4 bg-[#FAF7F6] min-h-screen font-sans select-none">
      {/* Page Header */}
      <PageHeader
        title="Alerts & Security"
        subtitle="Security alarms, automated violation detections, and watchlist enforcement"
        badge={
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-700 border border-rose-200">
            {alerts.filter((a) => a.severity === 'CRITICAL').length} CRITICAL
          </span>
        }
        actions={
          <div className="flex bg-white p-0.5 rounded-lg border border-[#DCE4EA] text-xs font-semibold select-none shadow-2xs">
            <button
              onClick={() => setActiveTab('ALERTS')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'ALERTS' ? 'bg-[#245B84] text-white shadow-2xs font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-3.5 h-3.5" /> Live Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('WATCHLIST')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'WATCHLIST' ? 'bg-[#245B84] text-white shadow-2xs font-bold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Watchlist ({watchlist.length})
            </button>
          </div>
        }
      />

      {/* TAB 1: LIVE ALERTS */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-4">
          {/* Progressive Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-[#DCE4EA] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-500 font-mono text-[11px] uppercase mr-1">SEVERITY:</span>
              <div className="flex bg-[#F8FAFC] p-0.5 rounded-lg border border-[#DCE4EA]">
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold transition-all cursor-pointer ${
                      filterSeverity === sev
                        ? sev === 'CRITICAL'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : sev === 'HIGH'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-[#245B84] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {alertTypes.length > 0 && (
                <div className="flex items-center gap-1.5 ml-2">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#245B84] cursor-pointer"
                  >
                    <option value="ALL">All Event Types</option>
                    {alertTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plate, location, incident..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#245B84]"
              />
            </div>
          </div>

          {/* Compact Alerts List */}
          {filteredAlerts.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="NO ACTIVE ALERTS"
              description={
                alerts.length === 0
                  ? 'No security alerts or violation incidents currently registered in the system.'
                  : 'No alerts match your current filter settings. Try adjusting severity or search keywords.'
              }
              action={
                filterSeverity !== 'ALL' || filterType !== 'ALL' || searchQuery ? (
                  <button
                    onClick={() => {
                      setFilterSeverity('ALL');
                      setFilterType('ALL');
                      setSearchQuery('');
                    }}
                    className="px-3 py-1.5 bg-[#245B84] text-white rounded-lg text-xs font-semibold hover:bg-[#1b4666] transition-colors cursor-pointer"
                  >
                    Reset Filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map((alert) => {
                let sevBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                let dotColor = 'bg-blue-500';

                if (alert.severity === 'CRITICAL') {
                  sevBadge = 'bg-rose-50 text-rose-700 border-rose-200';
                  dotColor = 'bg-rose-500 animate-pulse';
                } else if (alert.severity === 'HIGH') {
                  sevBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                  dotColor = 'bg-amber-500';
                }

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className="p-3 sm:p-4 bg-white hover:bg-slate-50 border border-[#DCE4EA] hover:border-[#245B84] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all shadow-2xs cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-slate-50 border border-[#DCE4EA] text-slate-600 shrink-0 group-hover:text-[#245B84]">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-extrabold border ${sevBadge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            {alert.severity}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {alert.type}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 leading-snug">{alert.message}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500">
                          {alert.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {alert.location}
                            </span>
                          )}
                          {alert.vehicle_plate && (
                            <span className="text-[#245B84] font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {alert.vehicle_plate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Status */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center" onClick={(e) => e.stopPropagation()}>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          alert.status === 'RESOLVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : alert.status === 'ACKNOWLEDGED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {alert.status}
                      </span>

                      <button
                        onClick={() => setSelectedAlert(alert)}
                        className="p-1.5 text-slate-400 hover:text-[#245B84] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Inspect Incident Details"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTROLLED VEHICLE WATCHLIST */}
      {activeTab === 'WATCHLIST' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <h2 className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#245B84]" /> AUTHORIZED VEHICLE WATCHLIST
              </h2>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Vehicles flagged for immediate security alerts upon ANPR camera sighting
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-[#245B84] hover:bg-[#1b4666] text-white font-mono font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Watchlist Vehicle
            </button>
          </div>

          {watchlist.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="WATCHLIST IS EMPTY"
              description="No license plates are currently enrolled in the security watchlist."
              action={
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-1.5 bg-[#245B84] text-white rounded-lg text-xs font-semibold hover:bg-[#1b4666] transition-colors cursor-pointer"
                >
                  Add First Plate
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {watchlist.map((entry) => (
                <div key={entry.id} className="bg-white p-4 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-3 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-mono font-extrabold rounded-md tracking-wider">
                        {entry.plate}
                      </span>
                      <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                        Added: {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {entry.status}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA] text-xs font-sans space-y-1">
                    <p className="font-semibold text-slate-800">{entry.reason}</p>
                    {entry.notes && <p className="text-slate-500 text-[11px]">{entry.notes}</p>}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#DCE4EA] pt-2.5">
                    <Link
                      to={`/trajectories?plate=${entry.plate}`}
                      className="text-[11px] font-mono font-bold text-[#245B84] hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Track Crossings →
                    </Link>
                    <button
                      onClick={() => handleRemoveFromWatchlist(entry.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove from Watchlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL DRAWER FOR ALERT INSPECTION */}
      <DetailDrawer
        isOpen={selectedAlert !== null}
        onClose={() => setSelectedAlert(null)}
        title="INCIDENT DETAILS"
        subtitle={selectedAlert ? `Alert #${selectedAlert.id} • ${selectedAlert.type}` : ''}
        footer={
          selectedAlert ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] font-mono text-slate-400">
                STATUS: <strong className="text-slate-700">{selectedAlert.status}</strong>
              </span>
              <div className="flex items-center gap-2">
                {selectedAlert.status === 'NEW' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'ACKNOWLEDGED')}
                    className="px-3 py-1.5 bg-[#245B84] hover:bg-[#1b4666] text-white rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    Acknowledge
                  </button>
                )}
                {selectedAlert.status !== 'RESOLVED' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedAlert.id, 'RESOLVED')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedAlert && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-500">SEVERITY LEVEL</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                    selectedAlert.severity === 'CRITICAL'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : selectedAlert.severity === 'HIGH'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}
                >
                  {selectedAlert.severity}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 leading-snug">{selectedAlert.message}</p>
            </div>

            {/* Target Plate Card */}
            {selectedAlert.vehicle_plate && (
              <div className="p-3 bg-white rounded-xl border border-[#DCE4EA] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">VEHICLE PLATE</span>
                  <span className="text-base font-mono font-black text-slate-900 tracking-wider">
                    {selectedAlert.vehicle_plate}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/trajectories?plate=${selectedAlert.vehicle_plate}`}
                    className="px-2.5 py-1 text-xs font-mono font-semibold text-[#245B84] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                  >
                    Track Path
                  </Link>
                  <Link
                    to="/anpr"
                    className="px-2.5 py-1 text-xs font-mono font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
                  >
                    ANPR
                  </Link>
                </div>
              </div>
            )}

            {/* Telemetry metadata */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400">INCIDENT ID</span>
                <span className="font-bold text-slate-700">#{selectedAlert.id}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400">EVENT TYPE</span>
                <span className="font-bold text-slate-700">{selectedAlert.type}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-400">TIMESTAMP</span>
                <span className="font-bold text-slate-700">
                  {new Date(selectedAlert.timestamp).toLocaleString()}
                </span>
              </div>
              {selectedAlert.location && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400">LOCATION</span>
                  <span className="font-bold text-slate-700">{selectedAlert.location}</span>
                </div>
              )}
              {selectedAlert.camera_id && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400">CAMERA SOURCE</span>
                  <span className="font-bold text-slate-700">CAM #{selectedAlert.camera_id}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Add Watchlist Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-5 rounded-xl max-w-md w-full border border-[#DCE4EA] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#245B84]" /> Enrol Watchlist Vehicle
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddToWatchlist} className="space-y-3 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-600 uppercase mb-1">
                  License Plate Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. TN01AB1234"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-[#DCE4EA] rounded-lg font-mono font-bold uppercase text-slate-800 focus:outline-none focus:border-[#245B84]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-600 uppercase mb-1">
                  Enrolment Reason *
                </label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-[#DCE4EA] rounded-lg font-sans text-slate-800 focus:outline-none focus:border-[#245B84]"
                >
                  <option value="Stolen Vehicle Investigation">Stolen Vehicle Investigation</option>
                  <option value="Hit and Run Warrant">Hit and Run Warrant</option>
                  <option value="Excessive Speed Repeat Offender">Excessive Speed Repeat Offender</option>
                  <option value="Suspicious Corridor Activity">Suspicious Corridor Activity</option>
                  <option value="Court / Police Warrant Issued">Court / Police Warrant Issued</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-600 uppercase mb-1">
                  Reference Checkpoint
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-[#DCE4EA] rounded-lg text-slate-800 focus:outline-none focus:border-[#245B84]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-600 uppercase mb-1">
                  Internal Notes
                </label>
                <textarea
                  placeholder="Optional case reference or FIR number"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-[#DCE4EA] rounded-lg text-slate-800 focus:outline-none focus:border-[#245B84] h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#245B84] hover:bg-[#1b4666] text-white rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer"
                >
                  Enrol Plate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
