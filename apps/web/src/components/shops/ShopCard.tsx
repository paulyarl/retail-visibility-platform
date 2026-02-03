/**
 * Shop Card Component
 * Displays shop information in a card format with multiple variants
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shop } from '@/types/shop';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import { Star, MapPin, Phone, Globe, ExternalLink, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackBehaviorClient } from '@/utils/behaviorTracking';

interface ShopCardProps {
  shop: Shop;
  variant?: 'default' | 'featured' | 'compact' | 'grid';
  showUrls?: boolean;
  className?: string;
  showTrendingBadge?: boolean;
  trendingRank?: number;
  trackingContext?: {
    source: 'directory' | 'trending' | 'search' | 'category' | 'featured';
    position?: number;
    category?: string;
    searchQuery?: string;
  };
}

export function ShopCard({ shop, variant = 'default', showUrls = false, className, showTrendingBadge, trendingRank, trackingContext }: ShopCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  // Track shop card click
  const handleShopClick = () => {
    if (trackingContext) {
      trackBehaviorClient({
        entityType: 'store',
        entityId: shop.tenantId,
        context: {
          source: trackingContext.source,
          shop_name: shop.name,
          category: shop.primary_category || shop.category || trackingContext.category,
          position: trackingContext.position,
          search_query: trackingContext.searchQuery,
          rating: shop.rating,
          review_count: shop.reviewCount,
          product_count: shop.productCount
        },
        pageType: 'directory_home'
      });
    }
  };

  // Custom Link component that tracks clicks
  const TrackingLink = ({ href, children, onClick, ...props }: any) => {
    const handleClick = (e: React.MouseEvent) => {
      handleShopClick();
      if (onClick) onClick(e);
    };

    return (
      <Link href={href} onClick={handleClick} {...props}>
        {children}
      </Link>
    );
  };

  // Format rating
  const formatRating = (rating: number | undefined) => {
    if (rating === undefined || rating === null) {
      return '0.0';
    }
    return rating.toFixed(1);
  };

  // Format product count
  const formatProductCount = (count: number | undefined) => {
    if (count === undefined || count === null) {
      return '0';
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // Generate shop URLs with fallback
  const shopUrls = shop.urls || {
    slugUrl: `/shops/${shop.slug || shop.tenantId}`,
    tenantIdUrl: `/shops/${shop.tenantId}`,
    autoIdUrl: `/shops/${shop.autoId || shop.tenantId}`,
    canonicalUrl: `/shops/${shop.slug || shop.tenantId}`
  };

  // Different card layouts based on variant
  if (variant === 'compact') {
    return (
      <Card className={cn('hover:shadow-lg transition-shadow duration-200', className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Shop Image */}
            <div className="relative w-16 h-16 flex-shrink-0">
              {!imageError && shop.imageUrl ? (
                <Image
                  src={shop.imageUrl}
                  alt={shop.name}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 64px) 100vw"
                  onError={handleImageError}
                />
              ) : (
                <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-2xl text-gray-400">🏪</span>
                </div>
              )}
              {shop.isVerified && (
                <div className="absolute top-1 right-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              )}
            </div>

            {/* Shop Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate mb-1">
                {shop.name}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {shop.description}
              </p>
              
              {/* Rating and Reviews */}
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="ml-1 text-gray-700">
                    {formatRating(shop.rating)}
                  </span>
                </div>
                <span className="text-gray-500">
                  ({shop.reviewCount})
                </span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span className="truncate">{shop.location}</span>
              </div>

              {/* Product Count */}
              <div className="text-sm text-gray-600">
                {formatProductCount(shop.productCount)} products
              </div>

              {/* Category */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-xs px-3 py-1 rounded">
                {shop.primary_category || shop.category || 'General'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'featured') {
    return (
      <Card className={cn('hover:shadow-xl transition-shadow duration-200 border-2 border-yellow-200', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Badge variant="default" className="bg-yellow-100 text-yellow-800">
              Featured Shop
            </Badge>
            {shop.isVerified && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Shop Image */}
          <div className="relative h-48 mb-4">
            {!imageError && shop.imageUrl ? (
              <Image
                src={shop.imageUrl}
                alt={shop.name}
                fill
                className="object-cover rounded-lg"
                sizes="(max-width: 400px) 100vw"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-4xl text-gray-400">🏪</span>
              </div>
            )}
            {shop.bannerUrl && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-lg" />
            )}
          </div>

          {/* Shop Info */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 truncate">
                {shop.name}
              </h3>
              <p className="text-gray-600 line-clamp-2">
                {shop.description}
              </p>
            </div>

            {/* Rating and Reviews */}
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="font-semibold text-gray-900">
                  {formatRating(shop.rating)}
                </span>
              </div>
              <span className="text-gray-500">
                ({shop.reviewCount} reviews)
              </span>
            </div>

            {/* Location and Contact */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{shop.location}</span>
              </div>
              {shop.contact?.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Globe className="w-4 h-4" />
                  <span className="truncate">{shop.contact.email}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600">
                {formatProductCount(shop.productCount)} products
              </div>
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-xs px-3 py-1 rounded">
                {shop.primary_category || shop.category || 'General'}
              </div>
            </div>

            {/* URLs */}
            {showUrls && (
              <div className="pt-3 border-t">
                <div className="flex flex-wrap gap-2 text-xs">
                  {shopUrls.slugUrl && (
                    <Link href={shopUrls.slugUrl}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Slug
                      </Button>
                    </Link>
                  )}
                  <Link href={shopUrls.tenantIdUrl}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      ID
                    </Button>
                  </Link>
                  <Link href={shopUrls.autoIdUrl}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Short
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <TrackingLink href={shopUrls.canonicalUrl}>
            <Button className="w-full">
              Visit Shop
            </Button>
          </TrackingLink>
        </CardFooter>
      </Card>
    );
  }

  // Default variant
  return (
    <TrackingLink href={shopUrls.canonicalUrl} className="block">
      <Card className={cn('hover:shadow-lg transition-shadow duration-200', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showTrendingBadge && (
                <Badge variant="default" className="bg-red-500 text-white">
                  #{trendingRank}
                </Badge>
              )}
              <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-xs px-3 py-1">
                {shop.primary_category || shop.category}
              </Badge>
              {shop.isVerified && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
            </div>
            {shop.isActive && (
              <Badge variant="success" className="text-green-600">
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Shop Image */}
          <div className="relative h-40 mb-4">
            {!imageError && shop.imageUrl ? (
              <Image
                src={shop.imageUrl}
                alt={shop.name}
                fill
                className="object-cover rounded-lg"
                sizes="(max-width: 300px) 100vw"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-3xl text-gray-400">🏪</span>
              </div>
            )}
          </div>

          {/* Shop Info */}
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {shop.name}
              </h3>
              <p className="text-gray-600 line-clamp-2">
                {shop.description}
              </p>
            </div>

            {/* Rating and Reviews */}
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="font-medium text-gray-900">
                  {formatRating(shop.rating)}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                ({shop.reviewCount} reviews)
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{shop.location}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {formatProductCount(shop.productCount)} products
              </span>
              {shop.rating >= 4.5 && (
                <Badge variant="success" className="text-xs">
                  Top Rated
                </Badge>
              )}
            </div>
          </div>
        </CardContent>

        {/* URLs */}
        {showUrls && (
          <CardFooter className="pt-2">
            <div className="flex flex-wrap gap-2 text-xs">
              {shopUrls.slugUrl && (
                <Link href={shopUrls.slugUrl}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Slug
                  </Button>
                </Link>
              )}
              <Link href={shopUrls.tenantIdUrl}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  ID
                </Button>
              </Link>
              <Link href={shopUrls.autoIdUrl}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Short
                </Button>
              </Link>
            </div>
          </CardFooter>
        )}
      </Card>
    </TrackingLink>
  );
}
