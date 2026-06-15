'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface ProductSearchProps {
  tenantId: string;
  /** 'default' | 'inline' (blends into header bar) | 'hero' (large, centered) */
  variant?: 'default' | 'inline' | 'hero';
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export default function ProductSearch({
  tenantId,
  variant = 'default',
  placeholder,
  autoFocus = false,
  className = '',
}: ProductSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams(searchParams);
    if (searchValue.trim()) {
      params.set('search', searchValue.trim());
      params.delete('page'); // Reset to page 1 when searching
    } else {
      params.delete('search');
    }

    startTransition(() => {
      router.push(`/tenant/${tenantId}?${params.toString()}`);
    });
  };

  const handleClear = () => {
    setSearchValue('');
    const params = new URLSearchParams(searchParams);
    params.delete('search');
    params.delete('page');

    startTransition(() => {
      router.push(`/tenant/${tenantId}?${params.toString()}`);
    });
  };

  const defaultPlaceholder = placeholder ?? 'Search products...';

  // ── Inline variant (blends into header bar) ──
  if (variant === 'inline') {
    return (
      <form onSubmit={handleSearch} className={`relative w-full max-w-md ${className}`}>
        <div className="relative flex items-center">
          <svg
            className="absolute left-3 w-4 h-4 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={defaultPlaceholder}
            autoFocus={autoFocus}
            className="w-full pl-9 pr-16 py-2 bg-transparent border-b border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-primary-500 transition-colors text-sm"
          />
          {searchValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
            aria-label="Search"
          >
            {isPending ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </form>
    );
  }

  // ── Hero variant (large, centered, subtle background blur) ──
  if (variant === 'hero') {
    return (
      <form onSubmit={handleSearch} className={`relative w-full max-w-2xl mx-auto ${className}`}>
        <div className="relative">
          <div className="absolute inset-0 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-sm rounded-2xl" />
          <div className="relative flex items-center px-2 py-2">
            <svg
              className="absolute left-5 w-6 h-6 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={defaultPlaceholder}
              autoFocus={autoFocus}
              className="w-full pl-14 pr-28 py-4 bg-transparent text-lg text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
            />
            {searchValue && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-24 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {isPending ? '...' : 'Search'}
            </button>
          </div>
        </div>
      </form>
    );
  }

  // ── Default variant ──
  return (
    <form onSubmit={handleSearch} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={defaultPlaceholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-20 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {searchValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-14 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded disabled:opacity-50"
        >
          {isPending ? 'Searching...' : 'Search'}
        </button>
      </div>
    </form>
  );
}
