/**
 * Flyer Service — Frontend Singleton
 *
 * Merchant flyer CRUD + composer endpoints. Extends TenantApiSingleton —
 * no direct fetch() calls.
 *
 * Spec: docs/LocalBiz/FLYER_SURFACE_SPEC.md §5.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { unifiedCapabilityService } from './UnifiedCapabilityService';
import type { FlyerState } from './CapabilityResolutionService';

export type FlyerStatus = 'draft' | 'scheduled' | 'published' | 'expired' | 'archived' | 'suppressed';
export type FlyerCtaMode = 'auto' | 'order' | 'view';

export interface TenantFlyerItem {
  id: string;
  flyer_id: string;
  inventory_item_id: string | null;
  variant_id: string | null;
  sort_order: number;
  note: string | null;
}

export interface TenantFlyer {
  id: string;
  tenant_id: string;
  title: string;
  summary: string | null;
  hero_image_url: string | null;
  starts_at: string;
  ends_at: string;
  status: FlyerStatus;
  cta_mode: FlyerCtaMode;
  share_code: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at: string;
  tenant_flyer_items?: TenantFlyerItem[];
}

export interface FlyerItemInput {
  inventoryItemId?: string;
  variantId?: string;
  dish?: { name: string; priceCents: number; salePriceCents?: number | null; stock?: number; imageUrl?: string | null };
  note?: string | null;
  sortOrder?: number;
}

export interface FlyerVariant {
  id: string;
  sku: string;
  variant_name: string;
  price_cents: number | null;
  sale_price_cents: number | null;
  stock: number;
  image_url: string | null;
  is_active: boolean | null;
  attributes?: Record<string, unknown>;
}

export interface FlyerShareAssets {
  url: string;
  stableUrl: string | null;
  caption: string;
  qrPayload: string;
  qrPayloadCustomer: string | null;
  qrPayloadMerchant: string | null;
}

export interface FlyerOptionsSettings {
  flyer_display: boolean;
  flyer_storefront_display: boolean;
  flyer_directory_display: boolean;
  flyer_place_display: boolean;
  flyer_frozen_display: boolean;
  default_title: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

class FlyerService extends TenantApiSingleton {
  private static instance: FlyerService;

  private constructor() {
    super('flyer-service', { ttl: 2 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return ['flyer-list-*', 'flyer-repertoire-*', 'flyer-options-*', 'flyer-share-*'];
  }

  async invalidateServiceCaches(_tenantId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): FlyerService {
    if (!FlyerService.instance) FlyerService.instance = new FlyerService();
    return FlyerService.instance;
  }

  async getFlyerState(tenantId: string): Promise<FlyerState> {
    const all = await unifiedCapabilityService.getAllCapabilities(tenantId);
    return all.flyer;
  }

  async listFlyers(tenantId: string): Promise<{ flyers: TenantFlyer[]; capability: FlyerState | null }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ flyers: TenantFlyer[]; capability: FlyerState | null }>>(
      `/api/tenants/${tenantId}/flyers`,
      { method: 'GET' },
      `flyer-list-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load flyers');
    return result.data.data;
  }

  async createFlyer(tenantId: string, input: {
    title: string; summary?: string | null; heroImageUrl?: string | null;
    startsAt: string; endsAt: string; status?: 'draft' | 'published'; ctaMode?: FlyerCtaMode;
  }): Promise<TenantFlyer> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ flyer: TenantFlyer }>>(
      `/api/tenants/${tenantId}/flyers`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to create flyer');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.flyer;
  }

  async updateFlyer(tenantId: string, flyerId: string, input: Partial<{
    title: string; summary: string | null; heroImageUrl: string | null;
    startsAt: string; endsAt: string; ctaMode: FlyerCtaMode;
  }>): Promise<TenantFlyer> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ flyer: TenantFlyer }>>(
      `/api/tenants/${tenantId}/flyers/${flyerId}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to update flyer');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.flyer;
  }

  async archiveFlyer(tenantId: string, flyerId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/tenants/${tenantId}/flyers/${flyerId}`,
      { method: 'DELETE' },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches(tenantId);
  }

  async setFlyerItems(tenantId: string, flyerId: string, items: FlyerItemInput[]): Promise<TenantFlyerItem[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ items: TenantFlyerItem[] }>>(
      `/api/tenants/${tenantId}/flyers/${flyerId}/items`,
      { method: 'PUT', body: JSON.stringify({ items }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to save flyer items');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.items;
  }

  async getRepertoire(tenantId: string): Promise<{ parentItemId: string | null; dishes: FlyerVariant[]; frozen: FlyerVariant[] }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ parentItemId: string | null; dishes: FlyerVariant[]; frozen: FlyerVariant[] }>>(
      `/api/tenants/${tenantId}/flyers/repertoire`,
      { method: 'GET' },
      `flyer-repertoire-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load repertoire');
    return result.data.data;
  }

  async publishFlyer(tenantId: string, flyerId: string): Promise<TenantFlyer> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ flyer: TenantFlyer }>>(
      `/api/tenants/${tenantId}/flyers/${flyerId}/publish`,
      { method: 'POST' },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to publish flyer');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.flyer;
  }

  async getShareAssets(tenantId: string, flyerId: string): Promise<FlyerShareAssets> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FlyerShareAssets>>(
      `/api/tenants/${tenantId}/flyers/${flyerId}/share-assets`,
      { method: 'GET' },
      `flyer-share-${tenantId}-${flyerId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load share assets');
    return result.data.data;
  }

  async duplicateFlyer(tenantId: string, flyerId: string): Promise<TenantFlyer> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ flyer: TenantFlyer }>>(
      `/api/tenants/${tenantId}/flyers/${flyerId}/duplicate`,
      { method: 'POST' },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to duplicate flyer');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.flyer;
  }

  async getOptions(tenantId: string): Promise<{ settings: FlyerOptionsSettings; tierState: FlyerState | null }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ settings: FlyerOptionsSettings; tierState: FlyerState | null }> & { settings: FlyerOptionsSettings; tierState: FlyerState | null }>(
      `/api/tenants/${tenantId}/flyer-options`,
      { method: 'GET' },
      `flyer-options-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    const body = result.data as any;
    return { settings: body.settings ?? body.data?.settings, tierState: body.tierState ?? body.data?.tierState ?? null };
  }

  async updateOptions(tenantId: string, settings: Partial<FlyerOptionsSettings>): Promise<FlyerOptionsSettings> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FlyerOptionsSettings> & { settings: FlyerOptionsSettings }>(
      `/api/tenants/${tenantId}/flyer-options`,
      { method: 'PUT', body: JSON.stringify(settings) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches(tenantId);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);
    const body = result.data as any;
    return body.settings ?? body.data;
  }
}

export const flyerService = FlyerService.getInstance();
export default FlyerService;
