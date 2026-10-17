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
  generateFlyerCardOrderId,
  generateTenantItemId,
  generateTenantVariantId,
  generateVariantSkuFromParent,
  generateSKU,
  generateTenantKey,
} from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import { permissionServiceFactory } from '../services/permissions/PermissionServiceFactory';
import { generateFlyerCardPdf } from '../services/FlyerCardArtService';
import { submitCardOrder, unitCostForPackSize } from '../services/FlyerPrintProvider';
import { extractFlyerDraft } from '../services/FlyerExtractionService';
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
  recurrence: z.enum(['none', 'daily', 'weekly']).optional(),
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
    const recurrence = parsed.data.recurrence ?? 'none';
    if (recurrence !== 'none' && !flyer.recurring) {
      return res.status(403).json({ success: false, error: 'tier_restricted', feature_key: 'flyer_recurring' });
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
        recurrence,
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
    if (parsed.data.heroImageUrl || (parsed.data.recurrence && parsed.data.recurrence !== 'none')) {
      const flyer = await flyerState(tenantId);
      if (parsed.data.heroImageUrl && !flyer?.image) {
        return res.status(403).json({ success: false, error: 'tier_restricted', feature_key: 'flyer_image' });
      }
      if (parsed.data.recurrence && parsed.data.recurrence !== 'none' && !flyer?.recurring) {
        return res.status(403).json({ success: false, error: 'tier_restricted', feature_key: 'flyer_recurring' });
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
        ...(parsed.data.recurrence !== undefined ? { recurrence: parsed.data.recurrence } : {}),
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

// ── POST /:tenantId/flyers/:flyerId/publish-gbp — dual-publish to GBP ──
// Creates a SCHEDULED gbp_posts row consumed by gbpPostScheduler (spec §7).
// Three gates: flyer module on, flyer_gbp_publish tier key, and the
// gbp_posts_scheduler entitlement (the scheduler also re-checks at publish).
router.post('/:tenantId/flyers/:flyerId/publish-gbp', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, flyerId } = req.params;

    const flyer = await prisma.tenant_flyers.findFirst({ where: { id: flyerId, tenant_id: tenantId } });
    if (!flyer) return res.status(404).json({ success: false, error: 'not_found' });
    if (flyer.status === 'suppressed') {
      return res.status(403).json({ success: false, error: 'flyer_suppressed' });
    }
    if (flyer.status === 'archived' || flyer.status === 'expired') {
      return res.status(400).json({ success: false, error: 'flyer_inactive', message: 'Only live or scheduled flyers can be published to GBP' });
    }

    const caps = await flyerState(tenantId);
    if (!caps?.can_use_gbp_publish) {
      return res.status(403).json({ success: false, error: 'tier_restricted', feature_key: 'flyer_gbp_publish' });
    }
    const entitled = await permissionServiceFactory.hasFeature(tenantId, 'gbp_posts_scheduler');
    if (!entitled) {
      return res.status(403).json({ success: false, error: 'scheduling_not_entitled', message: 'GBP post scheduling requires the GBP Posts Scheduler capability' });
    }

    // Dedupe: one active GBP post per flyer window (re-publish after edit is
    // allowed only when the prior post FAILED or the window moved)
    const existingPost = await prisma.gbp_posts.findFirst({
      where: {
        tenant_id: tenantId,
        event_title: flyer.title,
        event_start_date: flyer.starts_at,
        status: { in: ['SCHEDULED', 'PUBLISHED'] },
      },
      select: { id: true, status: true },
    });
    if (existingPost) {
      return res.status(409).json({ success: false, error: 'already_published', data: { post: existingPost } });
    }

    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } });
    const shareUrl = tenant?.slug ? `${WEB_BASE_URL}/flyer/${tenant.slug}` : `${WEB_BASE_URL}/flyer/${flyer.share_code}`;

    const summary = [
      `${flyer.title} — specials at ${tenant?.name ?? 'our store'}`,
      flyer.summary ?? null,
      `Now through ${flyer.ends_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
    ].filter(Boolean).join('\n\n').slice(0, 1500);

    const post = await prisma.gbp_posts.create({
      data: {
        id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tenant_id: tenantId,
        summary,
        topic_type: 'EVENT',
        call_to_action_type: 'ORDER',
        call_to_action_url: shareUrl,
        media_url: flyer.hero_image_url,
        event_title: flyer.title,
        event_start_date: flyer.starts_at,
        event_end_date: flyer.ends_at,
        status: 'SCHEDULED',
        // Flyer already live → post goes out on the next scheduler pass;
        // scheduled flyer → post lands when the window opens
        scheduled_for: flyer.starts_at <= new Date() ? new Date() : flyer.starts_at,
      },
    });

    res.status(201).json({ success: true, data: { post, shareUrl } });
  } catch (error) {
    logErr('POST /:tenantId/flyers/:flyerId/publish-gbp', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── GET /:tenantId/flyers/card-art — print-ready double-sided card PDF ──
router.get('/:tenantId/flyers/card-art', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const art = await generateFlyerCardPdf(tenantId);
    if (!art) return res.status(404).json({ success: false, error: 'not_found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${art.filename}"`);
    res.send(art.pdfBuffer);
  } catch (error) {
    logErr('GET /:tenantId/flyers/card-art', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

const cardOrderSchema = z.object({
  packSize: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  packCount: z.number().int().min(1).max(20).default(1),
  shippingAddress: z.object({
    name: z.string().min(1).max(200),
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).nullish(),
    city: z.string().min(1).max(100),
    state: z.string().max(100).nullish(),
    zip: z.string().min(1).max(20),
    country: z.string().max(2).default('US'),
  }),
});

// ── GET /:tenantId/flyers/card-orders — order history ──
router.get('/:tenantId/flyers/card-orders', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const orders = await prisma.tenant_flyer_card_orders.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: { orders } });
  } catch (error) {
    logErr('GET /:tenantId/flyers/card-orders', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── POST /:tenantId/flyers/card-orders — reorder a card pack ──
// Platform takes the order, renders art, delegates print+ship to the vendor
// (spec §10 — no inventory, no shipping).
router.post('/:tenantId/flyers/card-orders', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parsed = cardOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const flyer = await flyerState(tenantId);
    if (!flyer?.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled' });
    }
    if (unitCostForPackSize(parsed.data.packSize) == null) {
      return res.status(400).json({ success: false, error: 'invalid_pack_size' });
    }

    const art = await generateFlyerCardPdf(tenantId);
    if (!art) return res.status(404).json({ success: false, error: 'not_found' });

    const orderId = generateFlyerCardOrderId(tenantId);
    const submission = await submitCardOrder({
      orderId,
      packSize: parsed.data.packSize,
      packCount: parsed.data.packCount,
      artPdfBase64: art.pdfBuffer.toString('base64'),
      artFilename: art.filename,
      shippingAddress: parsed.data.shippingAddress,
    });

    const order = await prisma.tenant_flyer_card_orders.create({
      data: {
        id: orderId,
        tenant_id: tenantId,
        pack_size: parsed.data.packSize,
        pack_count: parsed.data.packCount,
        vendor: submission.vendor,
        vendor_order_id: submission.vendorOrderId,
        status: 'submitted',
        shipping_address: parsed.data.shippingAddress as any,
        unit_cost_cents: submission.unitCostCents,
        total_cost_cents: submission.totalCostCents,
      },
    });

    res.status(201).json({ success: true, data: { order } });
  } catch (error) {
    logErr('POST /:tenantId/flyers/card-orders', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── POST /:tenantId/flyers/extract — agent-drafted flyer (spec §7a.1) ──
// Returns a structured DRAFT only — never persists. The composer opens it
// prefilled; draft-then-confirm is mandatory.
const extractSchema = z.object({
  brief: z.string().min(3).max(4000),
});

router.post('/:tenantId/flyers/extract', authenticateToken, checkTenantAccess, requireInventoryAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const flyer = await flyerState(tenantId);
    if (!flyer?.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled' });
    }

    const draft = await extractFlyerDraft(tenantId, parsed.data.brief);
    res.json({ success: true, data: { draft } });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === 'extraction_invalid_json' || msg === 'extraction_invalid_shape') {
      return res.status(422).json({ success: false, error: msg, message: 'Could not extract a draft from that brief — try rephrasing with item names and prices' });
    }
    logErr('POST /:tenantId/flyers/extract', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// ── GET /:tenantId/flyers/analytics — per-flyer engagement + attribution ──
// Event-level series from tenant_flyer_events (spec §5: counters are not
// analytics) plus order attribution via order_items.metadata.flyer_id.
// Reported as engagement, never demand (spec §10).
router.get('/:tenantId/flyers/analytics', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days)) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const flyers = await prisma.tenant_flyers.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true, title: true, status: true, share_code: true,
        starts_at: true, ends_at: true, impressions: true, clicks: true,
      },
    });

    const [dailyRows, srcRows, orderRows] = await Promise.all([
      prisma.$queryRaw<Array<{ flyer_id: string; day: string; event_type: string; n: bigint }>>`
        SELECT flyer_id, created_at::date AS day, event_type, COUNT(*) AS n
        FROM tenant_flyer_events
        WHERE tenant_id = ${tenantId} AND created_at >= ${since}
        GROUP BY flyer_id, created_at::date, event_type
        ORDER BY day ASC
      `,
      prisma.$queryRaw<Array<{ flyer_id: string; src: string | null; event_type: string; n: bigint }>>`
        SELECT flyer_id, src, event_type, COUNT(*) AS n
        FROM tenant_flyer_events
        WHERE tenant_id = ${tenantId} AND created_at >= ${since}
        GROUP BY flyer_id, src, event_type
      `,
      prisma.$queryRaw<Array<{ flyer_id: string; orders: bigint; revenue_cents: bigint }>>`
        SELECT oi.metadata->>'flyer_id' AS flyer_id,
               COUNT(DISTINCT o.id) AS orders,
               COALESCE(SUM(oi.total_cents), 0) AS revenue_cents
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = ${tenantId}
          AND oi.metadata->>'flyer_id' IS NOT NULL
          AND o.order_status NOT IN ('draft', 'cancelled')
        GROUP BY 1
      `,
    ]);

    const byFlyer = new Map<string, {
      daily: Record<string, { impressions: number; clicks: number; add_to_cart: number }>;
      bySrc: Record<string, number>;
      orders: number;
      revenueCents: number;
    }>();
    const bucket = (id: string) => {
      if (!byFlyer.has(id)) byFlyer.set(id, { daily: {}, bySrc: {}, orders: 0, revenueCents: 0 });
      return byFlyer.get(id)!;
    };

    for (const r of dailyRows) {
      const b = bucket(r.flyer_id);
      const day = String(r.day).slice(0, 10);
      if (!b.daily[day]) b.daily[day] = { impressions: 0, clicks: 0, add_to_cart: 0 };
      const n = Number(r.n);
      if (r.event_type === 'impression') b.daily[day].impressions = n;
      else if (r.event_type === 'click') b.daily[day].clicks = n;
      else if (r.event_type === 'add_to_cart') b.daily[day].add_to_cart = n;
    }
    for (const r of srcRows) {
      const b = bucket(r.flyer_id);
      const key = r.src ?? 'direct';
      b.bySrc[key] = (b.bySrc[key] ?? 0) + Number(r.n);
    }
    for (const r of orderRows) {
      if (!r.flyer_id) continue;
      const b = bucket(r.flyer_id);
      b.orders = Number(r.orders);
      b.revenueCents = Number(r.revenue_cents);
    }

    res.json({
      success: true,
      data: {
        windowDays: days,
        flyers: flyers.map((f) => {
          const b = byFlyer.get(f.id) ?? { daily: {}, bySrc: {}, orders: 0, revenueCents: 0 };
          return {
            id: f.id,
            title: f.title,
            status: f.status,
            shareCode: f.share_code,
            window: { startsAt: f.starts_at, endsAt: f.ends_at },
            totals: { impressions: f.impressions, clicks: f.clicks },
            orders: b.orders,
            revenueCents: b.revenueCents,
            bySrc: b.bySrc,
            daily: Object.entries(b.daily).map(([date, v]) => ({ date, ...v })),
          };
        }),
      },
    });
  } catch (error) {
    logErr('GET /:tenantId/flyers/analytics', error, req.params.tenantId);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
