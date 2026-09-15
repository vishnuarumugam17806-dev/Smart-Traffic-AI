import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Camera,
  Wifi,
  Battery,
  MapPin,
  User,
  Power,
  Plus,
  RefreshCw,
  CheckCircle2,
  Shield,
  QrCode,
  Clock,
  XCircle,
  ExternalLink,
  Copy,
  Radio,
  Eye,
  Film,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../api/client';
import { Link } from 'react-router-dom';

export const LinkDeviceCamera: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'QR' | 'MANUAL'>('QR');
  const [copied, setCopied] = useState<boolean>(false);

  // Live Mobile Stream Monitor State (Section 18 & 19)
  const [selectedStreamDeviceId, setSelectedStreamDeviceId] = useState<string>('MOBILE-CAM-001');
  const [liveFrameBase64, setLiveFrameBase64] = useState<string | null>(null);
  const [liveStreamFps, setLiveStreamFps] = useState<number>(0);
  const [liveBattery, setLiveBattery] = useState<number>(94);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState<boolean>(false);
  const [lastCapturedPlate, setLastCapturedPlate] = useState<string | null>(null);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);

  // Pairing session state
  const [pairingCode] = useState<string>('482931');
  const [pairingToken] = useState<string>('PAIR-TOKEN-9823471');
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes (300 seconds)
  const [pairingStatus, setPairingStatus] = useState<'WAITING' | 'CONNECTED' | 'EXPIRED' | 'CANCELLED'>('WAITING');

  // Form states
  const [deviceId, setDeviceId] = useState<string>('MOBILE-CAM-002');
  const [name, setName] = useState<string>('Patrol Device North');
  const [operatorId, setOperatorId] = useState<string>('OFFICER_204');
  const [location, setLocation] = useState<string>('North Corridor Flyover');

  const fetchDevices = async () => {
    try {
      const res = await apiClient.get('/devices');
      if (Array.isArray(res.data)) {
        setDevices(res.data);
        if (res.data.length > 0 && !selectedStreamDeviceId) {
          setSelectedStreamDeviceId(res.data[0].device_id);
        }
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 4000);
    return () => clearInterval(interval);
  }, []);

  // Poll for live stream frame pushed from active mobile camera
  useEffect(() => {
    let frameTimer: any;
    const fetchLiveFrame = async () => {
      try {
        const res = await apiClient.get(`/mobile-camera/${selectedStreamDeviceId}/live-frame`);
        if (res.data && res.data.frame_base64) {
          setLiveFrameBase64(res.data.frame_base64);
          setLiveStreamFps(res.data.fps || 24);
          if (res.data.battery_pct) setLiveBattery(res.data.battery_pct);
        }
      } catch (err) {}
    };

    fetchLiveFrame();
    frameTimer = setInterval(fetchLiveFrame, 1200);
    return () => clearInterval(frameTimer);
  }, [selectedStreamDeviceId]);

  // 5-minute Countdown Timer Effect for QR Pairing
  useEffect(() => {
    let timer: any;
    if (showLinkModal && pairingStatus === 'WAITING' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setPairingStatus('EXPIRED');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showLinkModal, pairingStatus, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGenerateNewQR = () => {
    setTimeLeft(300);
    setPairingStatus('WAITING');
  };

  const handleCancelPairing = () => {
    setPairingStatus('CANCELLED');
    setShowLinkModal(false);
  };

  const handleLinkDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      await apiClient.post('/devices/link', {
        device_id: deviceId,
        name: name,
        operator_id: operatorId,
        assigned_location: location
      });
      setPairingStatus('CONNECTED');
      setShowLinkModal(false);
      fetchDevices();
    } catch (err) {
      console.error('Error linking device:', err);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await apiClient.post(`/devices/${id}/disconnect`);
      fetchDevices();
    } catch (err) {
      console.error('Error disconnecting device:', err);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiClient.post(`/devices/${id}/revoke`);
      fetchDevices();
    } catch (err) {
      console.error('Error revoking device:', err);
    }
  };

  // Trigger remote photo capture & ANPR inspection from desktop
  const handleRemotePhotoCapture = async () => {
    setIsCapturingSnapshot(true);
    try {
      const activeDev = devices.find((d) => d.device_id === selectedStreamDeviceId);
      const res = await apiClient.post('/mobile-camera/capture-photo', {
        photo_base64: liveFrameBase64 || 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
        device_id: selectedStreamDeviceId,
        operator_id: activeDev?.operator_id || 'OFFICER-FIELD',
        location: activeDev?.assigned_location || 'Anna Salai Corridor'
      });

      if (res.data?.plate_number) {
        setLastCapturedPlate(res.data.plate_number);
        setCaptureFeedback(
          `Photo captured & indexed in RECORDS. ANPR Plate Detected: ${res.data.plate_number} (${res.data.event_type})`
        );
      } else {
        setCaptureFeedback('Photo captured & indexed in RECORDS. Stored in Evidence Vault.');
      }
      setTimeout(() => setCaptureFeedback(null), 6000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const mobileCameraPath = `/mobile-camera?token=${pairingToken}&code=${pairingCode}`;
  const localUrl = `${window.location.origin}${mobileCameraPath}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeDeviceObj = devices.find((d) => d.device_id === selectedStreamDeviceId) || devices[0];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-[#F6F8FA] min-h-screen select-none font-sans overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight uppercase font-mono">
            LINK MOBILE CAMERA & FIELD SURVEILLANCE
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            WebRTC Mobile Field Camera Pairing, Live Desktop Stream & ANPR Event Analysis (Sections 18-23, 30)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Link
            to="/recordings"
            className="flex-1 md:flex-initial px-3.5 py-2.5 min-h-[44px] bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Film className="w-4 h-4" /> OPEN RECORDS
          </Link>
          <a
            href="/mobile-camera"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial px-3.5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <ExternalLink className="w-4 h-4" /> OPEN MOBILE PATROL CAMERA
          </a>
          <button
            onClick={() => {
              setShowLinkModal(true);
              handleGenerateNewQR();
            }}
            className="flex-1 md:flex-initial px-4 py-2.5 min-h-[44px] bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> LINK NEW CAMERA
          </button>
        </div>
      </div>

      {/* SECTION 18: DESKTOP CONTROL ROOM LIVE MOBILE CAMERA FEED */}
      <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-600 animate-pulse" />
            <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase tracking-wide">
              SECTION 18 – LIVE MOBILE PATROL CAMERA FEED (DESKTOP CONTROL ROOM)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedStreamDeviceId}
              onChange={(e) => setSelectedStreamDeviceId(e.target.value)}
              className="bg-slate-50 border border-[#DCE4EA] rounded px-2.5 py-1 text-xs font-mono text-slate-800 focus:outline-none"
            >
              <option value="MOBILE-CAM-001">Device: MOBILE-CAM-001 (Field Unit 1)</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  Device: {d.device_id} ({d.name})
                </option>
              ))}
            </select>

            <button
              onClick={handleRemotePhotoCapture}
              disabled={isCapturingSnapshot}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isCapturingSnapshot ? 'CAPTURING...' : 'CAPTURE PHOTO'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {captureFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded font-mono text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{captureFeedback}</span>
            </div>
            <Link to="/recordings" className="underline font-bold text-emerald-800 shrink-0">
              View in Records →
            </Link>
          </div>
        )}

        {/* Live Stream Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Video Screen (8 cols) */}
          <div className="lg:col-span-8 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 aspect-video relative flex items-center justify-center">
            {liveFrameBase64 ? (
              <img
                src={liveFrameBase64}
                alt="Live Mobile Camera Feed"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-6 space-y-3 font-mono text-slate-400">
                <Smartphone className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                <p className="text-xs font-bold text-slate-300">WAITING FOR LIVE MOBILE STREAM FRAMES</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Open the Mobile Patrol Camera in your mobile browser or scan the pairing QR code to stream live video directly to this desktop view.
                </p>
                <a
                  href="/mobile-camera"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#245B84] hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> Launch Field Camera Simulator Tab
                </a>
              </div>
            )}

            {/* Overlays */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className="px-2 py-0.5 bg-red-600 text-white font-mono font-extrabold text-[9px] rounded flex items-center gap-1 shadow-md animate-pulse">
                <Radio className="w-2.5 h-2.5" /> LIVE
              </span>
              <span className="px-2 py-0.5 bg-slate-900/80 text-white font-mono text-[9px] rounded backdrop-blur-xs">
                {selectedStreamDeviceId}
              </span>
            </div>

            {lastCapturedPlate && (
              <div className="absolute bottom-3 left-3 px-3 py-1 bg-amber-400 text-slate-950 font-mono font-black text-xs rounded shadow-lg border border-amber-500">
                ANPR IDENTIFIED: {lastCapturedPlate}
              </div>
            )}

            <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-slate-900/80 text-slate-300 font-mono text-[9px] rounded">
              FPS: {liveStreamFps || 24.0} | 5G
            </div>
          </div>

          {/* Telemetry & Device Info (4 cols) */}
          <div className="lg:col-span-4 bg-slate-50 p-4 rounded-lg border border-[#DCE4EA] space-y-3 font-mono text-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-700 uppercase">TELEMETRY & SENSORS</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">
                  ACTIVE STREAM
                </span>
              </div>

              <div className="space-y-2 text-slate-600 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Device Name:</span>
                  <span className="font-bold text-slate-800">{activeDeviceObj?.name || 'Patrol Unit 1'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned Location:</span>
                  <span className="font-bold text-slate-800">{activeDeviceObj?.assigned_location || 'North Corridor'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Field Officer:</span>
                  <span className="font-bold text-slate-800">{activeDeviceObj?.operator_id || 'OFFICER_204'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Battery Level:</span>
                  <span className="font-bold text-emerald-700">{liveBattery}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Protocol:</span>
                  <span className="font-bold text-[#245B84]">WebRTC / JPEG Canvas</span>
                </div>
              </div>

              <div className="p-2.5 bg-white border border-[#DCE4EA] rounded space-y-1 text-[10px]">
                <span className="font-bold text-[#245B84] block">SUPPORTED AI EVENTS:</span>
                <p className="text-slate-600 leading-tight">
                  Plate Recognition (ANPR), Watchlist Cross-Check, No Helmet, Overspeed. Alerts labeled <em>"AI DETECTION — Review required"</em>.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <button
                onClick={handleRemotePhotoCapture}
                disabled={isCapturingSnapshot}
                className="w-full py-2.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Camera className="w-4 h-4" /> TAKE FIELD PHOTO SNAPSHOT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-lg border border-[#DCE4EA] text-slate-500 font-mono text-xs">
            No active mobile device cameras connected. Click "LINK NEW CAMERA" to scan QR code and pair a field camera.
          </div>
        ) : (
          devices.map((dev) => (
            <div key={dev.id} className="bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#245B84]" />
                  <div>
                    <h3 className="font-bold text-xs text-slate-800">{dev.name}</h3>
                    <span className="text-[10px] text-slate-400">{dev.device_id}</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                    dev.connection_status === 'CONNECTED'
                      ? 'bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {dev.connection_status}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-[#245B84]" /> Device UUID:
                  </span>
                  <span className="font-bold text-[#245B84]">{dev.device_uuid || 'VG-MOB-7F92A31C'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Location:
                  </span>
                  <span className="font-bold text-slate-800">{dev.assigned_location || 'North Corridor'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Operator:
                  </span>
                  <span className="font-bold text-slate-800">{dev.operator_id || 'OFFICER_104'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Battery className="w-3.5 h-3.5" /> Battery:
                  </span>
                  <span className="font-bold text-[#2E7D5B]">{dev.battery_pct || 94}%</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#DCE4EA] flex items-center justify-between gap-1">
                <button
                  onClick={() => setSelectedStreamDeviceId(dev.device_id)}
                  className="text-[10px] font-bold text-[#245B84] hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Select for Monitor
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDisconnect(dev.device_id)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-[#DCE4EA] text-[10px] font-bold rounded flex items-center gap-1 transition-colors"
                  >
                    <Power className="w-3 h-3 text-slate-500" /> Disconnect
                  </button>
                  <button
                    onClick={() => handleRevoke(dev.device_id)}
                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold rounded flex items-center gap-1 transition-colors"
                  >
                    <Shield className="w-3 h-3 text-red-600" /> Revoke
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* QR Code & Manual Pairing Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-xl w-full max-w-lg overflow-hidden select-none">
            <div className="p-4 bg-[#E5EFF6] border-b border-[#DCE4EA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#245B84]" />
                <h3 className="font-bold text-sm text-[#173F5F] uppercase">LINK MOBILE CAMERA</h3>
              </div>
              <button onClick={handleCancelPairing} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-center">
              <p className="text-xs text-slate-600">Scan this QR code using your phone camera to pair live feed:</p>
              <div className="p-4 bg-white border-2 border-[#DCE4EA] rounded-xl inline-block shadow-xs">
                <QRCodeSVG value={localUrl} size={180} level="H" marginSize={1} fgColor="#173F5F" />
              </div>
              <div className="p-3 bg-slate-50 border border-[#DCE4EA] rounded-lg text-left text-[11px] space-y-1">
                <span className="text-slate-500 font-bold block">Mobile Web URL:</span>
                <p className="text-slate-800 break-all font-bold bg-white p-1.5 rounded border border-[#DCE4EA]">
                  {localUrl}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  onClick={handleCancelPairing}
                  className="px-4 py-2 bg-slate-600 text-white rounded text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
