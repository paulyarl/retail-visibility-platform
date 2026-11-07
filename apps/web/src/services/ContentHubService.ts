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
      destinations: { gbp?: boolean; meta?: string[]; linkedin?: boolean; place?: boolean };
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

  // ── Tenant-side LinkedIn connect (linkedin-tenant.ts routes) ────────────

  async getLinkedInStatus(tenantId: string): Promise<{
    entitled: boolean; connected: boolean; memberName: string | null;
    reauthorizationRequired: boolean; tokenExpired: boolean;
    surfaces: { id: string; surface: string; targetRef: string; displayName: string | null; memberRole: string | null }[];
  } | null> {
    const result = await this.makeDefaultRequest<{ success: boolean; data: any }>(
      `/api/tenants/${tenantId}/linkedin/status`,
      { method: 'GET' },
      `linkedin-status-${tenantId}`
    );
    return result.success ? result.data?.data ?? null : null;
  }

  async getLinkedInAuthorizeUrl(tenantId: string): Promise<string | null> {
    const result = await this.makeDefaultRequest<{ success: boolean; data: { url: string } }>(
      `/api/tenants/${tenantId}/linkedin/authorize`,
      { method: 'GET' },
      `linkedin-auth-${tenantId}`
    );
    return result.success ? result.data?.data?.url ?? null : null;
  }

  async getLinkedInOrganizations(tenantId: string): Promise<{ connected: boolean; organizations: { urn: string; name: string; role: string }[] } | null> {
    const result = await this.makeDefaultRequest<{ success: boolean; data: any }>(
      `/api/tenants/${tenantId}/linkedin/organizations`,
      { method: 'GET' },
      `linkedin-orgs-${tenantId}`
    );
    return result.success ? result.data?.data ?? null : null;
  }

  async selectLinkedInSurface(tenantId: string, targetRef: string, displayName?: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/linkedin/select-surface`,
      { method: 'POST', body: JSON.stringify({ targetRef, displayName }) },
      `linkedin-select-${tenantId}`
    );
    return result.success;
  }

  async deleteLinkedInSurface(tenantId: string, surfaceId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/linkedin/surfaces/${surfaceId}`,
      { method: 'DELETE' },
      `linkedin-del-${tenantId}`
    );
    return result.success;
  }
}

export const contentHubService = ContentHubService.getInstance();
