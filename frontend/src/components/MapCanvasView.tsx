import React, { useRef, useEffect, useState } from 'react';
import { Map, Monitor, Smartphone, Tablet } from 'lucide-react';
import { Intersection } from '../types';
import { useResponsiveDevice, AspectRatioType } from '../hooks/useResponsiveDevice';

interface MapCanvasViewProps {
  intersections: Intersection[];
  onSelectIntersection?: (id: number) => void;
}

export type MapRatioMode = 'AUTO' | '16:9' | '4:3' | '16:10' | '3:4';

export const MapCanvasView: React.FC<MapCanvasViewProps> = ({
  intersections,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const deviceConfig = useResponsiveDevice();
  const [ratioMode, setRatioMode] = useState<MapRatioMode>('AUTO');

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

    let animId: number;
    let pulse = 0;

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
      pulse += 0.05;
      ctx.clearRect(0, 0, W, H);

      // Light Smart City Grid Map Background
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < W; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Main Arterial Road Network (Light Grey Asphalt)
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 32;

      // Horizontal Expressway
      const roadY = H * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, roadY);
      ctx.lineTo(W, roadY);
      ctx.stroke();

      // Vertical Corridor
      const roadX = W * 0.44;
      ctx.beginPath();
      ctx.moveTo(roadX, 0);
      ctx.lineTo(roadX, H);
      ctx.stroke();

      // Road Centerlines
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, roadY - 1.5, W, 3);
      ctx.strokeRect(roadX - 1.5, 0, 3, H);

      // Render Intersections & Status Pulsed Rings
      const defaultPositions = [
        { id: 1, name: 'Central Plaza', relX: 0.44, relY: 0.50, status: 'HIGH' },
        { id: 2, name: 'Metro Station', relX: 0.75, relY: 0.50, status: 'MODERATE' },
        { id: 3, name: 'North Corridor', relX: 0.44, relY: 0.22, status: 'LOW' },
        { id: 4, name: 'Tech Park HWY', relX: 0.44, relY: 0.83, status: 'SEVERE' },
      ];

      const listToRender = intersections.length > 0 ? intersections : defaultPositions;

      listToRender.forEach((item: any, idx: number) => {
        const pos = defaultPositions[idx % defaultPositions.length];
        const status = item.current_status || pos.status;
        const px = W * pos.relX;
        const py = H * pos.relY;

        let color = '#237A57'; // LOW
        if (status === 'MODERATE') color = '#B7791F';
        if (status === 'HIGH') color = '#C53030';
        if (status === 'SEVERE') color = '#C53030';

        // Outer pulsing ring
        const ringRadius = 24 + Math.sin(pulse) * 6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(px, py, ringRadius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Inner solid node
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 16, 0, 2 * Math.PI);
        ctx.fill();

        // Label
        ctx.fillStyle = '#0F172A';
        const labelFont = effectiveRatio === '3:4' ? 16 : 20;
        ctx.font = `bold ${labelFont}px Inter, sans-serif`;
        ctx.fillText(item.name || pos.name, px + 26, py + 4);

        const statusFont = effectiveRatio === '3:4' ? 13 : 16;
        ctx.fillStyle = color;
        ctx.font = `bold ${statusFont}px monospace`;
        ctx.fillText(`STATUS: ${status}`, px + 26, py + 24);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [intersections, effectiveRatio]);

  const DeviceIcon = deviceConfig.isMobile ? Smartphone : deviceConfig.isTablet ? Tablet : Monitor;

  return (
    <div className="relative rounded-lg overflow-hidden bg-white border border-surfaceBorder shadow-xs font-sans select-none">
      <div className="p-3 bg-slate-50 border-b border-surfaceBorder flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-primary-500" />
          <span className="text-xs font-bold text-slate-800 font-mono">LIVE CITY MAP MATRIX</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Ratio Mode Switcher Controls */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300 text-[10px] font-bold font-mono">
            <span className="px-1.5 text-slate-500 hidden sm:inline flex items-center gap-1">
              <DeviceIcon className="w-3 h-3 text-[#245B84]" /> RATIO:
            </span>
            {(['AUTO', '16:9', '4:3', '16:10', '3:4'] as MapRatioMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setRatioMode(mode)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  ratioMode === mode ? 'bg-[#245B84] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-300/60'
                }`}
                title={`Switch map ratio to ${mode}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-mono font-bold">
            <span className="flex items-center gap-1 text-accent-success"><span className="w-2 h-2 rounded bg-accent-success inline-block"/> LOW</span>
            <span className="flex items-center gap-1 text-accent-warning"><span className="w-2 h-2 rounded bg-accent-warning inline-block"/> MOD</span>
            <span className="flex items-center gap-1 text-accent-danger"><span className="w-2 h-2 rounded bg-accent-danger inline-block"/> HIGH</span>
          </div>
        </div>
      </div>
      
      {/* Canvas container tailored according to user's device */}
      <div className={`w-full relative overflow-hidden bg-slate-100 ${aspectClass}`}>
        <canvas ref={canvasRef} className="w-full h-full block object-cover" />
      </div>
    </div>
  );
};
