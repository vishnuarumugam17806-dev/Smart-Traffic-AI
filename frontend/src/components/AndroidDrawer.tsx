import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Video, Map, Route, Search, TrafficCone,
  Bell, TrendingUp, Film, Smartphone, Settings, LogOut, X,
  CheckCircle2, LucideIcon
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { VigitraLogo } from './branding/VigitraLogo';

interface AndroidDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavEntry {
  name: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
  group: string;
}

export const AndroidDrawer: React.FC<AndroidDrawerProps> = ({ isOpen, onClose }) => {
  const { user, logout, isConnected } = useStore();
  const [drawerSearch, setDrawerSearch] = useState<string>('');

  // Support Android Hardware/Browser Back-Button behavior
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  const navItems: NavEntry[] = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, group: 'OVERVIEW' },
    { name: 'Live Cameras', path: '/cameras', icon: Video, group: 'MONITORING' },
    { name: 'Traffic Map', path: '/heatmap', icon: Map, group: 'MONITORING' },
    { name: 'Vehicle Tracking', path: '/trajectories', icon: Route, group: 'MONITORING' },
    { name: 'ANPR & Watchlist', path: '/anpr', icon: Search, badge: 'ALERT', group: 'INTELLIGENCE' },
    { name: 'Traffic Forecast', path: '/forecast', icon: TrendingUp, group: 'INTELLIGENCE' },
    { name: 'Signal Control', path: '/signals', icon: TrafficCone, group: 'CONTROL' },
    { name: 'Alerts', path: '/alerts', icon: Bell, badge: 'LIVE', badgeColor: 'bg-red-500 text-white', group: 'CONTROL' },
    { name: 'Records Archive', path: '/recordings', icon: Film, group: 'RECORDS' },
    { name: 'Mobile Devices', path: '/devices', icon: Smartphone, group: 'DEVICES' },
    { name: 'Settings', path: '/settings', icon: Settings, group: 'SYSTEM' },
  ];

  const filteredItems = navItems.filter(item =>
    item.name.toLowerCase().includes(drawerSearch.toLowerCase()) ||
    item.group.toLowerCase().includes(drawerSearch.toLowerCase())
  );

  const groups = Array.from(new Set(filteredItems.map(i => i.group)));

  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex select-none">
      {/* Dark Backdrop Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Slide-Out Drawer Content */}
      <div className="relative w-[85vw] max-w-[320px] bg-[#F4F7F9] h-full flex flex-col justify-between z-50 overflow-hidden shadow-2xl">
        {/* Drawer Header */}
        <div className="p-3 bg-[#EBF1F5] border-b border-[#DCE4EA] flex flex-col shrink-0 gap-2">
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              Mobile Operations
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors"
              aria-label="Close Navigation Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-center w-full py-1">
            <VigitraLogo variant="sidebar" className="max-w-[190px]" />
          </div>
        </div>

        {/* Quick Search Bar */}
        <div className="p-2.5 bg-white border-b border-[#DCE4EA] shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search features..."
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#DCE4EA] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#245B84]"
            />
          </div>
        </div>

        {/* Scrollable Navigation List */}
        <nav className="p-2.5 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {groups.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No matching sections found for "{drawerSearch}"
            </div>
          ) : (
            groups.map(groupName => (
              <div key={groupName} className="space-y-1">
                <div className="px-2 text-[9px] font-bold font-mono text-slate-400 tracking-wider">
                  {groupName}
                </div>
                {filteredItems
                  .filter(i => i.group === groupName)
                  .map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-[#245B84] text-white shadow-xs font-bold'
                              : 'text-slate-700 hover:bg-[#E2EDF5]'
                          }`
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className={`px-1.5 py-0.2 text-[8px] font-mono font-bold rounded ${item.badgeColor || 'bg-amber-100 text-amber-900'}`}>
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
              </div>
            ))
          )}
        </nav>

        {/* Drawer Footer */}
        <div className="p-2.5 bg-[#EBF1F5] border-t border-[#DCE4EA] space-y-2 shrink-0">
          <div className="px-2.5 py-1 rounded bg-[#EAF7EF] border border-[#D2EADA] flex items-center justify-between text-[10px] font-mono font-bold text-[#2E7D5B]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>{isConnected ? 'Network Online' : 'Syncing Engine'}</span>
            </div>
            <span className="text-[9px] text-slate-400">v2.4 MOBILE</span>
          </div>

          <div className="flex items-center justify-between p-1.5 rounded-md bg-white border border-[#DCE4EA]">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded bg-[#245B84] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
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
              onClick={() => {
                logout();
                onClose();
              }}
              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
