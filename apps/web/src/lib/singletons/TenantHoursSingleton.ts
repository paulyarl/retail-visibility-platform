import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

// TypeScript interfaces for shop hours
export interface ShopHoursPeriod {
  day: string;
  open: string;
  close: string;
}

export interface ShopHoursData {
  hours: Record<string, { open: string; close: string }>;
  timezone: string;
}

export interface SpecialHour {
  date: string;
  isClosed: boolean;
  open?: string;
  close?: string;
  note?: string;
}

export interface SpecialHoursData {
  overrides: SpecialHour[];
}

/**
 * Tenant Hours Singleton - Manages shop hours CRUD operations for tenants
 * Extends TenantApiSingleton for tenant-aware caching and API requests
 */
class TenantHoursSingleton extends TenantApiSingleton {
  private static instances = new Map<string, TenantHoursSingleton>();

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-hours*',
      'shop-hours*',
      'business-hours*',
      'special-hours*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-hours*');
    await this.invalidateCachePattern('shop-hours*');
    await this.invalidateCachePattern('business-hours*');
    await this.invalidateCachePattern('special-hours*');
  }

  constructor(tenantId: string) {
    super('tenant-hours');
    this.setCurrentTenant(tenantId);
  }

  static getInstance(tenantId: string): TenantHoursSingleton {
    if (!TenantHoursSingleton.instances.has(tenantId)) {
      TenantHoursSingleton.instances.set(tenantId, new TenantHoursSingleton(tenantId));
    }
    return TenantHoursSingleton.instances.get(tenantId)!;
  }

  /**
   * Load shop hours data for a tenant
   */
  async loadShopHours(tenantId: string): Promise<ShopHoursData> {
    const result = await this.makeDefaultRequest(
      `/api/shop-management/${tenantId}`,
      undefined,
      `shop-hours-${tenantId}`
    );

    if (result.success) {
      return result.data as ShopHoursData;
    } else {
      throw new Error(getErrorMessage(result.error) || 'Failed to load shop hours');
    }
  }

  /**
   * Load special hours data for a tenant
   */
  async loadSpecialHours(tenantId: string): Promise<SpecialHoursData> {
    const result = await this.makeDefaultRequest(
      `/api/tenant/${tenantId}/business-hours/special`,
      undefined,
      `special-hours-${tenantId}`
    );

    if (result.success) {
      return result.data as SpecialHoursData;
    } else {
      throw new Error(getErrorMessage(result.error) || 'Failed to load special hours');
    }
  }

  /**
   * Save shop hours data for a tenant
   */
  async saveShopHours(tenantId: string, hours: Record<string, { open: string; close: string }>, timezone: string): Promise<ShopHoursData> {
    const result = await this.makeDefaultRequest(
      `/api/shop-management/${tenantId}/hours`,
      {
        method: 'PUT',
        body: JSON.stringify({
          hours,
          timezone
        })
      },
      `shop-hours-${tenantId}` // This will invalidate the cache after successful update
    );

    if (result.success) {
      return result.data as ShopHoursData;
    } else {
      throw new Error(getErrorMessage(result.error) || 'Failed to save shop hours');
    }
  }

  /**
   * Clear cache for a specific tenant
   */
  async clearTenantCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`shop-hours-${tenantId}`);
    await this.invalidateCache(`special-hours-${tenantId}`);
  }
}

// Export factory function
export function getTenantHoursSingleton(tenantId: string): TenantHoursSingleton {
  return TenantHoursSingleton.getInstance(tenantId);
}
