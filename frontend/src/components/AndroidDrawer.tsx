import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Video, Map, Route, Search, TrafficCone,
  Bell, AlertTriangle, Siren, BarChart3, TrendingUp, Film,
  Camera, Smartphone, Grid, GitCompare, ShieldAlert, Sliders,
  FileText, Bot, Users, Settings, LogOut, X, CheckCircle2, Filter
} from 'lucide-react';
import { useStore } from '../store/useStore';

interface AndroidDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidDrawer: React.FC<AndroidDrawerProps> = ({ isOpen, onClose }) => {
  const { user, logout, isConnected } = useStore();
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CORE' | 'ANALYTICS' | 'AI'>('ALL');

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

  const rawNavItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, category: 'CORE' },
    { name: 'Live Cameras', path: '/cameras', icon: Video, category: 'CORE' },
    { name: 'Traffic Map', path: '/heatmap', icon: Map, category: 'CORE' },
    { name: 'Vehicle Tracking', path: '/trajectories', icon: Route, category: 'CORE' },
    { name: 'Number Plate Search', path: '/anpr', icon: Search, category: 'CORE' },
    { name: 'Signal Control', path: '/signals', icon: TrafficCone, category: 'CORE' },
    { name: 'Alerts', path: '/alerts', icon: Bell, badge: 'LIVE', category: 'AI' },
    { name: 'Traffic Forecast', path: '/predictions', icon: TrendingUp, category: 'ANALYTICS' },
    { name: 'Region Forecast', path: '/forecast', icon: TrendingUp, category: 'ANALYTICS' },
    { name: 'Recorded Video', path: '/recordings', icon: Film, category: 'CORE' },
    { name: 'Link Mobile Device', path: '/devices', icon: Smartphone, category: 'CORE' },
  ];

  // Filter items by category & search term
  const navItems = rawNavItems.filter(item => {
    const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(drawerSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex select-none">
      {/* Dark Backdrop Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* Slide-Out Drawer Content (85% Phone Width) */}
      <div className="relative w-[85vw] max-w-[340px] min-w-[280px] bg-[#EEF4F8] h-full flex flex-col justify-between z-50 overflow-hidden">
        
        {/* Drawer Header */}
        <div className="p-3.5 bg-[#E5EFF6] border-b border-[#DCE4EA] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/vigitra_logo.jpg" alt="VIGITRA" className="w-8 h-8 rounded object-cover shadow-2xs" />
            <div>
              <h2 className="font-extrabold text-sm text-[#173F5F] tracking-wide font-mono">VIGITRA AI</h2>
              <p className="text-[9px] text-slate-500 font-mono">Mobile Control Rail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            aria-label="Close Navigation Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Search & Category Bar */}
        <div className="p-2.5 bg-white border-b border-[#DCE4EA] space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search 10 core features..."
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#DCE4EA] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#245B84]"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 text-[10px] font-bold">
            {(['ALL', 'CORE', 'ANALYTICS', 'AI'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#245B84] text-white shadow-2xs'
                    : 'bg-[#EEF4F8] text-slate-600 hover:bg-[#DCECF7]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Navigation List */}
        <nav className="p-2 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
          {navItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No matching features found for "{drawerSearch}"
            </div>
          ) : (
            navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-[#245B84] text-white shadow-xs'
                        : 'text-[#3D5364] hover:bg-[#DCECF7] active:bg-[#C8DEED]'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-extrabold rounded bg-[#FCEBEC] text-[#B84A4A] border border-[#F5C2C2]">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })
          )}
        </nav>

        {/* Drawer Footer: System Status & User Profile */}
        <div className="p-3 bg-[#E5EFF6] border-t border-[#DCE4EA] space-y-2 shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-[#EAF7EF] border border-[#D2EADA] flex items-center justify-between text-[11px] font-mono font-bold text-[#2E7D5B]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D5B]" />
              <span>System Online</span>
            </div>
            <span className="text-[9px] text-slate-400">v2.4 MOBILE</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#DCE4EA]">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-[#245B84] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                {user?.username?.substring(0, 2).toUpperCase() || 'OP'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.full_name || user?.username || 'Operator'}</p>
                <p className="text-[10px] text-[#245B84] font-mono">{user?.role || 'OPERATOR'}</p>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-red-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

