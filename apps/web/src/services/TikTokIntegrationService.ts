/**
 * TikTokIntegrationService — Tenant TikTok Shop integration service
 * Extends TenantApiSingleton for Auth0 cookie-based auth with X-Tenant-ID header
 * Endpoints: /api/tiktok/oauth/*, /api/tiktok/catalog/*
 */
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface TikTokStatus {
  isConnected: boolean;
  isExpired: boolean;
  hasTokens: boolean;
  email: string | null;
  displayName: string | null;
  shopId: string | null;
  shopName: string | null;
  scopes: string[] | null;
  tokenExpiry: string | null;
  message: string;
}

export interface TikTokSyncStatus {
  total: number;
  active: number;
  syncing: number;
  notSyncing: number;
  shopId: string | null;
  shopName: string | null;
  lastSyncAt: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class TikTokIntegrationService extends TenantApiSingleton {
  private static instance: TikTokIntegrationService;

  private constructor() {
    super('tiktok-integration-service', { ttl: 5 * 60 * 1000 });
  }

  static getInstance(): TikTokIntegrationService {
    if (!TikTokIntegrationService.instance) {
      TikTokIntegrationService.instance = new TikTokIntegrationService();
    }
    return TikTokIntegrationService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['tiktok-oauth-status-*', 'tiktok-sync-status-*'];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`tiktok-oauth-status-${tenantId}`);
      await this.invalidateCache(`tiktok-sync-status-${tenantId}`);
    }
  }

  async getOAuthStatus(tenantId: string): Promise<TikTokStatus> {
    const result = await this.makeDefaultRequest<ApiEnvelope<TikTokStatus>>(
      `/api/tiktok/oauth/status?tenantId=${tenantId}`,
      { method: 'GET' },
      `tiktok-oauth-status-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to fetch status');
    return result.data.data!;
  }

  async getCatalogSyncStatus(tenantId: string): Promise<TikTokSyncStatus | null> {
    const result = await this.makeDefaultRequest<ApiEnvelope<TikTokSyncStatus>>(
      `/api/tiktok/catalog/sync-status?tenantId=${tenantId}`,
      { method: 'GET' },
      `tiktok-sync-status-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) return null;
    if (!result.data?.success) return null;
    return result.data.data ?? null;
  }

  async disconnectOAuth(tenantId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tiktok/oauth/disconnect`,
      { method: 'POST', body: JSON.stringify({ tenantId }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to disconnect');
    await this.invalidateServiceCaches(tenantId);
  }

  async syncCatalog(tenantId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tiktok/catalog/sync`,
      { method: 'POST', body: JSON.stringify({ tenantId }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to start sync');
    await this.invalidateCache(`tiktok-sync-status-${tenantId}`);
  }

  /**
   * Get TikTok OAuth authorize URL from backend.
   * Backend constructs the URL with state token, scopes, and redirect URI.
   * Frontend then navigates browser to the returned URL.
   */
  async getOAuthAuthorizeUrl(tenantId: string): Promise<string> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ url: string }>>(
      `/api/tiktok/oauth/authorize?tenantId=${tenantId}`,
      { method: 'GET' },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to get OAuth URL');
    return result.data.data!.url;
  }
}

export const tiktokIntegrationService = TikTokIntegrationService.getInstance();
export default TikTokIntegrationService;
