/**
 * Featured Stores List Component
 * 
 * Displays featured stores using the StoreSingleton hook
 * with loading states, error handling, and performance metrics.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useFeaturedStores } from '@/providers/data/StoreSingleton';
import { StoreList, StoreData } from '@/components/stores';

import { LinkType } from '@/components/stores/StoreCard';
import { 
  Grid3x3, 
  List, 
  Store, 
  AlertCircle, 
  RefreshCw
} from 'lucide-react';

interface FeaturedStoresListProps {
  viewMode?: 'grid' | 'list';
  limit?: number;
  showLocation?: boolean;
  showRating?: boolean;
  showProductCount?: boolean;
  showDistance?: boolean;
  userLocation?: {
    lat: number;
    lng: number;
  };
  className?: string;
}

// Transform store data from hook to StoreData format
function transformStore(store: any): StoreData {
  return {
    id: store.id,
    tenantId: store.tenantId || store.id,
    name: store.businessName || store.name,
    slug: store.slug,
    address: store.address,
    city: store.city,
    state: store.state,
    zipCode: store.zipCode || store.postal_code,
    latitude: store.latitude,
    longitude: store.longitude,
    logoUrl: store.logoUrl || store.logo_url,
    bannerUrl: store.bannerUrl || store.banner_url,
    primaryCategory: store.primaryCategory || store.primary_category,
    phone: store.phone,
    website: store.website,
    ratingAvg: store.ratingAvg || store.rating,
    ratingCount: store.ratingCount || store.review_count,
    productCount: store.actualProductCount || store.productCount,
    isFeatured: store.isFeatured ?? true,
    subscriptionTier: store.subscriptionTier,
    businessHours: store.hours || store.businessHours,
    distance: store.distance,
  };
}

export default function FeaturedStoresList({
  viewMode = 'grid',
  limit = 10,
  showLocation = true,
  showRating = true,
  showProductCount = true,
  showDistance = false,
  userLocation,
  className = '',
}: FeaturedStoresListProps) {
  const [currentViewMode, setCurrentViewMode] = React.useState<'grid' | 'list'>(viewMode);
  const [showMetrics, setShowMetrics] = React.useState(false);

  const {
    stores,
    loading,
    error,
    refetch,
    getStoresByLocation,
    metrics,
  } = useFeaturedStores(
    showDistance && userLocation ? {
      lat: userLocation.lat,
      lng: userLocation.lng
    } : undefined,
    limit
  );

  // Filter stores by location if user location is provided
  const displayStores = userLocation && showDistance 
    ? getStoresByLocation(userLocation.lat, userLocation.lng)
    : stores;

  // Transform stores to StoreData format
  const storeData = displayStores.map(transformStore);

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error loading featured stores</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="mt-4 flex items-center space-x-2 text-sm text-red-600 hover:text-red-700"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            All Featured Stores
            <span className="ml-2 text-sm text-gray-500">
              ({displayStores.length} stores)
            </span>
          </h2>
          {showDistance && userLocation && (
            <p className="text-sm text-gray-600 mt-1">
              Stores near your location
            </p>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentViewMode('grid')}
              className={`p-2 rounded ${currentViewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentViewMode('list')}
              className={`p-2 rounded ${currentViewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Metrics Toggle */}
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showMetrics ? 'Hide' : 'Show'} Metrics
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      {showMetrics && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Cache Hits:</span>
              <span className="ml-2 font-medium">{metrics.cacheHits}</span>
            </div>
            <div>
              <span className="text-blue-600">Cache Misses:</span>
              <span className="ml-2 font-medium">{metrics.cacheMisses}</span>
            </div>
            <div>
              <span className="text-blue-600">Hit Rate:</span>
              <span className="ml-2 font-medium">
                {metrics.totalRequests > 0 
                  ? `${((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)}%`
                  : '0%'
                }
              </span>
            </div>
            <div>
              <span className="text-blue-600">Avg Response:</span>
              <span className="ml-2 font-medium">{metrics.averageResponseTime.toFixed(0)}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Stores Display */}
      {displayStores.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No featured stores found</h3>
          <p className="text-gray-600">Check back later for new featured stores.</p>
        </div>
      ) : (
        <>
          <StoreList
            stores={storeData}
            viewMode={currentViewMode}
            linkType={LinkType.Directory}
            showLogo={true}
            showCategories={true}
            maxCategories={3}
            loading={loading}
          />
          
          {stores.length > limit && (
            <div className="text-center mt-8">
              <Link
                href="/directory/stores"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View all {stores.length} stores
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
