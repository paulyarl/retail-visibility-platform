import Link from 'next/link';
import { MapPin, Store } from 'lucide-react';

/**
 * Server-rendered header band for the /place home — breadcrumb, title, browse
 * copy, the search entry point, and the shelf counts when the server could
 * read them. It leads the page so the national coverage band and the category
 * grid both read as content under the title, and keeps the H1 crawler-visible
 * without hydration (the grid is gated on its own fetch).
 */
export default function PlacesIndexHero({
  totalPlaces = 0,
  categoryCount = 0,
}: {
  totalPlaces?: number;
  categoryCount?: number;
}) {
  const hasCounts = totalPlaces > 0 || categoryCount > 0;

  return (
    <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          <Link href="/directory" className="hover:text-neutral-700 dark:hover:text-neutral-200">
            Directory
          </Link>
          <span>/</span>
          <span className="text-neutral-900 dark:text-neutral-100 font-medium">Places</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          Places Directory
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl">
          Local businesses listed from public information. Browse by category to find
          places near you. Is this your business? Claim it free — fix your details
          and showcase 5 top sellers.
        </p>

        {/* Search bar */}
        <div className="mt-6 flex gap-2 max-w-xl">
          <Link
            href="/place/search"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Search places...
          </Link>
        </div>

        {hasCounts && (
          <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <Store className="w-4 h-4" />
              {totalPlaces} {totalPlaces === 1 ? 'place' : 'places'}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
