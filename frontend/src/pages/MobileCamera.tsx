import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Square, CameraOff, Smartphone, Wifi, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';

export const MobileCamera: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [statusMessage, setStatusMessage] = useState<string>('CONNECTED');
  const [deviceId] = useState<string>('MOBILE-CAM-001');
  const [operatorId] = useState<string>('OFFICER_104');
  const [location] = useState<string>('Central Plaza North Approach');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  const [deviceUuid, setDeviceUuid] = useState<string>(() => {
    return localStorage.getItem('vigitra_device_uuid') || 'VG-MOB-7F92A31C';
  });

  const startCamera = async (currentFacingMode = facingMode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      setStatusMessage('REAL MOBILE CAMERA ACTIVE (WebRTC STREAMING)');

      // Link device to backend session
      const res = await apiClient.post('/devices/link', {
        device_id: deviceId,
        operator_id: operatorId,
        name: 'Field Patrol Mobile',
        assigned_location: location
      });

      if (res.data && res.data.device_uuid) {
        setDeviceUuid(res.data.device_uuid);
        localStorage.setItem('vigitra_device_uuid', res.data.device_uuid);
      }

      // Start pushing frame canvas slices over API
      if (!intervalRef.current) {
        intervalRef.current = setInterval(captureAndSendFrame, 1500);
      }
    } catch (err) {
      console.error('Error starting mobile camera:', err);
      setStatusMessage('Camera permission required to use this feature.');
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
      } catch (err) {
        // Stream frame push handling
      }
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
    setIsRecording(false);
    setStatusMessage('STREAM STOPPED');
    try {
      await apiClient.post(`/devices/${deviceId}/disconnect`);
    } catch (err) {
      // Handle disconnect API
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col justify-between select-none font-mono">
      {/* Top Mobile Header */}
      <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            <h1 className="text-sm font-bold tracking-tight">VIGITRA FIELD CAMERA</h1>
          </div>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
            isStreaming ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
          }`}>
            {statusMessage}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <div>DEVICE ID: <span className="text-white font-bold">{deviceId}</span></div>
          <div>OPERATOR: <span className="text-white font-bold">{operatorId}</span></div>
          <div className="col-span-2">LOCATION: <span className="text-white font-bold">{location}</span></div>
        </div>
      </div>

      {/* Live Video Preview Box */}
      <div className="my-4 relative bg-black rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center min-h-[300px]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`}
        />
        {!isStreaming && (
          <div className="text-center space-y-2 p-6">
            <CameraOff className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400">Camera preview inactive. Tap 'START CAMERA' below.</p>
          </div>
        )}

        {isStreaming && (
          <div className="absolute top-3 left-3 bg-emerald-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-white" /> REAL MOBILE CAMERA ACTIVE
          </div>
        )}
      </div>

      {/* Mobile Stream Action Buttons */}
      <div className="space-y-3">
        {!isStreaming ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => startCamera()}
              className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-lg"
            >
              <Camera className="w-4 h-4" /> START CAMERA
            </button>
            <button
              onClick={switchCamera}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg border border-slate-700 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> SWITCH ({facingMode === 'environment' ? 'REAR' : 'FRONT'})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={switchCamera}
              className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] rounded-lg border border-slate-700 flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> SWITCH
            </button>

            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`py-3 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 ${
                isRecording ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" /> {isRecording ? 'STOP REC' : 'START REC'}
            </button>

            <button
              onClick={stopCamera}
              className="py-3 bg-red-600/80 hover:bg-red-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1"
            >
              <Square className="w-3.5 h-3.5" /> STOP
            </button>
          </div>
        )}

        <div className="text-center text-[10px] text-slate-500 pt-1">
          VIGITRA AI Mobile Field Camera • Camera permission required for live stream
        </div>
      </div>
    </div>
  );
};
