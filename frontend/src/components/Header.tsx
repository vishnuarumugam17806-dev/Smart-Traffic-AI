import React, { useState, useEffect } from 'react';
import { Siren, Wifi, WifiOff, Bell, ShieldCheck, Activity, Cpu, MapPin, Navigation, Compass, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';
import { NotificationDropdown } from './NotificationDropdown';
import { useWebLocation } from '../hooks/useWebLocation';

export const Header: React.FC = () => {
  const { isConnected, emergencyEvents, alerts, unreadAlertsCount, setAlerts, addAlert, activeLiveUpdate } = useStore();
  const [timeStr, setTimeStr] = useState<string>('');
  const [healthIndex, setHealthIndex] = useState<{ score: number; status: string }>({ score: 84.5, status: 'GOOD' });
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);

  // Web Browser Geolocation & Mutable Admin Location
  const {
    coords,
    locationName,
    permissionStatus,
    lastUpdated,
    error: locationError,
    isManualOverride,
    setManualLocation,
    resetToGpsLocation,
    requestLocationPermission,
    refreshLocation
  } = useWebLocation();

  const [isEditingLocation, setIsEditingLocation] = useState<boolean>(false);
  const [editedLocationText, setEditedLocationText] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString() + ' | ' + now.toLocaleDateString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real-time alerts from backend to populate Notification Bell
  const fetchAlerts = async () => {
    try {
      const res = await apiClient.get('/alerts');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAlerts(res.data);
      }
    } catch (err) {
      // Retains resilient fallback alerts in useStore
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  // React to live WebSocket alert updates
  useEffect(() => {
    if (activeLiveUpdate && activeLiveUpdate.event === 'ALERT_CREATED' && activeLiveUpdate.alert) {
      addAlert(activeLiveUpdate.alert);
    }
  }, [activeLiveUpdate]);

  useEffect(() => {
    const fetchHealthIndex = async () => {
      try {
        const res = await apiClient.get('/traffic/health-index');
        if (res.data && res.data.health_index !== undefined) {
          setHealthIndex({ score: res.data.health_index, status: res.data.status });
        }
      } catch (err) {
        // Fallback default
      }
    };
    fetchHealthIndex();
    const interval = setInterval(fetchHealthIndex, 10000);
    return () => clearInterval(interval);
  }, []);

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.is_read).length;

  return (
    <header className="h-14 sm:h-16 border-b border-[#DCE4EA] bg-white px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none shadow-xs">
      {/* Left Title & System Status */}
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xs sm:text-sm font-mono font-extrabold text-[#245B84] uppercase tracking-wide truncate">
            VIGITRA AI
          </span>
        </div>
        <span className="hidden md:inline-block text-[10px] text-slate-500 font-mono mt-0.5 truncate">
          City Traffic Control Center
        </span>
      </div>

      {/* Right Metrics, Connection Status & Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Web GPS Location Status Badge */}
        <div className="relative">
          {permissionStatus === 'granted' && coords ? (
            <button
              onClick={() => setShowLocationModal(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 transition-colors shadow-2xs font-mono text-[11px]"
              title="Your location is active and recorded"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              <span className="font-bold hidden md:inline">
                {coords.latitude.toFixed(3)}°, {coords.longitude.toFixed(3)}°
              </span>
              <span className="font-bold md:hidden">GPS ON</span>
            </button>
          ) : permissionStatus === 'loading' ? (
            <button
              disabled
              className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[11px]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              <span className="font-bold">Locating...</span>
            </button>
          ) : (
            <button
              onClick={() => requestLocationPermission()}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 transition-colors shadow-2xs font-mono text-[11px]"
              title="Allow location permission to record your live checkpoint"
            >
              <Navigation className="w-3.5 h-3.5 text-amber-700 animate-bounce" />
              <span className="font-bold">Enable Location</span>
            </button>
          )}

          {/* Web Location Details Modal / Dropdown */}
          {showLocationModal && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 z-50 font-mono text-xs animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-emerald-100 text-emerald-700">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase">Recorded Web Location</h4>
                    <p className="text-[9px] text-slate-500">Browser Geolocation Active</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {coords ? (
                <div className="space-y-2.5 text-[11px]">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Latitude:</span>
                      <span className="font-bold text-slate-800">{coords.latitude.toFixed(6)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Longitude:</span>
                      <span className="font-bold text-slate-800">{coords.longitude.toFixed(6)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">GPS Accuracy:</span>
                      <span className="font-bold text-emerald-700">±{coords.accuracy}m</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">
                        {isManualOverride ? '🔵 Admin Checkpoint (Manual Override)' : '🟢 Active GPS Checkpoint'}
                      </span>
                      {!isEditingLocation && (
                        <button
                          onClick={() => {
                            setEditedLocationText(locationName);
                            setIsEditingLocation(true);
                          }}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline"
                        >
                          Edit Location
                        </button>
                      )}
                    </div>

                    {isEditingLocation ? (
                      <div className="space-y-1.5 mt-1">
                        <input
                          type="text"
                          value={editedLocationText}
                          onChange={(e) => setEditedLocationText(e.target.value)}
                          placeholder="Enter custom checkpoint name..."
                          className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-[11px] text-slate-800 font-mono focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              if (editedLocationText.trim()) {
                                setManualLocation(editedLocationText);
                                setIsEditingLocation(false);
                              }
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                          >
                            Save Checkpoint
                          </button>
                          <button
                            onClick={() => setIsEditingLocation(false)}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="font-bold text-slate-800 text-[11px] block leading-tight">{locationName}</span>
                    )}
                  </div>

                  {isManualOverride && (
                    <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200 text-[10px]">
                      <span className="text-blue-800 font-medium">Custom location override active.</span>
                      <button
                        onClick={async () => {
                          await resetToGpsLocation();
                          setIsEditingLocation(false);
                        }}
                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[9px]"
                      >
                        Reset to Live GPS
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Location permission granted & recorded to central traffic registry.</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] text-slate-400">
                      {lastUpdated ? `Updated: ${new Date(lastUpdated).toLocaleTimeString()}` : ''}
                    </span>
                    <button
                      onClick={refreshLocation}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh GPS
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-center py-2">
                  <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                  <p className="text-slate-600 text-[10px]">
                    {locationError || 'Click button below to grant location permission.'}
                  </p>
                  <button
                    onClick={() => requestLocationPermission()}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[11px]"
                  >
                    Allow Location Access
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* VIGITRA AI Project Traffic Health Index */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#F2F7FC] border border-[#DCE4EA]" title="Traffic Health Index">
          <Activity className="w-3.5 h-3.5 text-[#245B84]" />
          <div className="flex flex-col text-right font-mono">
            <span className="text-[8px] text-slate-500 uppercase tracking-tight">HEALTH INDEX</span>
            <span className="text-[11px] font-extrabold text-[#245B84]">
              {healthIndex.score} / 100
            </span>
          </div>
        </div>

        {/* System Health / Connection Badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded bg-[#EAF7EF] border border-[#D2EADA] text-xs">
          {isConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#2E7D5B] shrink-0" />
              <span className="text-[#2E7D5B] font-mono text-[10px] sm:text-[11px] font-bold">ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-amber-600 font-mono text-[10px] sm:text-[11px] font-bold">SYNCING</span>
            </>
          )}
        </div>

        {/* Real-time Clock */}
        <div className="hidden lg:block text-xs font-mono text-slate-700 bg-slate-50 px-3 py-1.5 rounded border border-[#DCE4EA]">
          {timeStr || '00:00:00 AM'}
        </div>

        {/* Notifications Bell Icon with Interactive Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={`relative p-1.5 sm:p-2 rounded transition-all flex items-center justify-center cursor-pointer ${
              isDropdownOpen
                ? 'bg-[#173F5F] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#173F5F] hover:bg-[#EDF5FA]'
            }`}
            aria-label="Toggle Alerts Notification Center"
            title={`${unreadAlertsCount} Active Traffic Alerts`}
          >
            <Bell className={`w-4 h-4 ${criticalCount > 0 ? 'text-red-500 animate-pulse' : ''}`} />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-mono font-black text-[10px] flex items-center justify-center shadow-xs border-2 border-white">
                {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
              </span>
            )}
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping pointer-events-none" />
            )}
          </button>

          <NotificationDropdown
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            align="right"
          />
        </div>
      </div>
    </header>
  );
};
