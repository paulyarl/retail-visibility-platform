'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Map, Grid3x3, List } from 'lucide-react';
import DirectorySearch from '@/components/directory/DirectorySearch';
import DirectoryGrid from '@/components/directory/DirectoryGrid';
import DirectoryList from '@/components/directory/DirectoryList';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import DirectoryCategoryBrowser from '@/components/directory/DirectoryCategoryBrowser';
import { Pagination } from '@/components/ui';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';
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

export default function DirectoryClient() {
  const { settings } = usePlatformSettings();
  const searchParams = useSearchParams();
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    googleCategoryId: string | null;
    storeCount: number;
    productCount: number;
  }>>([]);
  const [locations, setLocations] = useState<Array<{ city: string; state: string; count: number }>>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');

  // Fetch categories (locations endpoint disabled for now)
  useEffect(() => {
    const fetchFilters = async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      try {
        // Fetch categories
        const categoriesRes = await fetch(`${apiBaseUrl}/api/directory/categories`);
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          setCategories(catData.data?.categories || []);
        }

        // Locations endpoint is disabled (old directory system)
        // TODO: Re-enable when directory_listings table is available
        // const locationsRes = await fetch(`${apiBaseUrl}/api/directory/locations`);
        // if (locationsRes.ok) {
        //   const locData = await locationsRes.json();
        //   setLocations(locData.locations || []);
        // }
      } catch (err) {
        console.error('Error fetching filters:', err);
      }
    };

    fetchFilters();
  }, []);

  // Fetch directory listings
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const params = new URLSearchParams(searchParams.toString());
        
        const response = await fetch(`${apiBaseUrl}/api/directory/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch directory listings');
        }

        const result = await response.json();
        setData(result);
      } catch (err: any) {
        console.error('Error fetching directory:', err);
        setError(err.message || 'Failed to load directory');
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [searchParams]);

  const currentPage = data?.pagination.page || 1;
  const totalPages = data?.pagination.totalPages || 1;
  const totalItems = data?.pagination.totalItems || 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Hero Section with Platform Branding */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-12 md:py-16">
          {/* Platform Branding */}
          {settings?.logoUrl && (
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-2xl p-4 md:p-6">
                  <Image
                    src={settings.logoUrl}
                    alt={settings.platformName || 'Platform Logo'}
                    width={200}
                    height={80}
                    className="h-12 md:h-16 w-auto object-contain"
                    priority
                  />
                </div>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto text-center">
            {/* Platform Name */}
            {settings?.platformName && (
              <div className="mb-4">
                <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold">
                  {settings.platformName} Directory
                </span>
              </div>
            )}

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Discover Local Stores
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Find products and services from merchants near you
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <DirectorySearch />
            </div>

            {/* Quick Stats */}
            {!loading && data && (
              <div className="mt-8 flex items-center justify-center gap-8 text-sm">
                <div>
                  <span className="font-semibold">{totalItems.toLocaleString()}</span>
                  <span className="text-blue-200 ml-1">stores</span>
                </div>
                {searchParams.get('q') && (
                  <div>
                    <span className="text-blue-200">Results for</span>
                    <span className="font-semibold ml-1">"{searchParams.get('q')}"</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <DirectoryFilters categories={[]} locations={locations} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Category Browser - Show when no search is active */}
        {!searchParams.get('q') && !searchParams.get('category') && categories.length > 0 && (
          <DirectoryCategoryBrowser 
            categories={categories}
            className="mb-8"
          />
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Results Header with View Toggle */}
        {!loading && data && data.listings.length > 0 && (
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <p className="text-neutral-600 dark:text-neutral-400">
              Showing {((currentPage - 1) * 24) + 1}-{Math.min(currentPage * 24, totalItems)} of {totalItems.toLocaleString()} stores
            </p>
            
            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-lg p-1 border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'map'
                    ? 'bg-blue-600 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                <Map className="w-4 h-4" />
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <DirectoryGrid 
            listings={data?.listings || []} 
            loading={loading}
          />
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <DirectoryList 
            listings={data?.listings || []} 
            loading={loading}
          />
        )}

        {/* Map View */}
        {viewMode === 'map' && !loading && data && (
          <DirectoryMap listings={data.listings} />
        )}

        {/* Pagination */}
        {!loading && data && totalPages > 1 && (
          <div className="mt-12 flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={24}
              onPageChange={(page) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('page', page.toString());
                window.location.href = `/directory?${params.toString()}`;
              }}
              onPageSizeChange={() => {}} // Directory uses fixed page size
            />
          </div>
        )}

        {/* Help Section */}
        {!loading && (
          <div className="mt-16 p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
                Are you a merchant?
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                Get your store listed in our directory and reach more customers. 
                It's free and takes just a few minutes to set up.
              </p>
              <a
                href="/register"
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Get Started →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
