"use client";

import { useState } from 'react';
import FeaturedBucket from './FeaturedBucket';

interface FeaturedBucketsShowcaseProps {
  featuredData: Record<string, any> & {
    totalCount: number;
    buckets: Array<{
      bucketType: string;
      bucketName: string;
      products: any[];
      count: number;
      totalCount: number;
    }>;
    bucketCounts: Record<string, number>;
  };
  tenantId: string;
  // Payment gateway status from parent page
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
  commerceDisabled?: boolean;
  /** 'stacked' (default) | 'carousel' | 'tabbed' */
  displayMode?: 'stacked' | 'carousel' | 'tabbed';
}

/**
 * Featured Buckets Showcase with Pagination
 *
 * Displays all featured product types as separate buckets,
 * each with 3 products per page and pagination controls.
 *
 * displayMode:
 *   stacked  — each bucket as a vertical section (default)
 *   carousel — each bucket as a horizontal scroll carousel
 *   tabbed   — all buckets behind a tab interface
 */
export default function FeaturedBucketsShowcase({
  featuredData,
  tenantId,
  hasActivePaymentGateway,
  defaultGatewayType,
  commerceDisabled,
  displayMode = 'stacked',
}: FeaturedBucketsShowcaseProps) {
  const [activeTab, setActiveTab] = useState(0);
  if (!featuredData) {
    return null;
  }

  // Helper to get products for a bucket type from the buckets array
  const getProductsForType = (type: string) => {
    const bucket = featuredData.buckets?.find((b) => b.bucketType === type);
    return bucket?.products || [];
  };

  // Dynamic bucket configurations from API data
  const bucketConfigs = Object.entries(featuredData.bucketCounts || {}).map(([bucketType, count]) => {
    if (!count || count === 0) return null;
    
    // Get bucket styling and data based on type
    const getBucketConfig = (type: string) => {
      switch (type) {
        // Merchant-controlled types
        case 'store_selection':
          return {
            key: 'storeSelection',
            title: 'Featured Products',
            icon: '⭐',
            gradient: 'from-blue-500 to-cyan-500',
            products: getProductsForType(type)
          };
        case 'new_arrival':
          return {
            key: 'newArrival',
            title: 'New Arrivals',
            icon: '✨',
            gradient: 'from-green-500 to-emerald-500',
            products: getProductsForType(type)
          };
        case 'seasonal':
          return {
            key: 'seasonal',
            title: 'Seasonal Specials',
            icon: '🗓️',
            gradient: 'from-orange-500 to-red-500',
            products: getProductsForType(type)
          };
        case 'sale':
          return {
            key: 'sale',
            title: 'Sale Items',
            icon: '🏷️',
            gradient: 'from-red-500 to-pink-500',
            products: getProductsForType(type)
          };
        case 'staff_pick':
          return {
            key: 'staffPick',
            title: 'Staff Picks',
            icon: '👥',
            gradient: 'from-purple-500 to-indigo-500',
            products: getProductsForType(type)
          };
        case 'clearance':
          return {
            key: 'clearance',
            title: 'Clearance',
            icon: '🔥',
            gradient: 'from-yellow-500 to-orange-500',
            products: getProductsForType(type)
          };
        case 'featured':
          return {
            key: 'featured',
            title: 'Premium Featured',
            icon: '👑',
            gradient: 'from-indigo-500 to-purple-500',
            products: getProductsForType(type)
          };
          
        // Platform-controlled types (algorithmic)
        case 'trending':
          return {
            key: 'trending',
            title: 'Trending Now',
            icon: '📈',
            gradient: 'from-pink-500 to-rose-500',
            products: getProductsForType(type)
          };
        case 'recommended':
          return {
            key: 'recommended',
            title: 'Recommended',
            icon: '🏆',
            gradient: 'from-teal-500 to-cyan-500',
            products: getProductsForType(type)
          };
        case 'bestseller':
          return {
            key: 'bestseller',
            title: 'Bestsellers',
            icon: '🥇',
            gradient: 'from-amber-500 to-yellow-500',
            products: getProductsForType(type)
          };
        case 'random_featured':
          return {
            key: 'randomFeatured',
            title: 'Discover',
            icon: '✨',
            gradient: 'from-cyan-500 to-blue-500',
            products: getProductsForType(type)
          };
          
        default:
          return {
            key: type,
            title: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
            icon: '⭐',
            gradient: 'from-blue-500 to-cyan-500',
            products: getProductsForType(type)
          };
      }
    };
    
    const config = getBucketConfig(bucketType);
    
    return {
      ...config,
      totalCount: count,
      bucketType
    };
  }).filter(Boolean); // Remove null entries

  // Filter buckets that have products
  const bucketsWithProducts = bucketConfigs.filter(
    (bucket): bucket is NonNullable<typeof bucket> => 
      Boolean(bucket && bucket.products && bucket.products.length > 0)
  );

  // Don't render if no buckets have products
  if (bucketsWithProducts.length === 0) {
    return null;
  }

  // ── Tabbed mode ──
  if (displayMode === 'tabbed') {
    const activeBucket = bucketsWithProducts[activeTab];
    if (!activeBucket) return null;

    return (
      <div className="featured-buckets-showcase">
        {/* Tab bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
          {bucketsWithProducts.map((bucket, index) => (
            <button
              key={bucket.key || bucket.bucketType}
              onClick={() => setActiveTab(index)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                index === activeTab
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <span>{bucket.icon || '⭐'}</span>
              {bucket.title || 'Featured Products'}
              <span className="text-xs opacity-60">({bucket.totalCount || 0})</span>
            </button>
          ))}
        </div>

        {/* Active bucket */}
        <FeaturedBucket
          key={activeBucket.key || activeBucket.bucketType}
          title={activeBucket.title || 'Featured Products'}
          icon={activeBucket.icon || '⭐'}
          gradient={activeBucket.gradient || 'from-blue-500 to-cyan-500'}
          products={activeBucket.products || []}
          totalCount={activeBucket.totalCount || 0}
          bucketType={activeBucket.bucketType || 'featured'}
          tenantId={tenantId}
          initialLimit={4}
          hasActivePaymentGateway={hasActivePaymentGateway}
          defaultGatewayType={defaultGatewayType}
          commerceDisabled={commerceDisabled}
        />
      </div>
    );
  }

  // ── Carousel mode ──
  if (displayMode === 'carousel') {
    return (
      <div className="featured-buckets-showcase space-y-10">
        {bucketsWithProducts.map((bucket) => (
          <div key={bucket.key || bucket.bucketType}>
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${bucket.gradient || 'from-blue-500 to-cyan-500'} flex items-center justify-center text-white`}>
                  <span className="text-base">{bucket.icon || '⭐'}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{bucket.title || 'Featured Products'}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{bucket.totalCount || 0} products</p>
                </div>
              </div>
              {bucket.totalCount > 3 && (
                <a
                  href={`/shops/${tenantId}/featured/${bucket.bucketType}`}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  View All →
                </a>
              )}
            </div>

            {/* Horizontal scroll carousel */}
            <div
              className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(bucket.products || []).map((product: any) => (
                <div
                  key={product.id}
                  className="flex-shrink-0 snap-start w-56 sm:w-64"
                >
                  <FeaturedBucket
                    title=""
                    icon=""
                    gradient=""
                    products={[product]}
                    totalCount={1}
                    bucketType={bucket.bucketType || 'featured'}
                    tenantId={tenantId}
                    initialLimit={1}
                    hasActivePaymentGateway={hasActivePaymentGateway}
                    defaultGatewayType={defaultGatewayType}
                    commerceDisabled={commerceDisabled}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Stacked mode (default) ──
  return (
    <div className="featured-buckets-showcase space-y-12">
      {bucketsWithProducts.map((bucket) => (
        <FeaturedBucket
          key={bucket.key || bucket.bucketType}
          title={bucket.title || 'Featured Products'}
          icon={bucket.icon || '⭐'}
          gradient={bucket.gradient || 'from-blue-500 to-cyan-500'}
          products={bucket.products || []}
          totalCount={bucket.totalCount || 0}
          bucketType={bucket.bucketType || 'featured'}
          tenantId={tenantId}
          initialLimit={3}
          hasActivePaymentGateway={hasActivePaymentGateway}
          defaultGatewayType={defaultGatewayType}
          commerceDisabled={commerceDisabled}
        />
      ))}
    </div>
  );
}
