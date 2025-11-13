/**
 * Directory Tenant Routes
 * Tenant-facing directory listing management
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const updateListingSchema = z.object({
  seo_description: z.string().max(500).optional(),
  seo_keywords: z.array(z.string()).max(10).optional(),
  primary_category: z.string().optional(),
  secondary_categories: z.array(z.string()).max(5).optional(),
});

/**
 * GET /api/tenants/:id/directory/listing
 * Get directory listing for a tenant
 */
router.get('/:id/directory/listing', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    // Get or create directory settings
    let settings = await prisma.directorySettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      // Auto-create settings from business profile
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { businessProfile: true },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'tenant_not_found' });
      }

      // Generate slug from business name
      const businessName = tenant.businessProfile?.businessName || tenant.name;
      const baseSlug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Ensure unique slug
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.directorySettings.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      settings = await prisma.directorySettings.create({
        data: {
          tenantId,
          slug,
          isPublished: false,
        },
      });
    }

    // Check if currently featured
    const activeFeatured = await prisma.directoryFeaturedListings.findFirst({
      where: {
        tenantId,
        featuredUntil: { gt: new Date() },
      },
      orderBy: { featuredFrom: 'desc' },
    });

    // Get business profile for preview
    const businessProfile = await prisma.tenantBusinessProfile.findUnique({
      where: { tenantId },
    });

    return res.json({
      ...settings,
      isFeatured: !!activeFeatured,
      featuredUntil: activeFeatured?.featuredUntil,
      businessProfile,
    });
  } catch (error: any) {
    console.error('[GET /tenants/:id/directory/listing] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_listing' });
  }
});

/**
 * PATCH /api/tenants/:id/directory/listing
 * Update directory listing settings
 */
router.patch('/:id/directory/listing', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  console.log('[PATCH /tenants/:id/directory/listing] ===== REQUEST RECEIVED =====');
  console.log('[PATCH /tenants/:id/directory/listing] Tenant ID:', req.params.id);
  console.log('[PATCH /tenants/:id/directory/listing] User:', req.user?.userId);
  console.log('[PATCH /tenants/:id/directory/listing] Body:', JSON.stringify(req.body, null, 2));
  console.log('[PATCH /tenants/:id/directory/listing] Headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'PRESENT' : 'MISSING',
    'x-csrf-token': req.headers['x-csrf-token'] ? 'PRESENT' : 'MISSING',
    'x-tenant-id': req.headers['x-tenant-id']
  });
  try {
    const { id: tenantId } = req.params;
    const parsed = updateListingSchema.safeParse(req.body);

    if (!parsed.success) {
      console.error('[PATCH /tenants/:id/directory/listing] Validation failed:', parsed.error.flatten());
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    console.log('[PATCH /tenants/:id/directory/listing] Validation passed. Parsed data:', JSON.stringify(parsed.data, null, 2));
    console.log('[PATCH /tenants/:id/directory/listing] About to upsert...');

    const updated = await prisma.directorySettings.upsert({
      where: { tenantId },
      update: {
        seoDescription: parsed.data.seo_description,
        seoKeywords: parsed.data.seo_keywords,
        primaryCategory: parsed.data.primary_category,
        secondaryCategories: parsed.data.secondary_categories,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        seoDescription: parsed.data.seo_description,
        seoKeywords: parsed.data.seo_keywords,
        primaryCategory: parsed.data.primary_category,
        secondaryCategories: parsed.data.secondary_categories,
      },
    });

    console.log('[PATCH /tenants/:id/directory/listing] Upsert completed successfully. Updated record:', JSON.stringify(updated, null, 2));
    return res.json(updated);
  } catch (error: any) {
    console.error('[PATCH /tenants/:id/directory/listing] ===== ERROR =====');
    console.error('[PATCH /tenants/:id/directory/listing] Error details:', error);
    console.error('[PATCH /tenants/:id/directory/listing] Error message:', error.message);
    console.error('[PATCH /tenants/:id/directory/listing] Error stack:', error.stack);
    return res.status(500).json({ error: 'failed_to_update_listing' });
  }
});

/**
 * POST /api/tenants/:id/directory/publish
 * Publish listing to directory
 */
router.post('/:id/directory/publish', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    // Check tier access (google_only doesn't get directory)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    if (tenant.subscriptionTier === 'google_only') {
      return res.status(403).json({ error: 'directory_not_available_for_tier' });
    }

    // Verify business profile is complete enough
    const profile = await prisma.tenantBusinessProfile.findUnique({ where: { tenantId } });
    if (!profile || !profile.businessName || !profile.city || !profile.state) {
      return res.status(400).json({ 
        error: 'incomplete_profile',
        message: 'Business name, city, and state are required to publish to directory'
      });
    }

    const updated = await prisma.directorySettings.upsert({
      where: { tenantId },
      update: { isPublished: true, updatedAt: new Date() },
      create: { tenantId, isPublished: true },
    });

    return res.json({ success: true, listing: updated });
  } catch (error: any) {
    console.error('[POST /tenants/:id/directory/publish] Error:', error);
    return res.status(500).json({ error: 'failed_to_publish' });
  }
});

/**
 * POST /api/tenants/:id/directory/unpublish
 * Remove listing from directory
 */
router.post('/:id/directory/unpublish', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    const updated = await prisma.directorySettings.update({
      where: { tenantId },
      data: { isPublished: false, updatedAt: new Date() },
    });

    return res.json({ success: true, listing: updated });
  } catch (error: any) {
    console.error('[POST /tenants/:id/directory/unpublish] Error:', error);
    return res.status(500).json({ error: 'failed_to_unpublish' });
  }
});

export default router;
