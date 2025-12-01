'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Map, Grid3x3, List, Sparkles } from 'lucide-react';
import DirectorySearch from '@/components/directory/DirectorySearch';
import DirectoryGrid from '@/components/directory/DirectoryGrid';
import DirectoryList from '@/components/directory/DirectoryList';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import DirectoryCategoryBrowser from '@/components/directory/DirectoryCategoryBrowser';
import DirectoryStoreTypeBrowser from '@/components/directory/DirectoryStoreTypeBrowser';
import { Pagination } from '@/components/ui';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import dynamic from 'next/dynamic';

// NEW: Location detection utility
async function getUserLocation(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  state: string;
} | null> {
  try {
    // Try browser geolocation first
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Reverse geocoding to get city/state
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      const data = await response.json();
      
      const address = data.address || {};
      const city = address.city || address.town || address.village || 'Unknown';
      const state = address.state || 'Unknown';
      
      return { latitude, longitude, city, state };
    }
  } catch (error) {
    console.warn('Geolocation failed, falling back to IP-based location');
  }
  
  // Fallback to IP-based location
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    return {
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      city: data.city || 'Unknown',
      state: data.region || 'Unknown'
    };
  } catch (error) {
    console.warn('IP location failed, using default');
    return null;
  }
}

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
  const [storeTypes, setStoreTypes] = useState<Array<{
    name: string;
    slug: string;
    storeCount: number;
  }>>([]);
  const [locations, setLocations] = useState<Array<{ city: string; state: string; count: number }>>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  
  // NEW: User location for proximity-based scoring
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string;
    state: string;
  } | null>(null);

  // Fetch categories (locations endpoint disabled for now)
  useEffect(() => {
    const fetchFilters = async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      try {
        // NEW: Get user location for proximity scoring
        const location = await getUserLocation();
        setUserLocation(location);
        
        // Fetch product categories from materialized view (10,000x faster!)
        // Now with normalized categories and Google taxonomy alignment
        const categoriesRes = await fetch(`${apiBaseUrl}/api/directory/mv/categories${location ? `?lat=${location.latitude}&lng=${location.longitude}&city=${encodeURIComponent(location.city)}&state=${location.state}` : ''}`);
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);

        // Fetch store types
        const storeTypesRes = await fetch(`${apiBaseUrl}/api/directory/store-types`);
        if (storeTypesRes.ok) {
          const typesData = await storeTypesRes.json();
          setStoreTypes(typesData.data?.storeTypes || []);
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
        
        // Use materialized view endpoint for faster queries
        const response = await fetch(`${apiBaseUrl}/api/directory/mv/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch directory listings');
        }

        const result = await response.json();
        
        // Deduplicate listings by tenant_id (MV returns one row per category)
        // Keep the first occurrence of each store
        if (result.listings) {
          const seenIds = new Set();
          result.listings = result.listings.filter((listing: any) => {
            const id = listing.tenantId || listing.tenant_id || listing.id;
            if (seenIds.has(id)) {
              return false;
            }
            seenIds.add(id);
            return true;
          });
          // Update pagination count to reflect deduplicated results
          if (result.pagination) {
            result.pagination.totalItems = result.listings.length;
            result.pagination.returnedCount = result.listings.length;
          }
        }
        
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
      {/* Page Title Section */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white mb-3">
              Discover Local Stores
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
              Find products and services from merchants near you
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-4">
              <DirectorySearch />
            </div>

            {/* Quick Stats & CTA */}
            <div className="flex flex-col items-center gap-4">
              {!loading && data && (
                <div className="flex items-center justify-center gap-6 text-sm text-neutral-600 dark:text-neutral-400">
                  <div>
                    <span className="font-semibold text-neutral-900 dark:text-white">{totalItems.toLocaleString()}</span>
                    <span className="ml-1">stores</span>
                  </div>
                  {searchParams.get('q') && (
                    <div>
                      <span>Results for</span>
                      <span className="font-semibold text-neutral-900 dark:text-white ml-1">"{searchParams.get('q')}"</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* How It Works CTA */}
              <Link
                href="/directory/about"
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>See how this directory works its magic</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <DirectoryFilters 
        categories={categories.map(cat => ({ name: cat.name, slug: cat.slug, count: cat.storeCount }))}
        storeTypes={storeTypes}
        locations={locations} 
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Product Category Browser - Show when no search is active */}
        {!searchParams.get('q') && !searchParams.get('category') && categories.length > 0 && (
          <DirectoryCategoryBrowser 
            categories={categories}
            className="mb-8"
          />
        )}

        {/* Store Type Browser - Show when no search is active */}
        {!searchParams.get('q') && !searchParams.get('category') && storeTypes.length > 0 && (
          <DirectoryStoreTypeBrowser 
            storeTypes={storeTypes}
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
          <DirectoryMapGoogle listings={data.listings} />
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

        {/* Directory Home Recommendations */}
        <DirectoryHomeRecommendations />

        {/* Help Section - Two Column */}
        {!loading && (
          <div className="mt-16 grid md:grid-cols-2 gap-6">
            {/* Merchant CTA */}
            <div className="p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-center">
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

            {/* How It Works CTA */}
            <div className="p-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 mb-3">
                  <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    How does this work?
                  </h2>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  Discover the zero-effort magic behind this directory. 
                  No manual curation, just pure automation.
                </p>
                <Link
                  href="/directory/about"
                  className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                >
                  See the Magic →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Directory Home Recommendations Component
function DirectoryHomeRecommendations() {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/api/recommendations/for-directory`);
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } catch (error) {
        console.error('Error fetching directory recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  if (loading || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 border-t border-neutral-200 dark:border-neutral-800 pt-8">
      <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-6">
        Trending Nearby
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec, index) => (
          <Link
            key={rec.tenantId}
            href={`/directory/${rec.slug}`}
            className="block p-6 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-green-500 dark:hover:border-green-400 transition-all hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white text-lg">
                  {rec.businessName}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {rec.address}
                </p>
                <p className="text-sm text-neutral-500">
                  {rec.city}, {rec.state}
                  {rec.distance && ` • ${rec.distance} mi`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-green-600 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                {rec.reason}
              </p>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
