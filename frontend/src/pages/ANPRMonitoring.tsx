import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ShieldAlert, FileText, AlertTriangle,
  Clock, MapPin, Filter, Route as RouteIcon,
  RefreshCw, CheckCircle2, Siren, Database, Eye,
  Sliders, Calendar, Camera, X, ExternalLink, ShieldCheck
} from 'lucide-react';
import { apiClient, resolveImageUrl } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { DetailDrawer } from '../components/DetailDrawer';

interface CategoryOption {
  id: string;
  label: string;
  count: number;
}

interface ANPRRecord {
  id: number;
  plate: string;
  plate_number: string;
  category: string;
  category_label: string;
  camera_id: number;
  camera_name: string;
  location: string;
  timestamp: string;
  confidence: number;
  status: string;
  evidence_image?: string;
}

interface CameraOption {
  id: number;
  name: string;
}

export const ANPRMonitoring: React.FC = () => {
  // Navigation View Tabs
  const [activeTab, setActiveTab] = useState<'RECORDS' | 'SCANNER' | 'DIRECTORIES'>('RECORDS');

  // Filter-First Core State
  // Distinguish category === null (initial unselected) from a chosen category
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [records, setRecords] = useState<ANPRRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Secondary Filters
  const [searchPlate, setSearchPlate] = useState<string>('');
  const [cameraFilter, setCameraFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showSecondaryFilters, setShowSecondaryFilters] = useState<boolean>(false);

  // Cameras for secondary filter dropdown
  const [cameras, setCameras] = useState<CameraOption[]>([]);

  // Detail Drawer State
  const [selectedRecord, setSelectedRecord] = useState<ANPRRecord | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Secondary Tools: Live Scanner state
  const [scannerPlate, setScannerPlate] = useState<string>('KA05MN3821');
  const [scannerResult, setScannerResult] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Secondary Tools: Watchlist Directory state
  const [directories, setDirectories] = useState<any[]>([]);
  const [loadingDirs, setLoadingDirs] = useState<boolean>(false);

  // 1. Fetch available categories from backend on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get('/anpr/categories');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setCategories(res.data);
        }
      } catch (err) {
        console.warn('Unable to fetch ANPR categories from backend:', err);
      }
    };

    const fetchCameras = async () => {
      try {
        const res = await apiClient.get('/cameras');
        if (Array.isArray(res.data)) {
          setCameras(res.data);
        }
      } catch (err) {
        console.warn('Unable to fetch cameras:', err);
      }
    };

    fetchCategories();
    fetchCameras();
  }, []);

  // 2. Fetch records strictly when category is selected
  // When category === null, records are NOT fetched and remains empty
  useEffect(() => {
    if (!selectedCategory) {
      setRecords([]);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    const fetchCategoryRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = {
          category: selectedCategory,
          limit: 100
        };

        if (searchPlate.trim()) {
          params.search = searchPlate.trim();
        }
        if (cameraFilter !== 'ALL') {
          params.camera_id = Number(cameraFilter);
        }
        if (statusFilter !== 'ALL') {
          params.status = statusFilter;
        }
        if (dateFilter.trim()) {
          params.date = dateFilter.trim();
        }

        const res = await apiClient.get('/anpr', { params });
        if (isMounted) {
          if (Array.isArray(res.data)) {
            setRecords(res.data);
          } else {
            setRecords([]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.detail || 'Failed to retrieve ANPR category records.');
          setRecords([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCategoryRecords();

    return () => {
      isMounted = false;
    };
  }, [selectedCategory, searchPlate, cameraFilter, statusFilter, dateFilter]);

  // Handle Category Change (Resets previous records immediately)
  const handleCategorySelect = (newCategory: string | null) => {
    setRecords([]); // Clear old results immediately
    setSelectedCategory(newCategory);
  };

  // Clear all filters
  const handleClearAll = () => {
    setSelectedCategory(null);
    setSearchPlate('');
    setCameraFilter('ALL');
    setStatusFilter('ALL');
    setDateFilter('');
    setRecords([]);
  };

  // Perform Live Plate Scan
  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannerPlate.trim()) return;
    setIsScanning(true);
    try {
      const res = await apiClient.post('/anpr/scan-check', {
        plate_number: scannerPlate.trim().toUpperCase(),
        location: 'Anna Salai - Spencers Junction'
      });
      setScannerResult(res.data);
    } catch (err: any) {
      console.warn('Scanner error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Fetch Watchlist Directories
  const fetchDirectories = async () => {
    setLoadingDirs(true);
    try {
      const res = await apiClient.get('/anpr/directories');
      if (Array.isArray(res.data)) {
        setDirectories(res.data);
      }
    } catch (err) {
      console.warn('Directory fetch error:', err);
    } finally {
      setLoadingDirs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'DIRECTORIES') {
      fetchDirectories();
    }
  }, [activeTab]);

  const isFiltered = Boolean(
    selectedCategory !== null ||
    searchPlate.trim() !== '' ||
    cameraFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    dateFilter !== ''
  );

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="p-3 sm:p-5 space-y-4 bg-[#F8FAFC] min-h-screen font-sans select-none">
      {/* 1. Standardized Header with View Mode Switcher */}
      <PageHeader
        title="ANPR Intelligence"
        subtitle="Filter-first automatic number-plate recognition and violation monitoring"
        badge={
          selectedCategory ? (
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EEF6FC] text-[#245B84] border border-[#D0E5F5]">
              CATEGORY: {selectedCategoryObj?.label || selectedCategory}
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
              FILTER FIRST
            </span>
          )
        }
        actions={
          <div className="flex bg-white p-0.5 rounded-lg border border-[#DCE4EA] text-xs font-semibold shadow-2xs">
            <button
              onClick={() => setActiveTab('RECORDS')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'RECORDS'
                  ? 'bg-[#245B84] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ANPR Records
            </button>
            <button
              onClick={() => setActiveTab('SCANNER')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'SCANNER'
                  ? 'bg-[#245B84] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Plate Scanner
            </button>
            <button
              onClick={() => setActiveTab('DIRECTORIES')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'DIRECTORIES'
                  ? 'bg-[#245B84] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Watchlist Directory
            </button>
          </div>
        }
      />

      {/* VIEW TAB 1: ANPR FILTER-FIRST RECORDS */}
      {activeTab === 'RECORDS' && (
        <div className="space-y-4">
          {/* Main Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Category Dropdown */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="relative min-w-[200px] sm:min-w-[240px]">
                  <select
                    id="anpr-category-select"
                    value={selectedCategory || ''}
                    onChange={(e) => handleCategorySelect(e.target.value ? e.target.value : null)}
                    className={`w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      selectedCategory
                        ? 'bg-[#EEF6FC] border-[#245B84] text-[#173F5F]'
                        : 'bg-[#F8FAFC] border-[#DCE4EA] text-slate-700 hover:border-slate-400'
                    } focus:outline-none focus:ring-1 focus:ring-[#245B84]`}
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.count})
                      </option>
                    ))}
                    <option value="ALL">All Categories</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Plate Search: Active ONLY within selected category */}
                <div className="relative flex-1 min-w-[160px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="anpr-search-input"
                    type="text"
                    value={searchPlate}
                    onChange={(e) => setSearchPlate(e.target.value)}
                    placeholder={
                      selectedCategory
                        ? `Search plate in ${selectedCategoryObj?.label || 'category'}...`
                        : 'Select category first to search...'
                    }
                    disabled={selectedCategory === null}
                    className={`w-full pl-9 pr-7 py-2 text-xs rounded-lg border transition-all ${
                      selectedCategory === null
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-[#F8FAFC] border-[#DCE4EA] text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#245B84]'
                    }`}
                  />
                  {searchPlate && (
                    <button
                      onClick={() => setSearchPlate('')}
                      className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right Controls: Filters Drawer Toggle, Clear, Count */}
              <div className="flex items-center gap-2">
                {selectedCategory && (
                  <button
                    onClick={() => setShowSecondaryFilters(!showSecondaryFilters)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      showSecondaryFilters || cameraFilter !== 'ALL' || statusFilter !== 'ALL' || dateFilter !== ''
                        ? 'bg-[#EEF6FC] border-[#245B84] text-[#173F5F]'
                        : 'bg-[#F8FAFC] border-[#DCE4EA] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Filters {cameraFilter !== 'ALL' || statusFilter !== 'ALL' || dateFilter !== '' ? '●' : '▾'}
                  </button>
                )}

                {isFiltered && (
                  <button
                    id="anpr-clear-button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Reset category and filters"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}

                {selectedCategory && !loading && (
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {records.length} {records.length === 1 ? 'RECORD' : 'RECORDS'}
                  </span>
                )}
              </div>
            </div>

            {/* Secondary Filter Drawer / Expanded Popover */}
            {selectedCategory && showSecondaryFilters && (
              <div className="pt-3 border-t border-[#DCE4EA] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn text-xs">
                {/* Camera filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Camera Location</label>
                  <select
                    value={cameraFilter}
                    onChange={(e) => setCameraFilter(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="ALL">All Surveillance Cameras</option>
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Verification Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#DCE4EA] rounded-md p-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#245B84]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Review">Review Required</option>
                    <option value="Verified">Verified Offense</option>
                    <option value="Pending">Pending Audit</option>
                  </select>
                </div>

                {/* Date filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Date</label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full pl-8 pr-2 py-1 bg-[#F8FAFC] border border-[#DCE4EA] rounded-md text-slate-800 text-xs focus:outline-none focus:border-[#245B84]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MAIN DATA / VISUALIZATION CONTAINER */}

          {/* State 1: No category selected (Initial Empty State) */}
          {selectedCategory === null && (
            <div id="anpr-empty-state">
              <EmptyState
                icon={Search}
                title="SELECT THE CATEGORY"
                description="Choose a category to view vehicle records."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
                    {categories.slice(0, 7).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleCategorySelect(c.id)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#EEF6FC] border border-[#DCE4EA] hover:border-[#245B84] text-slate-700 hover:text-[#173F5F] text-xs font-semibold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{c.label}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {c.count}
                        </span>
                      </button>
                    ))}
                  </div>
                }
              />
            </div>
          )}

          {/* State 2: Loading State */}
          {selectedCategory !== null && loading && (
            <div className="bg-white p-12 rounded-xl border border-[#DCE4EA] shadow-2xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-[#245B84] animate-spin" />
              <p className="text-xs font-mono font-semibold text-slate-600 uppercase tracking-wide">
                Loading {selectedCategoryObj?.label || selectedCategory} records...
              </p>
            </div>
          )}

          {/* State 3: Error State */}
          {selectedCategory !== null && !loading && error && (
            <EmptyState
              icon={AlertTriangle}
              title="UNABLE TO LOAD RECORDS"
              description={error}
              action={
                <button
                  onClick={() => handleCategorySelect(selectedCategory)}
                  className="px-4 py-2 bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Retry Query
                </button>
              }
            />
          )}

          {/* State 4: No Results Found State */}
          {selectedCategory !== null && !loading && !error && records.length === 0 && (
            <EmptyState
              icon={FileText}
              title="NO RECORDS FOUND"
              description={`No vehicle records found for category "${selectedCategoryObj?.label || selectedCategory}". Try changing your filters or searching another plate.`}
              action={
                <button
                  onClick={() => {
                    setSearchPlate('');
                    setCameraFilter('ALL');
                    setStatusFilter('ALL');
                    setDateFilter('');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear Sub-Filters
                </button>
              }
            />
          )}

          {/* State 5: Results Loaded (Structured, Minimal, Filter-First Table) */}
          {selectedCategory !== null && !loading && !error && records.length > 0 && (
            <div className="bg-white rounded-xl border border-[#DCE4EA] shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-[#DCE4EA]">
                  <thead className="bg-[#F8FAFC] text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="py-3 px-4">Number Plate</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Surveillance Camera</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE4EA] text-slate-800">
                    {records.map((rec) => {
                      const isVerified = rec.status?.toLowerCase() === 'verified';
                      const isReview = rec.status?.toLowerCase() === 'review';

                      return (
                        <tr
                          key={rec.id}
                          onClick={() => setSelectedRecord(rec)}
                          className="hover:bg-[#F2F7FA] transition-colors cursor-pointer"
                        >
                          {/* Plate */}
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-900">
                            <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-mono tracking-wider text-xs border border-slate-700 shadow-2xs">
                              {rec.plate || rec.plate_number}
                            </span>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EEF6FC] text-[#173F5F] border border-[#D0E5F5]">
                              {rec.category_label || rec.category}
                            </span>
                          </td>

                          {/* Camera & Location */}
                          <td className="py-3 px-4 max-w-xs truncate">
                            <div className="font-semibold text-slate-800 truncate">{rec.camera_name}</div>
                            <div className="text-[11px] text-slate-500 font-sans truncate">{rec.location}</div>
                          </td>

                          {/* Timestamp */}
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(rec.timestamp).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Confidence */}
                          <td className="py-3 px-4 whitespace-nowrap font-mono">
                            <span className="font-bold text-[#245B84]">
                              {Math.round((rec.confidence || 0.95) * 100)}%
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                isVerified
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isReview
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecord(rec);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-[#245B84] hover:text-[#173F5F] hover:bg-[#EEF6FC] rounded border border-transparent hover:border-[#D0E5F5] transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB 2: LIVE PLATE SCANNER (ON-DEMAND AUDIT TOOL) */}
      {activeTab === 'SCANNER' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="bg-white p-5 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase font-sans">Instant Plate Verification Check</h2>
              <p className="text-xs text-slate-500 font-sans">
                Scan license plate against RTO registries, police hotlists, and traffic compliance warrants.
              </p>
            </div>

            <form onSubmit={handleRunScan} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={scannerPlate}
                  onChange={(e) => setScannerPlate(e.target.value.toUpperCase())}
                  placeholder="Enter number plate (e.g., KA05MN3821)..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold tracking-wider rounded-lg border border-[#DCE4EA] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#245B84]"
                />
              </div>
              <button
                type="submit"
                disabled={isScanning}
                className="px-5 py-2.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                {isScanning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Verify Plate
              </button>
            </form>

            {/* Scanner Result Card */}
            {scannerResult && (
              <div className="mt-4 p-4 rounded-xl border border-[#DCE4EA] bg-[#F8FAFC] space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded bg-slate-900 text-white font-mono font-bold text-sm tracking-widest">
                      {scannerResult.plate_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        scannerResult.directory_matched
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {scannerResult.directory_matched ? '🚨 ADVERSE DIRECTORY MATCH' : 'CLEAN VEHICLE'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Confidence: {Math.round((scannerResult.confidence || 0.95) * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-[#DCE4EA]">
                    <span className="text-slate-500 font-sans block mb-1">Status Reason:</span>
                    <span className="font-semibold text-slate-800">{scannerResult.match_reason || 'All registry documents valid.'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#DCE4EA]">
                    <span className="text-slate-500 font-sans block mb-1">Recommended Action:</span>
                    <span className="font-semibold text-slate-800">{scannerResult.recommended_action || 'Pass vehicle normally.'}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Link
                    to={`/trajectories?plate=${scannerResult.plate_number}`}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-[#DCE4EA] text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RouteIcon className="w-3.5 h-3.5 text-[#245B84]" />
                    View Trajectory History
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW TAB 3: WATCHLIST DIRECTORY */}
      {activeTab === 'DIRECTORIES' && (
        <div className="space-y-4 max-w-5xl mx-auto">
          <div className="bg-white p-4 rounded-xl border border-[#DCE4EA] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase font-sans">Watchlist & Stolen Vehicle Directory</h2>
                <p className="text-xs text-slate-500 font-sans">Official police hotlists, FIR records and court warrant notices</p>
              </div>
              <button
                onClick={fetchDirectories}
                disabled={loadingDirs}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Refresh Directory"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDirs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-[#DCE4EA]">
                <thead className="bg-[#F8FAFC] text-[11px] font-bold text-slate-600 uppercase font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Plate</th>
                    <th className="py-2.5 px-3">Directory Flag</th>
                    <th className="py-2.5 px-3">Reason / Incident</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Scans</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE4EA] text-slate-800">
                  {directories.map((dir) => (
                    <tr key={dir.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold">{dir.plate}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#173F5F]">{dir.directory_type}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-600">{dir.reason}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          dir.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {dir.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{dir.scan_count || 0}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {dir.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {directories.length === 0 && !loadingDirs && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No directory entries loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER (VEHICLE & EVIDENCE INSPECTION) */}
      <DetailDrawer
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title="Vehicle ANPR Details"
        subtitle={selectedRecord ? `Incident #${selectedRecord.id} • ${selectedRecord.plate_number}` : ''}
        badge={
          selectedRecord && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-900 text-white">
              {selectedRecord.plate_number}
            </span>
          )
        }
        footer={
          selectedRecord && (
            <>
              <Link
                to={`/trajectories?plate=${selectedRecord.plate_number}`}
                className="px-3.5 py-1.5 bg-[#245B84] hover:bg-[#1E4A6F] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RouteIcon className="w-3.5 h-3.5" />
                View Trajectory Route
              </Link>
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </>
          )
        }
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Visual Plate Header */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between border border-slate-700 shadow-md">
              <div>
                <span className="text-[10px] text-slate-400 font-mono tracking-widest block uppercase">
                  IND LICENSE PLATE
                </span>
                <span className="text-xl font-bold font-mono tracking-widest">
                  {selectedRecord.plate_number}
                </span>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-[#245B84] text-white font-mono">
                  {Math.round((selectedRecord.confidence || 0.95) * 100)}% CONFIDENCE
                </span>
              </div>
            </div>

            {/* Stored Attributes Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Violation Category</span>
                <span className="font-bold text-slate-900">{selectedRecord.category_label || selectedRecord.category}</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Review Status</span>
                <span className="font-bold text-slate-900 uppercase">{selectedRecord.status}</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Camera ID & Name</span>
                <span className="font-bold text-slate-900 truncate block">{selectedRecord.camera_name}</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA]">
                <span className="text-[11px] text-slate-500 block mb-0.5">Intersection Location</span>
                <span className="font-bold text-slate-900 truncate block">{selectedRecord.location}</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#DCE4EA] col-span-2">
                <span className="text-[11px] text-slate-500 block mb-0.5">Detection Timestamp</span>
                <span className="font-mono font-bold text-slate-900">
                  {new Date(selectedRecord.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Stored Photographic Evidence Image */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase font-mono">Evidence Snapshot</span>
                <span className="text-[11px] text-slate-500 font-mono">Camera Frame Capture</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[#DCE4EA] bg-slate-950 aspect-video relative group">
                <img
                  src={resolveImageUrl(selectedRecord.evidence_image || '')}
                  alt={`Evidence for ${selectedRecord.plate_number}`}
                  onError={(e: any) => {
                    e.target.onerror = null;
                    e.target.src = '/sample_traffic.mp4';
                  }}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setPreviewImage(resolveImageUrl(selectedRecord.evidence_image || ''))}
                  className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition-opacity"
                >
                  <Eye className="w-4 h-4" /> Full View
                </button>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Full-view Evidence Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/90 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={previewImage} alt="Evidence Zoom" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
