import React, { useRef, useEffect, useState } from 'react';
import { Video, ShieldAlert, Eye, EyeOff, Radio } from 'lucide-react';

interface CameraCanvasFeedProps {
  cameraName?: string;
  sourceType?: string; // 'REAL', 'DEMO', 'MOBILE', 'RTSP'
  vehicleCount?: number;
  densityState?: string;
  queueLength?: number;
  occupancyPct?: number;
  emergencyDetected?: boolean;
}

export const CameraCanvasFeed: React.FC<CameraCanvasFeedProps> = ({
  cameraName = 'CCTV-01 Central Plaza North',
  sourceType = 'DEMO',
  vehicleCount = 14,
  densityState = 'MODERATE',
  queueLength = 4,
  occupancyPct = 38.5,
  emergencyDetected = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let step = 0;

    const render = () => {
      step += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Asphalt Road Background
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Road Markings & Lane Dividers
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);

      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.33, 0);
      ctx.lineTo(canvas.width * 0.33, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.66, 0);
      ctx.lineTo(canvas.width * 0.66, canvas.height);
      ctx.stroke();

      ctx.setLineDash([]); // Reset line dash

      // Direction Arrows
      ctx.fillStyle = '#475569';
      ctx.font = '14px sans-serif';
      ctx.fillText('▲ LANE 1', canvas.width * 0.12, 30);
      ctx.fillText('▲ LANE 2', canvas.width * 0.45, 30);
      ctx.fillText('▲ LANE 3', canvas.width * 0.78, 30);

      // 3. Simulated Animated Vehicle Streams
      const vehicles = [
        { id: 101, label: 'car', plate: 'TN01AB1234', x: 50, y: (step * 2.5) % (canvas.height + 60) - 60, w: 65, h: 44, conf: 94, speed: 44.2, color: '#10B981' },
        { id: 102, label: 'bus', plate: 'KA05MN3821', x: 230, y: (step * 1.8 + 120) % (canvas.height + 80) - 80, w: 80, h: 54, conf: 96, speed: 38.0, color: '#0EA5E9' },
        { id: 103, label: 'truck', plate: 'MH12PQ9082', x: 410, y: (step * 1.5 + 240) % (canvas.height + 90) - 90, w: 85, h: 58, conf: 89, speed: 32.5, color: '#F59E0B' },
        { id: 104, label: emergencyDetected ? 'ambulance' : 'car', plate: 'DL03XY4410', x: 230, y: (step * 3.2 + 20) % (canvas.height + 60) - 60, w: 70, h: 46, conf: 98, speed: 52.1, color: emergencyDetected ? '#EF4444' : '#3B82F6' },
      ];

      vehicles.forEach((v) => {
        // Draw Vehicle Shape
        ctx.fillStyle = v.color + '40';
        ctx.fillRect(v.x, v.y, v.w, v.h);

        if (showOverlays) {
          // Bounding Box Outline
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(v.x, v.y, v.w, v.h);

          // Bounding Box Corner Reticles
          const rSize = 6;
          ctx.fillStyle = v.color;
          ctx.fillRect(v.x - 2, v.y - 2, rSize, rSize);
          ctx.fillRect(v.x + v.w - 4, v.y - 2, rSize, rSize);
          ctx.fillRect(v.x - 2, v.y + v.h - 4, rSize, rSize);
          ctx.fillRect(v.x + v.w - 4, v.y + v.h - 4, rSize, rSize);

          // Header Label Banner
          ctx.fillStyle = v.color;
          ctx.fillRect(v.x, Math.max(0, v.y - 20), v.w, 20);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`TRACK #${v.id} ${v.label.toUpperCase()}`, v.x + 3, Math.max(14, v.y - 5));

          // Plate Tag Banner
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(v.x, v.y + v.h, v.w, 16);
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`${v.plate} (${v.conf}%)`, v.x + 3, v.y + v.h + 12);
        }
      });

      // 4. Model Header Badge Overlay
      if (showOverlays) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(12, 12, 230, 34);
        ctx.strokeStyle = '#0EA5E9';
        ctx.lineWidth = 1;
        ctx.strokeRect(12, 12, 230, 34);

        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(26, 29, 4, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`YOLOv8 + ANPR ENGINE: 30 FPS`, 38, 31);
      }

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(frameId);
  }, [emergencyDetected, showOverlays]);

  // Source Type Badge Label
  let sourceBadge = { label: 'DEMO CAMERA', bg: 'bg-[#EEF6FC]', text: 'text-[#245B84]', border: 'border-[#DCE4EA]' };
  if (sourceType === 'REAL' || sourceType === 'RTSP') {
    sourceBadge = { label: 'LIVE REAL CAMERA', bg: 'bg-[#EAF7EF]', text: 'text-[#2E7D5B]', border: 'border-[#D2EADA]' };
  } else if (sourceType === 'MOBILE' || sourceType === 'MOBILE_DEVICE') {
    sourceBadge = { label: 'LINKED MOBILE CAM', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-white border border-[#DCE4EA] shadow-xs select-none font-mono">
      {/* Feed Telemetry Header */}
      <div className="p-3 bg-slate-50 border-b border-[#DCE4EA] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#245B84] animate-pulse" />
          <span className="text-xs font-bold text-slate-800">{cameraName}</span>
          <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${sourceBadge.bg} ${sourceBadge.text} ${sourceBadge.border}`}>
            {sourceBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className="px-2 py-1 bg-white hover:bg-slate-100 border border-[#DCE4EA] text-[10px] font-bold rounded text-slate-700 flex items-center gap-1 transition-colors"
          >
            {showOverlays ? <Eye className="w-3 h-3 text-[#245B84]" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
            <span>AI OVERLAY {showOverlays ? 'ON' : 'OFF'}</span>
          </button>

          <span
            className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
              densityState === 'LOW'
                ? 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]'
                : densityState === 'MODERATE'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
            }`}
          >
            {densityState} ({occupancyPct}%)
          </span>
        </div>
      </div>

      {/* Live Vision Canvas */}
      <canvas ref={canvasRef} width={640} height={340} className="w-full h-[340px] object-cover block" />

      {/* Telemetry Footer */}
      <div className="p-3 bg-slate-50 border-t border-[#DCE4EA] grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[10px] text-slate-500 uppercase">ACTIVE VEHICLES</p>
          <p className="font-bold text-base text-[#245B84]">{vehicleCount}</p>
        </div>
        <div className="p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[10px] text-slate-500 uppercase">QUEUE LENGTH</p>
          <p className="font-bold text-base text-amber-700">{queueLength} veh</p>
        </div>
        <div className="p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[10px] text-slate-500 uppercase">LANE OCCUPANCY</p>
          <p className="font-bold text-base text-[#2E7D5B]">{occupancyPct}%</p>
        </div>
      </div>
    </div>
  );
};
