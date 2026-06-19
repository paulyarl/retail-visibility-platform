'use client';

/**
 * DirectoryContextBar — sticky bar with location pill, sort dropdown,
 * view toggle (Grid/List/Map), and result counter.
 *
 * Reads sort/location from useSearchParams; view mode from props.
 * Sort change updates URL & refetches; view toggle persists to localStorage.
 */

import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Navigation, Grid3x3, List, Map } from 'lucide-react';
import type { DirectoryViewMode } from './types';

interface DirectoryContextBarProps {
  viewMode: DirectoryViewMode;
  onViewModeChange: (mode: DirectoryViewMode) => void;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  userLocationLabel?: string | null;
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'distance', label: 'Distance' },
  { value: 'rating', label: 'Rating' },
  { value: 'newest', label: 'Newest' },
  { value: 'products', label: 'Most Products' },
];

export default function DirectoryContextBar({
  viewMode,
  onViewModeChange,
  currentPage,
  pageSize,
  totalItems,
  userLocationLabel,
}: DirectoryContextBarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sort = searchParams.get('sort') || 'activity';
  const hasLocation = !!(searchParams.get('lat') && searchParams.get('lng'));

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'activity') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }
    params.delete('page');
    router.push(`/directory?${params.toString()}`);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams(searchParams);
        params.set('lat', position.coords.latitude.toString());
        params.set('lng', position.coords.longitude.toString());
        params.set('sort', 'distance');
        params.delete('page');
        router.push(`/directory?${params.toString()}`);
      },
      () => {},
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const showingFrom = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, totalItems);

  const viewButtons: { mode: DirectoryViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'grid', icon: <Grid3x3 className="w-4 h-4" />, label: 'Grid' },
    { mode: 'list', icon: <List className="w-4 h-4" />, label: 'List' },
    { mode: 'map', icon: <Map className="w-4 h-4" />, label: 'Map' },
  ];

  return (
    <div className="sticky top-0 z-20 backdrop-blur bg-white/80 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-3 flex-wrap">
          {/* Left: location pill */}
          <div className="flex items-center gap-3">
            {hasLocation ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium">
                <MapPin className="w-4 h-4" />
                <span className="truncate max-w-[200px]">
                  {userLocationLabel || 'Near you'}
                </span>
              </span>
            ) : (
              <button
                onClick={handleUseLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                Use my location
              </button>
            )}
          </div>

          {/* Right: sort, view toggle, counter */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Result counter */}
            {totalItems > 0 && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400 hidden sm:inline">
                Showing {showingFrom}–{showingTo} of {totalItems.toLocaleString()}
              </span>
            )}

            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="dir-sort"
                className="text-sm text-neutral-500 dark:text-neutral-400 hidden sm:inline"
              >
                Sort:
              </label>
              <select
                id="dir-sort"
                value={sort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
              {viewButtons.map((btn) => (
                <button
                  key={btn.mode}
                  onClick={() => onViewModeChange(btn.mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === btn.mode
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                  aria-label={`${btn.label} view`}
                  aria-pressed={viewMode === btn.mode}
                >
                  {btn.icon}
                  <span className="hidden sm:inline">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
