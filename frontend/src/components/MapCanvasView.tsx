import React, { useRef, useEffect } from 'react';
import { Map } from 'lucide-react';
import { Intersection } from '../types';

interface MapCanvasViewProps {
  intersections: Intersection[];
  onSelectIntersection?: (id: number) => void;
}

export const MapCanvasView: React.FC<MapCanvasViewProps> = ({
  intersections,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let pulse = 0;

    const render = () => {
      pulse += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Light Smart City Grid Map Background
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Main Arterial Road Network (Light Grey Asphalt)
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 16;

      // Horizontal Expressway
      ctx.beginPath();
      ctx.moveTo(0, 180);
      ctx.lineTo(canvas.width, 180);
      ctx.stroke();

      // Vertical Corridor
      ctx.beginPath();
      ctx.moveTo(280, 0);
      ctx.lineTo(280, canvas.height);
      ctx.stroke();

      // Road Centerlines
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 179, canvas.width, 2);
      ctx.strokeRect(279, 0, 2, canvas.height);

      // Render Intersections & Status Pulsed Rings
      const defaultPositions = [
        { id: 1, name: 'Central Plaza', x: 280, y: 180, status: 'HIGH' },
        { id: 2, name: 'Metro Station', x: 480, y: 180, status: 'MODERATE' },
        { id: 3, name: 'North Corridor', x: 280, y: 80, status: 'LOW' },
        { id: 4, name: 'Tech Park HWY', x: 280, y: 300, status: 'SEVERE' },
      ];

      const listToRender = intersections.length > 0 ? intersections : defaultPositions;

      listToRender.forEach((item: any, idx: number) => {
        const pos = defaultPositions[idx % defaultPositions.length];
        const status = item.current_status || pos.status;

        let color = '#237A57'; // LOW
        if (status === 'MODERATE') color = '#B7791F';
        if (status === 'HIGH') color = '#C53030';
        if (status === 'SEVERE') color = '#C53030';

        // Outer pulsing ring
        const ringRadius = 12 + Math.sin(pulse) * 3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ringRadius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Inner solid node
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Label (Dark slate)
        ctx.fillStyle = '#17212B';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(item.name || pos.name, pos.x + 16, pos.y + 4);

        ctx.fillStyle = color;
        ctx.font = '9px monospace';
        ctx.fillText(`STATUS: ${status}`, pos.x + 16, pos.y + 16);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [intersections]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-white border border-surfaceBorder shadow-sm">
      <div className="p-3 bg-slate-50 border-b border-surfaceBorder flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-primary-500" />
          <span className="text-xs font-bold text-slate-805 font-mono">LIVE CITY MAP MATRIX</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono font-bold">
          <span className="flex items-center gap-1 text-accent-success"><span className="w-2 h-2 rounded bg-accent-success inline-block"/> LOW</span>
          <span className="flex items-center gap-1 text-accent-warning"><span className="w-2 h-2 rounded bg-accent-warning inline-block"/> MODERATE</span>
          <span className="flex items-center gap-1 text-accent-danger"><span className="w-2 h-2 rounded bg-accent-danger inline-block"/> HIGH</span>
        </div>
      </div>
      <canvas ref={canvasRef} width={640} height={360} className="w-full h-[360px] object-cover block" />
    </div>
  );
};
