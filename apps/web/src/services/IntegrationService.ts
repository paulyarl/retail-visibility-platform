import { AuthenticatedApiSingleton } from '../providers/base/UniversalSingleton';

export interface IntegrationStatus {
  id: string;
  name: string;
  type: 'square' | 'clover' | 'shopify' | 'woocommerce' | 'custom';
  isActive: boolean;
  isConfigured: boolean;
  lastSync?: string;
  errorCount: number;
  configuration: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
  lastSync: string;
}

/**
 * Service for managing third-party integrations
 * Handles integration status, configuration, and synchronization
 * Updated: Added comprehensive Clover integration methods
 */
export class IntegrationService extends AuthenticatedApiSingleton {
  private static instance: IntegrationService;

  private constructor() {
    super('IntegrationService');
  }

  static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService();
    }
    return IntegrationService.instance;
  }

  /**
   * Get Square integration status
   */
  async getSquareStatus(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/square/status`,
      {},
      `platform-square-status-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Square status:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get Square OAuth authorization URL
   */
  async getSquareOAuthAuthorize(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/square/oauth/authorize`,
      {},
      `platform-square-oauth-authorize-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Square OAuth authorize:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Disconnect Square integration
   */
  async disconnectSquare(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/square/disconnect`,
      { 
        method: 'POST',
        body: JSON.stringify({})
      },
      `platform-square-disconnect-${tenantId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to disconnect Square:', result.error);
      throw result.error;
    }

    // Invalidate Square status cache
    await this.invalidateCache(`platform-square-status-${tenantId}*`);

    return result.data;
  }

  /**
   * Start Square sync
   */
  async startSquareSync(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/square/sync`,
      { 
        method: 'POST',
        body: JSON.stringify({})
      },
      `platform-square-sync-${tenantId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to start Square sync:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get Clover integration status
   */
  async getCloverStatus(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/status`,
      {},
      `platform-clover-status-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Clover status:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Enable Clover demo mode
   */
  async enableCloverDemo(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/demo`,
      { 
        method: 'POST',
        body: JSON.stringify({})
      },
      `platform-clover-demo-${tenantId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to enable Clover demo:', result.error);
      throw result.error;
    }

    // Invalidate Clover status cache
    await this.invalidateCache(`platform-clover-status-${tenantId}*`);

    return result.data;
  }

  /**
   * Disable Clover demo mode
   */
  async disableCloverDemo(tenantId: string, keepItems: boolean = true): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/demo/disable`,
      { 
        method: 'POST',
        body: JSON.stringify({ keepItems })
      },
      `platform-clover-demo-disable-${tenantId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to disable Clover demo:', result.error);
      throw result.error;
    }

    // Invalidate Clover status cache
    await this.invalidateCache(`platform-clover-status-${tenantId}*`);

    return result.data;
  }

  /**
   * Get Clover OAuth authorization URL
   */
  async getCloverOAuthUrl(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/oauth/authorize`,
      {},
      `platform-clover-oauth-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Clover OAuth URL:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Disconnect Clover integration
   */
  async disconnectClover(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/disconnect`,
      { method: 'POST' },
      `platform-clover-disconnect-${tenantId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to disconnect Clover:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Start Clover sync
   */
  async startCloverSync(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/sync`,
      { method: 'POST' },
      `platform-clover-sync-${tenantId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to start Clover sync:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get Clover demo scenarios
   */
  async getCloverDemoScenarios(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/demo/scenarios`,
      {},
      `platform-clover-demo-scenarios-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Clover demo scenarios:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get Clover mappings
   */
  async getCloverMappings(tenantId: string, isDemo: boolean = false): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const endpoint = isDemo 
      ? `/api/integrations/${tenantId}/clover/demo/mappings`
      : `/api/integrations/${tenantId}/clover/mappings`;

    const result = await this.makeAuthenticatedRequest<any>(
      endpoint,
      {},
      `platform-clover-mappings-${tenantId}-${isDemo ? 'demo' : 'prod'}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Clover mappings:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get Clover sync history
   */
  async getCloverSyncHistory(tenantId: string, isDemo: boolean = false): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const endpoint = isDemo 
      ? `/api/integrations/${tenantId}/clover/demo/sync-history`
      : `/api/integrations/${tenantId}/clover/sync-history`;

    const result = await this.makeAuthenticatedRequest<any>(
      endpoint,
      {},
      `platform-clover-sync-history-${tenantId}-${isDemo ? 'demo' : 'prod'}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Clover sync history:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get Clover category mappings
   */
  async getCloverCategoryMappings(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/category-mappings`,
      {},
      `platform-clover-category-mappings-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get Clover category mappings:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Start Clover simulation
   */
  async startCloverSimulation(tenantId: string, scenario: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/demo/simulate`,
      { 
        method: 'POST',
        body: JSON.stringify({ scenario })
      },
      `platform-clover-simulation-start-${tenantId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to start Clover simulation:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Execute Clover simulation
   */
  async executeCloverSimulation(tenantId: string, simulationId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/demo/simulate/${simulationId}/execute`,
      { method: 'POST' },
      `platform-clover-simulation-execute-${tenantId}-${simulationId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to execute Clover simulation:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Cancel Clover simulation
   */
  async cancelCloverSimulation(tenantId: string, simulationId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/clover/demo/simulate/${simulationId}/cancel`,
      { method: 'POST' },
      `platform-clover-simulation-cancel-${tenantId}-${simulationId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to cancel Clover simulation:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Resolve Clover mapping conflict
   */
  async resolveCloverMappingConflict(tenantId: string, mappingId: string, resolution: any, isDemo: boolean = false): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const endpoint = isDemo 
      ? `/api/integrations/${tenantId}/clover/demo/mappings/${mappingId}/resolve`
      : `/api/integrations/${tenantId}/clover/mappings/${mappingId}/resolve`;

    const result = await this.makeAuthenticatedRequest<any>(
      endpoint,
      { 
        method: 'POST',
        body: JSON.stringify(resolution)
      },
      `platform-clover-mapping-resolve-${tenantId}-${mappingId}`
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to resolve Clover mapping conflict:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get integration sync status
   */
  async getSyncStatus(tenantId: string, integration: string): Promise<any> {
    if (!tenantId || !integration) {
      throw new Error('Tenant ID and integration type are required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/${integration}/sync/status`,
      {},
      `platform-${integration}-sync-status-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error(`[IntegrationService] Failed to get ${integration} sync status:`, result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get all integration statuses for tenant
   */
  async getAllIntegrationStatuses(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/statuses`,
      {},
      `platform-all-integration-statuses-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[IntegrationService] Failed to get all integration statuses:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Configure integration settings
   */
  async configureIntegration(tenantId: string, integration: string, settings: any): Promise<any> {
    if (!tenantId || !integration) {
      throw new Error('Tenant ID and integration type are required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/${integration}/configure`,
      { 
        method: 'PATCH',
        body: JSON.stringify(settings)
      },
      `platform-configure-${integration}-${tenantId}`
    );

    if (!result.success) {
      console.error(`[IntegrationService] Failed to configure ${integration}:`, result.error);
      throw result.error;
    }

    // Invalidate integration status cache
    await this.invalidateCache(`platform-${integration}-status-${tenantId}*`);

    return result.data;
  }

  /**
   * Test integration connection
   */
  async testIntegration(tenantId: string, integration: string): Promise<any> {
    if (!tenantId || !integration) {
      throw new Error('Tenant ID and integration type are required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/integrations/${tenantId}/${integration}/test`,
      { method: 'POST' },
      `platform-test-${integration}-${tenantId}`
    );

    if (!result.success) {
      console.error(`[IntegrationService] Failed to test ${integration} connection:`, result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get integration logs
   */
  async getIntegrationLogs(tenantId: string, integration: string, limit: number = 50): Promise<any[]> {
    if (!tenantId || !integration) {
      throw new Error('Tenant ID and integration type are required');
    }

    const result = await this.makeAuthenticatedRequest<any[]>(
      `/api/integrations/${tenantId}/${integration}/logs?limit=${limit}`,
      {},
      `platform-${integration}-logs-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error(`[IntegrationService] Failed to get ${integration} logs:`, result.error);
      return [];
    }

    return result.data || [];
  }
}

// Export singleton instance
export const integrationService = IntegrationService.getInstance();
