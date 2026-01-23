'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, ExternalLink, Grid3x3, List, MapPin } from 'lucide-react';
import SmartProductCard from '@/components/products/SmartProductCard';
import { useRandomFeaturedProducts, useProductSingleton } from '@/providers/data/ProductSingleton';
import type { PublicProduct } from '@/providers/data/ProductSingleton';

// Utility function to format distance
const formatDistance = (distanceKm: number | null): string => {
  if (distanceKm === null) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m away`;
  }
  return `${Math.round(distanceKm)}km away`;
};

export default function RandomFeaturedProducts() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isClient, setIsClient] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Use the new ProductSingleton hook
  const { products, loading, error, refetch } = useRandomFeaturedProducts(userLocation || undefined, 20);
  const { actions } = useProductSingleton();
  
  // Get user location on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation not available, using default location');
          // Default to New York if geolocation fails
          setUserLocation({ lat: 40.7128, lng: -74.0060 });
        }
      );
    } else {
      // Default to New York if geolocation not supported
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
    }
  }, []);

  // Handle client-side localStorage
  useEffect(() => {
    setIsClient(true);
    const savedView = localStorage.getItem('random-featured-view-mode');
    if (savedView && ['grid', 'list'].includes(savedView)) {
      setViewMode(savedView as 'grid' | 'list');
    }
  }, []);

  // Save view mode to localStorage when it changes
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('random-featured-view-mode', mode);
  };

  // Log singleton metrics for debugging
  useEffect(() => {
    console.log('ProductSingleton: Products loaded:', products.length);
  }, [products]);

  if (loading) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Products Near You</h2>
            <p className="text-gray-600">Discover amazing products from stores in your area</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500">
                {userLocation ? '📍 Finding nearby products...' : '📍 Getting your location...'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || products.length === 0) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Products Near You</h2>
            <p className="text-gray-600">Discover amazing products from stores in your area</p>
            <p className="text-sm text-gray-500 mt-1">
              📍 {error || 'No featured products available in your area'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">
              {error || 'No featured products available at the moment.'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {error ? 'Please try again later.' : 'Check back soon for new discoveries!'}
            </p>
            {error && (
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Products</h2>
          <p className="text-gray-600">Discover amazing products from stores near you</p>
          <div className="flex items-center justify-center gap-4 mt-2 text-sm text-gray-500">
            {userLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Location-aware recommendations
              </span>
            )}
            <span className="flex items-center gap-1">
              ⚡ Powered by ProductSingleton
            </span>
            <span className="text-xs">
              {products.length} products loaded
            </span>
          </div>
        </div>

        {/* View Toggle */}
        {isClient && (
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
              <button
                onClick={() => handleViewModeChange('grid')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => handleViewModeChange('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        )}

        {/* Products Display */}
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: PublicProduct, index: number) => (
              <SmartProductCard
                key={`${product.id}-${product.tenantId}-${index}`}
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  title: product.title || product.name,
                  brand: product.brand || '',
                  description: product.distanceKm !== null 
                    ? `${product.description || ''} ${formatDistance(product.distanceKm || null)}`.trim()
                    : product.description || '',
                  priceCents: product.priceCents,
                  salePriceCents: product.salePriceCents,
                  stock: product.stock,
                  imageUrl: product.imageUrl,
                  tenantId: product.tenantId,
                  availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                  has_variants: product.hasVariants || false,
                  tenantCategory: product.category ? {
                    id: product.category.id,
                    name: product.category.name,
                    slug: product.category.slug,
                  } : undefined,
                  isFeatured: true, // All products in RandomFeaturedProducts are featured
                  featuredType: product.featuredType,
                  featuredPriority: product.featuredPriority,
                  featuredAt: product.featuredAt,
                  featuredExpiresAt: product.featuredExpiresAt,
                  metadata: product.metadata,
                  hasGallery: product.hasGallery,
                  hasDescription: product.hasDescription,
                  hasBrand: product.hasBrand,
                  hasPrice: product.hasPrice,
                  // Store information (passed as props, not in ProductData)
                }}
                variant="featured"
                showCategory={true}
                showDescription={true}
                hasActivePaymentGateway={product.hasActivePaymentGateway}
                defaultGatewayType={product.defaultGatewayType}
                tenantName={product.storeInfo?.storeName}
                tenantLogo={product.storeInfo?.storeLogo}
                tenantCity={product.storeInfo?.storeCity}
                tenantState={product.storeInfo?.storeState}
                distanceKm={product.distanceKm}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {products.map((product: PublicProduct, index: number) => (
              <SmartProductCard
                key={`${product.id}-${product.tenantId}-${index}`}
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  title: product.title || product.name,
                  brand: product.brand || '',
                  description: product.distanceKm !== null 
                    ? `${product.description || ''} ${formatDistance(product.distanceKm || null)}`.trim()
                    : product.description || '',
                  priceCents: product.priceCents,
                  salePriceCents: product.salePriceCents,
                  stock: product.stock,
                  imageUrl: product.imageUrl,
                  tenantId: product.tenantId,
                  availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder') || 'in_stock',
                  has_variants: product.hasVariants || false,
                  tenantCategory: product.category ? {
                    id: product.category.id,
                    name: product.category.name,
                    slug: product.category.slug,
                  } : undefined,
                  isFeatured: true, // All products in RandomFeaturedProducts are featured
                  featuredType: product.featuredType,
                  featuredPriority: product.featuredPriority,
                  featuredAt: product.featuredAt,
                  featuredExpiresAt: product.featuredExpiresAt,
                  metadata: product.metadata,
                  hasGallery: product.hasGallery,
                  hasDescription: product.hasDescription,
                  hasBrand: product.hasBrand,
                  hasPrice: product.hasPrice,
                  // Store information (passed as props, not in ProductData)
                }}
                variant="featured"
                showCategory={true}
                showDescription={true}
                hasActivePaymentGateway={product.hasActivePaymentGateway}
                defaultGatewayType={product.defaultGatewayType}
                tenantName={product.storeInfo?.storeName}
                tenantLogo={product.storeInfo?.storeLogo}
                tenantCity={product.storeInfo?.storeCity}
                tenantState={product.storeInfo?.storeState}
                distanceKm={product.distanceKm}
              />
            ))}
          </div>
        )}

        {/* Store Attribution Section */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Featured Stores</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from(new Set(products.map(p => p.storeInfo?.storeName))).map((storeName, index) => {
              const product = products.find(p => p.storeInfo?.storeName === storeName);
              const store = product?.storeInfo;
              return (
                <Link
                  key={`${store?.storeSlug}-${index}`}
                  href={`/directory/${store?.storeSlug}`}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  {store?.storeLogo ? (
                    <img
                      src={store.storeLogo}
                      alt={store.storeName}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{storeName}</p>
                    {(store?.storeCity || store?.storeState) && (
                      <p className="text-xs text-gray-500">
                        {store.storeCity && store.storeState 
                          ? `${store.storeCity}, ${store.storeState}`
                          : store.storeCity || store.storeState
                        }
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* View More Link */}
        <div className="text-center mt-8">
          <Link
            href="/directory"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse All Stores
            <ExternalLink className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>
    </section>
  );
}
