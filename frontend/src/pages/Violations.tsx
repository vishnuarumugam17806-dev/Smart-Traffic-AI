import React, { useEffect, useState } from 'react';
import { ShieldAlert, CreditCard } from 'lucide-react';
import { apiClient } from '../api/client';
import { Violation, NumberPlate } from '../types';

export const Violations: React.FC = () => {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [plates, setPlates] = useState<NumberPlate[]>([]);

  useEffect(() => {
    apiClient.get('/violations').then((res) => setViolations(res.data)).catch(console.error);
    apiClient.get('/anpr').then((res) => setPlates(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">VIOLATIONS & ANPR LOGS</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Automated Helmet, Signal-Jump, Speeding and License Plate OCR Registry</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Violations Table */}
        <div className="glass-panel rounded-lg p-5 border border-surfaceBorder space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-accent-danger" /> DETECTED VIOLATIONS
          </h2>
          <div className="space-y-3">
            {violations.map((v) => (
              <div key={v.id} className="p-3 bg-slate-50 rounded-lg border border-surfaceBorder flex items-center justify-between text-xs font-mono">
                <div>
                  <p className="font-bold text-slate-800 uppercase text-sm">{v.violation_type}</p>
                  <p className="text-slate-500 text-[11px]">Plate: <span className="text-primary-500 font-bold">{v.license_plate}</span></p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-accent-warning/15 text-accent-warning border border-accent-warning/20">
                    {v.status}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Conf: {(v.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ANPR OCR Table */}
        <div className="glass-panel rounded-lg p-5 border border-surfaceBorder space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-accent-teal" /> AUTOMATIC NUMBER PLATE RECOGNITION (ANPR)
          </h2>
          <div className="space-y-3">
            {plates.map((p) => (
              <div key={p.id} className="p-3 bg-slate-50 rounded-lg border border-surfaceBorder flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-amber-100 text-slate-850 font-extrabold rounded border border-amber-300 tracking-wider">
                    {p.plate_number}
                  </div>
                  <span className="text-slate-700 uppercase">{p.vehicle_type}</span>
                </div>
                <div className="text-right">
                  <span className="text-accent-success font-bold">{(p.confidence * 100).toFixed(0)}% OCR</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
