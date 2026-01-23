/**
 * User Identification Utility
 * 
 * Follows the behavior tracking pattern for detecting user ID and session ID
 * Can be used for encryption, caching, and operation tracking
 */

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
 */
export function getUserIdentification(): UserIdentification {
  // Default to anonymous
  let userId: string | undefined;
  let sessionId: string | undefined;
  let identificationMethod: 'user_id' | 'session_id' | 'anonymous' = 'anonymous';

  try {
    // Get user information from localStorage (set by auth context)
    // This matches the behavior tracking pattern exactly
    const authUser = localStorage.getItem('auth_user_cache');
    
    if (authUser) {
      const decrypted = decrypt(authUser);
      const parsed = JSON.parse(decrypted);
      if (parsed?.user?.id) {
        userId = parsed.user.id;
        identificationMethod = 'user_id';
      }
    }
    
    // For anonymous users, get or create session ID
    if (!userId) {
      let lastViewedSession = localStorage.getItem('lastViewedSessionId');
      if (!lastViewedSession) {
        // Create new session ID if it doesn't exist
        // Matches behavior tracking session ID format
        lastViewedSession = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('lastViewedSessionId', lastViewedSession);
        console.log('[UserIdentification] Created new session ID:', lastViewedSession);
      }
      sessionId = lastViewedSession;
      identificationMethod = 'session_id';
    }
  } catch (error) {
    console.error('[UserIdentification] Error getting user data:', error);
    // Fallback to anonymous with new session
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('lastViewedSessionId', sessionId);
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
    // Clear session ID
    localStorage.removeItem('lastViewedSessionId');
    console.log('[UserIdentification] Cleared session ID');
  } catch (error) {
    console.error('[UserIdentification] Error clearing identification:', error);
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
    
    console.log('[UserIdentification] Auto-detected:', {
      method: identification.identificationMethod,
      userId: resolved.userId,
      isAuthenticated: identification.isAuthenticated
    });
  }

  // Remove our internal flags
  delete resolved.useAutoUser;
  delete resolved.preferSessionId;

  return resolved;
}
