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
export type FlyerRecurrence = 'none' | 'daily' | 'weekly';

export interface TenantFlyerItem {
  id: string;
  flyer_id: string;
  inventory_item_id: string | null;
  variant_id: string | null;
  sort_order: number;
  note: string | null;
  inventory_items?: { name: string; image_url: string | null; price_cents: number | null; sale_price_cents: number | null } | null;
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
  recurrence?: FlyerRecurrence;
  keywords?: string[];
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
  dish?: { name: string; priceCents: number | null; salePriceCents?: number | null; stock?: number; imageUrl?: string | null };
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

export interface FlyerAnalyticsEntry {
  id: string;
  title: string;
  status: FlyerStatus;
  shareCode: string | null;
  window: { startsAt: string; endsAt: string };
  totals: { impressions: number; clicks: number };
  orders: number;
  revenueCents: number;
  bySrc: Record<string, number>;
  daily: Array<{ date: string; impressions: number; clicks: number; add_to_cart: number }>;
}

export interface FlyerAnalytics {
  windowDays: number;
  flyers: FlyerAnalyticsEntry[];
}

export interface FlyerDraftDish {
  name: string;
  priceCents: number | null;
  salePriceCents?: number | null;
  stock?: number | null;
  attributes?: string[] | null;
  note?: string | null;
  needsPriceConfirmation: boolean;
  priceSource: 'agent' | 'repertoire_history' | 'none';
}

export interface FlyerExtractionDraft {
  title: string;
  summary?: string | null;
  keywords?: string[];
  dishes: FlyerDraftDish[];
  suggestedWindow?: 'today' | 'this_weekend' | 'this_week' | 'custom';
}

export interface FlyerCardOrder {
  id: string;
  tenant_id: string;
  pack_size: number;
  pack_count: number;
  vendor: string;
  vendor_order_id: string | null;
  status: 'submitted' | 'printed' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: Record<string, unknown> | null;
  unit_cost_cents: number | null;
  total_cost_cents: number | null;
  created_at: string;
  updated_at: string;
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
    return ['flyer-list-*', 'flyer-repertoire-*', 'flyer-options-*', 'flyer-share-*', 'flyer-analytics-*', 'flyer-card-orders-*'];
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
    recurrence?: FlyerRecurrence; keywords?: string[];
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
    startsAt: string; endsAt: string; ctaMode: FlyerCtaMode; recurrence: FlyerRecurrence; keywords: string[];
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

  async uploadFlyerHeroImage(tenantId: string, dataUrl: string): Promise<string> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ url: string }>>(
      `/api/tenants/${tenantId}/flyers/hero-image`,
      { method: 'POST', body: JSON.stringify({ dataUrl }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to upload flyer image');
    return result.data.data.url;
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

  async freezeDishes(tenantId: string, dishes: { sourceVariantId: string; quantity: number; priceCents?: number | null; salePriceCents?: number | null }[]): Promise<FlyerVariant[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ frozen: FlyerVariant[] }>>(
      `/api/tenants/${tenantId}/flyers/freeze`,
      { method: 'POST', body: JSON.stringify({ dishes }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to freeze dishes');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.frozen;
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

  /** Dual-publish a flyer to GBP — creates a SCHEDULED gbp_posts row (spec §7). */
  async publishFlyerToGbp(tenantId: string, flyerId: string): Promise<{ post: unknown; shareUrl: string }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ post: unknown; shareUrl: string }>>(
      `/api/tenants/${tenantId}/flyers/${flyerId}/publish-gbp`,
      { method: 'POST' },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to schedule GBP post');
    return result.data.data;
  }

  /** Engagement + order attribution — directional only, never demand (spec §10). */
  async getAnalytics(tenantId: string, days = 30): Promise<FlyerAnalytics> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FlyerAnalytics>>(
      `/api/tenants/${tenantId}/flyers/analytics?days=${days}`,
      { method: 'GET' },
      `flyer-analytics-${tenantId}-${days}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load analytics');
    return result.data.data;
  }

  async getCardOrders(tenantId: string): Promise<FlyerCardOrder[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ orders: FlyerCardOrder[] }>>(
      `/api/tenants/${tenantId}/flyers/card-orders`,
      { method: 'GET' },
      `flyer-card-orders-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load card orders');
    return result.data.data.orders;
  }

  async createCardOrder(tenantId: string, input: {
    packSize: 25 | 50 | 100;
    packCount: number;
    shippingAddress: {
      name: string; line1: string; line2?: string | null;
      city: string; state?: string | null; zip: string; country?: string;
    };
  }): Promise<FlyerCardOrder> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ order: FlyerCardOrder }>>(
      `/api/tenants/${tenantId}/flyers/card-orders`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to place card order');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.order;
  }

  /** Agent-drafted flyer from a merchant brief — draft only, never persists (spec §7a.1). */
  async extractFlyerDraft(tenantId: string, brief: string): Promise<FlyerExtractionDraft> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ draft: FlyerExtractionDraft }>>(
      `/api/tenants/${tenantId}/flyers/extract`,
      { method: 'POST', body: JSON.stringify({ brief }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error((result.data as any).message || result.data.error || 'Failed to extract draft');
    return result.data.data.draft;
  }

  /** Print-ready double-sided card PDF — anchor href, not a fetch. */
  cardArtUrl(tenantId: string): string {
    return `/api/tenants/${tenantId}/flyers/card-art`;
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
