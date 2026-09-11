import React, { useState, useEffect } from 'react';
import { TrendingUp, MapPin, AlertCircle, Clock, Navigation, CheckCircle2, RefreshCw, BarChart2, Shield } from 'lucide-react';
import { apiClient } from '../api/client';

interface ForecastZone {
  id: string;
  name: string;
  current_density: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  predicted_density_1h: string;
  predicted_density_6h: string;
  predicted_vehicle_count: number;
  average_speed_kmh: number;
  congestion_index: number;
  peak_window: string;
  recommended_action: string;
}

export const TrafficForecast: React.FC = () => {
  const [zones, setZones] = useState<ForecastZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<ForecastZone | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [overallScore, setOverallScore] = useState<number>(64);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchForecastData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/forecast/regional');
      if (res.data && res.data.zones) {
        setZones(res.data.zones);
        setOverallScore(res.data.overall_city_congestion_score || 64);
        if (!selectedZone && res.data.zones.length > 0) {
          setSelectedZone(res.data.zones[0]);
        }
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Error fetching regional forecast:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
  }, []);

  const getDensityColor = (density: string) => {
    switch (density.toUpperCase()) {
      case 'SEVERE':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'MODERATE':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 select-none max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">Region-Based Traffic Forecasting</h1>
          </div>
          <p className="text-xs text-slate-400">
            Predictive congestion indices, vehicle volume modeling, and peak-hour deployment advisories categorized by city zones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-right">
            <div className="text-[10px] text-slate-400 font-mono uppercase">City Congestion Index</div>
            <div className="text-lg font-black text-amber-400 font-mono">{overallScore} / 100</div>
          </div>
          <button
            onClick={fetchForecastData}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg transition-colors"
            title="Refresh Forecast Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Zone Selector Cards, Right Detailed Zone Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Zone Selector List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider px-1">
            Geographical Regions ({zones.length})
          </h2>
          
          <div className="space-y-2.5">
            {zones.map((zone) => (
              <div
                key={zone.id}
                onClick={() => setSelectedZone(zone)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedZone?.id === zone.id
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      {zone.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">Peak: {zone.peak_window}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getDensityColor(zone.current_density)}`}>
                    {zone.current_density}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono border-t border-slate-800/80 pt-2.5 text-slate-300">
                  <div>Predicted 1h: <span className="text-white font-bold">{zone.predicted_density_1h}</span></div>
                  <div>Avg Speed: <span className="text-blue-400 font-bold">{zone.average_speed_kmh} km/h</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Zone Forecast Deep Dive */}
        {selectedZone && (
          <div className="lg:col-span-2 space-y-6">
            
            {/* Zone Overview Card */}
            <div className="bg-slate-900/90 p-6 rounded-xl border border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Selected Region</span>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
                    {selectedZone.name}
                  </h2>
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-lg border ${getDensityColor(selectedZone.current_density)}`}>
                  Live Density: {selectedZone.current_density}
                </span>
              </div>

              {/* Forecast Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/70 p-3.5 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-mono">1h Forecast</div>
                  <div className="text-sm font-bold text-white mt-1">{selectedZone.predicted_density_1h}</div>
                </div>

                <div className="bg-slate-800/70 p-3.5 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-mono">6h Forecast</div>
                  <div className="text-sm font-bold text-white mt-1">{selectedZone.predicted_density_6h}</div>
                </div>

                <div className="bg-slate-800/70 p-3.5 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-mono">Estimated Volume</div>
                  <div className="text-sm font-bold text-blue-400 mt-1">{selectedZone.predicted_vehicle_count} veh/h</div>
                </div>

                <div className="bg-slate-800/70 p-3.5 rounded-lg border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-mono">Avg Corridor Speed</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">{selectedZone.average_speed_kmh} km/h</div>
                </div>
              </div>

              {/* Congestion Progress Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Congestion Severity Rating</span>
                  <span className="text-amber-400 font-bold">{selectedZone.congestion_index} / 100</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedZone.congestion_index > 75
                        ? 'bg-red-500'
                        : selectedZone.congestion_index > 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${selectedZone.congestion_index}%` }}
                  />
                </div>
              </div>

              {/* AI Traffic Advisory & Officer Deployment Action */}
              <div className="bg-blue-950/40 border border-blue-800/50 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300 font-mono">
                  <Shield className="w-4 h-4 text-blue-400" />
                  CONTROL ROOM TRAFFIC ADVISORY & DEPLOYMENT ACTION
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {selectedZone.recommended_action}
                </p>
              </div>
            </div>

            {/* Time Series Predictive Chart Mock View */}
            <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-400" />
                  24-Hour Projected Volume & Speed Trend Curve
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">Updated {lastUpdated || 'Just now'}</span>
              </div>

              <div className="h-44 bg-slate-950/80 rounded-lg border border-slate-800 p-4 flex items-end justify-between gap-2 text-[10px] font-mono text-slate-400">
                {[
                  { time: '06:00', vol: 30, color: 'bg-blue-500' },
                  { time: '08:00', vol: 85, color: 'bg-amber-500' },
                  { time: '10:00', vol: 60, color: 'bg-blue-500' },
                  { time: '12:00', vol: 45, color: 'bg-emerald-500' },
                  { time: '14:00', vol: 50, color: 'bg-blue-500' },
                  { time: '16:00', vol: 70, color: 'bg-amber-500' },
                  { time: '18:00', vol: 95, color: 'bg-red-500' },
                  { time: '20:00', vol: 65, color: 'bg-amber-500' },
                  { time: '22:00', vol: 35, color: 'bg-emerald-500' },
                ].map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end">
                    <div
                      className={`w-full max-w-[28px] rounded-t transition-all ${bar.color}`}
                      style={{ height: `${bar.vol}%` }}
                    />
                    <span className="text-[9px]">{bar.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
