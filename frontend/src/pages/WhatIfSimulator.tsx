import React, { useState } from 'react';
import { Play, Activity, AlertTriangle, TrendingUp, Sliders } from 'lucide-react';
import { apiClient } from '../api/client';

interface SimulationResult {
  intersection_id: number;
  predicted_volume_before: number;
  predicted_volume_after: number;
  predicted_queue_before: number;
  predicted_queue_after: number;
  average_travel_time_before_sec: number;
  average_travel_time_after_sec: number;
}

export const WhatIfSimulator: React.FC = () => {
  const [intersectionId, setIntersectionId] = useState<number>(1);
  const [closedLanes, setClosedLanes] = useState<number>(0);
  const [greenTimeDelta, setGreenTimeDelta] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/simulation/what-if', {
        intersection_id: intersectionId,
        closed_lanes: closedLanes,
        green_time_delta: greenTimeDelta
      });
      setResult(res.data);
    } catch (err) {
      console.error('Error running What-If simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F6F8FA] min-h-[calc(100vh-64px)]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#DCE4EA] pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">WHAT-IF TRAFFIC SIMULATOR</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Simulate Lane Closures, Signal Changes, and Preemption Corridor Impacts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-white p-5 rounded-lg border border-[#DCE4EA] space-y-5 h-fit">
          <h2 className="text-xs font-mono font-extrabold text-slate-700 uppercase border-b border-[#DCE4EA] pb-2 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-primary-500" /> Simulation Control Variables
          </h2>

          <div className="space-y-4 text-xs font-mono text-slate-650">
            <div>
              <label className="block font-bold mb-1.5">Target Intersection</label>
              <select
                value={intersectionId}
                onChange={(e) => setIntersectionId(Number(e.target.value))}
                className="w-full bg-[#F5F8FA] border border-[#CBD6DE] rounded p-2 text-slate-800 focus:outline-none"
              >
                <option value={1}>Central Plaza Junction</option>
                <option value={2}>Metro Station Cross</option>
                <option value={3}>North Corridor Flyover</option>
                <option value={4}>Tech Park Highway</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span>Closed Lanes</span>
                <span className="text-[#B84A4A]">{closedLanes} Lanes</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                value={closedLanes}
                onChange={(e) => setClosedLanes(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#B84A4A]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Simulate accidents, blockages, or public construction work.</p>
            </div>

            <div>
              <div className="flex justify-between font-bold mb-1">
                <span>Green Phase Adjust (Green Time Delta)</span>
                <span className="text-accent-success">{greenTimeDelta > 0 ? `+${greenTimeDelta}` : greenTimeDelta}s</span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                value={greenTimeDelta}
                onChange={(e) => setGreenTimeDelta(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#2E7D5B]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Increase or decrease green light cycle lengths dynamically.</p>
            </div>
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full py-2.5 bg-[#245B84] hover:bg-[#1D4D70] disabled:opacity-50 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> {loading ? 'Running Model...' : 'RUN WHAT-IF ENGINE'}
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-lg border border-[#DCE4EA] space-y-5">
                <h2 className="text-xs font-mono font-extrabold text-slate-700 uppercase border-b border-[#DCE4EA] pb-2 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-accent-teal" /> Before & After Comparative Analysis
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* volume */}
                  <div className="p-4 bg-slate-50 border border-[#DCE4EA] rounded space-y-1.5 select-none font-mono">
                    <p className="text-[10px] text-slate-500 uppercase">Congestion Volume</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-slate-500">{result.predicted_volume_before} veh</span>
                      <span className="text-lg font-bold text-slate-800">→ {result.predicted_volume_after} veh</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 text-[10px]">
                      {result.predicted_volume_after > result.predicted_volume_before ? (
                        <span className="text-[#B84A4A] font-bold">+{result.predicted_volume_after - result.predicted_volume_before} vehicles expected</span>
                      ) : (
                        <span className="text-accent-success font-bold">Stable flow volume</span>
                      )}
                    </div>
                  </div>

                  {/* queue */}
                  <div className="p-4 bg-slate-50 border border-[#DCE4EA] rounded space-y-1.5 select-none font-mono">
                    <p className="text-[10px] text-slate-500 uppercase">Lane Queue Length</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-slate-500">{result.predicted_queue_before} veh</span>
                      <span className="text-lg font-bold text-slate-800">→ {result.predicted_queue_after} veh</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 text-[10px]">
                      {result.predicted_queue_after > result.predicted_queue_before ? (
                        <span className="text-[#B84A4A] font-bold">+{result.predicted_queue_after - result.predicted_queue_before} vehicles queue delay</span>
                      ) : (
                        <span className="text-accent-success font-bold">Stable queue bounds</span>
                      )}
                    </div>
                  </div>

                  {/* travel time */}
                  <div className="p-4 bg-slate-50 border border-[#DCE4EA] rounded space-y-1.5 select-none font-mono">
                    <p className="text-[10px] text-slate-500 uppercase">Average Travel Time</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-slate-500">{(result.average_travel_time_before_sec / 60).toFixed(1)}m</span>
                      <span className="text-lg font-bold text-slate-800">→ {(result.average_travel_time_after_sec / 60).toFixed(1)}m</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 text-[10px]">
                      {result.average_travel_time_after_sec > result.average_travel_time_before_sec ? (
                        <span className="text-[#B84A4A] font-bold">+{((result.average_travel_time_after_sec - result.average_travel_time_before_sec)/60).toFixed(1)} min delay corridor</span>
                      ) : (
                        <span className="text-accent-success font-bold">Time reduction corridor</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Analytical summary banner */}
                <div className={`p-4 rounded border flex items-start gap-3 text-xs leading-relaxed font-mono ${
                  closedLanes > 0 ? 'bg-[#FFF5E7] text-[#B7791F] border-[#FCE1A2]' : 'bg-[#EAF7EF] text-[#2E7D5B] border-[#D2EADA]'
                }`}>
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <h4 className="font-bold uppercase mb-0.5">Simulation Model Observations</h4>
                    <p>
                      {closedLanes > 0 ? (
                        `Closing ${closedLanes} lane(s) at Intersection #${intersectionId} with green-time delta adjust of ${greenTimeDelta}s creates a calculated travel-time inflation of ${(((result.average_travel_time_after_sec - result.average_travel_time_before_sec)/result.average_travel_time_before_sec)*100).toFixed(1)}%. Consider adaptive override signal adjustments to prevent bottlenecks.`
                      ) : (
                        `Signal adjustment delta of ${greenTimeDelta}s is expected to maintain current traffic queues with no additional delay bounds.`
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-[#DCE4EA] text-center space-y-4">
              <div className="p-4 rounded-full bg-slate-50 text-slate-400 w-fit mx-auto border border-[#DCE4EA]">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-slate-800 font-bold text-sm">Simulation Pending</h3>
                <p className="text-slate-500 text-xs font-mono max-w-sm mx-auto">
                  Adjust closed lanes, signal cycle delta variables on the left controls panel and click run to simulate micro-traffic outcomes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
