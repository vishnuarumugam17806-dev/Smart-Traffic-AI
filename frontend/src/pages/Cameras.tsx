import React, { useEffect, useState } from 'react';
import { Plus, Video, Play, Square, RefreshCw, Trash2, Edit3, Wifi, Sparkles, Zap, Layers, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import { apiClient } from '../api/client';
import { Camera } from '../types';
import { Link } from 'react-router-dom';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';

interface CameraPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  source_url: string;
  source_type: string;
  direction: string;
  intersection_id: number;
  badge: string;
  badge_color: string;
}

const DEFAULT_PRESETS: CameraPreset[] = [
  {
    id: "urban_arterial",
    name: "CCTV-01 North (Anna Salai - Spencers Junction)",
    category: "Urban Commute",
    description: "Dense city center 4-way intersection with continuous vehicular flow.",
    source_url: "sample_traffic_urban.mp4",
    source_type: "FILE",
    direction: "NORTH",
    intersection_id: 1,
    badge: "URBAN",
    badge_color: "bg-[#EEF6FC] text-[#245B84] border-[#DCE4EA]"
  },
  {
    id: "congested_cross",
    name: "CCTV-02 South (Anna Salai - Spencers Junction)",
    category: "Peak Bottleneck",
    description: "High traffic queueing corridor during peak morning commute.",
    source_url: "sample_traffic_congested.mp4",
    source_type: "FILE",
    direction: "SOUTH",
    intersection_id: 1,
    badge: "CONGESTED",
    badge_color: "bg-red-50 text-red-700 border-red-200"
  },
  {
    id: "emergency_corridor",
    name: "CCTV-03 East (Chennai Central - Ripon Cross)",
    category: "Emergency Route",
    description: "Dedicated priority corridor with green light preemption.",
    source_url: "sample_traffic_emergency.mp4",
    source_type: "FILE",
    direction: "EAST",
    intersection_id: 2,
    badge: "EMERGENCY",
    badge_color: "bg-amber-50 text-amber-700 border-amber-200"
  },
  {
    id: "highway_expressway",
    name: "CCTV-04 West (Chennai Central - Ripon Cross)",
    category: "Expressway / Highway",
    description: "High-speed multi-lane transit with FastTag ANPR and speed tracking.",
    source_url: "sample_traffic_highway.mp4",
    source_type: "FILE",
    direction: "WEST",
    intersection_id: 2,
    badge: "HIGHWAY",
    badge_color: "bg-emerald-50 text-emerald-700 border-emerald-200"
  },
  {
    id: "rainy_weather",
    name: "CCTV-05 North (Gemini Flyover Circle)",
    category: "Monsoon Weather",
    description: "Adverse rainy weather low-visibility camera stream with road reflections.",
    source_url: "sample_traffic_rainy.mp4",
    source_type: "FILE",
    direction: "NORTH",
    intersection_id: 3,
    badge: "RAINY / WEATHER",
    badge_color: "bg-sky-50 text-sky-700 border-sky-200"
  },
  {
    id: "junction_diamond",
    name: "CCTV-06 South (Gemini Flyover Circle)",
    category: "Multi-Lane Junction",
    description: "Elevated flyover interchange with multi-directional streams.",
    source_url: "sample_traffic_junction.mp4",
    source_type: "FILE",
    direction: "SOUTH",
    intersection_id: 3,
    badge: "JUNCTION",
    badge_color: "bg-purple-50 text-purple-700 border-purple-200"
  },
  {
    id: "rtsp_public_stream",
    name: "CCTV-07 RTSP Test Stream (Network Stream)",
    category: "Live RTSP",
    description: "Standard RTSP video protocol stream for validating IP camera setups.",
    source_url: "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4",
    source_type: "RTSP",
    direction: "NORTH",
    intersection_id: 1,
    badge: "RTSP PROTOCOL",
    badge_color: "bg-teal-50 text-teal-700 border-teal-200"
  },
  {
    id: "usb_webcam_feed",
    name: "CCTV-08 Operator USB Webcam (Local)",
    category: "Hardware Webcam",
    description: "USB workstation camera / laptop feed for on-site live testing.",
    source_url: "0",
    source_type: "WEBCAM",
    direction: "SOUTH",
    intersection_id: 1,
    badge: "LOCAL WEBCAM",
    badge_color: "bg-indigo-50 text-indigo-700 border-indigo-200"
  }
];

export const Cameras: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('sample_traffic.mp4');
  const [sourceType, setSourceType] = useState('FILE');
  const [direction, setDirection] = useState('NORTH');
  const [intersectionId, setIntersectionId] = useState<number>(1);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Diagnostic & Seeding states
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [testing, setTesting] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const fetchCameras = async () => {
    try {
      const res = await apiClient.get('/cameras');
      setCameras(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/cameras', {
        name,
        source_url: sourceUrl,
        source_type: sourceType,
        intersection_id: intersectionId,
        direction
      });
      setShowAddModal(false);
      resetForm();
      fetchCameras();
      setBannerMsg({ type: 'success', text: `Camera "${name}" successfully registered and deployed!` });
      setTimeout(() => setBannerMsg(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCamera) return;
    try {
      await apiClient.put(`/cameras/${editingCamera.id}`, {
        name,
        source_url: sourceUrl,
        source_type: sourceType,
        intersection_id: intersectionId,
        direction
      });
      setShowEditModal(false);
      setEditingCamera(null);
      resetForm();
      fetchCameras();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCamera = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this camera?')) return;
    try {
      await apiClient.delete(`/cameras/${id}`);
      fetchCameras();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStreamAction = async (id: number, action: 'start' | 'stop' | 'reconnect') => {
    try {
      await apiClient.post(`/cameras/${id}/stream-action`, { action });
      fetchCameras();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.post('/cameras/test-connection', {
        name,
        source_url: sourceUrl,
        source_type: sourceType,
        direction
      });
      setTestResult({
        status: res.data.status,
        message: res.data.message
      });
    } catch (err) {
      setTestResult({
        status: 'FAILED',
        message: 'Could not resolve network connection.'
      });
    } finally {
      setTesting(false);
    }
  };

  // One-click deploy all 12 example cameras
  const handleSeedAllExampleCameras = async () => {
    setSeeding(true);
    try {
      const res = await apiClient.post('/cameras/seed-examples');
      await fetchCameras();
      setBannerMsg({
        type: 'success',
        text: res.data.message || 'Successfully seeded 12 example cameras across all major city intersections!'
      });
      setTimeout(() => setBannerMsg(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setSeeding(false);
    }
  };

  // Reset all cameras to LIVE status
  const handleSetAllLive = async () => {
    try {
      const res = await apiClient.post('/cameras/reset-status');
      await fetchCameras();
      setBannerMsg({
        type: 'success',
        text: res.data.message || 'All camera streams have been reactivated to LIVE status.'
      });
      setTimeout(() => setBannerMsg(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  // Apply a preset to form
  const applyPreset = (preset: CameraPreset) => {
    setSelectedPresetId(preset.id);
    setName(preset.name);
    setSourceUrl(preset.source_url);
    setSourceType(preset.source_type);
    setDirection(preset.direction);
    setIntersectionId(preset.intersection_id);
  };

  // Quick deploy single preset directly
  const handleDeploySinglePreset = async (preset: CameraPreset) => {
    try {
      await apiClient.post('/cameras', {
        name: preset.name,
        source_url: preset.source_url,
        source_type: preset.source_type,
        intersection_id: preset.intersection_id,
        direction: preset.direction
      });
      await fetchCameras();
      setBannerMsg({
        type: 'success',
        text: `Preset camera "${preset.name}" deployed successfully!`
      });
      setTimeout(() => setBannerMsg(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (cam: Camera) => {
    setEditingCamera(cam);
    setName(cam.name);
    setSourceUrl(cam.source_url);
    setSourceType(cam.source_type);
    setDirection(cam.direction);
    setIntersectionId(cam.intersection_id || 1);
    setTestResult(null);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setName('');
    setSourceUrl('sample_traffic.mp4');
    setSourceType('FILE');
    setDirection('NORTH');
    setIntersectionId(1);
    setSelectedPresetId('');
    setTestResult(null);
  };

  // Helper badge for card based on source
  const getCameraSourceBadge = (cam: Camera) => {
    const url = (cam.source_url || '').toLowerCase();
    if (url.includes('urban')) return { label: 'URBAN ARTERIAL', color: 'bg-[#EEF6FC] text-[#245B84] border-[#DCE4EA]' };
    if (url.includes('congested')) return { label: 'CONGESTED QUEUE', color: 'bg-red-50 text-red-700 border-red-200' };
    if (url.includes('emergency')) return { label: 'EMERGENCY ROUTE', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (url.includes('highway')) return { label: 'EXPRESSWAY HIGHWAY', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (url.includes('rainy')) return { label: 'MONSOON WEATHER', color: 'bg-sky-50 text-sky-700 border-sky-200' };
    if (url.includes('junction')) return { label: 'MULTI-PHASE JUNCTION', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    if (cam.source_type === 'RTSP' || url.includes('rtsp')) return { label: 'RTSP STREAM', color: 'bg-teal-50 text-teal-700 border-teal-200' };
    if (cam.source_type === 'WEBCAM' || url === '0') return { label: 'USB WEBCAM', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    return { label: cam.source_type, color: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-[#F7F9FB] min-h-screen font-sans">
      {/* Page Header with Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight uppercase flex items-center gap-2">
            <Video className="w-5 h-5 text-[#245B84]" /> LIVE CAMERAS CONTROL ROOM
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Real-Time Multi-Camera CCTV Stream Ingestion, YOLOv8 Telemetry & ANPR
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Deploy All Example Cameras */}
          <button
            onClick={handleSeedAllExampleCameras}
            disabled={seeding}
            className="px-3 py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-sm select-none"
            title="Deploy all 12 pre-configured example city cameras across intersections"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{seeding ? 'Deploying...' : 'Deploy 12 Example Cameras'}</span>
          </button>

          {/* Set All Cameras to Live */}
          <button
            onClick={handleSetAllLive}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-sm select-none"
            title="Reset all cameras to active LIVE status"
          >
            <Zap className="w-4 h-4 text-emerald-200" />
            <span>Set All Live</span>
          </button>

          {/* Add Custom Camera Button */}
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-sm select-none"
          >
            <Plus className="w-4 h-4" />
            <span>Add Camera</span>
          </button>
        </div>
      </div>

      {/* Banner message */}
      {bannerMsg && (
        <div className={`p-3 rounded-lg border flex items-center gap-2 text-xs font-mono transition-all animate-fadeIn ${
          bannerMsg.type === 'success' ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]' : 'bg-[#EEF6FC] text-[#245B84] border-[#DCE4EA]'
        }`}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{bannerMsg.text}</span>
        </div>
      )}

      {/* Quick Example Cameras Presets Catalog */}
      <div className="bg-white p-4 rounded-lg border border-[#DCE4EA] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#245B84]" />
            <h2 className="text-xs font-mono font-bold text-slate-800 uppercase">
              Example Test Cameras Quick Catalog
            </h2>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              Ready-to-Deploy
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Click "+ Deploy" to instantly register any test camera stream
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEFAULT_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-[#245B84]/40 transition-all flex flex-col justify-between space-y-2 group"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${preset.badge_color}`}>
                    {preset.badge}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    {preset.source_type}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-[#245B84]">
                  {preset.name}
                </h4>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                  {preset.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] font-mono">
                <span className="text-slate-400 truncate max-w-[120px]">{preset.source_url}</span>
                <button
                  onClick={() => handleDeploySinglePreset(preset)}
                  className="px-2 py-1 bg-white hover:bg-[#245B84] text-slate-700 hover:text-white border border-slate-300 hover:border-[#245B84] rounded font-bold transition-colors flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3 h-3" /> Deploy
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid of Active Cameras */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
            Active Camera Streams ({cameras.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            LIVE: {cameras.filter(c => c.status === 'LIVE' || c.status === 'ONLINE').length} / {cameras.length}
          </span>
        </div>

        {cameras.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-lg border border-dashed border-slate-300 space-y-4">
            <Video className="w-12 h-12 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-700">No Cameras Registered Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Deploy the 12 realistic example city cameras with one click, or add a custom RTSP / MP4 file stream.
              </p>
            </div>
            <button
              onClick={handleSeedAllExampleCameras}
              className="px-4 py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-bold text-xs rounded-lg inline-flex items-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-300" /> Deploy 12 Example Cameras
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cameras.map((cam) => {
              let statusBadge = "bg-slate-100 text-slate-600 border-slate-200";
              if (cam.status === 'LIVE' || cam.status === 'ONLINE') statusBadge = "bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]";
              else if (cam.status === 'SIMULATION') statusBadge = "bg-[#EEF6FC] text-[#245B84] border-[#DCE4EA]";
              else if (cam.status === 'DEGRADED') statusBadge = "bg-amber-50 text-amber-700 border-amber-200 animate-pulse";
              else if (cam.status === 'OFFLINE') statusBadge = "bg-red-50 text-red-700 border-red-200";

              const sourceBadge = getCameraSourceBadge(cam);

              return (
                <div key={cam.id} className="bg-white p-4 rounded-lg border border-[#DCE4EA] flex flex-col justify-between space-y-3 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded bg-[#EEF6FC] border border-[#DCE4EA] text-[#245B84]">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{cam.name}</h3>
                        <p className="text-[10px] font-mono text-slate-500">ID: #{cam.id} | Dir: {cam.direction}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded border ${statusBadge}`}>
                        {cam.status}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[8px] font-mono font-extrabold rounded border ${sourceBadge.color}`}>
                        {sourceBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Embedded Camera Canvas Stream */}
                  <div className="rounded overflow-hidden border border-[#DCE4EA]">
                    <CameraCanvasFeed
                      cameraName={cam.name}
                      sourceUrl={cam.source_url}
                      sourceType={cam.source_type}
                      vehicleCount={14 + (cam.id * 3) % 22}
                      densityState={(cam.id % 2 === 0) ? 'MODERATE' : 'HIGH'}
                      queueLength={2 + (cam.id % 7)}
                      occupancyPct={38.0 + (cam.id * 5) % 45}
                    />
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded border border-[#DCE4EA] text-xs font-mono space-y-1 text-slate-650 select-none">
                    <p className="truncate">URL/Source: <span className="text-slate-700 font-semibold">{cam.source_url}</span></p>
                    <p>Frame Rate: <span className="text-[#2E7D5B] font-bold">{cam.fps || 30.0} FPS</span></p>
                  </div>

                  {/* Stream Actions */}
                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => handleStreamAction(cam.id, 'start')}
                      title="Start Stream"
                      className="p-2 bg-slate-100 hover:bg-[#EEF6FC] hover:text-[#245B84] text-slate-600 rounded transition-colors text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" /> <span className="text-[10px] font-bold font-mono">START</span>
                    </button>
                    <button
                      onClick={() => handleStreamAction(cam.id, 'stop')}
                      title="Stop Stream"
                      className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded transition-colors text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <Square className="w-3.5 h-3.5" /> <span className="text-[10px] font-bold font-mono">STOP</span>
                    </button>
                    <button
                      onClick={() => handleStreamAction(cam.id, 'reconnect')}
                      title="Reconnect Stream"
                      className="p-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded transition-colors text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> <span className="text-[10px] font-bold font-mono">RESET</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      to={`/cameras/${cam.id}`}
                      className="col-span-2 text-center py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-colors"
                    >
                      Inspect Analytics
                    </Link>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openEdit(cam)}
                        className="p-2 bg-slate-100 hover:bg-slate-250 text-slate-700 rounded transition-colors"
                        title="Edit Camera"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCamera(cam.id)}
                        className="p-2 bg-slate-100 hover:bg-red-50 text-red-600 rounded transition-colors"
                        title="Delete Camera"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md border border-surfaceBorder shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-slate-800">Add New Camera Stream</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">×</button>
            </div>

            {/* Quick Preset Selector in Modal */}
            <div className="bg-[#EEF6FC] p-3 rounded-lg border border-[#DCE4EA] space-y-1.5">
              <label className="block text-[10px] font-mono font-bold text-[#245B84] uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Quick-Fill from Preset Example Camera
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  const p = DEFAULT_PRESETS.find(item => item.id === e.target.value);
                  if (p) applyPreset(p);
                }}
                className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-xs text-slate-800 focus:outline-none font-medium"
              >
                <option value="">-- Choose an example camera preset --</option>
                {DEFAULT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.source_type}: {p.source_url})
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleAddCamera} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Camera Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  placeholder="e.g. CCTV-05 East Corridor"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Source Type</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none"
                  >
                    <option value="FILE">Local File (MP4)</option>
                    <option value="RTSP">RTSP Stream</option>
                    <option value="WEBCAM">USB Webcam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none"
                  >
                    <option value="NORTH">North</option>
                    <option value="EAST">East</option>
                    <option value="SOUTH">South</option>
                    <option value="WEST">West</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Source URL / Path</label>
                <input
                  type="text"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                  placeholder="sample_traffic.mp4 or rtsp://..."
                />
              </div>

              {/* Connection diagnostics */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Stream Diagnostics</span>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono text-[9px] font-bold rounded flex items-center gap-1 transition-colors"
                  >
                    <Wifi className="w-3 h-3" /> {testing ? 'Testing...' : 'Test Link'}
                  </button>
                </div>
                {testResult && (
                  <div className={`p-2 rounded font-mono text-[10px] leading-relaxed border ${
                    testResult.status === 'SUCCESS' ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]' : 'bg-[#FCEEEF] text-[#B84A4A] border-[#F8D7DA]'
                  }`}>
                    <p className="font-bold">{testResult.status}: {testResult.message}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-semibold text-xs rounded hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-bold text-xs rounded transition-colors"
                >
                  Save Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md border border-surfaceBorder shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-slate-800">Edit Camera Settings</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">×</button>
            </div>
            <form onSubmit={handleEditCamera} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Camera Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Source Type</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none"
                  >
                    <option value="FILE">Local File (MP4)</option>
                    <option value="RTSP">RTSP Stream</option>
                    <option value="WEBCAM">USB Webcam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-850 focus:outline-none"
                  >
                    <option value="NORTH">North</option>
                    <option value="EAST">East</option>
                    <option value="SOUTH">South</option>
                    <option value="WEST">West</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-slate-650 mb-1">Source URL / Path</label>
                <input
                  type="text"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-surfaceBorder rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-semibold text-xs rounded hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-bold text-xs rounded transition-colors"
                >
                  Update Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
