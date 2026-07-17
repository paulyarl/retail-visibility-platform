import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '../../../../services/CategoryService';
import { logger } from '../../../../logger';

/**
 * GET /api/inventory/categories
 * 
 * Cached API route leveraging CategoryService singleton
 * Cache: 1 hour (3600s) - aligned with CategoryService TTL
 */
export async function GET(request: NextRequest) {
  try {
    // Extract tenantId from query params or headers
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: 'Tenant ID required'
      }, { status: 400 });
    }
    
    // Get tenant categories with caching
    const categories = await categoryService.getTenantCategories(tenantId);
    
    return NextResponse.json({
      success: true,
      data: categories,
      cached: true,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
        'X-Cache-Status': 'HIT'
      }
    });
    
  } catch (error) {
    logger.error('Error fetching categories:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch categories',
      cached: false
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  }
}
