'use client';

import { useEffect, useState } from 'react';
import { Map, Grid3x3, List, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DirectorySearch from '@/components/directory/DirectorySearch';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import { DirectoryGrid } from '@/components/directory/DirectoryGrid';
import { DirectoryList } from '@/components/directory/DirectoryList';
import { Pagination } from '@/components/ui';
import { useSearchParams } from 'next/navigation';
import { slugsMatch } from '@/utils/slug';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import dynamic from 'next/dynamic';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import CategoryBrowseTracker from '@/components/tracking/CategoryBrowseTracker';
import { PoweredByFooter } from '@/components/PoweredByFooter';

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
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        
        // Decode URL-encoded slug (e.g., health-%26-beauty -> health-&-beauty)
        const decodedSlug = decodeURIComponent(categorySlug);

        // 1. Fetch category info from directory categories API
        const categoriesRes = await fetch(`${apiBaseUrl}/api/directory/categories`);
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
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
        const storesRes = await fetch(
          `${apiBaseUrl}/api/directory/mv/categories/${decodedSlug}`
        );

        if (!storesRes.ok) {
          throw new Error('Failed to fetch stores');
        }

        const storesData = await storesRes.json();

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
        console.error('Error fetching category data:', err);
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
      <CategoryBrowseTracker categoryId={category?.id || categorySlug} categorySlug={categorySlug} />

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

        {/* Views - REUSE EXACT COMPONENTS */}
        {viewMode === 'grid' && (
          <DirectoryGrid
            listings={data?.listings || []}
            loading={loading}
            pagination={data?.pagination}
            categorySlug={categorySlug}
          />
        )}

        {viewMode === 'list' && (
          <DirectoryList
            listings={data?.listings || []}
            loading={loading}
          />
        )}

        {viewMode === 'map' && (
          <>
            {console.log('[CategoryViewClient] Map listings:', data?.listings?.slice(0, 3)?.map(l => ({ id: l.id, businessName: l.businessName, logoUrl: l.logoUrl })))}
            <DirectoryMapGoogle
              listings={data?.listings || []} // Use the already-filtered listings
              useMapEndpoint={false} // Don't use the endpoint to avoid data sync issues
              filters={{}}
            />
          </>
        )}
      </div>

                  {/* Platform Branding Footer */}
                  <PoweredByFooter />
    </div>
  );
}
