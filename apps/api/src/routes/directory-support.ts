/**
 * Directory Support Routes
 * Platform support directory tools (read-only + notes)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { generateDirectorySupportNoteId } from '../lib/id-generator';
import { logger } from '../logger';

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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Get directory settings
    const settings = await prisma.directory_settings_list.findUnique({
      where: { tenant_id: tenantId },
    });

    // Get business profile
    const profile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: tenantId },
    });

    // Get item count
    const itemCount = await prisma.inventory_items.count({
      where: { tenant_id: tenantId, item_status: 'active' },
    });

    // Check if featured
    const activeFeatured = await prisma.directory_featured_listings_list.findFirst({
      where: {
        tenant_id: tenantId,
        featured_until: { gt: new Date() },
      },
    });

    return res.json({
      tenant,
      settings: settings || { isPublished: false },
      profile,
      itemCount,
      isFeatured: !!activeFeatured,
      featuredUntil: activeFeatured?.featured_until,
    });
  } catch (error: any) {
    logger.error('[GET /support/directory/tenant/:tenantId/status] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    const profile = await prisma.tenant_business_profiles_list.findUnique({ where: { tenant_id: tenantId } });
    const settings = await prisma.directory_settings_list.findUnique({ where: { tenant_id: tenantId } });
    const itemCount = await prisma.inventory_items.count({
      where: { tenant_id: tenantId, item_status: 'active' },
    });

    // Calculate completeness
    const checks = {
      business_name: !!profile?.business_name,
      address: !!profile?.address_line1,
      cityState: !!(profile?.city && profile?.state),
      phone: !!profile?.phone_number,
      email: !!profile?.email,
      website: !!profile?.website,
      logo: !!profile?.logo_url,
      hours: !!profile?.hours,
      description: !!(settings?.seo_description && settings.seo_description.length > 100),
      category: !!settings?.primary_category,
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
    logger.error('[GET /support/directory/tenant/:tenantId/quality-check] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    const notes = await prisma.directory_support_notes_list.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });

    const userIds = [...new Set(notes.map((n: any) => n.created_by).filter(Boolean))];
    const users = userIds.length > 0
      ? await prisma.users.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, first_name: true, last_name: true },
        })
      : [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    const mapped = notes.map((n: any) => {
      const u = userMap.get(n.created_by);
      return {
        ...n,
        createdByUser: u
          ? {
              id: u.id,
              email: u.email,
              firstName: u.first_name,
              lastName: u.last_name,
            }
          : null,
      };
    });

    return res.json({ notes: mapped });
  } catch (error: any) {
    logger.error('[GET /support/directory/tenant/:tenantId/notes] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_notes' });
  }
});

/**
 * POST /api/support/directory/tenant/:tenantId/notes
 * Add a support note
 */
router.post('/tenant/:tenantId/notes', authenticateToken, requireSupportAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const parsed = addNoteSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const user = (req as any).user;
    const noteId = generateDirectorySupportNoteId(tenantId);
    const note = await prisma.directory_support_notes_list.create({
      data: {
        id: noteId,
        tenant_id: tenantId,
        note: parsed.data.note,
        created_by: user.user_id,
      } as any,
    });

    return res.json({ success: true, note });
  } catch (error: any) {
    logger.error('[POST /support/directory/tenant/:tenantId/add-note] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    const tenants = await prisma.tenants.findMany({
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
        subscription_tier: true,
        subscription_status: true,
        directory_settings_list: {
          select: {
            is_published: true,
            is_featured: true,
          },
        },
        tenant_business_profiles_list: {
          select: {
            business_name: true,
            city: true,
            state: true,
          },
        },
      },
    });

    return res.json({ tenants });
  } catch (error: any) {
    logger.error('[GET /support/directory/search] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_search' });
  }
});

export default router;
