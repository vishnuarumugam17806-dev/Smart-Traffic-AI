import React from 'react';
import { Menu, Bell, Activity } from 'lucide-react';
import { useStore } from '../store/useStore';

interface AndroidHeaderProps {
  onOpenDrawer: () => void;
}

export const AndroidHeader: React.FC<AndroidHeaderProps> = ({ onOpenDrawer }) => {
  const { isConnected } = useStore();

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
        <div className="p-1.5 text-slate-600 hover:text-[#245B84] rounded-lg relative flex items-center justify-center">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#EAF7EF] border border-[#D2EADA] text-[10px] font-mono font-bold text-[#2E7D5B]">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#2E7D5B] animate-pulse' : 'bg-slate-400'}`} />
          <span className="hidden sm:inline">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </div>
    </header>
  );
};
