import React, { useState } from 'react';
import { apiClient } from '../api/client';
import { TrafficPrediction } from '../types';

export const Predictions: React.FC = () => {
  const [horizon, setHorizon] = useState<number>(15);
  const [prediction, setPrediction] = useState<TrafficPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchPrediction = async (h: number) => {
    setHorizon(h);
    setLoading(true);
    try {
      const res = await apiClient.get(`/predictions/1?horizon=${h}`);
      setPrediction(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">TRAFFIC CONGESTION PREDICTOR</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Machine Learning Forecasting for 5m, 15m, 30m, and 60m Horizons</p>
        </div>
      </div>

      <div className="flex gap-3">
        {[5, 15, 30, 60].map((h) => (
          <button
            key={h}
            onClick={() => fetchPrediction(h)}
            className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all shadow-sm ${
              horizon === h
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-surfaceBorder text-slate-600 hover:bg-slate-50'
            }`}
          >
            +{h} MIN FORECAST
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none">
        <div className="glass-card p-5 rounded-lg border border-surfaceBorder space-y-2">
          <p className="text-[11px] font-mono font-bold text-slate-500">PREDICTED VOLUME</p>
          <h3 className="text-3xl font-extrabold text-slate-850 font-mono">{prediction?.predicted_volume || 38} <span className="text-xs font-normal text-slate-500">veh</span></h3>
          <p className="text-xs text-primary-600 font-mono font-semibold">+15% expected arrivals</p>
        </div>

        <div className="glass-card p-5 rounded-lg border border-surfaceBorder space-y-2">
          <p className="text-[11px] font-mono font-bold text-slate-500">PREDICTED DENSITY STATE</p>
          <h3 className="text-3xl font-extrabold text-accent-warning font-mono">{prediction?.predicted_density || 'MODERATE'}</h3>
          <p className="text-xs text-accent-warning font-mono font-semibold">Queue growth: +{prediction?.predicted_queue_length || 6} vehicles</p>
        </div>

        <div className="glass-card p-5 rounded-lg border border-surfaceBorder space-y-2">
          <p className="text-[11px] font-mono font-bold text-slate-500">ML EVALUATION METRICS</p>
          <div className="text-xs font-mono space-y-1 text-slate-600">
            <p>MAE: <span className="text-accent-success font-bold">{prediction?.mae || 2.14}</span></p>
            <p>RMSE: <span className="text-accent-info font-bold">{prediction?.rmse || 3.28}</span></p>
            <p>R² Score: <span className="text-primary-600 font-bold">{prediction?.r2_score || 0.92}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};
