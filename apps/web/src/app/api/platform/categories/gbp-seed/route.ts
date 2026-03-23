/**
 * Next.js API Route Proxy for GBP Seed Data
 * 
 * Proxies requests from the frontend to the Express API backend.
 * This allows the frontend to call /api/platform/categories/gbp-seed
 * and have it automatically forwarded to the backend API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(request: NextRequest) {
  try {
    // Get optional Auth0 session
    const auth = await getAuth0Session(request);
    const accessToken = auth?.accessToken || null;
    
    console.log('[GBP Seed Proxy] Forwarding to backend');
    console.log('[GBP Seed Proxy] Auth token present:', !!accessToken);
    
    // Forward request to backend API
    const response = await authenticatedFetch('/api/platform/categories/gbp-seed', accessToken, {
      method: 'GET',
    });
    
    console.log('[GBP Seed Proxy] Backend response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch categories' }));
      console.error('[GBP Seed Proxy] Backend error:', error);
      return NextResponse.json(error, { status: response.status });
    }
    
    const data = await response.json();
    console.log('[GBP Seed Proxy] Success! Categories count:', data.categories?.length || 0);
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('[GBP Seed Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch GBP categories' },
      { status: 500 }
    );
  }
}
