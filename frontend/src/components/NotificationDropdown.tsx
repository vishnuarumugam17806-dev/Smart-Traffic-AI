import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell, ShieldAlert, Siren, AlertTriangle, CheckCheck, Trash2, X,
  ExternalLink, MapPin, Radio, Shield, Clock, Check
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Alert } from '../types';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  align?: 'right' | 'left';
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  align = 'right'
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const { alerts, unreadAlertsCount, markAllAlertsAsRead, markAlertAsRead, dismissAlert } = useStore();
  const [filterTab, setFilterTab] = useState<'ALL' | 'CRITICAL' | 'WATCHLIST'>('ALL');

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const watchlistCount = alerts.filter(a => a.type?.includes('WATCHLIST') || a.vehicle_plate).length;

  const filteredAlerts = alerts.filter(a => {
    if (filterTab === 'CRITICAL') return a.severity === 'CRITICAL';
    if (filterTab === 'WATCHLIST') return a.type?.includes('WATCHLIST') || a.vehicle_plate;
    return true;
  });

  const formatTimeAgo = (timestampStr: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(timestampStr).getTime()) / 1000);
      if (diffSec < 45) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500 animate-ping',
          icon: Siren,
          label: 'CRITICAL'
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          icon: AlertTriangle,
          label: 'HIGH PRIORITY'
        };
      default:
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500',
          icon: ShieldAlert,
          label: 'NOTICE'
        };
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full mt-2 w-[340px] sm:w-[420px] max-w-[calc(100vw-24px)] ${
        align === 'right' ? 'right-0' : 'left-0'
      } bg-white rounded-xl shadow-2xl border border-[#DCE4EA] z-50 overflow-hidden font-sans select-none animate-in fade-in slide-in-from-top-2 duration-150`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Banner Header */}
      <div className="bg-[#173F5F] text-white p-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/10 text-amber-300 relative">
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[#173F5F] animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase">Active Traffic Alerts</h3>
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white font-mono font-extrabold text-[10px]">
                {alerts.length}
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-mono">Real-time CCTV & ANPR Detection Alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {unreadAlertsCount > 0 && (
            <button
              onClick={markAllAlertsAsRead}
              title="Mark all as read"
              className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors text-[11px] font-mono flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">Read All</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
            aria-label="Close Alerts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center px-3 py-2 bg-slate-50 border-b border-[#DCE4EA] text-xs font-mono font-bold text-slate-600 gap-1">
        <button
          onClick={() => setFilterTab('ALL')}
          className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
            filterTab === 'ALL'
              ? 'bg-[#173F5F] text-white shadow-2xs'
              : 'hover:bg-slate-200 text-slate-600'
          }`}
        >
          ALL ({alerts.length})
        </button>
        <button
          onClick={() => setFilterTab('CRITICAL')}
          className={`px-2.5 py-1 rounded text-[11px] transition-colors flex items-center gap-1 ${
            filterTab === 'CRITICAL'
              ? 'bg-red-600 text-white shadow-2xs'
              : 'hover:bg-red-50 text-red-700'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          CRITICAL ({criticalCount})
        </button>
        <button
          onClick={() => setFilterTab('WATCHLIST')}
          className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
            filterTab === 'WATCHLIST'
              ? 'bg-[#245B84] text-white shadow-2xs'
              : 'hover:bg-blue-50 text-[#245B84]'
          }`}
        >
          WATCHLIST ({watchlistCount})
        </button>
      </div>

      {/* Scrollable Alerts Feed List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="font-mono font-bold text-slate-700 text-xs uppercase">All Systems Clear</h4>
            <p className="text-[11px] text-slate-500 font-mono max-w-xs mx-auto">
              No active {filterTab !== 'ALL' ? filterTab.toLowerCase() : ''} traffic alerts or violations reported right now.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const badge = getSeverityBadge(alert.severity);
            const Icon = badge.icon;
            const isUnread = !alert.is_read;

            return (
              <div
                key={alert.id}
                className={`p-3.5 hover:bg-slate-50 transition-colors relative group ${
                  isUnread ? 'bg-amber-50/20' : 'bg-white'
                }`}
              >
                {/* Unread Left Border Highlight */}
                {isUnread && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                )}

                <div className="space-y-1.5 pl-1">
                  {/* Top Row: Severity + Time + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold flex items-center gap-1 ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <Icon className="w-3 h-3 shrink-0" />
                        {badge.label}
                      </span>
                      {alert.vehicle_plate && (
                        <span className="px-2 py-0.5 rounded bg-amber-300 border border-slate-900 text-slate-950 font-mono font-black text-[10px] tracking-wider shadow-2xs">
                          {alert.vehicle_plate}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(alert.timestamp)}</span>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="opacity-60 hover:opacity-100 p-0.5 hover:text-red-600 rounded transition-opacity"
                        title="Dismiss Alert"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Message Content */}
                  <p className="text-xs font-mono font-semibold text-slate-800 leading-snug line-clamp-2">
                    {alert.message}
                  </p>

                  {/* Location Info & Quick Action Footer */}
                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
                    <div className="flex items-center gap-1 text-slate-500 text-[10px] truncate max-w-[200px]">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="truncate">{alert.location || 'Intersection Camera'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <button
                          onClick={() => markAlertAsRead(alert.id)}
                          className="text-[10px] font-bold text-slate-500 hover:text-[#173F5F] flex items-center gap-0.5"
                          title="Mark read"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Mark Read</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onClose();
                          if (alert.vehicle_plate) {
                            navigate('/anpr');
                          } else {
                            navigate('/alerts');
                          }
                        }}
                        className="text-[10px] font-bold text-[#245B84] hover:text-[#173F5F] flex items-center gap-0.5 hover:underline"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer Bar */}
      <div className="p-2.5 bg-slate-50 border-t border-[#DCE4EA] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>AI SURVEILLANCE ARMED</span>
        </div>
        <Link
          to="/alerts"
          onClick={onClose}
          className="px-2.5 py-1 bg-[#173F5F] hover:bg-[#245B84] text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
        >
          <span>Full Alert Center</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
