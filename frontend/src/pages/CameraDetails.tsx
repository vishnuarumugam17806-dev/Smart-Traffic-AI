import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Video, Activity, Radio, MapPin, Compass, Shield, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import { Camera } from '../types';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export const CameraDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [measurement, setMeasurement] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCameraData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [camRes, measRes] = await Promise.all([
        apiClient.get(`/cameras/${id}`),
        apiClient.get('/traffic/measurements', { params: { camera_id: id, limit: 1 } }).catch(() => ({ data: [] }))
      ]);

      setCamera(camRes.data);
      if (Array.isArray(measRes.data) && measRes.data.length > 0) {
        setMeasurement(measRes.data[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || `Camera #${id} not found.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameraData();
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 bg-[#F8FAFC] min-h-screen font-sans select-none flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-[#245B84] animate-spin" />
          <span className="text-xs font-mono text-slate-500">Loading Camera Telemetry...</span>
        </div>
      </div>
    );
  }

  if (error || !camera) {
    return (
      <div className="p-4 sm:p-6 space-y-4 bg-[#F8FAFC] min-h-screen font-sans select-none">
        <div className="flex items-center gap-3 pb-3 border-b border-[#DCE4EA]">
          <Link to="/cameras" className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-[#DCE4EA] transition-colors shadow-2xs">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs font-mono font-bold text-slate-700">Back to Surveillance Grid</span>
        </div>
        <EmptyState
          icon={Radio}
          title="CAMERA NOT FOUND"
          description={error || `Camera with identifier #${id} was not found on the active surveillance network.`}
          action={
            <Link
              to="/cameras"
              className="px-4 py-2 bg-[#245B84] text-white rounded-md text-xs font-semibold hover:bg-[#1b4666] transition-colors cursor-pointer"
            >
              Return to Cameras
            </Link>
          }
        />
      </div>
    );
  }

  const isOnline = camera.status === 'LIVE' || camera.status === 'ONLINE';

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-[#F8FAFC] min-h-screen font-sans select-none">
      {/* Page Header */}
      <PageHeader
        title={camera.name}
        subtitle={`Surveillance Node #${camera.id} • ${camera.direction || 'Approach'} Directional Feed`}
        badge={
          <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
            isOnline ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {isOnline ? 'ONLINE • 30 FPS' : 'OFFLINE'}
          </span>
        }
        actions={
          <Link
            to="/cameras"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-[#DCE4EA] rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Grid
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Video & Canvas Feed (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <CameraCanvasFeed
            cameraName={camera.name}
            sourceUrl={camera.source_url}
            sourceType={camera.source_type}
            vehicleCount={measurement?.vehicle_count || 0}
            densityState={measurement?.congestion_level || 'MODERATE'}
            queueLength={measurement?.queue_length || 0}
            occupancyPct={measurement?.occupancy_percentage || 0.0}
          />
        </div>

        {/* Camera Hardware & AI Metrics (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#DCE4EA] p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="border-b border-[#DCE4EA] pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#245B84]" /> NODE DIAGNOSTICS
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">Stream specifications and telemetry health</p>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Camera ID:</span>
              <span className="text-slate-800 font-bold">#{camera.id}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Approach Direction:</span>
              <span className="text-slate-800 font-bold">{camera.direction || 'NORTH'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Stream Protocol:</span>
              <span className="text-[#245B84] font-bold">{camera.source_type === 'FILE' ? 'MP4 H.264 (Demo)' : 'RTSP H.264'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Assigned Junction:</span>
              <span className="text-slate-800 font-bold">Junction #{camera.intersection_id || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Video Source:</span>
              <span className="text-slate-600 font-mono text-[11px] truncate max-w-[180px]">{camera.source_url}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">AI Model Architecture:</span>
              <span className="text-indigo-700 font-bold">YOLOv8 Nano (ONNX/PyTorch)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Average FPS:</span>
              <span className="text-emerald-700 font-bold">{camera.fps ? camera.fps.toFixed(1) : '30.0'} FPS</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-500">Status:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {camera.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
