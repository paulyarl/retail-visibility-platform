'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Star, Package, ChevronRight, ExternalLink } from 'lucide-react';
import { useStoreData, useStore } from '@/providers/StoreProviderSingleton';

// ====================
// UNIVERSAL STORE CARD
// ====================
interface UniversalStoreCardProps {
  storeId: string;
  variant?: 'compact' | 'detailed' | 'minimal';
  showCategories?: boolean;
  maxCategories?: number;
  showStats?: boolean;
  showQuickActions?: boolean;
  className?: string;
}

export function UniversalStoreCard({ 
  storeId, 
  variant = 'detailed', 
  showCategories = true, 
  maxCategories = 3,
  showStats = true,
  showQuickActions = true,
  className = '' 
}: UniversalStoreCardProps) {
  const { store, loading, error } = useStoreData(storeId);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden ${className}`}>
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 dark:bg-gray-700"></div>
          <div className="p-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden ${className}`}>
        <div className="p-4 text-center">
          <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Store not available</p>
        </div>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
        <Link href={`/tenant/${store.id}`} className="block">
          <div className="flex items-center p-3">
            {/* Store Logo */}
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
              {store.logoUrl ? (
                <Image
                  src={store.logoUrl}
                  alt={store.name}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
            
            {/* Store Info */}
            <div className="ml-3 flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {store.name}
              </h3>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="w-3 h-3 mr-1" />
                  {store.city && store.state ? `${store.city}, ${store.state}` : 'Location not available'}
                </div>
                {store.hasRatings && (
                  <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-400">
                    <Star className="w-3 h-3 mr-1" />
                    {store.ratingDisplay}
                  </div>
                )}
              </div>
              {showStats && (
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{store.totalProducts} products</span>
                  <span>{store.uniqueCategories} categories</span>
                </div>
              )}
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
        <Link href={`/tenant/${store.id}`} className="block">
          <div className="p-3">
            <div className="flex items-center">
              {/* Store Logo */}
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                {store.logoUrl ? (
                  <Image
                    src={store.logoUrl}
                    alt={store.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-3 h-3 text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Store Info */}
              <div className="ml-2 flex-1 min-w-0">
                <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">
                  {store.name}
                </h3>
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="w-3 h-3 mr-1" />
                  {store.city}
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Detailed variant (default)
  return (
    <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${className}`}>
      {/* Store Header */}
      <div className="relative h-32">
        {store.bannerUrl ? (
          <>
            <Image
              src={store.bannerUrl}
              alt={store.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
          </>
        ) : store.logoUrl ? (
          <>
            <Image
              src={store.logoUrl}
              alt={store.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600" />
        )}
        
        {/* Featured Badge */}
        {store.isFeatured && (
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              FEATURED
            </span>
          </div>
        )}
        
        {/* Store Logo */}
        <div className="absolute bottom-4 left-4">
          <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-lg border-2 border-white dark:border-neutral-700 shadow-lg overflow-hidden">
            {store.logoUrl ? (
              <Image
                src={store.logoUrl}
                alt={store.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Store Info */}
      <div className="p-6">
        {/* Store Name */}
        <Link href={`/tenant/${store.id}`}>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {store.name}
          </h2>
        </Link>

        {/* Rating */}
        {store.hasRatings && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {store.ratingDisplay}
            </span>
            {store.verifiedPurchaseCount > 0 && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                ({store.verifiedPurchaseCount} verified)
              </span>
            )}
          </div>
        )}

        {/* Location */}
        {store.address && (
          <div className="flex items-center gap-1 mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            <MapPin className="w-4 h-4" />
            <span>
              {store.city}, {store.state}
            </span>
          </div>
        )}

        {/* Description */}
        {store.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-2">
            {store.description}
          </p>
        )}

        {/* Product Stats */}
        {showStats && (
          <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {store.totalProducts}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Total Products
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {store.totalInStock}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  In Stock
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {store.uniqueCategories}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Categories
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        {showCategories && store.hasCategories && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
              Popular Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {store.categories.slice(0, maxCategories).map((category: any) => (
                <Link
                  key={category.id}
                  href={`/tenant/${store.id}?category=${category.slug}`}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  {category.name}
                  <span className="text-blue-600 dark:text-blue-400">
                    ({category.count})
                  </span>
                </Link>
              ))}
              {store.categories.length > maxCategories && (
                <Link
                  href={`/tenant/${store.id}?featured=false`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  +{store.categories.length - maxCategories} more
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {showQuickActions && (
          <div className="flex items-center gap-2">
            <Link
              href={`/tenant/${store.id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Visit Store
              <ChevronRight className="w-4 h-4" />
            </Link>
            {store.website && (
              <a
                href={store.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ====================
// BATCH STORE CARD
// ====================
interface BatchStoreCardProps {
  storeIds: string[];
  maxColumns?: number;
  variant?: 'compact' | 'detailed';
  className?: string;
}

export function BatchStoreCard({ storeIds, maxColumns = 4, variant = 'compact', className = '' }: BatchStoreCardProps) {
  const { getStores, loading } = useStore();
  const stores = getStores(storeIds);
  const isLoading = storeIds.some(id => loading(id));

  if (isLoading) {
    return (
      <div className={`grid grid-cols-${maxColumns} gap-4 ${className}`}>
        {Array.from({ length: storeIds.length }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48"></div>
            <div className="mt-2 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-${maxColumns} gap-4 ${className}`}>
      {stores.map((store: any) => (
        <UniversalStoreCard
          key={store.id}
          storeId={store.id}
          variant={variant}
          showCategories={variant === 'detailed'}
          showStats={variant === 'detailed'}
        />
      ))}
    </div>
  );
}
