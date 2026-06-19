'use client';

/**
 * DirectorySearchBar — unified search + "Near Me" button.
 *
 * Single source of truth for `q`. On submit, merges into existing
 * useSearchParams, router.push("/directory?"+params), resets page.
 * "Near Me" calls navigator.geolocation and sets lat/lng/sort=distance.
 */

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Navigation } from 'lucide-react';

export default function DirectorySearchBar({
  appearance = 'discovery',
}: {
  appearance?: 'discovery' | 'editorial' | 'immersive';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(
    searchParams.get('q') || searchParams.get('search') || '',
  );
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchValue.trim()) {
      params.set('q', searchValue.trim());
    } else {
      params.delete('q');
      params.delete('search');
    }
    params.delete('page');
    startTransition(() => {
      router.push(`/directory?${params.toString()}`);
    });
  };

  const handleClear = () => {
    setSearchValue('');
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    params.delete('search');
    params.delete('page');
    startTransition(() => {
      router.push(`/directory?${params.toString()}`);
    });
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams(searchParams);
        params.set('lat', position.coords.latitude.toString());
        params.set('lng', position.coords.longitude.toString());
        params.set('sort', 'distance');
        params.delete('page');
        setGettingLocation(false);
        startTransition(() => {
          router.push(`/directory?${params.toString()}`);
        });
      },
      () => {
        setGettingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const isLight = appearance === 'discovery';

  return (
    <form
      onSubmit={handleSearch}
      className="relative w-full"
      aria-label="Directory search"
    >
      <div className="relative flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isLight ? 'text-white/60' : 'text-neutral-400'
            }`}
          />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search stores, categories, locations..."
            aria-label="Search stores, categories, locations"
            className={`w-full pl-12 pr-24 py-3 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              isLight
                ? 'bg-white/10 border-white/20 text-white placeholder-white/60 dark:bg-white/10 dark:border-white/20'
                : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white placeholder-neutral-500'
            }`}
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClear}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                isLight
                  ? 'text-white/60 hover:text-white'
                  : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
              }`}
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Near Me button */}
        <button
          type="button"
          onClick={handleNearMe}
          disabled={gettingLocation || isPending}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
            isLight
              ? 'bg-white/20 hover:bg-white/30 text-white border border-white/20'
              : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Find stores near me"
        >
          <Navigation className="w-4 h-4" />
          <span className="hidden sm:inline">
            {gettingLocation ? 'Locating...' : 'Near Me'}
          </span>
        </button>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isPending ? 'Searching...' : 'Search'}
        </button>
      </div>
    </form>
  );
}
