import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { prisma } from '../../prisma';
import { z } from 'zod';

const router = Router();

/**
 * POST /api/admin/categories/propagate
 * Propagate selected Google taxonomy categories to tenant directory_category tables
 * 
 * Body: {
 *   categories: Array<{ category_id: string; name: string; full_path: string }>;
 *   scope: 'tenant' | 'organization' | 'platform';
 *   tenantId?: string;
 *   organizationId?: string;
 *   dryRun: boolean;
 * }
 */
const propagateSchema = z.object({
  categories: z.array(z.object({
    category_id: z.string(),
    name: z.string(),
    full_path: z.string(),
  })).min(1, 'At least one category is required'),
  scope: z.enum(['tenant', 'organization', 'platform']),
  tenantId: z.string().optional(),
  organizationId: z.string().optional(),
  dryRun: z.boolean().default(true),
});

router.post('/propagate', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = propagateSchema.parse(req.body);
    const { categories, scope, tenantId, organizationId, dryRun } = body;

    // Validate scope requirements
    if (scope === 'tenant' && !tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId is required for tenant scope',
      });
    }

    if (scope === 'organization' && !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId is required for organization scope',
      });
    }

    // Get target tenants based on scope
    let targetTenants: { id: string; name: string }[] = [];

    if (scope === 'tenant' && tenantId) {
      // Single tenant
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });
      if (tenant) {
        targetTenants = [tenant];
      }
    } else if (scope === 'organization' && organizationId) {
      // All tenants in organization
      targetTenants = await prisma.tenants.findMany({
        where: { organization_id: organizationId },
        select: { id: true, name: true },
      });
    } else if (scope === 'platform') {
      // All tenants on platform
      targetTenants = await prisma.tenants.findMany({
        where: { location_status: 'active' },
        select: { id: true, name: true },
      });
    }

    if (targetTenants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No target tenants found for the specified scope',
      });
    }

    // Dry run - just return what would happen
    if (dryRun) {
      return res.json({
        success: true,
        propagated: categories.length,
        tenantsAffected: targetTenants.length,
        dryRun: true,
        preview: {
          categories: categories.map(c => c.name),
          tenants: targetTenants.map(t => t.name),
        },
      });
    }

    // Actual propagation - create directory_category entries for each tenant
    let propagated = 0;
    const errors: string[] = [];

    for (const tenant of targetTenants) {
      for (const category of categories) {
        try {
          // Check if category already exists for this tenant
          const existing = await prisma.directory_category.findFirst({
            where: {
              tenantId: tenant.id,
              googleCategoryId: category.category_id,
            },
          });

          if (existing) {
            // Update existing
            await prisma.directory_category.update({
              where: { id: existing.id },
              data: {
                name: category.name,
                slug: category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                updatedAt: new Date(),
              },
            });
          } else {
            // Create new
            await prisma.directory_category.create({
              data: {
                id: `dc_${tenant.id}_${category.category_id}`.replace(/[^a-zA-Z0-9_]/g, '_'),
                tenantId: tenant.id,
                name: category.name,
                slug: category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                googleCategoryId: category.category_id,
                isActive: true,
                sortOrder: 0,
                updatedAt: new Date(),
              },
            });
          }
          propagated++;
        } catch (err: any) {
          errors.push(`Failed to propagate "${category.name}" to tenant ${tenant.id}: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      propagated,
      tenantsAffected: targetTenants.length,
      dryRun: false,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[Admin Categories Propagate] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
