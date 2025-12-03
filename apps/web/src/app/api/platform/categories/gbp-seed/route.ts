/**
 * Next.js API Route Proxy for GBP Seed Data
 * 
 * Proxies requests from the frontend to the Express API backend.
 * This allows the frontend to call /api/platform/categories/gbp-seed
 * and have it automatically forwarded to the backend API.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies (try both possible names)
    const authToken = request.cookies.get('auth_token')?.value || 
                     request.cookies.get('access_token')?.value;
    
    // Get all cookies to forward
    const cookieHeader = request.headers.get('cookie');
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header if token exists
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Forward all cookies (includes auth_token, csrf, etc.)
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
    
    console.log('[GBP Seed Proxy] Forwarding to:', `${API_BASE_URL}/api/platform/categories/gbp-seed`);
    console.log('[GBP Seed Proxy] Auth token present:', !!authToken);
    
    // Forward request to backend API
    const response = await fetch(`${API_BASE_URL}/api/platform/categories/gbp-seed`, {
      method: 'GET',
      headers,
      credentials: 'include',
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
