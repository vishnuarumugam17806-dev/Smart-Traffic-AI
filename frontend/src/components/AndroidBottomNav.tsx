import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, Map, Bell, Menu } from 'lucide-react';

interface AndroidBottomNavProps {
  onOpenDrawer: () => void;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({ onOpenDrawer }) => {
  const bottomNavItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Cameras', path: '/cameras', icon: Video },
    { name: 'Map', path: '/heatmap', icon: Map },
    { name: 'Alerts', path: '/alerts', icon: Bell },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#DCE4EA] shadow-lg z-40 px-2 flex items-center justify-around select-none">
      {bottomNavItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-all min-h-[44px] min-w-[56px] ${
                isActive
                  ? 'text-[#245B84] font-bold scale-105'
                  : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-mono tracking-tight">{item.name}</span>
          </NavLink>
        );
      })}

      {/* Menu Button to Trigger Drawer */}
      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-slate-500 hover:text-[#245B84] transition-all min-h-[44px] min-w-[56px]"
        aria-label="Open Full Navigation Menu"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] font-mono tracking-tight">Menu</span>
      </button>
    </nav>
  );
};
