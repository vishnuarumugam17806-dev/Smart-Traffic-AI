import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AndroidHeader } from '../components/AndroidHeader';
import { AndroidDrawer } from '../components/AndroidDrawer';
import { AndroidBottomNav } from '../components/AndroidBottomNav';
import { useStore } from '../store/useStore';
import { useViewportScaler } from '../hooks/useViewportScaler';

export const Layout: React.FC = () => {
  useViewportScaler();
  const { setIsConnected, setActiveLiveUpdate } = useStore();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);


  useEffect(() => {
    const envWsUrl = import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fallbackWsUrl = `${protocol}//${window.location.host}/ws/traffic`;
    const wsUrl = envWsUrl || fallbackWsUrl;

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
          <main className="flex-1 overflow-y-auto w-full max-w-full overflow-x-hidden">
            <Outlet />
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
        <main className="flex-1 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
