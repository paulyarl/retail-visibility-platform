"use client";

import { useState, useEffect } from 'react';
import { UnifiedStoreCard } from './UnifiedStoreCard';
import EnhancedStoreCard from './EnhancedStoreCard';
import { Skeleton } from '@/components/ui';
import { fetchStoreStats, fetchMultipleStoreStats } from '@/utils/storeStatsCalculator';

interface DirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  primaryCategory?: string;
  gbpPrimaryCategoryName?: string;
  category?: {
    name: string;
    slug: string;
    icon?: string;
  };
  logoUrl?: string;
  bannerUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number;
  isFeatured?: boolean;
  subscriptionTier?: string;
  directoryPublished?: boolean;
  businessHours?: any; // Business hours for status indicator
}

interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface DirectoryGridProps {
  listings: DirectoryListing[];
  loading?: boolean;
  isLoading?: boolean;
  viewMode?: 'grid' | 'list';
  pagination?: Pagination;
  baseUrl?: string;
  categorySlug?: string;
}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function DirectoryGrid({ 
  listings, 
  isLoading = false, 
  viewMode = 'grid', 
  pagination,
  baseUrl = '', 
  categorySlug = '' 
}: DirectoryGridProps) {
  const [storeStats, setStoreStats] = useState<Record<string, any>>({});
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});

  // Fetch store stats for all listings in parallel with caching
  const fetchAllStoreStats = async () => {
    // Clear existing state first
    setStoreStats({});
    setStatsLoading({});
    
    const loading: Record<string, boolean> = {};
    listings.forEach(listing => {
      loading[listing.tenantId] = true;
    });
    setStatsLoading(loading);
    
    // Get all unique tenant IDs
    const tenantIds = [...new Set(listings.map(listing => listing.tenantId))];
    
    // Batch fetch all stats with caching
    const allStats = await fetchMultipleStoreStats(tenantIds);
    
    // Update state with results
    setStoreStats(allStats);
    
    // Clear loading state
    const finalLoading: Record<string, boolean> = {};
    tenantIds.forEach(tenantId => {
      finalLoading[tenantId] = false;
    });
    setStatsLoading(finalLoading);
  };

  useEffect(() => {
    if (listings.length > 0) {
      fetchAllStoreStats();
    }
  }, [listings]);

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="w-full aspect-video rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <svg 
          className="mx-auto h-16 w-16 text-neutral-400 dark:text-neutral-600 mb-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
          />
        </svg>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          No stores found
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  // Grid view
  return (
    <>
      {viewMode === 'list' ? (
        // List view - single column layout
        <div className="space-y-4">
          {listings.map((listing, index) => {
            const stats = storeStats[listing.tenantId];
            const isLoading = statsLoading[listing.tenantId];
            
            return (
              <UnifiedStoreCard
                key={listing.tenantId}
                listing={listing}
                viewMode="list"
                linkType="storefront"
                showLogo={true}
                enhancedStats={stats ? {
                  totalProducts: stats.totalProducts || 0,
                  categories: stats.categories || [],
                  ratingAvg: stats.ratingAvg || 0,
                  ratingCount: stats.ratingCount || 0,
                  rating3Count: stats.rating3Count || 0,
                  rating4Count: stats.rating4Count || 0,
                  rating5Count: stats.rating5Count || 0,
                  verifiedPurchaseCount: stats.verifiedPurchaseCount || 0,
                  lastReviewAt: stats.lastReviewAt || null,
                  isFeatured: listing.isFeatured || false,
                } : undefined}
              />
            );
          })}
        </div>
      ) : (
        // Grid view - multi-column layout
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {listings.map((listing, index) => {
            const stats = storeStats[listing.tenantId];
            const isLoading = statsLoading[listing.tenantId];
            
            return (
              <EnhancedStoreCard
                key={listing.tenantId}
                store={{
                  id: listing.tenantId,
                  tenantId: listing.tenantId,
                  name: listing.businessName,
                  slug: listing.slug || listing.tenantId,
                  address: listing.address,
                  city: listing.city,
                  state: listing.state,
                  logo_url: listing.logoUrl,
                  banner_url: listing.bannerUrl,
                  totalProducts: stats?.totalProducts || 0,
                  categories: stats?.categories || [],
                  ratingAvg: stats?.ratingAvg || 0,
                  ratingCount: stats?.ratingCount || 0,
                  rating3Count: stats?.rating3Count || 0,
                  rating4Count: stats?.rating4Count || 0,
                  rating5Count: stats?.rating5Count || 0,
                  verifiedPurchaseCount: stats?.verifiedPurchaseCount || 0,
                  lastReviewAt: stats?.lastReviewAt || null,
                  isFeatured: listing.isFeatured || false,
                }}
                showCategories={true}
                maxCategories={3}
              />
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {/* Previous Button */}
          {pagination.page > 1 && (
            <a
              href={`${baseUrl}${categorySlug ? `/${categorySlug}` : ''}?page=${pagination.page - 1}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Previous
            </a>
          )}

          {/* Page Numbers */}
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <a
                key={pageNum}
                href={`${baseUrl}${categorySlug ? `/${categorySlug}` : ''}?page=${pageNum}`}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  pageNum === pagination.page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </a>
            );
          })}

          {/* Next Button */}
          {pagination.page < pagination.totalPages && (
            <a
              href={`${baseUrl}${categorySlug ? `/${categorySlug}` : ''}?page=${pagination.page + 1}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Next
            </a>
          )}
        </div>
      )}
    </>
  );
}


export { DirectoryGrid };
