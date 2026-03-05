/**
 * Trending Products Component
 * 
 * Displays trending products with location-based recommendations
 * Shows trending scores and engagement metrics
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingProduct } from '../../services/EnhancedProductService';

interface TrendingProductsProps {
  products: TrendingProduct[];
  title?: string;
  location?: { lat: number; lng: number };
  maxItems?: number;
  className?: string;
}

const TrendingProducts: React.FC<TrendingProductsProps> = ({
  products,
  title = "Trending Products",
  location,
  maxItems = 10,
  className = ''
}) => {
  const displayProducts = products.slice(0, maxItems);

  const getTrendingBadge = (score: string) => {
    const numericScore = parseFloat(score);
    
    if (numericScore >= 0.8) {
      return { label: '🔥 Hot', color: 'bg-red-500' };
    } else if (numericScore >= 0.5) {
      return { label: '📈 Trending', color: 'bg-orange-500' };
    } else if (numericScore >= 0.3) {
      return { label: '⭐ Popular', color: 'bg-yellow-500' };
    } else {
      return { label: '👁️ Viewed', color: 'bg-blue-500' };
    }
  };

  const formatPrice = (priceCents: number) => {
    return `$${(priceCents / 100).toFixed(2)}`;
  };

  const formatLocation = (city: string, state: string) => {
    return `${city}, ${state}`;
  };

  if (displayProducts.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-500">No trending products available</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {location && (
          <div className="text-sm text-gray-500">
            📍 {location.lat.toFixed(2)}, {location.lng.toFixed(2)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayProducts.map((product, index) => {
          const trendingBadge = getTrendingBadge(product.trending_score.toString());
          
          return (
            <div
              key={product.inventory_item_id}
              className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
            >
              {/* Trending Badge */}
              <div className="absolute top-2 left-2 z-10">
                <div className={`${trendingBadge.color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                  {trendingBadge.label}
                </div>
              </div>

              {/* Product Image */}
              <div className="relative h-48 overflow-hidden">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.product_title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <div className="text-gray-400 text-center">
                      <div className="text-4xl mb-2">📦</div>
                      <div className="text-sm">No Image</div>
                    </div>
                  </div>
                )}
                
                {/* View Count Overlay */}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  👁️ {product.view_count}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                {/* Store Name */}
                <div className="text-xs text-gray-500 mb-1">
                  {product.tenant_name}
                </div>
                
                {/* Product Title */}
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  <Link href={`/products/${product.inventory_item_id.toString()}`}>
                    {product.product_title}
                  </Link>
                </h3>

                {/* Category */}
                <div className="text-xs text-gray-500 mb-2">
                  {product.product_category}
                </div>

                {/* Location */}
                <div className="text-xs text-gray-500 mb-3">
                  📍 {formatLocation(product.tenant_city, product.tenant_state)}
                </div>

                {/* Price and Rating */}
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-gray-900">
                    {formatPrice(product.current_price_cents)}
                  </div>
                  
                  {/* Trending Score Indicator */}
                  <div className="flex items-center space-x-1">
                    <div className="text-xs text-gray-500">
                      Score: {parseFloat(product.trending_score.toString()).toFixed(2)}
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 bg-gray-900 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                    Quick View
                  </button>
                  <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View More Link */}
      {products.length > maxItems && (
        <div className="text-center mt-8">
          <Link
            href="/trending"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            View All Trending Products
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
};

export default TrendingProducts;
