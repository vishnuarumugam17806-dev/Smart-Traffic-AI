import React, { useEffect, useState } from 'react';
import { Plus, Video, Play, Square, RefreshCw, Trash2, Edit3, Wifi } from 'lucide-react';
import { apiClient } from '../api/client';
import { Camera } from '../types';
import { Link } from 'react-router-dom';

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

  // Diagnostic states
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [testing, setTesting] = useState<boolean>(false);

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
    setTestResult(null);
  };

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">CAMERA STREAMS DIRECTORY</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">RTSP, Video File, and CCTV Source Controller</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors shadow-sm select-none"
        >
          <Plus className="w-4 h-4" /> Add New Camera
        </button>
      </div>

      {/* Grid of Cameras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((cam) => {
          let statusBadge = "bg-slate-100 text-slate-600 border-slate-200";
          if (cam.status === 'LIVE') statusBadge = "bg-accent-success/10 text-accent-success border-accent-success/20";
          else if (cam.status === 'SIMULATION') statusBadge = "bg-primary-50 text-primary-600 border-primary-200";
          else if (cam.status === 'DEGRADED') statusBadge = "bg-accent-warning/10 text-accent-warning border-accent-warning/20 animate-pulse";
          else if (cam.status === 'OFFLINE') statusBadge = "bg-accent-danger/10 text-accent-danger border-accent-danger/20";

          return (
            <div key={cam.id} className="glass-card p-5 rounded-lg border border-surfaceBorder flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-primary-50 border border-primary-500/10 text-primary-500">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">{cam.name}</h3>
                    <p className="text-[10px] font-mono text-slate-500">ID: #{cam.id} | Direction: {cam.direction}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded border ${statusBadge}`}>
                  {cam.status}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-surfaceBorder text-xs font-mono space-y-1 text-slate-650 select-none">
                <p>Type: <span className="text-primary-600 font-bold">{cam.source_type}</span></p>
                <p className="truncate">URL: <span className="text-slate-500 font-semibold">{cam.source_url}</span></p>
                <p>FPS: <span className="text-accent-success font-bold">{cam.fps} FPS</span></p>
              </div>

              {/* Stream Actions */}
              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => handleStreamAction(cam.id, 'start')}
                  title="Start Stream"
                  className="p-2 bg-slate-100 hover:bg-primary-50 hover:text-primary-600 text-slate-600 rounded transition-colors text-xs flex-1 flex items-center justify-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" /> <span className="text-[10px] font-bold font-mono">START</span>
                </button>
                <button
                  onClick={() => handleStreamAction(cam.id, 'stop')}
                  title="Stop Stream"
                  className="p-2 bg-slate-100 hover:bg-accent-danger/10 hover:text-accent-danger text-slate-600 rounded transition-colors text-xs flex-1 flex items-center justify-center gap-1"
                >
                  <Square className="w-3.5 h-3.5" /> <span className="text-[10px] font-bold font-mono">STOP</span>
                </button>
                <button
                  onClick={() => handleStreamAction(cam.id, 'reconnect')}
                  title="Reconnect Stream"
                  className="p-2 bg-slate-100 hover:bg-[#EAF6F5] hover:text-accent-teal text-slate-600 rounded transition-colors text-xs flex-1 flex items-center justify-center gap-1"
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
                    className="p-2 bg-slate-100 hover:bg-accent-danger/15 text-accent-danger rounded transition-colors"
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md border border-surfaceBorder shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-base font-bold text-slate-800">Add New Camera Stream</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">×</button>
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
                    <option value="FILE">Local File</option>
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
                  className="px-4 py-2 bg-primary-500 text-white font-bold text-xs rounded hover:bg-primary-600 transition-colors"
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
                    <option value="FILE">Local File</option>
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
                    <Wifi className="w-3.5 h-3.5" /> {testing ? 'Testing...' : 'Test Link'}
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
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 font-semibold text-xs rounded hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-500 text-white font-bold text-xs rounded hover:bg-primary-600 transition-colors"
                >
                  Apply Edits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
