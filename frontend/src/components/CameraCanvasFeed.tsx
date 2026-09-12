import React, { useRef, useEffect, useState } from 'react';
import { Video, ShieldAlert, Eye, EyeOff, Radio, Monitor, Smartphone, Tablet, Layers, Sparkles } from 'lucide-react';
import { useResponsiveDevice, AspectRatioType } from '../hooks/useResponsiveDevice';

interface CameraCanvasFeedProps {
  cameraName?: string;
  sourceUrl?: string;
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
  sourceUrl,
  sourceType = 'REAL',
  vehicleCount = 16,
  densityState = 'MODERATE',
  queueLength = 4,
  occupancyPct = 42.5,
  emergencyDetected = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Requirement: Show Real Vehicles Video by default, AI Overlay only when selected
  const [showOverlays, setShowOverlays] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'REAL' | 'OVERLAY'>('REAL');

  const deviceConfig = useResponsiveDevice();
  const [ratioMode, setRatioMode] = useState<AspectRatioMode>('AUTO');

  // Determine active ratio based on user selection or auto device detection
  const effectiveRatio: AspectRatioType = ratioMode === 'AUTO' 
    ? deviceConfig.suggestedRatio 
    : (ratioMode as AspectRatioType);

  const aspectClass = effectiveRatio === '3:4'
    ? 'aspect-[3/4] max-h-[520px] mx-auto'
    : effectiveRatio === '4:3'
    ? 'aspect-[4/3]'
    : effectiveRatio === '16:10'
    ? 'aspect-[16/10]'
    : 'aspect-video';

  // Sync tab with overlay state
  const handleTabChange = (tab: 'REAL' | 'OVERLAY') => {
    setActiveTab(tab);
    setShowOverlays(tab === 'OVERLAY');
  };

  // Resolve video source if provided
  let resolvedVideoUrl: string | null = null;
  if (sourceUrl && sourceUrl.endsWith('.mp4')) {
    resolvedVideoUrl = sourceUrl.startsWith('/') ? sourceUrl : `/videos/${sourceUrl.split('/').pop()}`;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let step = 0;

    // Canvas Native Coordinate Grid
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

    // Perspective Geometry: Camera fixed at Signal Post Mast (Elevated 5.8m, front-angle facing approach)
    const horizonY = Math.floor(H * 0.36);
    const horizonRoadW = Math.floor(W * 0.28);
    const bottomRoadW = Math.floor(W * 0.94);
    const roadCenterX = Math.floor(W * 0.50);

    const horizonLeftX = roadCenterX - Math.floor(horizonRoadW / 2);
    const horizonRightX = roadCenterX + Math.floor(horizonRoadW / 2);

    const bottomLeftX = roadCenterX - Math.floor(bottomRoadW / 2);
    const bottomRightX = roadCenterX + Math.floor(bottomRoadW / 2);

    const stopLineY = Math.floor(H * 0.84);

    // Vehicle approach trajectory progression
    // Each vehicle progresses from t=0.02 (distant horizon) to t=1.05 (passes camera under signal post)
    interface ApproachVehicle {
      id: number;
      label: string;
      plate: string;
      lane: number; // 0: Left, 1: Center, 2: Right
      baseSpeed: number;
      speedKmh: number;
      conf: number;
      color: string;
      bodyColor: string;
      offset: number;
      isEmergency?: boolean;
    }

    const simVehicles: ApproachVehicle[] = [
      { id: 101, label: 'SEDAN', plate: 'TN 01 AB 1234', lane: 0, baseSpeed: 0.0035, speedKmh: 46, conf: 97.4, color: '#10B981', bodyColor: '#1E293B', offset: 0.08 },
      { id: 102, label: 'BUS', plate: 'KA 05 MN 3821', lane: 1, baseSpeed: 0.0026, speedKmh: 32, conf: 98.1, color: '#0EA5E9', bodyColor: '#0284C7', offset: 0.38 },
      { id: 103, label: 'SUV', plate: 'TN 09 BZ 9999', lane: 2, baseSpeed: 0.0041, speedKmh: 54, conf: 95.8, color: '#F59E0B', bodyColor: '#B45309', offset: 0.64 },
      { id: 104, label: emergencyDetected ? 'AMBULANCE' : 'HATCHBACK', plate: emergencyDetected ? 'TN 07 EM 108' : 'DL 03 XY 4410', lane: 1, baseSpeed: emergencyDetected ? 0.0055 : 0.0038, speedKmh: emergencyDetected ? 68 : 42, conf: 99.2, color: emergencyDetected ? '#EF4444' : '#6366F1', bodyColor: emergencyDetected ? '#FFFFFF' : '#4338CA', offset: 0.88, isEmergency: emergencyDetected },
      { id: 105, label: 'SEDAN', plate: 'TN 02 AX 7711', lane: 0, baseSpeed: 0.0033, speedKmh: 44, conf: 94.6, color: '#10B981', bodyColor: '#334155', offset: 0.72 }
    ];

    const render = () => {
      step += 1;
      ctx.clearRect(0, 0, W, H);

      // ==========================================
      // 1. SKY & URBAN HORIZON (Front-Angle Background)
      // ==========================================
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, '#0F172A');
      skyGrad.addColorStop(0.65, '#1E293B');
      skyGrad.addColorStop(1, '#334155');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, horizonY);

      // Distant City Skyline Silhouettes
      ctx.fillStyle = '#0F172A';
      const skylineBuildings = [
        { x: 0.05, w: 0.08, h: 60 },
        { x: 0.14, w: 0.06, h: 90 },
        { x: 0.22, w: 0.09, h: 50 },
        { x: 0.33, w: 0.07, h: 110 },
        { x: 0.62, w: 0.08, h: 80 },
        { x: 0.72, w: 0.09, h: 100 },
        { x: 0.83, w: 0.07, h: 65 },
        { x: 0.91, w: 0.08, h: 85 }
      ];
      skylineBuildings.forEach(b => {
        ctx.fillRect(W * b.x, horizonY - b.h, W * b.w, b.h);
        // Distant window lights
        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(W * b.x + 8, horizonY - b.h + 12, 3, 3);
        ctx.fillRect(W * b.x + 16, horizonY - b.h + 24, 3, 3);
        ctx.fillStyle = '#0F172A';
      });

      // Distant Flyover / Metro Viaduct crossing horizon
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, horizonY - 18, W, 14);
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, horizonY - 20, W, 2);

      // Horizon Ground Line
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, horizonY, W, 10);

      // ==========================================
      // 2. ASPHALT ROAD PERSPECTIVE (Approaching traffic)
      // ==========================================
      // Road Surface Polygon
      ctx.fillStyle = '#131A28';
      ctx.beginPath();
      ctx.moveTo(horizonLeftX, horizonY);
      ctx.lineTo(horizonRightX, horizonY);
      ctx.lineTo(bottomRightX, H);
      ctx.lineTo(bottomLeftX, H);
      ctx.closePath();
      ctx.fill();

      // Road Curbs / Sidewalk Shoulders (Left & Right)
      // Left Curb
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(horizonLeftX, horizonY);
      ctx.lineTo(bottomLeftX, H);
      ctx.lineTo(Math.max(0, bottomLeftX - 45), H);
      ctx.lineTo(Math.max(0, horizonLeftX - 12), horizonY);
      ctx.closePath();
      ctx.fill();

      // Right Curb
      ctx.beginPath();
      ctx.moveTo(horizonRightX, horizonY);
      ctx.lineTo(bottomRightX, H);
      ctx.lineTo(Math.min(W, bottomRightX + 45), H);
      ctx.lineTo(Math.min(W, horizonRightX + 12), horizonY);
      ctx.closePath();
      ctx.fill();

      // Yellow Road Edge Lines
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(horizonLeftX + 3, horizonY);
      ctx.lineTo(bottomLeftX + 12, H);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(horizonRightX - 3, horizonY);
      ctx.lineTo(bottomRightX - 12, H);
      ctx.stroke();

      // Perspective Lane Dividers (3 Lanes: Lane 0, Lane 1, Lane 2)
      // As lines approach the bottom, dash length and width scale up
      for (let l = 1; l <= 2; l++) {
        const ratio = l / 3;
        const topX = horizonLeftX + (horizonRightX - horizonLeftX) * ratio;
        const botX = bottomLeftX + (bottomRightX - bottomLeftX) * ratio;

        // Draw segmented dashed lines with perspective scaling
        const segments = 16;
        for (let s = 0; s < segments; s++) {
          const t1 = (s / segments) + ((step * 0.006) % (1 / segments));
          const t2 = Math.min(1.0, t1 + 0.035 * (0.3 + 0.7 * t1));

          if (t1 >= 1.0) continue;

          const sy1 = horizonY + (H - horizonY) * t1;
          const sx1 = topX + (botX - topX) * t1;
          const sy2 = horizonY + (H - horizonY) * t2;
          const sx2 = topX + (botX - topX) * t2;

          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = Math.max(1.5, 6 * t1);
          ctx.beginPath();
          ctx.moveTo(sx1, sy1);
          ctx.lineTo(sx2, sy2);
          ctx.stroke();
        }
      }

      // ==========================================
      // 3. STOP LINE & ZEBRA PEDESTRIAN CROSSING
      // ==========================================
      const stopLeftX = horizonLeftX + (bottomLeftX - horizonLeftX) * ((stopLineY - horizonY) / (H - horizonY));
      const stopRightX = horizonRightX + (bottomRightX - horizonRightX) * ((stopLineY - horizonY) / (H - horizonY));

      // White Stop Line
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(stopLeftX + 6, stopLineY);
      ctx.lineTo(stopRightX - 6, stopLineY);
      ctx.stroke();

      // Stop Line Text
      ctx.fillStyle = '#CBD5E1';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STOP LINE • ANPR TRIGGER ZONE', (stopLeftX + stopRightX) / 2, stopLineY - 10);
      ctx.textAlign = 'left';

      // Zebra Crossing Stripes (Foreground ahead of stop line)
      const zebraY1 = stopLineY + 14;
      const zebraY2 = Math.min(H - 10, stopLineY + 68);
      const zebraStripes = 14;
      for (let zi = 0; zi < zebraStripes; zi++) {
        const zt = zi / zebraStripes;
        const ztopX = stopLeftX + (stopRightX - stopLeftX) * zt;
        const zbotX = bottomLeftX + (bottomRightX - bottomLeftX) * zt;
        
        ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
        ctx.beginPath();
        ctx.moveTo(ztopX, zebraY1);
        ctx.lineTo(ztopX + 22, zebraY1);
        ctx.lineTo(zbotX + 32, zebraY2);
        ctx.lineTo(zbotX, zebraY2);
        ctx.closePath();
        ctx.fill();
      }

      // ==========================================
      // 4. SIGNAL POST MAST & OVERHEAD CANTILEVER
      // ==========================================
      // Pole on the right shoulder
      const poleBaseX = Math.min(W - 25, bottomRightX + 30);
      const poleTopY = horizonY - 110;
      
      // Steel Pole Mast
      ctx.fillStyle = '#475569';
      ctx.fillRect(poleBaseX, poleTopY, 14, H - poleTopY);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(poleBaseX + 2, poleTopY, 4, H - poleTopY); // Highlight

      // Horizontal Cantilever Gantry Arm stretching over road
      const armEnd = Math.max(roadCenterX - 40, horizonRightX - 80);
      ctx.fillStyle = '#334155';
      ctx.fillRect(armEnd, poleTopY, poleBaseX - armEnd + 14, 12);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(armEnd, poleTopY + 2, poleBaseX - armEnd + 14, 2);

      // Signal Head Housing (Mounted on Arm above Lane 2 / 1)
      const headX = roadCenterX + 80;
      const headY = poleTopY + 12;
      const headW = 34;
      const headH = 88;

      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(headX, headY, headW, headH);
      ctx.strokeRect(headX, headY, headW, headH);

      // Signal Visors & Lights (Red, Amber, Green)
      const activeSignal = (step % 400 < 220) ? 'GREEN' : (step % 400 < 260) ? 'AMBER' : 'RED';
      
      // Red Light
      ctx.fillStyle = (activeSignal === 'RED') ? '#EF4444' : '#3F1214';
      ctx.beginPath();
      ctx.arc(headX + headW / 2, headY + 18, 9, 0, Math.PI * 2);
      ctx.fill();
      if (activeSignal === 'RED') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        ctx.arc(headX + headW / 2, headY + 18, 16, 0, Math.PI * 2);
        ctx.fill();
      }

      // Amber Light
      ctx.fillStyle = (activeSignal === 'AMBER') ? '#F59E0B' : '#3F2C0B';
      ctx.beginPath();
      ctx.arc(headX + headW / 2, headY + 44, 9, 0, Math.PI * 2);
      ctx.fill();

      // Green Light
      ctx.fillStyle = (activeSignal === 'GREEN') ? '#10B981' : '#0B3322';
      ctx.beginPath();
      ctx.arc(headX + headW / 2, headY + 70, 9, 0, Math.PI * 2);
      ctx.fill();
      if (activeSignal === 'GREEN') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.beginPath();
        ctx.arc(headX + headW / 2, headY + 70, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // Digital Signal Countdown Timer
      ctx.fillStyle = '#020617';
      ctx.fillRect(headX + headW + 4, headY + 22, 38, 38);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(headX + headW + 4, headY + 22, 38, 38);
      ctx.fillStyle = (activeSignal === 'GREEN') ? '#10B981' : '#EF4444';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      const secLeft = (activeSignal === 'GREEN') ? 28 - Math.floor((step % 220) / 7.8) : (activeSignal === 'AMBER') ? 4 - Math.floor((step % 40) / 10) : 18 - Math.floor((step % 140) / 7.7);
      ctx.fillText(`${Math.max(1, secLeft)}`, headX + headW + 23, headY + 46);
      ctx.textAlign = 'left';

      // ==========================================
      // 5. APPROACHING VEHICLES (Front-Angle / Signal Post View)
      // ==========================================
      // Sort vehicles by progress t so distant vehicles render behind near ones
      const sortedVehicles = simVehicles.map(v => {
        const rawT = ((step * v.baseSpeed + v.offset) % 1.0);
        return { ...v, t: rawT };
      }).sort((a, b) => a.t - b.t);

      sortedVehicles.forEach(v => {
        const t = v.t;
        // Don't render if too close to horizon or already passed below frame
        if (t < 0.05 || t > 0.98) return;

        // Current road height along perspective
        const y = horizonY + (H - horizonY) * t;

        // Scale factor: small at horizon, large near camera
        const scale = 0.22 + 0.78 * Math.pow(t, 1.45);

        // Lane interpolation: lane 0 (Left), lane 1 (Center), lane 2 (Right)
        const laneRatio = (v.lane + 0.5) / 3.0;
        const laneTopX = horizonLeftX + (horizonRightX - horizonLeftX) * laneRatio;
        const laneBotX = bottomLeftX + (bottomRightX - bottomLeftX) * laneRatio;
        const x = laneTopX + (laneBotX - laneTopX) * t;

        // Vehicle Dimensions
        const baseW = (v.label === 'BUS') ? 210 : (v.label === 'SUV') ? 175 : 155;
        const baseH = (v.label === 'BUS') ? 160 : (v.label === 'SUV') ? 130 : 110;
        const vw = Math.floor(baseW * scale);
        const vh = Math.floor(baseH * scale);
        const vx = Math.floor(x - vw / 2);
        const vy = Math.floor(y - vh * 0.75);

        // ------------------------------------------
        // A. Headlight Beams illuminating asphalt
        // ------------------------------------------
        const beamH = Math.floor(130 * scale);
        const beamSpread = Math.floor(65 * scale);
        const leftLightX = vx + Math.floor(vw * 0.18);
        const rightLightX = vx + Math.floor(vw * 0.82);
        const lightY = vy + Math.floor(vh * 0.72);

        const beamGrad = ctx.createLinearGradient(0, lightY, 0, lightY + beamH);
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
        beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

        // Left beam
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(leftLightX, lightY);
        ctx.lineTo(leftLightX - beamSpread, lightY + beamH);
        ctx.lineTo(leftLightX + beamSpread * 0.5, lightY + beamH);
        ctx.closePath();
        ctx.fill();

        // Right beam
        ctx.beginPath();
        ctx.moveTo(rightLightX, lightY);
        ctx.lineTo(rightLightX - beamSpread * 0.5, lightY + beamH);
        ctx.lineTo(rightLightX + beamSpread, lightY + beamH);
        ctx.closePath();
        ctx.fill();

        // ------------------------------------------
        // B. Realistic Vehicle Front-Profile Body
        // ------------------------------------------
        // Vehicle Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.ellipse(x, vy + vh, vw * 0.55, vh * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Front Tires
        ctx.fillStyle = '#020617';
        const tireW = Math.max(5, Math.floor(18 * scale));
        const tireH = Math.max(8, Math.floor(28 * scale));
        ctx.fillRect(vx + Math.floor(vw * 0.08), vy + vh - tireH + 4, tireW, tireH);
        ctx.fillRect(vx + vw - Math.floor(vw * 0.08) - tireW, vy + vh - tireH + 4, tireW, tireH);

        // Lower Chassis & Bumper
        ctx.fillStyle = v.bodyColor;
        ctx.beginPath();
        ctx.roundRect(vx + Math.floor(vw * 0.06), vy + Math.floor(vh * 0.48), vw * 0.88, Math.floor(vh * 0.48), 6 * scale);
        ctx.fill();

        // Front Radiator Grille (Center Bumper)
        const grilleW = Math.floor(vw * 0.48);
        const grilleH = Math.floor(vh * 0.22);
        const grilleX = vx + Math.floor((vw - grilleW) / 2);
        const grilleY = vy + Math.floor(vh * 0.60);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(grilleX, grilleY, grilleW, grilleH);
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1;
        ctx.strokeRect(grilleX, grilleY, grilleW, grilleH);

        // Windshield (Front Slanted Glass)
        const windshieldW = Math.floor(vw * 0.72);
        const windshieldH = Math.floor(vh * 0.38);
        const windshieldX = vx + Math.floor((vw - windshieldW) / 2);
        const windshieldY = vy + Math.floor(vh * 0.16);

        const glassGrad = ctx.createLinearGradient(0, windshieldY, 0, windshieldY + windshieldH);
        glassGrad.addColorStop(0, '#38BDF8');
        glassGrad.addColorStop(0.35, '#0F172A');
        glassGrad.addColorStop(1, '#1E293B');
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.moveTo(windshieldX + Math.floor(windshieldW * 0.15), windshieldY);
        ctx.lineTo(windshieldX + Math.floor(windshieldW * 0.85), windshieldY);
        ctx.lineTo(windshieldX + windshieldW, windshieldY + windshieldH);
        ctx.lineTo(windshieldX, windshieldY + windshieldH);
        ctx.closePath();
        ctx.fill();

        // Windshield Glass Reflection Streak
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = Math.max(1, 2.5 * scale);
        ctx.beginPath();
        ctx.moveTo(windshieldX + Math.floor(windshieldW * 0.3), windshieldY + 2);
        ctx.lineTo(windshieldX + Math.floor(windshieldW * 0.15), windshieldY + windshieldH - 4);
        ctx.stroke();

        // Roof Panel
        ctx.fillStyle = v.bodyColor;
        ctx.beginPath();
        ctx.moveTo(windshieldX + Math.floor(windshieldW * 0.15), windshieldY);
        ctx.lineTo(windshieldX + Math.floor(windshieldW * 0.85), windshieldY);
        ctx.lineTo(windshieldX + Math.floor(windshieldW * 0.78), vy + 4);
        ctx.lineTo(windshieldX + Math.floor(windshieldW * 0.22), vy + 4);
        ctx.closePath();
        ctx.fill();

        // Side Mirrors
        const mirrorW = Math.max(4, Math.floor(14 * scale));
        const mirrorH = Math.max(3, Math.floor(9 * scale));
        ctx.fillStyle = v.bodyColor;
        ctx.fillRect(windshieldX - mirrorW + 2, windshieldY + Math.floor(windshieldH * 0.65), mirrorW, mirrorH);
        ctx.fillRect(windshieldX + windshieldW - 2, windshieldY + Math.floor(windshieldH * 0.65), mirrorW, mirrorH);

        // Dual Front Headlights (Lamps)
        const lampW = Math.max(6, Math.floor(22 * scale));
        const lampH = Math.max(4, Math.floor(12 * scale));
        const lampY = vy + Math.floor(vh * 0.54);

        ctx.fillStyle = '#FEF08A';
        // Left lamp
        ctx.fillRect(vx + Math.floor(vw * 0.10), lampY, lampW, lampH);
        // Right lamp
        ctx.fillRect(vx + vw - Math.floor(vw * 0.10) - lampW, lampY, lampW, lampH);

        // Emergency Ambulance Strobe Lights & Decals
        if (v.isEmergency) {
          const barY = vy - Math.floor(10 * scale);
          const barH = Math.max(4, Math.floor(8 * scale));
          const isRedFlash = (step % 12 < 6);

          // Left Strobe (Red)
          ctx.fillStyle = isRedFlash ? '#EF4444' : '#1E293B';
          ctx.fillRect(vx + Math.floor(vw * 0.3), barY, Math.floor(vw * 0.18), barH);
          if (isRedFlash) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
            ctx.beginPath();
            ctx.arc(vx + Math.floor(vw * 0.39), barY + barH / 2, 14 * scale, 0, Math.PI * 2);
            ctx.fill();
          }

          // Right Strobe (Blue)
          ctx.fillStyle = !isRedFlash ? '#3B82F6' : '#1E293B';
          ctx.fillRect(vx + Math.floor(vw * 0.52), barY, Math.floor(vw * 0.18), barH);
          if (!isRedFlash) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
            ctx.beginPath();
            ctx.arc(vx + Math.floor(vw * 0.61), barY + barH / 2, 14 * scale, 0, Math.PI * 2);
            ctx.fill();
          }

          // Front Emergency Red Cross on Hood
          const crossSize = Math.floor(16 * scale);
          const crossX = vx + Math.floor(vw / 2);
          const crossY = vy + Math.floor(vh * 0.44);
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(crossX - crossSize / 2, crossY - crossSize / 6, crossSize, crossSize / 3);
          ctx.fillRect(crossX - crossSize / 6, crossY - crossSize / 2, crossSize / 3, crossSize);
        }

        // ------------------------------------------
        // C. Authentic Indian Front Number Plate (HSRP)
        // ------------------------------------------
        const plateW = Math.max(36, Math.floor(vw * 0.46));
        const plateH = Math.max(12, Math.floor(vh * 0.16));
        const plateX = vx + Math.floor((vw - plateW) / 2);
        const plateY = vy + Math.floor(vh * 0.78);

        // White Reflective Plate Base
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(plateX, plateY, plateW, plateH);
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.strokeRect(plateX, plateY, plateW, plateH);

        // Blue "IND" strip on the left
        const indW = Math.max(3, Math.floor(plateW * 0.16));
        ctx.fillStyle = '#1D4ED8';
        ctx.fillRect(plateX, plateY, indW, plateH);

        // Plate Registration Text
        if (scale > 0.4) {
          ctx.fillStyle = '#090D16';
          const plateFontSz = Math.max(7, Math.floor(11 * scale));
          ctx.font = `bold ${plateFontSz}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(v.plate, plateX + indW + (plateW - indW) / 2, plateY + plateH * 0.76);
          ctx.textAlign = 'left';
        }

        // ==========================================
        // D. AI OVERLAY LAYER (Shown ONLY when selected)
        // ==========================================
        if (showOverlays) {
          // 1. Precision Bounding Box
          ctx.strokeStyle = v.color;
          ctx.lineWidth = Math.max(2, 3.5 * scale);
          ctx.strokeRect(vx, vy, vw, vh);

          // Corner Reticles
          const retSize = Math.max(6, Math.floor(14 * scale));
          ctx.fillStyle = v.color;
          // Top-Left
          ctx.fillRect(vx - 2, vy - 2, retSize, 3);
          ctx.fillRect(vx - 2, vy - 2, 3, retSize);
          // Top-Right
          ctx.fillRect(vx + vw - retSize + 2, vy - 2, retSize, 3);
          ctx.fillRect(vx + vw - 1, vy - 2, 3, retSize);
          // Bottom-Left
          ctx.fillRect(vx - 2, vy + vh - 1, retSize, 3);
          ctx.fillRect(vx - 2, vy + vh - retSize + 2, 3, retSize);
          // Bottom-Right
          ctx.fillRect(vx + vw - retSize + 2, vy + vh - 1, retSize, 3);
          ctx.fillRect(vx + vw - 1, vy + vh - retSize + 2, 3, retSize);

          // 2. Class, Confidence & Speed HUD Tag
          const tagH = Math.max(18, Math.floor(24 * scale));
          const tagW = Math.max(110, Math.floor(vw * 1.05));
          const tagX = vx;
          const tagY = Math.max(horizonY + 4, vy - tagH - 3);

          ctx.fillStyle = v.color;
          ctx.fillRect(tagX, tagY, tagW, tagH);

          ctx.fillStyle = '#020617';
          const hudFontSz = Math.max(9, Math.floor(12 * scale));
          ctx.font = `bold ${hudFontSz}px monospace`;
          ctx.fillText(`#${v.id} ${v.label} ${v.conf.toFixed(0)}% • ${v.speedKmh} km/h`, tagX + 5, tagY + tagH * 0.72);

          // 3. ANPR OCR Target Box framing the front plate
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = Math.max(1.5, 2.5 * scale);
          ctx.strokeRect(plateX - 3, plateY - 3, plateW + 6, plateH + 6);

          // Magnified OCR Plate Tag below vehicle
          const ocrTagH = Math.max(16, Math.floor(22 * scale));
          const ocrTagW = Math.max(120, Math.floor(vw * 0.95));
          const ocrTagX = vx + Math.floor((vw - ocrTagW) / 2);
          const ocrTagY = vy + vh + 6;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fillRect(ocrTagX, ocrTagY, ocrTagW, ocrTagH);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(ocrTagX, ocrTagY, ocrTagW, ocrTagH);

          ctx.fillStyle = '#38BDF8';
          const ocrFontSz = Math.max(8, Math.floor(11 * scale));
          ctx.font = `bold ${ocrFontSz}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(`ANPR: ${v.plate} (98%)`, ocrTagX + ocrTagW / 2, ocrTagY + ocrTagH * 0.72);
          ctx.textAlign = 'left';

          // 4. Trailing perspective speed vector
          ctx.strokeStyle = v.color + '55';
          ctx.lineWidth = Math.max(2, 4 * scale);
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(x, vy);
          ctx.lineTo(x, Math.max(horizonY, vy - 40 * scale));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // ==========================================
      // 6. REAL CCTV WATERMARK (Fixed on Signal Post)
      // ==========================================
      // Camera ID & Signal Post Mount HUD (Authentic Traffic Camera Watermark)
      const now = new Date();
      const timeStr = `${now.toISOString().replace('T', ' ').slice(0, 19)}.${String(now.getMilliseconds()).padStart(3, '0')}`;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(16, 16, 460, 48);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 16, 460, 48);

      // Blinking Green REC / LIVE Dot
      ctx.fillStyle = (Math.floor(step / 30) % 2 === 0) ? '#10B981' : '#047857';
      ctx.beginPath();
      ctx.arc(32, 34, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`CAM-01 • SIGNAL POST ELEV 5.8m • 1080p 30FPS`, 48, 34);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${timeStr} • FRONT-FACING APPROACH`, 48, 52);

      // View Mode Badge (Top Right)
      const modeW = showOverlays ? 240 : 210;
      ctx.fillStyle = showOverlays ? 'rgba(14, 165, 233, 0.95)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(W - modeW - 16, 16, modeW, 40);
      ctx.strokeStyle = showOverlays ? '#38BDF8' : '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(W - modeW - 16, 16, modeW, 40);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      if (showOverlays) {
        ctx.fillText('🧠 AI ANALYSIS OVERLAY ACTIVE', W - 16 - modeW / 2, 40);
      } else {
        ctx.fillText('📹 REAL VEHICLES FEED', W - 16 - modeW / 2, 40);
      }
      ctx.textAlign = 'left';

      // ==========================================
      // 7. AI OVERLAY DIAGNOSTIC BANNER (Bottom Left)
      // ==========================================
      if (showOverlays) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(16, H - 54, 380, 38);
        ctx.strokeStyle = '#0EA5E9';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(16, H - 54, 380, 38);

        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`AI ENGINE: YOLOv8x + PaddleOCR + DeepSORT`, 28, H - 36);
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`INFERENCE: 13.8ms • 30 FPS • SIGNAL SYNC: ${activeSignal}`, 28, H - 22);
      }

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(frameId);
  }, [emergencyDetected, showOverlays, effectiveRatio, deviceConfig]);

  // Source Type Badge Label
  let sourceBadge = { label: 'SIGNAL POST CAM', bg: 'bg-[#EAF7EF]', text: 'text-[#2E7D5B]', border: 'border-[#D2EADA]' };
  if (sourceType === 'REAL' || sourceType === 'RTSP') {
    sourceBadge = { label: 'LIVE SIGNAL POST', bg: 'bg-[#EAF7EF]', text: 'text-[#2E7D5B]', border: 'border-[#D2EADA]' };
  } else if (sourceType === 'MOBILE' || sourceType === 'MOBILE_DEVICE') {
    sourceBadge = { label: 'MOBILE STREAM', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
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
          <span className="hidden md:inline px-1.5 py-0.5 text-[9px] font-semibold rounded bg-slate-200 text-slate-700">
            FRONT ANGLE (SIGNAL POST)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          {/* PRIMARY VIEW MODE SWITCHER: Real Video (Default) vs AI Overlay */}
          <div className="flex items-center bg-slate-200 p-0.5 rounded-lg border border-slate-300 text-[11px] font-bold">
            <button
              onClick={() => handleTabChange('REAL')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'REAL'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="View clean real vehicle stream captured by signal post camera (Default)"
            >
              <Video className="w-3.5 h-3.5 text-[#245B84]" />
              <span>Real Video (Default)</span>
            </button>

            <button
              onClick={() => handleTabChange('OVERLAY')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'OVERLAY'
                  ? 'bg-[#245B84] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show AI analysis overlay with vehicle tracking, bounding boxes and ANPR OCR tags"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Overlay</span>
            </button>
          </div>

          {/* Quick Overlay Toggle Button */}
          <button
            onClick={() => {
              const nextState = !showOverlays;
              setShowOverlays(nextState);
              setActiveTab(nextState ? 'OVERLAY' : 'REAL');
            }}
            className={`px-2.5 py-1 border text-[10px] font-bold rounded flex items-center gap-1 transition-colors ${
              showOverlays
                ? 'bg-sky-50 border-sky-300 text-sky-800'
                : 'bg-white border-[#DCE4EA] text-slate-700 hover:bg-slate-100'
            }`}
          >
            {showOverlays ? <Eye className="w-3.5 h-3.5 text-[#245B84]" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>OVERLAY: {showOverlays ? 'ON' : 'OFF'}</span>
          </button>

          {/* Ratio Mode Switcher Controls */}
          <div className="hidden sm:flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300 text-[10px] font-bold">
            <span className="px-1.5 text-slate-500 flex items-center gap-1">
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

        {/* Live Status Floating Pill */}
        <div className="absolute top-3 left-3 pointer-events-none z-10 flex items-center gap-2">
          <span className="px-2 py-1 bg-black/75 backdrop-blur-md rounded text-[10px] font-bold text-white border border-white/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>SIGNAL POST #12 • FRONT VIEW</span>
          </span>
          {showOverlays && (
            <span className="px-2 py-1 bg-[#245B84]/90 backdrop-blur-md rounded text-[10px] font-bold text-white border border-sky-400/40 flex items-center gap-1">
              <Layers className="w-3 h-3 text-sky-300" />
              <span>YOLOv8 + ANPR OVERLAY</span>
            </span>
          )}
        </div>
      </div>

      {/* Telemetry Footer */}
      <div className="p-2.5 sm:p-3 bg-slate-50 border-t border-[#DCE4EA] grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-1.5 sm:p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase">ACTIVE VEHICLES</p>
          <p className="font-bold text-sm sm:text-base text-[#245B84]">{vehicleCount}</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase">APPROACH QUEUE</p>
          <p className="font-bold text-sm sm:text-base text-amber-700">{queueLength} veh</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-white rounded border border-[#DCE4EA]">
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase">LANE OCCUPANCY</p>
          <p className="font-bold text-sm sm:text-base text-[#2E7D5B]">{occupancyPct}%</p>
        </div>
      </div>
    </div>
  );
};
