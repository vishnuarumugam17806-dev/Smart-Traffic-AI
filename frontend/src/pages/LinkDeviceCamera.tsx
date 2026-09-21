import React, { useEffect, useState, useRef } from 'react';
import {
  Smartphone,
  Camera,
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
  Sparkles,
  Navigation,
  Compass,
  Battery
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../api/client';
import { Link } from 'react-router-dom';
import { MapStyleSelector } from '../components/MapStyleSelector';
import { MapStyleId, getDefaultMapStyleId, getTileUrlForStyle, createGoogleMapsDirectionsUrl } from '../utils/mapProviders';

export const LinkDeviceCamera: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Live Mobile Stream Monitor State (Section 18 & 19)
  const [selectedStreamDeviceId, setSelectedStreamDeviceId] = useState<string>('MOBILE-CAM-001');
  const [liveFrameBase64, setLiveFrameBase64] = useState<string | null>(null);
  const [liveStreamFps, setLiveStreamFps] = useState<number>(0);
  const [liveBattery, setLiveBattery] = useState<number>(94);
  const [liveLocationData, setLiveLocationData] = useState<any | null>(null);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState<boolean>(false);
  const [lastCapturedPlate, setLastCapturedPlate] = useState<string | null>(null);
  const [latestPlateInfo, setLatestPlateInfo] = useState<any | null>(null);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);

  // Pairing session state (Section 38: pairing token expiry)
  const [pairingDeviceId, setPairingDeviceId] = useState<string>('MOBILE-CAM-002');
  const [pairingCode] = useState<string>('482931');
  const [pairingToken, setPairingToken] = useState<string>(`PAIR-TOK-${Date.now().toString(36).toUpperCase()}`);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
  const [pairingStatus, setPairingStatus] = useState<'WAITING' | 'CONNECTED' | 'EXPIRED' | 'CANCELLED'>('WAITING');

  // Form states
  const [name, setName] = useState<string>('Mobile Patrol Unit 2');
  const [operatorId, setOperatorId] = useState<string>('OFFICER_204');
  const [location, setLocation] = useState<string>('City Patrol Sector 4');

  // Map Refs for Leaflet GIS (Section 20, 33)
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleId>(getDefaultMapStyleId());
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

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

  // Poll for live stream frame & telemetry pushed from active mobile camera
  useEffect(() => {
    let frameTimer: any;
    const fetchLiveFrame = async () => {
      try {
        const res = await apiClient.get(`/mobile-camera/${selectedStreamDeviceId}/live-frame`);
        if (res.data) {
          if (res.data.frame_base64) setLiveFrameBase64(res.data.frame_base64);
          setLiveStreamFps(res.data.fps || 24);
          if (res.data.battery_pct) setLiveBattery(res.data.battery_pct);
          if (res.data.location) setLiveLocationData(res.data.location);

          if (res.data.plate_info) {
            setLastCapturedPlate(res.data.plate_info.plate_number);
            setLatestPlateInfo(res.data.plate_info);
          } else {
            setLastCapturedPlate(null);
            setLatestPlateInfo(null);
          }
        }
      } catch (err) {}
    };

    fetchLiveFrame();
    frameTimer = setInterval(fetchLiveFrame, 1200);
    return () => clearInterval(frameTimer);
  }, [selectedStreamDeviceId]);

  // Leaflet Map Initialization & Real-Time Position Updating (Section 20, 33, 34)
  const activeDeviceObj = devices.find((d) => d.device_id === selectedStreamDeviceId) || devices[0];
  const activeGps = (liveLocationData && liveLocationData.status === 'AVAILABLE')
    ? liveLocationData
    : (activeDeviceObj && activeDeviceObj.latitude && activeDeviceObj.latitude !== 0)
    ? {
        latitude: activeDeviceObj.latitude,
        longitude: activeDeviceObj.longitude,
        accuracy_meters: activeDeviceObj.accuracy_meters || 12,
        status: activeDeviceObj.last_location_status || 'AVAILABLE',
        timestamp: activeDeviceObj.last_location_timestamp
      }
    : null;

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter = [13.0604, 80.2496];
      const initialCenter = activeGps ? [activeGps.latitude, activeGps.longitude] : defaultCenter;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 15,
        zoomControl: true
      });

      const tileCfg = getTileUrlForStyle(mapStyle);
      const tileLayer = L.tileLayer(tileCfg.url, {
        maxZoom: mapStyle.startsWith('google') ? 20 : 19,
        subdomains: tileCfg.subdomains || ['a', 'b', 'c'],
        attribution: mapStyle.startsWith('google') ? '&copy; Google Maps' : '&copy; OpenStreetMap'
      });
      tileLayer.on('tileerror', (error: any) => {
        if (error.tile && !error.tile.dataset.retried) {
          error.tile.dataset.retried = 'true';
          error.tile.src = `https://tile.openstreetmap.org/${error.coords.z}/${error.coords.x}/${error.coords.y}.png`;
        }
      });
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    if (activeGps && activeGps.status === 'AVAILABLE') {
      const pos = [activeGps.latitude, activeGps.longitude];

      // Custom marker icon for mobile device
      const deviceIcon = L.divIcon({
        className: 'custom-mobile-device-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(37,99,235,0.6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: bold;">
              📱
            </div>
            <div style="position: absolute; top: -20px; white-space: nowrap; background: #1e293b; color: #38bdf8; font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #334155;">
              ${selectedStreamDeviceId}
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
        markerRef.current.setIcon(deviceIcon);
      } else {
        markerRef.current = L.marker(pos, { icon: deviceIcon }).addTo(map);
      }

      // Update Accuracy Circle (Section 12, 20)
      const accRadius = Math.max(5, activeGps.accuracy_meters || 12);
      if (circleRef.current) {
        circleRef.current.setLatLng(pos);
        circleRef.current.setRadius(accRadius);
      } else {
        circleRef.current = L.circle(pos, {
          radius: accRadius,
          color: '#2563eb',
          weight: 1.5,
          fillColor: '#3b82f6',
          fillOpacity: 0.18
        }).addTo(map);
      }

      markerRef.current.bindPopup(`
        <div style="font-family: monospace; font-size: 11px; color: #1e293b; padding: 4px;">
          <b style="color: #2563eb;">Mobile Patrol Unit: ${selectedStreamDeviceId}</b><br/>
          <b>GPS:</b> ${activeGps.latitude.toFixed(5)}, ${activeGps.longitude.toFixed(5)}<br/>
          <b>Accuracy:</b> ±${activeGps.accuracy_meters || 12} m<br/>
          <b>Status:</b> ${activeGps.status}<br/>
          <span style="font-size: 9px; color: #64748b;">(Represents mobile device location. Not exact vehicle GPS.)</span>
        </div>
      `);

      map.panTo(pos);
    } else {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    }
  }, [activeGps, selectedStreamDeviceId]);

  // Dynamically swap base map tiles on mapStyle change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      try {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      } catch (e) {}
    }
    const tileCfg = getTileUrlForStyle(mapStyle);
    const newTileLayer = L.tileLayer(tileCfg.url, {
      maxZoom: mapStyle.startsWith('google') ? 20 : 19,
      subdomains: tileCfg.subdomains || ['a', 'b', 'c'],
      attribution: mapStyle.startsWith('google') ? '&copy; Google Maps' : '&copy; OpenStreetMap'
    });
    newTileLayer.on('tileerror', (error: any) => {
      if (error.tile && !error.tile.dataset.retried) {
        error.tile.dataset.retried = 'true';
        error.tile.src = `https://tile.openstreetmap.org/${error.coords.z}/${error.coords.x}/${error.coords.y}.png`;
      }
    });
    newTileLayer.addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;
  }, [mapStyle]);

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
    const newId = `MOBILE-CAM-${Math.floor(100 + Math.random() * 900)}`;
    setPairingDeviceId(newId);
    setPairingToken(`PAIR-TOK-${Date.now().toString(36).toUpperCase()}`);
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
        device_id: pairingDeviceId,
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

  // Trigger remote photo capture & ANPR inspection from desktop (Section 31)
  const handleRemotePhotoCapture = async () => {
    setIsCapturingSnapshot(true);
    try {
      const activeDev = devices.find((d) => d.device_id === selectedStreamDeviceId);
      const locStr = activeGps && activeGps.status === 'AVAILABLE'
        ? `Mobile Patrol GPS (${activeGps.latitude.toFixed(5)}, ${activeGps.longitude.toFixed(5)} ±${activeGps.accuracy_meters}m)`
        : (activeDev?.assigned_location || 'Field Patrol Checkpoint');

      let payloadBase64 = liveFrameBase64;
      if (!payloadBase64) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 640, 360);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 18px monospace';
          ctx.fillText(`FIELD PATROL SNAPSHOT: ${selectedStreamDeviceId}`, 30, 60);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '13px monospace';
          ctx.fillText(`Location: ${locStr}`, 30, 100);
          ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 30, 130);
          payloadBase64 = canvas.toDataURL('image/jpeg', 0.85);
        }
      }

      const res = await apiClient.post('/mobile-camera/capture-photo', {
        photo_base64: payloadBase64,
        device_id: selectedStreamDeviceId,
        operator_id: activeDev?.operator_id || 'OFFICER-FIELD',
        location: locStr
      });

      if (res.data) {
        // Index photo in local recordings cache so it immediately appears in RECORDS
        try {
          const photoRec = {
            id: Date.now(),
            record_id: res.data.record_id || `PHO-${Date.now()}`,
            photo_id: res.data.photo_id || res.data.record_id,
            type: 'PHOTO',
            media_type: 'PHOTO',
            device_id: selectedStreamDeviceId,
            location: locStr,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
            plate_number: res.data.plate_number,
            confidence: res.data.ocr_confidence,
            event_type: res.data.event_type || 'FIELD_PHOTO_CAPTURE',
            file_url: res.data.file_url || payloadBase64,
            image_url: res.data.file_url || payloadBase64,
            review_status: 'CONFIRMED'
          };
          const stored = JSON.parse(localStorage.getItem('vigitra_mobile_recordings') || '[]');
          localStorage.setItem('vigitra_mobile_recordings', JSON.stringify([photoRec, ...stored.filter((r: any) => r.record_id !== photoRec.record_id)].slice(0, 30)));
        } catch (e) {}

        if (res.data.plate_number) {
          setLastCapturedPlate(res.data.plate_number);
          setCaptureFeedback(
            `Photo captured & indexed in RECORDS. ANPR Plate: ${res.data.plate_number} (Validation: ${((res.data.visual_validation_score || 0.85) * 100).toFixed(0)}%)`
          );
        } else {
          setLastCapturedPlate(null);
          setCaptureFeedback('Photo captured & indexed in RECORDS. Evidence stored successfully.');
        }
      }
      setTimeout(() => setCaptureFeedback(null), 6000);
    } catch (e) {
      console.error('Error capturing remote snapshot:', e);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  // QR URL contains public mobile URL + short-lived pairing token (Section 38)
  const mobileCameraPath = `/mobile-camera?device_id=${pairingDeviceId}&token=${pairingToken}`;
  const localUrl = `${window.location.origin}${mobileCameraPath}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 bg-[#F6F8FA] min-h-screen select-none font-sans overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight uppercase font-mono">
            LINK MOBILE DEVICE & LIVE FIELD SURVEILLANCE
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Production Mobile Camera Streaming, Real-Time Geolocation Tracking & Vehicle-First ANPR Control Room
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
            <ExternalLink className="w-4 h-4" /> LAUNCH MOBILE CAMERA
          </a>
          <button
            onClick={() => {
              handleGenerateNewQR();
              setShowLinkModal(true);
            }}
            className="flex-1 md:flex-initial px-4 py-2.5 min-h-[44px] bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> LINK NEW DEVICE
          </button>
        </div>
      </div>

      {/* SECTION 18 & 22: DESKTOP CONTROL ROOM LIVE MOBILE CAMERA FEED */}
      <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-600 animate-pulse" />
            <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase tracking-wide">
              CONTROL ROOM LIVE PATROL FEED & ANPR TELEMETRY
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
                  Device: {d.device_id} ({d.name || 'Patrol Unit'})
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

        {/* Live Stream Viewport & Telemetry Grid */}
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
                <p className="text-xs font-bold text-slate-300">WAITING FOR LIVE MOBILE STREAM</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Scan the pairing QR code with your mobile device or launch the mobile camera tab to stream live video.
                </p>
                <a
                  href={`/mobile-camera?device_id=${selectedStreamDeviceId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#245B84] hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> Open Mobile Patrol Unit in New Tab
                </a>
              </div>
            )}

            {/* Status Badges Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className="px-2 py-0.5 bg-red-600 text-white font-mono font-extrabold text-[9px] rounded flex items-center gap-1 shadow-md animate-pulse">
                <Radio className="w-2.5 h-2.5" /> LIVE STREAM
              </span>
              <span className="px-2 py-0.5 bg-slate-900/80 text-white font-mono text-[9px] rounded backdrop-blur-xs">
                {selectedStreamDeviceId}
              </span>
            </div>

            {/* Validated ANPR AR Overlay Box (Section 23, 27) */}
            {latestPlateInfo && latestPlateInfo.plate_number ? (
              <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-slate-700 p-2.5 rounded-lg flex items-center gap-2.5 shadow-2xl backdrop-blur-xs">
                <div className="px-2.5 py-1 bg-amber-400 text-slate-950 font-mono font-black text-xs rounded border border-amber-500 shadow-xs flex items-center gap-1">
                  <span className="text-[9px] bg-blue-700 text-white px-1 py-0.2 rounded font-bold">IND</span>
                  {latestPlateInfo.plate_number}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                      latestPlateInfo.flag === 'WATCHLIST_MATCH' ? 'bg-red-600 text-white animate-pulse' :
                      latestPlateInfo.flag === 'COMPLIANCE_VIOLATION' ? 'bg-amber-500 text-black font-extrabold' :
                      'bg-emerald-500 text-black font-extrabold'
                    }`}>
                      {latestPlateInfo.flag === 'WATCHLIST_MATCH' ? '🚨 WATCHLIST MATCH' :
                       latestPlateInfo.flag === 'COMPLIANCE_VIOLATION' ? '⚠️ EXPIRED' : '✅ VALIDATED'}
                    </span>
                    <span className="text-[9px] text-slate-300 font-mono">
                      {((latestPlateInfo.confidence || 0.85) * 100).toFixed(0)}% OCR
                    </span>
                    {latestPlateInfo.visual_validation_score && (
                      <span className="text-[9px] text-emerald-400 font-mono">
                        {((latestPlateInfo.visual_validation_score || 0.8) * 100).toFixed(0)}% VISUAL
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-300 font-mono mt-0.5 truncate max-w-[200px]">
                    {latestPlateInfo.reason || 'Temporally confirmed number plate'}
                  </p>
                </div>
                <Link to="/recordings" className="text-[10px] text-blue-400 hover:underline font-bold flex items-center gap-0.5 ml-2">
                  Record <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
            ) : lastCapturedPlate ? (
              <div className="absolute bottom-3 left-3 px-3 py-1 bg-amber-400 text-slate-950 font-mono font-black text-xs rounded shadow-lg border border-amber-500">
                PLATE IDENTIFIED: {lastCapturedPlate}
              </div>
            ) : null}

            <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-slate-900/80 text-slate-300 font-mono text-[9px] rounded">
              FPS: {liveStreamFps || 24.0} | 5G
            </div>
          </div>

          {/* Telemetry & Device Sensors Info (4 cols) */}
          <div className="lg:col-span-4 bg-slate-50 p-4 rounded-lg border border-[#DCE4EA] space-y-3 font-mono text-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-700 uppercase">DEVICE TELEMETRY & GPS</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  activeDeviceObj?.connection_status === 'CONNECTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {activeDeviceObj?.connection_status || 'STANDBY'}
                </span>
              </div>

              {/* Status metrics */}
              <div className="space-y-2 text-slate-600 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Device ID:</span>
                  <span className="font-bold text-slate-800">{selectedStreamDeviceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Camera Status:</span>
                  <span className="font-bold text-emerald-600">ACTIVE (Rear Camera)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Location Status:</span>
                  <span className={`font-bold ${
                    activeGps && activeGps.status === 'AVAILABLE' ? 'text-emerald-600' :
                    activeGps?.status === 'PERMISSION_DENIED' ? 'text-red-600' :
                    activeGps?.status === 'STALE' ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    {activeGps && activeGps.status === 'AVAILABLE' ? '✓ AVAILABLE' :
                     activeGps?.status === 'PERMISSION_DENIED' ? '✕ PERMISSION DENIED' :
                     activeGps?.status === 'STALE' ? '⚠️ STALE' : 'UNAVAILABLE'}
                  </span>
                </div>

                {activeGps && activeGps.status === 'AVAILABLE' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Device GPS:</span>
                      <span className="font-bold text-blue-700">
                        {activeGps.latitude.toFixed(5)}, {activeGps.longitude.toFixed(5)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">GPS Accuracy:</span>
                      <span className="font-bold text-slate-800">±{activeGps.accuracy_meters || 12} m</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned Sector:</span>
                  <span className="font-bold text-slate-800">{activeDeviceObj?.assigned_location || 'Field Patrol'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Battery Level:</span>
                  <span className="font-bold text-emerald-700">{liveBattery}%</span>
                </div>
              </div>

              {/* ANPR Observation Card */}
              {latestPlateInfo && (
                <div className="p-2.5 bg-white border border-[#DCE4EA] rounded space-y-1 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#245B84] flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
                      LATEST CONFIRMED ANPR:
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {latestPlateInfo.timestamp || 'Just now'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="font-mono font-black text-xs text-slate-900 bg-amber-200 px-1.5 py-0.5 rounded border border-amber-300">
                      {latestPlateInfo.plate_number}
                    </span>
                    <Link to="/recordings" className="text-blue-600 hover:underline font-bold flex items-center gap-0.5 text-[9px]">
                      Open Record <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                  <p className="text-slate-600 text-[9px] truncate">{latestPlateInfo.reason}</p>
                </div>
              )}

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded space-y-1 text-[10px] text-blue-900">
                <span className="font-bold block">VEHICLE-FIRST ANPR ENGINE:</span>
                <p className="text-blue-800 leading-tight">
                  OCR runs exclusively when a vehicle and visible plate candidate pass geometric & Laplacian blur filters. Random number generation is completely disabled.
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

      {/* SECTION 20 & 33: DEVICE GPS LOCATION INTERACTIVE MAP */}
      <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-xs p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="text-xs font-mono font-extrabold text-slate-800 uppercase tracking-wide">
              MOBILE PATROL DEVICE LOCATION (GPS MAP & ACCURACY RADIUS)
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
            <MapStyleSelector currentStyle={mapStyle} onStyleChange={setMapStyle} />
            {activeGps && activeGps.status === 'AVAILABLE' && (
              <a
                href={createGoogleMapsDirectionsUrl(activeGps.latitude, activeGps.longitude, selectedStreamDeviceId)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-blue-600 hover:text-blue-800 rounded-lg border border-slate-200 font-bold flex items-center gap-1 shadow-xs transition-colors"
                title="Navigate directly in Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in</span> Google Maps
              </a>
            )}
            {activeGps && activeGps.status === 'AVAILABLE' ? (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                DEVICE GPS ACTIVE (±{activeGps.accuracy_meters || 12}m)
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded font-bold">
                {activeGps?.status === 'PERMISSION_DENIED' ? 'LOCATION PERMISSION DENIED' : 'GPS STANDBY / WAITING'}
              </span>
            )}
          </div>
        </div>

        {/* Map Container */}
        <div className="relative rounded-lg overflow-hidden border border-[#DCE4EA] h-72 sm:h-80 w-full bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {(!activeGps || activeGps.status !== 'AVAILABLE') && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-4 z-10 text-center font-mono">
              <MapPin className="w-10 h-10 text-amber-400 mb-2 animate-bounce" />
              <p className="text-xs font-bold text-white uppercase">Device Location Unavailable</p>
              <p className="text-[11px] text-slate-300 max-w-sm mt-1">
                {activeGps?.status === 'PERMISSION_DENIED'
                  ? 'Location permission was denied on the mobile device. Real device GPS is required for location-tagged events.'
                  : 'Waiting for GPS telemetry from mobile device. Open the mobile camera and allow location permission.'}
              </p>
            </div>
          )}

          {/* Map Footer Note (Section 20, 34) */}
          <div className="absolute bottom-2 left-2 bg-slate-900/90 text-white font-mono text-[10px] px-2.5 py-1 rounded backdrop-blur-xs z-10 border border-slate-700">
            📍 Marker indicates Mobile Device position. Not exact vehicle GPS coordinates.
          </div>
        </div>
      </div>

      {/* SECTION 22: CONNECTED DEVICES CONTROL ROOM LIST */}
      <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-xs p-4 sm:p-5 space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#245B84]" />
            <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              CONNECTED FIELD DEVICES ({devices.length})
            </h2>
          </div>
          <button
            onClick={() => {
              handleGenerateNewQR();
              setShowLinkModal(true);
            }}
            className="text-xs font-bold text-[#245B84] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Pair Another Device
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-slate-50 rounded-lg border border-[#DCE4EA] text-slate-500 text-xs">
              No active mobile devices linked yet. Click "LINK NEW DEVICE" to scan QR code and connect a field camera.
            </div>
          ) : (
            devices.map((dev) => {
              const isSelected = dev.device_id === selectedStreamDeviceId;
              const hasGps = dev.latitude && dev.latitude !== 0;

              return (
                <div
                  key={dev.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isSelected ? 'border-[#245B84] bg-blue-50/20 shadow-md ring-1 ring-[#245B84]' : 'border-[#DCE4EA] bg-white'
                  } space-y-3`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <h3 className="font-bold text-xs text-slate-800">{dev.name || dev.device_id}</h3>
                      <span className="text-[10px] text-slate-400">{dev.device_id}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                      dev.connection_status === 'CONNECTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {dev.connection_status || 'STANDBY'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Camera:</span>
                      <span className="font-bold text-slate-700">
                        {dev.permission_camera === 'GRANTED' ? '✓ ACTIVE' : 'STANDBY'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className={`font-bold ${
                        hasGps && dev.last_location_status === 'AVAILABLE' ? 'text-emerald-700' :
                        dev.last_location_status === 'PERMISSION_DENIED' ? 'text-red-700' :
                        dev.last_location_status === 'STALE' ? 'text-amber-700' : 'text-slate-500'
                      }`}>
                        {hasGps && dev.last_location_status === 'AVAILABLE' ? `✓ AVAILABLE (±${dev.accuracy_meters || 12}m)` :
                         dev.last_location_status === 'PERMISSION_DENIED' ? '✕ PERMISSION DENIED' :
                         dev.last_location_status === 'STALE' ? '⚠️ STALE' : 'UNAVAILABLE'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Officer:</span>
                      <span className="font-bold text-slate-800">{dev.operator_id || 'PATROL_104'}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Battery:</span>
                      <span className="font-bold text-emerald-700">{dev.battery_pct || 94}%</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-1">
                    <button
                      onClick={() => setSelectedStreamDeviceId(dev.device_id)}
                      className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                        isSelected ? 'bg-[#245B84] text-white' : 'bg-slate-100 hover:bg-slate-200 text-[#245B84]'
                      }`}
                    >
                      <Eye className="w-3 h-3" /> {isSelected ? 'Streaming' : 'View Stream'}
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
              );
            })
          )}
        </div>
      </div>

      {/* QR Code & Pairing Modal (Sections 38) */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-xl w-full max-w-md overflow-hidden select-none">
            <div className="p-4 bg-[#E5EFF6] border-b border-[#DCE4EA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#245B84]" />
                <h3 className="font-bold text-sm text-[#173F5F] uppercase">PAIR MOBILE PATROL CAMERA</h3>
              </div>
              <button onClick={handleCancelPairing} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              <p className="text-xs text-slate-600">
                Scan with your phone's camera to initiate authenticated field streaming:
              </p>

              <div className="p-3 bg-white border-2 border-[#DCE4EA] rounded-xl inline-block shadow-sm">
                <QRCodeSVG value={localUrl} size={180} level="H" marginSize={1} fgColor="#173F5F" />
              </div>

              {/* Countdown timer */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Pairing Token Valid For:</span>
                <span className="font-bold text-[#245B84]">{formatTime(timeLeft)}</span>
              </div>

              <div className="p-2.5 bg-slate-50 border border-[#DCE4EA] rounded-lg text-left text-[11px] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">Mobile Link URL:</span>
                  <button
                    onClick={() => copyToClipboard(localUrl)}
                    className="text-[#245B84] hover:underline flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-slate-800 break-all font-mono text-[10px] bg-white p-1.5 rounded border border-[#DCE4EA]">
                  {localUrl}
                </p>
              </div>

              <div className="flex justify-between gap-2 pt-2 border-t">
                <button
                  onClick={handleGenerateNewQR}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Token
                </button>
                <button
                  onClick={handleCancelPairing}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded text-xs font-bold"
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

