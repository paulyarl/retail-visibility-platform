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

        // 2. Fetch stores of this type
        const params = new URLSearchParams();
        if (searchParams.lat) params.set('lat', searchParams.lat);
        if (searchParams.lng) params.set('lng', searchParams.lng);
        if (searchParams.radius) params.set('radius', searchParams.radius);

        const storesRes = await fetch(
          `${apiBaseUrl}/api/directory/store-types/${storeTypeSlug}/stores?${params}`
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
            postalCode: store.postalCode,
            latitude: store.latitude,
            longitude: store.longitude,
            productCount: store.productCount,
            primaryCategory: store.storeType,
            // Default values for required fields
            ratingAvg: 0,
            ratingCount: 0,
            isFeatured: false,
            subscriptionTier: 'trial',
            useCustomWebsite: false,
          })),
          pagination: {
            page: 1,
            limit: stores.length,
            totalItems: stores.length,
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
      {/* Hero Section - Green theme for store types */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white">
        <div className="container mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="mb-4 text-sm flex items-center gap-2">
            <Link href="/directory" className="hover:underline opacity-90">
              Directory
            </Link>
            <span className="opacity-60">›</span>
            <span className="font-semibold">{displayName}</span>
          </nav>

          {/* Title */}
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold">{displayName}</h1>
            <span className="text-2xl">🏪</span>
          </div>

          <p className="text-xl opacity-90 mb-6">
            {totalItems} {totalItems === 1 ? 'store' : 'stores'}
            {storeType?.productCount && ` · ${storeType.productCount} products`}
          </p>

          {/* Back Button */}
          <Link
            href="/directory"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </Link>
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
          />
        )}

        {viewMode === 'list' && (
          <DirectoryList
            listings={data?.listings || []}
            loading={loading}
          />
        )}

        {viewMode === 'map' && (
          <DirectoryMap
            listings={data?.listings || []}
          />
        )}
      </div>
    </div>
  );
}
