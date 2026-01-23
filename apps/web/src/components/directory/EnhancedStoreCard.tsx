'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Package, Star, ChevronRight } from 'lucide-react';
import { useStoreStatus } from '@/hooks/useStoreStatus';

interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
  inStockProducts?: number;
}

interface Store {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  logo_url?: string;
  banner_url?: string;
  totalProducts: number;
  categories: Category[];
  ratingAvg?: number;
  ratingCount?: number;
  rating1Count?: number;
  rating2Count?: number;
  rating3Count?: number;
  rating4Count?: number;
  rating5Count?: number;
  verifiedPurchaseCount?: number;
  lastReviewAt?: string | null;
  isFeatured?: boolean;
}

interface EnhancedStoreCardProps {
  store: Store;
  showCategories?: boolean;
  maxCategories?: number;
}

export default function EnhancedStoreCard({ store, showCategories = false, maxCategories = 3 }: EnhancedStoreCardProps) {
  // Get business hours status
  const { status: hoursStatus } = useStoreStatus(store.tenantId);
  
  // Rating display logic
  const shouldShowRating = store.ratingAvg !== undefined && store.ratingAvg !== null && (store.ratingCount || 0) > 0;

  const displayCategories = store.categories.slice(0, maxCategories);
  const remainingCategories = store.categories.length - maxCategories;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Store Header */}
      <div className="relative h-32">
        {store.banner_url ? (
          <>
            <Image
              src={store.banner_url}
              alt={store.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
          </>
        ) : store.logo_url ? (
          <>
            <Image
              src={store.logo_url}
              alt={store.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600" />
        )}
        
        {/* Store Logo */}
        <div className="absolute bottom-4 left-4">
          <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-lg border-2 border-white dark:border-neutral-700 shadow-lg overflow-hidden">
            {store.logo_url ? (
              <Image
                src={store.logo_url}
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
      </div>

      {/* Store Info */}
      <div className="p-6">
        <div className="mb-4">
          <Link
            href={`/tenant/${store.id}`}
            className="text-lg font-semibold text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <span>{store.name}</span>
          </Link>
          
          {/* Rating - Use data from MV instead of separate API call */}
          {(store.ratingAvg !== undefined && store.ratingAvg !== null && (store.ratingCount || 0) > 0) && (
            <div className="flex items-center gap-1 mt-1">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-1">
                  {store.ratingAvg.toFixed(1)}
                </span>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                ({store.ratingCount} reviews{(store.verifiedPurchaseCount || 0) > 0 && `, ${store.verifiedPurchaseCount} verified`})
              </span>
            </div>
          )}

          {/* Location */}
          {store.address && (
            <div className="flex items-center gap-1 mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              <MapPin className="w-4 h-4" />
              <span>
                {store.city}, {store.state}
              </span>
              {hoursStatus && (
                <div 
                  className={`w-2 h-2 rounded-full ml-2 ${
                    hoursStatus.status === 'open' ? 'bg-green-500' :
                    hoursStatus.status === 'closed' ? 'bg-red-500' :
                    hoursStatus.status === 'opening-soon' ? 'bg-blue-500' :
                    hoursStatus.status === 'closing-soon' ? 'bg-yellow-500' :
                    'bg-gray-500' // fallback
                  }`}
                  title={hoursStatus.label}
                />
              )}
            </div>
          )}

          {/* Description */}
          {store.description && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 line-clamp-2">
              {store.description}
            </p>
          )}
        </div>

        {/* Product Stats */}
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
                {store.categories.reduce((sum, cat) => sum + (parseInt(String(cat.inStockProducts)) || 0), 0)}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                In Stock
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {store.categories.length}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                Categories
              </div>
            </div>
          </div>
        </div>

        {/* Categories */}
        {showCategories && store.categories.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
              Popular Categories
            </h4>
            <div className="flex flex-wrap gap-2">
              {displayCategories.map((category) => (
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
              {remainingCategories > 0 && (
                <Link
                  href={`/tenant/${store.id}?featured=false`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  +{remainingCategories} more
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Link
          href={`/tenant/${store.id}`}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Visit Store
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
