"use client";

import FeaturedBucket from './FeaturedBucket';

interface FeaturedBucketsShowcaseProps {
  featuredData: {
    totalCount: number;
    staffPick: any[];
    seasonal: any[];
    sale: any[];
    newArrival: any[];
    storeSelection: any[];
    bucketCounts: {
      staff_pick: number;
      seasonal: number;
      sale: number;
      new_arrival: number;
      store_selection: number;
    };
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

  // Featured bucket configurations
  const bucketConfigs = [
    {
      key: 'storeSelection',
      title: 'Featured Products',
      icon: '⭐',
      gradient: 'from-blue-500 to-cyan-500',
      products: featuredData.storeSelection,
      totalCount: featuredData.bucketCounts?.store_selection || 0,
      bucketType: 'store_selection'
    },
    {
      key: 'newArrival',
      title: 'New Arrivals',
      icon: '✨',
      gradient: 'from-green-500 to-emerald-500',
      products: featuredData.newArrival,
      totalCount: featuredData.bucketCounts?.new_arrival || 0,
      bucketType: 'new_arrival'
    },
    {
      key: 'seasonal',
      title: 'Seasonal Specials',
      icon: '🗓️',
      gradient: 'from-orange-500 to-red-500',
      products: featuredData.seasonal,
      totalCount: featuredData.bucketCounts?.seasonal || 0,
      bucketType: 'seasonal'
    },
    {
      key: 'sale',
      title: 'Sale Items',
      icon: '🏷️',
      gradient: 'from-red-500 to-pink-500',
      products: featuredData.sale,
      totalCount: featuredData.bucketCounts?.sale || 0,
      bucketType: 'sale'
    },
    {
      key: 'staffPick',
      title: 'Staff Picks',
      icon: '👥',
      gradient: 'from-purple-500 to-indigo-500',
      products: featuredData.staffPick,
      totalCount: featuredData.bucketCounts?.staff_pick || 0,
      bucketType: 'staff_pick'
    }
  ];

  // Filter buckets that have products
  const bucketsWithProducts = bucketConfigs.filter(bucket => 
    bucket.products && bucket.products.length > 0
  );

  // Don't render if no buckets have products
  if (bucketsWithProducts.length === 0) {
    return null;
  }

  return (
    <div className="featured-buckets-showcase space-y-12">
      {bucketsWithProducts.map((bucket) => (
        <FeaturedBucket
          key={bucket.key}
          title={bucket.title}
          icon={bucket.icon}
          gradient={bucket.gradient}
          products={bucket.products}
          totalCount={bucket.totalCount}
          bucketType={bucket.bucketType}
          tenantId={tenantId}
          initialLimit={3}
          hasActivePaymentGateway={hasActivePaymentGateway}
          defaultGatewayType={defaultGatewayType}
        />
      ))}
    </div>
  );
}
