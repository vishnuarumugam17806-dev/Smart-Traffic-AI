import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Video, Camera, Search, Route, Map, BarChart3,
  GitCompare, TrafficCone, Siren, AlertTriangle, ShieldAlert,
  Bot, Bell, FileText, TrendingUp, Users, Settings, LogOut, Sliders,
  Smartphone, Grid, Film, Monitor, Tablet, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useResponsiveDevice } from '../hooks/useResponsiveDevice';

export const Sidebar: React.FC = () => {
  const { user, logout } = useStore();
  const deviceConfig = useResponsiveDevice();
  
  // Sidebar Collapse / Icon-Rail State (Persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('vigitra_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('vigitra_sidebar_collapsed', String(next));
      return next;
    });
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Live Cameras', path: '/cameras', icon: Video },
    { name: 'Traffic Map', path: '/heatmap', icon: Map },
    { name: 'Vehicle Tracking', path: '/trajectories', icon: Route },
    { name: 'Number Plate Search', path: '/anpr', icon: Search },
    { name: 'Signal Control', path: '/signals', icon: TrafficCone },
    { name: 'Alerts', path: '/alerts', icon: Bell, badge: 'LIVE' },
    { name: 'Region Forecast', path: '/forecast', icon: TrendingUp },
    { name: 'Recorded Video', path: '/recordings', icon: Film },
    { name: 'Link Mobile Device', path: '/devices', icon: Smartphone },
  ];

  const DeviceIcon = deviceConfig.isMobile ? Smartphone : deviceConfig.isTablet ? Tablet : Monitor;
  const deviceBadgeText = deviceConfig.isMobile ? 'Mobile' : deviceConfig.isTablet ? 'Tablet' : 'Laptop';

  return (
    <aside className={`hidden md:flex shrink-0 bg-[#EEF4F8] border-r border-[#DCE4EA] flex-col justify-between h-screen sticky top-0 z-40 select-none sidebar-transition ${
      isCollapsed ? 'w-16' : 'w-56 lg:w-64 2xl:w-72'
    }`}>

      <div className="flex flex-col h-[calc(100vh-70px)]">
        {/* Brand Header & Minimize Toggle */}
        <div className={`p-3 flex items-center bg-[#E5EFF6] border-b border-[#DCE4EA] shrink-0 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="/vigitra_logo.jpg" alt="VIGITRA Logo" className="w-8 h-8 rounded-lg object-cover shadow-xs shrink-0" />
              <div className="truncate">
                <h1 className="font-extrabold text-xs text-[#173F5F] tracking-wide truncate">
                  VIGITRA
                </h1>
                <p className="text-[9px] text-slate-500 font-mono truncate">Control Center</p>
              </div>
            </div>
          )}

          {isCollapsed && (
            <img src="/vigitra_logo.jpg" alt="VIGITRA Logo" className="w-8 h-8 rounded-lg object-cover shadow-xs shrink-0" title="VIGITRA AI Control Center" />
          )}

          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#245B84] hover:bg-[#D4E8F5] transition-colors shrink-0"
            title={isCollapsed ? "Expand Sidebar (Laptop View)" : "Minimize Sidebar to Icon Rail"}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Device Status Banner (Expanded Only) */}
        {!isCollapsed && (
          <div className="px-3 py-1.5 bg-[#EEF4F8] border-b border-[#DCE4EA] flex items-center justify-between text-[9px] font-mono text-[#174E73]">
            <span className="flex items-center gap-1 font-bold">
              <DeviceIcon className="w-3 h-3 text-[#245B84]" /> {deviceBadgeText} View
            </span>
            <span className="text-slate-400">v2.4 ONLINE</span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="p-2 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded text-xs font-bold transition-all ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-[#D4E8F5] text-[#174E73] border-l-4 border-l-[#245B84] shadow-xs'
                      : 'text-[#3D5364] hover:text-slate-900 hover:bg-[#DCECF7]'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0 text-slate-600" />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </div>
                {!isCollapsed && item.badge && (
                  <span className="px-1.5 py-0.5 text-[8px] font-mono font-extrabold rounded bg-[#FCEBEC] text-[#B84A4A] border border-[#F5C2C2] shrink-0">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className={`p-2.5 border-t border-[#DCE4EA] bg-[#E5EFF6] shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {isCollapsed ? (
          <button
            onClick={logout}
            className="w-9 h-9 rounded-lg bg-[#245B84] flex items-center justify-center font-bold text-white text-xs shadow-xs hover:bg-red-600 transition-colors"
            title={`Logged in as ${user?.username || 'Operator'}. Click to Log out.`}
          >
            {user?.username?.substring(0, 2).toUpperCase() || 'OP'}
          </button>
        ) : (
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
              className="p-1 text-slate-400 hover:text-red-600 transition-colors shrink-0"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

