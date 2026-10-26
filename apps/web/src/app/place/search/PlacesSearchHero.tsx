import Link from 'next/link';
import { Search } from 'lucide-react';

/**
 * Server-rendered banner for /place/search — the same full-bleed violet band
 * PlacesIndexHero renders on the /place home, so the search surface carries the
 * place chrome instead of starting as a bare white content block. The H1 and
 * browse copy stay server-rendered; the search form itself is stateful and
 * lives in PlacesSearchClient directly below.
 */
export default function PlacesSearchHero() {
  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 text-white"
      aria-label="Search places banner"
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
          <Link href="/place" className="hover:text-white transition-colors">
            Places
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-white font-medium">Search</span>
        </div>

        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 inline-flex items-center gap-3">
            <Search className="w-8 h-8 text-white/80" aria-hidden="true" />
            Search Places
          </h1>
          <p className="text-lg text-white/80">
            Find local businesses across every city and category — filter by
            SNAP/EBT, delivery, or pickup. Is this your business? Claim it free
            or add it to the directory.
          </p>
        </div>
      </div>
    </section>
  );
}
