import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';

export const CameraDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center gap-3 border-b border-surfaceBorder pb-4">
        <Link to="/cameras" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors select-none">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">CAMERA INSPECTOR #{id}</h1>
          <p className="text-xs text-slate-500 font-mono">Detailed Telemetry & Deep Learning Diagnostics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CameraCanvasFeed
            cameraName={`CCTV-Camera-#${id}`}
            sourceUrl={`/videos/sample_traffic_${id === '2' ? 'congested' : id === '3' ? 'highway' : id === '4' ? 'emergency' : 'urban'}.mp4`}
            vehicleCount={19}
            densityState="HIGH"
            queueLength={6}
            occupancyPct={58.2}
          />
        </div>

        <div className="glass-card p-5 rounded-lg border border-surfaceBorder space-y-4">
          <h3 className="font-bold text-xs text-slate-700 border-b border-surfaceBorder pb-2 uppercase tracking-wide">CAMERA HARDWARE METRICS</h3>
          <div className="space-y-3 text-xs font-mono select-none">
            <div className="flex justify-between text-slate-600">
              <span>Stream Protocol:</span>
              <span className="text-primary-600 font-bold">RTSP / H.264</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Model Architecture:</span>
              <span className="text-accent-teal font-bold">YOLOv8 Nano</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Inference Latency:</span>
              <span className="text-accent-success font-bold">14.2 ms</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Confidence Threshold:</span>
              <span className="text-accent-warning font-bold">0.45</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
