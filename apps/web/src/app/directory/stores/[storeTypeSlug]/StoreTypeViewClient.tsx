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

interface StoreType {
  name: string;
  slug: string;
  storeCount: number;
  productCount?: number;
}

interface StoreTypeViewClientProps {
  storeTypeSlug: string;
  searchParams: {
    lat?: string;
    lng?: string;
    radius?: string;
    search?: string;
  };
}

export default function StoreTypeViewClient({
  storeTypeSlug,
  searchParams,
}: StoreTypeViewClientProps) {
  const { settings } = usePlatformSettings();
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeType, setStoreType] = useState<StoreType | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');

  // Track store type page view
  useEffect(() => {
    // Track store type browsing when component mounts
    const formatStoreTypeName = (slug: string) => {
      return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    trackBehaviorClient({
      entityType: 'category', // Use category for store types (they're similar)
      entityId: storeTypeSlug,
      entityName: formatStoreTypeName(storeTypeSlug),
      context: {
        store_type_slug: storeTypeSlug,
        store_type_name: formatStoreTypeName(storeTypeSlug),
        search_params: searchParams,
        view_mode: viewMode
      },
      pageType: 'directory_home'
    });
  }, [storeTypeSlug]); // Only track once when store type changes

  // Track view mode changes
  useEffect(() => {
    if (data) { // Only track after data is loaded
      trackBehaviorClient({
        entityType: 'category',
        entityId: storeTypeSlug,
        context: {
          store_type_slug: storeTypeSlug,
          action: 'view_mode_change',
          view_mode: viewMode,
          stores_count: data.pagination.totalItems
        },
        pageType: 'directory_home'
      });
    }
  }, [viewMode, storeTypeSlug, data]);

  // Track store interactions (clicks, etc.)
  const handleStoreClick = (store: DirectoryListing) => {
    trackBehaviorClient({
      entityType: 'store',
      entityId: store.tenantId,
      entityName: store.businessName,
      context: {
        store_type_slug: storeTypeSlug,
        source: 'store_type_page',
        store_rating: store.ratingAvg,
        store_product_count: store.productCount,
        distance: store.distance
      },
      pageType: 'directory_home'
    });
  };

  // Fetch store type info and stores
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

        // 1. Fetch store type details
        const typeRes = await fetch(`${apiBaseUrl}/api/directory/store-types/${storeTypeSlug}`);
        if (typeRes.ok) {
          const typeData = await typeRes.json();
          setStoreType(typeData.data?.storeType || null);
        }

        // 2. Fetch stores of this type using store-types endpoint
        const storesRes = await fetch(
          `${apiBaseUrl}/api/directory/store-types/${storeTypeSlug}/stores`
        );

        if (!storesRes.ok) {
          throw new Error('Failed to fetch stores');
        }

        const storesData = await storesRes.json();

        // 3. Transform to DirectoryResponse format
        const stores = storesData.data?.stores || [];
        setData({
          listings: stores.map((store: any) => ({
            id: store.id,
            tenantId: store.id,
            businessName: store.name,
            slug: store.slug,
            address: store.address,
            city: store.city,
            state: store.state,
            zipCode: store.postalCode,
            latitude: store.latitude,
            longitude: store.longitude,
            productCount: store.productCount || 0,
            primaryCategory: store.primaryCategory,
            gbpPrimaryCategoryName: store.gbpCategoryName,
            logoUrl: store.logoUrl,
            description: store.description,
            ratingAvg: store.ratingAvg || 0,
            ratingCount: store.ratingCount || 0,
            isFeatured: store.isFeatured || false,
            subscriptionTier: store.subscriptionTier || 'trial',
            useCustomWebsite: store.useCustomWebsite || false,
          })),
          pagination: {
            page: 1,
            limit: stores.length,
            totalItems: storesData.data?.totalCount || stores.length,
            totalPages: 1,
          },
        });
      } catch (err) {
        console.error('Error fetching store type data:', err);
        setError('Failed to load store type. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [storeTypeSlug, searchParams.lat, searchParams.lng, searchParams.radius]);

  const currentPage = data?.pagination.page || 1;
  const totalPages = data?.pagination.totalPages || 1;
  const totalItems = data?.pagination.totalItems || 0;

  // Convert slug to display name
  const displayName = storeType?.name || storeTypeSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Page Title Section */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <nav className="mb-3 text-sm flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <Link href="/directory" className="hover:text-green-600 dark:hover:text-green-400">
              Directory
            </Link>
            <span>›</span>
            <span className="font-semibold text-neutral-900 dark:text-white">{displayName}</span>
          </nav>

          {/* Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{displayName}</h1>
              <span className="text-2xl">🏪</span>
            </div>
            <Link
              href="/directory"
              className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>

          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            {totalItems} {totalItems === 1 ? 'store' : 'stores'}
            {storeType?.productCount && ` · ${storeType.productCount} products`}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="container mx-auto px-4 py-4">
          <DirectorySearch />
        </div>
      </div>

      {/* Filters - Store type is locked */}
      <DirectoryFilters
        categories={[]} // Can add product category filters here
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
                  ? 'bg-green-600 text-white'
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
                  ? 'bg-green-600 text-white'
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
                  ? 'bg-green-600 text-white'
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
            categorySlug={storeTypeSlug}
            onStoreClick={handleStoreClick}
          />
        )}

        {viewMode === 'list' && (
          <DirectoryList
            listings={data?.listings || []}
            loading={loading}
            categorySlug={storeTypeSlug}
            onStoreClick={handleStoreClick}
          />
        )}

        {viewMode === 'map' && (
          <DirectoryMap
            listings={data?.listings || []}
            onStoreClick={handleStoreClick}
          />
        )}

        {/* Store Type Recommendations */}
        <StoreTypeRecommendations storeTypeSlug={storeTypeSlug} />
      </div>
    </div>
  );
}

// Store Type Recommendations Component
function StoreTypeRecommendations({ storeTypeSlug }: { storeTypeSlug: string }) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/recommendations/for-directory?storeType=${storeTypeSlug}`);
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } catch (error) {
        console.error('Error fetching store type recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [storeTypeSlug]);

  if (loading || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-8">
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">
        Recommended For You
      </h2>
      <div className="grid gap-4">
        {recommendations.map((rec, index) => (
          <Link
            key={rec.tenantId}
            href={`/directory/${rec.slug}`}
            className="flex items-center justify-between p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-green-500 dark:hover:border-green-400 transition-colors"
          >
            <div className="flex-1">
              <h3 className="font-medium text-neutral-900 dark:text-white">
                {rec.businessName}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {rec.address}
              </p>
              <p className="text-sm text-neutral-500">
                {rec.city}, {rec.state}
                {rec.distance && ` • ${rec.distance} mi`}
              </p>
              <p className="text-xs text-green-600 mt-2 font-medium">
                {rec.reason}
              </p>
            </div>
            <div className="ml-3 shrink-0">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
