/**
 * Growth Tip Singleton Service
 *
 * Extends TenantApiSingleton to provide cached growth tips from the backend.
 * Uses makeDefaultRequest for automatic caching with tenant-scoped isolation.
 *
 * Fallback: If the backend endpoint is unavailable, callers can fall back
 * to the local tipEngine (resolveGrowthTips) with client-side context.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface GrowthTipDTO {
  id: string;
  category: 'onboarding' | 'engagement' | 'upgrade' | 'optimization' | 'retention';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  body: string;
  cta: string;
  ctaLink: string;
  icon: string;
  gradient: string;
}

class GrowthTipSingletonService extends TenantApiSingleton {
  public getServiceCachePatterns(): string[] {
    return ['growth-tips-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`growth-tips-${tenantId}`);
    }
  }

  private static instance: GrowthTipSingletonService;

  private constructor() {
    super('growth-tip-singleton', {
      ttl: 2 * 60 * 1000, // 2 minutes — tips change with state
    });
  }

  public static getInstance(): GrowthTipSingletonService {
    if (!GrowthTipSingletonService.instance) {
      GrowthTipSingletonService.instance = new GrowthTipSingletonService();
    }
    return GrowthTipSingletonService.instance;
  }

  /**
   * Fetch tier-aware growth tips from the backend.
   * Uses makeDefaultRequest for automatic caching with tenant isolation.
   *
   * @param tenantId  Tenant ID
   * @param limit     Max tips to return (default 5)
   * @returns Array of GrowthTipDTO, or null on error
   */
  async getGrowthTips(tenantId: string, limit: number = 5): Promise<GrowthTipDTO[] | null> {
    if (!tenantId) {
      console.error('[GrowthTipSingleton] getGrowthTips: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<{ data: GrowthTipDTO[] }>(
        `/api/tenants/${tenantId}/growth-tips?limit=${limit}`,
        {},
        `growth-tips-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success || !result.data) {
        return null;
      }

      // The API returns { success, data: [...] } — makeDefaultRequest may unwrap
      const data = result.data as any;
      const tips = Array.isArray(data) ? data : data?.data;
      return Array.isArray(tips) ? tips : null;
    } catch (error) {
      console.error('[GrowthTipSingleton] Failed to get growth tips:', error);
      return null;
    }
  }
}

export const growthTipService = GrowthTipSingletonService.getInstance();
