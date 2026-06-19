'use client';

/**
 * DirectoryFilterRail — sticky left column on desktop, Mantine Drawer on mobile.
 *
 * Sections: Categories (radio list with counts), Store Types, Min Rating, Open Now.
 * Each change updates URL params via router.push, resets page.
 * Shows active-filter count badge + "Clear all".
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Drawer, Button as MantineButton } from '@mantine/core';
import { SlidersHorizontal, X, Star } from 'lucide-react';
import type { DirectoryCategory, DirectoryStoreType } from './types';

interface DirectoryFilterRailProps {
  categories: DirectoryCategory[];
  storeTypes: DirectoryStoreType[];
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const RATING_OPTIONS = [
  { value: '4', label: '4.0 & up' },
  { value: '3', label: '3.0 & up' },
  { value: '2', label: '2.0 & up' },
];

export default function DirectoryFilterRail({
  categories,
  storeTypes,
  mobileOpen,
  onMobileClose,
}: DirectoryFilterRailProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeCategory = searchParams.get('category') || '';
  const activeStoreType = searchParams.get('storeType') || '';
  const minRating = searchParams.get('minRating') || '';
  const openNow = searchParams.get('openNow') === 'true';

  const activeFilterCount = [
    activeCategory,
    activeStoreType,
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

  const handleClearAll = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('category');
    params.delete('storeType');
    params.delete('minRating');
    params.delete('openNow');
    params.delete('page');
    router.push(`/directory?${params.toString()}`);
  };

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
