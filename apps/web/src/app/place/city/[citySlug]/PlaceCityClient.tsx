'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Phone,
  ArrowLeft,
  ArrowRight,
  Info,
  ShoppingBasket,
} from 'lucide-react';
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { buildShelfSections } from './place-city-shelves';
import { MarketIntelSurfaceSidebar } from '@/components/place/MarketIntelSurfaceSidebar';
import LocationBrowseTracker from '@/components/tracking/LocationBrowseTracker';
import { reportShelfListingClick } from '@/services/DirectoryPresencePublicService';
import type { CityMarketIntelTeaser } from '@/services/MarketIntelSurfaceService';
import type { LocationEnrichmentResponse } from '@/services/PlacesBrowsePublicService';

interface PlaceResult {
  id: string;
  businessName: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  logoUrl: string | null;
  description: string | null;
  snapEbtReported: boolean;
  category: string;
  categorySlug: string;
  iconEmoji: string | null;
}

interface CityResponse {
  city: string;
  state: string | null;
  citySlug: string;
  categories: Array<{ category: string; slug: string; iconEmoji: string | null; places: PlaceResult[] }>;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  enrichment?: LocationEnrichmentResponse | null;
}

class PlacesCityService extends PublicApiSingleton {
  private static instance: PlacesCityService;
  private constructor() { super('places-city', { ttl: 0 }); }
  static getInstance() {
    if (!PlacesCityService.instance) PlacesCityService.instance = new PlacesCityService();
    return PlacesCityService.instance;
  }

  async getCity(citySlug: string, params: { sort?: string; page?: number }): Promise<CityResponse | null> {
    const qs = new URLSearchParams();
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    qs.set('perPage', '24');

    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/places/city/${encodeURIComponent(citySlug)}?${qs.toString()}`,
        { method: 'GET' },
        undefined,
        0,
      );
      const data = result.data?.data ?? result.data;
      return data as CityResponse;
    } catch {
      return null;
    }
  }
}

const cityService = PlacesCityService.getInstance();

interface PlaceCityClientProps {
  citySlug: string;
  marketIntelTeaser?: CityMarketIntelTeaser | null;
  enrichment?: LocationEnrichmentResponse | null;
}

export default function PlaceCityClient({ citySlug: citySlugProp, marketIntelTeaser, enrichment: enrichmentProp }: PlaceCityClientProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const citySlug = citySlugProp || (params?.citySlug as string) || '';

  const sort = searchParams.get('sort') || 'name';
  const page = parseInt(searchParams.get('page') || '1');

  const [data, setData] = useState<CityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await cityService.getCity(citySlug, { sort, page });
    setData(result);
    setLoading(false);
  }, [citySlug, sort, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateParam = (key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value); else sp.delete(key);
    if (key !== 'page') sp.delete('page');
    router.push(`/place/city/${citySlug}?${sp.toString()}`);
  };

  // Keep the shelf sections for scanability/SEO, but render each business as a
  // full card only once — its first shelf — and as a compact row on the shelves
  // that follow (see buildShelfSections).
  const shelfSections = useMemo(
    () => (data ? buildShelfSections(data.categories) : []),
    [data],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">No Places Found</h1>
          <p className="text-neutral-600 mb-4">We don&apos;t have any listings in this city yet.</p>
          <Link href="/place" className="text-blue-600 hover:underline">← Browse all places</Link>
        </div>
      </div>
    );
  }

  // The packet embeds in the city response — the prop is the server-fetched
  // copy (page.tsx) for the same row, so either source renders identically.
  const enrichment = data.enrichment ?? enrichmentProp ?? null;
  const locationName = data.state ? `${data.city}, ${data.state}` : data.city;
  const topCategories = enrichment?.topCategories ?? [];

  const jsonLd = enrichment
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: enrichment.effective.metaTitle || `Places in ${locationName}`,
        description: enrichment.effective.description,
        url:
          typeof window !== 'undefined'
            ? window.location.href
            : `https://visibleshelf.com/place/city/${citySlug}`,
      }
    : null;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Seed city shelf browse event (Layer 2 surface: 'place') — mirrors
          /directory/location's LocationBrowseTracker. */}
      <LocationBrowseTracker
        location={citySlug}
        city={data.city}
        state={data.state || enrichment?.market?.state || data.categories.flatMap((c) => c.places)[0]?.state || ''}
        locationName={data.city}
        surface="place"
        filterSignature={sort}
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Header — breadcrumb + title + packet intro, matching the
          /place/category and /directory/location header pattern. */}
      <div className="bg-white border-b border-neutral-200">
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
                <p className="text-sm text-neutral-600 mt-1">
                  {data.total} business{data.total !== 1 ? 'es' : ''} listed from public information
                </p>
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

          {/* Location enrichment packet — seed-shelf intro copy from the same
              ('__location__', city, state) row /directory/location renders. */}
          {enrichment?.effective?.description && (
            <div className="mt-6 max-w-3xl rounded-xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                Overview
              </p>
              <p className="text-neutral-700 leading-relaxed">{enrichment.effective.description}</p>
            </div>
          )}

          {topCategories.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-neutral-500 mb-2">Top categories in {data.city}</p>
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

      {/* Listings */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {data.total === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              No Places in {locationName} Yet
            </h2>
            <p className="text-neutral-600 mb-6">
              We don&apos;t have any published listings in this city yet.
            </p>
            <Link href="/place" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Browse all places
            </Link>
          </div>
        ) : (
          <>
            {/* Sort */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-neutral-500">Sort:</span>
              <select
                value={sort}
                onChange={(e) => updateParam('sort', e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white"
              >
                <option value="name">Name (A-Z)</option>
                <option value="recent">Recently Added</option>
                <option value="snap">SNAP/EBT First</option>
              </select>
            </div>

            {/* Shelf quick-nav chips — each links to its category shelf. */}
            {data.categories.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {data.categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/place/category/${c.slug}?city=${encodeURIComponent(data.city)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-neutral-200 rounded-full text-sm hover:bg-neutral-50"
                  >
                    {c.iconEmoji && <span>{c.iconEmoji}</span>}
                    <span>{c.category}</span>
                    <span className="text-neutral-400">({c.places.length})</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Listings grouped by shelf, each business carded once. */}
            <div className="space-y-10">
              {shelfSections.map((cat) => (
                <section key={cat.slug} id={`shelf-${cat.slug}`}>
                  <div className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 className="text-xl font-semibold text-neutral-900">
                      {cat.iconEmoji && <span className="mr-2">{cat.iconEmoji}</span>}
                      {cat.category}
                    </h2>
                    <Link
                      href={`/place/category/${cat.slug}?city=${encodeURIComponent(data.city)}`}
                      className="inline-flex items-center text-sm text-blue-600 hover:underline flex-shrink-0"
                    >
                      View shelf
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </div>

                  {cat.fresh.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cat.fresh.map((p) => (
                        <CityPlaceCard key={p.id} place={p} citySlug={citySlug} />
                      ))}
                    </div>
                  )}

                  {cat.repeats.length > 0 && (
                    <ul className={`divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white ${cat.fresh.length > 0 ? 'mt-3' : ''}`}>
                      {cat.repeats.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/place/${p.slug}?shelf=place/city/${encodeURIComponent(citySlug)}`}
                            onClick={() => reportShelfListingClick(`place/city/${citySlug}`)}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-neutral-50"
                          >
                            <span className="min-w-0">
                              <span className="font-medium text-neutral-900">{p.businessName}</span>
                              {p.address && (
                                <span className="text-neutral-500"> — {p.address}</span>
                              )}
                            </span>
                            <span className="text-xs text-neutral-400 flex-shrink-0">Listed above</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            {/* Info banner */}
            <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">
                    About These Listings
                  </h3>
                  <p className="text-sm text-blue-700">
                    Places listed here are sourced from public information (address, phone,
                    and publicly available data). They are not claimed profiles. If you own
                    one of these businesses, claim it free to fix your details, add photos,
                    and showcase 5 top sellers from your own dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {page > 1 && (
                  <button
                    onClick={() => updateParam('page', String(page - 1))}
                    className="px-3 py-2 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50"
                  >
                    ← Prev
                  </button>
                )}
                <span className="text-sm text-neutral-600">
                  Page {page} of {data.totalPages}
                </span>
                {page < data.totalPages && (
                  <button
                    onClick={() => updateParam('page', String(page + 1))}
                    className="px-3 py-2 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50"
                  >
                    Next →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Market Intel sidebar (§12.3) — server-rendered teaser for SEO. */}
      <MarketIntelSurfaceSidebar
        surfaceType="city"
        surfaceKey={citySlug}
        initialTeaser={marketIntelTeaser}
      />
    </div>
  );
}

// ====================
// CityPlaceCard — compact card for the seed city shelf
// ====================

function CityPlaceCard({ place, citySlug }: { place: PlaceResult; citySlug: string }) {
  const shelfRef = `place/city/${citySlug}`;
  const fullAddress = [place.address, place.city, place.state].filter(Boolean).join(', ');

  return (
    <Link
      href={`/place/${place.slug}?shelf=${encodeURIComponent(shelfRef)}`}
      onClick={() => reportShelfListingClick(shelfRef)}
      className="block bg-white border border-neutral-200 rounded-xl p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-neutral-900 truncate">{place.businessName}</h3>
        {place.snapEbtReported && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">
            <ShoppingBasket className="w-3 h-3" />
            SNAP/EBT
          </span>
        )}
      </div>

      {place.description && (
        <p className="text-sm text-neutral-600 line-clamp-2 mb-2">{place.description}</p>
      )}

      <div className="space-y-1 text-sm text-neutral-600">
        {fullAddress && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{fullAddress}</span>
          </div>
        )}
        {place.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{place.phone}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
