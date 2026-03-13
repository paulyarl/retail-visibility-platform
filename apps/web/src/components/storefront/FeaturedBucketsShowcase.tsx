"use client";

import FeaturedBucket from './FeaturedBucket';

interface FeaturedBucketsShowcaseProps {
  featuredData: Record<string, any> & {
    totalCount: number;
    bucketCounts: Record<string, number>;
  };
  tenantId: string;
  // Payment gateway status from parent page
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
}

/**
 * Featured Buckets Showcase with Pagination
 * 
 * Displays all featured product types as separate buckets,
 * each with 3 products per page and pagination controls.
 */
export default function FeaturedBucketsShowcase({ 
  featuredData, 
  tenantId,
  hasActivePaymentGateway,
  defaultGatewayType
}: FeaturedBucketsShowcaseProps) {
  if (!featuredData) {
    return null;
  }

  // Dynamic bucket configurations from API data
  const bucketConfigs = Object.entries(featuredData.bucketCounts || {}).map(([bucketType, count]) => {
    if (!count || count === 0) return null;
    
    // Get bucket styling and data based on type
    const getBucketConfig = (type: string) => {
      switch (type) {
        case 'store_selection':
          return {
            key: 'storeSelection',
            title: 'Featured Products',
            icon: '⭐',
            gradient: 'from-blue-500 to-cyan-500',
            products: featuredData.storeSelection
          };
        case 'new_arrival':
          return {
            key: 'newArrival',
            title: 'New Arrivals',
            icon: '✨',
            gradient: 'from-green-500 to-emerald-500',
            products: featuredData.newArrival
          };
        case 'seasonal':
          return {
            key: 'seasonal',
            title: 'Seasonal Specials',
            icon: '🗓️',
            gradient: 'from-orange-500 to-red-500',
            products: featuredData.seasonal
          };
        case 'sale':
          return {
            key: 'sale',
            title: 'Sale Items',
            icon: '🏷️',
            gradient: 'from-red-500 to-pink-500',
            products: featuredData.sale
          };
        case 'staff_pick':
          return {
            key: 'staffPick',
            title: 'Staff Picks',
            icon: '👥',
            gradient: 'from-purple-500 to-indigo-500',
            products: featuredData.staffPick
          };
        default:
          return {
            key: type,
            title: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
            icon: '⭐',
            gradient: 'from-blue-500 to-cyan-500',
            products: featuredData[type] || []
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
      bucket && bucket.products && bucket.products.length > 0
  );

  // Don't render if no buckets have products
  if (bucketsWithProducts.length === 0) {
    return null;
  }

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
        />
      ))}
    </div>
  );
}
