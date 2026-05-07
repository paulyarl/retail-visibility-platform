/**
 * Tenant Integrations Service
 * 
 * Handles tenant third-party integration management operations
 * Extends AdminApiSingleton for proper caching and context management
 * 
 * MIGRATION: Replaces direct fetch calls in:
 * - /src/lib/singletons/IntegrationsSingleton.ts
 * - /src/lib/singletons/PaymentGatewaySingleton.ts
 * - /src/components/google/GoogleConnectCard.tsx
 * - /src/app/api/integrations/square/callback/route.ts
 * - /src/app/api/integrations/clover/oauth/route.ts
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface TenantIntegration {
  id: string;
  tenantId: string;
  provider: 'CLOVER' | 'SQUARE' | 'STRIPE' | 'PAYPAL' | 'SHOPIFY' | 'GOOGLE_BUSINESS' | 'FACEBOOK' | 'INSTAGRAM';
  type: 'PAYMENT' | 'INVENTORY' | 'MARKETING' | 'ANALYTICS' | 'SOCIAL' | 'BUSINESS_LISTING';
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING' | 'EXPIRED';
  config: Record<string, any>;
  metadata?: {
    displayName?: string;
    description?: string;
    logo?: string;
    website?: string;
    features?: string[];
    pricing?: string;
  };
  isConnected: boolean;
  lastSyncAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface IntegrationConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  merchantId?: string;
  locationId?: string;
  accountId?: string;
  businessId?: string;
  webhookUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
  scopes?: string[];
  permissions?: string[];
}

export interface CreateIntegrationRequest {
  provider: TenantIntegration['provider'];
  type: TenantIntegration['type'];
  config: IntegrationConfig;
  metadata?: {
    displayName?: string;
    description?: string;
    features?: string[];
  };
}

export interface UpdateIntegrationRequest {
  config?: Partial<IntegrationConfig>;
  metadata?: {
    displayName?: string;
    description?: string;
    features?: string[];
  };
  status?: TenantIntegration['status'];
}

export interface OAuthUrl {
  url: string;
  state: string;
  provider: string;
  scopes: string[];
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors?: string[];
  lastSyncAt: string;
}

export interface IntegrationStats {
  totalIntegrations: number;
  connectedIntegrations: number;
  integrationsByProvider: Array<{
    provider: string;
    count: number;
    connected: number;
  }>;
  integrationsByType: Array<{
    type: string;
    count: number;
    connected: number;
  }>;
  recentActivity: Array<{
    integrationId: string;
    provider: string;
    action: 'CONNECTED' | 'DISCONNECTED' | 'SYNCED' | 'ERROR';
    timestamp: string;
    details?: string;
  }>;
}

export class TenantIntegrationsService extends AdminApiSingleton {
  private static instance: TenantIntegrationsService;

  private constructor() {
    super('TenantIntegrationsService');
  }

  static getInstance(): TenantIntegrationsService {
    if (!TenantIntegrationsService.instance) {
      TenantIntegrationsService.instance = new TenantIntegrationsService();
    }
    return TenantIntegrationsService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-integrations-*',
      'integration-*',
      'integration-oauth-*',
      'integration-sync-*',
      'integration-stats-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(tenantId?: string, integrationId?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`tenant-integrations-${tenantId}`);
      if (integrationId) {
        await this.invalidateCache(`integration-${integrationId}`);
      }
    } else {
      await this.invalidateCache('tenant-integrations-*');
      await this.invalidateCache('integration-*');
      await this.invalidateCache('integration-oauth-*');
      await this.invalidateCache('integration-sync-*');
      await this.invalidateCache('integration-stats-*');
    }
  }

  /**
   * Get all integrations for a tenant
   */
  async getTenantIntegrations(tenantId: string): Promise<TenantIntegration[]> {
    const result = await this.makeDefaultRequest<TenantIntegration[]>(
      `/api/tenants/${tenantId}/integrations`,
      {},
      `tenant-integrations-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant integrations: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get specific integration for tenant
   */
  async getTenantIntegration(tenantId: string, provider: string): Promise<TenantIntegration | null> {
    const result = await this.makeDefaultRequest<TenantIntegration>(
      `/api/tenants/${tenantId}/integrations/${provider}`,
      {},
      `integration-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant integration: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Create new integration for tenant
   */
  async createTenantIntegration(tenantId: string, integration: CreateIntegrationRequest): Promise<TenantIntegration | null> {
    const result = await this.makeDefaultRequest<TenantIntegration>(
      `/api/tenants/${tenantId}/integrations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(integration),
      },
      `integration-create-${tenantId}-${integration.provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to create tenant integration: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after creation
    await this.invalidateServiceCaches(tenantId);
    
    return result.data || null;
  }

  /**
   * Update tenant integration
   */
  async updateTenantIntegration(tenantId: string, provider: string, updates: UpdateIntegrationRequest): Promise<TenantIntegration | null> {
    const result = await this.makeDefaultRequest<TenantIntegration>(
      `/api/tenants/${tenantId}/integrations/${provider}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      },
      `integration-update-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to update tenant integration: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after update
    await this.invalidateServiceCaches(tenantId);
    
    return result.data || null;
  }

  /**
   * Delete tenant integration
   */
  async deleteTenantIntegration(tenantId: string, provider: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/integrations/${provider}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `integration-delete-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to delete tenant integration: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after deletion
    await this.invalidateServiceCaches(tenantId);
    
    return result.data?.success || false;
  }

  /**
   * Get OAuth URL for integration
   */
  async getOAuthUrl(tenantId: string, provider: string, redirectUri?: string): Promise<OAuthUrl | null> {
    const result = await this.makeDefaultRequest<OAuthUrl>(
      `/api/tenants/${tenantId}/integrations/${provider}/oauth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ redirectUri }),
      },
      `integration-oauth-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to get OAuth URL: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(tenantId: string, provider: string, code: string, state: string): Promise<TenantIntegration | null> {
    const result = await this.makeDefaultRequest<TenantIntegration>(
      `/api/tenants/${tenantId}/integrations/${provider}/callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      },
      `integration-callback-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to handle OAuth callback: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after OAuth callback
    await this.invalidateServiceCaches(tenantId);
    
    return result.data || null;
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(tenantId: string, provider: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/integrations/${provider}/disconnect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `integration-disconnect-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to disconnect integration: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after disconnection
    await this.invalidateServiceCaches(tenantId);
    
    return result.data?.success || false;
  }

  /**
   * Sync integration data
   */
  async syncIntegration(tenantId: string, provider: string, options?: { fullSync?: boolean; types?: string[] }): Promise<SyncResult | null> {
    const result = await this.makeDefaultRequest<SyncResult>(
      `/api/tenants/${tenantId}/integrations/${provider}/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || {}),
      },
      `integration-sync-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to sync integration: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after sync
    await this.invalidateServiceCaches(tenantId);
    
    return result.data || null;
  }

  /**
   * Test integration connection
   */
  async testIntegration(tenantId: string, provider: string): Promise<{
    success: boolean;
    message?: string;
    details?: Record<string, any>;
  } | null> {
    const result = await this.makeDefaultRequest<{
      success: boolean;
      message?: string;
      details?: Record<string, any>;
    }>(
      `/api/tenants/${tenantId}/integrations/${provider}/test`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `integration-test-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to test integration: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Get integration webhook status
   */
  async getWebhookStatus(tenantId: string, provider: string): Promise<{
    isActive: boolean;
    url?: string;
    lastDelivery?: string;
    failures?: number;
  } | null> {
    const result = await this.makeDefaultRequest<{
      isActive: boolean;
      url?: string;
      lastDelivery?: string;
      failures?: number;
    }>(
      `/api/tenants/${tenantId}/integrations/${provider}/webhook/status`,
      {},
      `integration-webhook-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to get webhook status: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(tenantId: string, provider: string, config: { url?: string; events?: string[]; active?: boolean }): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/integrations/${provider}/webhook`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      },
      `integration-webhook-update-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to update webhook: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after webhook update
    await this.invalidateServiceCaches(tenantId);
    
    return result.data?.success || false;
  }

  /**
   * Get available integration providers
   */
  async getAvailableProviders(): Promise<Array<{
    provider: string;
    type: string;
    name: string;
    description: string;
    features: string[];
    logo?: string;
    website?: string;
    pricing?: string;
    documentation?: string;
    oauthScopes?: string[];
  }>> {
    const result = await this.makeDefaultRequest<Array<{
      provider: string;
      type: string;
      name: string;
      description: string;
      features: string[];
      logo?: string;
      website?: string;
      pricing?: string;
      documentation?: string;
      oauthScopes?: string[];
    }>>(
      '/api/integrations/providers',
      {},
      'integration-providers'
    );
    
    if (!result.success) {
      console.log(`Failed to get available providers: ${result.error}`);
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get integration statistics for tenant
   */
  async getTenantIntegrationStats(tenantId: string): Promise<{
    totalIntegrations: number;
    connectedIntegrations: number;
    integrationsByProvider: Array<{
      provider: string;
      count: number;
      connected: number;
    }>;
    recentActivity: Array<{
      integrationId: string;
      provider: string;
      action: 'CONNECTED' | 'DISCONNECTED' | 'SYNCED' | 'ERROR';
      timestamp: string;
      details?: string;
    }>;
  }> {
    const result = await this.makeDefaultRequest<{
      totalIntegrations: number;
      connectedIntegrations: number;
      integrationsByProvider: Array<{
        provider: string;
        count: number;
        connected: number;
      }>;
      recentActivity: Array<{
        integrationId: string;
        provider: string;
        action: 'CONNECTED' | 'DISCONNECTED' | 'SYNCED' | 'ERROR';
        timestamp: string;
        details?: string;
      }>;
    }>(
      `/api/tenants/${tenantId}/integrations/stats`,
      {},
      `integration-stats-${tenantId}`
    );
    
    if (!result.success) {
      console.log(`Failed to get tenant integration stats: ${result.error}`);
      return { totalIntegrations: 0, connectedIntegrations: 0, integrationsByProvider: [], recentActivity: [] };
    }
    
    return result.data || { totalIntegrations: 0, connectedIntegrations: 0, integrationsByProvider: [], recentActivity: [] };
  }

  /**
   * Get global integration statistics (admin only)
   */
  async getGlobalIntegrationStats(): Promise<IntegrationStats> {
    const result = await this.makeDefaultRequest<IntegrationStats>(
      '/api/admin/integrations/stats',
      {},
      'integration-global-stats'
    );
    
    if (!result.success) {
      console.log(`Failed to get global integration stats: ${result.error}`);
      return { 
        totalIntegrations: 0, 
        connectedIntegrations: 0, 
        integrationsByProvider: [], 
        integrationsByType: [], 
        recentActivity: [] 
      };
    }
    
    return result.data || { 
      totalIntegrations: 0, 
      connectedIntegrations: 0, 
      integrationsByProvider: [], 
      integrationsByType: [], 
      recentActivity: [] 
    };
  }

  /**
   * Check if integration is available for tenant
   */
  async isIntegrationAvailable(tenantId: string, provider: string): Promise<{
    available: boolean;
    reason?: string;
    requirements?: string[];
  }> {
    const result = await this.makeDefaultRequest<{
      available: boolean;
      reason?: string;
      requirements?: string[];
    }>(
      `/api/tenants/${tenantId}/integrations/${provider}/availability`,
      {},
      `integration-availability-${tenantId}-${provider}`
    );
    
    if (!result.success) {
      console.log(`Failed to check integration availability: ${result.error}`);
      return { available: false, reason: 'Failed to check availability' };
    }
    
    return result.data || { available: false, reason: 'Unknown error' };
  }
}

// Export singleton instance
export default TenantIntegrationsService.getInstance();
