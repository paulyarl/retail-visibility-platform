import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/gbp/categories/popular
 * Get popular GBP categories
 * Proxies to backend API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';
    const tenantId = searchParams.get('tenantId') || '';

    // Proxy to backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const backendUrl = `${apiUrl}/api/gbp/categories/popular?limit=${limit}&tenantId=${encodeURIComponent(tenantId)}`;
    
    const response = await fetch(backendUrl);
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[GBP Categories Popular API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get popular GBP categories' },
      { status: 500 }
    );
  }
}
