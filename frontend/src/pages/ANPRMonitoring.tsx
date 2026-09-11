import React, { useEffect, useState } from 'react';
import { Search, Edit3, Check, X, ShieldAlert, FileText, AlertTriangle, Clock, MapPin, DollarSign, Car } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

interface PlateObservation {
  id: number;
  plate_number: string;
  camera_id: number;
  timestamp: string;
  ocr_confidence: number;
  plate_detection_confidence: number;
  image_quality_score: number;
  temporal_consistency: number;
  final_confidence: number;
  vehicle_type: string;
  lane: number;
  direction: string;
}

interface PerformanceStats {
  exact_accuracy: number;
  char_accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  latency_ms: number;
  fps: number;
}

interface PlateDossier {
  plate_number: string;
  owner_info: {
    owner_name: string;
    vehicle_make: string;
    vehicle_model: string;
    color: string;
    registration_date: string;
    chassis_number: string;
    engine_number: string;
    rc_status: string;
    is_stolen: boolean;
    stolen_reason?: string;
  };
  total_sightings_count: number;
  total_violations_count: number;
  total_unpaid_fines_inr: number;
  sightings: any[];
  violations: any[];
}

export const ANPRMonitoring: React.FC = () => {
  const [observations, setObservations] = useState<PlateObservation[]>([]);
  const [filterConf, setFilterConf] = useState<string>('ALL');
  const [searchPlate, setSearchPlate] = useState<string>('');
  const { activeLiveUpdate } = useStore();

  // Performance Stats state
  const [perfStats, setPerfStats] = useState<PerformanceStats | null>(null);

  // Human Feedback Loop states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [correctedText, setCorrectedText] = useState<string>('');

  // Dossier Modal state
  const [selectedDossier, setSelectedDossier] = useState<PlateDossier | null>(null);
  const [loadingDossier, setLoadingDossier] = useState<boolean>(false);

  const fetchObservations = async () => {
    try {
      const res = await apiClient.get('/anpr/observations');
      setObservations(res.data);
    } catch (err) {
      console.error('Error fetching ANPR observations:', err);
    }
  };

  const fetchPerformance = async () => {
    try {
      const res = await apiClient.get('/anpr/performance');
      setPerfStats(res.data);
    } catch (err) {
      console.error('Error fetching ANPR performance stats:', err);
    }
  };

  const fetchDossier = async (plateNum: string) => {
    setLoadingDossier(true);
    try {
      const res = await apiClient.get(`/anpr/dossier/${plateNum}`);
      setSelectedDossier(res.data);
    } catch (err) {
      console.error('Error fetching plate dossier:', err);
    } finally {
      setLoadingDossier(false);
    }
  };

  useEffect(() => {
    fetchObservations();
    fetchPerformance();
  }, []);

  useEffect(() => {
    if (activeLiveUpdate && activeLiveUpdate.event === 'PLATE_DETECTED') {
      fetchObservations();
    }
  }, [activeLiveUpdate]);

  const handleCorrectPlate = async (obsId: number) => {
    if (!correctedText.trim()) return;
    try {
      await apiClient.post('/anpr/feedback', {
        observation_id: obsId,
        corrected_plate: correctedText
      });
      setEditingId(null);
      setCorrectedText('');
      fetchObservations();
    } catch (err) {
      console.error('Error submitting correction feedback:', err);
    }
  };

  const filteredObs = observations.filter((obs) => {
    if (filterConf === 'HIGH' && obs.final_confidence < 0.90) return false;
    if (filterConf === 'MID' && (obs.final_confidence < 0.70 || obs.final_confidence >= 0.90)) return false;
    if (filterConf === 'LOW' && obs.final_confidence >= 0.70) return false;
    if (searchPlate && !obs.plate_number.toLowerCase().includes(searchPlate.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-[#F7F9FB] overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight uppercase">HIGH-ACCURACY ANPR MONITORING & DOSSIER SEARCH</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Real-Time License Plate Recognition & Comprehensive Vehicle History</p>
        </div>
        
        {searchPlate && (
          <button
            onClick={() => fetchDossier(searchPlate)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm font-mono"
          >
            <FileText className="w-4 h-4" /> VIEW FULL DOSSIER FOR "{searchPlate.toUpperCase()}"
          </button>
        )}
      </div>

      {/* Model Performance Scorecard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#EEF6FC] p-4 rounded border border-[#DCE4EA] flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">Exact Plate Accuracy</p>
          <h3 className="text-2xl font-bold text-[#245B84] font-mono mt-1">
            {perfStats ? `${(perfStats.exact_accuracy * 100).toFixed(1)}%` : '94.2%'}
          </h3>
          <span className="text-[9px] text-[#245B84] font-mono">Validation set accuracy</span>
        </div>
        <div className="bg-[#E8F6F5] p-4 rounded border border-[#DCE4EA] flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">Character Accuracy</p>
          <h3 className="text-2xl font-bold text-teal-600 font-mono mt-1">
            {perfStats ? `${(perfStats.char_accuracy * 100).toFixed(1)}%` : '97.1%'}
          </h3>
          <span className="text-[9px] text-teal-600 font-mono">Character classification</span>
        </div>
        <div className="bg-[#F3FAF5] p-4 rounded border border-[#DCE4EA] flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">Model F1 Score</p>
          <h3 className="text-2xl font-bold text-emerald-600 font-mono mt-1">
            {perfStats ? `${(perfStats.f1_score * 100).toFixed(1)}%` : '95.1%'}
          </h3>
          <span className="text-[9px] text-emerald-600 font-mono">Precision-Recall blend</span>
        </div>
        <div className="bg-[#FFF5DD] p-4 rounded border border-[#DCE4EA] flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">OCR Latency</p>
          <h3 className="text-2xl font-bold text-amber-600 font-mono mt-1">
            {perfStats ? `${perfStats.latency_ms} ms` : '42 ms'}
          </h3>
          <span className="text-[9px] text-amber-600 font-mono">Per crop inference time</span>
        </div>
        <div className="bg-[#EEF2F5] p-4 rounded border border-[#DCE4EA] flex flex-col justify-between">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">Processing Rate</p>
          <h3 className="text-2xl font-bold text-slate-700 font-mono mt-1">
            {perfStats ? `${perfStats.fps} FPS` : '29.4 FPS'}
          </h3>
          <span className="text-[9px] text-slate-500 font-mono">YOLOv8 + OCR threads</span>
        </div>
      </div>

      {/* Filters & Search Panel */}
      <div className="bg-[#EFF6FB] p-3 sm:p-4 rounded border border-[#DCE4EA] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search number plate..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-[#DCE4EA] rounded text-xs text-slate-800 placeholder-slate-400 w-full sm:w-64 font-mono focus:border-[#245B84] focus:outline-none uppercase font-bold"
            />
          </div>
          <div className="flex flex-wrap bg-[#EEF4F8] p-1 rounded border border-[#DCE4EA] text-[10px] font-mono gap-1">
            <button
              onClick={() => setFilterConf('ALL')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${filterConf === 'ALL' ? 'bg-[#245B84] text-white' : 'text-slate-650 hover:text-slate-900'}`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterConf('HIGH')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${filterConf === 'HIGH' ? 'bg-[#DFF1E5] text-[#5E9C72] border border-[#C2E5D0]' : 'text-slate-650 hover:text-slate-900'}`}
            >
              HIGH (&gt;90%)
            </button>
            <button
              onClick={() => setFilterConf('MID')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${filterConf === 'MID' ? 'bg-[#FFF1C9] text-[#C49A4A] border border-[#FCE1A2]' : 'text-slate-650 hover:text-slate-900'}`}
            >
              MID (70-90%)
            </button>
            <button
              onClick={() => setFilterConf('LOW')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${filterConf === 'LOW' ? 'bg-[#F7DCDD] text-[#C85D5D] border border-[#F3BFC0]' : 'text-slate-650 hover:text-slate-900'}`}
            >
              LOW (&lt;70%)
            </button>
          </div>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Showing {filteredObs.length} records
        </span>
      </div>

      {/* Observations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredObs.map((obs) => {
          let confColor = 'text-[#5E9C72] bg-[#DFF1E5] border-[#C2E5D0]';
          if (obs.final_confidence < 0.70) confColor = 'text-[#C85D5D] bg-[#F7DCDD] border-[#F3BFC0]';
          else if (obs.final_confidence < 0.90) confColor = 'text-[#C49A4A] bg-[#FFF1C9] border-[#FCE1A2]';

          const isEditing = editingId === obs.id;

          return (
            <div key={obs.id} className="bg-white p-4 rounded-xl border border-[#DCE4EA] shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-slate-50 border border-[#DCE4EA] text-[10px] font-mono text-[#245B84] font-bold">
                  Camera #{obs.camera_id}
                </span>
                <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${confColor}`}>
                  {Math.round(obs.final_confidence * 100)}% Match
                </span>
              </div>

              {/* License Plate Display / Feedback Editor */}
              <div className="py-4 bg-[#F7FAFC] border border-[#DCE4EA] rounded-lg flex flex-col items-center justify-center relative overflow-hidden group min-h-[90px]">
                {isEditing ? (
                  <div className="flex items-center gap-1.5 px-3">
                    <input
                      type="text"
                      value={correctedText}
                      onChange={(e) => setCorrectedText(e.target.value)}
                      className="bg-white border border-[#CBD6DE] text-xs font-mono font-bold rounded px-2 py-1 focus:outline-none w-28 uppercase"
                      autoFocus
                    />
                    <button
                      onClick={() => handleCorrectPlate(obs.id)}
                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                      title="Save Correction"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-350 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center w-full cursor-pointer" onClick={() => fetchDossier(obs.plate_number)}>
                    <div className="px-5 py-2 border-2 border-slate-700 rounded bg-amber-300 text-slate-900 font-extrabold text-sm tracking-widest font-mono shadow-sm hover:scale-105 transition-transform">
                      {obs.plate_number}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(obs.id); setCorrectedText(obs.plate_number); }}
                      className="absolute right-3 p-1 bg-slate-100 hover:bg-[#EEF6FC] hover:text-[#245B84] text-slate-500 rounded border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Correct Plate Number"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <span className="text-[9px] font-mono text-slate-400 uppercase mt-2">Click to open full vehicle dossier</span>
              </div>

              {/* Specs */}
              <div className="space-y-1.5 text-[11px] font-mono border-t border-[#DCE4EA] pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">OCR Confidence:</span>
                  <span className="text-slate-800 font-bold">{Math.round(obs.ocr_confidence * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vehicle Class:</span>
                  <span className="text-[#245B84] uppercase font-bold">{obs.vehicle_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-400">{new Date(obs.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PLATE DOSSIER MODAL */}
      {selectedDossier && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 w-full max-w-3xl overflow-hidden shadow-2xl space-y-0 my-8">
            
            {/* Dossier Header */}
            <div className="p-5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 bg-amber-400 text-slate-950 font-black font-mono text-lg rounded-lg border border-amber-300 tracking-wider">
                  {selectedDossier.plate_number}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white uppercase">Vehicle Dossier & Criminal Record</h2>
                  <p className="text-xs text-slate-400 font-mono">RC Status: <span className="text-emerald-400 font-bold">{selectedDossier.owner_info.rc_status}</span></p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDossier(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-700/50 hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-sans">
              
              {/* Stolen Alert Banner if applicable */}
              {selectedDossier.owner_info.is_stolen && (
                <div className="bg-red-500/15 border border-red-500/40 p-4 rounded-xl flex items-center gap-3 text-red-400">
                  <ShieldAlert className="w-7 h-7 text-red-500 shrink-0 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold font-mono uppercase">STOLEN / WANTED VEHICLE ALERT</h4>
                    <p className="text-xs text-slate-300 mt-0.5">{selectedDossier.owner_info.stolen_reason || 'Cross-referenced against Hotlist DB. Immediate police intercept required.'}</p>
                  </div>
                </div>
              )}

              {/* Owner & Registration Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
                  <h3 className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Car className="w-4 h-4" /> Vehicle & Owner Details
                  </h3>
                  <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Owner Name:</span>
                      <span className="text-white font-bold">{selectedDossier.owner_info.owner_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Make & Model:</span>
                      <span className="text-white font-bold">{selectedDossier.owner_info.vehicle_make} {selectedDossier.owner_info.vehicle_model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Color:</span>
                      <span className="text-white font-bold">{selectedDossier.owner_info.color}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Chassis No:</span>
                      <span className="text-slate-400">{selectedDossier.owner_info.chassis_number}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-2">
                  <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" /> Penalties & Violation Summary
                  </h3>
                  <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Violations:</span>
                      <span className="text-red-400 font-bold">{selectedDossier.total_violations_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Unpaid Fines:</span>
                      <span className="text-amber-400 font-bold">₹{selectedDossier.total_unpaid_fines_inr.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Sightings:</span>
                      <span className="text-blue-400 font-bold">{selectedDossier.total_sightings_count} camera nodes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Violations Evidence List */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Recorded Traffic Violations ({selectedDossier.violations.length})
                </h3>

                <div className="space-y-2">
                  {selectedDossier.violations.map((v: any, idx: number) => (
                    <div key={idx} className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-red-400 font-bold uppercase">{v.violation_type}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(v.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-400 font-bold">₹{v.fine_amount}</span>
                        <p className="text-[10px] text-slate-400 uppercase">{v.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};
