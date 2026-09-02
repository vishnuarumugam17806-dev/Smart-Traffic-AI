import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useStore } from '../store/useStore';

export const Layout: React.FC = () => {
  const { setIsConnected, setActiveLiveUpdate } = useStore();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/traffic`;
    
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
    <div className="flex min-h-screen bg-background text-[#24313D]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
