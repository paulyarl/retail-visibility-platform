/**
 * Directory Admin Routes
 * Platform admin directory management
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { z } from 'zod';

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
      where.isPublished = true;
    } else if (status === 'draft') {
      where.isPublished = false;
    } else if (status === 'featured') {
      where.isFeatured = true;
    }

    if (category) {
      where.OR = [
        { primaryCategory: category },
        { secondaryCategories: { has: category } },
      ];
    }

    // Get listings
    const [listings, total] = await Promise.all([
      prisma.directory_settings.findMany({
        where,
        include: {
          tenant: {
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
      prisma.directory_settings.count({ where }),
    ]);

    // Add quality scores (basic calculation)
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const profile = await prisma.tenant_business_profile.findUnique({
          where: { tenant_id: listing.tenant_id },
        });

        const itemCount = await prisma.inventory_item.count({
          where: { tenant_id: listing.tenant_id, item_status: 'active' },
        });

        // Calculate quality score
        let qualityScore = 0;
        if (profile) {
          if (profile.businessName) qualityScore += 15;
          if (profile.addressLine1) qualityScore += 10;
          if (profile.city && profile.state) qualityScore += 10;
          if (profile.phoneNumber) qualityScore += 10;
          if (profile.email) qualityScore += 5;
          if (profile.website) qualityScore += 10;
          if (profile.logoUrl) qualityScore += 10;
          if (profile.hours) qualityScore += 10;
        }
        if (listing.seoDescription && listing.seoDescription.length > 100) qualityScore += 10;
        if (listing.primaryCategory) qualityScore += 5;
        if (itemCount > 0) qualityScore += 10;
        if (itemCount > 10) qualityScore += 5;

        return {
          ...listing,
          qualityScore,
          itemCount,
          business_name: profile?.businessName || listing.tenant.name,
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
      prisma.directory_settings.count(),
      prisma.directory_settings.count({ where: { isPublished: true } }),
      prisma.directory_settings.count({ where: { isFeatured: true } }),
      prisma.directory_settings.count({ where: { isPublished: false } }),
    ]);

    // Get listings by tier
    const listingsByTier = await prisma.directory_settings.groupBy({
      by: ['tenantId'],
      _count: true,
    });

    // Get tenant tiers
    const tenantIds = listingsByTier.map(l => l.tenant_id);
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, subscription_tier: true },
    });

    const tierCounts: Record<string, number> = {};
    tenants.forEach(t => {
      const tier = t.subscriptionTier || 'unknown';
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
    const featured = await prisma.directory_featured_listings.findMany({
      where: {
        featuredUntil: { gt: new Date() },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
          },
        },
      },
      orderBy: [
        { placementPriority: 'desc' },
        { featuredFrom: 'desc' },
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
    const featured = await prisma.directory_featured_listings.create({
      data: {
        tenantId,
        featuredFrom: new Date(),
        featuredUntil,
        placementPriority: parsed.data.placement_priority || 5,
        created_by: (req as any).user?.user_id,
      },
    });

    // Update directory settings
    await prisma.directory_settings.update({
      where: { tenantId },
      data: {
        isFeatured: true,
        featuredUntil,
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
    await prisma.directory_settings.update({
      where: { tenantId },
      data: {
        isFeatured: false,
        featuredUntil: null,
        updated_at: new Date(),
      },
    });

    // Expire any active featured listings
    await prisma.directory_featured_listings.updateMany({
      where: {
        tenantId,
        featuredUntil: { gt: new Date() },
      },
      data: {
        featuredUntil: new Date(), // Set to now to expire
      },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /admin/directory/unfeature/:tenantId] Error:', error);
    return res.status(500).json({ error: 'failed_to_unfeature_listing' });
  }
});

export default router;
