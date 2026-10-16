'use client';

/**
 * SelectorToolbar — the search + sort control row shared by the marketing-ops
 * pickers (communications prospects, openers/follow-ups campaigns).
 *
 * These pickers load a list once and let the operator narrow it in the
 * browser. The list endpoints return workflow order (status/priority/newest),
 * which reads as arbitrary when scanning for a business by name or market, so
 * every picker gets the same search box + sort select. The item <select> (or
 * any extra filter controls) is passed as children and sits inline after the
 * sort control.
 */

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

export interface SelectorSortOption<T extends string> {
  value: T;
  label: string;
}

interface SelectorToolbarProps<T extends string> {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortBy: T;
  onSortChange: (value: T) => void;
  sortOptions: SelectorSortOption<T>[];
  /** Rendered inline after the sort control — e.g. the item <select>. */
  children?: ReactNode;
}

export default function SelectorToolbar<T extends string>({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  sortBy,
  onSortChange,
  sortOptions,
  children,
}: SelectorToolbarProps<T>) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-3">
      <div className="relative sm:w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
      <label className="flex items-center gap-2 sm:w-56">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
          Sort by
        </span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as T)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}
