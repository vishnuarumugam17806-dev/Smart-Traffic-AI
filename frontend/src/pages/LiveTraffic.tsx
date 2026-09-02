import React, { useEffect, useState } from 'react';
import { CameraCanvasFeed } from '../components/CameraCanvasFeed';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';

export const LiveTraffic: React.FC = () => {
  const { cameras, setCameras, activeLiveUpdate } = useStore();
  const [cameraStats, setCameraStats] = useState<Record<number, any>>({});

  useEffect(() => {
    apiClient.get('/cameras')
      .then((res) => {
        setCameras(res.data);
      })
      .catch(console.error);
  }, []);

  // Update camera stats reactively from WebSocket updates
  useEffect(() => {
    if (activeLiveUpdate && activeLiveUpdate.event === 'TRAFFIC_UPDATE') {
      const camId = activeLiveUpdate.camera_id;
      setCameraStats((prev) => ({
        ...prev,
        [camId]: {
          vehicleCount: activeLiveUpdate.vehicle_count,
          densityState: activeLiveUpdate.density_state,
          queueLength: activeLiveUpdate.queue_length,
          occupancyPct: activeLiveUpdate.occupancy_percentage,
          fps: activeLiveUpdate.fps,
          latency: activeLiveUpdate.latency_ms,
          status: activeLiveUpdate.camera_health
        }
      }));
    }
  }, [activeLiveUpdate]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-wide">LIVE TRAFFIC MONITORING</h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">Multi-Camera YOLO Detection & Vehicle Tracking Stream</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cameras.map((cam) => {
          const stats = cameraStats[cam.id] || {
            vehicleCount: 12,
            densityState: 'LOW',
            queueLength: 2,
            occupancyPct: 24.5,
            fps: cam.fps || 30.0,
            latency: 15.0,
            status: cam.status
          };

          return (
            <CameraCanvasFeed
              key={cam.id}
              cameraName={`${cam.name} (${cam.direction})`}
              vehicleCount={stats.vehicleCount}
              densityState={stats.densityState}
              queueLength={stats.queueLength}
              occupancyPct={stats.occupancyPct}
              emergencyDetected={false}
            />
          );
        })}
      </div>
    </div>
  );
};
