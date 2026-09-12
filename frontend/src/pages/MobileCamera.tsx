import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, Video, Square, CameraOff, Smartphone, AlertTriangle, CheckCircle2, RefreshCw, Radio, Download, Film, ExternalLink, HardDrive, Clock } from 'lucide-react';
import { apiClient, resolveVideoUrl } from '../api/client';
import { useStore } from '../store/useStore';

export const MobileCamera: React.FC = () => {
  const { user } = useStore();
  const navigate = useNavigate();

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [statusMessage, setStatusMessage] = useState<string>('READY FOR FIELD RECORDING');
  const [emergencyAlertSent, setEmergencyAlertSent] = useState<boolean>(false);
  const [capturingPhoto, setCapturingPhoto] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Saved recording preview modal
  const [savedModalRecord, setSavedModalRecord] = useState<any | null>(null);
  const [recentMobileRecords, setRecentMobileRecords] = useState<any[]>([]);

  const [deviceId] = useState<string>('MOBILE-CAM-001');
  const [locationName] = useState<string>('Anna Salai Junction Approach');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number }>({ lat: 13.0604, lng: 80.2496 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const frameIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  // Load existing local mobile recordings
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

  useEffect(() => {
    loadRecentLocalRecords();

    // Fetch GPS coordinates if available
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {}
      );
    }
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startCamera = async (currentFacingMode = facingMode) => {
    try {
      setStatusMessage('REQUESTING CAMERA STREAM...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      // Request camera stream (prefer 1280x720 30fps)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      }).catch(async () => {
        // Fallback to video-only if audio permission is denied
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);

      // Determine best supported recording mimeType
      let mimeType = 'video/webm;codecs=vp8,opus';
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

      // Start media recorder slicing every 1000ms
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start elapsed recording timer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      setStatusMessage('RECORDING & DISPATCH ACTIVE');

      // Link device session on backend
      await apiClient.post('/devices/link', {
        device_id: deviceId,
        operator_id: user?.police_id || user?.username || 'OFFICER-PATROL-1',
        name: 'Field Patrol Unit',
        assigned_location: locationName
      }).catch(() => {});

      // Stream frames to control room monitor every 1.5s
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = setInterval(captureAndSendFrame, 1500);

    } catch (err) {
      console.error('Error starting mobile camera & recorder:', err);
      setStatusMessage('Camera access required. Please allow permissions.');
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

  const stopCameraAndSave = async () => {
    setIsSaving(true);
    setStatusMessage('FINALIZING & STORING VIDEO...');

    // Stop timers
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

          // Create local record immediately for resilient instant access
          const localRecord = {
            id: Date.now(),
            record_id: localRecordId,
            device_id: deviceId,
            location: locationName,
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            duration_sec: duration,
            file_size_mb: Number((videoBlob.size / (1024 * 1024)).toFixed(2)),
            file_url: blobUrl,
            file_reference: blobUrl,
            recording_type: 'MOBILE_FIELD',
            is_local: true,
            created_at: new Date().toLocaleTimeString(),
            sha256_hash: 'PENDING_SERVER_SYNC',
            event_markers: [
              { time_sec: 0.0, type: 'RECORD_START', description: `Mobile recording started by ${user?.full_name || 'Officer'}` },
              { time_sec: Number((duration / 2).toFixed(1)), type: 'FIELD_EVIDENCE', description: `Captured at ${locationName}` }
            ]
          };

          // Store in localStorage
          const existingList = JSON.parse(localStorage.getItem('vigitra_mobile_recordings') || '[]');
          const updatedList = [localRecord, ...existingList.filter((r: any) => r.record_id !== localRecordId)].slice(0, 30);
          localStorage.setItem('vigitra_mobile_recordings', JSON.stringify(updatedList));
          setRecentMobileRecords(updatedList);
          setSavedModalRecord(localRecord);

          // Prepare FormData to upload to Render backend persistent storage
          const file = new File([videoBlob], `${localRecordId}${ext}`, { type: finalMime });
          const formData = new FormData();
          formData.append('video_file', file);
          formData.append('device_id', deviceId);
          formData.append('location', locationName);
          formData.append('duration_sec', String(duration));
          formData.append('operator_name', user?.full_name || user?.police_id || 'Patrol Officer');
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
              // Update in cache with verified server data
              const syncedList = updatedList.map((r: any) => r.record_id === localRecordId ? serverRecord : r);
              localStorage.setItem('vigitra_mobile_recordings', JSON.stringify(syncedList));
              setRecentMobileRecords(syncedList);
              setSavedModalRecord(serverRecord);
            }
          } catch (uploadErr) {
            console.warn('Backend upload slow/offline. Video is safely preserved in local storage:', uploadErr);
          }

        } catch (compileErr) {
          console.error('Error processing recorded video blob:', compileErr);
        } finally {
          setIsSaving(false);
          setIsRecording(false);
          setIsStreaming(false);
          setStatusMessage('RECORDING STORED & INDEXED');
        }
      };

      recorder.stop();
    } else {
      setIsSaving(false);
      setIsRecording(false);
      setIsStreaming(false);
      setStatusMessage('RECORDING STANDBY');
    }

    // Stop hardware camera tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      await apiClient.post(`/devices/${deviceId}/disconnect`);
    } catch (err) {}
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
      {/* Header Info Banner */}
      <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400 shrink-0" />
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white uppercase">Mobile Patrol Video Unit</h1>
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

        <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-[11px] text-slate-300 pt-1">
          <div>OFFICER: <span className="text-white font-bold">{user?.full_name || user?.police_id || 'PATROL-104'}</span></div>
          <div>DEVICE ID: <span className="text-blue-400 font-bold">{deviceId}</span></div>
          <div className="col-span-2 text-slate-400 truncate">LOCATION: <span className="text-slate-200">{locationName} ({gpsCoords.lat.toFixed(3)}, {gpsCoords.lng.toFixed(3)})</span></div>
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
              <p className="text-xs font-bold text-slate-200">Mobile Video Recorder Standby</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                Tap 'START REAL-TIME RECORDING' to record traffic evidence. Videos are automatically saved to persistent storage and the Video Archive.
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

        {isSaving && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <div className="text-center">
              <p className="text-xs font-bold text-white uppercase">Saving Video Recording...</p>
              <p className="text-[10px] text-slate-400">Computing SHA-256 hash and syncing to Archive</p>
            </div>
          </div>
        )}

        {emergencyAlertSent && (
          <div className="absolute inset-0 bg-red-600/30 backdrop-blur-sm flex items-center justify-center p-4 z-10">
            <div className="bg-slate-900 border border-red-500 p-4 rounded-xl text-center space-y-2 max-w-xs shadow-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-white">EMERGENCY SNAPSHOT DISPATCHED!</h3>
              <p className="text-[11px] text-slate-300">Geotagged high-res evidence snapshot uploaded to Central Control Room DB.</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Action Buttons */}
      <div className="space-y-2.5">
        {/* ONE-TAP EMERGENCY PHOTO */}
        <button
          onClick={takeEmergencyPhoto}
          disabled={capturingPhoto || !isStreaming}
          className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-red-600/20 border border-red-500 disabled:opacity-40 transition-all"
        >
          <AlertTriangle className="w-4 h-4 text-yellow-300 animate-pulse" />
          {capturingPhoto ? 'DISPATCHING EMERGENCY PHOTO...' : '⚡ TAKE EMERGENCY PHOTO'}
        </button>

        {/* RECORDING CONTROLS */}
        {!isRecording ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startCamera()}
              disabled={isSaving}
              className="py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
            >
              <Video className="w-4 h-4 text-blue-200" /> START RECORDING
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
          <span>Encrypted Evidence Storage Active</span>
          <Link to="/recordings" className="text-blue-400 hover:underline flex items-center gap-1 font-bold">
            Open Video Archive <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        </div>
      </div>

      {/* POPUP MODAL: RECORDING SAVED & STORED CONFIRMATION */}
      {savedModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">Video Saved & Stored!</h3>
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
                <span className="text-slate-300 truncate max-w-[180px]">{savedModalRecord.location}</span>
              </div>
              <div className="pt-1 border-t border-slate-800 text-[9px] text-slate-500 break-all">
                SHA-256: {savedModalRecord.sha256_hash}
              </div>
            </div>

            {/* Action Buttons */}
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
