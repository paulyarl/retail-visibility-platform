'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Map, Grid3x3, List, Sparkles, ShoppingCart } from 'lucide-react';
import DirectorySearch from '@/components/directory/DirectorySearch';
import DirectoryGrid from '@/components/directory/DirectoryGrid';
import DirectoryList from '@/components/directory/DirectoryList';
import { DirectoryFilters } from '@/components/directory/DirectoryFilters';
import DirectoryCategoryBrowser from '@/components/directory/DirectoryCategoryBrowser';
import DirectoryStoreTypeBrowser from '@/components/directory/DirectoryStoreTypeBrowser';
import LastViewed from '@/components/directory/LastViewed'; // NEW: LastViewed component import
import RandomFeaturedProducts from '@/components/directory/RandomFeaturedProducts'; // NEW: Random featured products
import FeaturedStoresList from '@/components/directory/FeaturedStoresList'; // NEW: Featured stores list
import DirectoryPopularTags from '@/components/directory/DirectoryPopularTags'; // NEW: Popular tags
import { Button } from '@mantine/core';
import { Pagination } from '@/components/ui';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import { externalApiService } from '@/services/ExternalApiService';
import { recommendationsService } from '@/services/RecommendationsSingletonService';
import { directoryService } from '@/services/DirectorySingletonService';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import { useMultiCart } from '@/hooks/useMultiCart';
import dynamic from 'next/dynamic';
import { ProductSingletonProvider } from '@/providers/data/ProductSingleton';
import { StoreSingletonProvider } from '@/providers/data/StoreSingleton';
import { useDirectoryStores } from '@/hooks/useDirectoryStores';

// Cache configuration for directory data
const CACHE_CONFIG = {
  categories: {
    key: 'directory-categories',
    ttl: 24 * 60 * 60 * 1000 // 24 hours
  },
  storeTypes: {
    key: 'directory-store-types',
    ttl: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Cache utility functions with TTL support
function getCachedData(key: string): any | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const config = Object.values(CACHE_CONFIG).find(c => c.key === key);

    if (!config || Date.now() - timestamp > config.ttl) {
      localStorage.removeItem(key);
      return null;
    }
    // console.log('[DirectoryClient] Cache hit for:', key);
    // console.log('[DirectoryClient] Cache data:', data);

    return data;
  } catch (error) {
    console.warn('Error reading cache:', error);
    return null;
  }
}

function setCachedData(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Error writing cache:', error);
  }
}

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

      // Reverse geocoding via service
      const data = await externalApiService.reverseGeocode(latitude, longitude);

      if (!data) {
        return { latitude, longitude, city: 'Unknown', state: 'Unknown' };
      }

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
    // Get user context for unique cache key to prevent cross-contamination
    const getUserIdFromContext = () => {
      const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
      if (userId) return userId;

      const cookies = document.cookie.split(';');
      const userIdCookie = cookies.find(cookie => cookie.trim().startsWith('userId='));
      if (userIdCookie) return userIdCookie.split('=')[1]?.trim();

      return null;
    };

    const getSessionIdFromContext = () => {
      let sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('sessionId', sessionId);
      }
      return sessionId;
    };

    const userId = getUserIdFromContext();
    const sessionId = getSessionIdFromContext();
    const userContext = userId || sessionId || 'anonymous';
    const cacheKey = `ip-geolocation-${userContext}`;

    const ipLocation = await externalApiService.getIpGeolocation(cacheKey);

    if (!ipLocation || !ipLocation.latitude || !ipLocation.longitude) {
      console.warn('Invalid location data received from external API');
      return null;
    }

    return {
      latitude: ipLocation.latitude,
      longitude: ipLocation.longitude,
      city: ipLocation.city || 'Unknown',
      state: ipLocation.region || 'Unknown'
    };
  } catch (error) {
    console.warn('Failed to get IP location:', error);
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
  businessHours?: any; // Business hours for status indicator
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { totalItems: cartTotalItems } = useMultiCart();

  // Use the new directory stores hook with StoreSingleton caching
  const {
    stores: data,
    loading,
    error,
    pagination,
    refetch
  } = useDirectoryStores({
    search: searchParams.get('q') || searchParams.get('search') || undefined,
    category: searchParams.get('category') || undefined,
    lat: (searchParams.get('sort') === 'distance' && searchParams.get('lat')) ? parseFloat(searchParams.get('lat')!) : undefined,
    lng: (searchParams.get('sort') === 'distance' && searchParams.get('lng')) ? parseFloat(searchParams.get('lng')!) : undefined,
    sort: searchParams.get('sort') || 'activity',
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 24,
  });

  // Debug page parameter
  /* console.log('[DirectoryClient] URL params:', {
    searchParams: searchParams.toString(),
    pageParam: searchParams.get('page'),
    parsedPage: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
    finalPage: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
  }); */
  const [categories, setCategories] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    googleCategoryId: string | null;
    storeCount: number;
    productCount: number;
    // Enhanced fields from new API
    totalProducts?: number;
    totalInStock?: number;
    avgPriceCents?: number;
  }>>([]);
  const [storeTypes, setStoreTypes] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    storeCount: number;
    description?: string;
  }>>([]);
  const [locations, setLocations] = useState<Array<{
    city: string;
    state: string;
    count: number;
  }>>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    city: string;
    state: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [pageSize, setPageSize] = useState(24);
  const [isClient, setIsClient] = useState(false);

  // Load saved view mode and page size after hydration
  useEffect(() => {
    setIsClient(true);
    const savedView = localStorage.getItem('directory-view-mode');
    if (savedView && ['grid', 'list', 'map'].includes(savedView)) {
      setViewMode(savedView as 'grid' | 'list' | 'map');
    }
    const savedPageSize = localStorage.getItem('directory-page-size');
    if (savedPageSize && [12, 24, 48, 96].includes(Number(savedPageSize))) {
      setPageSize(Number(savedPageSize));
    }

    // Track directory page view
    trackBehaviorClient({
      entityType: 'category',
      entityId: 'directory_home',
      entityName: 'Directory Home',
      pageType: 'directory_home'
    });
  }, []);

  // Auto-detect user location on first visit (no location params in URL)
  useEffect(() => {
    // Skip if already has location params or explicit sort
    const hasLat = searchParams.get('lat');
    const hasLng = searchParams.get('lng');
    const hasSort = searchParams.get('sort');

    if (hasLat && hasLng) {
      return; // Already has location
    }

    // Check if user has opted out of auto-location
    const autoLocationDisabled = localStorage.getItem('directory-auto-location-disabled');
    if (autoLocationDisabled === 'true') {
      return;
    }

    // Detect location and update URL
    getUserLocation()
      .then((location) => {
        if (location) {
          setUserLocation(location);
          // Update URL with location params and sort by distance
          const params = new URLSearchParams(searchParams.toString());
          params.set('lat', location.latitude.toString());
          params.set('lng', location.longitude.toString());
          params.set('sort', 'distance');
          router.replace(`?${params.toString()}`, { scroll: false });
        }
      })
      .catch((error) => {
        console.warn('Auto-location detection failed:', error);
      });
  }, []); // Only run once on mount

  // Save view mode to localStorage when it changes
  const handleViewModeChange = (mode: 'grid' | 'list' | 'map') => {
    setViewMode(mode);
    localStorage.setItem('directory-view-mode', mode);
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    localStorage.setItem('directory-page-size', size.toString());
    // Fetch categories (locations endpoint disabled for now)
  };

  // Handle view cart
  const handleViewCart = () => {
    router.push('/carts');
  };

  useEffect(() => {
    const fetchFilters = async () => {
      // const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

      try {
        // Start location detection asynchronously (non-blocking)
        getUserLocation().then((location) => {
          setUserLocation(location);
        }).catch((error) => {
          console.warn('Location detection failed:', error);
          setUserLocation(null);
        });

        // Try cache first for categories
        // TEMP: Clear cache to force fresh API call
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CACHE_CONFIG.categories.key);
        }

        let categories = getCachedData(CACHE_CONFIG.categories.key);
        // console.log('[DirectoryClient] Categories cache check:', categories ? 'HIT' : 'MISS');

        if (!categories || categories.length === 0) {
          // Fetch directory categories
          const categoriesData = await directoryService.getDirectoryCategories();
          // console.log('[DirectoryClient] Categories data:', categoriesData);

          if (categoriesData) {
            setCategories(categoriesData);
          } else {
            console.error('Failed to fetch categories from server');
            setCategories([]);
          }
        }

        // Try cache first for store types
        // TEMP: Clear cache to force fresh API call
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CACHE_CONFIG.storeTypes.key);
        }

        let storeTypes = getCachedData(CACHE_CONFIG.storeTypes.key);
        // console.log('[DirectoryClient] Store types cache check:', storeTypes ? 'HIT' : 'MISS');

        if (!storeTypes) {
          // Fetch store types
          const typesData = await directoryService.getDirectoryStoreTypes();

          if (typesData) {
            storeTypes = typesData;
          } else {
            console.error('Failed to fetch store types from server');
            storeTypes = [];
          }
        } else {
          console.log('[DirectoryClient] Using cached store types:', storeTypes);
        }

        setStoreTypes(storeTypes || []);

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

  // Track search behavior once per unique search
  const trackedSearchesRef = useRef<Set<string>>(new Set());

  // Track directory browse behavior (Near Me search) - once per unique search
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const sort = searchParams.get('sort');
  const search = searchParams.get('q') || searchParams.get('search');

  useEffect(() => {
    if (lat && lng && sort === 'distance') {
      const searchKey = `near-me-${lat}-${lng}`;
      if (!trackedSearchesRef.current.has(searchKey)) {
        trackedSearchesRef.current.add(searchKey);
        trackBehaviorClient({
          entityType: 'search',
          entityId: searchKey,
          entityName: 'Near Me Search',
          pageType: 'search_results',
          context: {
            searchType: 'location',
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            sort
          }
        });
      }
    } else if (search) {
      const searchKey = `search-${search}`;
      if (!trackedSearchesRef.current.has(searchKey)) {
        trackedSearchesRef.current.add(searchKey);
        trackBehaviorClient({
          entityType: 'search',
          entityId: searchKey,
          entityName: search,
          pageType: 'search_results',
          context: {
            searchType: 'text',
            query: search
          }
        });
      }
    }
  }, [lat, lng, sort, search]);

  // Mark component render completion (minimal logging only)
  useEffect(() => {
    if (!loading && data) {
      // console.log('Directory loaded:', data.length || 0, 'stores');
      // console.log('Directory data:', data);
    }
  }, [loading, data]);

  const currentPage = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.totalItems || 0;

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

            {/* Popular Tags */}
            {!loading && data && (
              <DirectoryPopularTags
                listings={data || []}
                className="max-w-4xl mx-auto"
              />
            )}

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
                  {/* Cart Button - Only show if items in cart */}
                  {cartTotalItems > 0 && (
                    <button
                      onClick={handleViewCart}
                      className="relative inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      title="View your shopping cart"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span className="hidden sm:inline">Cart</span>
                      <span className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                        {cartTotalItems > 99 ? '99+' : cartTotalItems}
                      </span>
                    </button>
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
        categories={Array.isArray(categories) ? categories.map(cat => ({ name: cat.name, slug: cat.slug, count: cat.storeCount })) : []}
        storeTypes={storeTypes}
        locations={Array.isArray(locations) ? locations.map(loc => ({ city: loc.city, state: loc.state, count: loc.count })) : []}
      />


      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Results Header with View Toggle and Page Size */}
        {/* Store Listings Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">All Stores</h2>
              <div className="text-sm text-neutral-500">
                {totalItems.toLocaleString()} stores total
              </div>
            </div>
          </div>

          {!loading && data && data.length > 0 && (
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <p className="text-neutral-600 dark:text-neutral-400">
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems.toLocaleString()} stores
                </p>

                {/* Page Size Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="pageSize" className="text-sm text-neutral-500 dark:text-neutral-400">
                    Show:
                  </label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                    <option value={96}>96</option>
                  </select>
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-lg p-1 border border-neutral-200 dark:border-neutral-700">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => handleViewModeChange('map')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'map'
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
              listings={data || []}
              loading={loading}
              viewMode="grid"
            />
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <DirectoryList
              listings={data || []}
              loading={loading}
              showLogo={true}
              viewMode="list"
            />
          )}

          {/* Map View */}
          {viewMode === 'map' && (
            <DirectoryMapGoogle
              listings={data || []}
              useMapEndpoint={true}
              filters={{
                category: searchParams.get('category') || undefined,
                city: searchParams.get('city') || undefined,
                state: searchParams.get('state') || undefined,
                q: searchParams.get('q') || undefined, // Search query
              }}
            />
          )}

          {/* Pagination */}
          {!loading && data && totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={(page: number) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('page', page.toString());
                  window.location.href = `/directory?${params.toString()}`;
                }}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div> {/* Close Store Listings Section */}
        {/* Gradient border line */}
        <div className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

        {/* Browse Sections - Show immediately when collapsed (no search active) */}
        {!searchParams.get('q') && !searchParams.get('search') && !searchParams.get('category') && (
          <>
            {/* Product Category Browser - Show immediately, data loads in background */}
            <DirectoryCategoryBrowser
              categories={categories}
              className="mt-12"
            />

            {/* Gradient border line */}
            <div className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            {/* Store Type Browser - Show immediately, data loads in background */}
            <DirectoryStoreTypeBrowser
              storeTypes={storeTypes}
              className="mt-8"
            />

            {/* Gradient border line */}
            <div className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          </>
        )}
        {/* Random Featured Products */}
        <ProductSingletonProvider>
          <RandomFeaturedProducts />
        </ProductSingletonProvider>

        {/* Gradient border line */}
        <div className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        {/* Featured Stores */}
        <StoreSingletonProvider>
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Featured Stores</h2>
              <Link
                href="/directory/stores"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all stores →
              </Link>
            </div>

            {/* Gradient border line */}
            <div className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
            <FeaturedStoresList
              limit={8}
              showLocation={true}
              showRating={true}
              showProductCount={true}
              userLocation={userLocation ? {
                lat: userLocation.latitude,
                lng: userLocation.longitude
              } : undefined}
            />
          </div>
        </StoreSingletonProvider>


        {/* Directory Home Recommendations */}
        <DirectoryHomeRecommendations />


        {/* Last Viewed Items */}
        <LastViewed />

        {/* Gradient border line */}
        <div className="flex w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
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
      {/* Platform Branding Footer */}
      <PoweredByFooter />
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
        const data = await recommendationsService.getDirectoryRecommendations();
        setRecommendations(data?.recommendations || []);
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
        {Array.isArray(recommendations) && recommendations.map((rec, index) => (
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
