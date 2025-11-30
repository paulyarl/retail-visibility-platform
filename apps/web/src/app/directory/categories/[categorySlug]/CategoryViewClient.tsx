'use client';

import { useEffect, useState } from 'react';
import { Map, Grid3x3, List, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DirectorySearch from '@/components/directory/DirectorySearch';
import DirectoryGrid from '@/components/directory/DirectoryGrid';
import DirectoryList from '@/components/directory/DirectoryList';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import dynamic from 'next/dynamic';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

// Dynamically import map to avoid SSR issues
const DirectoryMap = dynamic(() => import('@/components/directory/DirectoryMap'), {
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
  phone?: string;
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
}

export default function CategoryViewClient({
  categorySlug,
  searchParams,
}: CategoryViewClientProps) {
  const { settings } = usePlatformSettings();
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [primaryOnly, setPrimaryOnly] = useState(false);

  // Helper to format slug into readable name
  const formatCategoryName = (slug: string) => {
    return decodeURIComponent(slug)
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Track category page view
  useEffect(() => {
    // Track category browsing when component mounts
    trackBehaviorClient({
      entityType: 'category',
      entityId: categorySlug, // Use slug as ID for now
      entityName: formatCategoryName(categorySlug),
      context: {
        category_slug: categorySlug,
        category_name: formatCategoryName(categorySlug),
        search_params: searchParams,
        view_mode: viewMode
      },
      pageType: 'directory_home'
    });
  }, [categorySlug]); // Only track once when category changes

  // Track view mode changes
  useEffect(() => {
    if (data) { // Only track after data is loaded
      trackBehaviorClient({
        entityType: 'category',
        entityId: categorySlug,
        context: {
          category_slug: categorySlug,
          action: 'view_mode_change',
          view_mode: viewMode,
          stores_count: data.pagination.totalItems,
          primary_only: primaryOnly
        },
        pageType: 'directory_home'
      });
    }
  }, [viewMode, primaryOnly, categorySlug, data]);

  // Track store interactions (clicks, etc.)
  const handleStoreClick = (store: DirectoryListing) => {
    trackBehaviorClient({
      entityType: 'store',
      entityId: store.tenantId,
      entityName: store.businessName,
      context: {
        category_slug: categorySlug,
        source: 'category_page',
        store_rating: store.ratingAvg,
        store_product_count: store.productCount,
        distance: store.distance
      },
      pageType: 'directory_home'
    });
  };

  // Fetch category info and stores
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        
        // Decode URL-encoded slug (e.g., health-%26-beauty -> health-&-beauty)
        const decodedSlug = decodeURIComponent(categorySlug);

        // 1. Fetch category info from materialized view stats (includes Google taxonomy)
        const categoriesRes = await fetch(`${apiBaseUrl}/api/directory/mv/categories`);
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          const currentCat = catData.categories?.find((c: any) => c.slug === decodedSlug);
          if (currentCat) {
            setCategory({
              id: currentCat.id,
              name: currentCat.name,
              slug: currentCat.slug,
              googleCategoryId: currentCat.googleCategoryId,
              storeCount: currentCat.storeCount,
              primaryStoreCount: currentCat.primaryStoreCount,
              secondaryStoreCount: currentCat.secondaryStoreCount,
              productCount: currentCat.totalProducts,
            });
          }
        }

        // 2. Fetch stores in this category using materialized view (10,000x faster!)
        const params = new URLSearchParams();
        params.set('category', decodedSlug); // Use decoded category slug as filter
        params.set('sort', 'rating'); // Sort by rating
        params.set('limit', '100'); // Get up to 100 stores
        if (primaryOnly) {
          params.set('primaryOnly', 'true'); // Filter to primary category stores only
        }
        
        // Location filtering not yet implemented in MV
        // if (searchParams.lat) params.set('lat', searchParams.lat);
        // if (searchParams.lng) params.set('lng', searchParams.lng);
        // if (searchParams.radius) params.set('radius', searchParams.radius);

        const storesRes = await fetch(
          `${apiBaseUrl}/api/directory/mv/search?${params}`
        );

        if (!storesRes.ok) {
          throw new Error('Failed to fetch stores');
        }

        const storesData = await storesRes.json();

        // 3. Transform to DirectoryResponse format (MV already returns correct format)
        setData({
          listings: storesData.listings || [],
          pagination: storesData.pagination || {
            page: 1,
            limit: 100,
            totalItems: 0,
            totalPages: 1,
          },
        });
      } catch (err) {
        console.error('Error fetching category data:', err);
        setError('Failed to load category. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [categorySlug, searchParams.lat, searchParams.lng, searchParams.radius, primaryOnly]);

  const currentPage = data?.pagination.page || 1;
  const totalPages = data?.pagination.totalPages || 1;
  const totalItems = data?.pagination.totalItems || 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
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
            <Link
              href="/directory"
              className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm">
            <p className="text-neutral-600 dark:text-neutral-400">
              {totalItems} {totalItems === 1 ? 'store' : 'stores'} · {category?.productCount || 0} products
            </p>
            
            {/* Primary/Secondary Filter Toggle */}
            {category && category.primaryStoreCount !== undefined && category.secondaryStoreCount !== undefined && (
              <div className="flex items-center gap-2 border-l border-neutral-300 dark:border-neutral-600 pl-4">
                <button
                  onClick={() => setPrimaryOnly(false)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    !primaryOnly
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  All ({category.storeCount})
                </button>
                <button
                  onClick={() => setPrimaryOnly(true)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    primaryOnly
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  Specialized ({category.primaryStoreCount})
                </button>
              </div>
            )}
          </div>
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
              onClick={() => setViewMode('grid')}
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
              onClick={() => setViewMode('list')}
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
              onClick={() => setViewMode('map')}
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

        {/* Views - REUSE EXACT COMPONENTS */}
        {viewMode === 'grid' && (
          <DirectoryGrid
            listings={data?.listings || []}
            loading={loading}
            pagination={data?.pagination}
            categorySlug={categorySlug}
            onStoreClick={handleStoreClick}
          />
        )}

        {viewMode === 'list' && (
          <DirectoryList
            listings={data?.listings || []}
            loading={loading}
            categorySlug={categorySlug}
            onStoreClick={handleStoreClick}
          />
        )}

        {viewMode === 'map' && (
          <DirectoryMap
            listings={data?.listings || []}
            onStoreClick={handleStoreClick}
          />
        )}
      </div>
    </div>
  );
}
