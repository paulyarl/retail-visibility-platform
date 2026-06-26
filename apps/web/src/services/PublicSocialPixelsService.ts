/**
 * PublicSocialPixelsService — Public social pixels config service
 * Extends PublicApiSingleton for unauthenticated storefront access
 * Endpoint: /api/social-pixels/public/:tenantId
 */
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface PublicPixelConfig {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
}

class PublicSocialPixelsService extends PublicApiSingleton {
  private static instance: PublicSocialPixelsService;

  private constructor() {
    super('public-social-pixels-service', { ttl: 15 * 60 * 1000 });
  }

  static getInstance(): PublicSocialPixelsService {
    if (!PublicSocialPixelsService.instance) {
      PublicSocialPixelsService.instance = new PublicSocialPixelsService();
    }
    return PublicSocialPixelsService.instance;
  }

  async getPublicPixelConfig(tenantId: string): Promise<PublicPixelConfig | null> {
    try {
      const result = await this.makePublicRequest<ApiEnvelope<PublicPixelConfig>>(
        `/api/social-pixels/public/${tenantId}`,
        { method: 'GET' },
        `social-pixels-public-${tenantId}`,
        this.cacheTTL,
      );
      if (!result.success) return null;
      if (!result.data?.success) return null;
      return result.data.data ?? null;
    } catch {
      return null;
    }
  }
}

export const publicSocialPixelsService = PublicSocialPixelsService.getInstance();
export default PublicSocialPixelsService;
