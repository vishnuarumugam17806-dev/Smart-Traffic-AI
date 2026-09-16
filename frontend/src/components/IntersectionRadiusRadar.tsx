import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Radar,
  Radio,
  Zap,
  ArrowRight,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Car,
  Activity,
  Maximize2
} from 'lucide-react';
import { apiClient } from '../api/client';

interface ApproachConfig {
  key: string;
  name: string;
  direction: string;
  vehicle_count: number;
  queue_length: number;
  signal?: string;
  priority_score?: number;
}

interface IntersectionRadiusRadarProps {
  junctionId: number;
  junctionName: string;
  activeApproach: string;
  activeSignal: string; // GREEN, YELLOW, RED
  countdown: number;
  approaches: ApproachConfig[];
  onTriggerPass?: (approach: string) => void;
  onTriggerClear?: (approach: string) => void;
  onRefresh?: () => void;
}

interface SimVehicle {
  id: number;
  approach: string;
  distMeters: number; // Distance from intersection center (0 - 100m)
  speedKmh: number;
  color: string;
  type: string;
  passedRadius: boolean;
  passTime?: number;
}

export const IntersectionRadiusRadar: React.FC<IntersectionRadiusRadarProps> = ({
  junctionId,
  junctionName,
  activeApproach,
  activeSignal,
  countdown,
  approaches,
  onTriggerPass,
  onTriggerClear,
  onRefresh,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSimActive, setIsSimActive] = useState<boolean>(true);
  const [vehicles, setVehicles] = useState<SimVehicle[]>([]);
  const [switchBanner, setSwitchBanner] = useState<string | null>(null);
  const [localApproaches, setLocalApproaches] = useState<ApproachConfig[]>(approaches);
  const [totalPassedCount, setTotalPassedCount] = useState<number>(0);
  const [lastEventText, setLastEventText] = useState<string>(
    'System monitoring 60m radius zone. When vehicle passes radius and approach has 0 vehicles, signal auto-switches.'
  );

  // 360-Degree Continuous Scanning Needle & Animation Loop Refs
  const scanAngleRef = useRef<number>(0);
  const vehiclesRef = useRef<SimVehicle[]>([]);
  const activeApproachRef = useRef<string>(activeApproach);
  const activeSignalRef = useRef<string>(activeSignal);
  const countdownRef = useRef<number>(countdown);
  const localApproachesRef = useRef<ApproachConfig[]>(approaches);
  const isSimActiveRef = useRef<boolean>(true);
  const junctionIdRef = useRef<number>(junctionId);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    activeApproachRef.current = activeApproach;
  }, [activeApproach]);

  useEffect(() => {
    activeSignalRef.current = activeSignal;
  }, [activeSignal]);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    localApproachesRef.current = localApproaches;
  }, [localApproaches]);

  useEffect(() => {
    isSimActiveRef.current = isSimActive;
  }, [isSimActive]);

  useEffect(() => {
    junctionIdRef.current = junctionId;
  }, [junctionId]);

  // Sync incoming approaches
  useEffect(() => {
    setLocalApproaches(approaches);
  }, [approaches]);

  // Initialize initial vehicles distributed across approaches
  useEffect(() => {
    const initial: SimVehicle[] = [];
    const colors = ['#38BDF8', '#34D399', '#FBBF24', '#F472B6', '#A78BFA'];
    let vId = 101;

    localApproaches.forEach((app) => {
      const count = Math.min(5, Math.max(1, Math.round(app.vehicle_count || 3)));
      for (let i = 0; i < count; i++) {
        initial.push({
          id: vId++,
          approach: app.key,
          distMeters: 25 + i * 16, // Distance from intersection center (meters)
          speedKmh: 35 + Math.floor(Math.random() * 15),
          color: colors[i % colors.length],
          type: i === 0 ? 'SEDAN' : i === 1 ? 'SUV' : 'BUS',
          passedRadius: false
        });
      }
    });

    setVehicles(initial);
  }, [junctionId]);

  // Radius parameter in meters
  const DETECTION_RADIUS_M = 60.0;

  // Handle a vehicle passing the radius boundary
  const handlePassVehicle = async () => {
    const activeAppKey = activeApproach.toUpperCase();

    // Find the closest vehicle on the active approach inside radius
    const targetVehIndex = vehicles.findIndex(
      (v) => v.approach.toUpperCase() === activeAppKey && !v.passedRadius
    );

    let remainingOnActive = 0;

    if (targetVehIndex !== -1) {
      setVehicles((prev) => {
        const next = [...prev];
        next[targetVehIndex] = {
          ...next[targetVehIndex],
          distMeters: Math.max(-25, next[targetVehIndex].distMeters - 30),
          passedRadius: true,
          passTime: Date.now()
        };
        remainingOnActive = next.filter(
          (v) => v.approach.toUpperCase() === activeAppKey && !v.passedRadius
        ).length;
        return next;
      });
    }

    setTotalPassedCount((c) => c + 1);

    try {
      const res = await apiClient.post(`/intersections/${junctionId}/vehicle-pass`, {
        approach: activeAppKey,
        vehicle_id: `VEH-${Date.now().toString().slice(-4)}`
      });

      if (res.data) {
        const remaining = res.data.vehicles_remaining;
        if (res.data.auto_switched_to_next || remaining === 0) {
          showAutoSwitchNotice(activeAppKey, res.data.reasoning);
        } else {
          setLastEventText(
            `Vehicle passed 60m radius on ${activeAppKey}. ${remaining} vehicle(s) remaining in approach zone.`
          );
        }
      }
      if (onRefresh) onRefresh();
    } catch (e) {
      // Fallback local simulation if backend offline
      if (remainingOnActive === 0) {
        showAutoSwitchNotice(
          activeAppKey,
          `Vehicle passed 60m radius. Approach ${activeAppKey} has 0 vehicles. Automatically switching signal to next approach.`
        );
      } else {
        setLastEventText(
          `Vehicle passed 60m radius on ${activeAppKey}. ${remainingOnActive} vehicle(s) remaining in approach zone.`
        );
      }
    }
  };

  // Handle clearing the entire active approach (0 vehicles remaining)
  const handleClearApproach = async () => {
    const activeAppKey = activeApproach.toUpperCase();

    // Mark all vehicles on active approach as passed
    setVehicles((prev) =>
      prev.map((v) =>
        v.approach.toUpperCase() === activeAppKey
          ? { ...v, distMeters: -30, passedRadius: true, passTime: Date.now() }
          : v
      )
    );

    try {
      const res = await apiClient.post(`/intersections/${junctionId}/clear-approach`, {
        approach: activeAppKey
      });
      if (res.data) {
        showAutoSwitchNotice(activeAppKey, res.data.reasoning);
      }
      if (onRefresh) onRefresh();
    } catch (e) {
      showAutoSwitchNotice(
        activeAppKey,
        `All vehicles passed radius. 0 vehicles remaining on ${activeAppKey}. Signal automatically changing and switching to next approach.`
      );
    }
  };

  // Spawn new vehicle on active approach for continuous testing
  const handleAddVehicle = () => {
    const activeAppKey = activeApproach.toUpperCase();
    const newVeh: SimVehicle = {
      id: Date.now() % 10000,
      approach: activeAppKey,
      distMeters: 75 + Math.random() * 15,
      speedKmh: 42,
      color: '#38BDF8',
      type: 'SEDAN',
      passedRadius: false
    };
    setVehicles((prev) => [...prev, newVeh]);
    setLastEventText(`Spawned new vehicle on ${activeAppKey} approach at 80m distance from intersection.`);
  };

  const showAutoSwitchNotice = (approach: string, reason?: string) => {
    const msg = `⚡ VEHICLE PASSED RADIUS — 0 VEHICLES REMAINING ON ${approach} — AUTO-SWITCHING TO NEXT APPROACH!`;
    setSwitchBanner(msg);
    setLastEventText(
      reason ||
        `Zero-waste adaptive clearance: Approach ${approach} empty. Transitioning via Yellow clearance to next queued approach.`
    );
    setTimeout(() => {
      setSwitchBanner(null);
    }, 4500);
  };

  // Canvas Radar Animation: Continuous 360-Degree Sweeping Needle & Phosphor Trail
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      step += 1;
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;

      // Scale: 100m mapped to outer radius
      const maxRadiusPx = Math.min(cx, cy) - 46;
      const radiusScale = maxRadiusPx / 100.0;
      const detRadiusPx = DETECTION_RADIUS_M * radiusScale;

      ctx.clearRect(0, 0, width, height);

      // 1. Radar Circular Background
      const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxRadiusPx + 30);
      bgGrad.addColorStop(0, '#0F172A');
      bgGrad.addColorStop(0.65, '#070E1C');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. 360° Azimuth Compass Rose Outer Ring & Degree Markings
      const dialR = maxRadiusPx + 16;
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, dialR, 0, Math.PI * 2);
      ctx.stroke();

      // Draw 360 degree ticks around entire circular perimeter
      for (let d = 0; d < 360; d += 10) {
        const rad = (d * Math.PI) / 180;
        const isMajor = d % 30 === 0;
        const isCardinal = d % 90 === 0;
        const tickInner = isCardinal ? dialR - 10 : isMajor ? dialR - 7 : dialR - 4;

        const x1 = cx + Math.cos(rad) * dialR;
        const y1 = cy + Math.sin(rad) * dialR;
        const x2 = cx + Math.cos(rad) * tickInner;
        const y2 = cy + Math.sin(rad) * tickInner;

        ctx.strokeStyle = isCardinal ? '#34D399' : isMajor ? '#94A3B8' : 'rgba(100, 116, 139, 0.4)';
        ctx.lineWidth = isCardinal ? 2 : isMajor ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 360° Degree labels on major ticks
        if (isMajor && !isCardinal) {
          const textR = dialR - 16;
          const tx = cx + Math.cos(rad) * textR;
          const ty = cy + Math.sin(rad) * textR;
          ctx.fillStyle = '#64748B';
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(d).padStart(3, '0'), tx, ty);
        }
      }

      // 3. Concentric Distance Grid Circles (20m, 40m, 60m Detection Radius, 80m, 100m)
      const distances = [20, 40, DETECTION_RADIUS_M, 80, 100];
      distances.forEach((d) => {
        const r = d * radiusScale;
        const isDetectionRadius = d === DETECTION_RADIUS_M;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (isDetectionRadius) {
          // Highlighted 60m Detection Radius Ring
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Glowing aura for detection radius
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.lineWidth = 8;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Distance Label
        ctx.fillStyle = isDetectionRadius ? '#34D399' : '#64748B';
        ctx.font = isDetectionRadius ? 'bold 10px monospace' : '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(
          isDetectionRadius ? `60m DETECTION RADIUS` : `${d}m`,
          cx + 6,
          cy - r + (isDetectionRadius ? 12 : -3)
        );
      });

      // 4. Radar Crosshair Axis Lines
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - maxRadiusPx, cy);
      ctx.lineTo(cx + maxRadiusPx, cy);
      ctx.moveTo(cx, cy - maxRadiusPx);
      ctx.lineTo(cx, cy + maxRadiusPx);
      ctx.stroke();

      // 5. Approach Corridors & Signal Lanterns
      const dirAngles: Record<string, number> = {
        NORTH: -Math.PI / 2,
        EAST: 0,
        SOUTH: Math.PI / 2,
        WEST: Math.PI
      };

      const curActiveApproach = activeApproachRef.current.toUpperCase();
      const curActiveSignal = activeSignalRef.current;
      const curCountdown = countdownRef.current;

      localApproachesRef.current.forEach((app) => {
        const dir = app.direction.toUpperCase();
        const angle = dirAngles[dir] ?? 0;
        const isCurrentActive = curActiveApproach === dir;

        // Approach Corridor Road Lines
        const roadW = 32;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Road track
        ctx.strokeStyle = isCurrentActive
          ? curActiveSignal === 'GREEN'
            ? 'rgba(16, 185, 129, 0.3)'
            : 'rgba(245, 158, 11, 0.3)'
          : 'rgba(51, 65, 85, 0.45)';
        ctx.lineWidth = roadW;
        ctx.beginPath();
        ctx.moveTo(cx + cosA * 20, cy + sinA * 20);
        ctx.lineTo(cx + cosA * maxRadiusPx, cy + sinA * maxRadiusPx);
        ctx.stroke();

        // Direction Name Label with 360 Cardinal Header
        const labelR = maxRadiusPx + 28;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = isCurrentActive ? '#10B981' : '#CBD5E1';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cardinalHeading = dir === 'NORTH' ? '000° N' : dir === 'EAST' ? '090° E' : dir === 'SOUTH' ? '180° S' : '270° W';
        ctx.fillText(cardinalHeading, lx, ly);

        // Signal Lantern Indicator on each approach corridor
        const signalR = detRadiusPx + 14;
        const sigX = cx + Math.cos(angle) * signalR;
        const sigY = cy + Math.sin(angle) * signalR;

        const approachSignalState = isCurrentActive ? curActiveSignal : 'RED';
        const sigColor =
          approachSignalState === 'GREEN'
            ? '#10B981'
            : approachSignalState === 'YELLOW'
            ? '#F59E0B'
            : '#EF4444';

        // Signal Lantern Housing
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sigX, sigY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Signal Bulb Glowing
        ctx.fillStyle = sigColor;
        ctx.beginPath();
        ctx.arc(sigX, sigY, 6, 0, Math.PI * 2);
        ctx.fill();

        if (isCurrentActive) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.beginPath();
          ctx.arc(sigX, sigY, 14, 0, Math.PI * 2);
          ctx.fill();

          // Countdown beside active signal
          ctx.fillStyle = sigColor;
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${curCountdown}s`, sigX + (cosA !== 0 ? 0 : 16), sigY + (sinA !== 0 ? 0 : 14));
        }
      });

      // 6. CONTINUOUS 360° SPINNING RADAR SCANNING NEEDLE & PHOSPHOR SWEEP
      if (isSimActiveRef.current) {
        scanAngleRef.current = (scanAngleRef.current + 0.034) % (Math.PI * 2);
      }
      const scanAngle = scanAngleRef.current;
      const sweepX = cx + Math.cos(scanAngle) * maxRadiusPx;
      const sweepY = cy + Math.sin(scanAngle) * maxRadiusPx;

      // 360° Bearing in degrees (000° to 359°)
      const bearingDeg = Math.round(((scanAngle + Math.PI / 2) % (Math.PI * 2)) * (180 / Math.PI));

      // Authentic 360° Trailing Phosphor Sweep Wedge
      const numSlices = 36;
      const tailArc = 0.95; // ~55 degrees trailing beam
      for (let i = 0; i < numSlices; i++) {
        const a1 = scanAngle - ((i + 1) / numSlices) * tailArc;
        const a2 = scanAngle - (i / numSlices) * tailArc;
        const progress = (numSlices - i) / numSlices;
        const alpha = Math.pow(progress, 2.3) * 0.42;

        ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadiusPx, a1, a2);
        ctx.closePath();
        ctx.fill();
      }

      // Bright Phosphor Scanning Needle Line
      // Outer glow
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // Mid neon beam
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // Bright laser core needle
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // Scanning Needle Tip Beacon (Rotating Phosphor Dot on Perimeter)
      ctx.fillStyle = 'rgba(52, 211, 153, 0.6)';
      ctx.beginPath();
      ctx.arc(sweepX, sweepY, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sweepX, sweepY, 3, 0, Math.PI * 2);
      ctx.fill();

      // 7. Radar Central Transceiver Hub & Expanding Radio Wave Ripple
      const pulseProgress = (step % 80) / 80;
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.8 * (1 - pulseProgress)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 18 + pulseProgress * 42, 0, Math.PI * 2);
      ctx.stroke();

      // Hub Housing
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`J#${junctionIdRef.current}`, cx, cy);

      // 8. Render Vehicles with 360° Phosphor Ping Excitation
      const curVehicles = vehiclesRef.current;
      curVehicles.forEach((veh) => {
        const dir = veh.approach.toUpperCase();
        const angle = dirAngles[dir] ?? 0;
        const distPx = veh.distMeters * radiusScale;

        // Coordinates
        const vx = cx + Math.cos(angle) * distPx;
        const vy = cy + Math.sin(angle) * distPx;

        // Check if the 360° scanning needle just swept over this vehicle
        const angDiff = Math.abs((scanAngle - angle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        const isSwept = angDiff < 0.35;

        // Vehicle Ping Glow when needle passes
        if (isSwept) {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
          ctx.beginPath();
          ctx.arc(vx, vy, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(vx, vy, 9, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Vehicle Marker Dot
        const isPassed = veh.distMeters <= 0 || veh.passedRadius;
        ctx.fillStyle = isPassed ? '#10B981' : veh.color;
        ctx.beginPath();
        ctx.arc(vx, vy, isPassed ? 5 : 6, 0, Math.PI * 2);
        ctx.fill();

        // Direction heading triangle towards center
        const headingAngle = angle + Math.PI;
        const arrowLen = 9;
        const tipX = vx + Math.cos(headingAngle) * arrowLen;
        const tipY = vy + Math.sin(headingAngle) * arrowLen;

        ctx.strokeStyle = isPassed ? '#34D399' : '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Vehicle Distance Tag
        ctx.fillStyle = isSwept ? '#34D399' : '#E2E8F0';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(
          isPassed ? `PASSED` : `${Math.max(0, Math.round(veh.distMeters))}m`,
          vx + 10,
          vy - 6
        );

        // Passed Radius Spark Ring Animation
        if (isPassed && veh.passTime && Date.now() - veh.passTime < 2500) {
          const elapsed = (Date.now() - veh.passTime) / 2500;
          ctx.strokeStyle = `rgba(16, 185, 129, ${1.0 - elapsed})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(vx, vy, 8 + elapsed * 22, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // 9. Move vehicles smoothly if simulation is active
      if (isSimActiveRef.current && curActiveSignal === 'GREEN') {
        vehiclesRef.current.forEach((v) => {
          if (v.approach.toUpperCase() === curActiveApproach) {
            const moveMeters = (v.speedKmh * 1000) / 3600 / 60; // Meters moved per frame at 60fps
            const newDist = v.distMeters - moveMeters;
            if (v.distMeters >= 0 && newDist < 0) {
              v.passedRadius = true;
              v.passTime = Date.now();
            }
            v.distMeters = newDist < -35 ? -35 : newDist;
          }
        });
      }

      // 10. Live 360° Radar Scanning HUD at the top
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(width / 2 - 140, 10, 280, 22);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - 140, 10, 280, 22);

      // Blinking Green radar scanning dot
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(width / 2 - 124, 21, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`360° RADAR SWEEP • BEARING: ${String(bearingDeg).padStart(3, '0')}° • 32 RPM`, width / 2 + 6, 21);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const activeAppConfig =
    localApproaches.find((a) => a.key.toUpperCase() === activeApproach.toUpperCase()) ||
    localApproaches[0];

  const vehiclesInActiveRadius = vehicles.filter(
    (v) => v.approach.toUpperCase() === activeApproach.toUpperCase() && !v.passedRadius
  ).length;

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg select-none font-mono text-white">
      {/* Header Bar */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-xs tracking-wider text-slate-100 uppercase">
                INTERSECTION DETECTION RADIUS (60m) & ZERO-WASTE AUTO-SWITCH RADAR
              </h3>
              <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PROXIMITY ENGINE ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Detects vehicles crossing the 60m radius zone. When all vehicles pass and 0 remain, signal automatically switches to the next approach.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setIsSimActive((prev) => !prev)}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors border ${
              isSimActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
            }`}
          >
            {isSimActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimActive ? 'PAUSE RADAR' : 'RESUME RADAR'}</span>
          </button>
        </div>
      </div>

      {/* Auto-Switch Instant Announcement Flash Banner */}
      {switchBanner && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-2 text-white text-xs font-extrabold flex items-center justify-between animate-pulse shadow-md">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>{switchBanner}</span>
          </div>
          <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded">ZERO-WASTE SWITCH</span>
        </div>
      )}

      {/* Main Radar Grid (Left Canvas, Right Interactive Telemetry & Triggers) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-slate-800">
        {/* Radar Canvas (7 cols) */}
        <div className="lg:col-span-7 relative flex items-center justify-center bg-slate-950 p-2 min-h-[380px]">
          <canvas
            ref={canvasRef}
            width={520}
            height={380}
            className="w-full max-w-[520px] aspect-4/3 rounded-lg border border-slate-800 shadow-inner"
          />

          {/* Overlay Corner Legends */}
          <div className="absolute top-4 left-4 pointer-events-none space-y-1">
            <div className="px-2 py-1 rounded bg-slate-900/80 backdrop-blur-xs border border-slate-700 text-[10px] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>ACTIVE APPROACH: <strong className="text-emerald-400">{activeApproach}</strong></span>
            </div>
            <div className="px-2 py-1 rounded bg-slate-900/80 backdrop-blur-xs border border-slate-700 text-[10px]">
              <span>SIGNAL: <strong className={activeSignal === 'GREEN' ? 'text-emerald-400' : 'text-amber-400'}>{activeSignal} ({countdown}s)</strong></span>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 pointer-events-none">
            <div className="px-2.5 py-1 rounded bg-slate-900/90 backdrop-blur-xs border border-slate-700 text-[9px] text-slate-300 space-y-0.5">
              <div>🎯 <strong>60m RADIUS</strong> GEOFENCE ACTIVE</div>
              <div>⚡ AUTO-SWITCH ON <strong>0 VEHICLES</strong></div>
            </div>
          </div>
        </div>

        {/* Right Telemetry & Interactive Switch Controls (5 cols) */}
        <div className="lg:col-span-5 p-4 bg-slate-900/90 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                APPROACH RADIUS TELEMETRY
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {localApproaches.length}-APPROACH DYNAMIC
              </span>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Vehicles in 60m Radius</span>
                <span className="text-lg font-black text-emerald-400">{vehiclesInActiveRadius} veh</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Total Passed Radius</span>
                <span className="text-lg font-black text-cyan-400">{totalPassedCount} passed</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Detection Radius</span>
                <span className="text-base font-bold text-slate-200">60.0 meters</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Auto-Switch Behavior</span>
                <span className="text-xs font-bold text-emerald-400">INSTANT ON 0 VEH</span>
              </div>
            </div>

            {/* Live Event Reasoning Log */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                <Zap className="w-3 h-3" /> REAL-TIME RADAR LOG:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                {lastEventText}
              </p>
            </div>
          </div>

          {/* Interactive Test Triggers (Judge & User Demonstrator) */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              INTERACTIVE DEMO CONTROLS (TEST ZERO-WASTE SWITCH):
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePassVehicle}
                className="py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Car className="w-3.5 h-3.5" />
                <span>Pass 1 Vehicle (Radius)</span>
              </button>

              <button
                type="button"
                onClick={handleClearApproach}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Clear Approach (0 Veh)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddVehicle}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>➕ Add Vehicle to Approach Queue</span>
            </button>
          </div>
        </div>
      </div>

      {/* Approach Breakdown Strip */}
      <div className="p-3 bg-slate-950 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {localApproaches.map((app) => {
          const isCurr = app.key.toUpperCase() === activeApproach.toUpperCase();
          const count = vehicles.filter(
            (v) => v.approach.toUpperCase() === app.key.toUpperCase() && !v.passedRadius
          ).length;

          return (
            <div
              key={app.key}
              className={`p-2 rounded border flex items-center justify-between ${
                isCurr
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <div>
                <span className="font-bold block text-[11px]">{app.name || app.key}</span>
                <span className="text-[10px] text-slate-400">Inside Radius: {count} veh</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  isCurr
                    ? activeSignal === 'GREEN'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-500 text-slate-950'
                    : 'bg-red-500/30 text-red-300 border border-red-500/40'
                }`}
              >
                {isCurr ? activeSignal : 'RED'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
