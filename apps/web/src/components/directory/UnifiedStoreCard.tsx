'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { MapPin, Star, Package, ExternalLink } from 'lucide-react';
import { computeStoreStatus } from '@/lib/hours-utils';

import { useStoreStatus } from "@/hooks/useStoreStatus";

export interface DirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug?: string;
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
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number;
  isFeatured?: boolean;
  subscriptionTier?: string;
  directoryPublished?: boolean;
  businessHours?: any; // Business hours object for status indicator
  reason?: string; // Recommendation reason (e.g., "Same category in Indianapolis")
}

interface UnifiedStoreCardProps {
  listing: DirectoryListing;
  viewMode: 'grid' | 'list';
  contextCategory?: string; // For category display prioritization
  linkType?: 'directory' | 'storefront'; // Determines link destination
  showLogo?: boolean; // Whether to display store logos
  className?: string;
  enhancedStats?: {
    totalProducts: number;
    categories: Array<{
      id: string;
      name: string;
      slug: string;
      count: number;
      inStockProducts?: number;
    }>;
    ratingAvg: number;
    ratingCount: number;
    rating3Count: number;
    rating4Count: number;
    rating5Count: number;
    verifiedPurchaseCount: number;
    lastReviewAt: string | null;
    isFeatured: boolean;
  };
}

// Business hours utility functions
function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function UnifiedStoreCard({
  listing,
  viewMode,
  contextCategory,
  linkType = 'directory',
  showLogo = true,
  className = '',
  enhancedStats
}: UnifiedStoreCardProps) {
  // Use centralized status hook instead of complex local logic
  const { status: hoursStatus } = useStoreStatus(listing.tenantId);
  
  // Use enhanced stats if available, otherwise fall back to basic listing data
  const ratingAvg = enhancedStats?.ratingAvg || (typeof listing.ratingAvg === 'number' ? listing.ratingAvg : parseFloat(listing.ratingAvg || '0')) || 0;
  const ratingCount = enhancedStats?.ratingCount || (typeof listing.ratingCount === 'number' ? listing.ratingCount : parseInt(listing.ratingCount || '0')) || 0;
  const categories = enhancedStats?.categories || [];
  const totalProducts = enhancedStats?.totalProducts || listing.productCount || 0;
  const isFeatured = enhancedStats?.isFeatured || listing.isFeatured || false;

  // Determine link destination based on linkType
  const linkHref = linkType === 'storefront' 
    ? `/tenant/${listing.tenantId}`
    : `/directory/${listing.slug || listing.tenantId}`;

  // Prioritize category display: enhancedStats → contextCategory → gbpPrimaryCategoryName → primaryCategory → category.name
  const displayCategory = categories.length > 0 
    ? categories[0].name  // Use first category from enhanced stats
    : contextCategory ||
      listing.gbpPrimaryCategoryName ||
      listing.primaryCategory ||
      listing.category?.name ||
      'General Store';

  // Format category name (handle snake_case and underscores)
  const formattedCategory = displayCategory
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Format address
  const formattedAddress = [
    listing.address,
    listing.city,
    listing.state,
    listing.zipCode
  ].filter(Boolean).join(', ');

  if (viewMode === 'list') {
    return (
      <Link href={linkHref} className={`block ${className}`}>
        <Card className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4 dark:bg-gray-800">
            <div className="flex items-center space-x-4">
              {/* Logo - conditionally shown */}
              {showLogo && (
                <div className="flex-shrink-0">
                  {listing.logoUrl ? (
                    <Image
                      src={listing.logoUrl}
                      alt={listing.businessName}
                      width={48}
                      height={48}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:!text-white truncate">
                      {listing.businessName}
                    </h3>

                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {formattedAddress || 'Address not available'}
                      </span>
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

                      {/* Popular Categories - from enhanced stats */}
                      {categories.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">Popular:</span>
                          {categories.slice(0, 2).map((category) => (
                            <button
                              key={category.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/tenant/${listing.tenantId}?category=${category.slug}`;
                              }}
                              className="text-xs hover:bg-blue-100 cursor-pointer transition-colors px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {category.name} ({category.count})
                            </button>
                          ))}
                          {categories.length > 2 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `/tenant/${listing.tenantId}?featured=false`;
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            >
                              +{categories.length - 2} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            // Stop propagation to prevent card click
                            e.stopPropagation();
                            // Navigate to category page
                            window.location.href = `/directory?category=${encodeURIComponent(displayCategory.toLowerCase().replace(/\s+/g, '-'))}`;
                          }}
                          className="text-xs hover:bg-blue-100 cursor-pointer transition-colors px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          {formattedCategory}
                        </button>
                        {isFeatured && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            FEATURED
                          </span>
                        )}
                        {listing.reason && (
                          <Badge variant="default" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200">
                            {listing.reason}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        {totalProducts > 0 && (
                          <span>{totalProducts} products</span>
                        )}
                        {categories.length > 0 && (
                          <span>{categories.length} categories</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Grid view
  return (
    <Link href={linkHref} className={`block ${className}`}>
      <Card className="h-full hover:shadow-lg transition-all duration-200 group dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6 dark:bg-gray-800">
          {/* Header with logo and featured badge */}
          <div className="flex items-start justify-between mb-4">
            {/* Logo - conditionally shown */}
            {showLogo && (
              <div className="flex-shrink-0">
                {listing.logoUrl ? (
                  <Image
                    src={listing.logoUrl}
                    alt={listing.businessName}
                    width={64}
                    height={64}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
            )}

            {listing.isFeatured && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                FEATURED
              </span>
            )}
          </div>

          {/* Business name */}
          <h3 className="text-lg font-semibold text-gray-900 dark:!text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {listing.businessName}
          </h3>

          {/* Category */}
          <div className="mb-3">
            <Badge variant="info" className="text-xs">
              {formattedCategory}
            </Badge>
          </div>

          {/* Rating */}
          {ratingAvg > 0 && (
            <div className="flex items-center mb-3">
              <Star className="w-4 h-4 fill-current text-yellow-400 mr-1" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {ratingAvg.toFixed(1)}
              </span>
              {ratingCount > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  ({ratingCount})
                </span>
              )}
            </div>
          )}

          {/* Address */}
          <div className="flex items-start mb-3">
            <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {formattedAddress || 'Address not available'}
            </p>
          </div>

          {/* Footer with reason badge and business hours status */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {listing.reason && (
                <Badge variant="default" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200 dark:border-green-800">
                  {listing.reason}
                </Badge>
              )}
              {listing.productCount !== undefined && listing.productCount > 0 && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Package className="w-4 h-4 mr-1" />
                  <span>{listing.productCount} products</span>
                </div>
              )}
            </div>

            {hoursStatus && (
              <div 
                className={`w-2 h-2 rounded-full ${
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
        </CardContent>
      </Card>
    </Link>
  );
}
