/**
 * SocialPixelsService — Tenant social pixels configuration service
 * Extends TenantApiSingleton for Auth0 cookie-based auth with X-Tenant-ID header
 * Endpoints: /api/social-pixels/:tenantId (GET, PUT)
 */
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface PixelConfig {
  metaPixelId: string | null;
  metaAccessToken: string | null;
  tiktokPixelId: string | null;
  tiktokAccessToken: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class SocialPixelsService extends TenantApiSingleton {
  private static instance: SocialPixelsService;

  private constructor() {
    super('social-pixels-service', { ttl: 10 * 60 * 1000 });
  }

  static getInstance(): SocialPixelsService {
    if (!SocialPixelsService.instance) {
      SocialPixelsService.instance = new SocialPixelsService();
    }
    return SocialPixelsService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['social-pixels-*'];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`social-pixels-${tenantId}`);
    }
  }

  async getPixelConfig(tenantId: string): Promise<PixelConfig | null> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PixelConfig>>(
      `/api/social-pixels/${tenantId}`,
      { method: 'GET' },
      `social-pixels-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) return null;
    if (!result.data?.success) return null;
    return result.data.data ?? null;
  }

  async updatePixelConfig(
    tenantId: string,
    payload: Partial<PixelConfig>,
  ): Promise<PixelConfig> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PixelConfig>>(
      `/api/social-pixels/${tenantId}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to save');
    await this.invalidateCache(`social-pixels-${tenantId}`);
    return result.data.data!;
  }
}

export const socialPixelsService = SocialPixelsService.getInstance();
export default SocialPixelsService;
