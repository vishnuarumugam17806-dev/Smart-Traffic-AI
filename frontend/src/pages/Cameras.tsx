import React, { useEffect, useState } from 'react';
import {
  Plus, Video, Play, Square, RefreshCw, Trash2, Edit3,
  Wifi, Sparkles, Zap, Layers, CheckCircle2, Search, Filter,
  Sliders, Eye, ArrowRight, ExternalLink
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Camera, Intersection } from '../types';
import { Link } from 'react-router-dom';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';
import { PageHeader } from '../components/PageHeader';
import { DetailDrawer } from '../components/DetailDrawer';
import { EmptyState } from '../components/EmptyState';
import { FALLBACK_CAMERAS } from '../api/mockFallback';

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
  }
];

export const Cameras: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>(FALLBACK_CAMERAS);
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter-First controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [junctionFilter, setJunctionFilter] = useState<string>('ALL');

  // Detail Drawer state
  const [selectedCameraForDrawer, setSelectedCameraForDrawer] = useState<Camera | null>(null);

  // Modals & Presets
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [showPresets, setShowPresets] = useState<boolean>(false);

  // Form Fields
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('sample_traffic.mp4');
  const [sourceType, setSourceType] = useState('FILE');
  const [direction, setDirection] = useState('NORTH');
  const [intersectionId, setIntersectionId] = useState<number>(1);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Diagnostic states
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [testing, setTesting] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const fetchCameras = async () => {
    try {
      const [camRes, intRes] = await Promise.all([
        apiClient.get('/cameras'),
        apiClient.get('/intersections').catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(camRes.data) && camRes.data.length > 0) {
        setCameras(camRes.data);
      }
      if (Array.isArray(intRes.data)) {
        setIntersections(intRes.data);
      }
    } catch (err) {
      console.warn('Backend cameras connecting:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 5000);
    return () => clearInterval(interval);
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
      setBannerMsg({ type: 'success', text: `Camera "${name}" successfully registered!` });
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
      if (selectedCameraForDrawer?.id === id) {
        setSelectedCameraForDrawer(null);
      }
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

  const applyPreset = (preset: CameraPreset) => {
    setSelectedPresetId(preset.id);
    setName(preset.name);
    setSourceUrl(preset.source_url);
    setSourceType(preset.source_type);
    setDirection(preset.direction);
    setIntersectionId(preset.intersection_id);
  };

  // Filtered cameras based on filter-first criteria
  const filteredCameras = cameras.filter((cam) => {
    const matchesSearch = cam.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter !== 'ALL') {
      const isLive = cam.status === 'LIVE' || cam.status === 'ONLINE';
      if (statusFilter === 'ONLINE' && !isLive) return false;
      if (statusFilter === 'OFFLINE' && isLive) return false;
    }

    if (junctionFilter !== 'ALL') {
      if (String(cam.intersection_id) !== junctionFilter) return false;
    }

    return true;
  });

  const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'ALL' || junctionFilter !== 'ALL';

  return (
    <div className="p-3 sm:p-5 space-y-4 bg-[#F8FAFC] min-h-screen font-sans select-none">
      {/* Page Header */}
      <PageHeader
        title="Live Surveillance Cameras"
        subtitle="Connected CCTV feeds, directional angles and real-time vision telemetry"
        badge={
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]">
            {cameras.filter(c => c.status === 'LIVE' || c.status === 'ONLINE').length}/{cameras.length} ONLINE
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowPresets(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer ${
                showPresets
                  ? 'bg-[#245B84] text-white border-[#245B84]'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-[#DCE4EA]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Presets
            </button>

            <button
              onClick={handleSetAllLive}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Set All Live
            </button>

            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="px-3 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Camera
            </button>
          </div>
        }
      />

      {/* Banner Notice */}
      {bannerMsg && (
        <div className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-mono transition-all animate-fadeIn ${
          bannerMsg.type === 'success' ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]' : 'bg-[#EEF6FC] text-[#245B84] border-[#DCE4EA]'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerMsg.text}</span>
        </div>
      )}

      {/* Presets Bar */}
      {showPresets && (
        <div className="bg-white p-3.5 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-slate-800 uppercase font-sans">
                Quick Deploy Test Stream Presets
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {DEFAULT_PRESETS.map((preset) => (
              <div
                key={preset.id}
                className="p-3 rounded-lg border border-[#DCE4EA] bg-[#F8FAFC] flex flex-col justify-between space-y-2"
              >
                <div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border inline-block mb-1 ${preset.badge_color}`}>
                    {preset.badge}
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 truncate">{preset.name}</h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{preset.description}</p>
                </div>
                <button
                  onClick={() => {
                    applyPreset(preset);
                    setShowAddModal(true);
                  }}
                  className="w-full py-1 text-center bg-white hover:bg-[#EEF6FC] border border-[#DCE4EA] hover:border-[#245B84] text-xs font-semibold text-[#173F5F] rounded transition-colors"
                >
                  Configure & Add →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar: Search, Status, Junction */}
      <div className="bg-white p-3 rounded-xl border border-[#DCE4EA] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative min-w-[180px] max-w-sm flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search camera name..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#245B84]"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="min-w-[130px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-1.5 text-slate-800 focus:outline-none focus:border-[#245B84] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ONLINE">● Online Only</option>
              <option value="OFFLINE">○ Offline Only</option>
            </select>
          </div>

          {/* Junction Filter Dropdown */}
          <div className="min-w-[150px]">
            <select
              value={junctionFilter}
              onChange={(e) => setJunctionFilter(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-1.5 text-slate-800 focus:outline-none focus:border-[#245B84] cursor-pointer"
            >
              <option value="ALL">All Junctions</option>
              {intersections.map((int) => (
                <option key={int.id} value={String(int.id)}>
                  {int.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters & Count */}
        <div className="flex items-center gap-2">
          {isFiltered && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setJunctionFilter('ALL');
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 cursor-pointer"
            >
              Reset Filters
            </button>
          )}

          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {filteredCameras.length} OF {cameras.length} CAMERAS
          </span>
        </div>
      </div>

      {/* Main Camera Cards Grid */}
      {filteredCameras.length === 0 ? (
        <EmptyState
          icon={Video}
          title="NO MATCHING CAMERAS"
          description="No surveillance feeds match the current search or status filter criteria."
          action={
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setJunctionFilter('ALL');
              }}
              className="px-3 py-1.5 bg-[#245B84] text-white rounded-lg text-xs font-semibold"
            >
              Clear Filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCameras.map((cam) => {
            const isLive = cam.status === 'LIVE' || cam.status === 'ONLINE';

            return (
              <div
                key={cam.id}
                className="bg-white rounded-xl border border-[#DCE4EA] shadow-2xs overflow-hidden flex flex-col justify-between hover:border-[#245B84]/50 transition-colors"
              >
                {/* 1. Header: Camera Name + Minimal Status Badge */}
                <div className="p-3 border-b border-[#DCE4EA] flex items-center justify-between bg-[#F8FAFC]">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Video className="w-4 h-4 text-[#245B84] shrink-0" />
                    <h3 className="font-bold text-xs text-slate-900 truncate" title={cam.name}>
                      {cam.name}
                    </h3>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 border ${
                      isLive
                        ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#2E7D5B] animate-pulse' : 'bg-red-500'}`} />
                    {isLive ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* 2. Video Feed Canvas */}
                <div className="bg-slate-950 aspect-video relative">
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

                {/* 3. Minimal Footer: Traffic Density & Details Button */}
                <div className="p-2.5 bg-white border-t border-[#DCE4EA] flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    (cam.id % 2 === 0)
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    Traffic: {(cam.id % 2 === 0) ? 'MODERATE' : 'HIGH'}
                  </span>

                  <button
                    onClick={() => setSelectedCameraForDrawer(cam)}
                    className="px-2.5 py-1 text-xs font-semibold text-[#245B84] hover:text-[#173F5F] hover:bg-[#EEF6FC] rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Camera Detail Drawer (Secondary Controls & Inspection) */}
      <DetailDrawer
        isOpen={Boolean(selectedCameraForDrawer)}
        onClose={() => setSelectedCameraForDrawer(null)}
        title="Camera Configuration & Controls"
        subtitle={selectedCameraForDrawer ? selectedCameraForDrawer.name : ''}
        badge={
          selectedCameraForDrawer && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              selectedCameraForDrawer.status === 'LIVE' || selectedCameraForDrawer.status === 'ONLINE'
                ? 'bg-[#EAF7EF] text-[#2E7D5B]'
                : 'bg-red-50 text-red-700'
            }`}>
              {selectedCameraForDrawer.status}
            </span>
          )
        }
        footer={
          selectedCameraForDrawer && (
            <>
              <Link
                to={`/cameras/${selectedCameraForDrawer.id}`}
                className="px-3.5 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                Inspect Analytics
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedCameraForDrawer(null)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </>
          )
        }
      >
        {selectedCameraForDrawer && (
          <div className="space-y-4">
            {/* Stream Info Table */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Camera Node ID</span>
                <span className="font-mono font-bold text-slate-900">#{selectedCameraForDrawer.id}</span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Compass Direction</span>
                <span className="font-mono font-bold text-slate-900">{selectedCameraForDrawer.direction}</span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Source Protocol</span>
                <span className="font-mono font-bold text-slate-900">{selectedCameraForDrawer.source_type}</span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Ingestion Frame Rate</span>
                <span className="font-mono font-bold text-emerald-700">{selectedCameraForDrawer.fps || 30.0} FPS</span>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA] col-span-2">
                <span className="text-[11px] text-slate-500 block mb-0.5">Stream Source URL</span>
                <span className="font-mono text-slate-800 break-all text-[11px]">{selectedCameraForDrawer.source_url}</span>
              </div>
            </div>

            {/* Stream Operational Actions */}
            <div className="space-y-2 pt-2 border-t border-[#DCE4EA]">
              <span className="text-xs font-bold text-slate-700 uppercase font-mono">Stream Control Actions</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleStreamAction(selectedCameraForDrawer.id, 'start')}
                  className="p-2 bg-slate-100 hover:bg-[#EEF6FC] hover:text-[#245B84] text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-600" /> Start
                </button>
                <button
                  onClick={() => handleStreamAction(selectedCameraForDrawer.id, 'stop')}
                  className="p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 text-rose-600" /> Stop
                </button>
                <button
                  onClick={() => handleStreamAction(selectedCameraForDrawer.id, 'reconnect')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#245B84]" /> Reset
                </button>
              </div>
            </div>

            {/* Management & Deletion */}
            <div className="pt-3 border-t border-[#DCE4EA] flex items-center justify-between">
              <button
                onClick={() => openEdit(selectedCameraForDrawer)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Configuration
              </button>
              <button
                onClick={() => handleDeleteCamera(selectedCameraForDrawer.id)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md border border-[#DCE4EA] shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#DCE4EA] pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase font-sans">Add Camera Stream</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
            </div>

            <form onSubmit={handleAddCamera} className="space-y-3.5 text-xs font-sans">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Camera Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                  placeholder="e.g. CCTV-05 East Corridor"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Source Protocol</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="FILE">Local File (MP4)</option>
                    <option value="RTSP">RTSP Stream</option>
                    <option value="WEBCAM">USB Webcam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="NORTH">North</option>
                    <option value="EAST">East</option>
                    <option value="SOUTH">South</option>
                    <option value="WEST">West</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Source URL / Stream Path</label>
                <input
                  type="text"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                  placeholder="sample_traffic.mp4 or rtsp://..."
                />
              </div>

              {/* Stream Diagnostics */}
              <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#DCE4EA] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-500 uppercase">Stream Diagnostics</span>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono text-[10px] font-bold rounded flex items-center gap-1"
                  >
                    <Wifi className="w-3 h-3" /> {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                {testResult && (
                  <div className={`p-2 rounded font-mono text-[10px] border ${
                    testResult.status === 'SUCCESS' ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {testResult.status}: {testResult.message}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-semibold rounded-lg"
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md border border-[#DCE4EA] shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#DCE4EA] pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase font-sans">Edit Camera</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
            </div>
            <form onSubmit={handleEditCamera} className="space-y-3.5 text-xs font-sans">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Camera Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Source Protocol</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="FILE">Local File (MP4)</option>
                    <option value="RTSP">RTSP Stream</option>
                    <option value="WEBCAM">USB Webcam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="NORTH">North</option>
                    <option value="EAST">East</option>
                    <option value="SOUTH">South</option>
                    <option value="WEST">West</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Source URL / Stream Path</label>
                <input
                  type="text"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg p-2 text-slate-800 focus:outline-none focus:border-[#245B84]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white font-semibold rounded-lg"
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
