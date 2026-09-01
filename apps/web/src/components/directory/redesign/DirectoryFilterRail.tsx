'use client';

/**
 * DirectoryFilterRail — sticky left column on desktop, Mantine Drawer on mobile.
 *
 * Sections: Location (city/state with counts), Categories (radio list with
 * counts), Store Types, Min Rating, Open Now.
 * Each change updates URL params via router.push, resets page.
 * Shows active-filter count badge + "Clear all".
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Drawer, Button as MantineButton } from '@mantine/core';
import { SlidersHorizontal, X, Star, MapPin } from 'lucide-react';
import type { DirectoryCategory, DirectoryStoreType, DirectoryLocation } from './types';

interface DirectoryFilterRailProps {
  categories: DirectoryCategory[];
  storeTypes: DirectoryStoreType[];
  locations?: DirectoryLocation[];
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const RATING_OPTIONS = [
  { value: '4', label: '4.0 & up' },
  { value: '3', label: '3.0 & up' },
  { value: '2', label: '2.0 & up' },
];

const INITIAL_VISIBLE_LOCATIONS = 5;

export default function DirectoryFilterRail({
  categories,
  storeTypes,
  locations = [],
  mobileOpen,
  onMobileClose,
}: DirectoryFilterRailProps) {
  const [showAllLocations, setShowAllLocations] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeCategory = searchParams.get('category') || '';
  const activeStoreType = searchParams.get('storeType') || '';
  const activeCity = searchParams.get('city') || '';
  const activeState = searchParams.get('state') || '';
  const minRating = searchParams.get('minRating') || '';
  const openNow = searchParams.get('openNow') === 'true';

  const activeFilterCount = [
    activeCategory,
    activeStoreType,
    activeCity || activeState,
    minRating,
    openNow ? 'true' : '',
  ].filter(Boolean).length;

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/directory?${params.toString()}`);
  };

  const updateLocation = (city: string | null, state: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (city && state) {
      params.set('city', city);
      params.set('state', state);
    } else {
      params.delete('city');
      params.delete('state');
    }
    params.delete('page');
    router.push(`/directory?${params.toString()}`);
  };

  const handleClearAll = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('category');
    params.delete('storeType');
    params.delete('city');
    params.delete('state');
    params.delete('minRating');
    params.delete('openNow');
    params.delete('page');
    router.push(`/directory?${params.toString()}`);
  };

  const isActiveLocation = (loc: DirectoryLocation) =>
    activeCity.toLowerCase() === loc.city.toLowerCase() &&
    activeState.toLowerCase() === loc.state.toLowerCase();

  // Show the first few locations; "+ more" expands the full list.
  // The active location is always kept visible.
  const visibleLocations = (() => {
    if (locations.length <= INITIAL_VISIBLE_LOCATIONS || showAllLocations) {
      return locations;
    }
    const initial = locations.slice(0, INITIAL_VISIBLE_LOCATIONS);
    const activeLoc = locations.find(isActiveLocation);
    if (activeLoc && !initial.includes(activeLoc)) {
      return [...initial, activeLoc];
    }
    return initial;
  })();

  const railContent = (
    <div className="space-y-6">
      {/* Header with clear all */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-blue-600 text-white">
              {activeFilterCount}
            </span>
          )}
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Location (city / state) */}
      {locations.length > 0 && (
        <FilterSection title="Location">
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm py-1 px-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <input
                type="radio"
                name="location"
                checked={!activeCity && !activeState}
                onChange={() => updateLocation(null, null)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-neutral-700 dark:text-neutral-300">
                All locations
              </span>
            </label>
            {visibleLocations.map((loc) => (
              <label
                key={`${loc.city}-${loc.state}`}
                className="flex items-center justify-between gap-2 cursor-pointer text-sm py-1 px-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <input
                    type="radio"
                    name="location"
                    checked={isActiveLocation(loc)}
                    onChange={() => updateLocation(loc.city, loc.state)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="text-neutral-700 dark:text-neutral-300 truncate">
                    {loc.city}, {loc.state}
                  </span>
                </span>
                {loc.count > 0 && (
                  <span className="text-xs text-neutral-400 shrink-0">
                    {loc.count}
                  </span>
                )}
              </label>
            ))}
            {locations.length > visibleLocations.length && (
              <button
                onClick={() => setShowAllLocations(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium py-1 px-2"
              >
                + {locations.length - visibleLocations.length} more
              </button>
            )}
            {showAllLocations && locations.length > INITIAL_VISIBLE_LOCATIONS && (
              <button
                onClick={() => setShowAllLocations(false)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium py-1 px-2"
              >
                Show less
              </button>
            )}
          </div>
        </FilterSection>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <FilterSection title="Categories">
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {categories.slice(0, 30).map((cat) => (
              <label
                key={cat.id}
                className="flex items-center justify-between gap-2 cursor-pointer text-sm py-1 px-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <input
                    type="radio"
                    name="category"
                    checked={activeCategory === cat.slug}
                    onChange={() => updateParam('category', cat.slug)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-neutral-700 dark:text-neutral-300 truncate">
                    {cat.name}
                  </span>
                </span>
                {cat.storeCount > 0 && (
                  <span className="text-xs text-neutral-400 shrink-0">
                    {cat.storeCount}
                  </span>
                )}
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Store Types */}
      {storeTypes.length > 0 && (
        <FilterSection title="Store Types">
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {storeTypes.map((type) => (
              <label
                key={type.id}
                className="flex items-center justify-between gap-2 cursor-pointer text-sm py-1 px-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <span className="flex items-center gap-2 truncate">
                  <input
                    type="radio"
                    name="storeType"
                    checked={activeStoreType === type.slug}
                    onChange={() => updateParam('storeType', type.slug)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-neutral-700 dark:text-neutral-300 truncate">
                    {type.name}
                  </span>
                </span>
                {type.storeCount > 0 && (
                  <span className="text-xs text-neutral-400 shrink-0">
                    {type.storeCount}
                  </span>
                )}
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Minimum Rating */}
      <FilterSection title="Minimum Rating">
        <div className="space-y-1.5">
          {RATING_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer text-sm py-1 px-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <input
                type="radio"
                name="minRating"
                checked={minRating === opt.value}
                onChange={() => updateParam('minRating', opt.value)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-neutral-700 dark:text-neutral-300">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Open Now */}
      <FilterSection title="Hours">
        <label className="flex items-center gap-2 cursor-pointer text-sm py-1 px-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <input
            type="checkbox"
            checked={openNow}
            onChange={(e) =>
              updateParam('openNow', e.target.checked ? 'true' : null)
            }
            className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
          />
          <span className="text-neutral-700 dark:text-neutral-300">
            Open now
          </span>
        </label>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop sticky rail */}
      <aside className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {railContent}
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer
        opened={mobileOpen}
        onClose={onMobileClose}
        title="Filters"
        position="right"
        size="sm"
        classNames={{
          content: 'bg-white dark:bg-neutral-900',
        }}
      >
        {railContent}
      </Drawer>
    </>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}
