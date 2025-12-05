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
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number;
  isFeatured?: boolean;
  subscriptionTier?: string;
  directoryPublished?: boolean;
}

interface UnifiedStoreCardProps {
  listing: DirectoryListing;
  viewMode: 'grid' | 'list';
  contextCategory?: string; // For category display prioritization
  className?: string;
}

export function UnifiedStoreCard({
  listing,
  viewMode,
  contextCategory,
  className = ''
}: UnifiedStoreCardProps) {

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
      <Card className={`hover:shadow-md transition-shadow ${className}`}>
        <CardContent className="p-4">
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
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {listing.businessName}
                  </h3>

                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
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
                          <span className="text-neutral-500">
                            ({ratingCount})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="info" className="text-xs">
                      {formattedCategory}
                    </Badge>

                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      {listing.productCount !== undefined && (
                        <span>{listing.productCount} products</span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/directory/${listing.slug}`}
                  className="ml-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Link href={`/directory/${listing.slug}`} className={`block ${className}`}>
      <Card className="h-full hover:shadow-lg transition-all duration-200 group">
        <CardContent className="p-6">
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
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
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
              <span className="text-sm font-medium text-gray-900">
                {ratingAvg.toFixed(1)}
              </span>
              {ratingCount > 0 && (
                <span className="text-sm text-gray-500 ml-1">
                  ({ratingCount})
                </span>
              )}
            </div>
          )}

          {/* Address */}
          <div className="flex items-start mb-3">
            <MapPin className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600 line-clamp-2">
              {formattedAddress || 'Address not available'}
            </p>
          </div>

          {/* Footer with product count */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex items-center text-sm text-gray-500">
              <Package className="w-4 h-4 mr-1" />
              <span>
                {listing.productCount !== undefined ? `${listing.productCount} products` : 'Products available'}
              </span>
            </div>

            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
