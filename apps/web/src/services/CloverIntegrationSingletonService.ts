/**
 * Clover Integration Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached Clover integration operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

interface CloverIntegrationData {
  enabled: boolean;
  mode: 'demo' | 'production' | null;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  demoEnabledAt?: string;
  demoLastActiveAt?: string;
  lastSyncAt?: string;
}

interface CloverOAuthData {
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

class CloverIntegrationSingletonService extends AuthenticatedApiSingleton {
  private static instance: CloverIntegrationSingletonService;

  private constructor() {
    super('clover-integration-singleton');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for integration data (changes moderately)
  }

  public static getInstance(): CloverIntegrationSingletonService {
    if (!CloverIntegrationSingletonService.instance) {
      CloverIntegrationSingletonService.instance = new CloverIntegrationSingletonService();
    }
    return CloverIntegrationSingletonService.instance;
  }

  /**
   * Get Clover integration status
   */
  async getCloverStatus(tenantId: string): Promise<CloverIntegrationData | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<CloverIntegrationData>(
        `/api/integrations/${tenantId}/clover/status`,
        {},
        `clover-status-${tenantId}`
      );

      return result || null;
    } catch (error) {
      console.error('[CloverIntegrationSingleton] Failed to get Clover status:', error);
      return null;
    }
  }

  /**
   * Get Clover OAuth authorization URL
   */
  async getCloverOAuthAuthorize(tenantId: string): Promise<CloverOAuthData | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<CloverOAuthData>(
        `/api/integrations/${tenantId}/clover/oauth/authorize`,
        {},
        `clover-oauth-${tenantId}`
      );

      return result || null;
    } catch (error) {
      console.error('[CloverIntegrationSingleton] Failed to get Clover OAuth authorize:', error);
      return null;
    }
  }

  /**
   * Enable Clover demo mode
   */
  async enableCloverDemo(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/integrations/${tenantId}/clover/demo/enable`,
        { method: 'POST' },
        `clover-demo-enable-${tenantId}`
      );

      // Invalidate Clover status cache
      await this.invalidateCache(`clover-status-${tenantId}*`);
    } catch (error) {
      console.error('[CloverIntegrationSingleton] Failed to enable Clover demo:', error);
      throw error;
    }
  }

  /**
   * Disable Clover demo mode
   */
  async disableCloverDemo(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/integrations/${tenantId}/clover/demo/disable`,
        { method: 'POST' },
        `clover-demo-disable-${tenantId}`
      );

      // Invalidate Clover status cache
      await this.invalidateCache(`clover-status-${tenantId}*`);
    } catch (error) {
      console.error('[CloverIntegrationSingleton] Failed to disable Clover demo:', error);
      throw error;
    }
  }

  /**
   * Disconnect Clover integration
   */
  async disconnectClover(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/integrations/${tenantId}/clover/disconnect`,
        { method: 'POST' },
        `clover-disconnect-${tenantId}`
      );

      // Invalidate all Clover cache for this tenant
      await this.invalidateCache(`clover-${tenantId}*`);
    } catch (error) {
      console.error('[CloverIntegrationSingleton] Failed to disconnect Clover:', error);
      throw error;
    }
  }

  /**
   * Sync Clover data
   */
  async syncClover(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/integrations/${tenantId}/clover/sync`,
        { method: 'POST' },
        `clover-sync-${tenantId}`
      );

      // Invalidate Clover status cache to reflect sync results
      await this.invalidateCache(`clover-status-${tenantId}*`);
    } catch (error) {
      console.error('[CloverIntegrationSingleton] Failed to sync Clover:', error);
      throw error;
    }
  }

  /**
   * Invalidate Clover integration cache for a specific tenant
   */
  public async invalidateCloverCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`clover-${tenantId}*`);
  }

  /**
   * Invalidate all Clover integration cache
   */
  public async invalidateAllCloverCache(): Promise<void> {
    await this.invalidateCache('clover-*');
  }
}

// Export singleton instance
export const cloverIntegrationService = CloverIntegrationSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateCloverCache = async (tenantId: string): Promise<void> => {
  const service = CloverIntegrationSingletonService.getInstance();
  await service.invalidateCloverCache(tenantId);
};

export const invalidateAllCloverCache = async (): Promise<void> => {
  const service = CloverIntegrationSingletonService.getInstance();
  await service.invalidateAllCloverCache();
};
