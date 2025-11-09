import { NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

/**
 * User Profile API - Get current user's comprehensive profile
 * Proxies to backend /user/profile endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const response = await proxyGet(request, '/user/profile');
    return response;
  } catch (error) {
    console.error('[User Profile API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
