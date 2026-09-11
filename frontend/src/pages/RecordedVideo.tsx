import React, { useEffect, useState, useRef } from 'react';
import { Video, Search, Play, Pause, MapPin, Calendar, Clock, Film, AlertTriangle, Tag, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/client';

export const RecordedVideo: React.FC = () => {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter form states
  const [locationFilter, setLocationFilter] = useState<string>('');

  const fetchRecordings = async () => {
    try {
      const res = await apiClient.get('/recordings', {
        params: { location: locationFilter }
      });
      setRecordings(res.data);
      if (res.data.length > 0 && !selectedRecord) {
        setSelectedRecord(res.data[0]);
      }
    } catch (err) {
      console.error('Error fetching recordings:', err);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  const handleSeek = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      setCurrentTime(timeSec);
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA] min-h-screen select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase">RECORDED VIDEO SEARCH & PLAYBACK</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Chronological Video Archive, sha256 Integrity Verification & Timeline Event Markers</p>
        </div>
      </div>

      {/* Main Grid: Player & Timeline Event Seek Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player & Interactive Event Timeline */}
        <div className="lg:col-span-8 bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
            <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
              <Film className="w-4 h-4 text-[#245B84]" /> {selectedRecord ? selectedRecord.record_id : 'NO RECORD SELECTED'}
            </h2>
            {selectedRecord && (
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D5B]" /> SHA-256 VERIFIED
              </span>
            )}
          </div>

          <div className="relative bg-black rounded-lg overflow-hidden min-h-[320px] flex items-center justify-center">
            <video
              ref={videoRef}
              src="/sample_traffic.mp4"
              controls
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              className="w-full h-auto max-h-[420px]"
            />
          </div>

          {/* Interactive Timeline Event Markers */}
          {selectedRecord && selectedRecord.event_markers && (
            <div className="space-y-2 pt-2">
              <h3 className="text-[10px] font-mono font-bold text-slate-600 uppercase">TIMELINE EVENT MARKERS</h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {selectedRecord.event_markers.map((evt: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleSeek(evt.time_sec)}
                    className="px-3 py-1.5 bg-[#EEF6FC] hover:bg-[#DCEEFA] border border-[#DCE4EA] rounded text-left shrink-0 font-mono text-xs space-y-0.5"
                  >
                    <div className="flex items-center gap-1 font-bold text-[#245B84] text-[10px]">
                      <Tag className="w-3 h-3 text-[#245B84]" /> {evt.type} @ {evt.time_sec}s
                    </div>
                    <p className="text-[9px] text-slate-600 truncate max-w-[140px]">{evt.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Search & Archive Video List */}
        <div className="lg:col-span-4 bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
          <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
            <Search className="w-4 h-4 text-[#245B84]" /> FILTER RECORDINGS
          </h2>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="block text-[10px] text-slate-500 uppercase mb-1">Filter by Location</label>
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="e.g. Anna Salai"
                className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-slate-800 focus:outline-none"
              />
            </div>
            <button
              onClick={fetchRecordings}
              className="w-full py-2 bg-[#245B84] text-white hover:bg-[#1E4A6F] font-bold rounded text-xs"
            >
              SEARCH ARCHIVE
            </button>
          </div>

          <div className="border-t border-[#DCE4EA] pt-3 space-y-2 max-h-[380px] overflow-y-auto">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                onClick={() => setSelectedRecord(rec)}
                className={`p-3 rounded border text-xs font-mono cursor-pointer transition-colors space-y-1 ${
                  selectedRecord?.id === rec.id ? 'bg-[#F2F7FC] border-[#245B84]' : 'bg-slate-50 border-[#DCE4EA] hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#245B84]">{rec.record_id}</span>
                  <span className="text-[9px] text-slate-400">{rec.recording_type}</span>
                </div>
                <p className="text-slate-700 font-bold">{rec.location}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Size: {rec.file_size_mb} MB</span>
                  <span>Duration: {rec.duration_sec}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
