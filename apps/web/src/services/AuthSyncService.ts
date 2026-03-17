/**
 * Auth Sync Service
 * 
 * Service for syncing Auth0 users to the local database
 * Extends AuthenticatedApiSingleton for authenticated API operations
 */

import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

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
  user: SyncedUser | null;
  isNewUser: boolean;
}

/**
 * Service for syncing Auth0 users to the local database
 * Called after successful Auth0 login to ensure user exists in database
 */
export class AuthSyncService extends AuthenticatedApiSingleton {
  private static instance: AuthSyncService;

  protected constructor() {
    super('AuthSyncService', {
      enableCache: false, // No caching for sync operations
      enableMetrics: true,
    });
  }

  static getInstance(): AuthSyncService {
    if (!AuthSyncService.instance) {
      AuthSyncService.instance = new AuthSyncService();
    }
    return AuthSyncService.instance;
  }

  /**
   * Sync user from Auth0 to local database
   * Creates new user or updates existing user on login
   */
  async syncUser(auth0User: Auth0User): Promise<SyncResult> {
    const result = await this.makeDefaultRequest<SyncResult>(
      '/api/auth/sync-user',
      {
        method: 'POST',
        body: JSON.stringify({
          auth0Id: auth0User.sub,
          email: auth0User.email.toLowerCase(),
          emailVerified: auth0User.email_verified ?? false,
          firstName: auth0User.given_name || null,
          lastName: auth0User.family_name || null,
          name: auth0User.name || null,
          picture: auth0User.picture || null,
        }),
      },
      undefined, // No cache key - sync operations should not be cached
      undefined // No TTL
    );

    if (!result.success) {
      console.error('[AuthSyncService] Failed to sync user:', result.error);
      return {
        success: false,
        user: null,
        isNewUser: false,
      };
    }

    console.log('[AuthSyncService] User synced successfully:', result.data?.user?.id);
    return result.data || { success: false, user: null, isNewUser: false };
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
