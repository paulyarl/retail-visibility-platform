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
import { useStoreStatusEnhanced } from '@/hooks/useStoreStatusEnhanced';
import { 
  Grid3x3, 
  List, 
  Store, 
  Star, 
  MapPin, 
  Package, 
  AlertCircle, 
  RefreshCw,
  Navigation
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

  const formatDistance = (distanceKm: number | null): string => {
    if (distanceKm === null) return '';
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m away`;
    }
    return `${Math.round(distanceKm)}km away`;
  };

  const formatRating = (rating: number, count: number): string => {
    return `${rating.toFixed(1)} (${count} ${count === 1 ? 'review' : 'reviews'})`;
  };

  const renderStoreCard = (store: any) => {
    // Get hours status for this store
    const StoreCard = () => {
      const { status } = useStoreStatusEnhanced(store.tenantId);
      
      return (
        <Link
          key={store.id}
          href={`/directory/stores/${store.slug}`}
          className="group block bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
        >
          <div className="p-6">
            {/* Header with logo and basic info */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4 flex-1">
                {store.logoUrl && (
                  <div className="relative">
                    <img
                      src={store.logoUrl}
                      alt={store.businessName}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-gray-100"
                    />
                    {/* Featured Badge */}
                    {store.isFeatured && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                        ⭐ Featured
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {store.businessName}
                  </h3>
                  {store.primaryCategory && (
                    <p className="text-sm text-gray-600 mt-1">
                      {store.primaryCategory}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Activity Level and Hours Status */}
              <div className="flex items-center space-x-2">
                {store.activityLevel === 'very_active' && (
                  <div className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    <span className="text-xs font-medium">Very Active</span>
                  </div>
                )}
                {store.activityLevel === 'active' && (
                  <div className="flex items-center text-blue-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                    <span className="text-xs font-medium">Active</span>
                  </div>
                )}
                
                {/* Hours Status Dot */}
                {status && (
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      status.status === 'open' ? 'bg-green-500' :
                      status.status === 'closed' ? 'bg-red-500' :
                      status.status === 'opening-soon' ? 'bg-blue-500' :
                      status.status === 'closing-soon' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}
                    title={status.label}
                  />
                )}
              </div>
            </div>

            {/* Rich Product Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{store.actualProductCount || store.productCount || 0}</div>
                <div className="text-xs text-gray-600">Products</div>
                {store.productsWithImages > 0 && (
                  <div className="text-xs text-green-600 font-medium mt-1">
                    {store.productsWithImages} With Photos
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">${store.avgProductPrice || 0}</div>
                <div className="text-xs text-gray-600">Avg Price</div>
                {store.productsWithReviews > 0 && (
                  <div className="text-xs text-purple-600 font-medium mt-1">
                    ⭐ {store.avgReviewRating} ({store.productsWithReviews} reviews)
                  </div>
                )}
              </div>
            </div>

            {/* Featured Type Counts - Key Differentiator */}
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Featured Products</h4>
              <div className="grid grid-cols-2 gap-2">
                {store.staffPickCount > 0 && (
                  <div className="flex items-center justify-between p-2 bg-yellow-100 rounded-lg">
                    <span className="text-xs font-medium text-yellow-800">⭐ Staff Picks</span>
                    <span className="text-xs font-bold text-yellow-900">{store.staffPickCount}</span>
                  </div>
                )}
                {store.seasonalCount > 0 && (
                  <div className="flex items-center justify-between p-2 bg-orange-100 rounded-lg">
                    <span className="text-xs font-medium text-orange-800">🍂 Seasonal</span>
                    <span className="text-xs font-bold text-orange-900">{store.seasonalCount}</span>
                  </div>
                )}
                {store.saleCount > 0 && (
                  <div className="flex items-center justify-between p-2 bg-red-100 rounded-lg">
                    <span className="text-xs font-medium text-red-800">💰 Sale</span>
                    <span className="text-xs font-bold text-red-900">{store.saleCount}</span>
                  </div>
                )}
                {store.newArrivalCount > 0 && (
                  <div className="flex items-center justify-between p-2 bg-green-100 rounded-lg">
                    <span className="text-xs font-medium text-green-800">✨ New</span>
                    <span className="text-xs font-bold text-green-900">{store.newArrivalCount}</span>
                  </div>
                )}
                {store.storeSelectionCount > 0 && (
                  <div className="flex items-center justify-between p-2 bg-blue-100 rounded-lg">
                    <span className="text-xs font-medium text-blue-800">🏪 Store</span>
                    <span className="text-xs font-bold text-blue-900">{store.storeSelectionCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Categories and Store Info */}
            <div className="mb-4">
              {/* Store Category instead of subscription tier */}
              {store.primaryCategory && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                    🏪 {store.primaryCategory}
                  </span>
                </div>
              )}
            </div>

            {/* Location and Contact */}
            <div className="space-y-2 mb-4">
              {showLocation && (store.city || store.state) && (
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  {store.city && store.state 
                    ? `${store.city}, ${store.state}`
                    : store.city || store.state
                  }
                </div>
              )}
              
              {showRating && store.ratingAvg && (
                <div className="flex items-center text-sm text-gray-600">
                  <Star className="w-4 h-4 mr-2 text-yellow-500 fill-current" />
                  <span className="font-medium">{store.ratingAvg.toFixed(1)}</span>
                  <span className="text-gray-400 ml-1">
                    ({store.ratingCount} {store.ratingCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
              
              {showProductCount && (
                <div className="flex items-center text-sm text-gray-600">
                  <Package className="w-4 h-4 mr-2 text-gray-400" />
                  <span>{store.actualProductCount || store.productCount || 0} products</span>
                </div>
              )}
            </div>

            {/* Contact Info */}
            {(store.phone || store.website) && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {store.phone && (
                    <div className="flex items-center">
                      <div className="w-4 h-4 mr-1 text-gray-400">📞</div>
                      <span>{store.phone}</span>
                    </div>
                  )}
                  {store.website && (
                    <div className="flex items-center">
                      <div className="w-4 h-4 mr-1 text-gray-400">🌐</div>
                      <span className="truncate">Website</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center text-blue-600 text-sm font-medium group-hover:text-blue-700">
                  View Store →
                </div>
              </div>
            )}
          </div>
        </Link>
      );
    };
    
    return <StoreCard />;
  };

  const renderListView = (stores: any[]) => (
    <div className="space-y-3">
      {stores.map((store) => (
        <Link
          key={store.id}
          href={`/directory/stores/${store.slug}`}
          className="group flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            {store.logoUrl && (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {store.name}
              </h3>
              {showLocation && store.city && (
                <p className="text-xs text-gray-600 mt-1">
                  {store.city}, {store.state}
                </p>
              )}
              {showRating && store.ratingAvg && (
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Star className="w-3 h-3 mr-1 text-yellow-500 fill-current" />
                  {formatRating(store.ratingAvg, store.ratingCount || 0)}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            {showProductCount && store.productCount !== undefined && (
              <div className="flex items-center">
                <Package className="w-4 h-4 mr-1" />
                {store.productCount}
              </div>
            )}
            {showDistance && store.distance !== undefined && (
              <div className="flex items-center text-blue-600">
                <Navigation className="w-4 h-4 mr-1" />
                {formatDistance(store.distance)}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );

  const renderGridView = (stores: any[]) => (
    <div className={`grid gap-6 ${
      currentViewMode === 'grid' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
        : 'grid-cols-1'
    }`}>
      {stores.map((store) => renderStoreCard(store))}
    </div>
  );

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Featured Stores</h2>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
            Featured Stores
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
      {displayStores.length === 0 ? (
        <div className="text-center py-12">
          <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No featured stores found</h3>
          <p className="text-gray-600">Check back later for new featured stores.</p>
        </div>
      ) : (
        <>
          {currentViewMode === 'grid' ? renderGridView(displayStores) : renderListView(displayStores)}
          
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
