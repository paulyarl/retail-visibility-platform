import { NextRequest, NextResponse } from 'next/server';
import { authenticatedFetch } from '@/utils/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryIds = searchParams.get('categoryIds');

    if (!categoryIds) {
      return NextResponse.json(
        { error: 'Missing required parameter: categoryIds' },
        { status: 400 }
      );
    }

    // Public endpoint - no authentication required for GBP mappings
    const response = await authenticatedFetch(`/api/gbp/mappings?categoryIds=${encodeURIComponent(categoryIds)}`, null, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[GBP Mappings Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category mappings' },
      { status: 500 }
    );
  }
}
