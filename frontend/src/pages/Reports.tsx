import React, { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { apiClient } from '../api/client';

export const Reports: React.FC = () => {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    apiClient.get('/reports/daily').then((res) => setReport(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">OPERATIONAL TRAFFIC REPORTS</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Automated Performance Summaries and Incident Audits</p>
        </div>
        <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors shadow-sm select-none">
          <Download className="w-4 h-4" /> Download PDF Report
        </button>
      </div>

      {report && (
        <div className="glass-panel p-6 rounded-lg border border-surfaceBorder space-y-6">
          <div className="border-b border-surfaceBorder pb-4">
            <h2 className="text-base font-bold text-slate-800">{report.title}</h2>
            <p className="text-xs text-slate-500 font-mono">Generated: {report.generated_at} | Reporting Period: {report.period}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono text-xs select-none">
            <div className="p-3 bg-slate-50 rounded border border-surfaceBorder">
              <p className="text-slate-500">TOTAL VEHICLES PROCESSED</p>
              <p className="text-lg font-bold text-primary-500 mt-1">{report.summary_metrics?.total_vehicles_processed}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-surfaceBorder">
              <p className="text-slate-500">AVG QUEUE LENGTH</p>
              <p className="text-lg font-bold text-accent-warning mt-1">{report.summary_metrics?.average_queue_length} veh</p>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-surfaceBorder">
              <p className="text-slate-500">EMERGENCY CORRIDORS</p>
              <p className="text-lg font-bold text-accent-danger mt-1">{report.summary_metrics?.total_emergency_priorities}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
