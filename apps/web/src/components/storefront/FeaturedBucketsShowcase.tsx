"use client";

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
