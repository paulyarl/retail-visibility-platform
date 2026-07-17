/**
 * Clover Integration Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached Clover integration operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { clientLogger } from '@/lib/client-logger';

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
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<CloverIntegrationData>(
      `/api/integrations/${tenantId}/clover/status`,
      {},
      `clover-status-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[CloverIntegrationSingleton] Failed to get Clover status:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get Clover OAuth authorization URL
   */
  async getCloverOAuthAuthorize(tenantId: string): Promise<CloverOAuthData | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<CloverOAuthData>(
      `/api/integrations/${tenantId}/clover/oauth/authorize`,
      {},
      `clover-oauth-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[CloverIntegrationSingleton] Failed to get Clover OAuth authorize:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Enable Clover demo mode
   */
  async enableCloverDemo(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/integrations/${tenantId}/clover/demo/enable`,
      { method: 'POST' },
      `clover-demo-enable-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[CloverIntegrationSingleton] Failed to enable Clover demo:', { detail: result.error });
      throw result.error;
    }

    // Invalidate Clover status cache
    await this.invalidateCache(`clover-status-${tenantId}*`);
  }

  /**
   * Disable Clover demo mode
   */
  async disableCloverDemo(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/integrations/${tenantId}/clover/demo/disable`,
      { method: 'POST' },
      `clover-demo-disable-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[CloverIntegrationSingleton] Failed to disable Clover demo:', { detail: result.error });
      throw result.error;
    }

    // Invalidate Clover status cache
    await this.invalidateCache(`clover-status-${tenantId}*`);
  }

  /**
   * Disconnect Clover integration
   */
  async disconnectClover(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/integrations/${tenantId}/clover/disconnect`,
      { method: 'POST' },
      `clover-disconnect-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[CloverIntegrationSingleton] Failed to disconnect Clover:', { detail: result.error });
      throw result.error;
    }

    // Invalidate Clover status cache
    await this.invalidateCache(`clover-status-${tenantId}*`);
  }

  /**
   * Sync Clover data
   */
  async syncClover(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/integrations/${tenantId}/clover/sync`,
      { method: 'POST' },
      `clover-sync-${tenantId}`
    );

    if (!result.success) {
      clientLogger.error('[CloverIntegrationSingleton] Failed to sync Clover:', { detail: result.error });
      throw result.error;
    }

    // Invalidate Clover status cache
    await this.invalidateCache(`clover-status-${tenantId}*`);
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
