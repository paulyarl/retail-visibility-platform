/**
 * Auth0 Identity Extraction Utility
 * 
 * Extracts user identity from Auth0 session for behavior tracking and recommendations.
 * Supports both authenticated users (via Auth0 session) and anonymous users (via session ID).
 * 
 * Usage:
 *   const identity = await extractTrackingIdentity(req);
 *   // identity.userId - Auth0 user.sub if authenticated, null if anonymous
 *   // identity.sessionId - Always present (from Auth0 session or generated)
 *   // identity.isAuthenticated - Boolean indicating auth status
 */

import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';

export interface TrackingIdentity {
  userId: string | null;           // Auth0 user.sub if authenticated, null if anonymous
  sessionId: string;               // Session ID (always present)
  isAuthenticated: boolean;        // Whether user is authenticated via Auth0
  tenantId?: string;               // Tenant ID if available from user's account
  email?: string;                  // User email if authenticated
  role?: string;                   // User role if authenticated
}

// Cookie names used by Auth0 Next.js SDK
const AUTH0_SESSION_COOKIE = 'appSession';
const AUTH0_SID_COOKIE = 'auth0_sid';

/**
 * Extract tracking identity from Auth0 session or request headers
 * 
 * This function attempts to identify users in the following order:
 * 1. Check for Auth0 session cookie and validate
 * 2. Check for X-User-Id header (set by web app middleware)
 * 3. Fall back to anonymous session ID
 */
export async function extractTrackingIdentity(req: Request): Promise<TrackingIdentity> {
  let userId: string | null = null;
  let sessionId: string;
  let isAuthenticated = false;
  let tenantId: string | undefined;
  let email: string | undefined;
  let role: string | undefined;

  // Method 1: Check for user context set by middleware (if web app forwards user info)
  const headerUserId = req.headers['x-user-id'] as string;
  const headerUserEmail = req.headers['x-user-email'] as string;
  const headerUserRole = req.headers['x-user-role'] as string;
  const headerTenantId = req.headers['x-tenant-id'] as string;
  const headerSessionId = req.headers['x-session-id'] as string;
  const headerIsAuthenticated = req.headers['x-is-authenticated'] === 'true';

  if (headerUserId && headerIsAuthenticated) {
    // User info already extracted by web app middleware
    userId = headerUserId;
    email = headerUserEmail;
    role = headerUserRole;
    tenantId = headerTenantId;
    sessionId = headerSessionId || generateSessionId();
    isAuthenticated = true;

    return {
      userId,
      sessionId,
      isAuthenticated,
      tenantId,
      email,
      role
    };
  }

  // Method 2: Check for existing req.user (set by previous auth middleware)
  const reqUser = (req as any).user;
  if (reqUser?.user_id || reqUser?.sub || reqUser?.id) {
    userId = reqUser.user_id || reqUser.sub || reqUser.id;
    email = reqUser.email;
    role = reqUser.role;
    tenantId = reqUser.tenantId || reqUser.tenant_ids?.[0];
    sessionId = headerSessionId || reqUser.sessionId || generateSessionId();
    isAuthenticated = true;

    return {
      userId,
      sessionId,
      isAuthenticated,
      tenantId,
      email,
      role
    };
  }

  // Method 3: Look up user by email from Auth0 session cookie
  // This requires the web app to forward the session cookie
  const sessionCookie = extractCookie(req, AUTH0_SESSION_COOKIE);
  if (sessionCookie && process.env.AUTH0_SECRET) {
    try {
      // Attempt to verify and decode the Auth0 session
      const session = await verifyAuth0Session(sessionCookie);
      if (session?.user) {
        userId = session.user.sub;
        email = session.user.email;
        
        // Look up user in database for additional context
        if (email) {
          const dbUser = await prisma.users.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, role: true }
          });
          
          if (dbUser) {
            // Use database user ID instead of Auth0 sub for consistency
            userId = dbUser.id;
            role = dbUser.role;
            
            // Get first tenant from user_tenants relation
            const userTenant = await prisma.user_tenants.findFirst({
              where: { user_id: dbUser.id },
              select: { tenant_id: true }
            });
            tenantId = userTenant?.tenant_id || undefined;
          }
        }
        
        sessionId = session.id || headerSessionId || generateSessionId();
        isAuthenticated = true;

        return {
          userId,
          sessionId,
          isAuthenticated,
          tenantId,
          email,
          role
        };
      }
    } catch (error) {
      // Session verification failed - treat as anonymous
      console.debug('[Auth0Identity] Session verification failed:', error);
    }
  }

  // Method 4: Anonymous user - generate or extract session ID
  sessionId = headerSessionId || 
              extractCookie(req, 'session_id') ||
              extractCookie(req, AUTH0_SID_COOKIE) ||
              (req as any).sessionID ||
              generateSessionId();

  return {
    userId: null,
    sessionId,
    isAuthenticated: false,
    tenantId: headerTenantId // May have tenant context even for anonymous users
  };
}

/**
 * Extract a specific cookie value from the request
 */
function extractCookie(req: Request, cookieName: string): string | null {
  const cookies = req.headers.cookie?.split(';') || [];
  const cookie = cookies.find(c => c.trim().startsWith(`${cookieName}=`));
  return cookie?.split('=')[1]?.trim() || null;
}

/**
 * Generate a unique session ID for anonymous users
 */
function generateSessionId(): string {
  return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Verify and decode Auth0 session cookie
 * 
 * Note: This requires AUTH0_SECRET to be set in the API environment
 * The session structure depends on the Auth0 Next.js SDK version
 */
async function verifyAuth0Session(sessionCookie: string): Promise<any> {
  // For Auth0 Next.js SDK v4, sessions are encrypted with AUTH0_SECRET
  // The actual verification would require the jose library or Auth0 SDK
  
  // If Auth0 SDK is available on API side:
  try {
    // Dynamic import to avoid errors if not installed
    const { Auth0Client } = await import('@auth0/nextjs-auth0/server');
    
    // This would require the full request/response objects
    // For now, we'll return null and rely on header-based auth
    return null;
  } catch {
    // Auth0 SDK not available on API side
    return null;
  }
}

/**
 * Get user's database ID from Auth0 sub
 * 
 * Maps Auth0 user.sub to the local database user ID
 */
export async function getDbUserIdFromAuth0(auth0Sub: string): Promise<string | null> {
  try {
    // Auth0 sub format: "provider|id" (e.g., "google-oauth2|123456")
    // We need to find the user by their email (Auth0 sub is stored in session, not DB)
    
    // For now, we can only find users by email which requires calling Auth0 Management API
    // This is a placeholder - in production, you'd store auth0_id in users table
    // or call Auth0 Management API to get email from sub
    
    return null;
  } catch (error) {
    logger.error('[Auth0Identity] Error getting DB user ID:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

/**
 * Middleware to attach tracking identity to request
 * 
 * Usage:
 *   app.use(attachTrackingIdentity);
 *   // Then in route handlers: req.trackingIdentity
 */
export function attachTrackingIdentity(req: Request, res: Response, next: Function) {
  extractTrackingIdentity(req)
    .then(identity => {
      (req as any).trackingIdentity = identity;
      next();
    })
    .catch(error => {
      logger.error('[Auth0Identity] Error attaching tracking identity:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      // Continue with anonymous identity
      (req as any).trackingIdentity = {
        userId: null,
        sessionId: generateSessionId(),
        isAuthenticated: false
      };
      next();
    });
}

/**
 * Helper to create a tracking identity from a known user
 * Useful for testing or when user is already known
 */
export function createTrackingIdentity(
  userId: string | null,
  sessionId?: string,
  options?: {
    tenantId?: string;
    email?: string;
    role?: string;
  }
): TrackingIdentity {
  return {
    userId,
    sessionId: sessionId || generateSessionId(),
    isAuthenticated: userId !== null,
    tenantId: options?.tenantId,
    email: options?.email,
    role: options?.role
  };
}

export default {
  extractTrackingIdentity,
  attachTrackingIdentity,
  createTrackingIdentity,
  getDbUserIdFromAuth0
};
