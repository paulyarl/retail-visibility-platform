/**
 * Content Hub Service
 *
 * Singleton-backed client for GET /api/tenants/:tenantId/content/summary —
 * follows the TenantApiSingleton pattern (auth injection, cache TTL,
 * service-cache invalidation) used by TenantDirectoryManagementService.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import type { ContentSummaryPayload } from '@/lib/content-hub';
import { clientLogger } from '@/lib/client-logger';

export class ContentHubService extends TenantApiSingleton {
  private static instance: ContentHubService;

  public getServiceCachePatterns(): string[] {
    return ['tenant-content-hub*'];
  }

  public async invalidateServiceCaches(_tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-content-hub*');
  }

  private constructor() {
    super('tenant-content-hub');
    this.cacheTTL = 60 * 1000; // 1 minute — status data, cheap to re-read
  }

  public static getInstance(): ContentHubService {
    if (!ContentHubService.instance) {
      ContentHubService.instance = new ContentHubService();
    }
    return ContentHubService.instance;
  }

  async getSummary(tenantId: string): Promise<ContentSummaryPayload | null> {
    if (!tenantId) return null;
    const result = await this.makeDefaultRequest<{ success: boolean; data: ContentSummaryPayload }>(
      `/api/tenants/${tenantId}/content/summary`,
      { method: 'GET' },
      `content-summary-${tenantId}`
    );
    if (!result.success) {
      clientLogger.error('[ContentHub] Failed to fetch summary:', { detail: result.error });
      return null;
    }
    return result.data?.data ?? null;
  }

  /** Phase-1 unified composer — multiplexes into gbp_posts / social_posts. */
  async postContent(
    tenantId: string,
    payload: {
      body: string;
      mediaUrl?: string;
      linkUrl?: string;
      scheduledFor?: string;
      destinations: { gbp?: boolean; meta?: string[]; place?: boolean };
    }
  ): Promise<{ posted: number; total: number; results: { channel: string; ok: boolean; scheduled?: boolean; error?: string }[] } | null> {
    const result = await this.makeDefaultRequest<{ success: boolean; data: any }>(
      `/api/tenants/${tenantId}/content/posts`,
      { method: 'POST', body: JSON.stringify(payload) },
      `content-post-${tenantId}`
    );
    if (!result.success) {
      clientLogger.error('[ContentHub] post failed:', { detail: result.error });
      return null;
    }
    await this.invalidateServiceCaches(tenantId);
    return result.data?.data ?? null;
  }
}

export const contentHubService = ContentHubService.getInstance();
