import { NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

/**
 * Dashboard API - Optimized endpoint for home page
 * Proxies to backend dashboard API
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Next.js Dashboard API] Received request');
    console.log('[Next.js Dashboard API] Headers:', Object.fromEntries(request.headers.entries()));
    
    // Extract tenantId from query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    // Proxy to backend dashboard API
    const backendUrl = `/api/dashboard?tenantId=${encodeURIComponent(tenantId)}`;
    console.log('[Next.js Dashboard API] Proxying to:', backendUrl);
    const response = await proxyGet(request, backendUrl);

    console.log('[Next.js Dashboard API] Backend response status:', response.status);
    return response;
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
