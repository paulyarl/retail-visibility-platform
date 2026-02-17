import { AuthenticatedApiSingleton } from '../providers/base/UniversalSingleton';

export interface Subdomain {
  id: string;
  domain: string;
  tenantId: string;
  isActive: boolean;
  isVerified: boolean;
  sslEnabled: boolean;
  customDomain?: string;
  dnsRecords: Array<{
    type: 'A' | 'CNAME' | 'TXT' | 'MX';
    name: string;
    value: string;
    ttl: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SubdomainStats {
  totalSubdomains: number;
  activeSubdomains: number;
  verifiedSubdomains: number;
  customDomains: number;
  sslEnabled: number;
  recentActivity: Array<{
    subdomainId: string;
    domain: string;
    action: string;
    timestamp: string;
  }>;
}

/**
 * Service for managing subdomain operations
 * Handles subdomain management, DNS records, and statistics
 */
export class SubdomainService extends AuthenticatedApiSingleton {
  private static instance: SubdomainService;

  private constructor() {
    super('SubdomainService');
  }

  static getInstance(): SubdomainService {
    if (!SubdomainService.instance) {
      SubdomainService.instance = new SubdomainService();
    }
    return SubdomainService.instance;
  }

  /**
   * Get tenant subdomain information
   */
  async getTenantSubdomain(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/${tenantId}`,
      {},
      `platform-tenant-subdomain-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to get tenant subdomain:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Get all subdomains for a user
   */
  async getUserSubdomains(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/my-subdomains?tenantId=${tenantId}`,
      {},
      `platform-user-subdomains-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to get user subdomains:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Check if a subdomain is available
   */
  async checkSubdomainAvailability(subdomain: string): Promise<any> {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/check-subdomain/${subdomain}`,
      {},
      `platform-check-subdomain-${subdomain}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to check subdomain availability:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Update tenant subdomain
   */
  async updateTenantSubdomain(tenantId: string, subdomain: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/${tenantId}/subdomain`,
      { 
        method: 'PUT',
        body: JSON.stringify({ subdomain })
      },
      `platform-update-tenant-subdomain-${tenantId}`
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to update tenant subdomain:', result.error);
      throw result.error;
    }

    // Invalidate subdomain caches
    await this.invalidateCache(`platform-tenant-subdomain-${tenantId}*`);
    await this.invalidateCache(`platform-user-subdomains-${tenantId}*`);

    return result.data;
  }

  /**
   * Delete tenant subdomain
   */
  async deleteTenantSubdomain(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/${tenantId}/subdomain`,
      { method: 'DELETE' },
      `platform-delete-tenant-subdomain-${tenantId}`
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to delete tenant subdomain:', result.error);
      throw result.error;
    }

    // Invalidate subdomain caches
    await this.invalidateCache(`platform-tenant-subdomain-${tenantId}*`);
    await this.invalidateCache(`platform-user-subdomains-${tenantId}*`);

    return result.data;
  }

  /**
   * Get admin subdomain statistics
   */
  async getAdminSubdomainStats(): Promise<SubdomainStats | null> {
    const result = await this.makeAuthenticatedRequest<{ data: SubdomainStats }>(
      '/api/analytics/subdomain-stats',
      {},
      'platform-admin-subdomain-stats',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to get admin subdomain stats:', result.error);
      return null;
    }

    return result.data?.data || null;
  }

  /**
   * Reserve a subdomain
   */
  async reserveSubdomain(tenantId: string, subdomain: string): Promise<any> {
    if (!tenantId || !subdomain) {
      throw new Error('Tenant ID and subdomain are required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/${tenantId}/reserve-subdomain`,
      { 
        method: 'POST',
        body: JSON.stringify({ subdomain })
      },
      `platform-reserve-subdomain-${tenantId}`
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to reserve subdomain:', result.error);
      throw result.error;
    }

    // Invalidate subdomain caches
    await this.invalidateCache(`platform-tenant-subdomain-${tenantId}*`);
    await this.invalidateCache(`platform-check-subdomain-${subdomain}*`);

    return result.data;
  }

  /**
   * Verify subdomain ownership
   */
  async verifySubdomainOwnership(subdomain: string): Promise<boolean> {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const result = await this.makeAuthenticatedRequest<{ verified: boolean }>(
      `/api/tenants/verify-subdomain/${subdomain}`,
      {},
      `platform-verify-subdomain-${subdomain}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to verify subdomain ownership:', result.error);
      return false;
    }

    return result.data?.verified || false;
  }

  /**
   * Get subdomain configuration
   */
  async getSubdomainConfig(subdomain: string): Promise<any> {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/subdomain-config/${subdomain}`,
      {},
      `platform-subdomain-config-${subdomain}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to get subdomain config:', result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Update subdomain configuration
   */
  async updateSubdomainConfig(subdomain: string, config: any): Promise<any> {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    const result = await this.makeAuthenticatedRequest<any>(
      `/api/tenants/subdomain-config/${subdomain}`,
      { 
        method: 'PATCH',
        body: JSON.stringify(config)
      },
      `platform-update-subdomain-config-${subdomain}`
    );

    if (!result.success) {
      console.error('[SubdomainService] Failed to update subdomain config:', result.error);
      throw result.error;
    }

    // Invalidate subdomain config cache
    await this.invalidateCache(`platform-subdomain-config-${subdomain}*`);

    return result.data;
  }

  }

// Export singleton instance
export const subdomainService = SubdomainService.getInstance();
