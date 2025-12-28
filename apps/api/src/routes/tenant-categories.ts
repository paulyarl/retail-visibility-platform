import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { audit } from '../audit';
import { triggerRevalidate } from '../utils/revalidate';
import { categoryService } from '../services/CategoryService';
import { getCategoryById } from '../lib/google/taxonomy';
import { isPlatformAdmin, canPerformSupportActions } from '../utils/platform-admin';
import { authenticateToken, requireTenantAdmin } from '../middleware/auth';
import { requirePropagationTier } from '../middleware/tier-validation';
import { generateProductCatId, generateQsCatId, generateQuickStart, generateSpecialHoursId, generateUserTenantId } from '../lib/id-generator';
import { getDirectPool } from '../utils/db-pool';

console.log('🔥 TENANT CATEGORIES ROUTES MODULE LOADED');

const router = Router();

// Helper to check tenant access
function hasAccessToTenant(req: Request, tenantId: string): boolean {
  if (!req.user) return false;
  if (isPlatformAdmin(req.user as any)) return true;
  return (req.user as any).tenantIds?.includes(tenantId) || false;
}

/**
 * Refresh directory_category_products materialized view after category changes
 * Ensures MV stays in sync with tenant configuration
 */
async function refreshDirectoryMV(tenantId?: string) {
  try {
    const pool = getDirectPool();
    // Try CONCURRENTLY first (requires unique index, doesn't block reads)
    try {
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_products');
      console.log(`[MV Refresh] Refreshed directory_category_products CONCURRENTLY${tenantId ? ` for tenant ${tenantId}` : ''}`);
    } catch (concurrentError: any) {
      // If concurrent refresh fails (missing unique index), fall back to blocking refresh
      if (concurrentError?.code === '55000') {
        console.warn('[MV Refresh] Concurrent refresh failed, falling back to blocking refresh');
        await pool.query('REFRESH MATERIALIZED VIEW directory_category_products');
        console.log(`[MV Refresh] Refreshed directory_category_products (blocking)${tenantId ? ` for tenant ${tenantId}` : ''}`);
      } else {
        throw concurrentError;
      }
    }
  } catch (error) {
    console.error('[MV Refresh] Failed to refresh materialized view:', error);
    // Don't throw error - this is non-critical
  }
}

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

  // Check tenant-level permissions - allow MEMBER+ for category access
  try {
    const { prisma: prismaClient } = await import('../prisma');
    const userTenant = await prismaClient.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
    });

    if (userTenant && (userTenant.role === 'OWNER' || userTenant.role === 'ADMIN' || userTenant.role === 'MEMBER')) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Tenant member access required for this operation',
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
router.get('/:tenantId/categories', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access to this tenant is not allowed',
      });
    }

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

    const result = await prisma.directory_category.findMany(findArgs);
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

    const category = await prisma.directory_category.findFirst({
      where: {
        id,
        tenantId:tenantId,
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
      googleCategory = await prisma.google_taxonomy_list.findFirst({
        where: { category_id: category.googleCategoryId },
      });
    }

    // Get child categories count
    const childCount = await prisma.directory_category.count({
      where: {
        tenantId:tenantId,
        parentId: id,
        isActive: true,
      },
    });

    // Get products using this category count
    const productCount = await prisma.inventory_items.count({
      where: {
        tenant_id:tenantId,
        category_path: {
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
    const existing = await prisma.directory_category.findFirst({
      where: {
        tenantId:tenantId,
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
      const parent = await prisma.directory_category.findFirst({
        where: {
          id: body.parentId,
          tenantId:tenantId,
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

    // Refresh MV to sync with new category
    await refreshDirectoryMV(tenantId);

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
  console.log('[from-enrichment] Endpoint called:', {
    tenantId: req.params.tenantId,
    body: req.body,
    user: req.user?.userId
  });
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
    const existing = await prisma.directory_category.findFirst({
      where: {
        tenantId:tenantId,
        slug,
      },
    });

    if (existing) {
      // If category exists, just assign to item if requested
      if (body.itemId) {
        await prisma.inventory_items.update({
          where: { id: body.itemId },
          data: { directory_category_id: existing.id },
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
      await prisma.inventory_items.update({
        where: { id: body.itemId },
        data: { directory_category_id: category.id },
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
    const existing = await prisma.directory_category.findFirst({
      where: { id, tenantId:tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check for duplicate slug if changing
    if (body.slug && body.slug !== existing.slug) {
      const duplicate = await prisma.directory_category.findFirst({
        where: {
          tenantId:tenantId,
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
      const parent = await prisma.directory_category.findFirst({
        where: {
          id: body.parentId,
          tenantId:tenantId,
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

    const category = await categoryService.updateDirectoryCategory(tenantId, id, body);

    // Refresh MV to sync with category changes
    await refreshDirectoryMV(tenantId);

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
    const category = await prisma.directory_category.findFirst({
      where: { id, tenantId:tenantId },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // Check for child categories
    const childCount = await prisma.directory_category.count({
      where: {
        tenantId:tenantId,
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
    const productCount = await prisma.inventory_items.count({
      where: {
        tenant_id:tenantId,
        category_path: { 
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

    await categoryService.softDeleteDirectoryCategory(tenantId, id);

    // Refresh MV to sync with category deletion
    await refreshDirectoryMV(tenantId);

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
    const category = await prisma.directory_category.findFirst({
      where: { id, tenantId:tenantId },
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

    const unmapped = await prisma.directory_category.findMany({
      where: {
        tenantId:tenantId,
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
 * GET /api/v1/tenants/:tenantId/categories/complete
 * Consolidated endpoint returning categories, alignment status, and tenant info in one call
 * Reduces 3 separate calls to 1 consolidated call
 * Pattern: API Consolidation for Frontend Optimization
 */
router.get('/:tenantId/categories/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Check tenant access
    if (!hasAccessToTenant(req, tenantId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access to this tenant is not allowed',
      });
    }

    console.log(`[CATEGORIES] Fetching complete categories data for tenant: ${tenantId}`);

    // Single comprehensive query - replaces 3 separate calls
    const [categories, alignmentStatus, tenant] = await Promise.all([
      // Categories data (replaces /api/v1/tenants/:id/categories)
      prisma.directory_category.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          googleCategoryId: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),

      // Alignment status calculation (replaces /api/v1/tenants/:id/categories-alignment-status)
      Promise.resolve().then(async () => {
        const [total, mapped] = await Promise.all([
          prisma.directory_category.count({
            where: { tenantId, isActive: true }
          }),
          prisma.directory_category.count({
            where: {
              tenantId,
              isActive: true,
              googleCategoryId: { not: null }
            }
          })
        ]);

        const unmapped = total - mapped;
        const mappingCoverage = total > 0 ? Math.round((mapped / total) * 100) : 0;
        const isCompliant = mappingCoverage >= 80;

        return {
          total,
          mapped,
          unmapped,
          mappingCoverage,
          isCompliant,
          status: isCompliant ? 'compliant' : unmapped > 0 ? 'needs_alignment' : 'unknown'
        };
      }),

      // Tenant info (replaces /api/tenants/:id)
      prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          organization_id: true,
          location_status: true,
          _count: {
            select: {
              inventory_items: true,
              user_tenants: true,
            },
          },
        },
      })
    ]);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Get organization info if tenant belongs to one
    let organizationInfo = null;
    if (tenant.organization_id) {
      const organization = await prisma.organizations_list.findUnique({
        where: { id: tenant.organization_id },
        select: {
          id: true,
          name: true,
        },
      });

      if (organization) {
        // Get other tenants in the organization for propagation
        const orgTenants = await prisma.tenants.findMany({
          where: { organization_id: tenant.organization_id },
          select: {
            id: true,
            name: true,
            metadata: true,
          },
        });

        const tenantsWithHeroFlag = orgTenants.map(t => ({
          id: t.id,
          name: t.name,
          isHero: (t.metadata as any)?.isHeroLocation === true
        }));

        organizationInfo = {
          id: organization.id,
          name: organization.name,
          tenants: tenantsWithHeroFlag
        };
      }
    }

    // Check if current tenant is hero location
    const tenantMetadata = tenant as any;
    const isHeroLocation = tenantMetadata?.metadata?.isHeroLocation === true;

    // Transform categories for frontend compatibility
    const transformedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      googleCategoryId: cat.googleCategoryId,
      isActive: true, // We already filtered for active
      sortOrder: cat.sortOrder,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));

    // Return consolidated response
    const consolidatedResponse = {
      categories: transformedCategories,
      alignmentStatus,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        organizationId: tenant.organization_id,
        isHeroLocation,
        stats: {
          productCount: tenant._count.inventory_items,
          userCount: tenant._count.user_tenants,
        }
      },
      organization: organizationInfo,
      _timestamp: new Date().toISOString(),
    };

    console.log(`[CATEGORIES] Returning consolidated data:`, {
      categoriesCount: transformedCategories.length,
      alignmentCoverage: alignmentStatus.mappingCoverage,
      hasOrganization: !!organizationInfo,
    });

    // Cache for 1 minute (categories change more frequently than tenant data)
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('Vary', 'Authorization');

    res.json(consolidatedResponse);
  } catch (error: any) {
    console.error('[CATEGORIES] Error fetching complete categories data:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch complete categories data',
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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        organizations_list: {
          include: {
            tenants: {
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

    if (!tenant.organization_id) {
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
    const heroCategories = await prisma.directory_category.findMany({
      where: {
        tenantId:tenantId,
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

    const locationTenants = tenant.organizations_list?.tenants || [];
    
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
          const existing = await prisma.directory_category.findFirst({
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
            await prisma.directory_category.update({
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
            await prisma.directory_category.create({
              data: { 
                id: generateProductCatId(location.id),
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

    // Refresh MV to sync with all propagated category changes
    await refreshDirectoryMV();

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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        organizations_list: {
          include: {
            tenants: {
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

    if (!tenant.organization_id) {
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
    const heroFlags = await prisma.tenant_feature_flags_list.findMany({
      where: { tenant_id:tenantId },
    });

    if (heroFlags.length === 0) {
      return res.status(400).json({ success: false, error: 'No feature flags found for hero location' });
    }

    const locationTenants = tenant.organizations_list?.tenants || [];
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
          const existing = await prisma.tenant_feature_flags_list.findFirst({
            where: {
              tenant_id:location.id,
              flag: heroFlag.flag,
            },
          });

          if (existing) {
            if (mode === 'create_only') {
              results.skipped++;
              continue;
            }
            
            await prisma.tenant_feature_flags_list.update({
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
            
            await prisma.tenant_feature_flags_list.create({
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
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        organizations_list: {
          include: {
            tenants: {
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

    if (!tenant.organization_id) {
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
    const heroBusinessHours = await prisma.business_hours_list.findUnique({
      where: { tenant_id:tenantId },
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
      heroSpecialHours = await prisma.business_hours_special_list.findMany({
        where: { tenant_id:tenantId },
      });
    }

    const locationTenants = tenant.organizations_list?.tenants || [];

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
        await prisma.business_hours_list.upsert({
          where: { tenant_id: location.id },
          create: {
            tenant_id: location.id,
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
            const existing = await prisma.business_hours_special_list.findFirst({
              where: {
                tenant_id: location.id,
                date: specialHour.date,
              },
            });

            if (existing) {
              await prisma.business_hours_special_list.update({
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
              await prisma.business_hours_special_list.create({
                data: {
                  id: generateSpecialHoursId(location.id),
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

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        organizations_list: {
          include: {
            tenants: {
              where: { id: { not: tenantId } },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
    if (!tenant.organization_id) return res.status(400).json({ success: false, error: 'Tenant is not part of an organization' });

    const metadata = tenant.metadata as any;
    if (metadata?.isHeroLocation !== true) {
      return res.status(400).json({ success: false, error: 'Only hero locations can propagate user roles' });
    }

    const heroUserRoles = await prisma.user_tenants.findMany({
      where: { tenant_id: tenantId },
      include: { users: { select: { email: true } } },
    });

    if (heroUserRoles.length === 0) {
      return res.status(400).json({ success: false, error: 'No user roles found for hero location' });
    }

    const locationTenants = tenant.organizations_list!.tenants;
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
          const existing = await prisma.user_tenants.findFirst({
            where: {
              tenant_id: location.id,
              user_id: heroRole.user_id,
            },
          });

          if (existing) {
            if (mode === 'create_only') {
              results.skipped++;
              continue;
            }
            await prisma.user_tenants.update({
              where: { id: existing.id },
              data: { role: heroRole.role },
            });
            results.updated++;
          } else {
            if (mode === 'update_only') {
              results.skipped++;
              continue;
            }
            await prisma.user_tenants.create({
              data: {
                 id: generateUserTenantId(heroRole.user_id, location.id),
                tenantId: location.id,
                userId: heroRole.user_id,
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

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        organizations_list: {
          include: {
            tenants: {
              where: { id: { not: tenantId } },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
    if (!tenant.organization_id) return res.status(400).json({ success: false, error: 'Tenant is not part of an organization' });

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

    const locationTenants = tenant.organizations_list?.tenants || [];
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
        const currentMetadata = (await prisma.tenants.findUnique({ where: { id: location.id }, select: { metadata: true } }))?.metadata as any || {};
        
        await prisma.tenants.update({
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

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        tenant_business_profiles_list: true,
        organizations_list: {
          include: {
            tenants: {
              where: { id: { not: tenantId } },
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
    if (!tenant.organization_id) return res.status(400).json({ success: false, error: 'Tenant is not part of an organization' });

    const metadata = tenant.metadata as any;
    if (metadata?.isHeroLocation !== true) {
      return res.status(400).json({ success: false, error: 'Only hero locations can propagate business profile' });
    }

    if (!tenant.tenant_business_profiles_list) {
      return res.status(400).json({ success: false, error: 'No business profile found for hero location' });
    }

    const locationTenants = tenant.organizations_list!.tenants;
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
        const profile = tenant.tenant_business_profiles_list!;
        
        await prisma.tenant_business_profiles_list.upsert({
          where: { tenant_id: location.id },
          create: {
            tenant_id: location.id,
            business_name: profile.business_name,
            address_line1: profile.address_line1,
            address_line2: profile.address_line2,
            city: profile.city,
            state: profile.state,
            postal_code: profile.postal_code,
            country_code: profile.country_code,
            website: profile.website,
            email: profile.email,
          } as any,
          update: {
            business_name: profile.business_name,
            address_line1: profile.address_line1,
            address_line2: profile.address_line2,
            city: profile.city,
            state: profile.state,
            postal_code: profile.postal_code,
            country_code: profile.country_code,
            website: profile.website,
            email: profile.email,
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

/**
 * PUT /api/tenant/gbp-category
 * Update GBP categories for a tenant
 * Permission: Platform support OR tenant owner/admin
 */
router.put('/gbp-category', async (req, res) => {
  console.log('🔥 GBP CATEGORY ENDPOINT HIT! User:', req.user?.userId, 'Role:', req.user?.role);
  console.log('🔥 GBP CATEGORY ENDPOINT HIT!');
  try {
    const { tenantId, primary, secondary } = req.body;
    console.log('[GBP Category] Request received:', { tenantId, primary, secondary });

    if (!tenantId) {
      console.log('[GBP Category] Tenant ID missing');
      return res.status(400).json({
        success: false,
        error: 'tenant_required',
        message: 'Tenant ID is required'
      });
    }

    // Check permissions inline (user is now authenticated by middleware)
    const user = (req as any).user;
    const userId = user?.userId;
    console.log('[GBP Category] User check:', { userId: userId, userRole: user?.role });

    // Platform support can manage any tenant
    const { canPerformSupportActions } = await import('../utils/platform-admin');
    const canSupport = canPerformSupportActions(user);
    console.log('[GBP Category] Platform support check:', canSupport);

    if (!canSupport) {
      console.log('[GBP Category] Checking tenant permissions for tenantId:', tenantId);
      // Check tenant-level permissions
      const userTenant = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: userId,
            tenant_id: tenantId,
          },
        },
      });

      console.log('[GBP Category] User tenant result:', userTenant);

      if (!userTenant || (userTenant.role !== 'OWNER' && userTenant.role !== 'ADMIN')) {
        console.log('[GBP Category] Permission denied');
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Tenant owner or admin access required for this operation',
        });
      }
    }

    if (!primary) {
      console.log('[GBP Category] Primary category missing');
      return res.status(400).json({
        success: false,
        error: 'Primary category is required'
      });
    }

    // Validate tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Use the GBPCategorySyncService to sync categories
    const { GBPCategorySyncService } = await import('../services/GBPCategorySync');
    const syncService = new GBPCategorySyncService(getDirectPool());

    const result = await syncService.syncGBPToDirectory(tenantId, {
      primary,
      secondary: secondary || []
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to sync GBP categories'
      });
    }

    // Update usage statistics
    const allCategoryIds = [primary.id, ...(secondary || []).map((s: any) => s.id)];
    await syncService.updateUsageStats(allCategoryIds);

    res.json({
      success: true,
      syncedCategories: result.syncedCategories,
      unmappedCategories: result.unmappedCategories,
      message: result.unmappedCategories.length > 0
        ? `Synced ${result.syncedCategories} categories. ${result.unmappedCategories.length} categories need mapping.`
        : `Successfully synced ${result.syncedCategories} categories`
    });

  } catch (error) {
    console.error('Error updating GBP categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update GBP categories'
    });
  }
});

console.log('🔥 TENANT CATEGORIES ROUTES EXPORTED');

export default router;
