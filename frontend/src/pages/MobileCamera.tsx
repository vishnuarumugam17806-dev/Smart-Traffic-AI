import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Square, CameraOff, Smartphone, AlertTriangle, CheckCircle2, RefreshCw, Radio } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

export const MobileCamera: React.FC = () => {
  const { user } = useStore();
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [statusMessage, setStatusMessage] = useState<string>('READY FOR DISPATCH STREAM');
  const [emergencyAlertSent, setEmergencyAlertSent] = useState<boolean>(false);
  const [capturingPhoto, setCapturingPhoto] = useState<boolean>(false);
  
  const [deviceId] = useState<string>('MOBILE-CAM-001');
  const [locationName, setLocationName] = useState<string>('Central Junction Approach');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  // Fetch actual GPS location if available
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {}
      );
    }
  }, []);

  const startCamera = async (currentFacingMode = facingMode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      setStatusMessage('REAL-TIME RECORDING ACTIVE');

      // Link device session
      await apiClient.post('/devices/link', {
        device_id: deviceId,
        operator_id: user?.police_id || user?.username || 'OFFICER-PATROL-1',
        name: 'Field Patrol Unit',
        assigned_location: locationName
      }).catch(() => {});

      if (!intervalRef.current) {
        intervalRef.current = setInterval(captureAndSendFrame, 1500);
      }
    } catch (err) {
      console.error('Error starting mobile camera:', err);
      setStatusMessage('Camera access required. Please allow camera permissions.');
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isStreaming) {
      startCamera(nextMode);
    }
  };

  const captureAndSendFrame = async () => {
    if (!videoRef.current || !streamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      const base64 = canvas.toDataURL('image/jpeg', 0.6);
      try {
        await apiClient.post('/mobile-camera/stream-frame', {
          device_id: deviceId,
          frame_base64: base64
        });
      } catch (err) {}
    }
  };

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
        photoBase64 = canvas.toDataURL('image/jpeg', 0.85);
      }
    }

    try {
      await apiClient.post('/field/capture-photo', {
        operator_id: user?.police_id || user?.username || 'OFFICER-FIELD-1',
        location: `${locationName} (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)})`,
        photo_base64: photoBase64,
        device_id: deviceId
      });

      setEmergencyAlertSent(true);
      setTimeout(() => setEmergencyAlertSent(false), 4000);
    } catch (err) {
      console.error('Error dispatching emergency photo:', err);
    } finally {
      setCapturingPhoto(false);
    }
  };

  const stopCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
    setStatusMessage('RECORDING STOPPED');
    try {
      await apiClient.post(`/devices/${deviceId}/disconnect`);
    } catch (err) {}
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col justify-between select-none font-mono">
      {/* Header Info Banner */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400 shrink-0" />
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">Mobile Field Unit</h1>
          </div>
          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full flex items-center gap-1.5 ${
            isStreaming ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            <Radio className={`w-3 h-3 ${isStreaming ? 'animate-pulse text-red-500' : ''}`} />
            {isStreaming ? 'LIVE RECORDING' : 'IDLE'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
          <div>OFFICER: <span className="text-white font-bold">{user?.full_name || user?.police_id || 'FIELD OFFICER'}</span></div>
          <div>POLICE ID: <span className="text-blue-400 font-bold">{user?.police_id || 'POLICE-104'}</span></div>
          <div className="col-span-2">LOCATION: <span className="text-slate-200">{locationName} ({gpsCoords.lat.toFixed(3)}, {gpsCoords.lng.toFixed(3)})</span></div>
        </div>
      </div>

      {/* Real-time Video Canvas / Camera View */}
      <div className="my-4 relative bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center aspect-[4/3] sm:aspect-video w-full shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`}
        />

        {!isStreaming && (
          <div className="text-center space-y-3 p-6">
            <CameraOff className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">Real-time video recording standby.</p>
            <p className="text-[10px] text-slate-500">Tap 'START REAL-TIME RECORDING' below to begin.</p>
          </div>
        )}

        {isStreaming && (
          <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-md flex items-center gap-2 shadow-lg animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-white" /> REC • LIVE CONTROL ROOM BROADCAST
          </div>
        )}

        {emergencyAlertSent && (
          <div className="absolute inset-0 bg-red-600/30 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500 p-4 rounded-xl text-center space-y-2 max-w-xs shadow-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-white">EMERGENCY SNAPSHOT DISPATCHED!</h3>
              <p className="text-[11px] text-slate-300">Geotagged high-res evidence snapshot uploaded to Central Control Room DB.</p>
            </div>
          </div>
        )}
      </div>

      {/* Streamlined Field Controls: 1) Real-Time Recording 2) Take Emergency Photo */}
      <div className="space-y-3">
        {/* ONE-TAP EMERGENCY PHOTO BUTTON (PROMINENT ACCESSIBILITY) */}
        <button
          onClick={takeEmergencyPhoto}
          disabled={capturingPhoto}
          className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] text-white font-black text-sm tracking-wider uppercase rounded-xl flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/20 border border-red-500 disabled:opacity-50 transition-transform"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-300 animate-pulse" />
          {capturingPhoto ? 'CAPTURING GEOTAGGED PHOTO...' : '⚡ TAKE EMERGENCY PHOTO'}
        </button>

        {/* REAL-TIME STREAM RECORDING CONTROLS */}
        {!isStreaming ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => startCamera()}
              className="py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
            >
              <Video className="w-4 h-4" /> START REAL-TIME RECORDING
            </button>
            <button
              onClick={switchCamera}
              className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4" /> SWITCH ({facingMode === 'environment' ? 'REAR' : 'FRONT'})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={switchCamera}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <RefreshCw className="w-4 h-4" /> SWITCH CAMERA
            </button>
            <button
              onClick={stopCamera}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Square className="w-4 h-4 text-red-400" /> STOP STREAM
            </button>
          </div>
        )}

        <div className="text-center text-[10px] text-slate-500 pt-1">
          Confidential Police Mobile Portal • Encrypted Evidence Dispatch & GPS Tagging Active
        </div>
      </div>
    </div>
  );
};
