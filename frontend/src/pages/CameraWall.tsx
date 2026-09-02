import React, { useState, useEffect } from 'react';
import { Camera, Grid, Maximize2, ToggleLeft, ToggleRight, Wifi, ShieldAlert, Cpu } from 'lucide-react';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';

export const CameraWall: React.FC = () => {
  const { cameras, setCameras } = useStore();
  const [gridCount, setGridCount] = useState<number>(4);
  const [showAIOverlays, setShowAIOverlays] = useState<boolean>(true);
  const [selectedFullscreenCam, setSelectedFullscreenCam] = useState<any | null>(null);

  useEffect(() => {
    apiClient.get('/cameras')
      .then(res => setCameras(res.data))
      .catch(console.error);
  }, []);

  const displayCameras = cameras.slice(0, gridCount);

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA] min-h-screen select-none">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight uppercase">MULTI-CAMERA MONITORING WALL</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Real-Time Multi-Stream Grid, AI Bounding Box Overlays & Fullscreen Inspection</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Grid Layout Selector */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded border border-[#DCE4EA] text-xs font-mono">
            <span className="text-slate-400 font-bold px-2 text-[10px]">GRID LAYOUT:</span>
            {[2, 4, 6, 9].map((count) => (
              <button
                key={count}
                onClick={() => setGridCount(count)}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  gridCount === count ? 'bg-[#245B84] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {count} CAM
              </button>
            ))}
          </div>

          {/* AI Overlay Toggle */}
          <button
            onClick={() => setShowAIOverlays(!showAIOverlays)}
            className={`px-3 py-1.5 rounded border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              showAIOverlays ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]' : 'bg-slate-100 text-slate-600 border-[#DCE4EA]'
            }`}
          >
            {showAIOverlays ? <ToggleRight className="w-4 h-4 text-[#2E7D5B]" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
            AI OVERLAYS {showAIOverlays ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Multi-Camera Tile Grid */}
      <div className={`grid gap-6 ${
        gridCount === 2 ? 'grid-cols-1 md:grid-cols-2' :
        gridCount === 4 ? 'grid-cols-1 md:grid-cols-2' :
        gridCount === 6 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-3'
      }`}>
        {displayCameras.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-lg border border-[#DCE4EA] text-slate-400 font-mono text-xs">
            No active cameras found.
          </div>
        ) : (
          displayCameras.map((cam, idx) => (
            <div key={cam.id} className="relative group">
              <CameraCanvasFeed
                cameraName={`[${cam.source_type}] ${cam.name}`}
                vehicleCount={12 + idx * 3}
                densityState={idx % 2 === 0 ? 'MODERATE' : 'HIGH'}
                queueLength={3 + idx * 2}
                occupancyPct={42.5 + idx * 8}
                emergencyDetected={idx === 1}
              />
              <button
                onClick={() => setSelectedFullscreenCam(cam)}
                className="absolute top-3 right-3 p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-20"
                title="Fullscreen Inspection"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Fullscreen Inspection Modal */}
      {selectedFullscreenCam && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-6">
          <div className="bg-slate-900 rounded-lg border border-slate-700 max-w-4xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between text-white border-b border-slate-700 pb-2">
              <h3 className="font-bold font-mono text-sm uppercase">
                FULLSCREEN STREAM INSPECTION: {selectedFullscreenCam.name}
              </h3>
              <button
                onClick={() => setSelectedFullscreenCam(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>
            <div className="min-h-[420px]">
              <CameraCanvasFeed
                cameraName={selectedFullscreenCam.name}
                vehicleCount={22}
                densityState="HIGH"
                queueLength={8}
                occupancyPct={68.4}
                emergencyDetected={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
