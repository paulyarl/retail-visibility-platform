'use client';

import { Search } from 'lucide-react';
import { usePlatformUrl } from '@/components/storefront/StorefrontUrlContext';

/**
 * DirectoryBusinessSearch — the merchant "find your listing" entry point.
 *
 * Merchant flows search the DIRECTORY, never /place/search: the directory holds
 * both claimed tenants and unclaimed seeds (its only gate is `is_published`),
 * while the place search is reserved for external, unclaimed, non-tenant
 * listings (`listing_origin = 'directory_seed'` — claiming flips the origin, so
 * a tenant never appears there). Searching the directory therefore finds the
 * merchant whether or not they have claimed, and an unclaimed hit still routes
 * to its /place/{slug} page where it can be claimed.
 *
 * A plain GET form: no client state, works before hydration, and it deep-links
 * to the same `/directory?q=` the home search bar writes.
 */
export default function DirectoryBusinessSearch({
  variant = 'card',
  label = 'Find your listing',
  placeholder = 'Your business name',
}: {
  variant?: 'card' | 'hero';
  label?: string;
  placeholder?: string;
}) {
  const platformUrl = usePlatformUrl();
  const isHero = variant === 'hero';

  return (
    <form
      action={platformUrl('/directory')}
      method="get"
      className="flex w-full max-w-md flex-col sm:flex-row gap-2"
      aria-label="Search the directory for your business"
    >
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label={placeholder}
        className={[
          'flex-1 min-w-0 px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
          isHero
            ? 'bg-white/10 border-white/25 text-white placeholder-white/60 backdrop-blur-sm'
            : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white placeholder-neutral-500',
        ].join(' ')}
      />
      <button
        type="submit"
        className={[
          'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-base whitespace-nowrap transition-colors',
          isHero
            ? 'bg-white text-violet-700 hover:bg-violet-50'
            : 'bg-blue-600 text-white hover:bg-blue-700',
        ].join(' ')}
      >
        <Search className="w-4 h-4" aria-hidden="true" />
        {label} →
      </button>
    </form>
  );
}
