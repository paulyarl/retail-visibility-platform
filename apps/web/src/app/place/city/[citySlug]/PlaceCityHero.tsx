import Link from 'next/link';
import { MapPin, ArrowLeft } from 'lucide-react';
import type { LocationEnrichmentResponse } from '@/services/PlacesBrowsePublicService';

/**
 * Server-rendered seed city shelf hero — breadcrumb, title, listing count, the
 * location packet's narrative overview, and the top-category chips.
 *
 * Rendered by page.tsx OUTSIDE the client's loading gate so the packet copy is
 * crawler-visible without waiting for the listings fetch (same contract as
 * PlaceCityEnrichmentContent). The overview leads with `bodyCopy` — the same
 * "About {city}" prose /directory/location renders — and falls back to the
 * shorter `effective.description` only when no narrative was composed.
 */
export default function PlaceCityHero({
  citySlug,
  city,
  state,
  total,
  enrichment,
}: {
  citySlug: string;
  city: string;
  state: string | null;
  total: number;
  enrichment: LocationEnrichmentResponse | null;
}) {
  const locationName = state ? `${city}, ${state}` : city;
  const overview = enrichment?.bodyCopy || enrichment?.effective?.description || null;
  const topCategories = enrichment?.topCategories ?? [];

  const jsonLd = enrichment
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: enrichment.effective.metaTitle || `Places in ${locationName}`,
        description: enrichment.effective.description,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://visibleshelf.com'}/place/city/${citySlug}`,
      }
    : null;

  return (
    <div className="bg-white border-b border-neutral-200">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
          <Link href="/directory" className="hover:text-neutral-700">Directory</Link>
          <span>/</span>
          <Link href="/place" className="hover:text-neutral-700">Places</Link>
          <span>/</span>
          <span className="text-neutral-900 font-medium">{locationName}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                Places in {locationName}
              </h1>
              {total > 0 && (
                <p className="text-sm text-neutral-600 mt-1">
                  {total} business{total !== 1 ? 'es' : ''} listed from public information
                </p>
              )}
            </div>
          </div>
          <Link
            href="/place"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            All places
          </Link>
        </div>

        {overview && (
          <div className="mt-6 max-w-3xl rounded-xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Overview
            </p>
            <p className="text-neutral-700 leading-relaxed whitespace-pre-line">{overview}</p>
          </div>
        )}

        {topCategories.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-neutral-500 mb-2">Top categories in {city}</p>
            <div className="flex flex-wrap gap-2 max-w-3xl">
              {topCategories.slice(0, 8).map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
