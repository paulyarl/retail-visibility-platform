import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { MapPin, Star, Package, ExternalLink } from 'lucide-react';

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
  className?: string;
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

function computeStoreStatus(hours: any): { isOpen: boolean } | null {
  if (!hours || typeof hours !== 'object') return null;
  const now = new Date();
  const locale = 'en-US';
  const timeZone: string | undefined = typeof hours.timezone === 'string' ? hours.timezone : undefined;
  const weekday = (d: Date) => d.toLocaleDateString(locale, { weekday: 'long', timeZone });
  const todayName = weekday(now);
  
  // Check for special hours
  const todayDate = now.toLocaleDateString('en-CA', { timeZone });
  const specialHours = hours.special as any[] | undefined;
  const todaySpecials = specialHours?.filter((sh: any) => sh.date === todayDate) || [];
  
  // If any special hour is marked as closed, the store is closed
  const closedSpecial = todaySpecials.find((sh: any) => sh.isClosed);
  if (closedSpecial) {
    return { isOpen: false };
  }
  
  const regularToday = (hours as any)[todayName];
  
  // Compute current time in target timezone
  const fmt = new Intl.DateTimeFormat('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone });
  const parts = fmt.formatToParts(now);
  const hh = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const mm = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const currentMins = hh * 60 + mm;

  const parseRange = (entry: any): { openM: number; closeM: number } | null => {
    if (!entry) return null;
    const openStr = entry.open || entry.start || entry.from;
    const closeStr = entry.close || entry.end || entry.to;
    const o = parseTimeToMinutes(openStr);
    const c = parseTimeToMinutes(closeStr);
    if (o == null || c == null) return null;
    return { openM: o, closeM: c };
  };

  // Check regular hours
  const regularRange = parseRange(regularToday);
  if (regularRange && currentMins >= regularRange.openM && currentMins < regularRange.closeM) {
    return { isOpen: true };
  }
  
  // Check special hours
  const specialRanges = todaySpecials.map(sp => parseRange(sp)).filter(r => r !== null);
  for (const range of specialRanges) {
    if (range && currentMins >= range.openM && currentMins < range.closeM) {
      return { isOpen: true };
    }
  }
  
  return { isOpen: false };
}

export function UnifiedStoreCard({
  listing,
  viewMode,
  contextCategory,
  linkType = 'directory',
  className = ''
}: UnifiedStoreCardProps) {

  // Determine link destination based on linkType
  const linkHref = linkType === 'storefront' 
    ? `/tenant/${listing.tenantId}`
    : `/directory/${listing.slug || listing.tenantId}`;

  // Compute business hours status
  const hoursStatus = listing.businessHours ? computeStoreStatus(listing.businessHours) : null;

  // Prioritize category display: contextCategory → gbpPrimaryCategoryName → primaryCategory → category.name
  const displayCategory =
    contextCategory ||
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

  // Ensure ratingAvg is a number for safe toFixed() usage
  const ratingAvg = typeof listing.ratingAvg === 'number' ? listing.ratingAvg : parseFloat(listing.ratingAvg || '0') || 0;
  const ratingCount = typeof listing.ratingCount === 'number' ? listing.ratingCount : parseInt(listing.ratingCount || '0') || 0;

  if (viewMode === 'list') {
    return (
      <Link href={linkHref} className={`block ${className}`}>
        <Card className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4 dark:bg-gray-800">
            <div className="flex items-center space-x-4">
              {/* Logo */}
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
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="info" className="text-xs">
                          {formattedCategory}
                        </Badge>
                        {listing.reason && (
                          <Badge variant="default" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200">
                            {listing.reason}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        {listing.productCount !== undefined && (
                          <span>{listing.productCount} products</span>
                        )}
                        {hoursStatus && (
                          <div 
                            className={`w-2 h-2 rounded-full ${hoursStatus.isOpen ? 'bg-green-500' : 'bg-red-500'}`}
                            title={hoursStatus.isOpen ? 'Open now' : 'Closed'}
                          />
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

            {listing.isFeatured && (
              <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                Featured
              </Badge>
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
                className={`w-2 h-2 rounded-full ${hoursStatus.isOpen ? 'bg-green-500' : 'bg-red-500'}`}
                title={hoursStatus.isOpen ? 'Open now' : 'Closed'}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
