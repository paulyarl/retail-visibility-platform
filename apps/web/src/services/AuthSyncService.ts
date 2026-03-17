/**
 * Auth Sync Service
 * 
 * Service for syncing Auth0 users to the local database
 * Extends FlexibleApiSingleton for server-side API operations
 */

import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { FlexibleApiSingleton, RequestTarget, RequestType } from '../providers/base/FlexibleApiSingleton';

export interface Auth0User {
  sub: string;
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
  nickname?: string;
}

export interface SyncedUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  email_verified: boolean;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
  onboarding_completed: boolean;
  onboarding_step: string | null;
}

export interface SyncResult {
  success: boolean;
  user: any | null;
  isNewUser: boolean;
}

/**
 * Service for syncing Auth0 users to the local database
 * Called after successful Auth0 login to ensure user exists in database
 * Extends FlexibleApiSingleton (not AuthenticatedApiSingleton) because it runs server-side
 */
export class AuthSyncService extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.SYSTEM;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext?: AppContext = AppContext.USER;
  protected defaultIsolation?: CacheIsolation = CacheIsolation.USER;
  private static instance: AuthSyncService;

  protected constructor() {
    super('AuthSyncService', {
      enableCache: false, // No caching for sync operations
      enableMetrics: true,
    });
  }

  static getInstance(): AuthSyncService {
    console.log('[AuthSyncService] getInstance called');
    if (!AuthSyncService.instance) {
      console.log('[AuthSyncService] Creating new instance');
      AuthSyncService.instance = new AuthSyncService();
    } else {
      console.log('[AuthSyncService] Returning existing instance');
    }
    return AuthSyncService.instance;
  }

  /**
   * Sync user from Auth0 to local database
   * Creates new user or updates existing user on login
   */
  async syncUser(auth0User: Auth0User): Promise<SyncResult> {
    console.log('[AuthSyncService] syncUser ENTRY POINT - auth0User:', auth0User.email);
    
    // Get service key for API authentication
    const serviceKey = process.env.NEXT_PUBLIC_VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.visibleshelf.store';
    
    console.log('[AuthSyncService] syncUser called', { 
      email: auth0User.email, 
      hasServiceKey: !!serviceKey,
      serviceKeyLength: serviceKey?.length,
      serviceKeyPrefix: serviceKey?.substring(0, 8) + '...',
      apiUrl,
      auth0Sub: auth0User.sub
    });
    
    // Use fetch directly to ensure headers are passed correctly
    // makeDefaultRequest was stripping custom headers
    
    try {
      const requestBody = JSON.stringify({
        auth0Id: auth0User.sub,
        email: auth0User.email.toLowerCase(),
        emailVerified: auth0User.email_verified ?? false,
        firstName: auth0User.given_name || null,
        lastName: auth0User.family_name || null,
        name: auth0User.name || null,
        picture: auth0User.picture || null,
      });
      
      console.log('[AuthSyncService] Making request to:', `${apiUrl}/api/auth/sync-user`);
      console.log('[AuthSyncService] Request body:', requestBody.substring(0, 200) + '...');
      console.log('[AuthSyncService] X-Service-Key header:', serviceKey?.substring(0, 8) + '...');
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${apiUrl}/api/auth/sync-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': serviceKey || '',
        },
        body: requestBody,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();
      
      console.log('[AuthSyncService] syncUser result:', { 
        status: response.status,
        success: data.success, 
        userId: data.user?.id,
        error: data.error
      });

      if (!response.ok || !data.success) {
        console.error('[AuthSyncService] Failed to sync user:', data);
        return {
          success: false,
          user: null,
          isNewUser: false,
        };
      }

      console.log('[AuthSyncService] User synced successfully:', data.user?.id);
      return data;
    } catch (error) {
      console.error('[AuthSyncService] syncUser error:', error);
      
      // Check if it's a timeout error
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[AuthSyncService] Request timed out after 10 seconds');
      }
      
      return {
        success: false,
        user: null,
        isNewUser: false,
      };
    }
  }

  /**
   * Get user from database by email or identifier
   */
  async getUserByIdentifier(identifier: string): Promise<SyncedUser | null> {
    const result = await this.makeDefaultRequest<{ success: boolean; user: SyncedUser }>(
      `/api/auth/lookup?identifier=${encodeURIComponent(identifier)}`,
      {},
      `user-lookup-${identifier}`,
      this.cacheTTL
    );

    if (!result.success || !result.data?.user) {
      return null;
    }

    return result.data.user;
  }
}

export default AuthSyncService;
