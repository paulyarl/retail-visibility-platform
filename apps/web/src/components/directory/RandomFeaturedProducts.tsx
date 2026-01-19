'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, ExternalLink, Grid3x3, List } from 'lucide-react';
import SmartProductCard from '@/components/products/SmartProductCard';

interface RandomFeaturedProduct {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  brand?: string;
  description?: string;
  stock: number;
  availability: string;
  tenantId: string;
  categoryName?: string;
  categorySlug?: string;
  hasActivePaymentGateway?: boolean;
  paymentGatewayType?: string;
  storeSlug: string;
  storeName: string;
  storeLogo?: string;
  storeCity?: string;
  storeState?: string;
  updatedAt: string;
  distanceKm: number | null;
}

export default function RandomFeaturedProducts() {
  const [products, setProducts] = useState<RandomFeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isClient, setIsClient] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

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

  useEffect(() => {
    let abortController = new AbortController();
    let isMounted = true;

    const fetchRandomFeatured = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        
        // Build URL with location params if available
        let url = `${apiUrl}/api/directory/random-featured`;
        if (userLocation) {
          const params = new URLSearchParams({
            lat: userLocation.lat.toString(),
            lng: userLocation.lng.toString(),
            maxDistance: '500' // 500km radius
          });
          url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
          signal: abortController.signal,
          next: { revalidate: 600 }, // Cache for 10 minutes
        });

        if (response.ok && isMounted) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError' && isMounted) {
          console.error('Error fetching random featured products:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Only fetch when we have location (or default)
    if (userLocation) {
      fetchRandomFeatured();
    }

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [userLocation]);

  if (loading) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Products Near You</h2>
            <p className="text-gray-600">Discover amazing products from stores in your area</p>
            <p className="text-sm text-gray-500 mt-1">📍 Getting your location...</p>
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

  if (products.length === 0) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Products Near You</h2>
            <p className="text-gray-600">Discover amazing products from stores in your area</p>
            <p className="text-sm text-gray-500 mt-1">📍 No featured products available in your area</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">No featured products available at the moment.</p>
            <p className="text-sm text-gray-400 mt-2">Check back soon for new discoveries!</p>
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
          {userLocation && (
            <p className="text-sm text-gray-500 mt-1">
              📍 Location-aware recommendations based on your position
            </p>
          )}
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
            {products.map((product) => (
              <SmartProductCard
                key={product.id}
                product={{
                  id: product.id,
                  sku: product.id,
                  name: product.name,
                  title: product.name,
                  brand: product.brand || '',
                  description: product.description || '',
                  priceCents: product.priceCents,
                  stock: product.stock,
                  imageUrl: product.imageUrl,
                  tenantId: product.tenantId,
                  availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder' | undefined) || 'in_stock',
                  tenantCategory: product.categoryName ? {
                    id: product.categorySlug || product.categoryName,
                    name: product.categoryName,
                    slug: product.categorySlug || product.categoryName,
                  } : undefined,
                  has_variants: false,
                  has_active_payment_gateway: product.hasActivePaymentGateway,
                  payment_gateway_type: product.paymentGatewayType,
                }}
                tenantName={product.storeName}
                tenantLogo={product.storeLogo}
                variant="featured"
                showCategory={true}
                showDescription={true}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        Featured
                      </span>
                    </div>
                    {product.brand && (
                      <p className="text-sm text-gray-500 mb-2">{product.brand}</p>
                    )}
                    {product.categoryName && (
                      <p className="text-sm text-blue-600 font-medium mb-2">{product.categoryName}</p>
                    )}
                    {product.distanceKm !== null && product.distanceKm !== undefined ? (
                      <p className="text-sm text-green-600 font-medium mb-2">
                        📍 {Math.round(product.distanceKm)} km away
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 font-medium mb-2">
                        📍 {product.storeCity}, {product.storeState}
                      </p>
                    )}
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                    )}
                    
                    {/* Store Info */}
                    <div className="flex items-center space-x-3 mb-3">
                      {product.storeLogo ? (
                        <img
                          src={product.storeLogo}
                          alt={product.storeName}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                          <Package className="w-3 h-3 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.storeName}</p>
                        {(product.storeCity || product.storeState) && (
                          <p className="text-xs text-gray-500">
                            {product.storeCity && product.storeState 
                              ? `${product.storeCity}, ${product.storeState}`
                              : product.storeCity || product.storeState
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price and Actions */}
                  <div className="flex flex-col items-end space-y-3 ml-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        ${(product.priceCents / 100).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">{product.currency}</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <SmartProductCard
                        product={{
                          id: product.id,
                          sku: product.id,
                          name: product.name,
                          title: product.name,
                          brand: product.brand || '',
                          description: product.description || '',
                          priceCents: product.priceCents,
                          stock: product.stock,
                          imageUrl: product.imageUrl,
                          tenantId: product.tenantId,
                          availability: (product.availability as 'in_stock' | 'out_of_stock' | 'preorder' | undefined) || 'in_stock',
                          tenantCategory: product.categoryName ? {
                            id: product.categorySlug || product.categoryName,
                            name: product.categoryName,
                            slug: product.categorySlug || product.categoryName,
                          } : undefined,
                          has_variants: false,
                          has_active_payment_gateway: product.hasActivePaymentGateway,
                          payment_gateway_type: product.paymentGatewayType,
                        }}
                        tenantName={product.storeName}
                        tenantLogo={product.storeLogo}
                        variant="compact"
                        showCategory={false}
                        showDescription={false}
                      />
                      
                      <Link
                        href={`/directory/${product.storeSlug}`}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
                        title={`More from ${product.storeName}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Store Attribution Section */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Featured Stores</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from(new Set(products.map(p => p.storeName))).map((storeName) => {
              const store = products.find(p => p.storeName === storeName);
              return (
                <Link
                  key={store?.storeSlug}
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
