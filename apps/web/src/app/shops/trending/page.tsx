/**
 * Trending Shops Page
 * Dedicated page for displaying all trending shops with pagination and filtering
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// platform branding
import { usePublicBranding } from '@/hooks/usePublicBranding';
import Link from 'next/link';
import { ShopCard } from '@/components/shops/ShopCard';
import { ShopPagination } from '@/components/shops/ShopPagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Button, Badge, Card, Group, Text, Stack, Select } from '@mantine/core';
import { ArrowLeft, TrendingUp, Star, MapPin, Package, Store, Grid, Sparkles } from 'lucide-react';
import { useTrendingShops } from '@/lib/shops/shop-hooks';
import { ShopViewTracker } from '@/components/tracking/ShopViewTracker';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import LastViewed from '@/components/directory/LastViewed';


interface TrendingShop {
  id: string;
  name: string;
  slug: string;
  business_name?: string;
  imageUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  rating?: number;
  rating_count?: number;
  reviewCount?: number;
  productCount: number;
  primary_category?: string;
  created_at: string;
  trendingScore?: number;
  weeklyGrowth?: number;
}

function TrendingShopsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branding: platformBranding } = usePublicBranding();
  
  const [page, setPage] = useState(parseInt(searchParams?.get('page') || '1'));
  const [limit] = useState(12);
  const [region, setRegion] = useState(searchParams?.get('region') || '');

  const { data: shops, loading, error } = useTrendingShops({
    limit,
    region: region || undefined
  });

  // Track page view
  useEffect(() => {
    trackBehaviorClient({
      entityType: 'category',
      entityId: 'trending-shops-page',
      context: {
        page,
        limit,
        region
      },
      pageType: 'shop_directory'
    });
  }, [page, limit, region]);

  const handleShopClick = (shop: any) => {
    trackBehaviorClient({
      entityType: 'store',
      entityId: shop.id,
      context: {
        source: 'trending',
        shop_name: shop.name,
        category: shop.primary_category,
        position: shops?.findIndex(s => s.id === shop.id),
        rating: shop.rating,
        review_count: shop.reviewCount || shop.rating_count
      },
      pageType: 'shop_directory'
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const params = new URLSearchParams(searchParams?.toString());
    params.set('page', newPage.toString());
    router.push(`/shops/trending?${params.toString()}`);
  };

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    setPage(1);
    const params = new URLSearchParams(searchParams?.toString());
    if (newRegion) {
      params.set('region', newRegion);
    } else {
      params.delete('region');
    }
    params.set('page', '1');
    router.push(`/shops/trending?${params.toString()}`);
  };

  if (loading && !shops) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage 
          title="Error Loading Trending Shops"
          message="We couldn't load the trending shops. Please try again later."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopViewTracker 
        tenantId="trending-page"
        shopName="Trending Shops"
        category="trending"
        pageType="shop_directory"
      />
{/* Page Header with horizontal gradient background */}
      <div className="bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Mobile: Stacked layout, Desktop: Side by side */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* Column 1: Platform Branding */}
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg overflow-hidden">
                {platformBranding?.logoUrl ? (
                  <img 
                    src={platformBranding.logoUrl} 
                    alt={platformBranding.platformName || 'Platform'} 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Sparkles className="w-7 h-7" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  {platformBranding?.platformName || 'Visible Shelf'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Retail visibility platform
                </p>
              </div>
            </div>
            
            {/* Column 2: Page Name */}
            <div className="text-right">
               <div className="flex items-end space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">Trending Shops</h1>
              <Badge variant="filled" color="red" size="lg">
                Hot
              </Badge>
            </div>
            
            </div>
          </div>
          {/* Gradient border line */}
          <div className="flex-1 bottom-0 top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

          <p className="flex items-end justify-end text-gray-600 mt-4">
            Discover the most popular shops gaining traction right now
          </p>

          <div className="flex items-left justify-left">
           {/* Navigation Links */}
          <div className="flex items-left gap-2 mb-1">
            <Link 
              href="/shops"
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Store className="h-4 w-4" />
              Shops<span className="text-gray-400">•</span>
            </Link>
            
            <Link 
              href="/shops/directory"
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Grid className="h-4 w-4" />
              Directory<span className="text-gray-400">•</span>
            </Link>
            
            <Link 
              href="/shops/featured"
              className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Featured<span className="text-gray-400">•</span>
            </Link>
            
            <span className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 font-medium">
              <TrendingUp className="h-4 w-4" />
              Trending
            </span>
          </div>


          
           <div className="container mx-auto px-4 py-6">
          

            <div className="flex items-end justify-end space-x-4">
              <select
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Regions</option>
                <option value="Pittsburgh">Pittsburgh</option>
                <option value="Kansas City">Kansas City</option>
                <option value="East Pittsburgh">East Pittsburgh</option>
              </select>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {shops && shops.length > 0 ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg border p-6 text-center">
                <div className="text-3xl font-bold text-blue-600">{shops.length}</div>
                <div className="text-sm text-gray-600">Trending Shops</div>
              </div>
              <div className="bg-white rounded-lg border p-6 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {shops.reduce((sum, shop) => sum + (shop.productCount || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Products</div>
              </div>
              <div className="bg-white rounded-lg border p-6 text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {shops.filter(shop => shop.rating && shop.rating >= 4).length}
                </div>
                <div className="text-sm text-gray-600">Highly Rated</div>
              </div>
            </div>

            {/* Shops Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shops.map((shop, index) => (
                <div key={shop.id} className="relative">
                  {/* Trending Badge */}
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="filled" color="red">
                      #{index + 1}
                    </Badge>
                  </div>
                  
                  <ShopCard
                    shop={{
                      tenantId: shop.id,
                      name: shop.name,
                      slug: shop.slug,
                      autoId: shop.id,
                      description: shop.business_name || shop.name,
                      location: shop.location || shop.address || '',
                      category: shop.primary_category || 'General',
                      primary_category: shop.primary_category,
                      imageUrl: shop.imageUrl,
                      rating: shop.rating || 0,
                      reviewCount: shop.reviewCount || shop.rating_count || 0,
                      productCount: shop.productCount || 0,
                      isVerified: false,
                      isActive: true,
                      createdAt: shop.created_at,
                      updatedAt: shop.created_at,
                      urls: {
                        slugUrl: shop.slug ? `/shops/${shop.slug}` : `/shops/${shop.id}`,
                        tenantIdUrl: `/shops/${shop.id}`,
                        autoIdUrl: `/shops/${shop.id}`,
                        canonicalUrl: shop.slug ? `/shops/${shop.slug}` : `/shops/${shop.id}`
                      }
                    }}
                    trackingContext={{
                      source: 'trending',
                      position: index + 1,
                      category: shop.primary_category
                    }}
                    showTrendingBadge={true}
                    trendingRank={index + 1}
                  />
                </div>
              ))}
            </div>

            {/* Pagination */}
            {shops.length >= limit && (
              <div className="mt-8 flex justify-center">
                <ShopPagination
                  currentPage={page}
                  totalPages={Math.ceil(shops.length / limit)}
                  onPageChange={handlePageChange}
                  limit={limit}
                  onLimitChange={() => {}}
                  limitOptions={[12, 24, 48]}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Trending Shops Found
            </h3>
            <p className="text-gray-600 mb-4">
              {region ? `No trending shops found in ${region}.` : 'No trending shops available at the moment.'}
            </p>
            <Button onClick={() => router.push('/shops/directory')} variant="light">
              Browse All Shops
            </Button>
          </div>
        )}
      </div>

      {/* Recently Viewed */}
      <LastViewed />
    </div>
  );
}

export default function TrendingShopsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <TrendingShopsPageContent />
    </Suspense>
  );
}
