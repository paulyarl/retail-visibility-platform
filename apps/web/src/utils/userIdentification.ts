import { clientLogger } from '@/lib/client-logger';

/**
 * User Identification Utility
 * 
 * Follows the behavior tracking pattern for detecting user ID and session ID
 * Can be used for encryption, caching, and operation tracking
 */

// In-memory cache to prevent race conditions when multiple calls happen simultaneously
let cachedSessionId: string | null = null;
let cachedUserId: string | null = null;
let identificationCacheExpiry: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

// Simple decryption for client-side caching (matches AuthContext and behaviorTracking)
function decrypt(text: string): string {
  try {
    return decodeURIComponent(atob(text));
  } catch {
    return text;
  }
}

export interface UserIdentification {
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
  identificationMethod: 'user_id' | 'session_id' | 'anonymous';
}

/**
 * Get current user identification following behavior tracking pattern
 * 
 * Priority:
 * 1. Authenticated user ID from localStorage
 * 2. Existing session ID from localStorage  
 * 3. New session ID generated
 * 
 * Uses in-memory cache to prevent race conditions when called multiple times
 */
export function getUserIdentification(): UserIdentification {
  // Default to anonymous
  let userId: string | undefined;
  let sessionId: string | undefined;
  let identificationMethod: 'user_id' | 'session_id' | 'anonymous' = 'anonymous';

  // Check in-memory cache first (prevents race conditions)
  const now = Date.now();
  if (now < identificationCacheExpiry && (cachedSessionId || cachedUserId)) {
    if (cachedUserId) {
      return {
        userId: cachedUserId,
        sessionId: undefined,
        isAuthenticated: true,
        identificationMethod: 'user_id'
      };
    }
    if (cachedSessionId) {
      return {
        userId: undefined,
        sessionId: cachedSessionId,
        isAuthenticated: false,
        identificationMethod: 'session_id'
      };
    }
  }

  try {
    // Get user information from localStorage (set by auth context)
    // This matches the behavior tracking pattern exactly
    // Only access localStorage on client side
    const authUser = typeof window !== 'undefined' ? localStorage.getItem('auth_user_cache') : null;
    
    if (authUser) {
      const decrypted = decrypt(authUser);
      const parsed = JSON.parse(decrypted);
      if (parsed?.user?.id) {
        userId = parsed.user.id;
        identificationMethod = 'user_id';
        cachedUserId = userId || null;
        identificationCacheExpiry = now + CACHE_TTL_MS;
      }
    }
    
    // For anonymous users, get or create session ID
    if (!userId) {
      let lastViewedSession = typeof window !== 'undefined' ? localStorage.getItem('lastViewedSessionId') : null;
      
      // Also check in-memory cache for session (handles race condition)
      if (!lastViewedSession && cachedSessionId) {
        lastViewedSession = cachedSessionId;
      }
      
      if (!lastViewedSession) {
        // Create new session ID if it doesn't exist
        // Matches behavior tracking session ID format
        lastViewedSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastViewedSessionId', lastViewedSession);
        }
        // console.log('[UserIdentification] Created new session ID:', lastViewedSession);
      }
      sessionId = lastViewedSession;
      identificationMethod = 'session_id';
      cachedSessionId = sessionId;
      identificationCacheExpiry = now + CACHE_TTL_MS;
    }
  } catch (error) {
    clientLogger.error('[UserIdentification] Error getting user data:', { detail: error });
    // Fallback to anonymous with new session (use cached if available)
    if (cachedSessionId) {
      sessionId = cachedSessionId;
    } else {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastViewedSessionId', sessionId);
      }
      cachedSessionId = sessionId;
    }
  }

  return {
    userId,
    sessionId,
    isAuthenticated: !!userId,
    identificationMethod
  };
}

/**
 * Get user ID for encryption purposes
 * Returns user ID if authenticated, otherwise session ID
 */
export function getEncryptionUserId(): string {
  const identification = getUserIdentification();
  
  // Use user ID for authenticated users, session ID for anonymous
  return identification.userId || identification.sessionId || 'anonymous';
}

/**
 * Check if current user is authenticated
 */
export function isUserAuthenticated(): boolean {
  const identification = getUserIdentification();
  return identification.isAuthenticated;
}

/**
 * Get session ID (creates new one if doesn't exist)
 */
export function getSessionId(): string {
  const identification = getUserIdentification();
  return identification.sessionId || 'anonymous';
}

/**
 * Clear user identification (useful for logout)
 */
export function clearUserIdentification(): void {
  try {
    // Clear localStorage
    localStorage.removeItem('lastViewedSessionId');
    
    // Clear in-memory cache
    cachedSessionId = null;
    cachedUserId = null;
    identificationCacheExpiry = 0;
    
    // console.log('[UserIdentification] Cleared session ID');
  } catch (error) {
    clientLogger.error('[UserIdentification] Error clearing identification:', { detail: error });
  }
}

/**
 * Enhanced cache options with automatic user identification
 */
export interface AutoUserCacheOptions {
  encrypt?: boolean;
  useAutoUser?: boolean; // Auto-detect user/session ID
  userId?: string; // Manual override
  preferSessionId?: boolean; // Use session ID even for authenticated users
  ttl?: number; // Time to live in milliseconds
}

/**
 * Resolve cache options with automatic user identification
 */
export function resolveCacheOptions(options: AutoUserCacheOptions = {}) {
  const resolved: any = { ...options };

  // Auto-detect user ID if requested
  if (options.useAutoUser && !options.userId) {
    const identification = getUserIdentification();
    
    if (options.preferSessionId) {
      // Always use session ID when preferSessionId is true
      resolved.userId = identification.sessionId;
    } else {
      // Use user ID for authenticated users, session ID for anonymous
      resolved.userId = getEncryptionUserId();
    }
    
    /* console.log('[UserIdentification] Auto-detected:', {
      method: identification.identificationMethod,
      userId: resolved.userId,
      isAuthenticated: identification.isAuthenticated
    }); */
  }

  // Remove our internal flags
  delete resolved.useAutoUser;
  delete resolved.preferSessionId;

  return resolved;
}
