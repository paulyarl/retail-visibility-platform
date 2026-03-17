/**
 * Auth Sync Service
 * 
 * Service for syncing Auth0 users to the local database
 * Extends FlexibleApiSingleton for server-side API operations
 */

import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { SystemSingleton } from '../providers/base/SystemSingleton';
import { RequestTarget, RequestType } from '../providers/base/FlexibleApiSingleton';

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
 * Extends SystemSingleton for proper server-side requests
 */
export default class AuthSyncService extends SystemSingleton {
  protected defaultRequestType: RequestType = RequestType.SYSTEM;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext: AppContext = AppContext.USER;
  protected defaultIsolation: CacheIsolation = CacheIsolation.USER;
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
    
    try {
      const result = await this.makeApiRequest<SyncResult>('/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
        },
        body: JSON.stringify({
          auth0Id: auth0User.sub,
          email: auth0User.email.toLowerCase(),
          emailVerified: auth0User.email_verified ?? false,
          firstName: auth0User.given_name || null,
          lastName: auth0User.family_name || null,
          name: auth0User.name || null,
          picture: auth0User.picture || null,
          nickname: auth0User.nickname,
        }),
      }, `auth-sync-${auth0User.sub}`, 0); // Don't cache sync operations
      
      console.log('[AuthSyncService] syncUser result:', { 
        success: result.success, 
        userId: result.data?.user?.id, 
        isNewUser: result.data?.isNewUser 
      });
      
      if (!result.success || !result.data) {
        return { success: false, user: null, isNewUser: false };
      }
      
      return result.data;
      
    } catch (error) {
      console.error('[AuthSyncService] syncUser error:', error);
      return { success: false, user: null, isNewUser: false };
    }
  }

  /**
   * Get user from database by email or identifier
   */
  async getUserByIdentifier(identifier: string): Promise<SyncedUser | null> {
    const result = await this.makeApiRequest<{ success: boolean; user: SyncedUser }>(
      `/api/auth/lookup?identifier=${encodeURIComponent(identifier)}`,
      {},
      `user-lookup-${identifier}`,
      0 // Don't cache user lookups
    );

    if (!result.success || !result.data?.user) {
      return null;
    }

    return result.data.user;
  }
}