/**
 * Shop Details API Route
 * Universal Singleton aligned endpoint for individual shop information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'authentication_required', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Mock shop data - in production this would query the database
    const mockShop = {
      id: id,
      tenantId: id,
      autoId: id,
      name: `Shop ${id}`,
      description: `Description for shop ${id}`,
      imageUrl: '/api/placeholder/300/200',
      rating: 4.5,
      reviewCount: 100,
      location: 'New York, NY',
      category: 'Electronics',
      isVerified: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      settings: {},
      metadata: {},
      users: [],
      productCount: 50
    };

    if (!mockShop) {
      return NextResponse.json(
        { error: 'shop_not_found', message: 'Shop not found' },
        { status: 404 }
      );
    }

    // Transform to match Shop interface
    const transformedShop = {
      ...mockShop,
      urls: {
        canonicalUrl: `/shops/${mockShop.autoId}`,
        slugUrl: `/shops/${mockShop.autoId}`,
        tenantIdUrl: `/t/${mockShop.id}`,
        autoIdUrl: `/shops/${mockShop.autoId}`
      }
    };

    return NextResponse.json({
      success: true,
      data: transformedShop
    });

  } catch (error) {
    console.error('[SHOP_DETAILS] Error:', error);
    return NextResponse.json(
      { 
        error: 'shop_fetch_failed', 
        message: 'Failed to fetch shop details' 
      },
      { status: 500 }
    );
  }
}
