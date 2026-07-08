'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Package, Star, ChevronRight, ShoppingBag, Phone, Globe } from 'lucide-react';
import { useStoreStatus } from '@/hooks/useStoreStatus';
import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';
import HoursStatusBadge from '@/components/storefront/HoursStatusBadge';
import DemoBadge from '@/components/shared/DemoBadge';

// ==================== TYPES ====================

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
  inStockProducts?: number;
}

export interface StoreStats {
  totalProducts: number;
  totalInStock: number;
  uniqueCategories: number;
  categories: StoreCategory[];
  ratingAvg?: number;
  ratingCount?: number;
  rating1Count?: number;
  rating2Count?: number;
  rating3Count?: number;
  rating4Count?: number;
  rating5Count?: number;
  verifiedPurchaseCount?: number;
  lastReviewAt?: string | null;
}

export interface StoreData {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryCategory?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number;
  isFeatured?: boolean;
  subscriptionTier?: string;
  businessHours?: any;
  distance?: number;
  isDemo?: boolean;
  demoExpiresAt?: string | null;
}

export type ViewMode = 'grid' | 'list' | 'map';
export enum LinkType {
  Storefront = 'storefront',
  Directory = 'directory'
}

export interface StoreCardProps {
  store: StoreData;
  viewMode: ViewMode;
  linkType?: LinkType;
  showLogo?: boolean;
  showCategories?: boolean;
  maxCategories?: number;
  stats?: StoreStats | null;
  statsLoading?: boolean;
  className?: string;
}

// ==================== STORE CARD COMPONENT ====================

export function StoreCard({
  store,
  viewMode,
  linkType = LinkType.Directory,
  showLogo = true,
  showCategories = true,
  maxCategories = 3,
  stats,
  statsLoading = false,
  className = ''
}: StoreCardProps) {
  // Get business hours status
  const { status: hoursStatus } = useStoreStatus(store.tenantId, true);
  // console.log(`StoreCard: ${store.name}`, store);
  
  // Derived data
  const totalProducts = stats?.totalProducts || store.productCount || 0;
  const categories = stats?.categories || [];
  const ratingAvg = stats?.ratingAvg || store.ratingAvg || 0;
  const ratingCount = stats?.ratingCount || store.ratingCount || 0;
  // Parse inStockProducts as integers to prevent string concatenation
  const inStockCount = categories.reduce((sum, cat) => sum + (parseInt(String(cat.inStockProducts)) || 0), 0);
  const displayCategories = categories.slice(0, maxCategories);
  const remainingCategories = categories.length - maxCategories;

  // Determine link destination
  const linkHref = linkType === LinkType.Storefront 
    ? `/shops/${store.slug || store.tenantId}`
    : `/directory/${store.slug || store.tenantId}`;

  // console.log(`linkType: ${linkType}`);
  // console.log(`linkHref: ${linkHref}`);

  // Format category name
  const formattedCategory = store.primaryCategory
    ? store.primaryCategory.replace(/_/g, ' ').split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    : 'General Store';

  // Format address
  const formattedAddress = [
    store.address,
    store.city,
    store.state,
    store.zipCode
  ].filter(Boolean).join(', ');

  // Status indicator color
  const getStatusColor = () => {
    if (!hoursStatus) return 'bg-gray-400';
    switch (hoursStatus.status) {
      case 'open': return 'bg-green-500';
      case 'closed': return 'bg-red-500';
      case 'opening-soon': return 'bg-blue-500';
      case 'closing-soon': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  // ==================== GRID VIEW ====================
  if (viewMode === 'grid') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow ${className}`}>
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
              href={linkHref}
              className="text-lg font-semibold text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <span>{store.name}</span>
              {store.isDemo && <DemoBadge isDemo={store.isDemo} demoExpiresAt={store.demoExpiresAt} size="sm" />}
            </Link>
            
            {/* Store Category/Type */}
            {store.primaryCategory && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  {formattedCategory}
                </span>
              </div>
            )}
            
            {/* Rating */}
            {ratingAvg > 0 && ratingCount > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-1">
                    {ratingAvg.toFixed(1)}
                  </span>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  ({ratingCount} reviews{stats?.verifiedPurchaseCount ? `, ${stats.verifiedPurchaseCount} verified` : ''})
                </span>
              </div>
            )}

            {/* Location */}
            {store.city && (
              <div className="flex items-center gap-1 mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                <MapPin className="w-4 h-4" />
                <span>{store.city}, {store.state}</span>
                {/* Hours Badge - Status */}
            <HoursStatusBadge status={hoursStatus} />
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
                  {totalProducts}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Total Products
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {inStockCount}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  In Stock
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {categories.length}
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Categories
                </div>
              </div>
            </div>
          </div>

          {/* Popular Categories */}
          {showCategories && displayCategories.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
                Popular Categories
              </h4>
              <div className="flex flex-wrap gap-2">
                {displayCategories.map((category) => (
                  <Link
                    key={category.id}
                    href={`${linkHref}?category=${category.slug}`}
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
                    href={`${linkHref}?featured=false`}
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
            href={linkHref}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Visit Store
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ==================== LIST VIEW ====================
  if (viewMode === 'list') {
    return (
      <Link href={linkHref} className={`block ${className}`}>
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start space-x-4">
            {/* Logo */}
            {showLogo && (
              <div className="flex-shrink-0">
                {store.logoUrl ? (
                  <Image
                    src={store.logoUrl}
                    alt={store.name}
                    width={64}
                    height={64}
                    className="rounded-lg object-cover w-16 h-16"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                    {store.name}
                    {store.isDemo && <DemoBadge isDemo={store.isDemo} demoExpiresAt={store.demoExpiresAt} size="sm" />}
                  </h3>

                  {/* Category Badge */}
                  {store.primaryCategory && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 mt-1">
                      {formattedCategory}
                    </span>
                  )}

                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {/* Address */}
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {formattedAddress || 'Address not available'}
                      {hoursStatus && (
                        <div 
                          className={`w-2 h-2 rounded-full ml-2 ${getStatusColor()}`}
                          title={hoursStatus.label}
                        />
                      )}
                    </span>

                    {/* Rating */}
                    {ratingAvg > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {ratingAvg.toFixed(1)}
                        </span>
                        {ratingCount > 0 && (
                          <span className="text-neutral-500 dark:text-neutral-400">
                            ({ratingCount})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Popular Categories */}
                  {categories.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Popular:</span>
                      {categories.slice(0, 2).map((category) => (
                        <span
                          key={category.id}
                          className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        >
                          {category.name} ({category.count})
                        </span>
                      ))}
                      {categories.length > 2 && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          +{categories.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats on right */}
                <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                  {totalProducts > 0 && (
                    <span className="flex items-center">
                      <ShoppingBag className="w-4 h-4 mr-1" />
                      {totalProducts} products
                    </span>
                  )}
                  {categories.length > 0 && (
                    <span>{categories.length} categories</span>
                  )}
                </div>
              </div>

              {/* Featured Badge */}
              {store.isFeatured && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    FEATURED
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // ==================== MAP VIEW ====================
  if (viewMode === 'map') {
    return (
      <div className={`bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-4 min-w-[280px] ${className}`}>
        {/* Header with logo and name */}
        <div className="flex items-start gap-3 mb-3">
          {store.logoUrl ? (
            <Image
              src={store.logoUrl}
              alt={store.name}
              width={48}
              height={48}
              className="rounded-lg object-cover w-12 h-12"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
              {store.name}
              {store.isDemo && <DemoBadge isDemo={store.isDemo} demoExpiresAt={store.demoExpiresAt} size="sm" />}
            </h3>
            {store.primaryCategory && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                {formattedCategory}
              </span>
            )}
            {hoursStatus && (
              <div className="flex items-center gap-1 mt-1">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {hoursStatus.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm mb-3">
          {ratingAvg > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-medium">{ratingAvg.toFixed(1)}</span>
              <span className="text-neutral-500">({ratingCount})</span>
            </div>
          )}
          {totalProducts > 0 && (
            <div className="flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
              <ShoppingBag className="w-4 h-4" />
              <span>{totalProducts} products</span>
            </div>
          )}
        </div>

        {/* Address */}
        {formattedAddress && (
          <div className="flex items-start gap-1 text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{formattedAddress}</span>
          </div>
        )}

        {/* Contact */}
        <div className="flex items-center gap-3 text-sm mb-3">
          {store.phone && (
            <a href={`tel:${store.phone}`} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
              <Phone className="w-4 h-4" />
              <span className="sr-only">Call</span>
            </a>
          )}
          {store.website && (
            <a href={store.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
              <Globe className="w-4 h-4" />
              <span className="sr-only">Website</span>
            </a>
          )}
        </div>

        {/* Action Button */}
        <Link
          href={linkHref}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Visit Store
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return null;
}

export default StoreCard;
