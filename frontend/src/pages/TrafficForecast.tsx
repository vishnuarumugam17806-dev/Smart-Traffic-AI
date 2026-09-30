import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  MapPin,
  Clock,
  RefreshCw,
  BarChart2,
  Shield,
  Layers,
  ChevronRight,
  Sliders,
  RotateCcw
} from 'lucide-react';
import { apiClient } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

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

const DEFAULT_ZONES: ForecastZone[] = [
  { id: "CBD", name: "Central Business District", current_density: "HIGH", predicted_density_1h: "SEVERE", predicted_density_6h: "MODERATE", predicted_vehicle_count: 1420, average_speed_kmh: 22.4, congestion_index: 88, peak_window: "17:30 - 19:45", recommended_action: "Reroute commercial heavy vehicles to Outer Bypass Ring Road." },
  { id: "NORTH", name: "North Industrial Corridor", current_density: "MODERATE", predicted_density_1h: "MODERATE", predicted_density_6h: "LOW", predicted_vehicle_count: 850, average_speed_kmh: 38.6, congestion_index: 54, peak_window: "08:00 - 10:30", recommended_action: "Prioritize container freight signal clearance along Ennore Expressway." },
  { id: "SOUTH", name: "South Residential Belt", current_density: "MODERATE", predicted_density_1h: "HIGH", predicted_density_6h: "LOW", predicted_vehicle_count: 1120, average_speed_kmh: 31.2, congestion_index: 68, peak_window: "18:00 - 20:30", recommended_action: "Synchronize GST corridor traffic signals for continuous Southbound green wave." },
  { id: "EAST", name: "East Coast Tech Corridor", current_density: "SEVERE", predicted_density_1h: "SEVERE", predicted_density_6h: "MODERATE", predicted_vehicle_count: 1980, average_speed_kmh: 18.2, congestion_index: 92, peak_window: "17:00 - 20:00", recommended_action: "Implement tidal flow lane reversal on Rajiv Gandhi Salai (OMR Expressway)." },
  { id: "WEST", name: "West Suburban Hub", current_density: "HIGH", predicted_density_1h: "HIGH", predicted_density_6h: "MODERATE", predicted_vehicle_count: 1350, average_speed_kmh: 26.5, congestion_index: 76, peak_window: "18:30 - 21:00", recommended_action: "Deploy adaptive green extension at CMBT Koyambedu roundabout." },
  { id: "AIRPORT", name: "Airport & Logistics Hub", current_density: "LOW", predicted_density_1h: "MODERATE", predicted_density_6h: "LOW", predicted_vehicle_count: 620, average_speed_kmh: 52.1, congestion_index: 38, peak_window: "21:00 - 23:30", recommended_action: "Maintain rapid express lane priority for airport transit corridors." }
];

const TIME_RANGES = ['5 min', '15 min', '30 min', '1 hour', '6 hours'];

export const TrafficForecast: React.FC = () => {
  const [zones, setZones] = useState<ForecastZone[]>(DEFAULT_ZONES);
  const [selectedZone, setSelectedZone] = useState<ForecastZone | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<string>('1 hour');
  const [loading, setLoading] = useState<boolean>(false);
  const [overallScore, setOverallScore] = useState<number>(68);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/forecast/regional');
      if (res.data && res.data.zones && Array.isArray(res.data.zones) && res.data.zones.length > 0) {
        setZones(res.data.zones);
        setOverallScore(res.data.overall_city_congestion_score || 68);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn('Backend regional forecast fallback:', err);
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
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MODERATE':
        return 'bg-blue-50 text-[#245B84] border-blue-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 select-none max-w-7xl mx-auto font-sans bg-[#F8FAFC] min-h-screen">
      {/* Page Header */}
      <PageHeader
        title="Traffic Forecast"
        subtitle="Predictive congestion modeling and peak-window deployment advisory"
        badge={
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EAF7EF] text-[#2E7D5B] border border-[#D2EADA]">
            {zones.length} CORRIDORS
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="bg-white px-3 py-1 rounded-xl border border-[#DCE4EA] text-right shadow-2xs">
              <span className="text-[9px] text-slate-400 font-mono uppercase block">City Congestion</span>
              <span className="text-xs font-bold text-amber-700 font-mono">{overallScore} / 100</span>
            </div>
            <button
              onClick={fetchForecastData}
              disabled={loading}
              className="p-2 bg-white hover:bg-slate-50 border border-[#DCE4EA] text-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
              title="Refresh Forecast Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* FILTER-FIRST INITIAL STATE */}
      {!selectedZone ? (
        <EmptyState
          icon={TrendingUp}
          title="SELECT A JUNCTION / REGION TO VIEW THE FORECAST"
          description="Choose a monitored traffic corridor below along with the forecast horizon to generate predictions, congestion scores, and peak advisory."
          action={
            <div className="w-full max-w-4xl space-y-4 pt-3">
              {/* Time Range Horizon Selector */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">PROJECTION HORIZON:</span>
                <div className="flex bg-white p-1 rounded-xl border border-[#DCE4EA] shadow-2xs">
                  {TIME_RANGES.map((range) => (
                    <button
                      key={range}
                      onClick={() => setSelectedHorizon(range)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        selectedHorizon === range
                          ? 'bg-[#245B84] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monitored Zones Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {zones.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className="p-4 bg-white hover:bg-[#EEF6FC] rounded-xl border border-[#DCE4EA] hover:border-[#245B84] text-left transition-all shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold text-[#245B84] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {zone.id}
                      </span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${getDensityColor(zone.current_density)}`}>
                        {zone.current_density}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#245B84] truncate">
                      {zone.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-1">
                      Peak: {zone.peak_window}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px] font-mono border-t border-slate-100 pt-2 text-slate-600">
                      <span>Avg: <strong className="text-slate-900">{zone.average_speed_kmh} km/h</strong></span>
                      <span className="text-[#245B84] font-bold group-hover:underline flex items-center gap-1">
                        Inspect →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          }
        />
      ) : (
        /* FORECAST DETAILS VIEW */
        <div className="space-y-4">
          {/* Active Corridor Selector Bar */}
          <div className="bg-white p-3 rounded-xl border border-[#DCE4EA] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#245B84]" />
                <span className="font-bold text-slate-700 font-mono">CORRIDOR:</span>
                <select
                  value={selectedZone.id}
                  onChange={(e) => {
                    const z = zones.find((item) => item.id === e.target.value);
                    if (z) setSelectedZone(z);
                  }}
                  className="bg-[#F8FAFC] border border-[#DCE4EA] rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:border-[#245B84] cursor-pointer"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.current_density})
                    </option>
                  ))}
                </select>
              </div>

              {/* Horizon Switcher */}
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-0.5 rounded-lg border border-[#DCE4EA]">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => setSelectedHorizon(range)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      selectedHorizon === range
                        ? 'bg-[#245B84] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedZone(null)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Change Corridor
            </button>
          </div>

          {/* Zone Detailed Forecast Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Zone Overview Card */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE4EA] pb-3">
                <div>
                  <span className="text-[10px] font-mono text-[#245B84] font-bold uppercase tracking-wider">
                    CORRIDOR TELEMETRY • {selectedZone.id}
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                    {selectedZone.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-500">
                    Live Horizon: <strong>{selectedHorizon}</strong>
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${getDensityColor(selectedZone.current_density)}`}>
                    {selectedZone.current_density} DENSITY
                  </span>
                </div>
              </div>

              {/* 4 KPI Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#DCE4EA]">
                  <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">1h Forecast</div>
                  <div className="text-sm font-bold text-slate-800 mt-1">{selectedZone.predicted_density_1h}</div>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#DCE4EA]">
                  <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">6h Forecast</div>
                  <div className="text-sm font-bold text-slate-800 mt-1">{selectedZone.predicted_density_6h}</div>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#DCE4EA]">
                  <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Estimated Volume</div>
                  <div className="text-sm font-bold text-[#245B84] mt-1">{selectedZone.predicted_vehicle_count} veh/h</div>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#DCE4EA]">
                  <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Corridor Speed</div>
                  <div className="text-sm font-bold text-emerald-700 mt-1">{selectedZone.average_speed_kmh} km/h</div>
                </div>
              </div>

              {/* Congestion Gauge Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Congestion Severity Rating</span>
                  <span className="text-amber-800 font-bold">{selectedZone.congestion_index} / 100</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedZone.congestion_index > 75
                        ? 'bg-rose-500'
                        : selectedZone.congestion_index > 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${selectedZone.congestion_index}%` }}
                  />
                </div>
              </div>

              {/* AI Traffic Advisory & Recommended Action */}
              <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#245B84] font-mono">
                  <Shield className="w-4 h-4 text-[#245B84]" />
                  CONTROL ROOM TRAFFIC ADVISORY & DEPLOYMENT ACTION
                </div>
                <p className="text-xs text-slate-800 leading-relaxed font-sans font-medium">
                  {selectedZone.recommended_action}
                </p>
                <div className="text-[10px] font-mono text-slate-500 pt-1">
                  Peak Expected Window: <strong className="text-slate-800">{selectedZone.peak_window}</strong>
                </div>
              </div>
            </div>

            {/* 24-Hour Projected Volume Trend */}
            <div className="bg-white p-5 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-3">
                  <h3 className="text-xs font-mono font-bold text-slate-800 uppercase flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-[#245B84]" />
                    24h Volume Curve
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Updated {lastUpdated}</span>
                </div>
                <p className="text-[11px] text-slate-500 font-sans mt-2">
                  Projected hourly vehicle distribution for {selectedZone.name}
                </p>
              </div>

              <div className="h-44 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA] p-3 flex items-end justify-between gap-1.5 text-[9px] font-mono text-slate-500">
                {[
                  { time: '06h', vol: 30, color: 'bg-[#245B84]' },
                  { time: '08h', vol: 85, color: 'bg-amber-500' },
                  { time: '10h', vol: 60, color: 'bg-[#245B84]' },
                  { time: '12h', vol: 45, color: 'bg-emerald-600' },
                  { time: '14h', vol: 50, color: 'bg-[#245B84]' },
                  { time: '16h', vol: 70, color: 'bg-amber-500' },
                  { time: '18h', vol: 95, color: 'bg-rose-600' },
                  { time: '20h', vol: 65, color: 'bg-amber-500' },
                  { time: '22h', vol: 35, color: 'bg-emerald-600' },
                ].map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
                    <div
                      className={`w-full max-w-[24px] rounded-t transition-all ${bar.color}`}
                      style={{ height: `${bar.vol}%` }}
                    />
                    <span className="text-[8px]">{bar.time}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-100 pt-2">
                <span>🟢 Low: &lt;50%</span>
                <span>🟡 Mod: 50-80%</span>
                <span>🔴 Peak: &gt;80%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
