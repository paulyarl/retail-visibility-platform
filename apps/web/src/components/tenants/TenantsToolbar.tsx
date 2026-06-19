'use client';

import { LayoutGrid, List } from 'lucide-react';
import type { TenantsViewMode } from './types';

interface TenantsToolbarProps {
  filteredCount: number;
  currentPage: number;
  pageSize: number;
  viewMode: TenantsViewMode;
  setViewMode: (m: TenantsViewMode) => void;
}

export function TenantsToolbar({
  filteredCount,
  currentPage,
  pageSize,
  viewMode,
  setViewMode,
}: TenantsToolbarProps) {
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, filteredCount);

  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Showing{' '}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {filteredCount > 0 ? startIdx : 0}–{endIdx}
        </span>{' '}
        of{' '}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {filteredCount}
        </span>{' '}
        locations
      </p>
      <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <button
          onClick={() => setViewMode('grid')}
          className={`p-1.5 ${
            viewMode === 'grid'
              ? 'bg-blue-600 text-white'
              : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          aria-label="Gallery view"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-1.5 ${
            viewMode === 'list'
              ? 'bg-blue-600 text-white'
              : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          aria-label="Table view"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
