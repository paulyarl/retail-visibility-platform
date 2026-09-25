'use client';

import { useEffect, useState } from 'react';
import { Map, Grid3x3, List, ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import DirectorySearch from '@/components/directory/DirectorySearch';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import { DirectoryGrid } from '@/components/directory/DirectoryGrid';
import { DirectoryList } from '@/components/directory/DirectoryList';
import { Pagination } from '@/components/ui';
import { Button } from '@mantine/core';
import { useSearchParams } from 'next/navigation';
import { slugsMatch } from '@/utils/slug';
import SuggestBusinessCta from '@/components/directory/SuggestBusinessCta';
import AddBusinessCta from '@/components/directory/AddBusinessCta';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import dynamic from 'next/dynamic';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import CategoryBrowseTracker from '@/components/tracking/CategoryBrowseTracker';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { MarketIntelSurfaceSidebar } from '@/components/place/MarketIntelSurfaceSidebar';
import { MarketIntelBanner } from '@/components/place/MarketIntelBanner';
import type { CategoryMarketIntelTeaser } from '@/services/MarketIntelSurfaceService';
import { recommendationsService } from '@/services/RecommendationsSingletonService';
import placesBrowsePublicService, { CategoryEnrichmentResponse } from '@/services/PlacesBrowsePublicService';
import { resolveDirectoryShelfForLabel, directoryShelfHrefFor, type DirectoryShelfIndexEntry } from '@/lib/directory-shelves';
import { clientLogger } from '@/lib/client-logger';

// Dynamically import Google Maps to avoid SSR issues
const DirectoryMapGoogle = dynamic(() => import('@/components/directory/DirectoryMapGoogle'), {
  ssr: false,
  loading: () => <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">Loading map...</div>
});

interface DirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  primaryCategory?: string;
  gbpPrimaryCategoryName?: string;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  isFeatured: boolean;
  subscriptionTier: string;
  useCustomWebsite: boolean;
  website?: string;
  distance?: number;
  isOpen?: boolean;
  isDemo?: boolean;
  demoExpiresAt?: string | null;
}

interface DirectoryResponse {
  listings: DirectoryListing[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  storeCount: number;
  primaryStoreCount?: number;
  secondaryStoreCount?: number;
  productCount: number;
}

interface CategoryViewClientProps {
  categorySlug: string;
  searchParams: {
    lat?: string;
    lng?: string;
    radius?: string;
    search?: string;
  };
  /** Server-rendered national category teaser — feeds the report banner +
      Market Intel panel (§12.3). */
  marketIntelTeaser?: CategoryMarketIntelTeaser | null;
}

export default function CategoryViewClient({
  categorySlug,
  searchParams,
  marketIntelTeaser,
}: CategoryViewClientProps) {
  const { settings } = usePlatformSettings();
  const [data, setData] = useState<DirectoryResponse | null>(null);
  // console.log(`CategoryViewClient: ${categorySlug}`, data);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  // National ('__all__') category enrichment packet — written by a
  // directory_enrichment campaign; renders as the page description when present.
  const [enrichment, setEnrichment] = useState<CategoryEnrichmentResponse | null>(null);
  // Live directory shelf index (MV-backed: only categories holding published
  // listings) — resolves enrichment taxonomy labels to hot shelf links.
  const [shelfIndex, setShelfIndex] = useState<DirectoryShelfIndexEntry[]>([]);
  
  // Persist view mode in localStorage - start with default to avoid hydration mismatch
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');

  // Load saved view mode after hydration
  useEffect(() => {
    const saved = localStorage.getItem('directory-view-mode');
    if (saved && ['grid', 'list', 'map'].includes(saved)) {
      setViewMode(saved as 'grid' | 'list' | 'map');
    }
  }, []);

  // Save view mode to localStorage when it changes
  const handleViewModeChange = (mode: 'grid' | 'list' | 'map') => {
    setViewMode(mode);
    localStorage.setItem('directory-view-mode', mode);
  };
  
  // Helper to format slug into readable name
  const formatCategoryName = (slug: string) => {
    return decodeURIComponent(slug)
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Fetch category info and stores
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        
        // Decode URL-encoded slug (e.g., health-%26-beauty -> health-&-beauty)
        const decodedSlug = decodeURIComponent(categorySlug);

        // 1. Fetch category info from directory categories API (+ the
        //    MV-backed shelf index for related-category hot links)
        const [catData, mvCatData] = await Promise.all([
          recommendationsService.getDirectoryCategories(),
          recommendationsService.getDirectoryMVCategories(),
        ]);
        setShelfIndex(mvCatData?.categories ?? []);
        if (catData) {
          // Use centralized slug matching for robust comparison
          const currentCat = catData.categories?.find((c: any) => 
            slugsMatch(c.slug, decodedSlug)
          );
          if (currentCat) {
            setCategory({
              id: currentCat.id,
              name: currentCat.name,
              slug: currentCat.slug,
              googleCategoryId: currentCat.google_category_id,
              storeCount: currentCat.store_count,
              primaryStoreCount: currentCat.primary_store_count || 0,
              secondaryStoreCount: currentCat.secondary_store_count || 0,
              productCount: currentCat.total_products,
            });
          }
        }

        // 2. Fetch stores in this category using directory categories API
        //    (+ the national enrichment packet in parallel — best-effort)
        const [storesData, enrichmentData] = await Promise.all([
          recommendationsService.getStoresByCategory(decodedSlug),
          placesBrowsePublicService.getCategoryEnrichment(decodedSlug, '__all__'),
        ]);
        setEnrichment(enrichmentData);

        if (!storesData) {
          throw new Error('Failed to fetch stores');
        }

        // 3. Transform to DirectoryResponse format (categories API returns stores directly)
        setData({
          listings: storesData.stores || [],
          pagination: storesData.pagination || {
            page: 1,
            limit: 12,
            totalItems: 0,
            totalPages: 1,
          },
        });
      } catch (err) {
        clientLogger.error('Error fetching category data:', { detail: err });
        setError('Failed to load category. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [categorySlug, searchParams.lat, searchParams.lng, searchParams.radius]);

  const currentPage = data?.pagination.page || 1;
  const totalPages = data?.pagination.totalPages || 1;
  const totalItems = data?.pagination.totalItems || 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Client-side category tracking */}
      <CategoryBrowseTracker
        categoryId={category?.id || categorySlug}
        categorySlug={categorySlug}
        categoryName={category?.name}
        pageType="directory_category"
        surface="directory"
        filterSignature={searchParams.toString()}
      />

      {/* Page Title Section */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <nav className="mb-3 text-sm flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <Link href="/directory" className="hover:text-blue-600 dark:hover:text-blue-400">
              Directory
            </Link>
            <span>›</span>
            <span className="font-semibold text-neutral-900 dark:text-white">{category?.name || formatCategoryName(categorySlug)}</span>
          </nav>

          {/* Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{category?.name || formatCategoryName(categorySlug)}</h1>
              <span className="text-2xl">🏷️</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/directory/categories"
                className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">All Categories</span>
              </Link>
              <Link
                href="/directory"
                className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm">
            <p className="text-neutral-600 dark:text-neutral-400">
              {totalItems} {totalItems === 1 ? 'store' : 'stores'} · {category?.productCount || 0} products
            </p>
          </div>

          {/* Page intro — held in its own panel so the shelf copy reads as a
              distinct block rather than trailing the title. */}
          {(enrichment?.bodyCopy || enrichment?.effective?.description) && (
            <div className="mt-5 max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
                Overview
              </p>
              <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                {enrichment?.bodyCopy ?? enrichment?.effective?.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="container mx-auto px-4 py-4">
          <DirectorySearch />
        </div>
      </div>

      {/* Filters - Category is locked */}
      <DirectoryFilters
        categories={[]} // Hide category filter since we're IN a category
        locations={[]}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Results Header with View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-neutral-600 dark:text-neutral-400">
              {loading ? 'Loading...' : `Showing ${totalItems} ${totalItems === 1 ? 'store' : 'stores'}`}
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => handleViewModeChange('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'map'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
        </div>

        {/* Listings + tall-banner rail. The rail holds the 300x600 report
            slot (sticky on desktop) fed by the category teaser; the
            collapsible Market Intel panel below then shows cards only. */}
        <div className="lg:flex lg:gap-8">
          <div className="min-w-0 flex-1">
        {/* Views - REUSE EXACT COMPONENTS */}
        {viewMode === 'grid' && (
          <DirectoryGrid
            listings={data?.listings || []}
            loading={loading}
            pagination={data?.pagination}
            baseUrl="/directory/categories"
            categorySlug={categorySlug}
            shelfRef={`directory/category/${categorySlug}`}
          />
        )}

        {viewMode === 'list' && (
          <DirectoryList
            listings={data?.listings || []}
            loading={loading}
            shelfRef={`directory/category/${categorySlug}`}
          />
        )}

        {viewMode === 'map' && (
          <>
            {/* {console.log('[CategoryViewClient] Map listings:', data?.listings?.slice(0, 3)?.map(l => ({ id: l.id, businessName: l.businessName, logoUrl: l.logoUrl })))} */}
            <DirectoryMapGoogle
              listings={data?.listings || []} // Use the already-filtered listings
              useMapEndpoint={false} // Don't use the endpoint to avoid data sync issues
              filters={{}}
              shelfRef={`directory/category/${categorySlug}`}
            />
          </>
        )}
          </div>

          <aside className="mt-8 shrink-0 lg:mt-0 lg:w-[336px]">
            <div className="lg:sticky lg:top-6">
              <MarketIntelBanner
                variant="tall"
                surfaceType="category"
                teaser={marketIntelTeaser}
              />
            </div>
          </aside>
        </div>

        {/* Square banner slot (300x250) — in-feed placement at the end of the
            listing views, before the enrichment band. */}
        {totalItems > 0 && (
          <div className="mt-10 flex justify-center">
            <MarketIntelBanner
              variant="square"
              surfaceType="category"
              teaser={marketIntelTeaser}
            />
          </div>
        )}
      </div>

      {/* Enrichment Content: About + Shopper Guide + Hierarchy + FAQ */}
      {(enrichment?.shopperGuide ||
        enrichment?.context?.category_overview ||
        (enrichment?.context?.sub_categories && enrichment.context.sub_categories.length > 0) ||
        (enrichment?.context?.adjacent_categories && enrichment.context.adjacent_categories.length > 0) ||
        (enrichment?.faq && enrichment.faq.length > 0)) && (
        <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
          <div className="container mx-auto px-4 py-12 space-y-6">
            {/* About this category */}
            {enrichment?.context?.category_overview && (
              <section className="max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                  About {category?.name || 'this category'}
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {enrichment.context.category_overview}
                </p>
              </section>
            )}

            {/* Shopper Guide */}
            {enrichment?.shopperGuide && (
              <section className="max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                  What to Look For
                </h2>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {enrichment.shopperGuide}
                </p>
              </section>
            )}

            {/* FAQ */}
            {enrichment?.faq && enrichment.faq.length > 0 && (
              <section className="max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                  Frequently Asked Questions
                </h2>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {enrichment.faq.map((item, idx) => (
                    <div key={idx} className="py-4 last:pb-0">
                      <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">{item.question}</h3>
                      <p className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">{item.answer}</p>
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
                      mainEntity: enrichment.faq.map((item) => ({
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

            {/* Sub-categories */}
            {enrichment?.context?.sub_categories && enrichment.context.sub_categories.length > 0 && (
              <section className="max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                  Browse {category?.name || 'this category'} by Type
                </h2>
                <div className="flex flex-wrap gap-2">
                  {enrichment.context.sub_categories.map((sub) => (
                    <DirectoryShelfChip key={sub} label={sub} shelves={shelfIndex} />
                  ))}
                </div>
              </section>
            )}

            {/* Related categories */}
            {enrichment?.context?.adjacent_categories && enrichment.context.adjacent_categories.length > 0 && (
              <section className="max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                  Related Categories
                </h2>
                <div className="flex flex-wrap gap-2">
                  {enrichment.context.adjacent_categories.map((adj) => (
                    <DirectoryShelfChip key={adj} label={adj} shelves={shelfIndex} />
                  ))}
                </div>
              </section>
            )}

            {/* Secondary categories — overlapping shelves this category is filed under */}
            {enrichment?.effective?.secondaryCategories && enrichment.effective.secondaryCategories.length > 0 && (
              <section className="max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                  Also Filed Under
                </h2>
                <div className="flex flex-wrap gap-2">
                  {enrichment.effective.secondaryCategories.map((label) => (
                    <DirectoryShelfChip key={label} label={label} shelves={shelfIndex} />
                  ))}
                </div>
              </section>
            )}

            {/* Super categories — broader parent shelves */}
            {enrichment?.context?.super_categories && enrichment.context.super_categories.length > 0 && (
              <section className="max-w-3xl rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                  Broader Categories
                </h2>
                <div className="flex flex-wrap gap-2">
                  {enrichment.context.super_categories.map((label) => (
                    <DirectoryShelfChip key={label} label={label} shelves={shelfIndex} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Add / Suggest CTAs — footer material, directly above the platform footer. */}
      <div className="container mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <AddBusinessCta
          category={category?.name || categorySlug}
          source={`/directory/categories/${categorySlug}`}
        />
        <SuggestBusinessCta
          category={category?.name || categorySlug}
          source={`/directory/categories/${categorySlug}`}
        />
      </div>

                  {/* Platform Branding Footer */}
                  <PoweredByFooter />

      {/* Market Intel sidebar (§12.3) — national category teaser cards.
          showBanner=false: the tall slot already lives in the right rail, so
          the panel carries only the intelligence cards (one tall slot/page). */}
      <MarketIntelSurfaceSidebar
        surfaceType="category"
        surfaceKey={categorySlug}
        city="__all__"
        state={null}
        initialTeaser={marketIntelTeaser}
        showBanner={false}
      />
    </div>
  );
}

// ====================
// DirectoryShelfChip — enrichment taxonomy label that links to its live
// directory shelf when one exists (mirrors ShelfChip on the /place surface)
// ====================

function DirectoryShelfChip({
  label,
  shelves,
}: {
  label: string;
  shelves: DirectoryShelfIndexEntry[];
}) {
  const shelf = resolveDirectoryShelfForLabel(label, shelves);
  const base =
    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-300';

  if (!shelf) {
    return <span className={base}>{label}</span>;
  }

  return (
    <Link
      href={directoryShelfHrefFor(shelf.slug)}
      className={`${base} hover:border-blue-300 hover:text-blue-700 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-colors`}
    >
      {label}
      <span className="text-xs text-neutral-400 dark:text-neutral-500">{shelf.count}</span>
    </Link>
  );
}
