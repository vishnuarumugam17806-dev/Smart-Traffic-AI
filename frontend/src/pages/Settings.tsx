import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="p-6 space-y-6 max-w-4xl bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">SYSTEM CONFIGURATION</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Signal Safety Boundaries and Vision Inference Threshold Parameters</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-lg border border-surfaceBorder space-y-6">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 font-mono">
          <ShieldCheck className="w-4 h-4 text-primary-500" /> SIGNAL SAFETY CONSTRAINTS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono select-none">
          <div>
            <label className="block text-slate-500 mb-1">MINIMUM GREEN TIME (SEC)</label>
            <input type="number" readOnly value={15} className="w-full bg-slate-50 border border-surfaceBorder rounded p-2 text-slate-800 focus:outline-none" />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">MAXIMUM GREEN TIME (SEC)</label>
            <input type="number" readOnly value={120} className="w-full bg-slate-50 border border-surfaceBorder rounded p-2 text-slate-800 focus:outline-none" />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">YELLOW CLEARANCE (SEC)</label>
            <input type="number" readOnly value={3} className="w-full bg-slate-50 border border-surfaceBorder rounded p-2 text-slate-800 focus:outline-none" />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">ALL-RED CLEARANCE (SEC)</label>
            <input type="number" readOnly value={2} className="w-full bg-slate-50 border border-surfaceBorder rounded p-2 text-slate-800 focus:outline-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
