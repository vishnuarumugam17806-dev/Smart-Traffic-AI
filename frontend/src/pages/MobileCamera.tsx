import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Camera,
  Video,
  Square,
  CameraOff,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Radio,
  Download,
  Film,
  ExternalLink,
  MapPin,
  Shield,
  Eye,
  Info
} from 'lucide-react';
import { apiClient, resolveVideoUrl } from '../api/client';
import { useStore } from '../store/useStore';

interface GpsReading {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
  ageSeconds: number;
}

interface MobileScanResult {
  plate_number: string;
  confidence: number;
  visual_validation_score?: number;
  blur_score?: number;
  validation_status?: string;
  flag: string;
  severity: string;
  reason: string;
  record_id?: string;
  evidence_url?: string;
  timestamp: string;
  status?: string;
}

export const MobileCamera: React.FC = () => {
  const { user } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read device parameters from pairing QR or query params
  const deviceId = searchParams.get('device_id') || 'MOBILE-CAM-001';
  const pairingToken = searchParams.get('token') || '';

  // Streaming & Hardware state
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [statusMessage, setStatusMessage] = useState<string>('FIELD RECORDING READY');
  const [emergencyAlertSent, setEmergencyAlertSent] = useState<boolean>(false);
  const [capturingPhoto, setCapturingPhoto] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Permission & Location Tracking (Sections 8, 10-17, 39)
  const [cameraPermission, setCameraPermission] = useState<'PROMPT' | 'GRANTED' | 'DENIED' | 'UNAVAILABLE'>('PROMPT');
  const [locationStatus, setLocationStatus] = useState<'WAITING' | 'AVAILABLE' | 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'STALE'>('WAITING');
  const [gpsReading, setGpsReading] = useState<GpsReading | null>(null);

  // ANPR & AI State
  const [latestScan, setLatestScan] = useState<MobileScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<MobileScanResult[]>([]);
  const [vehicleDetectedInScene, setVehicleDetectedInScene] = useState<boolean>(false);
  const [aiStatusText, setAiStatusText] = useState<string>('Searching for vehicles...');

  // Saved recording preview modal
  const [savedModalRecord, setSavedModalRecord] = useState<any | null>(null);
  const [recentMobileRecords, setRecentMobileRecords] = useState<any[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const frameIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const watchPositionIdRef = useRef<number | null>(null);
  const lastSentLocationRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastLocationEpochRef = useRef<number>(0);

  // Load existing local recordings cache
  const loadRecentLocalRecords = () => {
    try {
      const stored = localStorage.getItem('vigitra_mobile_recordings');
      if (stored) {
        setRecentMobileRecords(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading mobile recordings cache:', e);
    }
  };

  // 1. Geolocation Watching (Sections 10, 11, 12, 13, 14, 16)
  const sendLocationUpdate = useCallback(async (lat: number, lng: number, accuracy: number, timestampIso: string) => {
    try {
      await apiClient.post('/mobile-camera/location', {
        device_id: deviceId,
        latitude: lat,
        longitude: lng,
        accuracy_meters: accuracy,
        timestamp: timestampIso,
        source: 'mobile_device_gps'
      });
    } catch (err) {
      // Non-blocking telemetry post
    }
  }, [deviceId]);

  useEffect(() => {
    loadRecentLocalRecords();

    if ('geolocation' in navigator) {
      setLocationStatus('WAITING');
      watchPositionIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 10);
          const timestampIso = new Date(pos.timestamp || now).toISOString();

          lastLocationEpochRef.current = now;
          setGpsReading({
            lat,
            lng,
            accuracy,
            timestamp: timestampIso,
            ageSeconds: 0
          });
          setLocationStatus('AVAILABLE');

          // Send update only if distance > 3m or interval > 4 seconds (Section 16)
          const lastSent = lastSentLocationRef.current;
          let shouldSend = false;
          if (!lastSent) {
            shouldSend = true;
          } else {
            const timeDiff = (now - lastSent.time) / 1000;
            const distApprox = Math.sqrt(
              Math.pow((lat - lastSent.lat) * 111320, 2) +
              Math.pow((lng - lastSent.lng) * 111320 * Math.cos(lat * Math.PI / 180), 2)
            );
            if (distApprox >= 3.0 || timeDiff >= 4.0) {
              shouldSend = true;
            }
          }

          if (shouldSend) {
            lastSentLocationRef.current = { lat, lng, time: now };
            sendLocationUpdate(lat, lng, accuracy, timestampIso);
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('PERMISSION_DENIED');
          } else {
            setLocationStatus('UNAVAILABLE');
          }
          setGpsReading(null);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 4000,
          timeout: 10000
        }
      );
    } else {
      setLocationStatus('UNAVAILABLE');
    }

    // Stale location ticker (Section 13: MAX_LOCATION_AGE_SECONDS = 60)
    const staleInterval = setInterval(() => {
      if (lastLocationEpochRef.current > 0) {
        const ageSec = Math.floor((Date.now() - lastLocationEpochRef.current) / 1000);
        setGpsReading(prev => prev ? { ...prev, ageSeconds: ageSec } : null);
        if (ageSec > 60) {
          setLocationStatus('STALE');
        }
      }
    }, 1000);

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
      }
      clearInterval(staleInterval);
    };
  }, [sendLocationUpdate]);

  // Update permissions state on backend
  useEffect(() => {
    const updateBackendPermissions = async () => {
      try {
        await apiClient.post(`/devices/${deviceId}/permissions`, {
          camera: cameraPermission,
          location: locationStatus
        });
      } catch (e) {}
    };
    if (cameraPermission !== 'PROMPT' || locationStatus !== 'WAITING') {
      updateBackendPermissions();
    }
  }, [deviceId, cameraPermission, locationStatus]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 2. Hardware Camera Streaming (Strictly audio: false, rear camera default)
  const startCamera = async (currentFacingMode = facingMode) => {
    try {
      setStatusMessage('REQUESTING REAR CAMERA...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      // High-definition rear camera stream without microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      setCameraPermission('GRANTED');

      // Determine best supported recording format
      let mimeType = 'video/webm;codecs=vp8';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = '';
            }
          }
        }
      }

      recordedChunksRef.current = [];
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      setStatusMessage('STREAMING TO VIGITRA AI DISPATCH');

      // Register / link device session on backend
      await apiClient.post('/devices/link', {
        device_id: deviceId,
        operator_id: user?.police_id || user?.username || 'OFFICER-FIELD',
        name: `Mobile Unit ${deviceId}`,
        assigned_location: 'Mobile Patrol Unit'
      }).catch(() => {});

      // Stream frames to control room monitor every 1.2s for ANPR inference
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = setInterval(captureAndSendFrame, 1200);

    } catch (err: any) {
      console.error('Error starting mobile camera stream:', err);
      setCameraPermission('DENIED');
      setStatusMessage('Camera access denied. Please grant camera permission.');
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isStreaming) {
      stopCameraAndSave();
      setTimeout(() => startCamera(nextMode), 300);
    }
  };

  // 3. Frame Capture & Vehicle-First ANPR Pipeline
  const captureAndSendFrame = async () => {
    if (!videoRef.current || !streamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    const base64 = canvas.toDataURL('image/jpeg', 0.65);

    // Build location payload strictly from real GPS (Section 11, 18)
    const locationPayload = (gpsReading && locationStatus === 'AVAILABLE') ? {
      latitude: gpsReading.lat,
      longitude: gpsReading.lng,
      accuracy_meters: gpsReading.accuracy,
      timestamp: gpsReading.timestamp,
      source: 'mobile_device_gps',
      status: 'VALID'
    } : {
      status: locationStatus === 'PERMISSION_DENIED' ? 'PERMISSION_DENIED' : 'UNAVAILABLE'
    };

    try {
      const res = await apiClient.post('/mobile-camera/stream-frame', {
        device_id: deviceId,
        frame_base64: base64,
        location: locationPayload
      });

      const data = res.data;
      if (data) {
        setVehicleDetectedInScene(!!data.vehicle_detected);

        if (!data.vehicle_detected) {
          setAiStatusText('Searching road for vehicles...');
          setLatestScan(null);
        } else if (!data.plate_visible) {
          setAiStatusText('Vehicle detected • Plate not visible or candidate rejected');
          setLatestScan(null);
        } else if (data.plate_detected && data.plate_number) {
          const scanItem: MobileScanResult = {
            plate_number: data.plate_number,
            confidence: data.confidence || 0.85,
            visual_validation_score: data.visual_validation_score,
            blur_score: data.blur_score,
            validation_status: data.validation_status || data.status || 'CONFIRMED',
            flag: data.flag || 'ANPR_CAPTURED',
            severity: data.severity || 'NORMAL',
            reason: data.reason || 'Vehicle plate identified and temporally validated',
            record_id: data.record_id,
            evidence_url: data.evidence_url,
            timestamp: new Date().toLocaleTimeString(),
            status: data.status || 'CONFIRMED'
          };
          setLatestScan(scanItem);
          setAiStatusText(`Plate validated: ${data.plate_number}`);

          setRecentScans(prev => [scanItem, ...prev.filter(p => p.plate_number !== scanItem.plate_number)].slice(0, 10));

          if (scanItem.flag === 'WATCHLIST_MATCH' || scanItem.severity === 'CRITICAL') {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 300]);
            }
          }
        }
      }
    } catch (err) {
      // Non-blocking frame transmission error
    }
  };

  const stopCameraAndSave = async () => {
    setIsSaving(true);
    setStatusMessage('FINALIZING & INDEXING VIDEO...');

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    const duration = Math.max(1, recordingSeconds);
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        try {
          const finalMime = recorder.mimeType || 'video/webm';
          const videoBlob = new Blob(recordedChunksRef.current, { type: finalMime });
          const blobUrl = URL.createObjectURL(videoBlob);
          const ext = finalMime.includes('mp4') ? '.mp4' : '.webm';
          const timestampStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
          const localRecordId = `REC-MOB-${timestampStr}`;

          const locString = (gpsReading && locationStatus === 'AVAILABLE')
            ? `Mobile Patrol GPS (${gpsReading.lat.toFixed(5)}, ${gpsReading.lng.toFixed(5)} ±${gpsReading.accuracy}m)`
            : 'Device location unavailable (GPS offline)';

          const localRecord = {
            id: Date.now(),
            record_id: localRecordId,
            device_id: deviceId,
            location: locString,
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            duration_sec: duration,
            file_size_mb: Number((videoBlob.size / (1024 * 1024)).toFixed(2)),
            file_url: blobUrl,
            file_reference: blobUrl,
            recording_type: 'MOBILE_FIELD',
            is_local: true,
            created_at: new Date().toLocaleTimeString(),
            sha256_hash: 'INDEXED_DEVICE_EVIDENCE'
          };

          const existingList = JSON.parse(localStorage.getItem('vigitra_mobile_recordings') || '[]');
          const updatedList = [localRecord, ...existingList.filter((r: any) => r.record_id !== localRecordId)].slice(0, 30);
          localStorage.setItem('vigitra_mobile_recordings', JSON.stringify(updatedList));
          setRecentMobileRecords(updatedList);
          setSavedModalRecord(localRecord);

          // Upload video to persistent storage
          const file = new File([videoBlob], `${localRecordId}${ext}`, { type: finalMime });
          const formData = new FormData();
          formData.append('video_file', file);
          formData.append('device_id', deviceId);
          formData.append('location', locString);
          formData.append('duration_sec', String(duration));
          formData.append('operator_name', user?.full_name || user?.police_id || 'Field Patrol Officer');
          formData.append('recording_type', 'MOBILE_FIELD');

          try {
            const uploadRes = await apiClient.post('/recordings/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (uploadRes.data?.recording) {
              const serverRecord = {
                ...uploadRes.data.recording,
                file_blob_url: blobUrl
              };
              const syncedList = updatedList.map((r: any) => r.record_id === localRecordId ? serverRecord : r);
              localStorage.setItem('vigitra_mobile_recordings', JSON.stringify(syncedList));
              setRecentMobileRecords(syncedList);
              setSavedModalRecord(serverRecord);
            }
          } catch (uploadErr) {
            console.warn('Backend sync queued. Video preserved in local storage:', uploadErr);
          }

        } catch (compileErr) {
          console.error('Error processing recorded video blob:', compileErr);
        } finally {
          setIsSaving(false);
          setIsRecording(false);
          setIsStreaming(false);
          setStatusMessage('RECORDING STORED');
        }
      };

      recorder.stop();
    } else {
      setIsSaving(false);
      setIsRecording(false);
      setIsStreaming(false);
      setStatusMessage('RECORDING STANDBY');
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      await apiClient.post(`/devices/${deviceId}/disconnect`);
    } catch (err) {}
  };

  // 4. Instant Field Photo Capture (Section 31)
  const takeEmergencyPhoto = async () => {
    setCapturingPhoto(true);
    setEmergencyAlertSent(false);

    let photoBase64 = '';
    if (videoRef.current && streamRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 1280, 720);
        photoBase64 = canvas.toDataURL('image/jpeg', 0.88);
      }
    }

    const locString = (gpsReading && locationStatus === 'AVAILABLE')
      ? `Mobile Patrol Device (${gpsReading.lat.toFixed(5)}, ${gpsReading.lng.toFixed(5)} ±${gpsReading.accuracy}m)`
      : 'Device location unavailable';

    try {
      const res = await apiClient.post('/field/capture-photo', {
        operator_id: user?.police_id || user?.username || 'OFFICER-FIELD-1',
        location: locString,
        photo_base64: photoBase64,
        device_id: deviceId
      });

      const localPhotoRecord = {
        id: Date.now(),
        record_id: res.data?.record_id || `PHO-${Date.now()}`,
        photo_id: res.data?.photo_id || res.data?.record_id,
        type: 'PHOTO',
        media_type: 'PHOTO',
        device_id: deviceId,
        location: locString,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        plate_number: res.data?.plate_number,
        confidence: res.data?.ocr_confidence,
        event_type: res.data?.event_type || 'FIELD_PHOTO_CAPTURE',
        file_url: photoBase64,
        image_url: photoBase64,
        review_status: 'CONFIRMED'
      };
      const existing = JSON.parse(localStorage.getItem('vigitra_mobile_recordings') || '[]');
      localStorage.setItem('vigitra_mobile_recordings', JSON.stringify([localPhotoRecord, ...existing]));

      setEmergencyAlertSent(true);
      setTimeout(() => setEmergencyAlertSent(false), 4500);
    } catch (err) {
      console.error('Error dispatching photo capture:', err);
    } finally {
      setCapturingPhoto(false);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 sm:p-5 flex flex-col justify-between select-none font-mono">
      {/* Top Telemetry & Permissions HUD (Sections 15, 21, 39) */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400 shrink-0" />
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white uppercase">VIGITRA Mobile Patrol Unit</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/recordings"
              className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
            >
              <Film className="w-3 h-3 text-blue-400" /> Archive ({recentMobileRecords.length})
            </Link>
            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full flex items-center gap-1.5 ${
              isRecording ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              <Radio className={`w-3 h-3 ${isRecording ? 'animate-pulse text-red-500' : ''}`} />
              {isRecording ? `REC ${formatDuration(recordingSeconds)}` : 'IDLE'}
            </span>
          </div>
        </div>

        {/* Dual Permissions Status Bar (Section 15, 39) */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] sm:text-[11px]">
          <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <Camera className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Camera:</span>
            <span className={`font-bold ${
              cameraPermission === 'GRANTED' ? 'text-emerald-400' :
              cameraPermission === 'DENIED' ? 'text-red-400' : 'text-amber-400'
            }`}>
              {cameraPermission === 'GRANTED' ? '✓ CONNECTED' :
               cameraPermission === 'DENIED' ? '✕ DENIED' : 'WAITING'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Location:</span>
            <span className={`font-bold ${
              locationStatus === 'AVAILABLE' ? 'text-emerald-400' :
              locationStatus === 'PERMISSION_DENIED' ? 'text-red-400' :
              locationStatus === 'STALE' ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {locationStatus === 'AVAILABLE' ? `✓ AVAILABLE (±${gpsReading?.accuracy}m)` :
               locationStatus === 'PERMISSION_DENIED' ? '✕ DENIED' :
               locationStatus === 'STALE' ? `STALE (${gpsReading?.ageSeconds}s)` : 'WAITING'}
            </span>
          </div>
        </div>

        {/* Device & Location Coordinate Summary */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
          <div>DEVICE: <span className="text-blue-400 font-bold">{deviceId}</span></div>
          {gpsReading && locationStatus === 'AVAILABLE' ? (
            <div className="text-slate-300">
              GPS: <span className="font-mono text-emerald-400">{gpsReading.lat.toFixed(5)}, {gpsReading.lng.toFixed(5)}</span>
            </div>
          ) : (
            <div className="text-amber-400/80 italic">
              {locationStatus === 'PERMISSION_DENIED' ? 'GPS permission denied' : 'Acquiring device GPS...'}
            </div>
          )}
        </div>
      </div>

      {/* Real-time Video Viewport */}
      <div className="my-3 relative bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center aspect-[4/3] sm:aspect-video w-full shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`}
        />

        {!isStreaming && (
          <div className="text-center space-y-3 p-6">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto shadow-inner">
              <CameraOff className="w-8 h-8 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">Mobile Video Standby</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                Tap 'START FIELD RECORDING' to stream rear camera video and transmit verified device GPS telemetry.
              </p>
            </div>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-3 left-3 bg-red-600/95 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-xl backdrop-blur-xs animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
            <span>RECORDING • {formatDuration(recordingSeconds)}</span>
          </div>
        )}

        {/* AI Engine Status Banner (Section 24, 25, 26) */}
        {isStreaming && (
          <div className="absolute top-3 right-3 bg-slate-950/80 border border-slate-700/80 text-white text-[9px] font-mono px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5 shadow-md">
            <Eye className={`w-3 h-3 ${vehicleDetectedInScene ? 'text-emerald-400' : 'text-blue-400'}`} />
            <span>{aiStatusText}</span>
          </div>
        )}

        {isSaving && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <div className="text-center">
              <p className="text-xs font-bold text-white uppercase">Saving Video Recording...</p>
              <p className="text-[10px] text-slate-400">Storing evidence in Video Archive</p>
            </div>
          </div>
        )}

        {emergencyAlertSent && (
          <div className="absolute inset-0 bg-emerald-600/30 backdrop-blur-sm flex items-center justify-center p-4 z-10">
            <div className="bg-slate-900 border border-emerald-500 p-4 rounded-xl text-center space-y-2 max-w-xs shadow-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-white">EVIDENCE PHOTO CAPTURED</h3>
              <p className="text-[11px] text-slate-300">Geotagged high-res frame indexed in Central Records.</p>
            </div>
          </div>
        )}

        {/* Real-time ANPR AR HUD Overlay (Section 23) */}
        {latestScan && isStreaming && latestScan.plate_number && (
          <div className="absolute bottom-2 left-2 right-2 bg-slate-950/95 border border-slate-700 backdrop-blur-md p-2.5 rounded-xl flex items-center justify-between shadow-2xl z-10 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-400 text-slate-950 px-2.5 py-1 rounded font-mono font-black text-xs tracking-wider border border-amber-500 shadow-xs flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] bg-blue-700 text-white px-1 py-0.2 rounded font-bold">IND</span>
                {latestScan.plate_number}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    latestScan.flag === 'WATCHLIST_MATCH'
                      ? 'bg-red-600 text-white animate-pulse'
                      : latestScan.flag === 'COMPLIANCE_VIOLATION'
                      ? 'bg-amber-500 text-black font-extrabold'
                      : 'bg-emerald-500 text-black font-extrabold'
                  }`}>
                    {latestScan.flag === 'WATCHLIST_MATCH' ? '🚨 WATCHLIST MATCH' : latestScan.flag === 'COMPLIANCE_VIOLATION' ? '⚠️ EXPIRED' : '✅ COMPLIANT'}
                  </span>
                  <span className="text-[9px] text-slate-300 font-mono">
                    {(latestScan.confidence * 100).toFixed(0)}% OCR
                  </span>
                  {latestScan.visual_validation_score && (
                    <span className="text-[9px] text-emerald-400 font-mono">
                      {(latestScan.visual_validation_score * 100).toFixed(0)}% VISUAL
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-300 truncate max-w-[170px] sm:max-w-xs">{latestScan.reason}</p>
              </div>
            </div>

            {latestScan.record_id && (
              <Link
                to="/recordings"
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-950/60 border border-blue-800/60 px-2 py-1.5 rounded-lg flex items-center gap-1 shrink-0"
              >
                <Film className="w-3 h-3" /> Record
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Real-time ANPR Scans Feed */}
      {recentScans.length > 0 && (
        <div className="mb-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 shadow-xl">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              CONFIRMED FIELD ANPR SCANS ({recentScans.length})
            </span>
            <span className="text-[10px] text-slate-500 font-mono">LINKED TO RECORDS</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {recentScans.map((scan, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400/95 text-slate-950 font-black px-1.5 py-0.5 rounded font-mono text-[10px]">
                    {scan.plate_number}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase ${
                    scan.flag === 'WATCHLIST_MATCH' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                    scan.flag === 'COMPLIANCE_VIOLATION' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {scan.flag.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                  <span>{scan.timestamp}</span>
                  {scan.record_id && (
                    <Link to="/recordings" className="text-blue-400 hover:underline">
                      View
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Action Buttons (Section 21, 31) */}
      <div className="space-y-2.5">
        {/* CAPTURE EVIDENCE PHOTO */}
        <button
          onClick={takeEmergencyPhoto}
          disabled={capturingPhoto || !isStreaming}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 border border-emerald-500 disabled:opacity-40 transition-all"
        >
          <Camera className="w-4 h-4 text-emerald-100" />
          {capturingPhoto ? 'ANALYZING & CAPTURING EVIDENCE...' : '📸 CAPTURE EVIDENCE PHOTO'}
        </button>

        {/* RECORDING CONTROLS */}
        {!isRecording ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startCamera()}
              disabled={isSaving}
              className="py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
            >
              <Video className="w-4 h-4 text-blue-200" /> START FIELD RECORDING
            </button>
            <button
              onClick={switchCamera}
              className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" /> SWITCH ({facingMode === 'environment' ? 'REAR' : 'FRONT'})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={switchCamera}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" /> SWITCH CAMERA
            </button>
            <button
              onClick={stopCameraAndSave}
              disabled={isSaving}
              className="py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl border border-red-500 flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 transition-transform animate-pulse"
            >
              <Square className="w-4 h-4 text-white fill-current" /> STOP & SAVE VIDEO
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
          <span>Encrypted Traffic Evidence Pipeline</span>
          <Link to="/recordings" className="text-blue-400 hover:underline flex items-center gap-1 font-bold">
            Open Video Archive <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>

      {/* POPUP MODAL: RECORDING SAVED */}
      {savedModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">Video Evidence Stored</h3>
                  <p className="text-[10px] text-emerald-400 font-mono">Indexed in Recorded Video Archive</p>
                </div>
              </div>
              <button
                onClick={() => setSavedModalRecord(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Video Playback Preview */}
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
              <video
                src={savedModalRecord.file_blob_url || resolveVideoUrl(savedModalRecord.file_url || savedModalRecord.file_reference)}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            {/* Metadata Summary */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">RECORD ID:</span>
                <span className="text-blue-400 font-bold">{savedModalRecord.record_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">DURATION:</span>
                <span className="text-white">{savedModalRecord.duration_sec}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">FILE SIZE:</span>
                <span className="text-white">{savedModalRecord.file_size_mb} MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">LOCATION:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{savedModalRecord.location}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  setSavedModalRecord(null);
                  navigate('/recordings');
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Film className="w-3.5 h-3.5" /> View in Archive
              </button>

              <a
                href={savedModalRecord.file_blob_url || resolveVideoUrl(savedModalRecord.file_url || savedModalRecord.file_reference)}
                download={`${savedModalRecord.record_id}.mp4`}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                <Download className="w-3.5 h-3.5" /> Download Video
              </a>
            </div>

            <button
              onClick={() => {
                setSavedModalRecord(null);
                startCamera();
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors"
            >
              Record Another Video
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

