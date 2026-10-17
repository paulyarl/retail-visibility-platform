/**
 * Public Flyer Routes
 *
 * Two routers, two mounts (routeRegistry):
 *   - flyerPublicDirectoryRoutes  → /api/public/directory   GET /:slug/flyers
 *   - flyerPublicStandaloneRoutes → /api/public/flyer       GET /:code, POST /:code/report, POST /:code/events
 *
 * Canonical two-gate model (mirrors directory-gbp-public.ts):
 *   Hard gate: effective.flyer.enabled (+ per-surface can_use_* when ?surface=)
 *   Soft gate: merchant_preferences.flyer_display (+ the surface toggle)
 * Any gate failure fails closed: { success: true, data: { enabled: false } }.
 *
 * Public reads always exclude suppressed flyers alongside the window predicate.
 * Counters (impressions/clicks) are increment-on-write — directional only, never
 * reported as demand (spec §10).
 *
 * Spec: docs/LocalBiz/FLYER_SURFACE_SPEC.md §4, §5.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { resolveEffectiveCapabilitiesFromMV } from '../services/EffectiveCapabilityResolver';
import { generateFlyerReportId, generateFlyerEventId } from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';
import type { EffectiveCapabilities } from '../services/resolvers/types';

export const flyerPublicDirectoryRoutes = Router({ mergeParams: true });
export const flyerPublicStandaloneRoutes = Router({ mergeParams: true });

const WEB_BASE_URL = (
  unifiedConfig.frontendUrl ||
  unifiedConfig.webUrl ||
  'https://app.visibleshelf.com'
).replace(/\/+$/, '');

const reportSchema = z.object({
  reason: z.enum(['inappropriate', 'misleading', 'ip_infringement', 'prohibited_item', 'other']),
  detail: z.string().max(2000).optional(),
});

const eventSchema = z.object({
  type: z.enum(['click', 'add_to_cart']),
  itemId: z.string().max(50).optional(),
  surface: z.enum(['storefront', 'directory', 'place', 'standalone']).optional(),
  src: z.string().max(32).optional(),
});

const VALID_SRC = /^(qr-customer|qr-merchant|share|direct|[a-z0-9_-]{1,24})$/;

/** Fire-and-forget event row — never blocks the public response (spec §5). */
function recordFlyerEvent(
  flyerId: string,
  tenantId: string,
  eventType: 'impression' | 'click' | 'add_to_cart',
  surface?: string,
  src?: string | null,
  flyerItemId?: string,
): void {
  prisma.tenant_flyer_events.create({
    data: {
      id: generateFlyerEventId(tenantId),
      flyer_id: flyerId,
      tenant_id: tenantId,
      event_type: eventType,
      surface: surface ?? 'standalone',
      src: src && VALID_SRC.test(src) ? src : null,
      flyer_item_id: flyerItemId ?? null,
    },
  }).catch(() => {});
}

function logErr(route: string, error: unknown, extra?: Record<string, string>) {
  logger.error(`[public-flyer] ${route} error`, undefined, {
    ...extra,
    error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
  });
}

/** Resolve slug → tenant (mirrors directory-gbp-public.ts). */
async function resolveTenantIdentifier(identifier: string): Promise<{ id: string; slug: string | null } | null> {
  const byId = await prisma.tenants.findUnique({ where: { id: identifier }, select: { id: true, slug: true } });
  if (byId) return byId;
  const bySlug = await prisma.tenants.findFirst({ where: { slug: identifier }, select: { id: true, slug: true } });
  if (bySlug) return bySlug;
  const dirListing = await prisma.directory_listings_list.findFirst({
    where: { slug: identifier },
    select: { tenant_id: true },
  });
  if (dirListing) return { id: dirListing.tenant_id, slug: identifier };
  return null;
}

type FlyerSurface = 'storefront' | 'directory' | 'place';

function surfaceAllowed(caps: EffectiveCapabilities, surface: FlyerSurface | undefined): boolean {
  const flyer = caps.effective.flyer;
  if (!flyer?.enabled) return false;
  if (!flyer.merchant_preferences?.flyer_display) return false;
  switch (surface) {
    case 'storefront': return flyer.can_use_storefront;
    case 'place': return flyer.can_use_place;
    case 'directory':
    default: return flyer.can_use_directory;
  }
}

/**
 * Build the public flyer payload for a tenant. Returns null when the flyer
 * surface is gated off — callers fail closed to { enabled: false }.
 */
async function buildFlyerPayload(tenant: { id: string; slug: string | null }, surface?: FlyerSurface) {
  const caps = await resolveEffectiveCapabilitiesFromMV(tenant.id);
  if (!caps || !caps.effective?.flyer || !surfaceAllowed(caps, surface)) return null;

  const flyerCaps = caps.effective.flyer;
  const now = new Date();

  const flyers = await prisma.tenant_flyers.findMany({
    where: {
      tenant_id: tenant.id,
      status: 'published',
      starts_at: { lte: now },
      ends_at: { gt: now },
    },
    orderBy: { ends_at: 'asc' },
    take: flyerCaps.max_live || 2,
    include: {
      tenant_flyer_items: {
        orderBy: { sort_order: 'asc' },
        include: {
          product_variants: true,
          inventory_items: { select: { id: true, sku: true, name: true, price_cents: true, sale_price_cents: true, image_url: true, stock: true, item_status: true, visibility: true } },
        },
      },
    },
  });

  // Order CTAs are derived, not granted (spec §2): commerce + gateway must both
  // resolve, and cta_mode='view' suppresses ordering entirely.
  const orderCapable = !!caps.effective.commerce?.enabled && !!caps.effective.payment_gateway?.checkout_available;
  const fulfillment = caps.effective.fulfillment;

  const liveVariantIds: string[] = [];
  const flyerPayloads = flyers.map(f => {
    const orderEnabled = orderCapable && f.cta_mode !== 'view';
    const items = f.tenant_flyer_items.map(item => {
      const v = item.product_variants;
      const inv = item.inventory_items;
      if (v?.id) liveVariantIds.push(v.id);
      // Promo-only dishes (no_price attribute) are display items — shown
      // without a price and never orderable, even on order-enabled flyers
      const noPrice = v != null && (v.attributes as any)?.no_price === true;
      const orderable = !noPrice && orderEnabled && (
        v ? (v.is_active !== false && v.stock > 0)
          : inv ? (inv.item_status === 'active' && inv.visibility === 'public' && (inv.stock ?? 0) > 0)
          : false
      );
      return {
        id: v?.id ?? inv?.id ?? item.id,
        kind: v ? 'variant' as const : 'item' as const,
        productId: v?.parent_item_id ?? inv?.id ?? null,
        sku: v?.sku ?? inv?.sku ?? null,
        name: v?.variant_name ?? inv?.name ?? null,
        priceCents: noPrice ? null : (v?.price_cents ?? inv?.price_cents ?? null),
        salePriceCents: noPrice ? null : (v?.sale_price_cents ?? inv?.sale_price_cents ?? null),
        imageUrl: v?.image_url ?? inv?.image_url ?? null,
        note: item.note,
        orderable,
        inStock: v ? v.stock > 0 : (inv ? (inv.stock ?? 0) > 0 : false),
      };
    });
    return {
      id: f.id,
      title: f.title,
      summary: f.summary,
      heroImageUrl: f.hero_image_url,
      window: { startsAt: f.starts_at, endsAt: f.ends_at },
      shareCode: f.share_code,
      shareUrl: `${WEB_BASE_URL}/flyer/${f.share_code}`,
      items,
      cta: {
        orderEnabled,
        pickupEnabled: !!fulfillment?.effective_shows_pickup,
        pickupReadyMinutes: fulfillment?.pickup_ready_time_minutes ?? null,
      },
    };
  });

  // Frozen twins — mirror variants of live flyer dishes (spec §4.1a), only when
  // the tier grants flyer_frozen AND the merchant hasn't hidden the panel.
  let frozen: any[] = [];
  if (flyerCaps.frozen && flyerCaps.can_use_frozen_panel && liveVariantIds.length > 0) {
    const twins = await prisma.$queryRaw<Array<{
      id: string; sku: string; variant_name: string; price_cents: number | null;
      sale_price_cents: number | null; stock: number; image_url: string | null;
      source_variant_id: string | null;
    }>>`
      SELECT id, sku, variant_name, price_cents, sale_price_cents, stock, image_url,
             attributes->>'source_variant_id' AS source_variant_id
      FROM product_variants
      WHERE tenant_id = ${tenant.id}
        AND is_active = true
        AND stock > 0
        AND attributes->>'source_variant_id' = ANY(${liveVariantIds})
    `;
    frozen = twins.map(t => ({
      variantId: t.id,
      sku: t.sku,
      name: t.variant_name,
      priceCents: t.price_cents,
      salePriceCents: t.sale_price_cents,
      inStock: t.stock,
      imageUrl: t.image_url,
      sourceVariantId: t.source_variant_id,
      orderable: orderCapable,
    }));
  }

  return {
    enabled: true,
    surfaces: {
      storefront: flyerCaps.can_use_storefront,
      directory: flyerCaps.can_use_directory,
      place: flyerCaps.can_use_place,
    },
    flyers: flyerPayloads,
    frozen,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Directory mount — GET /api/public/directory/:slug/flyers
// ══════════════════════════════════════════════════════════════════════════
flyerPublicDirectoryRoutes.get('/:slug/flyers', async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenantIdentifier(req.params.slug);
    if (!tenant) return res.status(404).json({ success: false, error: 'not_found' });

    const surface = ['storefront', 'directory', 'place'].includes(String(req.query.surface))
      ? (req.query.surface as FlyerSurface)
      : undefined;
    const src = typeof req.query.src === 'string' ? req.query.src : undefined;
    const data = await buildFlyerPayload(tenant, surface ?? 'directory');
    if (!data) return res.json({ success: true, data: { enabled: false } });

    // Impression events for every flyer the surface rendered (spec §5)
    for (const f of data.flyers) {
      recordFlyerEvent(f.id, tenant.id, 'impression', surface ?? 'directory', src);
    }

    res.json({ success: true, data });
  } catch (error) {
    logErr('GET /directory/:slug/flyers', error);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// Standalone mount — /api/public/flyer/:code
// :code is a per-flyer share_code OR the tenant slug (stable always-current URL)
// ══════════════════════════════════════════════════════════════════════════
// ── POST /card-order-webhook — print vendor status callbacks (spec §4.3) ──
// Declared BEFORE /:code — 'card-order-webhook' is a single segment that
// would otherwise bind to the :code param. Shared-secret auth: the vendor
// POSTs {vendorOrderId, status, trackingUrl?} with the webhook token.
const cardWebhookSchema = z.object({
  vendorOrderId: z.string().min(1).max(128),
  status: z.enum(['submitted', 'printed', 'shipped', 'delivered', 'cancelled']),
  token: z.string().min(1).max(128),
});

flyerPublicStandaloneRoutes.post('/card-order-webhook', async (req: Request, res: Response) => {
  try {
    const expected = unifiedConfig.get('FLYER_PRINT_WEBHOOK_SECRET');
    if (!expected) {
      // Webhook unconfigured — refuse rather than accept unauthenticated updates
      return res.status(503).json({ success: false, error: 'webhook_not_configured' });
    }
    const parsed = cardWebhookSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.token !== expected) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const order = await prisma.tenant_flyer_card_orders.findFirst({
      where: { vendor_order_id: parsed.data.vendorOrderId },
      select: { id: true, status: true },
    });
    if (!order) return res.status(404).json({ success: false, error: 'not_found' });

    // Statuses only move forward — vendor replays/out-of-order events are
    // absorbed, never regress a delivered order back to printed
    const ORDER = ['submitted', 'printed', 'shipped', 'delivered'];
    const cur = ORDER.indexOf(order.status);
    const next = ORDER.indexOf(parsed.data.status);
    if (parsed.data.status === 'cancelled' || next > cur) {
      await prisma.tenant_flyer_card_orders.update({
        where: { id: order.id },
        data: { status: parsed.data.status, updated_at: new Date() },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[public-flyer] card-order-webhook error', undefined, {
      error: { message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

flyerPublicStandaloneRoutes.get('/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    // 1. Exact share_code match → per-flyer page (may be expired — show state)
    const byCode = await prisma.tenant_flyers.findFirst({
      where: { share_code: code, status: { not: 'suppressed' } },
      select: { id: true, tenant_id: true },
    });
    if (byCode) {
      const tenant = await prisma.tenants.findUnique({ where: { id: byCode.tenant_id }, select: { id: true, slug: true } });
      if (!tenant) return res.status(404).json({ success: false, error: 'not_found' });
      const data = await buildFlyerPayload(tenant);
      if (!data) return res.json({ success: true, data: { enabled: false } });
      // The page is about THIS flyer — narrow to it when it's still live,
      // otherwise report its window state so the page can show "ended".
      const mine = data.flyers.find(f => f.id === byCode.id);
      await prisma.tenant_flyers.update({ where: { id: byCode.id }, data: { impressions: { increment: 1 } } }).catch(() => {});
      recordFlyerEvent(byCode.id, tenant.id, 'impression', 'standalone', typeof req.query.src === 'string' ? req.query.src : undefined);
      return res.json({ success: true, data: { ...data, flyers: mine ? [mine] : [], ended: !mine } });
    }

    // 2. Tenant slug → stable always-current target (QR cards)
    const tenant = await resolveTenantIdentifier(code);
    if (!tenant) return res.status(404).json({ success: false, error: 'not_found' });
    const data = await buildFlyerPayload(tenant);
    if (!data) return res.json({ success: true, data: { enabled: false } });
    // Every rendered flyer gets the impression — the page shows them all
    for (const f of data.flyers) {
      await prisma.tenant_flyers.update({ where: { id: f.id }, data: { impressions: { increment: 1 } } }).catch(() => {});
      recordFlyerEvent(f.id, tenant.id, 'impression', 'standalone', typeof req.query.src === 'string' ? req.query.src : undefined);
    }
    return res.json({ success: true, data });
  } catch (error) {
    logErr('GET /flyer/:code', error);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// POST /api/public/flyer/:code/report — reactive moderation (spec §10)
flyerPublicStandaloneRoutes.post('/:code/report', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const flyer = await prisma.tenant_flyers.findFirst({
      where: { share_code: code },
      select: { id: true, tenant_id: true },
    });
    if (!flyer) return res.status(404).json({ success: false, error: 'not_found' });

    const reporterIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

    // Coarse abuse guard — one open report per flyer per IP per 24h
    if (reporterIp) {
      const dupe = await prisma.tenant_flyer_reports.findFirst({
        where: { flyer_id: flyer.id, reporter_ip: reporterIp, created_at: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        select: { id: true },
      });
      if (dupe) return res.status(429).json({ success: false, error: 'already_reported' });
    }

    await prisma.tenant_flyer_reports.create({
      data: {
        id: generateFlyerReportId(flyer.tenant_id),
        flyer_id: flyer.id,
        reason: parsed.data.reason,
        detail: parsed.data.detail ?? null,
        reporter_ip: reporterIp,
      },
    });

    res.status(201).json({ success: true });
  } catch (error) {
    logErr('POST /flyer/:code/report', error);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// POST /api/public/flyer/:code/events — counter increments (clicks)
flyerPublicStandaloneRoutes.post('/:code/events', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const flyer = await prisma.tenant_flyers.findFirst({
      where: { share_code: code, status: { not: 'suppressed' } },
      select: { id: true, tenant_id: true },
    });
    if (!flyer) return res.status(404).json({ success: false, error: 'not_found' });

    await prisma.tenant_flyers.update({ where: { id: flyer.id }, data: { clicks: { increment: 1 } } });
    recordFlyerEvent(flyer.id, flyer.tenant_id, parsed.data.type, parsed.data.surface, parsed.data.src, parsed.data.itemId);
    res.json({ success: true });
  } catch (error) {
    logErr('POST /flyer/:code/events', error);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});
