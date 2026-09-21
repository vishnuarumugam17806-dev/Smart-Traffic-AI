import React, { useState, useRef, useEffect } from 'react';
import { Layers, Check, ChevronDown } from 'lucide-react';
import { MapStyleId, MAP_STYLE_OPTIONS } from '../utils/mapProviders';

interface MapStyleSelectorProps {
  currentStyle: MapStyleId;
  onStyleChange: (styleId: MapStyleId) => void;
  className?: string;
  compact?: boolean;
}

export const MapStyleSelector: React.FC<MapStyleSelectorProps> = ({
  currentStyle,
  onStyleChange,
  className = '',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption = MAP_STYLE_OPTIONS.find((opt) => opt.id === currentStyle) || MAP_STYLE_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative z-[1000] inline-block font-sans ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 hover:bg-white backdrop-blur-sm text-slate-700 hover:text-[#245B84] text-xs font-semibold rounded-lg shadow-md border border-slate-200/80 transition-all cursor-pointer"
        title="Switch Map Base Layer (Google Maps / Dark Mode / Satellite)"
      >
        <span className="text-sm">{activeOption.icon}</span>
        {!compact && <span className="font-medium truncate max-w-[130px]">{activeOption.name}</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 bg-white/98 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 py-1.5 text-xs divide-y divide-slate-100 animate-in fade-in-50 zoom-in-95 duration-100 z-[1001]">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Map Layer Source</span>
            <span className="text-emerald-600 font-extrabold flex items-center gap-1">
              <Layers className="w-3 h-3" /> Live
            </span>
          </div>

          <div className="py-1">
            <div className="px-3 py-1 text-[9px] font-bold text-blue-700 bg-blue-50/60 uppercase">
              Google Maps Enterprise
            </div>
            {MAP_STYLE_OPTIONS.filter((o) => o.category === 'google').map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onStyleChange(option.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer ${
                  currentStyle === option.id ? 'bg-blue-50/80 text-blue-900 font-bold' : 'text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">{option.icon}</span>
                  <div>
                    <div className="text-xs leading-tight font-semibold flex items-center gap-1.5">
                      {option.name}
                      {option.id === 'google-traffic' && (
                        <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded text-[8px] font-extrabold uppercase">
                          Real-Time
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-snug">{option.subtext}</div>
                  </div>
                </div>
                {currentStyle === option.id && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>

          <div className="py-1">
            <div className="px-3 py-1 text-[9px] font-bold text-slate-500 bg-slate-50/80 uppercase">
              Standard Vector GIS
            </div>
            {MAP_STYLE_OPTIONS.filter((o) => o.category === 'standard').map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onStyleChange(option.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 hover:bg-slate-50 transition-colors cursor-pointer ${
                  currentStyle === option.id ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">{option.icon}</span>
                  <div>
                    <div className="text-xs leading-tight font-semibold">{option.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-snug">{option.subtext}</div>
                  </div>
                </div>
                {currentStyle === option.id && <Check className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
