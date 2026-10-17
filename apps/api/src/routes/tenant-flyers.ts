/**
 * Tenant Flyer Routes
 *
 * Merchant CRUD + composer endpoints for the flyer capability (migration 344,
 * spec docs/LocalBiz/FLYER_SURFACE_SPEC.md §5).
 *
 * Mounted via tenantOrchestrator at /api/tenants — paths are
 * /:tenantId/flyers* and /:tenantId/flyer-options.
 *
 * Auth scope (per AUTH_SCOPE_ISOLATION_SPEC): per-route auth only —
 * authenticateToken + checkTenantAccess on every route, requireInventoryAccess
 * on flyer mutations, requireTenantAdmin on the options PUT (matches the
 * featured-options-settings convention).
 *
 * Capability posture: the flyer module is a *tooling* grant — the merchant
 * authors every artifact. Nothing here creates flyer content on enable.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { requireInventoryAccess, requireTenantAdmin } from '../middleware/permissions';
import { z } from 'zod';
import {
  resolveEffectiveCapabilities,
  invalidateEffectiveCapabilities,
} from '../services/EffectiveCapabilityResolver';
import {
  generateFlyerId,
  generateFlyerItemId,
  generateFlyerOptionsSettingsId,
  generateFlyerShareCode,
  generateTenantItemId,
  generateTenantVariantId,
  generateVariantSkuFromParent,
  generateSKU,
  generateTenantKey,
} from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const router = Router({ mergeParams: true });

const WEB_BASE_URL = (
  unifiedConfig.frontendUrl ||
  unifiedConfig.webUrl ||
  'https://app.visibleshelf.com'
).replace(/\/+$/, '');

const MAX_LIVE_FLYERS = 2; // spec §3 — scheduled flyers don't count until live

const flyerWindowSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().max(2000).nullish(),
  heroImageUrl: z.string().url().max(2000).nullish(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  ctaMode: z.enum(['auto', 'order', 'view']).optional(),
});

const flyerItemSchema = z.object({
  inventoryItemId: z.string().max(255).optional(),
  variantId: z.string().max(255).optional(),
  dish: z.object({
    name: z.string().min(1).max(160),
    priceCents: z.number().int().min(0),
    salePriceCents: z.number().int().min(0).nullish(),
    stock: z.number().int().min(0).optional(),
    imageUrl: z.string().url().max(2000).nullish(),
  }).optional(),
  note: z.string().max(120).nullish(),
  sortOrder: z.number().int().min(0).optional(),
});

const flyerOptionsSchema = z.object({
  flyer_display: z.boolean().optional(),
  flyer_storefront_display: z.boolean().optional(),
  flyer_directory_display: z.boolean().optional(),
  flyer_place_display: z.boolean().optional(),
  flyer_frozen_display: z.boolean().optional(),
  default_title: z.string().max(160).nullish(),
});

function logErr(route: string, error: unknown, tenantId?: string) {
  logger.error(`[tenant-flyers] ${route} error`, undefined, {
    tenantId,
    error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack },
  });
}

/** Resolve effective flyer state; null when the capability manifest is unavailable. */
async function flyerState(tenantId: string) {
  const caps = await resolveEffectiveCapabilities(tenantId);
  return caps?.effective?.flyer ?? null;
}

/** Count currently-live flyers (published + inside window). */
async function liveFlyerCount(tenantId: string, excludeId?: string): Promise<number> {
  const now = new Date();
  return prisma.tenant_flyers.count({
    where: {
      tenant_id: tenantId,
      status: 'published',
      starts_at: { lte: now },
      ends_at: { gt: now },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

/**
 * Find-or-create the stable "specials" parent item — dishes are variants on it
 * (spec §3). Private visibility so the container never merchandises itself.
 */
async function ensureSpecialsParent(tenantId: string) {
  const existing = await prisma.inventory_items.findFirst({
    where: { tenant_id: tenantId, metadata: { path: ['flyer_special_parent'], equals: true } },
    select: { id: true, sku: true, product_type: true },
  });
  if (existing) return existing;

  return prisma.inventory_items.create({
    data: {
      id: generateTenantItemId(tenantId),
      tenant_id: tenantId,
      sku: generateSKU({ tenantKey: generateTenantKey(tenantId), productType: 'physical' }),
      name: 'Specials',
      title: 'Specials',
      brand: 'House',
      price: 0,
      price_cents: 0,
      stock: 0,
      has_variants: true,
      visibility: 'private',
      item_status: 'active',
      description: 'Rotating specials — merchant-managed flyer items live here as variants.',
      metadata: { flyer_special_parent: true },
      updated_at: new Date(),
    },
    select: { id: true, sku: true, product_type: true },
  });
}

/** Deactivate variants that are no longer referenced by any non-expired flyer. */
async function releaseOrphanVariants(flyerId: string) {
  const variantIds = (await prisma.tenant_flyer_items.findMany({
    where: { flyer_id: flyerId, variant_id: { not: null } },
    select: { variant_id: true },
  })).map(r => r.variant_id!);
  for (const id of variantIds) {
    const liveRefs = await prisma.tenant_flyer_items.count({
      where: {
        variant_id: id,
        tenant_flyers: { status: { in: ['draft', 'scheduled', 'published'] } },
      },
    });
    if (liveRefs === 0) {
      await prisma.product_variants.update({ where: { id }, data: { is_active: false } });
    }
  }
}

// ── GET /:tenantId/flyers — list all flyers (merchant view, all statuses) ──
router.get('/:tenantId/flyers', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const [flyers, flyer] = await Promise.all([
      prisma.tenant_flyers.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        include: { tenant_flyer_items: { orderBy: { sort_order: 'asc' } } },
      }),
      flyerState(tenantId),
    ]);

    res.json({ success: true, data: { flyers, capability: flyer } });
  } catch (error) {
    logErr('GET /:tenantId/flyers', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── POST /:tenantId/flyers — create a draft/scheduled/published flyer ──
router.post('/:tenantId/flyers', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parsed = flyerWindowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }
    if (parsed.data.endsAt <= parsed.data.startsAt) {
      return res.status(400).json({ success: false, error: 'invalid_window', message: 'endsAt must be after startsAt' });
    }

    const flyer = await flyerState(tenantId);
    if (!flyer?.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'Flyer capability is not enabled for this tenant' });
    }
    if (parsed.data.heroImageUrl && !flyer.image) {
      return res.status(403).json({ success: false, error: 'tier_restricted', feature_key: 'flyer_image' });
    }

    const status = (req.body.status as string) === 'published' ? 'published' : 'draft';
    if (status === 'published' && (await liveFlyerCount(tenantId)) >= MAX_LIVE_FLYERS) {
      return res.status(409).json({ success: false, error: 'live_flyer_cap', message: `At most ${MAX_LIVE_FLYERS} live flyers per tenant` });
    }

    const created = await prisma.tenant_flyers.create({
      data: {
        id: generateFlyerId(tenantId),
        tenant_id: tenantId,
        title: parsed.data.title,
        summary: parsed.data.summary ?? null,
        hero_image_url: parsed.data.heroImageUrl ?? null,
        starts_at: parsed.data.startsAt,
        ends_at: parsed.data.endsAt,
        status,
        cta_mode: parsed.data.ctaMode ?? 'auto',
        share_code: generateFlyerShareCode(),
      },
    });

    res.status(201).json({ success: true, data: { flyer: created } });
  } catch (error) {
    logErr('POST /:tenantId/flyers', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── GET /:tenantId/flyers/repertoire — dish library for the composer ──
// NOTE: must be declared before /:tenantId/flyers/:flyerId routes.
router.get('/:tenantId/flyers/repertoire', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parents = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenantId,
        metadata: { path: ['flyer_special_parent'], equals: true },
      },
      select: { id: true },
    });
    const frozenParents = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenantId,
        metadata: { path: ['flyer_frozen_parent'], equals: true },
      },
      select: { id: true },
    });

    const [dishes, frozen] = await Promise.all([
      parents.length
        ? prisma.product_variants.findMany({
            where: { parent_item_id: { in: parents.map(p => p.id) } },
            orderBy: [{ is_active: 'desc' }, { variant_name: 'asc' }],
          })
        : Promise.resolve([]),
      frozenParents.length
        ? prisma.product_variants.findMany({
            where: { parent_item_id: { in: frozenParents.map(p => p.id) } },
            orderBy: { variant_name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    res.json({
      success: true,
      data: {
        parentItemId: parents[0]?.id ?? null,
        dishes,
        frozen,
      },
    });
  } catch (error) {
    logErr('GET /:tenantId/flyers/repertoire', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── PATCH /:tenantId/flyers/:flyerId — edit fields / reschedule ──
router.patch('/:tenantId/flyers/:flyerId', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, flyerId } = req.params;
    const existing = await prisma.tenant_flyers.findFirst({ where: { id: flyerId, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'not_found' });
    if (existing.status === 'suppressed') {
      return res.status(403).json({ success: false, error: 'flyer_suppressed', message: 'This flyer was removed by platform moderation' });
    }

    const parsed = flyerWindowSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const startsAt = parsed.data.startsAt ?? existing.starts_at;
    const endsAt = parsed.data.endsAt ?? existing.ends_at;
    if (endsAt <= startsAt) {
      return res.status(400).json({ success: false, error: 'invalid_window', message: 'endsAt must be after startsAt' });
    }
    if (parsed.data.heroImageUrl) {
      const flyer = await flyerState(tenantId);
      if (!flyer?.image) {
        return res.status(403).json({ success: false, error: 'tier_restricted', feature_key: 'flyer_image' });
      }
    }

    const updated = await prisma.tenant_flyers.update({
      where: { id: flyerId },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.summary !== undefined ? { summary: parsed.data.summary } : {}),
        ...(parsed.data.heroImageUrl !== undefined ? { hero_image_url: parsed.data.heroImageUrl } : {}),
        ...(parsed.data.startsAt !== undefined ? { starts_at: parsed.data.startsAt } : {}),
        ...(parsed.data.endsAt !== undefined ? { ends_at: parsed.data.endsAt } : {}),
        ...(parsed.data.ctaMode !== undefined ? { cta_mode: parsed.data.ctaMode } : {}),
        updated_at: new Date(),
      },
    });

    res.json({ success: true, data: { flyer: updated } });
  } catch (error) {
    logErr('PATCH /:tenantId/flyers/:flyerId', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── DELETE /:tenantId/flyers/:flyerId — archive ──
router.delete('/:tenantId/flyers/:flyerId', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, flyerId } = req.params;
    const existing = await prisma.tenant_flyers.findFirst({ where: { id: flyerId, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'not_found' });

    await prisma.tenant_flyers.update({
      where: { id: flyerId },
      data: { status: 'archived', updated_at: new Date() },
    });
    await releaseOrphanVariants(flyerId);

    res.json({ success: true });
  } catch (error) {
    logErr('DELETE /:tenantId/flyers/:flyerId', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── PUT /:tenantId/flyers/:flyerId/items — replace the item set ──
router.put('/:tenantId/flyers/:flyerId/items', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, flyerId } = req.params;
    const parsed = z.array(flyerItemSchema).max(20).safeParse(req.body.items);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const [existing, flyer] = await Promise.all([
      prisma.tenant_flyers.findFirst({ where: { id: flyerId, tenant_id: tenantId } }),
      flyerState(tenantId),
    ]);
    if (!existing) return res.status(404).json({ success: false, error: 'not_found' });
    if (!flyer?.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled' });
    }
    if (parsed.data.length > flyer.items_limit) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        feature_key: 'flyer_items',
        message: `Your plan allows up to ${flyer.items_limit} flyer items`,
      });
    }

    for (const entry of parsed.data) {
      const targets = [entry.inventoryItemId, entry.variantId, entry.dish].filter(Boolean).length;
      if (targets !== 1) {
        return res.status(400).json({ success: false, error: 'invalid_item_target', message: 'Exactly one of inventoryItemId, variantId, or dish is required per item' });
      }
    }

    const items = await prisma.$transaction(async (tx) => {
      // Create any new dish variants on the specials parent
      const dishEntries = parsed.data.filter(e => e.dish);
      let parentId: string | null = null;
      let parentSku = '';
      if (dishEntries.length > 0) {
        const parent = await ensureSpecialsParent(tenantId);
        parentId = parent.id;
        parentSku = parent.sku;
      }
      const dishVariantIds = new Map<number, string>();
      for (const [i, entry] of parsed.data.entries()) {
        if (!entry.dish) continue;
        const variant = await tx.product_variants.create({
          data: {
            id: generateTenantVariantId(parentId!, tenantId),
            parent_item_id: parentId!,
            tenant_id: tenantId,
            variant_name: entry.dish.name,
            sku: generateVariantSkuFromParent(parentSku, i),
            price_cents: entry.dish.priceCents,
            sale_price_cents: entry.dish.salePriceCents ?? null,
            stock: entry.dish.stock ?? 0,
            image_url: entry.dish.imageUrl ?? null,
            is_active: true,
          },
        });
        dishVariantIds.set(i, variant.id);
      }

      // Re-enable repertoire variants being re-linked (spec §3 lifecycle)
      const linkedVariantIds = [
        ...parsed.data.filter(e => e.variantId).map(e => e.variantId!),
        ...dishVariantIds.values(),
      ];
      if (linkedVariantIds.length > 0) {
        await tx.product_variants.updateMany({
          where: { id: { in: linkedVariantIds }, tenant_id: tenantId },
          data: { is_active: true },
        });
      }

      await tx.tenant_flyer_items.deleteMany({ where: { flyer_id: flyerId } });
      return Promise.all(parsed.data.map((entry, i) =>
        tx.tenant_flyer_items.create({
          data: {
            id: generateFlyerItemId(tenantId),
            flyer_id: flyerId,
            inventory_item_id: entry.inventoryItemId ?? null,
            variant_id: entry.variantId ?? dishVariantIds.get(i) ?? null,
            note: entry.note ?? null,
            sort_order: entry.sortOrder ?? i,
          },
        }),
      ));
    });

    res.json({ success: true, data: { items } });
  } catch (error) {
    logErr('PUT /:tenantId/flyers/:flyerId/items', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── POST /:tenantId/flyers/:flyerId/publish — publish now or schedule ──
router.post('/:tenantId/flyers/:flyerId/publish', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, flyerId } = req.params;
    const existing = await prisma.tenant_flyers.findFirst({ where: { id: flyerId, tenant_id: tenantId } });
    if (!existing) return res.status(404).json({ success: false, error: 'not_found' });
    if (existing.status === 'suppressed') {
      return res.status(403).json({ success: false, error: 'flyer_suppressed' });
    }

    const flyer = await flyerState(tenantId);
    if (!flyer?.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled' });
    }

    const now = new Date();
    const goesLiveNow = existing.starts_at <= now && existing.ends_at > now;
    if (goesLiveNow && (await liveFlyerCount(tenantId, flyerId)) >= MAX_LIVE_FLYERS) {
      return res.status(409).json({ success: false, error: 'live_flyer_cap', message: `At most ${MAX_LIVE_FLYERS} live flyers per tenant` });
    }
    if (existing.ends_at <= now) {
      return res.status(400).json({ success: false, error: 'window_elapsed', message: 'Flyer window has already ended — reschedule before publishing' });
    }

    const status = goesLiveNow ? 'published' : 'scheduled';
    const updated = await prisma.tenant_flyers.update({
      where: { id: flyerId },
      data: { status, updated_at: now },
    });
    if (goesLiveNow) {
      // Publish → linked variants become orderable (spec §3)
      const variantIds = (await prisma.tenant_flyer_items.findMany({
        where: { flyer_id: flyerId, variant_id: { not: null } },
        select: { variant_id: true },
      })).map(r => r.variant_id!);
      if (variantIds.length > 0) {
        await prisma.product_variants.updateMany({
          where: { id: { in: variantIds } },
          data: { is_active: true },
        });
      }
    }

    res.json({ success: true, data: { flyer: updated } });
  } catch (error) {
    logErr('POST /:tenantId/flyers/:flyerId/publish', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── GET /:tenantId/flyers/:flyerId/share-assets — WhatsApp/share kit ──
router.get('/:tenantId/flyers/:flyerId/share-assets', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, flyerId } = req.params;
    const [flyerRow, tenant] = await Promise.all([
      prisma.tenant_flyers.findFirst({ where: { id: flyerId, tenant_id: tenantId } }),
      prisma.tenants.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } }),
    ]);
    if (!flyerRow) return res.status(404).json({ success: false, error: 'not_found' });

    const url = `${WEB_BASE_URL}/flyer/${flyerRow.share_code}`;
    const stableUrl = tenant?.slug ? `${WEB_BASE_URL}/flyer/${tenant.slug}` : null;
    const caption = `${flyerRow.title} at ${tenant?.name ?? 'our store'} — see this week's specials: ${url}`;

    res.json({
      success: true,
      data: {
        url,
        stableUrl,
        caption,
        qrPayload: url,
        qrPayloadCustomer: stableUrl ? `${stableUrl}?src=qr-customer` : null,
        qrPayloadMerchant: tenant?.slug ? `${WEB_BASE_URL}/t/${tenantId}/settings/flyers?src=qr-merchant` : null,
      },
    });
  } catch (error) {
    logErr('GET /:tenantId/flyers/:flyerId/share-assets', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── POST /:tenantId/flyers/:flyerId/duplicate — next-flyer workflow ──
router.post('/:tenantId/flyers/:flyerId/duplicate', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, flyerId } = req.params;
    const source = await prisma.tenant_flyers.findFirst({
      where: { id: flyerId, tenant_id: tenantId },
      include: { tenant_flyer_items: true },
    });
    if (!source) return res.status(404).json({ success: false, error: 'not_found' });

    const flyer = await flyerState(tenantId);
    if (!flyer?.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled' });
    }

    // Shift the window by its own duration — "same window next period"
    const durationMs = source.ends_at.getTime() - source.starts_at.getTime();
    const startsAt = new Date(source.ends_at.getTime());
    const endsAt = new Date(startsAt.getTime() + durationMs);

    const copy = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant_flyers.create({
        data: {
          id: generateFlyerId(tenantId),
          tenant_id: tenantId,
          title: source.title,
          summary: source.summary,
          hero_image_url: source.hero_image_url,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'draft',
          cta_mode: source.cta_mode,
          share_code: generateFlyerShareCode(),
        },
      });
      if (source.tenant_flyer_items.length > 0) {
        await tx.tenant_flyer_items.createMany({
          data: source.tenant_flyer_items.map(item => ({
            id: generateFlyerItemId(tenantId),
            flyer_id: created.id,
            inventory_item_id: item.inventory_item_id,
            variant_id: item.variant_id,
            note: item.note,
            sort_order: item.sort_order,
          })),
        });
      }
      return created;
    });

    res.status(201).json({ success: true, data: { flyer: copy } });
  } catch (error) {
    logErr('POST /:tenantId/flyers/:flyerId/duplicate', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── GET /:tenantId/flyer-options — merchant display prefs (tier-filtered) ──
router.get('/:tenantId/flyer-options', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const flyer = await flyerState(tenantId);
    const prefs = await prisma.tenant_flyer_options_settings.findUnique({ where: { tenant_id: tenantId } });

    res.json({
      success: true,
      settings: {
        flyer_display: (prefs?.flyer_display ?? true) && !!flyer?.enabled,
        flyer_storefront_display: (prefs?.flyer_storefront_display ?? true) && !!flyer?.storefront_on,
        flyer_directory_display: (prefs?.flyer_directory_display ?? true) && !!flyer?.directory_on,
        flyer_place_display: (prefs?.flyer_place_display ?? true) && !!flyer?.place_on,
        flyer_frozen_display: (prefs?.flyer_frozen_display ?? true) && !!flyer?.frozen,
        default_title: prefs?.default_title ?? 'Featured Specials',
      },
      tierState: flyer,
    });
  } catch (error) {
    logErr('GET /:tenantId/flyer-options', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── PUT /:tenantId/flyer-options — update display prefs ──
router.put('/:tenantId/flyer-options', authenticateToken, checkTenantAccess, requireTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parsed = flyerOptionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const flyer = await flyerState(tenantId);
    if (!flyer?.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled' });
    }

    // Reject enabling a surface the tier doesn't grant
    const gate: Record<string, boolean> = {
      flyer_storefront_display: flyer.storefront_on,
      flyer_directory_display: flyer.directory_on,
      flyer_place_display: flyer.place_on,
      flyer_frozen_display: flyer.frozen,
    };
    for (const [key, allowed] of Object.entries(gate)) {
      if ((parsed.data as any)[key] === true && !allowed) {
        return res.status(403).json({ success: false, error: 'tier_restricted', feature_key: key });
      }
    }

    const data = {
      ...(parsed.data.flyer_display !== undefined ? { flyer_display: parsed.data.flyer_display } : {}),
      ...(parsed.data.flyer_storefront_display !== undefined ? { flyer_storefront_display: parsed.data.flyer_storefront_display } : {}),
      ...(parsed.data.flyer_directory_display !== undefined ? { flyer_directory_display: parsed.data.flyer_directory_display } : {}),
      ...(parsed.data.flyer_place_display !== undefined ? { flyer_place_display: parsed.data.flyer_place_display } : {}),
      ...(parsed.data.flyer_frozen_display !== undefined ? { flyer_frozen_display: parsed.data.flyer_frozen_display } : {}),
      ...(parsed.data.default_title !== undefined ? { default_title: parsed.data.default_title } : {}),
    };

    const settings = await prisma.tenant_flyer_options_settings.upsert({
      where: { tenant_id: tenantId },
      create: { id: generateFlyerOptionsSettingsId(tenantId), tenant_id: tenantId, ...data },
      update: { ...data, updated_at: new Date() },
    });

    invalidateEffectiveCapabilities(tenantId);
    res.json({ success: true, settings });
  } catch (error) {
    logErr('PUT /:tenantId/flyer-options', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
