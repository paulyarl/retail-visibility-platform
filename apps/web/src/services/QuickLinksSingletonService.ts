/**
 * Quick Links Singleton Service
 *
 * Fetches the backend-driven, capability-aware quick links list
 * from GET /api/tenants/:tenantId/quick-links.
 *
 * Extends TenantApiSingleton for correct auth context, cache isolation,
 * and the cache contract (getServiceCachePatterns / invalidateServiceCaches).
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export type LinkCategory = 'store' | 'commerce' | 'engagement' | 'settings' | 'visibility';

export interface QuickLinkDTO {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  category: LinkCategory;
  badge?: string;
}

class QuickLinksSingletonService extends TenantApiSingleton {
  private static instance: QuickLinksSingletonService;

  private constructor() {
    super('quick-links-singleton', { ttl: 30 * 1000 });
  }

  public static getInstance(): QuickLinksSingletonService {
    if (!QuickLinksSingletonService.instance) {
      QuickLinksSingletonService.instance = new QuickLinksSingletonService();
    }
    return QuickLinksSingletonService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['quick-links-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`quick-links-${tenantId}`);
    } else {
      this.invalidateCache('quick-links-*');
    }
  }

  /**
   * Fetch the quick links list for a tenant.
   * Returns null on error so the UI can degrade gracefully.
   */
  async getQuickLinks(tenantId: string): Promise<QuickLinkDTO[] | null> {
    if (!tenantId) return null;

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: QuickLinkDTO[] }>(
        `/api/tenants/${tenantId}/quick-links`,
        {},
        `quick-links-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success) {
        clientLogger.error('[QuickLinksService] Failed to fetch quick links:', { detail: (result as any).error });
        return null;
      }

      return (result as any).data?.data ?? null;
    } catch (error) {
      clientLogger.error('[QuickLinksService] Error fetching quick links:', { detail: error });
      return null;
    }
  }
}

export const quickLinksService = QuickLinksSingletonService.getInstance();
