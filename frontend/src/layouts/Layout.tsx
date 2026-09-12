import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
    </div>
  );
};
