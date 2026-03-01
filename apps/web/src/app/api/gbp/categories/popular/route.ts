import { NextRequest, NextResponse } from 'next/server';
import { googleIntegrationService } from '@/services/GoogleIntegrationService';

/**
 * GET /api/gbp/categories/popular
 * Get popular GBP categories
 * Proxies to backend API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const tenantId = searchParams.get('tenantId') || '';

    const categories = await googleIntegrationService.getPopularCategories(limit, tenantId);
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('[GBP Categories Popular API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get popular GBP categories' },
      { status: 500 }
    );
  }
}
