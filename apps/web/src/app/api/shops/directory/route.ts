/**
 * Shop Directory API Route
 * Universal Singleton aligned endpoint for shop directory listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category') || '';
    const region = searchParams.get('region') || '';
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'name';

    // Mock shop data - in production this would query the database
    const mockShops = [
      {
        id: 'shop-1',
        tenantId: 'tenant-1',
        autoId: 'shop-1',
        name: 'Tech Haven',
        description: 'Latest electronics and gadgets',
        imageUrl: '/api/placeholder/300/200',
        rating: 4.8,
        reviewCount: 234,
        location: 'San Francisco, CA',
        category: 'Electronics',
        isVerified: true,
        isActive: true,
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-25T00:00:00Z',
        settings: {},
        metadata: {},
        urls: {
          canonicalUrl: '/shops/shop-1',
          slugUrl: '/shops/shop-1',
          tenantIdUrl: '/t/tenant-1',
          autoIdUrl: '/shops/shop-1'
        }
      },
      {
        id: 'shop-2',
        tenantId: 'tenant-2',
        autoId: 'shop-2',
        name: 'Fashion Forward',
        description: 'Trendy clothing and accessories',
        imageUrl: '/api/placeholder/300/200',
        rating: 4.6,
        reviewCount: 189,
        location: 'New York, NY',
        category: 'Clothing',
        isVerified: true,
        isActive: true,
        createdAt: '2024-01-10T00:00:00Z',
        updatedAt: '2024-01-24T00:00:00Z',
        settings: {},
        metadata: {},
        urls: {
          canonicalUrl: '/shops/shop-2',
          slugUrl: '/shops/shop-2',
          tenantIdUrl: '/t/tenant-2',
          autoIdUrl: '/shops/shop-2'
        }
      }
    ];

    // Apply filters
    let filteredShops = mockShops;
    
    if (category) {
      filteredShops = filteredShops.filter(shop => shop.category === category);
    }
    
    if (search) {
      filteredShops = filteredShops.filter(shop => 
        shop.name.toLowerCase().includes(search.toLowerCase()) ||
        shop.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedShops = filteredShops.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: paginatedShops,
      pagination: {
        page,
        limit,
        total: filteredShops.length,
        totalPages: Math.ceil(filteredShops.length / limit),
        hasNext: startIndex + limit < filteredShops.length,
        hasPrev: page > 1
      },
      filters: {
        category,
        region,
        search,
        sort
      }
    });

  } catch (error) {
    console.error('[SHOPS_DIRECTORY] Error:', error);
    return NextResponse.json(
      { 
        error: 'directory_fetch_failed', 
        message: 'Failed to fetch shop directory' 
      },
      { status: 500 }
    );
  }
}
