/**
 * Trending Shops API Route
 * Universal Singleton aligned endpoint for trending shops
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Mock trending shops data - in production this would be calculated from analytics
const generateTrendingShops = (limit: number = 10) => [
  {
    id: 'shop-1',
    tenantId: 'tenant-1',
    autoId: 'trend-shop-1',
    name: 'Tech Haven',
    description: 'Latest electronics and gadgets',
    imageUrl: '/api/placeholder/300/200',
    rating: 4.8,
    reviewCount: 234,
    location: 'San Francisco, CA',
    category: 'Electronics',
    isVerified: true,
    isActive: true,
    productCount: 156,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-25T00:00:00Z',
    urls: {
      canonicalUrl: '/shops/trend-shop-1',
      slugUrl: '/shops/trend-shop-1',
      tenantIdUrl: '/t/tenant-1',
      autoIdUrl: '/shops/trend-shop-1'
    },
    trending: {
      growth: 45.2,
      views: 12500,
      engagement: 89.3,
      rank: 1
    }
  },
  {
    id: 'shop-2',
    tenantId: 'tenant-2',
    autoId: 'trend-shop-2',
    name: 'Fashion Forward',
    description: 'Trendy clothing and accessories',
    imageUrl: '/api/placeholder/300/200',
    rating: 4.6,
    reviewCount: 189,
    location: 'New York, NY',
    category: 'Clothing',
    isVerified: true,
    isActive: true,
    productCount: 98,
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-24T00:00:00Z',
    urls: {
      canonicalUrl: '/shops/trend-shop-2',
      slugUrl: '/shops/trend-shop-2',
      tenantIdUrl: '/t/tenant-2',
      autoIdUrl: '/shops/trend-shop-2'
    },
    trending: {
      growth: 38.7,
      views: 9800,
      engagement: 76.4,
      rank: 2
    }
  },
  {
    id: 'shop-3',
    tenantId: 'tenant-3',
    autoId: 'trend-shop-3',
    name: 'Green Garden',
    description: 'Organic and sustainable products',
    imageUrl: '/api/placeholder/300/200',
    rating: 4.9,
    reviewCount: 156,
    location: 'Portland, OR',
    category: 'Home & Garden',
    isVerified: true,
    isActive: true,
    productCount: 87,
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-23T00:00:00Z',
    urls: {
      canonicalUrl: '/shops/trend-shop-3',
      slugUrl: '/shops/trend-shop-3',
      tenantIdUrl: '/t/tenant-3',
      autoIdUrl: '/shops/trend-shop-3'
    },
    trending: {
      growth: 32.1,
      views: 7600,
      engagement: 82.1,
      rank: 3
    }
  }
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'authentication_required', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const category = searchParams.get('category') || '';
    const region = searchParams.get('region') || '';

    // Generate trending shops
    let trendingShops = generateTrendingShops(limit);

    // Apply filters
    if (category) {
      trendingShops = trendingShops.filter(shop => 
        shop.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (region) {
      trendingShops = trendingShops.filter(shop => 
        shop.location.toLowerCase().includes(region.toLowerCase())
      );
    }

    // Apply limit
    trendingShops = trendingShops.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: trendingShops,
      meta: {
        total: trendingShops.length,
        limit,
        category,
        region,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[TRENDING_SHOPS] Error:', error);
    return NextResponse.json(
      { 
        error: 'trending_fetch_failed', 
        message: 'Failed to fetch trending shops' 
      },
      { status: 500 }
    );
  }
}
