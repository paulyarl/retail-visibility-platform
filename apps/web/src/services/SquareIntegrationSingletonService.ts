/**
 * Square Integration Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached Square integration operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

interface SquareIntegrationData {
  enabled: boolean;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  lastSyncAt?: string;
  merchantId?: string;
}

interface SquareOAuthData {
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

class SquareIntegrationSingletonService extends AuthenticatedApiSingleton {
  private static instance: SquareIntegrationSingletonService;

  private constructor() {
    super('square-integration-singleton');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for integration data (changes moderately)
  }

  public static getInstance(): SquareIntegrationSingletonService {
    if (!SquareIntegrationSingletonService.instance) {
      SquareIntegrationSingletonService.instance = new SquareIntegrationSingletonService();
    }
    return SquareIntegrationSingletonService.instance;
  }

  /**
   * Get Square integration status
   */
  async getSquareStatus(tenantId: string): Promise<SquareIntegrationData | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<SquareIntegrationData>(
        `/api/integrations/${tenantId}/square/status`,
        {},
        `square-status-${tenantId}`
      );

      return result || null;
    } catch (error) {
      console.error('[SquareIntegrationSingleton] Failed to get Square status:', error);
      return null;
    }
  }

  /**
   * Get Square OAuth authorization URL
   */
  async getSquareOAuthAuthorize(tenantId: string): Promise<SquareOAuthData | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<SquareOAuthData>(
        `/api/integrations/${tenantId}/square/oauth/authorize`,
        {},
        `square-oauth-${tenantId}`
      );

      return result || null;
    } catch (error) {
      console.error('[SquareIntegrationSingleton] Failed to get Square OAuth authorize:', error);
      return null;
    }
  }

  /**
   * Disconnect Square integration
   */
  async disconnectSquare(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/integrations/${tenantId}/square/disconnect`,
        { method: 'POST' },
        `square-disconnect-${tenantId}`
      );

      // Invalidate all Square cache for this tenant
      await this.invalidateCache(`square-${tenantId}*`);
    } catch (error) {
      console.error('[SquareIntegrationSingleton] Failed to disconnect Square:', error);
      throw error;
    }
  }

  /**
   * Sync Square data
   */
  async syncSquare(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
        `/api/integrations/${tenantId}/square/sync`,
        { method: 'POST' },
        `square-sync-${tenantId}`
      );

      // Invalidate Square status cache to reflect sync results
      await this.invalidateCache(`square-status-${tenantId}*`);
    } catch (error) {
      console.error('[SquareIntegrationSingleton] Failed to sync Square:', error);
      throw error;
    }
  }

  /**
   * Invalidate Square integration cache for a specific tenant
   */
  public async invalidateSquareCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`square-${tenantId}*`);
  }

  /**
   * Invalidate all Square integration cache
   */
  public async invalidateAllSquareCache(): Promise<void> {
    await this.invalidateCache('square-*');
  }
}

// Export singleton instance
export const squareIntegrationService = SquareIntegrationSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateSquareCache = async (tenantId: string): Promise<void> => {
  const service = SquareIntegrationSingletonService.getInstance();
  await service.invalidateSquareCache(tenantId);
};

export const invalidateAllSquareCache = async (): Promise<void> => {
  const service = SquareIntegrationSingletonService.getInstance();
  await service.invalidateAllSquareCache();
};
