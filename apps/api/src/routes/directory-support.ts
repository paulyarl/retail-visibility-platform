/**
 * Directory Support Routes
 * Platform support directory tools (read-only + notes)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Middleware to check support access
const requireSupportAccess = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user || !['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'].includes(user.role)) {
    return res.status(403).json({ error: 'support_access_required' });
  }
  next();
};

// Validation schemas
const addNoteSchema = z.object({
  note: z.string().min(1).max(1000),
});

/**
 * GET /api/support/directory/tenant/:tenantId/status
 * Get directory status for a tenant
 */
router.get('/tenant/:tenantId/status', authenticateToken, requireSupportAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Get tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Get directory settings
    const settings = await prisma.directorySettings.findUnique({
      where: { tenantId },
    });

    // Get business profile
    const profile = await prisma.tenantBusinessProfile.findUnique({
      where: { tenantId },
    });

    // Get item count
    const itemCount = await prisma.inventoryItem.count({
      where: { tenantId, itemStatus: 'active' },
    });

    // Check if featured
    const activeFeatured = await prisma.directoryFeaturedListings.findFirst({
      where: {
        tenantId,
        featuredUntil: { gt: new Date() },
      },
    });

    return res.json({
      tenant,
      settings: settings || { isPublished: false },
      profile,
      itemCount,
      isFeatured: !!activeFeatured,
      featuredUntil: activeFeatured?.featuredUntil,
    });
  } catch (error: any) {
    console.error('[GET /support/directory/tenant/:tenantId/status] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_status' });
  }
});

/**
 * GET /api/support/directory/tenant/:tenantId/quality-check
 * Run quality check on a tenant's listing
 */
router.get('/tenant/:tenantId/quality-check', authenticateToken, requireSupportAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    const profile = await prisma.tenantBusinessProfile.findUnique({ where: { tenantId } });
    const settings = await prisma.directorySettings.findUnique({ where: { tenantId } });
    const itemCount = await prisma.inventoryItem.count({
      where: { tenantId, itemStatus: 'active' },
    });

    // Calculate completeness
    const checks = {
      business_name: !!profile?.businessName,
      address: !!profile?.businessLine1,
      cityState: !!(profile?.city && profile?.state),
      phone: !!profile?.phoneNumber,
      email: !!profile?.email,
      website: !!profile?.website,
      logo: !!profile?.logoUrl,
      hours: !!profile?.hours,
      description: !!(settings?.seoDescription && settings.seoDescription.length > 100),
      category: !!settings?.primaryCategory,
      hasItems: itemCount > 0,
      hasMultipleItems: itemCount > 10,
    };

    const completedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const completenessPercent = Math.round((completedChecks / totalChecks) * 100);

    // Generate recommendations
    const recommendations: string[] = [];
    if (!checks.business_name) recommendations.push('Add business name');
    if (!checks.address) recommendations.push('Add street address');
    if (!checks.cityState) recommendations.push('Add city and state');
    if (!checks.phone) recommendations.push('Add phone number for better local SEO');
    if (!checks.email) recommendations.push('Add email address');
    if (!checks.website) recommendations.push('Add website URL');
    if (!checks.logo) recommendations.push('Upload business logo');
    if (!checks.hours) recommendations.push('Add business hours');
    if (!checks.description) recommendations.push('Add detailed description (150+ words)');
    if (!checks.category) recommendations.push('Select primary category');
    if (!checks.hasItems) recommendations.push('Add products to showcase');
    if (!checks.hasMultipleItems) recommendations.push('Add more products (10+ recommended)');

    return res.json({
      completenessPercent,
      checks,
      recommendations,
      itemCount,
      canPublish: checks.business_name && checks.cityState && checks.category,
    });
  } catch (error: any) {
    console.error('[GET /support/directory/tenant/:tenantId/quality-check] Error:', error);
    return res.status(500).json({ error: 'failed_to_check_quality' });
  }
});

/**
 * GET /api/support/directory/tenant/:tenantId/notes
 * Get support notes for a tenant
 */
router.get('/tenant/:tenantId/notes', authenticateToken, requireSupportAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const notes = await prisma.directorySupportNotes.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ notes });
  } catch (error: any) {
    console.error('[GET /support/directory/tenant/:tenantId/notes] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_notes' });
  }
});

/**
 * POST /api/support/directory/tenant/:tenantId/add-note
 * Add a support note
 */
router.post('/tenant/:tenantId/add-note', authenticateToken, requireSupportAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parsed = addNoteSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const user = (req as any).user;
    const note = await prisma.directorySupportNotes.create({
      data: {
        tenantId,
        note: parsed.data.note,
        createdBy: user.userId,
      } as any,
    });

    return res.json({ success: true, note });
  } catch (error: any) {
    console.error('[POST /support/directory/tenant/:tenantId/add-note] Error:', error);
    return res.status(500).json({ error: 'failed_to_add_note' });
  }
});

/**
 * GET /api/support/directory/search
 * Search for tenants by name or ID
 */
router.get('/search', authenticateToken, requireSupportAccess, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ error: 'search_query_required' });
    }

    const searchTerm = q.toLowerCase();

    // Search tenants by name or ID
    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { id: { contains: searchTerm, mode: 'insensitive' } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        directorySettings: {
          select: {
            isPublished: true,
            isFeatured: true,
          },
        },
        tenantBusinessProfile: {
          select: {
            businessName: true,
            city: true,
            state: true,
          },
        },
      },
    });

    return res.json({ tenants });
  } catch (error: any) {
    console.error('[GET /support/directory/search] Error:', error);
    return res.status(500).json({ error: 'failed_to_search' });
  }
});

export default router;
