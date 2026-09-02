import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Video, Camera, Search, Route, Map, BarChart3,
  GitCompare, TrafficCone, Siren, AlertTriangle, ShieldAlert,
  Bot, Bell, FileText, TrendingUp, Users, Settings, LogOut, Sliders,
  Smartphone, Grid, Film
} from 'lucide-react';
import { useStore } from '../store/useStore';

export const Sidebar: React.FC = () => {
  const { user, logout } = useStore();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Live Cameras', path: '/cameras', icon: Video },
    { name: 'Traffic Map', path: '/heatmap', icon: Map },
    { name: 'Vehicle Tracking', path: '/trajectories', icon: Route },
    { name: 'Number Plate Search', path: '/anpr', icon: Search },
    { name: 'Vehicle Search', path: '/vehicle-search', icon: Search },
    { name: 'Signal Control', path: '/signals', icon: TrafficCone },
    { name: 'Alerts', path: '/alerts', icon: Bell, badge: 'LIVE' },
    { name: 'Incidents', path: '/incidents', icon: AlertTriangle },
    { name: 'Emergency Priority', path: '/emergency', icon: Siren },
    { name: 'Traffic Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Traffic Forecast', path: '/predictions', icon: TrendingUp },
    { name: 'Recorded Video', path: '/recordings', icon: Film },
    { name: 'Field Capture', path: '/field-capture', icon: Camera },
    { name: 'Link Mobile Device', path: '/devices', icon: Smartphone },
    { name: 'Multi-Camera Wall', path: '/camera-wall', icon: Grid },
    { name: 'Origin-Destination', path: '/origin-destination', icon: GitCompare },
    { name: 'Bottlenecks', path: '/bottlenecks', icon: TrafficCone },
    { name: 'Blacklist', path: '/blacklist', icon: ShieldAlert },
    { name: 'Unusual Activity', path: '/route-anomalies', icon: AlertTriangle },
    { name: 'What-If Simulator', path: '/simulator', icon: Sliders },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'AI Assistant', path: '/ai-assistant', icon: Bot },
  ];

  if (user?.role === 'ADMIN') {
    navItems.push({ name: 'User Management', path: '/admin/users', icon: Users });
  }
  navItems.push({ name: 'Settings', path: '/settings', icon: Settings });

  return (
    <aside className="w-64 bg-[#EEF4F8] border-r border-[#DCE4EA] flex flex-col justify-between h-screen sticky top-0 z-40 select-none">
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Brand Header */}
        <div className="p-4 flex items-center gap-2.5 bg-[#E5EFF6] border-b border-[#DCE4EA] shrink-0">
          <img src="/vigitra_logo.jpg" alt="VIGITRA Logo" className="w-9 h-9 rounded-lg object-cover shadow-xs" />
          <div>
            <h1 className="font-extrabold text-sm text-[#173F5F] tracking-wide">
              VIGITRA
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">Traffic Control Center</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-0.5 overflow-y-auto flex-1 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-[#D4E8F5] text-[#174E73] border-l-4 border-l-[#245B84] shadow-xs'
                      : 'text-[#3D5364] hover:text-slate-900 hover:bg-[#DCECF7]'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[8px] font-mono font-extrabold rounded bg-[#FCEBEC] text-[#B84A4A] border border-[#F5C2C2]">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-[#DCE4EA] bg-[#E5EFF6] shrink-0">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-[#DCE4EA]">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded bg-[#245B84] flex items-center justify-center font-bold text-white text-xs shrink-0">
              {user?.username?.substring(0, 2).toUpperCase() || 'OP'}
            </div>
            <div className="truncate">
              <p className="text-[11px] font-bold text-[#24313D] truncate">{user?.full_name || user?.username || 'Operator'}</p>
              <p className="text-[9px] text-[#245B84] font-mono">{user?.role || 'OPERATOR'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
