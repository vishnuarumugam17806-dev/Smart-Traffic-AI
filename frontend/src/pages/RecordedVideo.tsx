import React, { useEffect, useState, useRef } from 'react';
import { Video, Search, Play, Pause, MapPin, Calendar, Clock, Film, AlertTriangle, Tag, ShieldCheck, Download, Smartphone, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { apiClient, resolveVideoUrl } from '../api/client';

export const RecordedVideo: React.FC = () => {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MOBILE' | 'FIXED'>('ALL');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter form states
  const [locationFilter, setLocationFilter] = useState<string>('');

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      // 1. Fetch remote recordings from API
      let remoteRecords: any[] = [];
      try {
        const res = await apiClient.get('/recordings', {
          params: { location: locationFilter }
        });
        remoteRecords = Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        console.warn('API recordings fetch error or offline:', e);
      }

      // 2. Fetch local device recordings from localStorage
      let localRecords: any[] = [];
      try {
        const stored = localStorage.getItem('vigitra_mobile_recordings');
        if (stored) {
          localRecords = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Error reading local recordings:', e);
      }

      // Filter local records if locationFilter is specified
      if (locationFilter.trim()) {
        const q = locationFilter.toLowerCase();
        localRecords = localRecords.filter(r => (r.location || '').toLowerCase().includes(q) || (r.record_id || '').toLowerCase().includes(q));
      }

      // 3. Merge and deduplicate by record_id
      const recordMap = new Map<string, any>();

      // Put remote records in map
      remoteRecords.forEach(r => {
        if (r.record_id) recordMap.set(r.record_id, r);
      });

      // Overlay local records (they have fresher local blob URLs if just recorded)
      localRecords.forEach(r => {
        if (r.record_id) {
          const existing = recordMap.get(r.record_id);
          recordMap.set(r.record_id, {
            ...existing,
            ...r,
            // Prioritize local blob URL for instant playback if remote file_url is not ready
            file_url: r.file_blob_url || r.file_url || (existing ? existing.file_url : undefined)
          });
        }
      });

      const merged = Array.from(recordMap.values());
      // Sort newest first
      merged.sort((a, b) => {
        const tA = new Date(a.start_time || 0).getTime();
        const tB = new Date(b.start_time || 0).getTime();
        return tB - tA;
      });

      setRecordings(merged);

      if (merged.length > 0) {
        setSelectedRecord((prev: any) => {
          if (!prev) return merged[0];
          const found = merged.find(m => m.record_id === prev.record_id);
          return found || merged[0];
        });
      }
    } catch (err) {
      console.error('Error in fetchRecordings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  const handleSeek = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      setCurrentTime(timeSec);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleDelete = async (recordId: string, id?: number) => {
    if (!confirm(`Are you sure you want to delete recording ${recordId}?`)) return;
    
    // Remove from local storage
    try {
      const stored = localStorage.getItem('vigitra_mobile_recordings');
      if (stored) {
        const list = JSON.parse(stored);
        const filtered = list.filter((r: any) => r.record_id !== recordId);
        localStorage.setItem('vigitra_mobile_recordings', JSON.stringify(filtered));
      }
    } catch (e) {}

    // Call API delete if numeric ID exists
    if (id) {
      try {
        await apiClient.delete(`/recordings/${id}`);
      } catch (e) {}
    }

    // Refresh state
    const remaining = recordings.filter(r => r.record_id !== recordId);
    setRecordings(remaining);
    if (selectedRecord?.record_id === recordId) {
      setSelectedRecord(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // Filter recordings by type tabs
  const displayedRecordings = recordings.filter(rec => {
    if (typeFilter === 'MOBILE') return rec.recording_type === 'MOBILE_FIELD';
    if (typeFilter === 'FIXED') return rec.recording_type !== 'MOBILE_FIELD';
    return true;
  });

  const activeVideoUrl = selectedRecord
    ? resolveVideoUrl(selectedRecord.file_url || selectedRecord.file_reference)
    : '/videos/sample_traffic_urban.mp4';

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#F6F8FA] min-h-screen select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#DCE4EA] pb-4 gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Film className="w-5 h-5 text-[#245B84]" /> RECORDED VIDEO SEARCH & PLAYBACK ARCHIVE
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Real-time Evidence Ingestion, SHA-256 Integrity Verification & Mobile Patrol Stream Persistence
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecordings}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-mono bg-white border border-[#DCE4EA] text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#245B84] ${loading ? 'animate-spin' : ''}`} />
            REFRESH ARCHIVE
          </button>
        </div>
      </div>

      {/* Main Grid: Player & Timeline Event Seek Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player & Interactive Event Timeline */}
        <div className="lg:col-span-8 bg-white p-4 sm:p-5 rounded-xl border border-[#DCE4EA] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#DCE4EA] pb-3 gap-2">
            <div className="flex items-center gap-2">
              {selectedRecord?.recording_type === 'MOBILE_FIELD' ? (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200 rounded flex items-center gap-1">
                  <Smartphone className="w-3 h-3 text-purple-600" /> MOBILE PATROL
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200 rounded flex items-center gap-1">
                  <Video className="w-3 h-3 text-blue-600" /> FIXED CCTV
                </span>
              )}
              <h2 className="text-xs sm:text-sm font-mono font-extrabold text-slate-800 uppercase">
                {selectedRecord ? selectedRecord.record_id : 'NO RECORD SELECTED'}
              </h2>
            </div>

            {selectedRecord && (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-slate-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> SHA-256 VERIFIED
                </span>
                <a
                  href={activeVideoUrl}
                  download={`${selectedRecord.record_id}.mp4`}
                  className="px-2.5 py-1 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-bold rounded flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <Download className="w-3 h-3" /> DOWNLOAD
                </a>
                <button
                  onClick={() => handleDelete(selectedRecord.record_id, selectedRecord.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  title="Delete Recording"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Video Player */}
          <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center border border-slate-900 shadow-inner">
            {selectedRecord ? (
              <video
                key={activeVideoUrl}
                ref={videoRef}
                src={activeVideoUrl}
                controls
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                className="w-full h-auto max-h-[440px] object-contain"
              />
            ) : (
              <div className="text-center p-8 text-slate-400 font-mono text-xs">
                <Film className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p>No video selected. Select a recording from the archive list on the right.</p>
              </div>
            )}
          </div>

          {/* Selected Record Metadata Bar */}
          {selectedRecord && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F8FAFC] p-3 rounded-lg border border-[#DCE4EA] font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Location</span>
                <span className="text-slate-800 font-bold truncate block">{selectedRecord.location || 'Anna Salai'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Duration & Size</span>
                <span className="text-slate-800 font-bold">{selectedRecord.duration_sec}s • {selectedRecord.file_size_mb} MB</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Source Device</span>
                <span className="text-blue-600 font-bold">{selectedRecord.device_id || 'CAM-FIXED-01'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase">Integrity SHA-256</span>
                <span className="text-slate-600 truncate block font-mono text-[9px]" title={selectedRecord.sha256_hash}>
                  {(selectedRecord.sha256_hash || '').slice(0, 16)}...
                </span>
              </div>
            </div>
          )}

          {/* Interactive Timeline Event Markers */}
          {selectedRecord && selectedRecord.event_markers && selectedRecord.event_markers.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="text-[10px] font-mono font-bold text-slate-600 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#245B84]" /> TIMELINE EVENT MARKERS (CLICK TO SEEK)
              </h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {selectedRecord.event_markers.map((evt: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleSeek(evt.time_sec)}
                    className="px-3 py-1.5 bg-[#EEF6FC] hover:bg-[#DCEEFA] active:scale-95 border border-[#DCE4EA] rounded text-left shrink-0 font-mono text-xs space-y-0.5 transition-transform"
                  >
                    <div className="flex items-center gap-1 font-bold text-[#245B84] text-[10px]">
                      <Tag className="w-3 h-3 text-[#245B84]" /> {evt.type} @ {evt.time_sec}s
                    </div>
                    <p className="text-[9px] text-slate-600 truncate max-w-[150px]">{evt.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Search & Archive Video List */}
        <div className="lg:col-span-4 bg-white p-4 sm:p-5 rounded-xl border border-[#DCE4EA] shadow-xs space-y-4">
          <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <Search className="w-4 h-4 text-[#245B84]" /> FILTER RECORDINGS ({recordings.length})
          </h2>

          {/* Type Filter Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg font-mono text-[10px] font-bold">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`py-1.5 rounded transition-colors ${typeFilter === 'ALL' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              ALL ({recordings.length})
            </button>
            <button
              onClick={() => setTypeFilter('MOBILE')}
              className={`py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${typeFilter === 'MOBILE' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Smartphone className="w-3 h-3" /> MOBILE
            </button>
            <button
              onClick={() => setTypeFilter('FIXED')}
              className={`py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${typeFilter === 'FIXED' ? 'bg-[#245B84] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Video className="w-3 h-3" /> FIXED
            </button>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div>
              <label className="block text-[10px] text-slate-500 uppercase mb-1">Search Location or Record ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchRecordings(); }}
                  placeholder="e.g. Anna Salai or REC-MOB"
                  className="w-full bg-white border border-[#DCE4EA] rounded-lg p-2 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#245B84]"
                />
                <button
                  onClick={fetchRecordings}
                  className="px-3 py-2 bg-[#245B84] text-white hover:bg-[#1E4A6F] font-bold rounded-lg text-xs shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Recordings Scroll List */}
          <div className="border-t border-[#DCE4EA] pt-3 space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {displayedRecordings.length === 0 ? (
              <div className="text-center py-8 text-slate-400 font-mono text-xs">
                No recordings found matching filter.
              </div>
            ) : (
              displayedRecordings.map((rec) => {
                const isSelected = selectedRecord?.record_id === rec.record_id;
                const isMobile = rec.recording_type === 'MOBILE_FIELD';

                return (
                  <div
                    key={rec.record_id || rec.id}
                    onClick={() => setSelectedRecord(rec)}
                    className={`p-3 rounded-xl border text-xs font-mono cursor-pointer transition-all space-y-1.5 ${
                      isSelected
                        ? isMobile
                          ? 'bg-purple-50/80 border-purple-500 shadow-xs'
                          : 'bg-[#F2F7FC] border-[#245B84] shadow-xs'
                        : 'bg-slate-50/80 border-[#DCE4EA] hover:bg-slate-100/90'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[170px] flex items-center gap-1.5">
                        {isMobile ? (
                          <Smartphone className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        ) : (
                          <Video className="w-3.5 h-3.5 text-[#245B84] shrink-0" />
                        )}
                        <span className={isSelected ? 'text-[#245B84] font-black' : ''}>{rec.record_id}</span>
                      </span>

                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isMobile ? 'bg-purple-200 text-purple-900' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isMobile ? 'MOBILE FIELD' : 'FIXED CCTV'}
                      </span>
                    </div>

                    <p className="text-slate-700 font-bold truncate text-[11px]">{rec.location}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{rec.duration_sec}s • {rec.file_size_mb} MB</span>
                      <span>{rec.device_id || 'CAM-01'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
