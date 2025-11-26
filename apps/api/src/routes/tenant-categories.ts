import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { audit } from '../audit';
import { triggerRevalidate } from '../utils/revalidate';
import { categoryService } from '../services/CategoryService';
import { getCategoryById } from '../lib/google/taxonomy';
import { isPlatformAdmin, canPerformSupportActions } from '../utils/platform-admin';
import { requireTenantAdmin } from '../middleware/auth';
import { requirePropagationTier } from '../middleware/tier-validation';
import { generateQsCatId, generateQuickStart, generateUserTenantId } from '../lib/id-generator';

const router = Router();

/**
 * Middleware to check if user can perform support actions (admin/support)
 * Used for low-risk propagations like categories and hours
 */
function requireSupportActions(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !canPerformSupportActions(user)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Platform admin or support access required for this operation',
    });
  }
  next();
}

/**
 * Middleware to check if user is platform admin
 * Used for high-risk propagations like feature flags, roles, and branding
 */
function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !isPlatformAdmin(user)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Platform administrator access required for this operation',
    });
  }
  next();
}

/**
 * Middleware to check if user can manage tenant (owner/admin)
 * Used for tenant-level operations like creating/editing categories
 * Platform support can also perform these operations
 */
async function requireTenantManagement(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const userId = user?.userId;
  const tenantId = req.params.tenantId;

  if (!user || !userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  // Platform support can manage any tenant
  if (canPerformSupportActions(user)) {
    return next();
  }

  // Check tenant-level permissions
  try {
    const { prisma: prismaClient } = await import('../prisma');
    const userTenant = await prismaClient.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: userId,
          tenantId: tenantId,
        },
      },
    });

    if (userTenant && (userTenant.role === 'OWNER' || userTenant.role === 'ADMIN')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Tenant owner or admin access required for this operation',
    });
  } catch (error) {
    console.error('[requireTenantManagement] Error checking permissions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check permissions',
    });
  }
}

// Validation schemas
const createCategorySchema = z.object({
  tenantId: z.string().min(1), // Accept any string ID (CUID, UUID, or short ID)
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  parentId: z.string().min(1).optional(), // Accept any string ID
  googleCategoryId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  parentId: z.string().min(1).optional().nullable(), // Accept any string ID
  googleCategoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const alignCategorySchema = z.object({
  googleCategoryId: z.string().min(1),
  notes: z.string().optional(),
});

/**
 * GET /api/v1/tenants/:tenantId/categories
 * List categories for a tenant with optional search, mapped filter, and cursor pagination
 * Query:
 *  - search: string (name/slug contains)
 *  - mapped: 'true' | 'false' | undefined
 *  - includeInactive: 'true' | 'false'
 *  - limit: number (max 50, default 50)
 *  - cursor: string (id of last item from previous page)
 */
router.get('/:tenantId/categories', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      includeInactive = 'false',
      parentId,
      search,
      mapped,
      limit,
      cursor,
    } = req.query;

    const where: any = { tenantId };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    if (parentId === 'null') {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { slug: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (mapped === 'true') {
      where.googleCategoryId = { not: null };
    } else if (mapped === 'false') {
      where.googleCategoryId = null;
    }

    const take = Math.min(Math.max(parseInt(String(limit || '50'), 10) || 50, 1), 50);

    const findArgs: any = {
      where,
      orderBy: { id: 'asc' as const },
      take: take + 1, // fetch one extra to determine nextCursor
    };
    if (cursor && typeof cursor === 'string') {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1; // skip the cursor item itself
    }

    const result = await prisma.tenantCategory.findMany(findArgs);
    const hasMore = result.length > take;
    const categories = hasMore ? result.slice(0, take) : result;
    const nextCursor = hasMore ? categories[categories.length - 1]?.id : undefined;

    // Calculate mapping stats
    const totalCategories = categories.length;
    const mappedCategories = categories.filter(c => c.googleCategoryId).length;
    const mappingCoverage = totalCategories > 0 
      ? (mappedCategories / totalCategories) * 100 
      : 0;

    res.json({
      success: true,
      data: categories,
      nextCursor,
      stats: {
        total: totalCategories,
        mapped: mappedCategories,
        unmapped: totalCategories - mappedCategories,
        mappingCoverage: parseFloat(mappingCoverage.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId/categories/:id
 * Get a specific category
 */
router.get('/:tenantId/categories/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const category = await prisma.tenantCategory.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Get Google taxonomy info if mapped
    let googleCategory = null;
    if (category.googleCategoryId) {
      googleCategory = await prisma.googleTaxonomy.findFirst({
        where: { categoryId: category.googleCategoryId },
      });
    }

    // Get child categories count
    const childCount = await prisma.tenantCategory.count({
      where: {
        tenantId,
        parentId: id,
        isActive: true,
      },
    });

    // Get products using this category count
    const productCount = await prisma.inventoryItem.count({
      where: {
        tenantId,
        categoryPath: {
          has: category.slug,
        },
      },
    });

    res.json({
      success: true,
      data: {
        ...category,
        googleCategory,
        childCount,
        productCount,
      },
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category',
    });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/categories
 * Create a new category
 * Permission: Platform support OR tenant owner/admin
 */
router.post('/:tenantId/categories', requireTenantManagement, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = createCategorySchema.parse({ ...req.body, tenantId });

    // Check for duplicate slug
    const existing = await prisma.tenantCategory.findFirst({
      where: {
        tenantId,
        slug: body.slug,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Category with this slug already exists',
      });
    }

    // Validate parent exists if provided
    if (body.parentId) {
      const parent = await prisma.tenantCategory.findFirst({
        where: {
          id: body.parentId,
          tenantId,
        },
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          error: 'Parent category not found',
        });
      }
    }

    const category = await categoryService.createTenantCategory(tenantId, {
      name: body.name,
      slug: body.slug,
      parentId: body.parentId ?? null,
      googleCategoryId: body.googleCategoryId ?? null,
      sortOrder: body.sortOrder || 0,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
    });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/categories/from-enrichment
 * Create a category from enrichment suggestion and optionally assign to item
 * Permission: Platform support OR tenant owner/admin
 * Body: { name, googleCategoryId?, itemId? }
 */
router.post('/:tenantId/categories/from-enrichment', requireTenantManagement, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const enrichmentCategorySchema = z.object({
      name: z.string().min(1, 'Category name is required'),
      googleCategoryId: z.string().optional(),
      itemId: z.string().optional(), // Optional: assign to item immediately
    });

    const body = enrichmentCategorySchema.parse(req.body);

    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check for duplicate slug
    const existing = await prisma.tenantCategory.findFirst({
      where: {
        tenantId,
        slug,
      },
    });

    if (existing) {
      // If category exists, just assign to item if requested
      if (body.itemId) {
        await prisma.inventoryItem.update({
          where: { id: body.itemId },
          data: { tenantCategoryId: existing.id },
        });
      }

      return res.status(200).json({
        success: true,
        data: existing,
        message: 'Category already exists, assigned to item',
      });
    }

    // Create new category
    const category = await categoryService.createTenantCategory(tenantId, {
      name: body.name,
      slug,
      parentId: null,
      googleCategoryId: body.googleCategoryId ?? null,
      sortOrder: 0,
    });

    // Assign to item if requested
    if (body.itemId) {
      await prisma.inventoryItem.update({
        where: { id: body.itemId },
        data: { tenantCategoryId: category.id },
      });
    }

    // Audit log
    await audit({
      action: 'tenant_category.created_from_enrichment',
      actor: (req as any).user?.id || 'system',
      tenantId,
      payload: {
        resourceType: 'tenant_category',
        resourceId: category.id,
        categoryName: category.name,
        googleCategoryId: body.googleCategoryId,
        itemId: body.itemId,
        source: 'enrichment',
      },
    });

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created from enrichment',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error creating category from enrichment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category',
    });
  }
});

/**
 * PUT /api/v1/tenants/:tenantId/categories/:id
 * Update a category
 * Permission: Platform support OR tenant owner/admin
 */
router.put('/:tenantId/categories/:id', requireTenantManagement, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const body = updateCategorySchema.parse(req.body);

    // Check category exists
    const existing = await prisma.tenantCategory.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check for duplicate slug if changing
    if (body.slug && body.slug !== existing.slug) {
      const duplicate = await prisma.tenantCategory.findFirst({
        where: {
          tenantId,
          slug: body.slug,
          id: { not: id },
        },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: 'Category with this slug already exists',
        });
      }
    }

    // Validate parent exists if provided
    if (body.parentId) {
      const parent = await prisma.tenantCategory.findFirst({
        where: {
          id: body.parentId,
          tenantId,
        },
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          error: 'Parent category not found',
        });
      }

      // Prevent circular reference
      if (body.parentId === id) {
        return res.status(400).json({
          success: false,
          error: 'Category cannot be its own parent',
        });
      }
    }

    const category = await categoryService.updateTenantCategory(tenantId, id, body);

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category',
    });
  }
});

/**
 * DELETE /api/v1/tenants/:tenantId/categories/:id
 * Delete a category (soft delete)
 * Permission: Platform support OR tenant owner/admin
 */
router.delete('/:tenantId/categories/:id', requireTenantManagement, async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    // Check category exists
    const category = await prisma.tenantCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check for child categories
    const childCount = await prisma.tenantCategory.count({
      where: {
        tenantId,
        parentId: id,
        isActive: true,
      },
    });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with active child categories',
        childCount,
      });
    }

    // Check for products using this category
    const productCount = await prisma.inventoryItem.count({
      where: {
        tenantId,
        categoryPath: { 
          has: category.slug,
        },
      },
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with products assigned',
        productCount,
      });
    }

    await categoryService.softDeleteTenantCategory(tenantId, id);

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
    });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/categories/:id/align
 * Align category to Google taxonomy (GBP category management)
 * Permission: Platform support OR tenant owner/admin
 */
router.post('/:tenantId/categories/:id/align', requireTenantManagement, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const body = alignCategorySchema.parse(req.body);

    // Check category exists
    const category = await prisma.tenantCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Validate Google category exists in taxonomy
    const googleCategory = getCategoryById(body.googleCategoryId);

    if (!googleCategory) {
      return res.status(404).json({
        success: false,
        error: 'Google category not found',
      });
    }

    const updated = await categoryService.alignCategory(tenantId, id, body.googleCategoryId);

    res.json({
      success: true,
      data: {
        ...updated,
        googleCategory: {
          id: googleCategory.id,
          name: googleCategory.name,
          path: googleCategory.path,
        },
      },
      message: 'Category aligned successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }

    console.error('Error aligning category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to align category',
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId/categories/unmapped
 * Get all unmapped categories
 */
router.get('/:tenantId/categories-unmapped', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const unmapped = await prisma.tenantCategory.findMany({
      where: {
        tenantId,
        isActive: true,
        googleCategoryId: null,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: unmapped,
      count: unmapped.length,
    });
  } catch (error) {
    console.error('Error fetching unmapped categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unmapped categories',
    });
  }
});

/**
 * GET /api/v1/tenants/:tenantId/categories/alignment-status
 * Get category alignment status and metrics
 */
router.get('/:tenantId/categories-alignment-status', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const [total, mapped, unmapped] = await Promise.all([
      prisma.tenantCategory.count({
        where: { tenantId, isActive: true },
      }),
      prisma.tenantCategory.count({
        where: {
          tenantId,
          isActive: true,
          googleCategoryId: { not: null },
        },
      }),
      prisma.tenantCategory.count({
        where: {
          tenantId,
          isActive: true,
          googleCategoryId: null,
        },
      }),
    ]);

    const mappingCoverage = total > 0 ? (mapped / total) * 100 : 0;
    const isCompliant = mappingCoverage === 100;

    res.json({
      success: true,
      data: {
        total,
        mapped,
        unmapped,
        mappingCoverage: parseFloat(mappingCoverage.toFixed(2)),
        isCompliant,
        status: isCompliant ? 'compliant' : unmapped > 0 ? 'needs_alignment' : 'unknown',
      },
    });
  } catch (error) {
    console.error('Error fetching alignment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alignment status',
    });
  }
});

const propagateCategoriesSchema = z.object({
  mode: z.enum(['create_only', 'update_only', 'create_or_update']).optional().default('create_or_update'),
});

/**
 * POST /api/v1/tenants/:tenantId/categories/propagate
 * Propagate all categories from hero tenant to all location tenants
 * Body: { mode?: 'create_only' | 'update_only' | 'create_or_update' }
 * Permission: Tenant admin (Professional tier+, 2+ locations required)
 */
router.post('/:tenantId/categories/propagate', requireTenantAdmin, requirePropagationTier('categories'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = propagateCategoriesSchema.parse(req.body);
    const { mode } = body;

    // Get the tenant and verify it's a hero tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: {
          include: {
            Tenant: {
              where: {
                id: { not: tenantId }, // Exclude the hero tenant itself
              },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    if (!tenant.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant is not part of an organization',
      });
    }

    // Check if this is a hero location
    const metadata = tenant.metadata as any;
    const isHeroLocation = metadata?.isHeroLocation === true;

    if (!isHeroLocation) {
      return res.status(400).json({
        success: false,
        error: 'Only hero locations can propagate categories',
        message: 'This tenant is not set as the hero location for the organization',
      });
    }

    // Get all active categories from the hero tenant
    const heroCategories = await prisma.tenantCategory.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (heroCategories.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No categories to propagate',
      });
    }

    const locationTenants = tenant.organization?.Tenant || [];
    
    if (locationTenants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No location tenants found in organization',
      });
    }

    // Propagate categories to each location
    const results = {
      totalLocations: locationTenants.length,
      totalCategories: heroCategories.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ tenantId: string; tenantName: string; error: string }>,
    };

    for (const location of locationTenants) {
      try {
        for (const heroCategory of heroCategories) {
          // Check if category with same slug already exists
          const existing = await prisma.tenantCategory.findFirst({
            where: {
              tenantId: location.id,
              slug: heroCategory.slug,
            },
          });

          // Handle based on mode
          if (existing) {
            if (mode === 'create_only') {
              results.skipped++;
              continue;
            }
            
            // Update mode - update existing category
            await prisma.tenantCategory.update({
              where: { id: existing.id },
              data: {
                name: heroCategory.name,
                googleCategoryId: heroCategory.googleCategoryId,
                sortOrder: heroCategory.sortOrder,
                isActive: true,
              },
            });
            results.updated++;
          } else {
            if (mode === 'update_only') {
              results.skipped++;
              continue;
            }
            
            // Create mode - create new category
            await prisma.tenantCategory.create({
              data: {
                /** id: `cat_${location.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, */
                id: generateQsCatId(),
                tenantId: location.id,
                name: heroCategory.name,
                slug: heroCategory.slug,
                googleCategoryId: heroCategory.googleCategoryId,
                sortOrder: heroCategory.sortOrder,
                isActive: true,
                updatedAt: new Date(),
              } as any,
            });
            results.created++;
          }
        }

        // Trigger revalidate for this location
        triggerRevalidate(location.id).catch(() => {});
      } catch (error: any) {
        console.error(`Error propagating to tenant ${location.id}:`, error);
        results.errors.push({
          tenantId: location.id,
          tenantName: location.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      message: 'Categories propagated successfully',
      data: results,
    });
  } catch (error) {
    console.error('Error propagating categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to propagate categories',
    });
  }
});

const propagateFeatureFlagsSchema = z.object({
  mode: z.enum(['create_only', 'update_only', 'create_or_update']).optional().default('create_or_update'),
});

/**
 * POST /api/v1/tenants/:tenantId/feature-flags/propagate
 * Propagate feature flags from hero tenant to all location tenants
 * Body: { mode?: 'create_only' | 'update_only' | 'create_or_update' }
 * Permission: Platform admin only (SECURITY: affects feature access, keep admin-only)
 */
router.post('/:tenantId/feature-flags/propagate', requirePlatformAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = propagateFeatureFlagsSchema.parse(req.body);
    const { mode } = body;

    // Get the tenant and verify it's a hero tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: {
          include: {
            Tenant: {
              where: { id: { not: tenantId } },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    if (!tenant.organizationId) {
      return res.status(400).json({ success: false, error: 'Tenant is not part of an organization' });
    }

    const metadata = tenant.metadata as any;
    if (metadata?.isHeroLocation !== true) {
      return res.status(400).json({
        success: false,
        error: 'Only hero locations can propagate feature flags',
      });
    }

    // Get feature flags from hero tenant
    const heroFlags = await prisma.tenantFeatureFlags.findMany({
      where: { tenantId },
    });

    if (heroFlags.length === 0) {
      return res.status(400).json({ success: false, error: 'No feature flags found for hero location' });
    }

    const locationTenants = tenant.organization?.Tenant || [];
    if (locationTenants.length === 0) {
      return res.status(400).json({ success: false, error: 'No location tenants found in organization' });
    }

    const results = {
      totalLocations: locationTenants.length,
      totalFlags: heroFlags.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ tenantId: string; tenantName: string; error: string }>,
    };

    for (const location of locationTenants) {
      try {
        for (const heroFlag of heroFlags) {
          const existing = await prisma.tenantFeatureFlags.findFirst({
            where: {
              tenantId: location.id,
              flag: heroFlag.flag,
            },
          });

          if (existing) {
            if (mode === 'create_only') {
              results.skipped++;
              continue;
            }
            
            await prisma.tenantFeatureFlags.update({
              where: { id: existing.id },
              data: {
                enabled: heroFlag.enabled,
                description: heroFlag.description,
                rollout: heroFlag.rollout,
              },
            });
            results.updated++;
          } else {
            if (mode === 'update_only') {
              results.skipped++;
              continue;
            }
            
            await prisma.tenantFeatureFlags.create({
              data: {
                tenantId: location.id,
                flag: heroFlag.flag,
                enabled: heroFlag.enabled,
                description: heroFlag.description,
                rollout: heroFlag.rollout,
              } as any,
            });
            results.created++;
          }
        }
      } catch (error: any) {
        console.error(`Error propagating to tenant ${location.id}:`, error);
        results.errors.push({
          tenantId: location.id,
          tenantName: location.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      message: 'Feature flags propagated successfully',
      data: results,
    });
  } catch (error) {
    console.error('Error propagating feature flags:', error);
    res.status(500).json({ success: false, error: 'Failed to propagate feature flags' });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/business-hours/propagate
 * Propagate business hours from hero tenant to all location tenants
 * Body: { includeSpecialHours?: boolean }
 * Permission: Tenant admin (Professional tier+, 2+ locations required)
 */
router.post('/:tenantId/business-hours/propagate', requireTenantAdmin, requirePropagationTier('hours'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { includeSpecialHours = true } = req.body;

    // Get the tenant and verify it's a hero tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: {
          include: {
            Tenant: {
              where: {
                id: { not: tenantId },
              },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    if (!tenant.organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant is not part of an organization',
      });
    }

    // Check if this is a hero location
    const metadata = tenant.metadata as any;
    const isHeroLocation = metadata?.isHeroLocation === true;

    if (!isHeroLocation) {
      return res.status(400).json({
        success: false,
        error: 'Only hero locations can propagate business hours',
        message: 'This tenant is not set as the hero location for the organization',
      });
    }

    // Get business hours from hero tenant
    const heroBusinessHours = await prisma.businessHours.findUnique({
      where: { tenantId },
    });

    if (!heroBusinessHours) {
      return res.status(400).json({
        success: false,
        error: 'No business hours found for hero location',
      });
    }

    // Get special hours if requested
    let heroSpecialHours: any[] = [];
    if (includeSpecialHours) {
      heroSpecialHours = await prisma.businessHoursSpecial.findMany({
        where: { tenantId },
      });
    }

    const locationTenants = tenant.organization?.Tenant || [];

    if (locationTenants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No location tenants found in organization',
      });
    }

    // Propagate business hours to each location
    const results = {
      totalLocations: locationTenants.length,
      regularHoursUpdated: 0,
      specialHoursCreated: 0,
      specialHoursUpdated: 0,
      errors: [] as Array<{ tenantId: string; tenantName: string; error: string }>,
    };

    for (const location of locationTenants) {
      try {
        // Upsert regular business hours
        await prisma.businessHours.upsert({
          where: { tenantId: location.id },
          create: {
            tenantId: location.id,
            timezone: heroBusinessHours.timezone,
            periods: heroBusinessHours.periods as any,
          } as any,
          update: {
            timezone: heroBusinessHours.timezone,
            periods: heroBusinessHours.periods as any,
          },
        });
        results.regularHoursUpdated++;

        // Propagate special hours if requested
        if (includeSpecialHours && heroSpecialHours.length > 0) {
          for (const specialHour of heroSpecialHours) {
            const existing = await prisma.businessHoursSpecial.findFirst({
              where: {
                tenantId: location.id,
                date: specialHour.date,
              },
            });

            if (existing) {
              await prisma.businessHoursSpecial.update({
                where: { id: existing.id },
                data: {
                  isClosed: specialHour.isClosed,
                  open: specialHour.open,
                  close: specialHour.close,
                  note: specialHour.note,
                },
              });
              results.specialHoursUpdated++;
            } else {
              await prisma.businessHoursSpecial.create({
                data: {
                  tenantId: location.id,
                  date: specialHour.date,
                  isClosed: specialHour.isClosed,
                  open: specialHour.open,
                  close: specialHour.close,
                  note: specialHour.note,
                } as any,
              });
              results.specialHoursCreated++;
            }
          }
        }
      } catch (error: any) {
        console.error(`Error propagating to tenant ${location.id}:`, error);
        results.errors.push({
          tenantId: location.id,
          tenantName: location.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      message: 'Business hours propagated successfully',
      data: results,
    });
  } catch (error) {
    console.error('Error propagating business hours:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to propagate business hours',
    });
  }
});

const propagateUserRolesSchema = z.object({
  mode: z.enum(['create_only', 'update_only', 'create_or_update']).optional().default('create_or_update'),
});

/**
 * POST /api/v1/tenants/:tenantId/user-roles/propagate
 * Propagate user roles from hero tenant to all location tenants
 * Body: { mode?: 'create_only' | 'update_only' | 'create_or_update' }
 * Permission: Tenant admin (Starter tier+, 2+ locations required)
 */
router.post('/:tenantId/user-roles/propagate', requireTenantAdmin, requirePropagationTier('user_roles'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = propagateUserRolesSchema.parse(req.body);
    const { mode } = body;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: {
          include: {
            Tenant: {
              where: { id: { not: tenantId } },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
    if (!tenant.organizationId) return res.status(400).json({ success: false, error: 'Tenant is not part of an organization' });

    const metadata = tenant.metadata as any;
    if (metadata?.isHeroLocation !== true) {
      return res.status(400).json({ success: false, error: 'Only hero locations can propagate user roles' });
    }

    const heroUserRoles = await prisma.userTenant.findMany({
      where: { tenantId },
      include: { user: { select: { email: true } } },
    });

    if (heroUserRoles.length === 0) {
      return res.status(400).json({ success: false, error: 'No user roles found for hero location' });
    }

    const locationTenants = tenant.organization!.Tenant;
    if (locationTenants.length === 0) {
      return res.status(400).json({ success: false, error: 'No location tenants found' });
    }

    const results = {
      totalLocations: locationTenants.length,
      totalUsers: heroUserRoles.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ tenantId: string; tenantName: string; error: string }>,
    };

    for (const location of locationTenants) {
      try {
        for (const heroRole of heroUserRoles) {
          const existing = await prisma.userTenant.findFirst({
            where: {
              tenantId: location.id,
              userId: heroRole.userId,
            },
          });

          if (existing) {
            if (mode === 'create_only') {
              results.skipped++;
              continue;
            }
            await prisma.userTenant.update({
              where: { id: existing.id },
              data: { role: heroRole.role },
            });
            results.updated++;
          } else {
            if (mode === 'update_only') {
              results.skipped++;
              continue;
            }
            await prisma.userTenant.create({
              data: {
                 id: generateUserTenantId(heroRole.userId, location.id),
                tenantId: location.id,
                userId: heroRole.userId,
                role: heroRole.role,
                updatedAt: new Date(),
              } as any,
            });
            results.created++;
          }
        }
      } catch (error: any) {
        results.errors.push({
          tenantId: location.id,
          tenantName: location.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({ success: true, message: 'User roles propagated successfully', data: results });
  } catch (error) {
    console.error('Error propagating user roles:', error);
    res.status(500).json({ success: false, error: 'Failed to propagate user roles' });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/brand-assets/propagate
 * Propagate brand assets from hero tenant to all location tenants (always overwrites)
 * Permission: Tenant admin (Organization tier only, 2+ locations required)
 */
router.post('/:tenantId/brand-assets/propagate', requireTenantAdmin, requirePropagationTier('brand_assets'), async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: {
          include: {
            Tenant: {
              where: { id: { not: tenantId } },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
    if (!tenant.organizationId) return res.status(400).json({ success: false, error: 'Tenant is not part of an organization' });

    const metadata = tenant.metadata as any;
    if (metadata?.isHeroLocation !== true) {
      return res.status(400).json({ success: false, error: 'Only hero locations can propagate brand assets' });
    }

    // Extract brand assets from hero metadata
    const brandAssets = {
      logo: metadata?.brandLogo,
      primaryColor: metadata?.brandPrimaryColor,
      secondaryColor: metadata?.brandSecondaryColor,
      accentColor: metadata?.brandAccentColor,
    };

    if (!brandAssets.logo && !brandAssets.primaryColor) {
      return res.status(400).json({ success: false, error: 'No brand assets found for hero location' });
    }

    const locationTenants = tenant.organization?.Tenant || [];
    if (locationTenants.length === 0) {
      return res.status(400).json({ success: false, error: 'No location tenants found' });
    }

    const results = {
      totalLocations: locationTenants.length,
      updated: 0,
      errors: [] as Array<{ tenantId: string; tenantName: string; error: string }>,
    };

    for (const location of locationTenants) {
      try {
        const currentMetadata = (await prisma.tenant.findUnique({ where: { id: location.id }, select: { metadata: true } }))?.metadata as any || {};
        
        await prisma.tenant.update({
          where: { id: location.id },
          data: {
            metadata: {
              ...currentMetadata,
              brandLogo: brandAssets.logo,
              brandPrimaryColor: brandAssets.primaryColor,
              brandSecondaryColor: brandAssets.secondaryColor,
              brandAccentColor: brandAssets.accentColor,
            },
          },
        });
        results.updated++;
      } catch (error: any) {
        results.errors.push({
          tenantId: location.id,
          tenantName: location.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({ success: true, message: 'Brand assets propagated successfully', data: results });
  } catch (error) {
    console.error('Error propagating brand assets:', error);
    res.status(500).json({ success: false, error: 'Failed to propagate brand assets' });
  }
});

/**
 * POST /api/v1/tenants/:tenantId/business-profile/propagate
 * Propagate business profile from hero tenant to all location tenants (always overwrites)
 * Permission: Tenant admin (Professional tier+, 2+ locations required)
 */
router.post('/:tenantId/business-profile/propagate', requireTenantAdmin, requirePropagationTier('profile'), async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tenantBusinessProfile: true,
        organization: {
          include: {
            Tenant: {
              where: { id: { not: tenantId } },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
    if (!tenant.organizationId) return res.status(400).json({ success: false, error: 'Tenant is not part of an organization' });

    const metadata = tenant.metadata as any;
    if (metadata?.isHeroLocation !== true) {
      return res.status(400).json({ success: false, error: 'Only hero locations can propagate business profile' });
    }

    if (!tenant.tenantBusinessProfile) {
      return res.status(400).json({ success: false, error: 'No business profile found for hero location' });
    }

    const locationTenants = tenant.organization!.Tenant;
    if (locationTenants.length === 0) {
      return res.status(400).json({ success: false, error: 'No location tenants found' });
    }

    const results = {
      totalLocations: locationTenants.length,
      updated: 0,
      errors: [] as Array<{ tenantId: string; tenantName: string; error: string }>,
    };

    for (const location of locationTenants) {
      try {
        await prisma.tenantBusinessProfile.upsert({
          where: { tenantId: location.id },
          create: {
            tenantId: location.id,
            businessName: tenant.tenantBusinessProfile.businessName,
            businessLine1: tenant.tenantBusinessProfile.businessLine1,
            businessLine2: tenant.tenantBusinessProfile.businessLine2,
            city: tenant.tenantBusinessProfile.city,
            state: tenant.tenantBusinessProfile.state,
            postalCode: tenant.tenantBusinessProfile.postalCode,
            countryCode: tenant.tenantBusinessProfile.countryCode,
            website: tenant.tenantBusinessProfile.website,
            email: tenant.tenantBusinessProfile.email,
          } as any,
          update: {
            businessName: tenant.tenantBusinessProfile.businessName,
            businessLine1: tenant.tenantBusinessProfile.businessLine1,
            businessLine2: tenant.tenantBusinessProfile.businessLine2,
            city: tenant.tenantBusinessProfile.city,
            state: tenant.tenantBusinessProfile.state,
            postalCode: tenant.tenantBusinessProfile.postalCode,
            countryCode: tenant.tenantBusinessProfile.countryCode,
            website: tenant.tenantBusinessProfile.website,
            email: tenant.tenantBusinessProfile.email,
          },
        });
        results.updated++;
      } catch (error: any) {
        results.errors.push({
          tenantId: location.id,
          tenantName: location.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({ success: true, message: 'Business profile propagated successfully', data: results });
  } catch (error) {
    console.error('Error propagating business profile:', error);
    res.status(500).json({ success: false, error: 'Failed to propagate business profile' });
  }
});

export default router;
