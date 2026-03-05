/**
 * Trending Shops Component
 * Displays trending shops with algorithm integration, growth metrics, and time period selection
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shop } from '@/types/shop';
import { Badge } from '@/components/ui/Badge';
//import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { ChevronLeft, ChevronRight, TrendingUp, Star, MapPin, ExternalLink, Activity, Users, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrendingShops } from '@/lib/shops/shop-hooks';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import StoreStatusIndicator from '@/components/storefront/StoreStatusIndicator';
import { Button } from '@mantine/core';

interface TrendingShopsProps {
  limit?: number;
  region?: string;
  timeframe?: 'daily' | 'weekly' | 'monthly';
  className?: string;
}

interface TrendingShop extends Shop {
  trendingScore: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  dailyGrowth: number;
  viewCount: number;
  engagementRate: number;
  rank: number;
  previousRank?: number;
}

export function TrendingShops({ limit = 10, region, timeframe = 'weekly', className }: TrendingShopsProps) {
  const [currentTimeframe, setCurrentTimeframe] = useState(timeframe);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Fetch real trending shops from API
  const { data: apiShops, loading } = useTrendingShops({ limit: limit || 8, region });
  
  // Transform API data to TrendingShop format
  const trendingShops: TrendingShop[] = (apiShops || []).map((shop: any, index: number) => ({
    tenantId: shop.id || shop.tenantId,
    autoId: shop.id || shop.tenantId,
    name: shop.name,
    slug: shop.slug || shop.id,
    description: shop.business_name || shop.name,
    imageUrl: shop.imageUrl,
    rating: shop.rating || 4.5,
    reviewCount: shop.reviewCount || shop.rating_count || 0,
    location: shop.location || `${shop.city || ''}${shop.city && shop.state ? ', ' : ''}${shop.state || ''}`.trim() || 'Location not specified',
    category: shop.primary_category || 'General',
    productCount: parseInt(shop.productCount) || 0,
    isVerified: shop.is_published !== false,
    isActive: true,
    createdAt: shop.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    urls: shop.urls || {
      slugUrl: `/shops/${shop.slug || shop.id}`,
      tenantIdUrl: `/shops/${shop.id}`,
      autoIdUrl: `/shops/${shop.id}`,
      canonicalUrl: `/shops/${shop.slug || shop.id}`
    },
    trendingScore: shop.trendingScore || 0,
    weeklyGrowth: shop.weeklyGrowth || 0,
    monthlyGrowth: shop.monthlyGrowth || 0,
    dailyGrowth: shop.dailyGrowth || 0,
    viewCount: shop.viewCount || 0,
    engagementRate: shop.engagementRate || 0,
    rank: index + 1,
    previousRank: undefined
  }));

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? trendingShops.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === trendingShops.length - 1 ? 0 : prev + 1));
  };

  const getTimeframeGrowth = (shop: TrendingShop) => {
    switch (currentTimeframe) {
      case 'daily':
        return shop.dailyGrowth;
      case 'weekly':
        return shop.weeklyGrowth;
      case 'monthly':
        return shop.monthlyGrowth;
      default:
        return shop.weeklyGrowth;
    }
  };

  const getRankChange = (shop: TrendingShop) => {
    if (!shop.previousRank) return null;
    const change = shop.previousRank - shop.rank;
    if (change > 0) return { type: 'up', value: change };
    if (change < 0) return { type: 'down', value: Math.abs(change) };
    return { type: 'same', value: 0 };
  };

  if (loading) {
    return (
      <Card className={cn('bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200', className)}>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trendingShops || trendingShops.length === 0) {
    return null;
  }

  return (
    <Card className={cn('bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200', className)}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Trending Shops
            </h2>
            <Badge variant="default" className="bg-purple-100 text-purple-800">
              Hot Right Now
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Timeframe Selector */}
            <Select value={currentTimeframe} onChange={(e) => setCurrentTimeframe(e.target.value as any)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
            
            {trendingShops.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Trending Shop Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trendingShops.map((shop, index) => (
            <TrendingShopCard
              key={shop.tenantId}
              shop={shop}
              isActive={index === currentIndex}
              position={shop.rank}
              timeframe={currentTimeframe}
            />
          ))}
        </div>

        {/* View All Button */}
        <div className="mt-6 text-center">
          <Link href="/shops/trending">
            <Button variant="outline" className="bg-white">
              View All Trending Shops
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface TrendingShopCardProps {
  shop: TrendingShop;
  isActive: boolean;
  position: number;
  timeframe: 'daily' | 'weekly' | 'monthly';
}

function TrendingShopCard({ shop, isActive, position, timeframe }: TrendingShopCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  // Track trending shop card click
  const handleShopClick = () => {
    trackBehaviorClient({
      entityType: 'store',
      entityId: shop.tenantId,
      context: {
        source: 'trending',
        shop_name: shop.name,
        category: shop.primary_category,
        position: position + 1,
        trending_score: shop.trendingScore,
        rating: shop.rating,
        review_count: shop.reviewCount,
        product_count: shop.productCount,
        timeframe: timeframe
      },
      pageType: 'directory_home'
    });
  };

  const getTimeframeGrowth = () => {
    switch (timeframe) {
      case 'daily':
        return shop.dailyGrowth;
      case 'weekly':
        return shop.weeklyGrowth;
      case 'monthly':
        return shop.monthlyGrowth;
      default:
        return shop.weeklyGrowth;
    }
  };

  const getRankChange = () => {
    if (!shop.previousRank) return null;
    const change = shop.previousRank - shop.rank;
    if (change > 0) return { type: 'up', value: change };
    if (change < 0) return { type: 'down', value: Math.abs(change) };
    return { type: 'same', value: 0 };
  };

  const formatRating = (rating: number | undefined) => {
    if (rating === undefined || rating === null) {
      return '0.0';
    }
    return rating.toFixed(1);
  };

  const formatProductCount = (count: number | undefined) => {
    if (count === undefined || count === null) {
      return '0';
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const growth = getTimeframeGrowth();
  const rankChange = getRankChange();

  return (
    <Link href={shop.urls.canonicalUrl} onClick={handleShopClick}>
      <Card className={cn(
        'relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer',
        isActive && 'ring-2 ring-purple-500 shadow-lg'
      )}>
        {/* Trending Badge */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <Badge variant="default" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            #{position}
          </Badge>
          {rankChange && (
            <Badge variant={rankChange.type === 'up' ? 'default' : 'error'} className="text-xs">
              {rankChange.type === 'up' && '↑'}
              {rankChange.type === 'down' && '↓'}
              {rankChange.type === 'same' && '→'}
              {rankChange.value}
            </Badge>
          )}
        </div>

        {/* Store Status */}
        <div className="absolute top-2 left-2 z-10">
          <StoreStatusIndicator tenantId={shop.tenantId} />
        </div>

        {/* Shop Image */}
        <div className="relative h-32">
          {!imageError && shop.imageUrl ? (
            <Image
              src={shop.imageUrl}
              alt={shop.name}
              fill
              className="object-cover"
              sizes="(max-width: 300px) 100vw"
              loading="eager"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
              <span className="text-3xl">🏪</span>
            </div>
          )}
          
          {/* Trending Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          {/* Trending Score */}
          <div className="absolute bottom-2 left-2">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-white" />
              <span className="text-white font-semibold text-sm">
                {shop.trendingScore.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Shop Info */}
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Shop Name */}
            <h3 className="font-semibold text-gray-900 truncate">
              {shop.name}
            </h3>

            {/* Category */}
            {shop.category && shop.category !== 'General' && (
              <div className="flex items-center gap-1">
                <Badge variant="default" className="text-xs bg-gray-100 text-gray-800">
                  {shop.category}
                </Badge>
              </div>
            )}

            {/* Rating and Reviews */}
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="font-medium text-gray-900 text-sm">
                  {formatRating(shop.rating)}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                ({shop.reviewCount} reviews)
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{shop.location}</span>
            </div>

            {/* Product Count */}
            {shop.productCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <span className="font-medium">{formatProductCount(shop.productCount)}</span>
                <span>products</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
