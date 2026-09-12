import React, { useEffect, useState, useRef } from 'react';
import { Flame } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

interface GraphNode {
  id: number;
  name: string;
  lat: number;
  lng: number;
  status: string;
}

import { FALLBACK_GIS_GRAPH } from '../api/mockFallback';

export const HeatMap: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>(FALLBACK_GIS_GRAPH.nodes);
  const [measurements, setMeasurements] = useState<any>({});
  const { activeLiveUpdate } = useStore();
  
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);

  const fetchMetrics = async () => {
    try {
      const graphRes = await apiClient.get('/gis/graph');
      if (graphRes.data?.nodes && Array.isArray(graphRes.data.nodes)) {
        setNodes(graphRes.data.nodes);
      }

      const measureRes = await apiClient.get('/traffic/measurements', { params: { limit: 20 } });
      if (Array.isArray(measureRes.data)) {
        const measureMap: any = {};
        measureRes.data.forEach((m: any) => {
          if (!measureMap[m.camera_id]) {
            measureMap[m.camera_id] = m;
          }
        });
        setMeasurements(measureMap);
      }
    } catch (err) {
      console.warn('Using resilient GIS nodes for traffic heatmap:', err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeLiveUpdate && activeLiveUpdate.event === 'TRAFFIC_UPDATE') {
      fetchMetrics();
    }
  }, [activeLiveUpdate]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {}
      mapRef.current = null;
    }

    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    try {
      const map = L.map(container, {
        zoomControl: false
      }).setView([13.0604, 80.2496], 13);
      mapRef.current = map;

      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      });

      tileLayer.on('tileerror', (error: any) => {
        if (error.tile && !error.tile.dataset.retried) {
          error.tile.dataset.retried = 'true';
          error.tile.src = `https://tile.openstreetmap.org/${error.coords.z}/${error.coords.x}/${error.coords.y}.png`;
        }
      });

      tileLayer.addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      if (nodes.length > 0) {
        updateHeatmap(nodes, measurements);
      }
    } catch (err) {
      console.warn("HeatMap Leaflet initialization warning:", err);
    }
  }, [nodes, measurements]);

  const updateHeatmap = (nodesList: GraphNode[], measureMap: any) => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    circlesRef.current.forEach(c => {
      try {
        mapRef.current.removeLayer(c);
      } catch (e) {}
    });
    circlesRef.current = [];

    nodesList.forEach((node) => {
      const data = measureMap[node.id];
      const level = data ? data.congestion_level : 'LOW';
      
      let color = '#76A98A'; // LOW (Calm green overlay)
      let radius = 100;
      let opacity = 0.28;

      if (level === 'SEVERE') {
        color = '#C95B5B'; // SEVERE (Soft Red)
        radius = 280;
        opacity = 0.38;
      } else if (level === 'HIGH') {
        color = '#D98855'; // HIGH (Soft Orange)
        radius = 220;
        opacity = 0.33;
      } else if (level === 'MODERATE') {
        color = '#D4A84F'; // MODERATE (Soft Yellow)
        radius = 160;
        opacity = 0.30;
      }

      const circle = L.circle([node.lat, node.lng], {
        color: color,
        fillColor: color,
        fillOpacity: opacity,
        radius: radius,
        stroke: false
      }).addTo(mapRef.current);

      circle.bindTooltip(`<b>${node.name}</b><br>Congestion: ${level}`, { direction: 'top' });
      circlesRef.current.push(circle);
    });
  };

  return (
    <div className="p-6 space-y-6 bg-[#F7F9FB]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">GEOGRAPHIC TRAFFIC MAP</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Real-Time City Spatial Vehicle Density and Hotspots</p>
        </div>
      </div>

      {/* Map display */}
      <div className="relative rounded-lg overflow-hidden border border-[#DCE4EA] h-[520px] bg-white shadow-sm">
        <div className="absolute top-4 left-4 z-20 pointer-events-none p-3 bg-white/90 border border-[#DCE4EA] rounded shadow-sm flex items-center gap-2">
          <Flame className="w-4 h-4 text-accent-teal animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-slate-700 uppercase tracking-wider">Spatial density overlay active</span>
        </div>
        <div ref={mapContainerRef} className="w-full h-full z-10" />
      </div>
    </div>
  );
};
