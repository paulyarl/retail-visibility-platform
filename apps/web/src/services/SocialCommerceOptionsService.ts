/**
 * SocialCommerceOptionsService — Tenant social commerce options service
 * Extends TenantApiSingleton for Auth0 cookie-based auth with X-Tenant-ID header
 * Endpoints: /api/tenants/:tenantId/social-commerce-options
 */
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { unifiedCapabilityService } from './UnifiedCapabilityService';

class SocialCommerceOptionsService extends TenantApiSingleton {
  private static instance: SocialCommerceOptionsService;

  private constructor() {
    super('social-commerce-options', { ttl: 3 * 60 * 1000 });
  }

  static getInstance(): SocialCommerceOptionsService {
    if (!SocialCommerceOptionsService.instance) {
      SocialCommerceOptionsService.instance = new SocialCommerceOptionsService();
    }
    return SocialCommerceOptionsService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['social-commerce-options'];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  async getOptions(tenantId: string): Promise<{ settings: Record<string, boolean>; tierState: any }> {
    const result = await this.makeDefaultRequest<{ success: boolean; settings: Record<string, boolean>; tierState: any; error?: string }>(
      `/api/tenants/${tenantId}/social-commerce-options`,
      { method: 'GET' },
      `social-commerce-options-${tenantId}`,
      3 * 60 * 1000,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return { settings: result.data.settings, tierState: result.data.tierState };
  }

  async updateOptions(tenantId: string, settings: Record<string, boolean>): Promise<Record<string, boolean>> {
    const result = await this.makeDefaultRequest<{ success: boolean; settings: Record<string, boolean>; error?: string }>(
      `/api/tenants/${tenantId}/social-commerce-options`,
      { method: 'PUT', body: JSON.stringify(settings) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateCache(`social-commerce-options-${tenantId}`);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);
    return result.data.settings;
  }
}

export const socialCommerceOptionsService = SocialCommerceOptionsService.getInstance();
export default SocialCommerceOptionsService;
