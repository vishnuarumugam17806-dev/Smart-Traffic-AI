import React, { useState } from 'react';
import { Search, Compass, MapPin, Video, Film, Map, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

interface TrajectoryTimelineItem {
  observation_id: number;
  camera_id: number;
  camera_name: string;
  location: string;
  timestamp: string;
  confidence: number;
  direction: string;
  lane: number;
  vehicle_type: string;
  anomaly: boolean;
  speed_kmh: number;
  location_source?: string;
  association_confidence?: string;
}

interface TrajectoryResult {
  plate_number: string;
  first_seen: string;
  last_seen: string;
  cameras_visited: number;
  duration_seconds: number;
  estimated_distance_km: number;
  average_speed_kmh: number;
  timeline: TrajectoryTimelineItem[];
  anomalies: any[];
}

export const VehicleSearch: React.FC = () => {
  const navigate = useNavigate();
  const [plate, setPlate] = useState<string>('');
  const [result, setResult] = useState<TrajectoryResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiClient.get(`/trajectories`, {
        params: { plate: plate.toUpperCase().replace(/\s+/g, '') }
      });
      setResult(res.data);
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setError('No sightings matching this license plate.');
      } else {
        setError('An error occurred during vehicle query search.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA] min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4 select-none">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">NUMBER PLATE SEARCH</h1>
          <p className="text-xs text-slate-500 font-sans mt-0.5">Search vehicle sightings across connected cameras</p>
        </div>
        <div className="px-3 py-1.5 rounded bg-[#EEF6FC] border border-[#DCE4EA] text-xs font-bold text-[#245B84] flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" /> Audited Search Mode
        </div>
      </div>

      {/* Audit Log Security Notice Banner */}
      <div className="p-3 bg-[#EEF6FC] border border-[#DCE4EA] text-[#245B84] text-[11px] font-mono rounded flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#2E7D5B]" />
          <span><b>RBAC ACCESS ACTIVE:</b> Every vehicle lookup is recorded in the system audit log with operator ID & timestamp.</span>
        </div>
        <span className="text-[10px] text-slate-400">LAST OBSERVED vs LIVE GPS INTEGRITY</span>
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1">
            <label className="block text-[9px] font-mono font-bold text-slate-500 uppercase">License Plate Number</label>
            <input
              type="text"
              required
              placeholder="e.g. TN01AB1234, KA05MN3821"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              className="w-full bg-white border border-[#DCE4EA] rounded-lg p-2.5 text-xs text-slate-850 placeholder-slate-400 font-mono focus:border-[#245B84] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-mono font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 min-w-[120px] select-none shadow-xs"
          >
            <Search className="w-4 h-4" /> {loading ? 'Querying...' : 'SEARCH VEHICLE'}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[#FFF5F5] border border-[#DCE4EA] text-[#C85D5D] text-xs font-mono rounded">
          {error}
        </div>
      )}

      {/* Trajectory Details */}
      {result && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 select-none">
            <div className="bg-white p-4 rounded-lg border border-[#DCE4EA]">
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">VEHICLE PLATE</p>
              <h3 className="text-base font-bold text-slate-800 font-mono mt-1.5 px-2 py-0.5 border border-[#245B84]/20 rounded bg-[#EEF6FC] text-[#245B84] inline-block">
                {result.plate_number}
              </h3>
            </div>
            <div className="bg-white p-4 rounded-lg border border-[#DCE4EA]">
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">CAMERAS VISITED</p>
              <h3 className="text-2xl font-bold text-[#245B84] font-mono mt-1">{result.cameras_visited} Nodes</h3>
            </div>
            <div className="bg-white p-4 rounded-lg border border-[#DCE4EA]">
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">ESTIMATED DISTANCE</p>
              <h3 className="text-2xl font-bold text-[#2E7D5B] font-mono mt-1">{result.estimated_distance_km} km</h3>
            </div>
            <div className="bg-white p-4 rounded-lg border border-[#DCE4EA]">
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">AVERAGE SPEED</p>
              <h3 className="text-2xl font-bold text-[#B7791F] font-mono mt-1">{result.average_speed_kmh} km/h</h3>
            </div>
            <div className="bg-white p-4 rounded-lg border border-[#DCE4EA]">
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">TRAVEL DURATION</p>
              <h3 className="text-2xl font-bold text-[#245B84] font-mono mt-1">{Math.round(result.duration_seconds)} sec</h3>
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-[#DCE4EA] select-none">
            <button
              onClick={() => navigate(`/trajectories?plate=${result.plate_number}`)}
              className="px-3 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-mono font-bold text-xs rounded flex items-center gap-1.5 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" /> VIEW TRAJECTORY
            </button>
            <button
              onClick={() => navigate(`/?plate=${result.plate_number}`)}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-[#DCE4EA] font-mono font-bold text-xs rounded flex items-center gap-1.5"
            >
              <Map className="w-3.5 h-3.5" /> VIEW ON MAP
            </button>
            <button
              onClick={() => navigate(`/cameras`)}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-[#DCE4EA] font-mono font-bold text-xs rounded flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" /> VIEW CAMERA
            </button>
            <button
              onClick={() => navigate(`/recordings`)}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-[#DCE4EA] font-mono font-bold text-xs rounded flex items-center gap-1.5"
            >
              <Film className="w-3.5 h-3.5" /> VIEW RECORDINGS
            </button>
          </div>

          {/* Chronological Event Timeline */}
          <div className="bg-white p-5 rounded-lg border border-[#DCE4EA] space-y-4">
            <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#245B84]" /> Sighting Timeline Log (Chronological Observations)
            </h2>

            <div className="relative border-l border-slate-200 pl-6 ml-4 space-y-5 py-2">
              {result.timeline.map((item, idx) => {
                const isEven = idx % 2 === 0;
                const cardBg = isEven ? 'bg-[#F6F8FA]' : 'bg-white';
                return (
                  <div key={idx} className="relative">
                    {/* Timeline Marker */}
                    <span className="absolute -left-[30px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white border-2 border-[#245B84] shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#245B84]" />
                    </span>

                    <div className={`p-4 rounded-lg border border-[#DCE4EA] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-transform duration-200 hover:-translate-y-[1px] ${cardBg}`}>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-800">{item.camera_name}</h4>
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-slate-100 border border-[#DCE4EA] text-slate-600">
                            {item.location}
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#EEF6FC] text-[#245B84] border border-[#245B84]/20">
                            {item.location_source || 'ANPR CAMERA'}
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]">
                            LAST OBSERVED LOCATION
                          </span>
                          {item.anomaly && (
                            <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-[#FCEEEF] text-[#B84A4A] border border-[#F8D7DA]">
                              SPEED ANOMALY DETECTED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-slate-500">
                          Sighted at {new Date(item.timestamp).toLocaleString()} | Lane {item.lane} | Direction: {item.direction}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono select-none">
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 uppercase">TRANSITION SPEED</p>
                          <p className="font-bold text-slate-800 mt-0.5">{item.speed_kmh > 0 ? `${item.speed_kmh} km/h` : 'Initial Sighting'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 uppercase font-bold">MATCH CONFIDENCE</p>
                          <p className="font-bold text-[#2E7D5B] mt-0.5">{Math.round(item.confidence * 100)}% HIGH</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
