import React, { useEffect, useState } from 'react';
import { Smartphone, Camera, Wifi, Battery, MapPin, User, Power, Plus, RefreshCw, CheckCircle2, Shield, QrCode, Clock, XCircle, ExternalLink, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../api/client';

export const LinkDeviceCamera: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'QR' | 'MANUAL'>('QR');
  const [copied, setCopied] = useState<boolean>(false);

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
      setDevices(res.data);
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  // 5-minute Countdown Timer Effect for QR Pairing
  useEffect(() => {
    let timer: any;
    if (showLinkModal && pairingStatus === 'WAITING' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
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

  // Generate QR pairing URLs (Localhost and Local Wi-Fi IP)
  const wifiIp = "192.168.1.5";
  const mobileCameraPath = `/mobile-camera?token=${pairingToken}&code=${pairingCode}`;
  const wifiUrl = `http://${wifiIp}:5173${mobileCameraPath}`;
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
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight uppercase">LINK MOBILE CAMERA MANAGEMENT</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Mobile Field Camera Pairing, Live Stream Status & Session Registry</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <a
            href="/mobile-camera"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial px-3.5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <ExternalLink className="w-4 h-4" /> OPEN MOBILE FIELD CAMERA
          </a>
          <button
            onClick={() => {
              setShowLinkModal(true);
              handleGenerateNewQR();
            }}
            className="flex-1 md:flex-initial px-4 py-2.5 min-h-[44px] bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> LINK CAMERA
          </button>
        </div>
      </div>

      {/* Connected Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-lg border border-[#DCE4EA] text-slate-500 font-mono text-xs">
            No active mobile device cameras connected. Click "LINK MOBILE CAMERA" to scan QR code and pair a field camera.
          </div>
        ) : (
          devices.map((dev) => (
            <div key={dev.id} className="bg-white p-5 rounded-lg border border-[#DCE4EA] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#245B84]" />
                  <div>
                    <h3 className="font-bold text-xs text-slate-800 font-mono">{dev.name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">{dev.device_id}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded ${
                  dev.connection_status === 'CONNECTED' ? 'bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {dev.connection_status}
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-[#245B84]" /> Device UUID:</span>
                  <span className="font-bold text-[#245B84]">{dev.device_uuid || 'VG-MOB-7F92A31C'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location:</span>
                  <span className="font-bold text-slate-800">{dev.assigned_location || 'North Corridor'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Operator:</span>
                  <span className="font-bold text-slate-800">{dev.operator_id || 'OFFICER_104'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><Battery className="w-3.5 h-3.5" /> Battery:</span>
                  <span className="font-bold text-[#2E7D5B]">{dev.battery_pct || 94}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1"><Wifi className="w-3.5 h-3.5" /> Network:</span>
                  <span className="font-bold text-[#245B84]">WebRTC 5G (30 FPS)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#DCE4EA] flex items-center justify-between gap-1">
                <a
                  href="/mobile-camera"
                  target="_blank"
                  className="text-[10px] font-mono font-bold text-[#245B84] hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Stream
                </a>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDisconnect(dev.device_id)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-[#DCE4EA] text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-colors"
                  >
                    <Power className="w-3 h-3 text-slate-500" /> Disconnect
                  </button>
                  <button
                    onClick={() => handleRevoke(dev.device_id)}
                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-mono font-bold rounded flex items-center gap-1 transition-colors"
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-xl w-full max-w-lg overflow-hidden select-none">
            {/* Modal Header */}
            <div className="p-4 bg-[#E5EFF6] border-b border-[#DCE4EA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#245B84]" />
                <h3 className="font-bold text-sm text-[#173F5F] font-mono uppercase">LINK MOBILE CAMERA</h3>
              </div>
              <button
                onClick={handleCancelPairing}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Option Tabs */}
            <div className="flex border-b border-[#DCE4EA] bg-slate-50 font-mono text-xs font-bold">
              <button
                onClick={() => setActiveTab('QR')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  activeTab === 'QR'
                    ? 'border-[#245B84] text-[#245B84] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                OPTION 1 — SCAN QR CODE
              </button>
              <button
                onClick={() => setActiveTab('MANUAL')}
                className={`flex-1 py-2.5 text-center border-b-2 transition-colors ${
                  activeTab === 'MANUAL'
                    ? 'border-[#245B84] text-[#245B84] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                OPTION 2 — PAIRING CODE
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 space-y-5">
              {activeTab === 'QR' ? (
                <div className="text-center space-y-4 font-mono">
                  <p className="text-xs text-slate-600">
                    Scan this QR code using your phone camera (Wi-Fi Network URL)
                  </p>

                  {/* Real Scannable QR Code */}
                  <div className="p-4 bg-white border-2 border-[#DCE4EA] rounded-xl inline-block shadow-xs">
                    <QRCodeSVG
                      value={wifiUrl}
                      size={180}
                      level="H"
                      marginSize={1}
                      fgColor="#173F5F"
                    />
                  </div>

                  {/* Scannable & Clickable Links */}
                  <div className="p-3 bg-slate-50 border border-[#DCE4EA] rounded-lg text-left space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-bold">Local Wi-Fi Network URL:</span>
                      <button
                        onClick={() => copyToClipboard(wifiUrl)}
                        className="text-[#245B84] hover:underline flex items-center gap-1 font-bold"
                      >
                        <Copy className="w-3 h-3" /> {copied ? 'COPIED!' : 'COPY'}
                      </button>
                    </div>
                    <p className="text-slate-800 break-all font-mono font-bold bg-white p-1.5 rounded border border-[#DCE4EA] text-[10px]">
                      {wifiUrl}
                    </p>

                    <div className="pt-2 flex items-center justify-between border-t border-[#DCE4EA]">
                      <span className="text-slate-500 font-bold">Direct Browser Link:</span>
                      <a
                        href="/mobile-camera"
                        target="_blank"
                        className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                      >
                        <ExternalLink className="w-3 h-3" /> Open in New Tab
                      </a>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">Pairing Code: <span className="font-bold text-slate-800 text-sm tracking-widest">{pairingCode}</span></p>
                    <p className="text-xs text-amber-700 font-bold flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Expires in: {formatTime(timeLeft)}
                    </p>
                  </div>

                  {/* Quick Action Button to Confirm Device Link */}
                  <button
                    onClick={() => handleLinkDevice()}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" /> CONFIRM & LINK MOBILE DEVICE
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLinkDevice} className="space-y-4 font-mono text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Device ID</label>
                    <input
                      type="text"
                      required
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Device Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Operator ID</label>
                    <input
                      type="text"
                      required
                      value={operatorId}
                      onChange={(e) => setOperatorId(e.target.value)}
                      className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1">Assigned Location</label>
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-white border border-[#DCE4EA] rounded p-2 text-slate-800 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white text-xs font-mono font-bold rounded"
                  >
                    Pair Device Manually
                  </button>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-[#DCE4EA] flex justify-end">
              <button
                type="button"
                onClick={handleCancelPairing}
                className="px-4 py-1.5 text-xs font-mono font-bold text-slate-600 hover:bg-slate-200 rounded"
              >
                Cancel Pairing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
