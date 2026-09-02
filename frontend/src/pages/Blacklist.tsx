import React, { useEffect, useState } from 'react';
import { ShieldAlert, Plus, Trash2, UserCheck, Calendar } from 'lucide-react';
import { apiClient } from '../api/client';

interface BlacklistItem {
  id: number;
  plate: string;
  reason: string;
  created_by: string;
  created_at: string;
  status: string;
  notes: string | null;
}

export const Blacklist: React.FC = () => {
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [plate, setPlate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  const fetchBlacklist = async () => {
    try {
      const res = await apiClient.get('/blacklist');
      setBlacklist(res.data);
    } catch (err) {
      console.error('Error fetching blacklist:', err);
    }
  };

  useEffect(() => {
    fetchBlacklist();
  }, []);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiClient.post('/blacklist', {
        plate: plate.toUpperCase().replace(' ', ''),
        reason,
        notes
      });
      setShowModal(false);
      setPlate('');
      setReason('');
      setNotes('');
      fetchBlacklist();
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to register plate to watchlist.');
      }
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this plate from the watchlist?")) return;
    try {
      await apiClient.delete(`/blacklist/${id}`);
      fetchBlacklist();
    } catch (err) {
      console.error('Error deleting blacklist entry:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">BLACKLIST DATABASE</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Control Watchlist Registry for Autonomous Threat Sighting Alerts</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#245B84] hover:bg-[#1D4D70] text-white font-bold text-xs rounded flex items-center gap-2 transition-colors shadow-sm select-none"
        >
          <Plus className="w-4 h-4" /> Watch New Plate
        </button>
      </div>

      {/* Grid of registered plates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blacklist.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded border border-[#DCE4EA] flex flex-col justify-between space-y-4 transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 border-2 border-slate-400 rounded bg-[#F6F8FA] text-slate-800 font-extrabold text-xs tracking-wider font-mono shadow-sm">
                {item.plate}
              </span>
              <button
                onClick={() => handleDeleteEntry(item.id)}
                className="p-1.5 bg-[#FCEBEC] border border-[#F3BFC0] text-[#B84A4A] hover:bg-[#F3C2C4] rounded transition-colors"
                title="Remove from watchlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-800">{item.reason}</p>
              {item.notes && <p className="text-[10px] text-slate-500 font-mono italic">"{item.notes}"</p>}
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[9px] font-mono text-slate-400">
              <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> User: {item.created_by}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-[#142837]/18 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded w-full max-w-md border border-[#DCE4EA] shadow-xl space-y-4">
            {/* Modal Header: Pale Blue Banner */}
            <div className="p-3 bg-[#F6F8FA] border-b border-[#DCE4EA] rounded -mx-6 -mt-6 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#245B84]" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Watchlist Plate Registry</h3>
            </div>

            {error && (
              <p className="p-2.5 bg-[#FCEBEC] border border-[#F3BFC0] text-[#B84A4A] text-[10px] font-mono rounded">
                {error}
              </p>
            )}

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-650 mb-1">License Plate</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KA05MN3821"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  className="w-full bg-[#F6F8FA] border border-[#CBD6DE] rounded p-2.5 text-xs text-slate-800 uppercase font-mono focus:border-[#4A82A8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Reason for Flagging</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stolen Vehicle"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#F6F8FA] border border-[#CBD6DE] rounded p-2.5 text-xs text-slate-800 focus:border-[#4A82A8] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Additional Notes</label>
                <textarea
                  placeholder="Details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#F6F8FA] border border-[#CBD6DE] rounded p-2.5 text-xs text-slate-800 h-20 focus:border-[#4A82A8] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#EAF2F7] text-[#245B84] font-bold text-xs rounded hover:bg-[#D4E8F5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#245B84] text-white font-bold text-xs rounded hover:bg-[#1D4D70] transition-colors"
                >
                  Save Watchlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
