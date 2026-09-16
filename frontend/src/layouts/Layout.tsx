import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Siren, X } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AndroidHeader } from '../components/AndroidHeader';
import { AndroidDrawer } from '../components/AndroidDrawer';
import { AndroidBottomNav } from '../components/AndroidBottomNav';
import { useStore } from '../store/useStore';
import { useViewportScaler } from '../hooks/useViewportScaler';

export const Layout: React.FC = () => {
  useViewportScaler();
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement | null>(null);
  const mobileMainRef = useRef<HTMLDivElement | null>(null);
  const { setIsConnected, setActiveLiveUpdate } = useStore();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Reset scroll position on route navigation
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    if (mobileMainRef.current) mobileMainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const isRenderProd = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com');
    const defaultWsUrl = isRenderProd
      ? 'wss://vigitra-backend.onrender.com/ws/traffic'
      : 'ws://localhost:8000/ws/traffic';

    const envWsUrl = import.meta.env.VITE_WS_URL;
    const wsUrl = (envWsUrl && !envWsUrl.startsWith('/')) ? envWsUrl : defaultWsUrl;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setIsConnected(true);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setActiveLiveUpdate(data);
        } catch (e) {
          console.error('Error parsing WebSocket data:', e);
        }
      };
      ws.onclose = () => {
        setIsConnected(false);
      };
      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('WebSocket connection failed:', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Floating Real-Time Directory Alert State
  const [globalAlert, setGlobalAlert] = useState<{
    id?: number;
    title: string;
    message: string;
    severity: string;
    plate?: string;
    location?: string;
  } | null>(null);

  const { activeLiveUpdate: liveData } = useStore();

  useEffect(() => {
    if (!liveData) return;

    if (liveData.event === 'ALERT_CREATED' && liveData.alert) {
      const a = liveData.alert;
      setGlobalAlert({
        id: a.id,
        title: `🚨 AUTOMATIC ${a.type || 'DIRECTORY'} ALERT`,
        message: a.message || 'Vehicle identified in monitored directories',
        severity: a.severity || 'CRITICAL',
        plate: a.vehicle_plate,
        location: a.location
      });

      // Play alert chime
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.55);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.55);
        }
      } catch (e) {}

      const timer = setTimeout(() => setGlobalAlert(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [liveData]);

  return (
    <div className="min-h-screen bg-background text-[#24313D] max-w-full overflow-x-hidden">
      {/* 1. DESKTOP / LAPTOP LAYOUT LAYER (Screens >= 768px) */}
      <div className="hidden md:flex min-h-screen w-full max-w-full overflow-x-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
          <Header />
          <main ref={mainRef} className="flex-1 overflow-y-auto w-full max-w-full overflow-x-hidden">
            <Outlet key={location.pathname} />
          </main>
        </div>
      </div>

      {/* 2. CUSTOM ANDROID MOBILE LAYOUT LAYER (Screens < 768px) */}
      <div className="md:hidden flex flex-col min-h-screen w-full max-w-full overflow-x-hidden pt-14 pb-16">
        {/* Custom Android Header */}
        <AndroidHeader onOpenDrawer={() => setDrawerOpen(true)} />

        {/* Custom Android Mobile Drawer */}
        <AndroidDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

        {/* Custom Android Bottom Navigation Bar */}
        <AndroidBottomNav onOpenDrawer={() => setDrawerOpen(true)} />

        {/* Mobile Page Content Area */}
        <main ref={mobileMainRef} className="flex-1 w-full max-w-full overflow-x-hidden">
          <Outlet key={location.pathname} />
        </main>
      </div>

      {/* FLOATING REAL-TIME DIRECTORY ALERT TOAST */}
      {globalAlert && (
        <div className="fixed top-16 right-4 z-50 max-w-md w-full animate-bounce">
          <div className="p-4 rounded-2xl bg-red-600 text-white shadow-2xl border-2 border-amber-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-white/20">
                  <Siren className="w-5 h-5 text-amber-300 animate-pulse" />
                </span>
                <div>
                  <h4 className="font-mono font-black text-xs uppercase tracking-wider">{globalAlert.title}</h4>
                  <p className="text-[10px] text-red-100 font-mono">{globalAlert.location || 'Surveillance Network'}</p>
                </div>
              </div>
              <button
                onClick={() => setGlobalAlert(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {globalAlert.plate && (
              <div className="inline-block px-3 py-1 bg-amber-300 text-slate-950 font-black font-mono text-xs rounded border border-slate-900 tracking-widest">
                {globalAlert.plate}
              </div>
            )}

            <p className="text-xs font-mono font-medium text-white/95 line-clamp-2">
              {globalAlert.message}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-white/20">
              <Link
                to="/alerts"
                onClick={() => setGlobalAlert(null)}
                className="text-[11px] font-mono font-bold text-amber-300 hover:text-white flex items-center gap-1 underline"
              >
                View in Alert Center →
              </Link>
              {globalAlert.plate && (
                <Link
                  to={`/anpr`}
                  onClick={() => setGlobalAlert(null)}
                  className="px-2.5 py-1 rounded bg-white text-red-700 hover:bg-amber-300 font-mono font-bold text-[10px] flex items-center gap-1 shadow-xs"
                >
                  Inspect Directory
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
