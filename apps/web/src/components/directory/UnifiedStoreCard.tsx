'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/Badge';
import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';
import { MapPin, Star, Package, ExternalLink, Heart, Phone, Store } from 'lucide-react';
import { useStoreStatus } from "@/hooks/useStoreStatus";
import HoursStatusBadge from '../storefront/HoursStatusBadge';

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
  productCount?: number | string; // API may return string
  isFeatured?: boolean;
  isPromoted?: boolean;
  promotionTier?: string;
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
  const { status: hoursStatus } = useStoreStatus(listing.tenantId, true); // Public scope
  // console.log(`UnifiedStoreCard - hoursStatus:`, hoursStatus);
  // console.log(`UnifiedStoreCard - listing:`, listing);
  
  // Use enhanced stats if available, otherwise fall back to basic listing data
  // console.log(`UnifiedStoreCard - contextCategory:`, contextCategory);
  // console.log(`UnifiedStoreCard - listing:`, listing);
  // console.log(`UnifiedStoreCard - enhancedStats:`, enhancedStats);
  const ratingAvg = enhancedStats?.ratingAvg || (typeof listing.ratingAvg === 'number' ? listing.ratingAvg : parseFloat(listing.ratingAvg || '0')) || 0;
  const ratingCount = enhancedStats?.ratingCount || (typeof listing.ratingCount === 'number' ? listing.ratingCount : parseInt(listing.ratingCount || '0')) || 0;
  const categories = enhancedStats?.categories || [];
  const totalProducts = enhancedStats?.totalProducts || Number(listing.productCount) || 0;
  const isFeatured = enhancedStats?.isFeatured || listing.isFeatured || false;
  const isPromoted = listing.isPromoted || false;
  const promotionTier = listing.promotionTier || null;

  // Determine link destination based on linkType
  const linkHref = linkType === 'storefront' 
    ? `/tenant/${listing.slug || listing.tenantId}`
    : `/directory/${listing.slug || listing.tenantId}`;

  // Prioritize category display: enhancedStats → contextCategory → gbpPrimaryCategoryName → primaryCategory → category.name
  // const displayCategory = categories.length > 0 
  //   ? categories[0].name  // Use first category from enhanced stats
  //   : listing.primaryCategory ||
  //     listing.gbpPrimaryCategoryName ||
  //     contextCategory ||
  //     listing.category?.name ||
  //     'General Store';
  const primaryCategory = listing.primaryCategory;
  // console.log(`UnifiedStoreCard - primaryCategory:`, primaryCategory);
  const displayCategory =contextCategory
    ? contextCategory
    : listing.gbpPrimaryCategoryName ||
    primaryCategory ||
    listing.category?.name ||
    'General Store';
  // console.log(`UnifiedStoreCard - displayCategory:`, displayCategory);
  // Format category name (handle snake_case and underscores)
  const formattedCategory = displayCategory
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  // console.log(`UnifiedStoreCard - formattedCategory:`, formattedCategory);

  // Format address
  const formattedAddress = [
    listing.address,
    listing.city,
    listing.state,
    listing.zipCode
  ].filter(Boolean).join(', ');
  // console.log(`UnifiedStoreCard - formattedAddress:`, formattedAddress);

  if (viewMode === 'list') {
    return (
       
        <Card withBorder padding="md" radius="md" className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
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
                    <Link href={linkHref} className={`block ${className}`}>
                      <h3 className="text-lg font-semibold text-gray-900 dark:!text-white truncate">
                        {listing.businessName}
                      </h3>
                    </Link>

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

                      {/* Hours Badge - Status */}
                      <HoursStatusBadge status={hoursStatus} />
                      
                      <br />

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
                        {isPromoted && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-full shadow-lg ${
                            promotionTier === 'featured' ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                            promotionTier === 'premium' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                            'bg-gradient-to-r from-amber-500 to-amber-600'
                          }`}>
                            <Star className="w-3.5 h-3.5 fill-white" />
                            {promotionTier?.toUpperCase() || 'PROMOTED'}
                          </span>
                        )}
                        {isFeatured && !isPromoted && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            FEATURED
                          </span>
                        )}
                        {listing.reason && (
                          <MantineBadge variant="default" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200">
                            {listing.reason}
                          </MantineBadge>
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
          </Card>
     
      );
    }

  // Grid view
  return (
   
      <Card withBorder radius="md" p="md" className="h-full hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
        {/* Logo Section */}
        {showLogo && (
          <Card.Section>
            <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center relative overflow-hidden">
              {listing.logoUrl ? (
                <Link href={linkHref} className={`block ${className}`}>
                <Image
                  src={listing.logoUrl}
                  alt={listing.businessName}
                  width={80}
                  height={80}
                  className="rounded-lg object-cover shadow-lg"
                /></Link>
              ) : (
                <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center shadow-lg">
                  <Store className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              {isPromoted && (
                <div className="absolute top-3 right-3">
                  <MantineBadge variant="default" className={`text-xs ${
                    promotionTier === 'featured' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                    promotionTier === 'premium' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    ⭐ {(promotionTier?.charAt(0) ?? '').toUpperCase() + (promotionTier?.slice(1) ?? '') || 'Promoted'}
                  </MantineBadge>
                </div>
              )}
              {isFeatured && !isPromoted && (
                <div className="absolute top-3 right-3">
                  <MantineBadge variant="default" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                    ⭐ Featured
                  </MantineBadge>
                </div>
              )}
            </div>
          </Card.Section>
        )}

        {/* Title and Basic Info - Enhanced */}
        <Card.Section className="p-4">
          <Group justify="space-between" mb="xs" align="start">
            <div className="flex-1">
               <Link href={linkHref} className={`block ${className}`}>
              <Text 
                fw={600} 
                size="lg" 
                lineClamp={1} 
                className="text-gray-900 dark:text-white hover:text-blue-600 transition-colors"
              >
                {listing.businessName}
              </Text></Link>
              <Group gap={4} mt={1}>
                <MapPin size={14} className="text-gray-500" />
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {formattedAddress || 'Location not available'}
                </Text>
                 <HoursStatusBadge status={hoursStatus} />
              </Group>
            </div>
            {!showLogo && isPromoted && (
              <MantineBadge
                color={promotionTier === 'featured' ? 'grape' : promotionTier === 'premium' ? 'blue' : 'yellow'}
                variant="light"
                size="xs"
                className="shrink-0"
              >
                ⭐ {(promotionTier?.charAt(0) ?? '').toUpperCase() + (promotionTier?.slice(1) ?? '') || 'Promoted'}
              </MantineBadge>
            )}
            {!showLogo && isFeatured && !isPromoted && (
              <MantineBadge 
                color="yellow"
                variant="light"
                size="xs"
                className="shrink-0"
              >
                ⭐ Featured
              </MantineBadge>
            )}
          </Group>

          {/* Rating Display */}
          {ratingAvg > 0 && (
            <Group gap={6} mt={2}>
              <Group gap={2}>
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    size={14} 
                    className={i < Math.floor(ratingAvg) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                  />
                ))}
              </Group>
              <Text size="sm" fw={500} c="dimmed">
                {ratingAvg.toFixed(1)}
                {ratingCount && (
                  <Text size="xs" c="dimmed" span>
                    ({ratingCount})
                  </Text>
                )}
              </Text>
            </Group>
          )}
        </Card.Section>

        {/* Features Section - Enhanced Badge Card Pattern */}
        <Card.Section mb="md">
          <Text mb="xs" size="sm" fw={500} c="dimmed">
            Store Highlights
          </Text>
          <Group gap={6} wrap="nowrap">
            {/* Category Badge - Primary */}
            <MantineBadge 
              color="blue"
              variant="light"
              size="xs"
            >
              🏷️ {formattedCategory}
            </MantineBadge>

            {/* Rating Badge - Highlight */}
            {ratingAvg >= 4.5 && (
              <MantineBadge 
                color="yellow"
                variant="light"
                size="xs"
              >
                ⭐ {ratingAvg.toFixed(1)} Rated
              </MantineBadge>
            )}
            
          

            {/* Products Badge - Info */}
            {totalProducts > 10 && (
              <MantineBadge 
                color="purple"
                variant="light"
                size="xs"
              >
                📦 {totalProducts}+ Items
              </MantineBadge>
            )}

            {/* Recommendation Badge - Special */}
            {listing.reason && (
              <MantineBadge 
                color="green"
                variant="light"
                size="xs"
              >
                💡 {listing.reason}
              </MantineBadge>
            )}

          </Group>
        </Card.Section>

        {/* Enhanced Action Buttons */}
        <Card.Section className="pt-3">
          <Group gap={8}>
            <Link href={linkHref} className="flex-1">
              <Button 
                radius="md" 
                size="sm" 
                variant="filled"
                fullWidth
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Visit Store
              </Button>
            </Link>
            <ActionIcon 
              variant="outline" 
              radius="md" 
              size={36} 
              className="border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
              aria-label="Save to favorites"
            >
              <Heart size={16} className="text-gray-600 hover:text-red-500 transition-colors" />
            </ActionIcon>
            {listing.businessHours && (
              <ActionIcon 
                variant="outline" 
                radius="md" 
                size={36} 
                className="border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors"
                aria-label="Call store"
              >
                <Phone size={16} className="text-gray-600 hover:text-green-600 transition-colors" />
              </ActionIcon>
            )}
          </Group>
        </Card.Section>
      </Card>
  );
}
