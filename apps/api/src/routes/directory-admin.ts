/**
 * Directory Admin Routes
 * Platform admin directory management
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { z } from 'zod';
import { generateDirectoryFeaturedId, generateProductCatId } from '../lib/id-generator';
import { HttpError } from '../middleware/errorHandler';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';
import CategoryMarketEnrichmentService from '../services/CategoryMarketEnrichmentService';
import { logger } from '../logger';

const router = Router();

// Validation schemas
const featureListingSchema = z.object({
  featured_until: z.string().datetime(),
  placement_priority: z.number().int().min(1).max(10).optional(),
});

/**
 * GET /api/admin/directory/listings
 * Get all directory listings with filters
 */
router.get('/listings', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      status, // published, draft, featured
      tier,
      quality,
      category,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (status === 'published') {
      where.is_published = true;
    } else if (status === 'draft') {
      where.is_published = false;
    } else if (status === 'featured') {
      where.is_featured = true;
    }

    if (tier) {
      where.tenants = {
        subscription_tier: tier,
      };
    }

    if (search) {
      where.OR = [
        { tenants: { name: { contains: search, mode: 'insensitive' } } },
        { primary_category: { contains: search, mode: 'insensitive' } },
        { secondary_categories: { has: search } },
      ];
    }

    if (category) {
      if (!where.OR) where.OR = [];
      where.OR.push(
        { primary_category: category },
        { secondary_categories: { has: category } },
      );
    }

    // Get listings
    const [listings, total] = await Promise.all([
      prisma.directory_settings_list.findMany({
        where,
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
            },
          },
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.directory_settings_list.count({ where }),
    ]);

    // Batch enrich listings with profile, inventory counts, seed category,
    // and any marketing campaigns tied to this tenant.
    const tenantIds = listings.map((l) => l.tenant_id);

    const [profiles, itemCounts, seeds, businessCampaigns, seedLinks, latestEnrichmentRows] = await Promise.all([
      prisma.tenant_business_profiles_list.findMany({
        where: { tenant_id: { in: tenantIds } },
        select: {
          tenant_id: true,
          business_name: true,
          address_line1: true,
          city: true,
          state: true,
          phone_number: true,
          email: true,
          website: true,
          logo_url: true,
          hours: true,
        },
      }),
      prisma.inventory_items.groupBy({
        by: ['tenant_id'],
        where: { tenant_id: { in: tenantIds }, item_status: 'active' },
        _count: true,
      }),
      prisma.directory_presence_seeds.findMany({
        where: { tenant_id: { in: tenantIds } },
        select: { tenant_id: true, category: true, status: true },
      }),
      prisma.mkt_campaigns_list.findMany({
        where: { tenant_id: { in: tenantIds }, scope: 'business' },
        select: {
          id: true,
          tenant_id: true,
          business_name: true,
          category: true,
          city: true,
          state: true,
          stage: true,
          display_id: true,
        },
      }),
      prisma.directory_seed_campaign_links.findMany({
        where: { tenant_id: { in: tenantIds } },
        include: {
          mkt_campaigns_list: {
            select: {
              id: true,
              tenant_id: true,
              business_name: true,
              category: true,
              city: true,
              state: true,
              stage: true,
              display_id: true,
            },
          },
        },
      }),
      tenantIds.length
        ? (prisma.$queryRaw`
            SELECT DISTINCT ON (tenant_id) *
            FROM directory_listing_enrichment_log
            WHERE tenant_id IN (${Prisma.join(tenantIds)})
            ORDER BY tenant_id, enriched_at DESC
          ` as Promise<any[]>)
        : Promise.resolve([] as any[]),
    ]);

    const profileByTenant = new Map(profiles.map((p) => [p.tenant_id, p]));
    const itemCountByTenant = new Map(itemCounts.map((g) => [g.tenant_id, g._count]));
    const seedByTenant = new Map(seeds.map((s) => [s.tenant_id, s]));
    const latestEnrichmentByTenant = new Map(
      latestEnrichmentRows.map((row: any) => [row.tenant_id, row]),
    );

    const campaignsByTenant = new Map<string, any[]>();
    const addCampaign = (tenantId: string, campaign: any) => {
      if (!tenantId || !campaign) return;
      const list = campaignsByTenant.get(tenantId) || [];
      if (!list.find((c) => c.id === campaign.id)) {
        list.push(campaign);
        campaignsByTenant.set(tenantId, list);
      }
    };
    businessCampaigns.forEach((c) => addCampaign(c.tenant_id || '', c));
    seedLinks.forEach((l) => addCampaign(l.tenant_id || '', l.mkt_campaigns_list));

    const campaignSummary = (c: any) => ({
      id: c.id,
      displayId: c.display_id ?? null,
      businessName: c.business_name ?? null,
      category: c.category,
      city: c.city,
      state: c.state ?? null,
      stage: c.stage,
    });

    const enrichedListings = listings.map((listing) => {
      const profile = profileByTenant.get(listing.tenant_id);
      const itemCount = itemCountByTenant.get(listing.tenant_id) || 0;
      const seed = seedByTenant.get(listing.tenant_id);
      const campaigns = (campaignsByTenant.get(listing.tenant_id) || []).map(campaignSummary);
      const latestEnrichment = latestEnrichmentByTenant.get(listing.tenant_id);

      // Calculate quality score
      let qualityScore = 0;
      if (profile) {
        if (profile.business_name) qualityScore += 15;
        if (profile.address_line1) qualityScore += 10;
        if (profile.city && profile.state) qualityScore += 10;
        if (profile.phone_number) qualityScore += 10;
        if (profile.email) qualityScore += 5;
        if (profile.website) qualityScore += 10;
        if (profile.logo_url) qualityScore += 10;
        if (profile.hours) qualityScore += 10;
      }
      if (listing.seo_description && listing.seo_description.length > 100) qualityScore += 10;
      if (listing.primary_category) qualityScore += 5;
      if (itemCount > 0) qualityScore += 10;
      if (itemCount > 10) qualityScore += 5;

      return {
        ...listing,
        qualityScore,
        itemCount,
        businessName: profile?.business_name || listing.tenants?.name || 'Unknown Business',
        seedCategory: seed?.category ?? null,
        seedStatus: seed?.status ?? null,
        campaigns,
        lastEnrichmentEvent: latestEnrichment
          ? {
              triggerSource: latestEnrichment.trigger_source,
              enrichedAt: latestEnrichment.enriched_at,
              intelligenceProfileId: latestEnrichment.intelligence_profile_id ?? null,
              fieldsProjected: latestEnrichment.fields_projected ?? [],
            }
          : null,
        tenant: listing.tenants ? {
          id: listing.tenants.id,
          name: listing.tenants.name,
          subscriptionTier: listing.tenants.subscription_tier,
        } : null,
      };
    });

    // Apply quality filter if specified
    let filteredListings = enrichedListings;
    if (quality) {
      if (quality === 'low') {
        filteredListings = enrichedListings.filter(listing => listing.qualityScore <= 50);
      } else if (quality === 'medium') {
        filteredListings = enrichedListings.filter(listing => listing.qualityScore > 50 && listing.qualityScore <= 100);
      } else if (quality === 'high') {
        filteredListings = enrichedListings.filter(listing => listing.qualityScore > 100);
      }
    }

    return res.json({
      listings: filteredListings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: quality ? filteredListings.length : total,
        totalPages: Math.ceil((quality ? filteredListings.length : total) / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('[GET /admin/directory/listings] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_listings' });
  }
});

/**
 * GET /api/admin/directory/stats
 * Get directory overview statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [
      totalListings,
      publishedListings,
      featuredListings,
      draftListings,
    ] = await Promise.all([
      prisma.directory_settings_list.count(),
      prisma.directory_settings_list.count({ where: { is_published: true } }),
      prisma.directory_settings_list.count({ where: { is_featured: true } }),
      prisma.directory_settings_list.count({ where: { is_published: false } }),
    ]);

    // Get listings by tier
    const listingsByTier = await prisma.directory_settings_list.groupBy({
      by: ['tenant_id'],
      _count: true,
    });

    // Get tenant tiers
    const tenantIds = listingsByTier.map(l => l.tenant_id);
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, subscription_tier: true },
    });

    const tierCounts: Record<string, number> = {};
    tenants.forEach(t => {
      const tier = t.subscription_tier || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    return res.json({
      total: totalListings,
      published: publishedListings,
      featured: featuredListings,
      draft: draftListings,
      byTier: tierCounts,
    });
  } catch (error: any) {
    logger.error('[GET /admin/directory/stats] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_stats' });
  }
});

/**
 * GET /api/admin/directory/featured
 * Get all featured listings
 */
router.get('/featured', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const featured = await prisma.directory_featured_listings_list.findMany({
      where: {
        featured_until: { gt: new Date() },
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
          },
        },
      },
      orderBy: [
        { placement_priority: 'desc' },
        { featured_from: 'desc' },
      ],
    });

    return res.json({ featured });
  } catch (error: any) {
    logger.error('[GET /admin/directory/featured] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_featured' });
  }
});

/**
 * POST /api/admin/directory/feature/:tenantId
 * Feature a listing
 */
router.post('/feature/:tenantId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parsed = featureListingSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const featuredUntil = new Date(parsed.data.featured_until);
    if (featuredUntil <= new Date()) {
      return res.status(400).json({ error: 'featured_until_must_be_future' });
    }

    // Create featured listing record
    const featured = await prisma.directory_featured_listings_list.create({
      data: {
        id: generateDirectoryFeaturedId(tenantId),
        tenant_id: tenantId,
        featured_from: new Date(),
        featured_until: featuredUntil,
        placement_priority: parsed.data.placement_priority || 5,
        created_by: (req as any).user?.userId,
      },
    });

    // Update directory settings
    await prisma.directory_settings_list.update({
      where: { tenant_id: tenantId },
      data: {
        is_featured: true,
        featured_until: featuredUntil,
        updated_at: new Date(),
      },
    });

    return res.json({ success: true, featured });
  } catch (error: any) {
    logger.error('[POST /admin/directory/feature/:tenantId] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_feature_listing' });
  }
});

/**
 * DELETE /api/admin/directory/unfeature/:tenantId
 * Remove featured status
 */
router.delete('/unfeature/:tenantId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Update directory settings
    await prisma.directory_settings_list.update({
      where: { tenant_id: tenantId },
      data: {
        is_featured: false,
        featured_until: null,
        updated_at: new Date(),
      },
    });

    // Expire any active featured listings
    await prisma.directory_featured_listings_list.updateMany({
      where: {
        tenant_id: tenantId,
        featured_until: { gt: new Date() },
      },
      data: {
        featured_until: new Date(), // Set to now to expire
      },
    });

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[DELETE /admin/directory/unfeature/:tenantId] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_unfeature_listing' });
  }
});

/**
 * POST /api/admin/directory/listings/:tenantId/spawn-campaign
 * Spawn a business-scope marketing campaign from a tenant's directory listing
 * NAP. Lets an operator pull any directory-listed business into the marketing
 * architecture (audit prompts, enrichment, SEO composition, recovery playbooks)
 * without needing a directory_presence_seeds row.
 */
const spawnTenantCampaignSchema = z.object({
  category: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

router.post('/listings/:tenantId/spawn-campaign', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const validation = spawnTenantCampaignSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', details: validation.error.issues });
    }

    const result = await DirectoryPresenceSeedService.createCampaignFromTenantListing(
      tenantId,
      {
        category: validation.data.category,
        notes: validation.data.notes,
      },
      {
        actorType: 'user',
        actorId: (req as any).user?.userId || (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    );

    res.status(201).json({ success: true, campaign: result.campaign });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }
    const statusMap: Record<string, number> = {
      listing_not_found: 404,
      incomplete_nap: 400,
    };
    const status = statusMap[error?.message] || 500;
    if (status === 500) {
      logger.error('[POST /admin/directory/listings/:tenantId/spawn-campaign] Error:', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
      });
    }
    res.status(status).json({ error: error?.message || 'internal_error' });
  }
});

/**
 * POST /api/admin/directory/listings/:tenantId/re-enrich
 * Re-run market enrichment for the category/city/state of a published listing.
 */
router.post('/listings/:tenantId/re-enrich', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const listing = await prisma.directory_listings_list.findFirst({
      where: { tenant_id: tenantId, is_published: true },
    });
    if (!listing) {
      return res.status(404).json({ error: 'listing_not_found' });
    }
    if (!listing.primary_category || !listing.city || !listing.state) {
      return res.status(400).json({ error: 'incomplete_listing_for_enrichment' });
    }

    const ctx: any = {
      region: 'us-east-1',
      userId: (req as any).user?.userId || (req as any).user?.id,
      ip: req.ip || undefined,
      userAgent: req.get('User-Agent') || undefined,
    };

    const result = await CategoryMarketEnrichmentService.getInstance().enrichMarket(
      listing.primary_category,
      listing.city,
      listing.state,
      {
        triggerSource: 'manual',
        enrichedBy: (req as any).user?.userId || (req as any).user?.id,
      },
      ctx,
    );

    return res.json({ success: true, result });
  } catch (error: any) {
    logger.error('[POST /admin/directory/listings/:tenantId/re-enrich] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack },
    });
    return res.status(500).json({ error: 'failed_to_re_enrich' });
  }
});

export default router;
