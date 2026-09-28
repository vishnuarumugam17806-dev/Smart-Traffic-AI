import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Cpu,
  Bell,
  Lock,
  Globe,
  Save,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Radio,
  Eye
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

type SettingsTab = 'GENERAL' | 'SIGNALS' | 'AI_VISION' | 'NOTIFICATIONS' | 'SECURITY';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // General Settings State
  const [stationName, setStationName] = useState<string>('Greater Chennai Traffic Operations Control');
  const [jurisdiction, setJurisdiction] = useState<string>('Chennai Metropolitan Area');
  const [systemMode, setSystemMode] = useState<string>('AUTONOMOUS_AI');

  // Signal Constraints State
  const [minGreen, setMinGreen] = useState<number>(15);
  const [maxGreen, setMaxGreen] = useState<number>(120);
  const [yellowClearance, setYellowClearance] = useState<number>(3);
  const [allRedClearance, setAllRedClearance] = useState<number>(2);
  const [pedInterval, setPedInterval] = useState<number>(600);
  const [pedDuration, setPedDuration] = useState<number>(30);

  // AI & Vision State
  const [yoloModel, setYoloModel] = useState<string>('yolov8m.pt');
  const [detectionConfidence, setDetectionConfidence] = useState<number>(0.65);
  const [anprOcrConfidence, setAnprOcrConfidence] = useState<number>(0.85);
  const [speedCalcInterval, setSpeedCalcInterval] = useState<number>(2);

  // Notification State
  const [audioChimes, setAudioChimes] = useState<boolean>(true);
  const [criticalToasts, setCriticalToasts] = useState<boolean>(true);
  const [autoEmailAlerts, setAutoEmailAlerts] = useState<boolean>(false);

  // Security State
  const [sessionTimeoutMins, setSessionTimeoutMins] = useState<number>(120);
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState<number>(90);
  const [requireOverrideConfirmation, setRequireOverrideConfirmation] = useState<boolean>(true);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const navItems = [
    { id: 'GENERAL' as const, label: 'General System', icon: Globe, desc: 'Station, jurisdiction & mode' },
    { id: 'SIGNALS' as const, label: 'Signal Safety', icon: ShieldCheck, desc: 'Phase bounds & pedestrian timings' },
    { id: 'AI_VISION' as const, label: 'Vision & Inference', icon: Cpu, desc: 'YOLO model, OCR & detection' },
    { id: 'NOTIFICATIONS' as const, label: 'Alerts & Chimes', icon: Bell, desc: 'Audio alerts & notifications' },
    { id: 'SECURITY' as const, label: 'Security & Access', icon: Lock, desc: 'Session timeout & audit retention' },
  ];

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-6xl mx-auto min-h-screen font-sans select-none">
      {/* Page Header */}
      <PageHeader
        title="Settings"
        subtitle="Platform preferences, signal safety boundaries and vision thresholds"
        actions={
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-300 flex items-center gap-1 animate-fadeIn">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        }
      />

      {/* Main 2-Pane Settings Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left Side Tab Navigation (4 cols) */}
        <div className="md:col-span-4 bg-white rounded-lg border border-[#DCE4EA] p-2 space-y-1 shadow-2xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left p-2.5 rounded-md flex items-center gap-3 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF6FC] border-l-3 border-[#245B84] text-[#174E73] font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`p-1.5 rounded-md ${isActive ? 'bg-[#245B84] text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
                <div className="truncate">
                  <span className="text-xs block font-sans truncate">{item.label}</span>
                  <span className="text-[10px] text-slate-400 block font-sans truncate">{item.desc}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Side Settings Panel (8 cols) */}
        <div className="md:col-span-8 bg-white rounded-lg border border-[#DCE4EA] p-4 sm:p-5 shadow-2xs space-y-4">
          
          {/* TAB 1: GENERAL SYSTEM */}
          {activeTab === 'GENERAL' && (
            <div className="space-y-4">
              <div className="border-b border-[#DCE4EA] pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase font-sans">General System Configuration</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">Regional station identifiers and operational operating mode</p>
              </div>

              <div className="space-y-3 text-xs font-sans">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Command Operations Station Name</label>
                  <input
                    type="text"
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-2 text-slate-800 text-xs focus:outline-none focus:border-[#245B84]"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Assigned City Jurisdiction</label>
                  <input
                    type="text"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-2 text-slate-800 text-xs focus:outline-none focus:border-[#245B84]"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Default System Operational Mode</label>
                  <select
                    value={systemMode}
                    onChange={(e) => setSystemMode(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-2 text-slate-800 text-xs focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="AUTONOMOUS_AI">Autonomous AI (Self-Optimizing Queue & Wait-Time Demand)</option>
                    <option value="SEMI_AUTOMATIC">Semi-Automatic (Operator Approval for Cycle Switches)</option>
                    <option value="FIXED_TIME">Fixed Time Scheduling (Fallback Pre-Timed Offsets)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SIGNAL SAFETY CONSTRAINTS */}
          {activeTab === 'SIGNALS' && (
            <div className="space-y-4">
              <div className="border-b border-[#DCE4EA] pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase font-sans">Signal Safety Boundaries</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">Enforce legal minimums, maximums, and pedestrian safety intervals</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
                <div className="p-3 bg-[#F8FAFC] rounded-md border border-[#DCE4EA]">
                  <label className="block text-slate-600 font-semibold mb-1">Minimum Green Time</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={minGreen}
                      onChange={(e) => setMinGreen(Number(e.target.value))}
                      className="w-full bg-white border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">sec</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Prevents signal flickering</span>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-md border border-[#DCE4EA]">
                  <label className="block text-slate-600 font-semibold mb-1">Maximum Green Time</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={maxGreen}
                      onChange={(e) => setMaxGreen(Number(e.target.value))}
                      className="w-full bg-white border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">sec</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Prevents approach starvation</span>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-md border border-[#DCE4EA]">
                  <label className="block text-slate-600 font-semibold mb-1">Yellow Clearance Interval</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={yellowClearance}
                      onChange={(e) => setYellowClearance(Number(e.target.value))}
                      className="w-full bg-white border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">sec</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Safe vehicular stopping window</span>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-md border border-[#DCE4EA]">
                  <label className="block text-slate-600 font-semibold mb-1">All-Red Clearance Interval</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={allRedClearance}
                      onChange={(e) => setAllRedClearance(Number(e.target.value))}
                      className="w-full bg-white border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">sec</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Intersection clearance buffer</span>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-md border border-[#DCE4EA]">
                  <label className="block text-slate-600 font-semibold mb-1">Pedestrian Phase Interval</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={pedInterval}
                      onChange={(e) => setPedInterval(Number(e.target.value))}
                      className="w-full bg-white border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">sec</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">600s = 10 minutes</span>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-md border border-[#DCE4EA]">
                  <label className="block text-slate-600 font-semibold mb-1">Pedestrian Crossing Duration</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={pedDuration}
                      onChange={(e) => setPedDuration(Number(e.target.value))}
                      className="w-full bg-white border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">sec</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">30s All-Red hold</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VISION & INFERENCE */}
          {activeTab === 'AI_VISION' && (
            <div className="space-y-4">
              <div className="border-b border-[#DCE4EA] pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase font-sans">AI Vision & ANPR Parameters</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">YOLOv8 weights, confidence thresholds, and ANPR sensitivity</p>
              </div>

              <div className="space-y-3 text-xs font-sans">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Vehicle Detection YOLOv8 Model</label>
                  <select
                    value={yoloModel}
                    onChange={(e) => setYoloModel(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-2 text-slate-800 text-xs focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="yolov8n.pt">YOLOv8 Nano (Fastest, Low CPU Footprint)</option>
                    <option value="yolov8s.pt">YOLOv8 Small (Balanced Real-Time)</option>
                    <option value="yolov8m.pt">YOLOv8 Medium (High Precision Traffic)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-slate-600">Vehicle Detection Confidence Threshold</span>
                    <span className="font-mono font-bold text-[#245B84]">{(detectionConfidence * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.95"
                    step="0.05"
                    value={detectionConfidence}
                    onChange={(e) => setDetectionConfidence(Number(e.target.value))}
                    className="w-full accent-[#245B84]"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-slate-600">ANPR OCR Confidence Threshold</span>
                    <span className="font-mono font-bold text-[#245B84]">{(anprOcrConfidence * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.99"
                    step="0.01"
                    value={anprOcrConfidence}
                    onChange={(e) => setAnprOcrConfidence(Number(e.target.value))}
                    className="w-full accent-[#245B84]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS & CHIMES */}
          {activeTab === 'NOTIFICATIONS' && (
            <div className="space-y-4">
              <div className="border-b border-[#DCE4EA] pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase font-sans">Notification Preferences</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">Control audible alerts and real-time popover notifications</p>
              </div>

              <div className="space-y-2 text-xs font-sans">
                <label className="flex items-center gap-3 p-3 rounded-md bg-[#F8FAFC] border border-[#DCE4EA] cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={audioChimes}
                    onChange={(e) => setAudioChimes(e.target.checked)}
                    className="rounded text-[#245B84] accent-[#245B84] w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Audible Siren Chimes</span>
                    <span className="text-[10px] text-slate-400 block">Synthesize high-priority sound on stolen vehicle or watchlist matches</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-md bg-[#F8FAFC] border border-[#DCE4EA] cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={criticalToasts}
                    onChange={(e) => setCriticalToasts(e.target.checked)}
                    className="rounded text-[#245B84] accent-[#245B84] w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Floating Real-Time Incident Banners</span>
                    <span className="text-[10px] text-slate-400 block">Display high-contrast emergency banner in top-right of operator console</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-md bg-[#F8FAFC] border border-[#DCE4EA] cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={autoEmailAlerts}
                    onChange={(e) => setAutoEmailAlerts(e.target.checked)}
                    className="rounded text-[#245B84] accent-[#245B84] w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Automated Dispatch Notifications</span>
                    <span className="text-[10px] text-slate-400 block">Forward critical congestion alerts to area traffic police units</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY & ACCESS */}
          {activeTab === 'SECURITY' && (
            <div className="space-y-4">
              <div className="border-b border-[#DCE4EA] pb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase font-sans">Security & Operator Governance</h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">Session management, role enforcement and audit record archiving</p>
              </div>

              <div className="space-y-3 text-xs font-sans">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Operator Session Inactivity Timeout</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={sessionTimeoutMins}
                      onChange={(e) => setSessionTimeoutMins(Number(e.target.value))}
                      className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">min</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Audit Log Retention Policy</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={auditLogRetentionDays}
                      onChange={(e) => setAuditLogRetentionDays(Number(e.target.value))}
                      className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-2 text-slate-800 font-mono text-xs focus:outline-none focus:border-[#245B84]"
                    />
                    <span className="text-slate-400 font-mono">days</span>
                  </div>
                </div>

                <label className="flex items-center gap-3 p-3 rounded-md bg-[#F8FAFC] border border-[#DCE4EA] cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={requireOverrideConfirmation}
                    onChange={(e) => setRequireOverrideConfirmation(e.target.checked)}
                    className="rounded text-[#245B84] accent-[#245B84] w-4 h-4"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Require Explicit Confirmation for Emergency Overrides</span>
                    <span className="text-[10px] text-slate-400 block">Enforces dual confirmation and recorded reason before preemption</span>
                  </div>
                </label>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
