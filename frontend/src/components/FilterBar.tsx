import React from 'react';
import { Filter, X, Search, RotateCcw } from 'lucide-react';

interface FilterOption {
  id: string | number;
  label: string;
  count?: number;
}

interface FilterBarProps {
  // Category / Primary filter
  categoryValue: string | null;
  onCategoryChange: (value: string | null) => void;
  categories: FilterOption[];
  categoryPlaceholder?: string;

  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // Secondary filters / Controls
  secondaryFilters?: React.ReactNode;
  onReset?: () => void;
  isFiltered?: boolean;

  // Quick info
  resultCount?: number;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  categoryValue,
  onCategoryChange,
  categories,
  categoryPlaceholder = 'Select Category...',
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  secondaryFilters,
  onReset,
  isFiltered = false,
  resultCount,
  className = ''
}) => {
  return (
    <div className={`bg-white p-3 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Category selector & Search */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Category Dropdown */}
          <div className="relative min-w-[180px] sm:min-w-[220px]">
            <select
              value={categoryValue || ''}
              onChange={(e) => onCategoryChange(e.target.value ? e.target.value : null)}
              className={`w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                categoryValue
                  ? 'bg-[#EEF6FC] border-[#245B84] text-[#173F5F]'
                  : 'bg-[#F8FAFC] border-[#DCE4EA] text-slate-600 hover:border-slate-400'
              } focus:outline-none focus:ring-1 focus:ring-[#245B84]`}
            >
              <option value="">{categoryPlaceholder}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} {c.count !== undefined ? `(${c.count})` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
              <Filter className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Search Input (Active if onSearchChange provided) */}
          {onSearchChange !== undefined && (
            <div className="relative flex-1 min-w-[160px] max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                disabled={categoryValue === null}
                className={`w-full pl-9 pr-7 py-2 text-xs rounded-lg border transition-all ${
                  categoryValue === null
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#F8FAFC] border-[#DCE4EA] text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#245B84]'
                }`}
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Secondary filters, clear, count */}
        <div className="flex items-center gap-2">
          {secondaryFilters}

          {isFiltered && onReset && (
            <button
              onClick={onReset}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              Clear
            </button>
          )}

          {resultCount !== undefined && categoryValue !== null && (
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {resultCount} {resultCount === 1 ? 'RECORD' : 'RECORDS'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
