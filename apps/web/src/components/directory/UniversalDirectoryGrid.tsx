'use client';

import { useState, useEffect } from 'react';
import { UniversalProvider } from '@/providers/UniversalProvider';
import { UniversalStoreCard } from '@/components/stores/UniversalStoreCard';
import { UniversalProductCard } from '@/components/products/UniversalProductCard';
import { Skeleton } from '@/components/ui';

// ====================
// UNIVERSAL DIRECTORY GRID
// ====================
interface DirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  isFeatured?: boolean;
  subscriptionTier?: string;
  // Essential data for middleware
  // Only pass what's needed for the middleware to fetch the rest
}

interface UniversalDirectoryGridProps {
  listings: DirectoryListing[];
  viewMode: 'grid' | 'list';
  showProducts?: boolean;
  maxProductsPerStore?: number;
  className?: string;
}

export default function UniversalDirectoryGrid({ 
  listings, 
  viewMode = 'grid', 
  showProducts = false,
  maxProductsPerStore = 3,
  className = '' 
}: UniversalDirectoryGridProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Extract essential data for middleware
  const storeIds = listings.map(listing => listing.tenantId);
  const productIds = showProducts ? 
    listings.flatMap(listing => (listing as any).products?.map((p: any) => p.id) || []) : 
    [];

  return (
    <UniversalProvider>
      <div className={`space-y-6 ${className}`}>
        {/* Loading State */}
        {isLoading && (
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
        )}

        {/* Directory Grid */}
        {!isLoading && (
          <>
            {viewMode === 'list' ? (
              // List View
              <div className="space-y-4">
                {listings.map((listing) => (
                  <UniversalStoreCard
                    key={listing.id}
                    storeId={listing.tenantId}
                    variant="detailed"
                    showCategories={true}
                    showStats={true}
                    showQuickActions={true}
                  />
                ))}
              </div>
            ) : (
              // Grid View
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {listings.map((listing) => (
                  <UniversalStoreCard
                    key={listing.id}
                    storeId={listing.tenantId}
                    variant="detailed"
                    showCategories={true}
                    showStats={true}
                    showQuickActions={false}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Products Section */}
        {showProducts && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Featured Products
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {productIds.slice(0, 8).map((productId) => (
                <UniversalProductCard
                  key={productId}
                  productId={productId}
                  variant="compact"
                  showStoreInfo={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </UniversalProvider>
  );
}

// ====================
// SMART DIRECTORY GRID WITH AUTO-LOADING
// ====================
interface SmartDirectoryGridProps {
  listings: DirectoryListing[];
  viewMode: 'grid' | 'list';
  autoLoad?: boolean;
  showProducts?: boolean;
  className?: string;
}

export function SmartDirectoryGrid({ 
  listings, 
  viewMode = 'grid', 
  autoLoad = true,
  showProducts = false,
  className = '' 
}: SmartDirectoryGridProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedListings, setLoadedListings] = useState<DirectoryListing[]>([]);

  // Auto-load functionality
  useEffect(() => {
    if (autoLoad && listings.length > 0) {
      setIsLoading(true);
      
      // Simulate loading delay for better UX
      const timer = setTimeout(() => {
        setLoadedListings(listings);
        setIsLoading(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [listings, autoLoad]);

  const currentListings = autoLoad ? loadedListings : listings;
  const storeIds = currentListings.map(listing => listing.tenantId);

  return (
    <UniversalProvider>
      <div className={`space-y-6 ${className}`}>
        {/* Loading State */}
        {isLoading && (
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
        )}

        {/* Directory Grid */}
        {!isLoading && currentListings.length > 0 && (
          <>
            {viewMode === 'list' ? (
              // List View
              <div className="space-y-4">
                {currentListings.map((listing) => (
                  <UniversalStoreCard
                    key={listing.id}
                    storeId={listing.tenantId}
                    variant="detailed"
                    showCategories={true}
                    showStats={true}
                    showQuickActions={true}
                  />
                ))}
              </div>
            ) : (
              // Grid View
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {currentListings.map((listing) => (
                  <UniversalStoreCard
                    key={listing.id}
                    storeId={listing.tenantId}
                    variant="detailed"
                    showCategories={true}
                    showStats={true}
                    showQuickActions={false}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && currentListings.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h-1m-6-4 .5-4.5M9 12h6m2 0h-6m-6 0h6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              No stores found
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        )}
      </div>
    </UniversalProvider>
  );
}

// ====================
// BATCH LOADING EXAMPLE
// ====================
interface BatchDirectoryGridProps {
  storeIds: string[];
  viewMode: 'grid' | 'list';
  className?: string;
}

export function BatchDirectoryGrid({ storeIds, viewMode = 'grid', className = '' }: BatchDirectoryGridProps) {
  return (
    <UniversalProvider>
      <div className={className}>
        {viewMode === 'list' ? (
          <div className="space-y-4">
            {storeIds.map((storeId) => (
              <UniversalStoreCard
                key={storeId}
                storeId={storeId}
                variant="detailed"
                showCategories={true}
                showStats={true}
                showQuickActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {storeIds.map((storeId) => (
              <UniversalStoreCard
                key={storeId}
                storeId={storeId}
                variant="detailed"
                showCategories={true}
                showStats={true}
                showQuickActions={false}
              />
            ))}
          </div>
        )}
      </div>
    </UniversalProvider>
  );
}
