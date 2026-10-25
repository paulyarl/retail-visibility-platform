import Link from 'next/link';
import { MapPin, Search, Store } from 'lucide-react';

/**
 * Server-rendered banner for the /place home — the violet sibling of the
 * directory's DirectoryHero. Same structure (full-bleed gradient band, title,
 * browse copy, search entry, stat chips) with the place palette.
 *
 * It leads the page so the national coverage band and the category grid both
 * read as content under the title, and keeps the H1 crawler-visible without
 * hydration (the grid is gated on its own fetch).
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
    <section
      className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white"
      aria-label="Places banner"
    >
      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex items-center justify-center gap-2 text-sm text-white/70 mb-4">
          <Link href="/directory" className="hover:text-white transition-colors">
            Directory
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-white font-medium">Places</span>
        </div>

        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Places Directory
          </h1>
          <p className="text-lg text-white/80 mb-8">
            Local businesses listed from public information. Browse by category to find
            places near you. Is this your business? Claim it free — fix your details
            and showcase 5 top sellers.
          </p>

          {/* Search entry point */}
          <div className="max-w-xl mx-auto mb-6">
            <Link
              href="/place/search"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white/90 hover:bg-white/20 transition-colors"
            >
              <Search className="w-4 h-4" />
              Search places...
            </Link>
          </div>

          {hasCounts && (
            <div
              className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap min-h-[28px]"
              aria-label="Places stats"
            >
              <span className="inline-flex items-center gap-2 text-sm">
                <Store className="w-4 h-4 text-white/70" />
                <span className="font-semibold text-white">
                  {totalPlaces} {totalPlaces === 1 ? 'place' : 'places'}
                </span>
              </span>
              <span className="inline-flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-white/70" />
                <span className="font-semibold text-white">
                  {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
