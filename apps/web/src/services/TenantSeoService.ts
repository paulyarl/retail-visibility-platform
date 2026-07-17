import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface SeoSettings {
  seo_tags: string[];
  seo_description: string;
  seo_keywords: string[];
}

class TenantSeoService extends TenantApiSingleton {
  private static instance: TenantSeoService;

  public getServiceCachePatterns(): string[] {
    return ['tenant-seo-service*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-seo-service*');
  }

  private constructor() {
    super('tenant-seo-service', {
      ttl: 5 * 60 * 1000,
    });
  }

  public static getInstance(): TenantSeoService {
    if (!TenantSeoService.instance) {
      TenantSeoService.instance = new TenantSeoService();
    }
    return TenantSeoService.instance;
  }

  async getSeoSettings(tenantId: string): Promise<SeoSettings | null> {
    if (!tenantId) return null;

    try {
      const result = await this.makeDefaultRequest<SeoSettings>(
        `/api/shop-management/${tenantId}/seo`,
        {},
        `tenant-seo-${tenantId}`
      );

      if (!result.success) {
        clientLogger.error('[TenantSeoService] Failed to get SEO settings:', { detail: result.error });
        return null;
      }

      return result.data || null;
    } catch (error) {
      clientLogger.error('[TenantSeoService] Failed to get SEO settings:', { detail: error });
      return null;
    }
  }

  async updateSeoSettings(tenantId: string, data: Partial<SeoSettings>): Promise<boolean> {
    if (!tenantId) return false;

    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/shop-management/${tenantId}/seo`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
        `tenant-seo-${tenantId}`
      );

      if (!result.success) {
        clientLogger.error('[TenantSeoService] Failed to update SEO settings:', { detail: result.error });
        return false;
      }

      this.invalidateCache(`tenant-seo-${tenantId}`);
      return true;
    } catch (error) {
      clientLogger.error('[TenantSeoService] Failed to update SEO settings:', { detail: error });
      return false;
    }
  }
}

export const tenantSeoService = TenantSeoService.getInstance();
