/**
 * API Authentication Utilities
 * 
 * Helper functions for authenticating API route requests using Auth0 sessions
 * Replaces legacy Bearer token extraction from cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

/**
 * Get Auth0 session and access token for API authentication
 * Returns null if not authenticated
 */
export async function getAuth0Session(req: NextRequest): Promise<{
  session: any;
  accessToken: string | null;
} | null> {
  try {
    const session = await auth0.getSession();
    
    if (!session?.user) {
      return null;
    }
    
    // Get access token from Auth0 session
    const accessToken = await auth0.getAccessToken();
    
    return {
      session,
      accessToken: accessToken?.token || null
    };
  } catch (error) {
    console.error('[API Auth] Failed to get Auth0 session:', error);
    return null;
  }
}

/**
 * Check if request is authenticated via Auth0 session
 * Returns 401 response if not authenticated
 */
export async function requireAuth(req: NextRequest): Promise<{
  session: any;
  accessToken: string | null;
} | NextResponse> {
  const auth = await getAuth0Session(req);
  
  if (!auth) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }
  
  return auth;
}

/**
 * Check if user is platform admin
 * Returns 403 response if not admin
 */
export async function requirePlatformAdmin(req: NextRequest): Promise<{
  session: any;
  accessToken: string | null;
} | NextResponse> {
  const authResult = await requireAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  // Check if user has platform admin role
  const session = authResult.session;
  
  // Query backend to verify platform admin status
  try {
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    const response = await fetch(`${apiBaseUrl}/api/auth/lookup?identifier=${encodeURIComponent(session.user.email)}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Access denied' },
        { status: 403 }
      );
    }
    
    const result = await response.json();
    const user = result.user;
    
    if (!user || !user.is_active || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Platform admin access required' },
        { status: 403 }
      );
    }
    
    return authResult;
  } catch (error) {
    console.error('[API Auth] Failed to verify platform admin:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to verify permissions' },
      { status: 500 }
    );
  }
}

/**
 * Create authenticated fetch headers for backend API calls
 * Uses Auth0 access token if available, falls back to session-based auth
 */
export function createAuthHeaders(accessToken: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  return headers;
}

/**
 * Make authenticated API request to backend
 * Handles authentication and error responses
 */
export async function authenticatedFetch(
  endpoint: string,
  accessToken: string | null,
  options: RequestInit = {}
): Promise<Response> {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  const url = `${apiBaseUrl}${endpoint}`;
  
  const headers = {
    ...createAuthHeaders(accessToken),
    ...options.headers,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
}
