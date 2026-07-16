/**
 * Tenant Featured Access Service
 * 
 * Handles tenant-level featured access checks and status management
 * Extends TenantApiSingleton for proper caching and context management
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface FeaturedAccessStatus {
  hasAccess: boolean;
  tenantId: string;
  accessType: string;
  checkedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export interface FeaturedProductWithApproval {
  featured_product_id: string;
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  price_cents: number;
  image_url?: string;
  featured_type: string;
  featured_priority: number;
  featured_at: string;
  is_active: boolean;
  admin_approved?: boolean;
}

export interface FeaturedAccessRequest {
  message: string;
  tenantId: string;
  reason?: string;
  status: string;
  submittedAt: string;
}

export class TenantFeaturedAccessService extends TenantApiSingleton {
  private static instance: TenantFeaturedAccessService;

  private constructor() {
    super('TenantFeaturedAccessService');
  }

  static getInstance(): TenantFeaturedAccessService {
    if (!TenantFeaturedAccessService.instance) {
      TenantFeaturedAccessService.instance = new TenantFeaturedAccessService();
    }
    return TenantFeaturedAccessService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-featured-access-*',
      'tenant-featured-access-status-*',
      'tenant-featured-products-*',
      'tenant-featured-access-request-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`tenant-featured-access-${tenantId}`);
      await this.invalidateCache(`tenant-featured-access-status-${tenantId}`);
      await this.invalidateCache(`tenant-featured-products-${tenantId}`);
      await this.invalidateCache(`tenant-featured-access-request-${tenantId}`);
    }
  }

  /**
   * Check if tenant has featured access approval
   */
  async hasFeaturedAccess(tenantId: string): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest<FeaturedAccessStatus>(
        `/api/featured-products/tenants/${tenantId}/featured-access-status`,
        {},
        `tenant-featured-access-${tenantId}`
      );
      if (!result.success) {
        console.log(`Failed to check featured access: ${result.error}`);
        return false;
      }
      return result.data?.hasAccess || false;
    } catch (error) {
      clientLogger.error('Error checking featured access:', { detail: error });
      return false; // Default to false on error
    }
  }

  /**
   * Get tenant's featured access status with details
   */
  async getAccessStatus(tenantId: string): Promise<FeaturedAccessStatus> {
    const result = await this.makeDefaultRequest<FeaturedAccessStatus>(
      `/api/featured-products/tenants/${tenantId}/featured-access-status`,
      {},
      `tenant-featured-access-status-${tenantId}`
    );
    if (!result.success || !result.data) {
      console.log(`Failed to get featured access status: ${result.error}`);
      return { 
        hasAccess: false, 
        tenantId, 
        accessType: 'featured', 
        checkedAt: new Date().toISOString() 
      } as FeaturedAccessStatus;
    }
    return result.data;
  }

  /**
   * Get tenant's featured products with approval status
   */
  async getFeaturedProductsWithApproval(tenantId: string, options?: { limit?: number; offset?: number }): Promise<FeaturedProductWithApproval[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const result = await this.makeDefaultRequest<{ featuredProducts: FeaturedProductWithApproval[] }>(
      `/api/featured-products/tenants/${tenantId}/featured-products/with-approval${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      `tenant-featured-products-${tenantId}`
    );
    if (!result.success || !result.data) {
      console.log(`Failed to get featured products with approval: ${result.error}`);
      return [];
    }
    return result.data.featuredProducts || [];
  }

  /**
   * Request featured access for tenant
   */
  async requestFeaturedAccess(tenantId: string, reason?: string): Promise<FeaturedAccessRequest> {
    const result = await this.makeDefaultRequest<FeaturedAccessRequest>(
      `/api/featured-products/tenants/${tenantId}/request-featured-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
      `tenant-featured-access-request-${tenantId}`
    );
    if (!result.success || !result.data) {
      console.log(`Failed to request featured access: ${result.error}`);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to request featured access');
    }
    return result.data;
  }

  /**
   * Invalidate cache for tenant access status
   */
  async invalidateAccessCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`tenant-featured-access-${tenantId}`);
    await this.invalidateCache(`tenant-featured-access-status-${tenantId}`);
  }

  /**
   * Invalidate cache for tenant featured products
   */
  async invalidateProductsCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`tenant-featured-products-${tenantId}`);
  }
}

// Export singleton instance
export default TenantFeaturedAccessService.getInstance();
