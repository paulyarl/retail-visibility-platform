/**
 * MetaIntegrationService — Tenant Meta Commerce integration service
 * Extends TenantApiSingleton for Auth0 cookie-based auth with X-Tenant-ID header
 * Endpoints: /api/meta/oauth/*, /api/meta/catalog/*
 */
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface MetaStatus {
  isConnected: boolean;
  isExpired: boolean;
  hasTokens: boolean;
  email: string | null;
  displayName: string | null;
  businessId: string | null;
  catalogId: string | null;
  instagramAccountId: string | null;
  scopes: string[] | null;
  tokenExpiry: string | null;
  message: string;
}

export interface MetaSyncStatus {
  total: number;
  active: number;
  syncing: number;
  notSyncing: number;
  catalogId: string | null;
  lastSyncAt: string | null;
}

export interface MetaBusiness {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username: string };
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class MetaIntegrationService extends TenantApiSingleton {
  private static instance: MetaIntegrationService;

  private constructor() {
    super('meta-integration-service', { ttl: 5 * 60 * 1000 });
  }

  static getInstance(): MetaIntegrationService {
    if (!MetaIntegrationService.instance) {
      MetaIntegrationService.instance = new MetaIntegrationService();
    }
    return MetaIntegrationService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['meta-oauth-status-*', 'meta-sync-status-*', 'meta-businesses-*'];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      await this.invalidateCache(`meta-oauth-status-${tenantId}`);
      await this.invalidateCache(`meta-sync-status-${tenantId}`);
      await this.invalidateCache(`meta-businesses-${tenantId}`);
    }
  }

  async getOAuthStatus(tenantId: string): Promise<MetaStatus> {
    const result = await this.makeDefaultRequest<ApiEnvelope<MetaStatus>>(
      `/api/meta/oauth/status?tenantId=${tenantId}`,
      { method: 'GET' },
      `meta-oauth-status-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to fetch status');
    return result.data.data!;
  }

  async getCatalogSyncStatus(tenantId: string): Promise<MetaSyncStatus | null> {
    const result = await this.makeDefaultRequest<ApiEnvelope<MetaSyncStatus>>(
      `/api/meta/catalog/sync-status?tenantId=${tenantId}`,
      { method: 'GET' },
      `meta-sync-status-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) return null;
    if (!result.data?.success) return null;
    return result.data.data ?? null;
  }

  async getBusinesses(tenantId: string): Promise<MetaBusiness[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ businesses: MetaBusiness[] }>>(
      `/api/meta/oauth/businesses?tenantId=${tenantId}`,
      { method: 'GET' },
      `meta-businesses-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) return [];
    if (!result.data?.success) return [];
    return result.data.data?.businesses ?? [];
  }

  async disconnectOAuth(tenantId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/meta/oauth/disconnect`,
      { method: 'POST', body: JSON.stringify({ tenantId }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to disconnect');
    await this.invalidateServiceCaches(tenantId);
  }

  async linkCatalog(
    tenantId: string,
    payload: { businessId: string | null; catalogId: string; instagramAccountId: string | null },
  ): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/meta/oauth/link-catalog`,
      { method: 'POST', body: JSON.stringify({ tenantId, ...payload }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to link catalog');
    await this.invalidateServiceCaches(tenantId);
  }

  async syncCatalog(tenantId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/meta/catalog/sync`,
      { method: 'POST', body: JSON.stringify({ tenantId }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to start sync');
    await this.invalidateCache(`meta-sync-status-${tenantId}`);
  }

  /**
   * Get Meta OAuth authorize URL from backend.
   * Backend constructs the URL with state token, scopes, and redirect URI.
   * Frontend then navigates browser to the returned URL.
   */
  async getOAuthAuthorizeUrl(tenantId: string): Promise<string> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ url: string }>>(
      `/api/meta/oauth/authorize?tenantId=${tenantId}`,
      { method: 'GET' },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.message || 'Failed to get OAuth URL');
    return result.data.data!.url;
  }
}

export const metaIntegrationService = MetaIntegrationService.getInstance();
export default MetaIntegrationService;
