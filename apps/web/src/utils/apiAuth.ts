/**
 * API Authentication Utilities
 * 
 * Helper functions for authenticating API route requests using Auth0 sessions
 * Replaces legacy Bearer token extraction from cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import AuthSyncService from '@/services/AuthSyncService';
import { clientLogger } from '@/lib/client-logger';

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
    clientLogger.error('[API Auth] Failed to get Auth0 session:', { detail: error });
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
  
  // Query backend to verify platform admin status via service
  try {
    const authSyncService = AuthSyncService.getInstance();
    const user = await authSyncService.getUserByIdentifier(session.user.email);
    
    if (!user || !user.is_active || user.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json(
        { error: 'forbidden', message: 'Platform admin access required' },
        { status: 403 }
      );
    }
    
    return authResult;
  } catch (error) {
    clientLogger.error('[API Auth] Failed to verify platform admin:', { detail: error });
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
export function createAuthHeaders(
  accessToken: string | null,
  identity?: { auth0Id?: string | null; auth0Email?: string | null }
): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // The API's authenticateToken has read x-auth0-id / x-auth0-email (or the
  // auth0_email cookie) since the Auth0 migration removed the legacy Bearer
  // path (docs/auth0-migration-plan.md Phase 2). These are the same headers
  // AdminApiSingleton installs client-side from the marker cookies.
  if (identity?.auth0Id) {
    headers['x-auth0-id'] = identity.auth0Id;
  }
  if (identity?.auth0Email) {
    headers['x-auth0-email'] = identity.auth0Email;
  }

  return headers;
}

/**
 * Resolve the Auth0 identity the API authenticates with.
 *
 * `auth0.getSession()` reads the request context directly (that is why
 * `getAuth0Session(req)` above can ignore its `req` argument), so resolving it
 * here keeps every existing `authenticatedFetch` caller working without having
 * to thread the session through ~45 call sites.
 */
async function resolveAuth0Identity(): Promise<{ auth0Id: string | null; auth0Email: string | null }> {
  try {
    const session = await auth0.getSession();
    return {
      auth0Id: (session?.user?.sub as string) || null,
      auth0Email: (session?.user?.email as string) || null,
    };
  } catch (error) {
    clientLogger.error('[API Auth] Failed to resolve Auth0 identity for upstream headers:', { detail: error });
    return { auth0Id: null, auth0Email: null };
  }
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
  const apiBaseUrl = process.env.API_BASE_URL || process.env.API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const url = `${apiBaseUrl}${endpoint}`;

  const identity = await resolveAuth0Identity();
  const headers = {
    ...createAuthHeaders(accessToken, identity),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}
