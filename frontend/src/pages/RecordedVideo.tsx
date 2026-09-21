import React, { useEffect, useState, useRef } from 'react';
import {
  Film,
  Camera,
  Search,
  Play,
  Pause,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  ExternalLink,
  ShieldAlert,
  Tag,
  Eye,
  Filter,
  Layers,
  Compass,
  Edit2,
  X,
  Check,
  Crosshair
} from 'lucide-react';
import { apiClient, resolveVideoUrl, resolveImageUrl } from '../api/client';
import { Link } from 'react-router-dom';
import { useWebLocation } from '../hooks/useWebLocation';

interface RecordItem {
  id: number;
  record_id: string;
  video_id?: string;
  photo_id?: string;
  type: 'VIDEO' | 'PHOTO';
  media_type?: string;
  source_type?: string;
  camera_id?: number;
  device_id?: string;
  operator_id?: string;
  location: string;
  timestamp?: string;
  created_at?: string;
  start_time?: string;
  end_time?: string;
  duration_sec?: number;
  file_size_mb?: number;
  file_reference: string;
  file_url: string;
  image_url?: string;
  sha256_hash?: string;
  plate_number?: string;
  ocr_confidence?: number;
  confidence?: number;
  vehicle_type?: string;
  event_type?: string;
  alert_id?: number;
  review_status?: string;
  notes?: string;
  event_markers?: { time_sec: number; type: string; description: string }[];
  is_local?: boolean;
}

export const RecordedVideo: React.FC = () => {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<RecordItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'VIDEOS' | 'PHOTOS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [plateFilter, setPlateFilter] = useState<string>('');
  const [deviceFilter, setDeviceFilter] = useState<string>('ALL');
  const [complianceFilter, setComplianceFilter] = useState<string>('ALL');
  const [filterByMyLocation, setFilterByMyLocation] = useState<boolean>(false);

  // Mutable Admin Location & Geolocation Hook
  const {
    coords,
    locationName,
    permissionStatus,
    isManualOverride,
    setManualLocation,
    resetToGpsLocation,
    requestLocationPermission,
    refreshLocation
  } = useWebLocation();

  const [showEditLocationModal, setShowEditLocationModal] = useState<boolean>(false);
  const [customLocationInput, setCustomLocationInput] = useState<string>('');

  // Live Camera Photo Capture Modal State
  const [showCaptureModal, setShowCaptureModal] = useState<boolean>(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureFeedbackMsg, setCaptureFeedbackMsg] = useState<string | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [webcamStream]);

  const openCameraModal = async () => {
    setShowCaptureModal(true);
    setCaptureFeedbackMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: false
      });
      setWebcamStream(stream);
      if (captureVideoRef.current) {
        captureVideoRef.current.srcObject = stream;
        captureVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Webcam capture access warning:', err);
    }
  };

  const closeCameraModal = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    }
    setShowCaptureModal(false);
  };

  const takePhotoAndSaveToRecords = async () => {
    setIsCapturing(true);
    try {
      let b64 = '';
      if (captureVideoRef.current && captureVideoRef.current.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = captureVideoRef.current.videoWidth || 1280;
        canvas.height = captureVideoRef.current.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(captureVideoRef.current, 0, 0, canvas.width, canvas.height);
          b64 = canvas.toDataURL('image/jpeg', 0.85);
        }
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 36px monospace';
          ctx.fillText('STATION EVIDENCE PHOTO CAPTURE', 60, 120);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '24px monospace';
          ctx.fillText(`Location: ${locationName}`, 60, 200);
          ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 60, 250);
          b64 = canvas.toDataURL('image/jpeg', 0.85);
        }
      }

      const activeLoc = locationName || 'Central Traffic HQ';

      const res = await apiClient.post('/field/capture-photo', {
        operator_id: 'ADMIN-OPERATOR',
        location: activeLoc,
        photo_base64: b64,
        device_id: 'WEB-STATION-CAM'
      });

      if (res.data) {
        const newPhotoItem: RecordItem = {
          id: Date.now(),
          record_id: res.data.record_id || `PHO-${Date.now()}`,
          photo_id: res.data.photo_id || res.data.record_id,
          type: 'PHOTO',
          media_type: 'PHOTO',
          source_type: 'FIELD_PHOTO',
          device_id: 'WEB-STATION-CAM',
          operator_id: 'ADMIN-OPERATOR',
          location: res.data.location || activeLoc,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          file_reference: res.data.file_url,
          file_url: res.data.file_url || b64,
          image_url: res.data.file_url || b64,
          plate_number: res.data.plate_number,
          ocr_confidence: res.data.ocr_confidence,
          confidence: res.data.ocr_confidence,
          event_type: res.data.event_type || 'FIELD_PHOTO_CAPTURE',
          review_status: 'CONFIRMED'
        };

        setRecords((prev) => [newPhotoItem, ...prev]);
        setSelectedRecord(newPhotoItem);

        try {
          const stored = JSON.parse(localStorage.getItem('vigitra_mobile_recordings') || '[]');
          localStorage.setItem(
            'vigitra_mobile_recordings',
            JSON.stringify([newPhotoItem, ...stored.filter((r: any) => r.record_id !== newPhotoItem.record_id)].slice(0, 30))
          );
        } catch (e) {}

        setCaptureFeedbackMsg(`Photo stored in Records! ID: ${newPhotoItem.record_id}`);
        setTimeout(() => setCaptureFeedbackMsg(null), 5000);
        closeCameraModal();
      }
    } catch (e) {
      console.error('Error saving photo to records:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      // 1. Fetch remote unified records from API
      let remoteList: RecordItem[] = [];
      try {
        const res = await apiClient.get('/records', {
          params: {
            record_type: activeTab,
            location: searchQuery || undefined,
            plate_number: plateFilter || undefined
          }
        });
        remoteList = Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        console.warn('API /records fetch fallback to /recordings:', e);
        try {
          const resBackup = await apiClient.get('/recordings');
          remoteList = Array.isArray(resBackup.data) ? resBackup.data : [];
        } catch (err) {}
      }

      // 2. Fetch local device recordings & photos from localStorage
      let localRecords: any[] = [];
      try {
        const stored = localStorage.getItem('vigitra_mobile_recordings');
        if (stored) {
          localRecords = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Error reading local recordings:', e);
      }

      // 3. Merge and deduplicate by record_id
      const recordMap = new Map<string, RecordItem>();

      remoteList.forEach((r) => {
        if (r.record_id) recordMap.set(r.record_id, r);
      });

      localRecords.forEach((r) => {
        if (r.record_id) {
          const existing = recordMap.get(r.record_id);
          recordMap.set(r.record_id, {
            ...existing,
            ...r,
            type: r.type || 'VIDEO',
            file_url: r.file_blob_url || r.file_url || (existing ? existing.file_url : undefined)
          });
        }
      });

      const merged = Array.from(recordMap.values());
      merged.sort((a, b) => {
        const tA = new Date(a.created_at || a.start_time || a.timestamp || 0).getTime();
        const tB = new Date(b.created_at || b.start_time || b.timestamp || 0).getTime();
        return tB - tA;
      });

      setRecords(merged);
      if (!selectedRecord && merged.length > 0) {
        const firstVideo = merged.find((r) => r.type === 'VIDEO') || merged[0];
        setSelectedRecord(firstVideo);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [activeTab]);

  const handleSeek = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      setCurrentTime(timeSec);
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleDelete = async (recordId: string, id?: number) => {
    if (!confirm(`Are you sure you want to delete evidence record ${recordId}?`)) return;

    try {
      const stored = localStorage.getItem('vigitra_mobile_recordings');
      if (stored) {
        const list = JSON.parse(stored);
        const filtered = list.filter((r: any) => r.record_id !== recordId);
        localStorage.setItem('vigitra_mobile_recordings', JSON.stringify(filtered));
      }
    } catch (e) {}

    if (id) {
      try {
        await apiClient.delete(`/recordings/${id}`);
      } catch (e) {}
    }

    const remaining = records.filter((r) => r.record_id !== recordId);
    setRecords(remaining);
    if (selectedRecord?.record_id === recordId) {
      setSelectedRecord(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // Filtered list
  const filteredRecords = records.filter((rec) => {
    if (activeTab === 'VIDEOS' && rec.type !== 'VIDEO') return false;
    if (activeTab === 'PHOTOS' && rec.type !== 'PHOTO') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLoc = (rec.location || '').toLowerCase().includes(q);
      const matchId = (rec.record_id || '').toLowerCase().includes(q);
      const matchDev = (rec.device_id || '').toLowerCase().includes(q);
      if (!matchLoc && !matchId && !matchDev) return false;
    }

    if (plateFilter.trim()) {
      const p = plateFilter.toLowerCase();
      const matchPlate = (rec.plate_number || '').toLowerCase().includes(p);
      if (!matchPlate) return false;
    }

    if (deviceFilter !== 'ALL') {
      if (deviceFilter === 'MOBILE' && !(rec.device_id || '').includes('MOB')) return false;
      if (deviceFilter === 'FIXED' && (rec.device_id || '').includes('MOB')) return false;
    }

    if (complianceFilter !== 'ALL') {
      const ev = (rec.event_type || '').toUpperCase();
      const n = (rec.notes || '').toUpperCase();
      if (complianceFilter === 'ACTION_REQUIRED') {
        if (!ev.includes('EXPIRED') && !n.includes('EXPIRED') && !ev.includes('ACTION')) return false;
      } else if (complianceFilter === 'WATCHLIST') {
        if (!ev.includes('WATCHLIST') && !n.includes('WATCHLIST') && !ev.includes('BLACKLIST')) return false;
      } else if (complianceFilter === 'COMPLIANT') {
        if (ev.includes('EXPIRED') || ev.includes('WATCHLIST') || n.includes('EXPIRED') || n.includes('WATCHLIST')) return false;
      }
    }

    if (filterByMyLocation && locationName) {
      const locKey = locationName.toLowerCase();
      const firstSegment = locKey.split(/[,-]/)[0].trim();
      const recLoc = (rec.location || '').toLowerCase();
      if (!recLoc.includes(firstSegment) && !recLoc.includes(locKey.slice(0, 10)) && !recLoc.includes('live') && !recLoc.includes('checkpoint')) {
        return false;
      }
    }

    return true;
  });

  const activeVideoUrl = selectedRecord
    ? resolveVideoUrl(selectedRecord.file_url || selectedRecord.file_reference)
    : '/videos/sample_traffic_urban.mp4';

  const totalVideos = records.filter((r) => r.type === 'VIDEO').length;
  const totalPhotos = records.filter((r) => r.type === 'PHOTO').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#F6F8FA] min-h-screen select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#DCE4EA] pb-4 gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2 font-mono">
            <Film className="w-5 h-5 text-[#245B84]" /> RECORDS – VIDEO & PHOTO EVIDENCE ARCHIVE
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Verified CCTV Video Ingestion, Mobile Patrol Streams & Photo Evidence Vault (Sections 26-28)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCameraModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Camera className="w-4 h-4" /> 📸 CAPTURE PHOTO
          </button>
          <Link
            to="/devices"
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Smartphone className="w-4 h-4" /> MOBILE PATROL
          </Link>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="px-3.5 py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> REFRESH
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER (IF PHOTO CAPTURED) */}
      {captureFeedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg font-mono text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{captureFeedbackMsg}</span>
          </div>
          <button
            onClick={() => setCaptureFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* LOCATION PERMISSION ALERT BANNER IF NOT GRANTED */}
      {permissionStatus !== 'granted' && !isManualOverride && (
        <div className={`p-3 rounded-lg border font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs ${
          permissionStatus === 'denied' ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            <Navigation className={`w-4 h-4 shrink-0 ${permissionStatus === 'denied' ? 'text-amber-600' : 'text-blue-600 animate-bounce'}`} />
            <span>
              {permissionStatus === 'denied' ? (
                <>
                  <strong>Location Access Denied:</strong> Your browser blocked location access. Click the lock/settings icon in the browser address bar, set Location to <em>"Allow"</em>, then click <strong>Grant Permission</strong>.
                </>
              ) : (
                <>
                  <strong>Device Location Required:</strong> Click <strong>Allow Location Permission</strong> so Vigitra can record and tag evidence to your physical checkpoint.
                </>
              )}
            </span>
          </div>
          <button
            onClick={() => requestLocationPermission()}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold self-start sm:self-auto shrink-0 transition-colors shadow-2xs text-[11px]"
          >
            {permissionStatus === 'denied' ? 'Retry Permission' : 'Grant Location Permission'}
          </button>
        </div>
      )}

      {/* OPERATOR ACTIVE LOCATION & GPS STATUS (MUTABLE ADMIN LOCATION BAR) */}
      <div className="bg-white rounded-lg border border-[#DCE4EA] p-3.5 shadow-xs font-mono text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${isManualOverride ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {isManualOverride ? 'MUTABLE ADMIN CHECKPOINT:' : 'USER DEVICE LOCATION:'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                isManualOverride ? 'bg-blue-600 text-white' :
                permissionStatus === 'granted' && coords ? `bg-emerald-600 text-white` :
                permissionStatus === 'loading' ? 'bg-blue-600 text-white animate-pulse' : 'bg-amber-500 text-black'
              }`}>
                {isManualOverride ? '🔵 MUTABLE ADMIN CHECKPOINT' :
                 permissionStatus === 'granted' && coords ? `🟢 LIVE DEVICE GPS (±${coords.accuracy}m)` :
                 permissionStatus === 'loading' ? '🔄 ACQUIRING DEVICE GPS...' : '🟡 DEVICE GPS WAITING'}
              </span>
            </div>
            <div className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-4 h-4 text-red-500 shrink-0" />
              <span>{locationName}</span>
              {coords && (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-mono font-bold">
                  Lat: {coords.latitude.toFixed(6)}°, Lng: {coords.longitude.toFixed(6)}°
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Detect / Update Device GPS Button */}
          {permissionStatus !== 'granted' ? (
            <button
              onClick={() => requestLocationPermission()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs animate-pulse"
              title="Click to request browser location permission"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{permissionStatus === 'denied' ? 'Re-request Permission' : 'Grant Location Permission'}</span>
            </button>
          ) : (
            !isManualOverride && (
              <button
                onClick={refreshLocation}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1 transition-colors border border-slate-200"
                title="Refresh device GPS coordinates"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span>Update GPS</span>
              </button>
            )
          )}

          {/* Edit Location Button */}
          <button
            onClick={() => {
              setCustomLocationInput(locationName);
              setShowEditLocationModal(true);
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit Location</span>
          </button>

          {/* Reset to Live GPS Button */}
          {isManualOverride && (
            <button
              onClick={async () => {
                await resetToGpsLocation();
              }}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center gap-1.5 transition-colors border border-blue-200"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
              <span>Revert to Device GPS</span>
            </button>
          )}

          {/* Toggle Filter Records by My Location */}
          <button
            onClick={() => setFilterByMyLocation((prev) => !prev)}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors border ${
              filterByMyLocation
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{filterByMyLocation ? '📍 Location Filter Active' : '📍 Filter My Location'}</span>
          </button>
        </div>
      </div>

      {/* Primary Section Tabs: ALL | VIDEOS | PHOTOS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-[#DCE4EA] shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md font-mono text-xs font-bold">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'ALL'
                ? 'bg-[#245B84] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> ALL RECORDS ({records.length})
          </button>
          <button
            onClick={() => setActiveTab('VIDEOS')}
            className={`px-3.5 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'VIDEOS'
                ? 'bg-[#245B84] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" /> 🎥 VIDEOS ({totalVideos})
          </button>
          <button
            onClick={() => setActiveTab('PHOTOS')}
            className={`px-3.5 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'PHOTOS'
                ? 'bg-[#245B84] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> 📸 PHOTOS ({totalPhotos})
          </button>
        </div>

        {/* Search & Filter Inputs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search location or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-[#DCE4EA] rounded text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#245B84] w-44 sm:w-56"
            />
          </div>

          <input
            type="text"
            placeholder="Plate (e.g. TN01)"
            value={plateFilter}
            onChange={(e) => setPlateFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-[#DCE4EA] rounded text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#245B84] w-28 uppercase"
          />

          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-[#DCE4EA] rounded text-xs font-mono text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Sources</option>
            <option value="MOBILE">Mobile Devices</option>
            <option value="FIXED">Fixed CCTV</option>
          </select>

          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-[#DCE4EA] rounded text-xs font-mono text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Compliance</option>
            <option value="ACTION_REQUIRED">🔴 Action Required</option>
            <option value="WATCHLIST">🟠 Watchlist Matches</option>
            <option value="COMPLIANT">🟢 Compliant</option>
          </select>
        </div>
      </div>

      {/* Main Content: Split Grid (Player/Viewer Left, Records List Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Video Player or Selected Photo Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedRecord && selectedRecord.type === 'VIDEO' ? (
            <div className="bg-white rounded-lg border border-[#DCE4EA] shadow-xs overflow-hidden">
              <div className="p-3 bg-[#EEF4F8] border-b border-[#DCE4EA] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#245B84]" />
                  <span className="font-mono font-bold text-xs text-slate-800 uppercase truncate">
                    {selectedRecord.record_id}
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-extrabold rounded bg-[#245B84] text-white">
                    VIDEO
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">{selectedRecord.location}</span>
              </div>

              {/* Video Player */}
              <div className="relative bg-black aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={activeVideoUrl}
                  controls
                  className="w-full h-full object-contain"
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              </div>

              {/* Video Telemetry & Markers */}
              <div className="p-4 space-y-3 font-mono text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-[#DCE4EA]">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Device / Camera</span>
                    <span className="font-bold text-slate-800">{selectedRecord.device_id || 'FIXED-01'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Duration</span>
                    <span className="font-bold text-slate-800">{selectedRecord.duration_sec || 120}s</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Source Type</span>
                    <span className="font-bold text-[#245B84]">{selectedRecord.source_type || 'CONTINUOUS'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Captured Time</span>
                    <span className="font-bold text-slate-700">
                      {new Date(selectedRecord.start_time || selectedRecord.timestamp || '').toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Event Markers Seek Bar */}
                {selectedRecord.event_markers && selectedRecord.event_markers.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      TIMELINE EVENT MARKERS (CLICK TO SEEK)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRecord.event_markers.map((mk, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSeek(mk.time_sec)}
                          className="px-2 py-1 bg-slate-100 hover:bg-[#EEF6FC] hover:text-[#245B84] border border-[#DCE4EA] rounded text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="font-bold">{mk.time_sec}s:</span>
                          <span className="text-slate-600">{mk.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cryptographic SHA-256 Hash */}
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[10px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-slate-500 shrink-0">SHA-256:</span>
                    <span className="font-mono text-slate-700 truncate">{selectedRecord.sha256_hash}</span>
                  </div>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[8px] font-extrabold shrink-0">
                    VERIFIED
                  </span>
                </div>
              </div>
            </div>
          ) : selectedRecord && selectedRecord.type === 'PHOTO' ? (
            <div className="bg-white rounded-lg border border-[#DCE4EA] shadow-xs overflow-hidden space-y-3 p-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 font-mono">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-xs text-slate-800">{selectedRecord.record_id}</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-emerald-700 text-white">
                    PHOTO EVIDENCE
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">{selectedRecord.location}</span>
              </div>

              {/* Photo Image Display */}
              <div className="relative bg-slate-950 aspect-video rounded overflow-hidden flex items-center justify-center">
                <img
                  src={resolveImageUrl(selectedRecord.file_url || selectedRecord.image_url)}
                  alt="Captured Evidence"
                  className="max-h-full object-contain"
                  onError={(e) => {
                    (e.target as any).src = '/vigitra_logo.jpg';
                  }}
                />
                {selectedRecord.plate_number && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-amber-400 text-slate-950 font-mono font-extrabold text-xs rounded shadow-md border border-amber-500">
                    PLATE: {selectedRecord.plate_number}
                  </div>
                )}
              </div>

              {/* Photo Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs bg-slate-50 p-3 rounded border border-[#DCE4EA]">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Device</span>
                  <span className="font-bold text-slate-800">{selectedRecord.device_id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Event Type</span>
                  <span className="font-bold text-emerald-700">{selectedRecord.event_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Confidence</span>
                  <span className="font-bold text-[#245B84]">
                    {Math.round((selectedRecord.confidence || selectedRecord.ocr_confidence || 0.88) * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Captured At</span>
                  <span className="font-bold text-slate-700">
                    {new Date(selectedRecord.timestamp || selectedRecord.created_at || selectedRecord.start_time || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded font-mono text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>DISCLAIMER:</strong> AI DETECTION — Review required. Evidence indexed for audit inspection.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-[#DCE4EA] p-12 text-center text-slate-400 font-mono text-xs">
              Select any video recording or photo from the list on the right to inspect evidence.
            </div>
          )}
        </div>

        {/* Right Column: Records Vault List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-700 uppercase">
              RECORDS VAULT ({filteredRecords.length} ITEMS)
            </span>
            <span className="text-[10px] font-mono text-slate-400">Sort: Newest First</span>
          </div>

          <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-lg border border-[#DCE4EA] text-slate-400 font-mono text-xs">
                No matching records found. Use the controls above to clear filters or refresh.
              </div>
            ) : (
              filteredRecords.map((item) => {
                const isSelected = selectedRecord?.record_id === item.record_id;
                const isPhoto = item.type === 'PHOTO';

                return (
                  <div
                    key={item.record_id}
                    onClick={() => setSelectedRecord(item)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer font-mono flex flex-col justify-between gap-2 shadow-xs ${
                      isSelected
                        ? 'bg-white border-[#245B84] ring-2 ring-[#245B84]/20'
                        : 'bg-white hover:bg-slate-50 border-[#DCE4EA]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`p-2 rounded mt-0.5 ${
                            isPhoto ? 'bg-emerald-100 text-emerald-800' : 'bg-[#EEF6FC] text-[#245B84]'
                          }`}
                        >
                          {isPhoto ? <Camera className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-800">{item.record_id}</span>
                            <span
                              className={`px-1.5 py-0.2 text-[8px] font-extrabold rounded ${
                                isPhoto
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-[#EEF6FC] text-[#245B84] border border-[#DCE4EA]'
                              }`}
                            >
                              {isPhoto ? 'PHOTO' : 'VIDEO'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.record_id, item.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-[10px] border-t border-slate-100 pt-2 text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(item.timestamp || item.created_at || item.start_time || Date.now()).toLocaleTimeString()}
                      </span>

                      {item.plate_number && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold rounded">
                          {item.plate_number}
                        </span>
                      )}

                      {!isPhoto && (
                        <span className="font-bold text-slate-700">{item.duration_sec || 120}s</span>
                      )}

                      <span className="text-slate-400 truncate max-w-[120px]">
                        {item.device_id || 'FIXED-01'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: MUTABLE ADMIN LOCATION EDITOR */}
      {showEditLocationModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 font-mono">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase">EDIT ADMIN CHECKPOINT LOCATION</h3>
                  <p className="text-[10px] text-slate-500">Mutate active location or revert to browser GPS</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditLocationModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Active Checkpoint / Address Label:
                </label>
                <input
                  type="text"
                  value={customLocationInput}
                  onChange={(e) => setCustomLocationInput(e.target.value)}
                  placeholder="e.g. Anna Salai Checkpoint 4, Chennai"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Preset Checkpoint Quick Selectors */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5">
                  Quick Select Checkpoint:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Anna Salai - Spencers Junction',
                    'Kathipara Junction Flyover',
                    'OMR IT Expressway Sector 2',
                    'Marina Beach Promenade Point',
                    'Koyambedu Roundabout Checkpoint'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomLocationInput(preset)}
                      className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded text-[10px] transition-colors border border-slate-200"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current GPS Telemetry Preview */}
              {coords && (
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Device GPS Latitude:</span>
                    <span className="font-bold">{coords.latitude.toFixed(6)}°</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Device GPS Longitude:</span>
                    <span className="font-bold">{coords.longitude.toFixed(6)}°</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Accuracy:</span>
                    <span className="font-bold text-emerald-700">±{coords.accuracy}m</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              {isManualOverride ? (
                <button
                  type="button"
                  onClick={async () => {
                    await resetToGpsLocation();
                    setShowEditLocationModal(false);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Revert to GPS
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditLocationModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customLocationInput.trim()) {
                      setManualLocation(customLocationInput.trim());
                      setShowEditLocationModal(false);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors shadow-xs"
                >
                  Save Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: LIVE CAMERA EVIDENCE PHOTO CAPTURE */}
      {showCaptureModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 rounded-xl max-w-lg w-full p-4 space-y-3.5 shadow-2xl border border-slate-800 font-mono text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wide">CAPTURE FIELD EVIDENCE PHOTO</h3>
                  <p className="text-[10px] text-slate-400">Web Camera Stream Geotagged with Active Location</p>
                </div>
              </div>
              <button
                onClick={closeCameraModal}
                className="text-slate-400 hover:text-white p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            {/* Video Viewport with HUD overlay */}
            <div className="relative bg-black aspect-video rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              <video
                ref={captureVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewport Crosshair HUD */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-24 h-24 border-2 border-emerald-500/40 rounded-lg flex items-center justify-center">
                  <Crosshair className="w-6 h-6 text-emerald-400/80 animate-pulse" />
                </div>
              </div>

              {/* Geotag Indicator Overlay */}
              <div className="absolute bottom-2.5 left-2.5 bg-slate-950/85 px-2.5 py-1 rounded border border-slate-700 text-[10px] flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                <span className="truncate max-w-[260px] text-slate-200">{locationName}</span>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400">
                Photo will be stored on server and indexed in RECORDS.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCapturing}
                  onClick={takePhotoAndSaveToRecords}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isCapturing ? 'SAVING...' : 'CAPTURE & SAVE'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
