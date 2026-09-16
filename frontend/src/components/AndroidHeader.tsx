import React, { useState } from 'react';
import { Menu, Bell, Activity } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NotificationDropdown } from './NotificationDropdown';

interface AndroidHeaderProps {
  onOpenDrawer: () => void;
}

export const AndroidHeader: React.FC<AndroidHeaderProps> = ({ onOpenDrawer }) => {
  const { isConnected, alerts, unreadAlertsCount } = useStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.is_read).length;

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#DCE4EA] shadow-xs z-40 px-3.5 flex items-center justify-between select-none">
      {/* Left: Hamburger Button */}
      <button
        onClick={onOpenDrawer}
        className="p-2 -ml-1 text-slate-700 hover:text-[#245B84] hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open Navigation Menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Center: VIGITRA AI Branding */}
      <div className="flex items-center gap-2">
        <img src="/vigitra_logo.jpg" alt="VIGITRA Logo" className="w-7 h-7 rounded object-cover shadow-2xs" />
        <span className="font-extrabold text-sm text-[#173F5F] tracking-wide font-mono">
          VIGITRA AI
        </span>
      </div>

      {/* Right: Notifications & Status */}
      <div className="flex items-center gap-2">
        {/* Interactive Bell Icon */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={`p-2 rounded-lg relative flex items-center justify-center min-h-[40px] min-w-[40px] transition-colors cursor-pointer ${
              isDropdownOpen ? 'bg-[#173F5F] text-white' : 'text-slate-600 hover:text-[#245B84] hover:bg-slate-100'
            }`}
            aria-label="Toggle Alerts Notification Center"
          >
            <Bell className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-500 animate-pulse' : ''}`} />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-0.5 rounded-full bg-red-600 text-white font-mono font-black text-[9px] flex items-center justify-center shadow-xs border border-white">
                {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
              </span>
            )}
            {criticalCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping pointer-events-none" />
            )}
          </button>

          <NotificationDropdown
            isOpen={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            align="right"
          />
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#EAF7EF] border border-[#D2EADA] text-[10px] font-mono font-bold text-[#2E7D5B]">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#2E7D5B] animate-pulse' : 'bg-slate-400'}`} />
          <span className="hidden sm:inline">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>
    </header>
  );
};
