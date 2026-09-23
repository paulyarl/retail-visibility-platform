import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Info } from 'lucide-react';
import { DirectoryGrid } from '@/components/directory/DirectoryGrid';
import { BreadcrumbStructuredData } from '@/components/directory/StructuredData';
import SuggestBusinessCta from '@/components/directory/SuggestBusinessCta';
import AddBusinessCta from '@/components/directory/AddBusinessCta';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { MarketIntelSurfaceSidebar } from '@/components/place/MarketIntelSurfaceSidebar';
import { MarketIntelBanner } from '@/components/place/MarketIntelBanner';
import { recommendationsService } from '@/services/RecommendationsSingletonService';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import marketIntelSurfaceService from '@/services/MarketIntelSurfaceService';
import LocationBrowseTracker from '@/components/tracking/LocationBrowseTracker';
import { stripStaleBusinessCount } from '@/lib/strip-stale-business-count';
import { clientLogger } from '@/lib/client-logger';

interface LocationPageProps {
  params: Promise<{
    location: string; // Format: "city-state" e.g., "brooklyn-ny"
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

// Parse location slug into city and state
function parseLocation(locationSlug: string): { city: string; state: string } | null {
  const parts = locationSlug.split('-');
  if (parts.length < 2) return null;
  
  // Last part is state, everything else is city
  const state = parts[parts.length - 1].toUpperCase();
  const city = parts.slice(0, -1).join(' ');
  
  return {
    city: city.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    state,
  };
}

// Format location for display
function formatLocation(city: string, state: string): string {
  return `${city}, ${state}`;
}

async function getLocationListings(city: string, state: string, page: number = 1) {
  const limit = 12;
  
  try {
    return await recommendationsService.searchByLocation(city, state, page, limit);
  } catch (error) {
    clientLogger.error('Error fetching location listings:', { detail: error });
    return null;
  }
}

// Get nearby locations for suggestions
async function getNearbyLocations(currentCity: string, currentState: string) {
  try {
    const data = await recommendationsService.getLocations();
    
    if (!data) return [];
    
    // Filter out current location and limit to 6
    return data.locations
      .filter((loc: any) => 
        loc.city.toLowerCase() !== currentCity.toLowerCase() || 
        loc.state.toLowerCase() !== currentState.toLowerCase()
      )
      .slice(0, 6);
  } catch (error) {
    clientLogger.error('Error fetching nearby locations:', { detail: error });
    return [];
  }
}

export async function generateMetadata({ params }: LocationPageProps): Promise<Metadata> {
  const { location } = await params;
  const parsed = parseLocation(location);

  if (!parsed) {
    return {
      title: 'Location Not Found',
    };
  }

  const locationName = formatLocation(parsed.city, parsed.state);
  const enrichment = await placesBrowsePublicService.getLocationEnrichment(parsed.city, parsed.state);

  // Legacy packets bake a listing count that goes stale ("0 Businesses in …") —
  // normalize so the SERP never carries a count that can't reflect actual.
  const title = stripStaleBusinessCount(enrichment?.effective?.metaTitle)
    || `Local Businesses in ${locationName} - Business Directory`;
  const description = stripStaleBusinessCount(enrichment?.effective?.description)
    || `Discover local businesses, shops, and services in ${locationName}. Find stores, restaurants, and more in your area.`;
  const keywords = enrichment?.effective?.keywords?.join(', ');

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function LocationPage({ params, searchParams }: LocationPageProps) {
  const { location } = await params;
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  
  const parsed = parseLocation(location);

  if (!parsed) {
    notFound();
  }

  const { city, state } = parsed;
  const locationName = formatLocation(city, state);

  const [data, nearbyLocations, enrichment, marketIntelTeaser] = await Promise.all([
    getLocationListings(city, state, page),
    getNearbyLocations(city, state),
    placesBrowsePublicService.getLocationEnrichment(city, state),
    // City teaser takes the "{city}-{state}" slug — same format as this route.
    marketIntelSurfaceService.getCityTeaser(location).catch(() => null),
  ]);

  const effectiveDescription = enrichment?.effective?.description;
  const bodyCopy = enrichment?.bodyCopy;
  const topCategories = enrichment?.topCategories || [];
  const shopperGuide = enrichment?.shopperGuide;
  const faq = enrichment?.faq || [];
  const areaBreakdown = enrichment?.areaBreakdown || [];
  const metroContext = enrichment?.context?.metro_context;

  // The packet narrative leads the hero (mirrors the place city shelf); the
  // meta description is only a fallback.
  const overview = stripStaleBusinessCount(bodyCopy || effectiveDescription || null);

  const hasEnrichmentContent = Boolean(
    shopperGuide || faq.length > 0 || areaBreakdown.length > 0 || metroContext,
  );

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Failed to load location listings</p>
          <Link href="/directory" className="text-blue-600 hover:text-blue-700 mt-4 inline-block">
            Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || process.env.WEB_URL || 'http://localhost:3000';
  const currentUrl = `${baseUrl}/directory/location/${location}`;

  return (
    <>
      {/* Structured Data */}
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: baseUrl },
          { name: 'Directory', url: `${baseUrl}/directory` },
          { name: locationName, url: currentUrl },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <LocationBrowseTracker
          location={location}
          city={city}
          state={state}
          locationName={locationName}
          surface="directory"
        />

        {/* Hero — breadcrumb + title + packet overview, matching the place
            city shelf header. */}
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
              <Link href="/directory" className="hover:text-neutral-700">Directory</Link>
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
                    Businesses in {locationName}
                  </h1>
                  {data.pagination.totalItems > 0 && (
                    <p className="text-sm text-neutral-600 mt-1">
                      {data.pagination.totalItems} local {data.pagination.totalItems === 1 ? 'business' : 'businesses'} listed from public information
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/directory"
                className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                All locations
              </Link>
            </div>

            {/* Packet overview — held in its own container so the copy reads as
                a distinct block rather than trailing the title. */}
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
                <p className="text-sm text-neutral-500 mb-2">Top categories in {locationName}</p>
                <div className="flex flex-wrap gap-2 max-w-3xl">
                  {topCategories.slice(0, 8).map((category: string) => (
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Listings + tall-banner rail. The rail holds the 300x600 report
              slot (sticky on desktop) fed by the city teaser; the collapsible
              Market Intel panel below then shows cards only. */}
          <div className="lg:flex lg:gap-8">
            <div className="min-w-0 flex-1">
          {data.listings.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-900 mb-2">
                No businesses found in {locationName}
              </h3>
              <p className="text-neutral-600 mb-6">
                Check back soon as new businesses join our directory.
              </p>
              <Link
                href="/directory"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse All Locations
              </Link>
            </div>
          ) : (
            <DirectoryGrid
              listings={data.listings}
              pagination={data.pagination}
              baseUrl="/directory/location"
              categorySlug={location}
              shelfRef={`directory/location/${location}`}
            />
          )}
            </div>

            <aside className="mt-8 shrink-0 lg:mt-0 lg:w-[336px]">
              <div className="lg:sticky lg:top-6">
                <MarketIntelBanner
                  variant="tall"
                  surfaceType="city"
                  teaser={marketIntelTeaser}
                />
              </div>
            </aside>
          </div>

          {/* Square banner slot (300x250) — in-flow placement below the grid. */}
          {data.listings.length > 0 && (
            <div className="mt-10 flex justify-center">
              <MarketIntelBanner
                variant="square"
                surfaceType="city"
                teaser={marketIntelTeaser}
              />
            </div>
          )}

          {/* Info banner */}
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  About These Listings
                </h3>
                <p className="text-sm text-blue-700">
                  Businesses listed here are sourced from public information (address, phone,
                  and publicly available data). They are not claimed profiles. If you own one of
                  these businesses, claim it free to fix your details, add photos, and showcase
                  5 top sellers from your own dashboard.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <AddBusinessCta
              city={city}
              state={state}
              source={`/directory/location/${location}`}
            />
            <SuggestBusinessCta
              city={city}
              state={state}
              source={`/directory/location/${location}`}
            />
          </div>
        </div>

        {/* Enrichment Content: Shopper Guide + Areas + Metro + FAQ. Rendered
            whenever the packet carries copy — not gated on the listing count,
            so a thin market still gets its SEO narrative. */}
        {hasEnrichmentContent && (
          <div className="bg-neutral-100 border-t border-neutral-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
              {/* Shopper Guide */}
              {shopperGuide && (
                <section className="max-w-3xl rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-3">
                    Shopping in {locationName}
                  </h2>
                  <p className="text-neutral-700 leading-relaxed whitespace-pre-line">{shopperGuide}</p>
                </section>
              )}

              {/* Browse by Area */}
              {areaBreakdown.length > 0 && (
                <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-3">
                    Browse by Area
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {areaBreakdown.map((area, idx) => (
                      <div key={idx} className="rounded-lg p-4 border border-neutral-200 bg-neutral-50">
                        <h3 className="font-semibold text-neutral-900 mb-1">{area.area_name}</h3>
                        <p className="text-sm text-neutral-600 mb-2">{area.description}</p>
                        {area.strong_categories && area.strong_categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {area.strong_categories.map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white text-neutral-700 border border-neutral-200"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Metro Area */}
              {metroContext && (
                <section className="max-w-3xl rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-3">
                    Metro Area
                  </h2>
                  <p className="text-neutral-700 leading-relaxed whitespace-pre-line">{metroContext}</p>
                </section>
              )}

              {/* FAQ */}
              {faq.length > 0 && (
                <section className="max-w-3xl rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-1">
                    Frequently Asked Questions
                  </h2>
                  <div className="divide-y divide-neutral-200">
                    {faq.map((item, idx) => (
                      <div key={idx} className="py-4 last:pb-0">
                        <h3 className="font-semibold text-neutral-900 mb-1">{item.question}</h3>
                        <p className="text-neutral-700 text-sm leading-relaxed">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                  {/* FAQ Schema */}
                  <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                      __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'FAQPage',
                        mainEntity: faq.map((item) => ({
                          '@type': 'Question',
                          name: item.question,
                          acceptedAnswer: {
                            '@type': 'Answer',
                            text: item.answer,
                          },
                        })),
                      }),
                    }}
                  />
                </section>
              )}
            </div>
          </div>
        )}

        {/* Nearby Locations */}
        {data.listings.length > 0 && nearbyLocations.length > 0 && (
          <div className="bg-white border-t border-neutral-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                Browse Nearby Locations
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {nearbyLocations.map((loc: any) => {
                  const slug = `${loc.city.toLowerCase().replace(/\s+/g, '-')}-${loc.state.toLowerCase()}`;
                  return (
                    <Link
                      key={slug}
                      href={`/directory/location/${slug}`}
                      className="flex flex-col items-center p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                    >
                      <MapPin className="w-8 h-8 text-green-600 mb-2" />
                      <span className="text-sm font-medium text-neutral-900 text-center">
                        {loc.city}, {loc.state}
                      </span>
                      <span className="text-xs text-neutral-600 mt-1">
                        {loc.count} {loc.count === 1 ? 'business' : 'businesses'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <PoweredByFooter />

        {/* Market Intel sidebar (§12.3) — city teaser cards. showBanner=false:
            the tall slot already lives in the right rail, so the panel carries
            only the intelligence cards (one tall slot per page). The citySlug
            is the "{city}-{state}" slug the teaser route parses. */}
        <MarketIntelSurfaceSidebar
          surfaceType="city"
          surfaceKey={location}
          initialTeaser={marketIntelTeaser}
          showBanner={false}
        />
      </div>
    </>
  );
}
