import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Video, Map, Route, Search, TrafficCone,
  Bell, TrendingUp, Film, Smartphone, Settings, LogOut,
  ChevronLeft, ChevronRight, Monitor, Tablet, LucideIcon, FileCheck
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useResponsiveDevice } from '../hooks/useResponsiveDevice';
import { VigitraLogo } from './branding/VigitraLogo';

interface NavEntry {
  name: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavEntry[];
}

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

  const navSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      ]
    },
    {
      title: 'MONITORING',
      items: [
        { name: 'Live Cameras', path: '/cameras', icon: Video },
        { name: 'Traffic Map', path: '/heatmap', icon: Map },
        { name: 'Vehicle Tracking', path: '/trajectories', icon: Route },
      ]
    },
    {
      title: 'INTELLIGENCE',
      items: [
        { name: 'ANPR & Watchlist', path: '/anpr', icon: Search, badge: 'ALERT' },
        { name: 'Doc Verification', path: '/compliance', icon: FileCheck, badge: 'RTO', badgeColor: 'bg-emerald-600 text-white' },
        { name: 'Traffic Forecast', path: '/forecast', icon: TrendingUp },
      ]
    },
    {
      title: 'CONTROL',
      items: [
        { name: 'Signal Control', path: '/signals', icon: TrafficCone },
        { name: 'Alerts', path: '/alerts', icon: Bell, badge: 'LIVE', badgeColor: 'bg-red-500 text-white' },
      ]
    },
    {
      title: 'RECORDS',
      items: [
        { name: 'Records Archive', path: '/recordings', icon: Film },
      ]
    },
    {
      title: 'DEVICES',
      items: [
        { name: 'Mobile Devices', path: '/devices', icon: Smartphone },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Settings', path: '/settings', icon: Settings },
      ]
    }
  ];

  const DeviceIcon = deviceConfig.isMobile ? Smartphone : deviceConfig.isTablet ? Tablet : Monitor;
  const deviceBadgeText = deviceConfig.isMobile ? 'Mobile' : deviceConfig.isTablet ? 'Tablet' : 'Console';

  return (
    <aside
      className={`hidden md:flex shrink-0 bg-[#F4F7F9] border-r border-[#DCE4EA] flex-col justify-between h-screen sticky top-0 z-40 select-none sidebar-transition ${
        isCollapsed ? 'w-16' : 'w-56 lg:w-60'
      }`}
    >
      <div className="flex flex-col h-[calc(100vh-68px)]">
        {/* Brand Header */}
        <div
          className={`border-b border-[#DCE4EA] bg-[#EBF1F5] shrink-0 transition-all ${
            isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-3'
          }`}
        >
          {/* Header Controls & Toggle */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'justify-between w-full mb-2.5'}`}>
            {!isCollapsed && (
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                Operations Console
              </span>
            )}
            <button
              onClick={toggleCollapse}
              className="p-1 rounded-md text-slate-500 hover:text-[#173F5F] hover:bg-slate-200 transition-colors shrink-0"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Centered Logo Placement */}
          {!isCollapsed ? (
            <div className="flex items-center justify-center w-full pb-1">
              <VigitraLogo variant="sidebar" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <VigitraLogo variant="sidebar-collapsed" />
            </div>
          )}
        </div>

        {/* Grouped Navigation Links */}
        <nav className="p-2 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {navSections.map((sec) => (
            <div key={sec.title} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-2 pt-1 pb-1 text-[9px] font-bold font-mono text-slate-400 tracking-wider">
                  {sec.title}
                </div>
              )}
              {isCollapsed && (
                <div className="h-px bg-slate-200 my-1 mx-2" />
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.name : undefined}
                    className={({ isActive }) =>
                      `flex items-center rounded-md text-xs font-semibold transition-all ${
                        isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
                      } ${
                        isActive
                          ? 'bg-[#D9EAF5] text-[#123E63] font-bold shadow-2xs border-l-3 border-[#245B84]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-[#E5EFF6]'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Icon className="w-4 h-4 shrink-0" />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span
                        className={`px-1.5 py-0.2 text-[8px] font-mono font-bold rounded shrink-0 ${
                          item.badgeColor || 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* User Footer Profile */}
      <div className={`p-2 border-t border-[#DCE4EA] bg-[#EBF1F5] shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {isCollapsed ? (
          <button
            onClick={logout}
            className="w-8 h-8 rounded-md bg-[#245B84] flex items-center justify-center font-bold text-white text-xs shadow-2xs hover:bg-rose-600 transition-colors"
            title={`Logged in as ${user?.username || 'Operator'}. Click to sign out.`}
          >
            {user?.username?.substring(0, 2).toUpperCase() || 'OP'}
          </button>
        ) : (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-white border border-[#DCE4EA]">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded bg-[#245B84] flex items-center justify-center font-bold text-white text-[10px] shrink-0">
                {user?.username?.substring(0, 2).toUpperCase() || 'OP'}
              </div>
              <div className="truncate">
                <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">
                  {user?.full_name || user?.username || 'Operator'}
                </p>
                <p className="text-[9px] text-[#245B84] font-mono leading-tight">
                  {user?.role || 'OPERATOR'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1 text-slate-400 hover:text-rose-600 transition-colors shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
