import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 20 } = body;

    // Mock shop search implementation
    // In a real implementation, this would query your database
    const mockShops = [
      {
        id: 'shop-1',
        name: 'Sample Shop 1',
        slug: 'sample-shop-1',
        description: 'A sample shop for testing',
        logo_url: null,
        is_active: true,
        tenant_id: 'tenant-1'
      },
      {
        id: 'shop-2', 
        name: 'Sample Shop 2',
        slug: 'sample-shop-2',
        description: 'Another sample shop',
        logo_url: null,
        is_active: true,
        tenant_id: 'tenant-2'
      }
    ];

    // Filter by query if provided
    const filteredShops = query 
      ? mockShops.filter(shop => 
          shop.name.toLowerCase().includes(query.toLowerCase()) ||
          shop.description.toLowerCase().includes(query.toLowerCase())
        )
      : mockShops;

    // Apply limit
    const limitedShops = filteredShops.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: limitedShops
    });
  } catch (error) {
    console.error('[Shops Search API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search shops' },
      { status: 500 }
    );
  }
}
