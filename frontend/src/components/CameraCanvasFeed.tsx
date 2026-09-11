import React, { useRef, useEffect, useState } from 'react';
import { Video, ShieldAlert, Eye, EyeOff, Radio, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useResponsiveDevice, AspectRatioType } from '../hooks/useResponsiveDevice';

interface CameraCanvasFeedProps {
  cameraName?: string;
  sourceType?: string; // 'REAL', 'DEMO', 'MOBILE', 'RTSP'
  vehicleCount?: number;
  densityState?: string;
  queueLength?: number;
  occupancyPct?: number;
  emergencyDetected?: boolean;
}

export type AspectRatioMode = 'AUTO' | '16:9' | '4:3' | '16:10' | '3:4';

export const CameraCanvasFeed: React.FC<CameraCanvasFeedProps> = ({
  cameraName = 'CCTV-01 Anna Salai North',
  sourceType = 'DEMO',
  vehicleCount = 14,
  densityState = 'MODERATE',
  queueLength = 4,
  occupancyPct = 38.5,
  emergencyDetected = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const deviceConfig = useResponsiveDevice();
  const [ratioMode, setRatioMode] = useState<AspectRatioMode>('AUTO');

  // Determine active ratio based on user selection or auto device detection
  const effectiveRatio: AspectRatioType = ratioMode === 'AUTO' 
    ? deviceConfig.suggestedRatio
    : (ratioMode as AspectRatioType);

  const aspectClass = effectiveRatio === '3:4'
    ? 'aspect-[3/4] max-h-[500px] sm:max-h-[600px] mx-auto'
    : effectiveRatio === '4:3'
    ? 'aspect-[4/3]'
    : effectiveRatio === '16:10'
    ? 'aspect-[16/10]'
    : 'aspect-video';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let step = 0;

    // Baseline Canvas Resolution matching target Aspect Ratio natively
    let W = 1280;
    let H = 720;

    if (effectiveRatio === '3:4') {
      W = 720;
      H = 960;
    } else if (effectiveRatio === '4:3') {
      W = 960;
      H = 720;
    } else if (effectiveRatio === '16:10') {
      W = 1280;
      H = 800;
    } else {
      W = 1280;
      H = 720;
    }

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const render = () => {
      step += 1;
      ctx.clearRect(0, 0, W, H);

      // 1. Dark Asphalt Road Surface
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, W, H);

      // 2. Road Shoulders & Sidewalk Edges
      const shoulderW = Math.max(20, W * 0.03);
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, shoulderW, H);
      ctx.fillRect(W - shoulderW, 0, shoulderW, H);

      // Yellow Solid Edge Markings
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(shoulderW + 4, 0, 6, H);
      ctx.fillRect(W - shoulderW - 10, 0, 6, H);

      // 3. Lane Dividers (3 Lanes Across Width W)
      const roadW = W - (shoulderW * 2 + 20);
      const laneW = roadW / 3;
      const l1X = shoulderW + 10 + laneW;
      const l2X = shoulderW + 10 + laneW * 2;

      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 5;
      ctx.setLineDash([24, 20]);

      ctx.beginPath();
      ctx.moveTo(l1X, 0);
      ctx.lineTo(l1X, H);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(l2X, 0);
      ctx.lineTo(l2X, H);
      ctx.stroke();

      ctx.setLineDash([]); // Reset dash

      // Lane Center Coordinates
      const laneCenters = [
        shoulderW + 10 + laneW * 0.5,
        shoulderW + 10 + laneW * 1.5,
        shoulderW + 10 + laneW * 2.5
      ];

      // Lane Arrows & Header Text
      ctx.fillStyle = '#94A3B8';
      const laneFontSize = effectiveRatio === '3:4' ? 15 : 18;
      ctx.font = `bold ${laneFontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(effectiveRatio === '3:4' ? '▲ L1' : '▲ LANE 1 (NORTH)', laneCenters[0], 44);
      ctx.fillText(effectiveRatio === '3:4' ? '▲ L2' : '▲ LANE 2 (CENTER)', laneCenters[1], 44);
      ctx.fillText(effectiveRatio === '3:4' ? '▲ L3' : '▲ LANE 3 (EXPRESS)', laneCenters[2], 44);
      ctx.textAlign = 'left';

      // 4. Vehicle Dimensions Tailored to Viewport Aspect
      const vWidth = Math.max(90, laneW * 0.55);
      const vHeight = Math.max(65, vWidth * 0.68);

      const vehicles = [
        { id: 101, label: 'car', plate: 'TN01AB1234', laneIdx: 0, y: (step * 4.2) % (H + 180) - 180, conf: 94, color: '#10B981' },
        { id: 102, label: 'bus', plate: 'KA05MN3821', laneIdx: 1, y: (step * 3.1 + 250) % (H + 220) - 220, conf: 96, color: '#0EA5E9' },
        { id: 103, label: 'truck', plate: 'MH12PQ9082', laneIdx: 2, y: (step * 2.6 + 500) % (H + 240) - 240, conf: 89, color: '#F59E0B' },
        { id: 104, label: emergencyDetected ? 'ambulance' : 'car', plate: 'DL03XY4410', laneIdx: 1, y: (step * 5.5 + 80) % (H + 180) - 180, conf: 98, color: emergencyDetected ? '#EF4444' : '#3B82F6' },
      ];

      vehicles.forEach((v) => {
        const curVWidth = v.label === 'bus' || v.label === 'truck' ? vWidth * 1.15 : vWidth;
        const curVHeight = v.label === 'bus' || v.label === 'truck' ? vHeight * 1.25 : vHeight;
        const vx = laneCenters[v.laneIdx] - curVWidth / 2;
        const vy = v.y;

        // Draw Semi-Transparent Vehicle Body
        ctx.fillStyle = v.color + '45';
        ctx.fillRect(vx, vy, curVWidth, curVHeight);

        if (showOverlays) {
          // Bounding Box Outline
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 3;
          ctx.strokeRect(vx, vy, curVWidth, curVHeight);

          // Corner Reticles
          const rSize = 8;
          ctx.fillStyle = v.color;
          ctx.fillRect(vx - 2, vy - 2, rSize, rSize);
          ctx.fillRect(vx + curVWidth - 6, vy - 2, rSize, rSize);
          ctx.fillRect(vx - 2, vy + curVHeight - 6, rSize, rSize);
          ctx.fillRect(vx + curVWidth - 6, vy + curVHeight - 6, rSize, rSize);

          // Top Track Label Banner
          const bannerH = 22;
          const bannerY = Math.max(0, vy - bannerH);
          ctx.fillStyle = v.color;
          ctx.fillRect(vx, bannerY, curVWidth, bannerH);

          ctx.fillStyle = '#FFFFFF';
          const trackFontSize = effectiveRatio === '3:4' ? 10 : 12;
          ctx.font = `bold ${trackFontSize}px monospace`;
          ctx.fillText(`#${v.id} ${v.label.toUpperCase()}`, vx + 4, bannerY + 15);

          // Bottom Plate Tag Banner
          const plateH = 20;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fillRect(vx, vy + curVHeight, curVWidth, plateH);

          ctx.fillStyle = '#38BDF8';
          const plateFontSize = effectiveRatio === '3:4' ? 9 : 11;
          ctx.font = `bold ${plateFontSize}px monospace`;
          ctx.fillText(`${v.plate}`, vx + 4, vy + curVHeight + 14);
        }
      });

      // 5. High-Res AI Overlay Telemetry Header
      if (showOverlays) {
        const badgeW = effectiveRatio === '3:4' ? 280 : 360;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(16, 16, badgeW, 44);
        ctx.strokeStyle = '#0EA5E9';
        ctx.lineWidth = 2;
        ctx.strokeRect(16, 16, badgeW, 44);

        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(34, 38, 6, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#F8FAFC';
        const badgeFont = effectiveRatio === '3:4' ? 12 : 14;
        ctx.font = `bold ${badgeFont}px monospace`;
        ctx.fillText(`YOLOv8 + ANPR ENGINE • 30 FPS`, 50, 43);

        // Aspect Ratio Indicator Badge
        const tagW = effectiveRatio === '3:4' ? 180 : 220;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(W - (tagW + 16), 16, tagW, 44);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(W - (tagW + 16), 16, tagW, 44);

        ctx.fillStyle = '#38BDF8';
        ctx.font = `bold ${badgeFont}px monospace`;
        ctx.fillText(`${deviceConfig.deviceType.toUpperCase()} (${effectiveRatio})`, W - (tagW + 4), 43);
      }

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(frameId);
  }, [emergencyDetected, showOverlays, effectiveRatio, deviceConfig]);

  // Source Type Badge Label
  let sourceBadge = { label: 'DEMO CAMERA', bg: 'bg-[#EEF6FC]', text: 'text-[#245B84]', border: 'border-[#DCE4EA]' };
  if (sourceType === 'REAL' || sourceType === 'RTSP') {
    sourceBadge = { label: 'LIVE REAL CAMERA', bg: 'bg-[#EAF7EF]', text: 'text-[#2E7D5B]', border: 'border-[#D2EADA]' };
  } else if (sourceType === 'MOBILE' || sourceType === 'MOBILE_DEVICE') {
    sourceBadge = { label: 'LINKED MOBILE CAM', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  }

  const DeviceIcon = deviceConfig.isMobile ? Smartphone : deviceConfig.isTablet ? Tablet : Monitor;

  return (
    <div className="relative rounded-lg overflow-hidden bg-white border border-[#DCE4EA] shadow-xs select-none font-mono">
      {/* Feed Telemetry Header */}
      <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-[#DCE4EA] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <Radio className="w-4 h-4 text-[#245B84] shrink-0 animate-pulse" />
          <span className="text-xs font-bold text-slate-800 truncate">{cameraName}</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border shrink-0 ${sourceBadge.bg} ${sourceBadge.text} ${sourceBadge.border}`}>
            {sourceBadge.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          {/* Ratio Mode Switcher Controls */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300 text-[10px] font-bold">
            <span className="px-1.5 text-slate-500 hidden sm:inline flex items-center gap-1">
              <DeviceIcon className="w-3 h-3 text-[#245B84]" /> RATIO:
            </span>
            {(['AUTO', '16:9', '4:3', '16:10', '3:4'] as AspectRatioMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setRatioMode(mode)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  ratioMode === mode ? 'bg-[#245B84] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-300/60'
                }`}
                title={`Switch canvas feed ratio to ${mode}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowOverlays(!showOverlays)}
            className="px-2 py-1 bg-white hover:bg-slate-100 border border-[#DCE4EA] text-[10px] font-bold rounded text-slate-700 flex items-center gap-1 transition-colors"
          >
            {showOverlays ? <Eye className="w-3 h-3 text-[#245B84]" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
            <span>OVERLAY {showOverlays ? 'ON' : 'OFF'}</span>
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

      {/* Responsive Canvas Feed Container (Fluid 100% object-cover filling without black bars) */}
      <div className={`w-full relative overflow-hidden bg-slate-950 ${aspectClass}`}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block object-cover"
        />
      </div>

      {/* Telemetry Footer */}
      <div className="p-2.5 sm:p-3 bg-slate-50 border-t border-[#DCE4EA] grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-1.5 sm:p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase">ACTIVE VEHICLES</p>
          <p className="font-bold text-sm sm:text-base text-[#245B84]">{vehicleCount}</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase">QUEUE LENGTH</p>
          <p className="font-bold text-sm sm:text-base text-amber-700">{queueLength} veh</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase">OCCUPANCY</p>
          <p className="font-bold text-sm sm:text-base text-[#2E7D5B]">{occupancyPct}%</p>
        </div>
      </div>
    </div>
  );
};
