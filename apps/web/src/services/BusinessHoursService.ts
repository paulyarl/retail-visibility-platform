/**
 * Business Hours Service
 * 
 * Handles business hours operations for tenant profiles
 * Uses TenantApiSingleton for authenticated operations
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface BusinessHours {
  monday?: {
    open: string;
    close: string;
    isOpen: boolean;
  };
  tuesday?: {
    open: string;
    close: string;
    isOpen: boolean;
  };
  wednesday?: {
    open: string;
    close: string;
    isOpen: boolean;
  };
  thursday?: {
    open: string;
    close: string;
    isOpen: boolean;
  };
  friday?: {
    open: string;
    close: string;
    isOpen: boolean;
  };
  saturday?: {
    open: string;
    close: string;
    isOpen: boolean;
  };
  sunday?: {
    open: string;
    close: string;
    isOpen: boolean;
  };
}

class BusinessHoursService extends TenantApiSingleton {
  private static instance: BusinessHoursService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'business-hours-service*',
      'tenant-business-hours*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('business-hours-service*');
    await this.invalidateCachePattern('tenant-business-hours*');
  }

  private constructor() {
    super('business-hours-service', {
      ttl: 10 * 60 * 1000 // 10 minutes for business hours
    });
  }

  public static getInstance(): BusinessHoursService {
    if (!BusinessHoursService.instance) {
      BusinessHoursService.instance = new BusinessHoursService();
    }
    return BusinessHoursService.instance;
  }

  /**
   * Get business hours for a tenant
   * Uses the /api/business-hours/:tenantId endpoint
   */
  async getBusinessHours(tenantId: string): Promise<BusinessHours | null> {
    if (!tenantId) {
      clientLogger.error('[BusinessHoursService] getBusinessHours: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<BusinessHours>(
        `/api/business-hours/${tenantId}`,
        {},
        `business-hours-${tenantId}`
      );

      if (!result.success) {
        clientLogger.error('[BusinessHoursService] Failed to get business hours:', { detail: result.error });
        return null;
      }

      return result.data || null;
    } catch (error) {
      clientLogger.error('[BusinessHoursService] Failed to get business hours:', { detail: error });
      return null;
    }
  }

  /**
   * Update business hours for a tenant
   * Uses the /api/business-hours/:tenantId endpoint
   */
  async updateBusinessHours(tenantId: string, hours: BusinessHours): Promise<BusinessHours | null> {
    if (!tenantId) {
      clientLogger.error('[BusinessHoursService] updateBusinessHours: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<BusinessHours>(
        `/api/business-hours/${tenantId}`,
        {
          method: 'PUT',
          body: JSON.stringify(hours)
        },
        `business-hours-${tenantId}`
      );

      if (!result.success) {
        clientLogger.error('[BusinessHoursService] Failed to update business hours:', { detail: result.error });
        return null;
      }

      // Invalidate cache after update
      this.invalidateCache(`business-hours-${tenantId}`);

      return result.data || null;
    } catch (error) {
      clientLogger.error('[BusinessHoursService] Failed to update business hours:', { detail: error });
      return null;
    }
  }

  /**
   * Delete business hours for a tenant
   * Uses the /api/business-hours/:tenantId endpoint
   */
  async deleteBusinessHours(tenantId: string): Promise<boolean> {
    if (!tenantId) {
      clientLogger.error('[BusinessHoursService] deleteBusinessHours: tenantId is required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/business-hours/${tenantId}`,
        { method: 'DELETE' },
        `business-hours-${tenantId}`
      );

      if (!result.success) {
        clientLogger.error('[BusinessHoursService] Failed to delete business hours:', { detail: result.error });
        return false;
      }

      // Invalidate cache after deletion
      this.invalidateCache(`business-hours-${tenantId}`);

      return true;
    } catch (error) {
      clientLogger.error('[BusinessHoursService] Failed to delete business hours:', { detail: error });
      return false;
    }
  }
}

// Export singleton instance
export const businessHoursService = BusinessHoursService.getInstance();
