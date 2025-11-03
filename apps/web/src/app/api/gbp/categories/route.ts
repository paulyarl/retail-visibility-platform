import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/featureFlags';

// Stub GBP category data until real GBP API is wired
const STUB_GBP_CATEGORIES = [
  { id: 'gcid:grocery_store', name: 'Grocery store', path: ['Food & Drink', 'Grocery store'] },
  { id: 'gcid:restaurant', name: 'Restaurant', path: ['Food & Drink', 'Restaurant'] },
  { id: 'gcid:cafe', name: 'Cafe', path: ['Food & Drink', 'Cafe'] },
  { id: 'gcid:bakery', name: 'Bakery', path: ['Food & Drink', 'Bakery'] },
  { id: 'gcid:bar', name: 'Bar', path: ['Food & Drink', 'Bar'] },
  { id: 'gcid:clothing_store', name: 'Clothing store', path: ['Shopping', 'Clothing store'] },
  { id: 'gcid:shoe_store', name: 'Shoe store', path: ['Shopping', 'Shoe store'] },
  { id: 'gcid:electronics_store', name: 'Electronics store', path: ['Shopping', 'Electronics store'] },
  { id: 'gcid:furniture_store', name: 'Furniture store', path: ['Shopping', 'Furniture store'] },
  { id: 'gcid:hardware_store', name: 'Hardware store', path: ['Shopping', 'Hardware store'] },
  { id: 'gcid:book_store', name: 'Book store', path: ['Shopping', 'Book store'] },
  { id: 'gcid:pharmacy', name: 'Pharmacy', path: ['Health', 'Pharmacy'] },
  { id: 'gcid:gym', name: 'Gym', path: ['Health', 'Gym'] },
  { id: 'gcid:spa', name: 'Spa', path: ['Health', 'Spa'] },
  { id: 'gcid:hair_salon', name: 'Hair salon', path: ['Beauty', 'Hair salon'] },
  { id: 'gcid:beauty_salon', name: 'Beauty salon', path: ['Beauty', 'Beauty salon'] },
];

/**
 * GET /api/gbp/categories?query=...
 * Search GBP business categories
 * Feature-gated by FF_TENANT_GBP_CATEGORY_SYNC
 */
export async function GET(request: NextRequest) {
  try {
    // Feature gate - check with tenant ID from header or query param
    const tenantId = request.headers.get('x-tenant-id') || 
                     new URL(request.url).searchParams.get('tenantId') || 
                     undefined;
    
    // For now, allow if feature is enabled globally or for specific tenant
    // In production, this would check user permissions
    const featureEnabled = isFeatureEnabled('FF_TENANT_GBP_CATEGORY_SYNC', tenantId);
    
    if (!featureEnabled) {
      console.log('[GBP Categories API] Feature not enabled for tenant:', tenantId);
      return NextResponse.json(
        { error: 'GBP category sync not enabled' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Filter stub data by query
    const filtered = query
      ? STUB_GBP_CATEGORIES.filter(
          (cat) =>
            cat.name.toLowerCase().includes(query.toLowerCase()) ||
            cat.path.some((p) => p.toLowerCase().includes(query.toLowerCase()))
        )
      : STUB_GBP_CATEGORIES;

    const results = filtered.slice(0, limit);

    return NextResponse.json({
      items: results,
      totalCount: filtered.length,
      // TODO: Add nextPageToken when real GBP API is integrated
    });
  } catch (error) {
    console.error('[GBP Categories API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search GBP categories' },
      { status: 500 }
    );
  }
}
