/**
 * Directory Admin Routes
 * Platform admin directory management
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { z } from 'zod';
import { generateDirectoryFeaturedId, generateProductCatId } from '../lib/id-generator';

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

    if (category) {
      where.OR = [
        { primary_category: category },
        { secondary_categories: { has: category } },
      ];
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

    // Add quality scores (basic calculation)
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const profile = await prisma.tenant_business_profiles_list.findUnique({
          where: { tenant_id: listing.tenant_id },
        });

        const itemCount = await prisma.inventory_items.count({
          where: { tenant_id: listing.tenant_id, item_status: 'active' },
        });

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
          business_name: profile?.business_name || listing.tenants?.name || 'Unknown Business',
        };
      })
    );

    return res.json({
      listings: enrichedListings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('[GET /admin/directory/listings] Error:', error);
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
    console.error('[GET /admin/directory/stats] Error:', error);
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
    console.error('[GET /admin/directory/featured] Error:', error);
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
    console.error('[POST /admin/directory/feature/:tenantId] Error:', error);
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
    console.error('[DELETE /admin/directory/unfeature/:tenantId] Error:', error);
    return res.status(500).json({ error: 'failed_to_unfeature_listing' });
  }
});

export default router;
