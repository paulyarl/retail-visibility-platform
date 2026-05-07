'use client';

import { useState, useEffect } from 'react';
import { crossTenantProductService, CrossTenantProduct } from '@/services/CrossTenantProductService';
import Link from 'next/link';
import Image from 'next/image';

interface AvailableNearbyProps {
  productSlug: string;
  currentTenantId: string;
  className?: string;
}

export function AvailableNearby({ productSlug, currentTenantId, className = '' }: AvailableNearbyProps) {
  const [nearbyProducts, setNearbyProducts] = useState<CrossTenantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Location access denied - continue without location
          console.log('Location access denied for Available Nearby');
        }
      );
    }
  }, []);

  // Fetch nearby products when productSlug and location are available
  useEffect(() => {
    if (!productSlug) return;
    fetchNearbyProducts();
  }, [productSlug, userLocation]);

  const fetchNearbyProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await crossTenantProductService.getProductsBySlug(
        productSlug,
        {
          excludeTenantId: currentTenantId,
          latitude: userLocation?.lat,
          longitude: userLocation?.lng,
          radius: 25,
          limit: 10
        }
      );

      // Filter out the current store's listing
      const otherStores = result?.products || [];
      
      setNearbyProducts(otherStores);
    } catch (err) {
      console.error('Failed to fetch nearby products:', err);
      setError('Unable to check availability at nearby stores');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDistance = (km: number | null) => {
    if (km === null) return '';
    const miles = km * 0.621371;
    return `${miles.toFixed(1)} mi away`;
  };

  // Don't render if no product slug
  if (!productSlug) return null;

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Available Nearby
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          This product is available at other stores
        </p>
      </div>

      {loading ? (
        <div className="p-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-gray-500 text-center">
          {error}
        </div>
      ) : nearbyProducts.length === 0 ? (
        <div className="p-4 text-sm text-gray-500 text-center">
          {userLocation 
            ? 'Not available at other nearby stores'
            : 'Enable location to check nearby availability'
          }
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {nearbyProducts.map((product) => (
            <Link
              key={product.inventory_item_id}
              href={`/t/${product.tenant_slug}`}
              className="block p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Store Logo */}
                <div className="w-12 h-12 relative flex-shrink-0 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400 text-xs font-medium">
                    {product.tenant_name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Store Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {product.tenant_name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {product.tenant_city}, {product.tenant_state}
                    </span>
                    {product.distance_km !== undefined && product.distance_km !== null && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-indigo-600 font-medium">
                          {formatDistance(product.distance_km)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Price & Stock */}
                <div className="text-right">
                  {product.is_on_sale ? (
                    <div>
                      <span className="text-sm font-bold text-red-600">
                        {formatPrice(product.current_price_cents)}
                      </span>
                      <span className="block text-xs text-gray-400 line-through">
                        {formatPrice(product.list_price_cents)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-gray-900">
                      {formatPrice(product.current_price_cents)}
                    </span>
                  )}
                  <span className={`block text-xs mt-1 ${
                    product.in_stock ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {product.in_stock ? `${product.stock} in stock` : 'Out of stock'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* View All Link */}
      {nearbyProducts.length > 0 && (
        <div className="p-4 border-t border-gray-100">
          <Link
            href={`/cross-tenant?product=${productSlug}`}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-1"
          >
            View all {nearbyProducts.length} nearby stores
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

export default AvailableNearby;
