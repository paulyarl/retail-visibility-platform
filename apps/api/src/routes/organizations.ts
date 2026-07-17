// Organization Management API Routes
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, basePrisma } from '../prisma';
import { validateOrganizationTier, validateOrganizationLimits, validateOrganizationTierChange } from '../middleware/organization-validation';
import { isPlatformAdmin, canPerformSupportActions } from '../utils/platform-admin';
import { requireTenantAdmin } from '../middleware/auth';
import { requirePropagationTier } from '../middleware/tier-validation';
import { generateItemId, generateTenantItemId,generateOrganizationId, generatePhotoId, generateProductCatId, generateTenantId, generateUserTenantId,generateVariantId } from '../lib/id-generator';
import { propagateVariants } from '../utils/variant-propagation';
import { ensureGlobalCatalogEntry, hasGlobalCatalogEntry } from '../utils/global-catalog-sync';
import { authenticateToken } from '../middleware/auth';
import { requireOrgAdmin, getUserTenantRole } from '../middleware/permissions';
import { user_tenant_role } from '@prisma/client';
import TierService from '../services/TierService';
import ProductTypeService from '../services/ProductTypeService';
import { logger } from '../logger';

const router = Router();

/**
 * Ensure a directory category exists for a target tenant.
 * If the source item has a category, check if it exists for the target tenant.
 * If not, create it based on the source category.
 * Returns the target tenant's category ID (or null if no category).
 */
async function ensureCategoryForTargetTenant(
  sourceCategoryId: string | null,
  targetTenantId: string
): Promise<string | null> {
  console.log(`[organizations: sourceCategoryId] ${sourceCategoryId} `);
  if (!sourceCategoryId) {
    return null;
  }

  // Get the source category details
  const sourceCategory = await prisma.directory_category.findUnique({
    where: { id: sourceCategoryId },
  });
  
  console.log(`[organizations: sourceCategoryId] ${sourceCategoryId} `);

  if (!sourceCategory) {
    console.log(`[Propagation] Source category ${sourceCategoryId} not found, skipping category assignment`);
    return null;
  }

  // Check if a category with the same slug already exists for the target tenant
  let targetCategory = await prisma.directory_category.findFirst({
    where: {
      tenantId: targetTenantId,
      slug: sourceCategory.slug,
    },
  });
  
  console.log(`[organizations: targetCategory] ${targetCategory} `);

  if (targetCategory) {
    console.log(`[Propagation] Using existing category for tenant ${targetTenantId}: ${sourceCategory.name} (${targetCategory.id})`);
    return targetCategory.id;
  }

  // Create a new category for the target tenant
  targetCategory = await prisma.directory_category.create({
    data: {
      id: generateProductCatId(targetTenantId),
      tenantId: targetTenantId,
      name: sourceCategory.name,
      slug: sourceCategory.slug,
      parentId: sourceCategory.parentId,
      googleCategoryId: sourceCategory.googleCategoryId,
      isActive: true,
      sortOrder: sourceCategory.sortOrder,
      updatedAt: new Date(),
    },
  });
  
  console.log(`[organizations: targetCategory] ${targetCategory} :  ${sourceCategory} `);
  

  console.log(`[Propagation] Created category for tenant ${targetTenantId}: ${sourceCategory.name} (${targetCategory.id})`);
  return targetCategory.id;
}

/**
 * Middleware to check if user can perform support actions (admin/support)
 * Used for organization management operations
 */
function requireSupportActions(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  /* console.log('[requireSupportActions] Checking user:', {
    userId: user?.userId,
    role: user?.role,
    tenantIds: user?.tenantIds,
    hasUser: !!user
  }); */

  if (!user || !canPerformSupportActions(user)) {
    /* console.log('[requireSupportActions] Access denied for user:', {
      userId: user?.userId,
      role: user?.role,
      canPerform: canPerformSupportActions(user)
    }); */
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Platform admin or support access required for organization management',
    });
  }
/* 
  console.log('[requireSupportActions] Access granted for user:', {
    userId: user?.userId,
    role: user?.role
  }); */
  next();
}

/**
 * Middleware to check if user is platform admin
 * Used for high-risk organization operations
 */
function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !isPlatformAdmin(user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Platform administrator access required for this operation',
    });
  }
  next();
}

// GET /organizations - List all organizations
// Permission: Authenticated users (filtered by access)
// - Platform admins see all organizations
// - Other users see only organizations where they are members
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const isPlatformAdminUser = isPlatformAdmin(user) || canPerformSupportActions(user);

    // Type for organizations with tenants included for stats
    type TenantWithCount = { id: string; name: string; _count: { inventory_items: number } };
    type OrgWithTenants = Awaited<ReturnType<typeof prisma.organizations_list.findMany>>[number] & {
      tenants: TenantWithCount[];
    };

    let organizations: OrgWithTenants[];

    if (isPlatformAdminUser) {
      // Platform admins/support see all organizations
      organizations = await prisma.organizations_list.findMany({
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  inventory_items: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      // Regular users see only organizations where they are members
      // Find tenants where the user is a member
      const userTenants = await prisma.tenants.findMany({
        where: {
          OR: [
            {
              user_tenants: {
                some: {
                  user_id: user.userId,
                  role: {
                    in: [user_tenant_role.OWNER, user_tenant_role.ADMIN, user_tenant_role.MEMBER, user_tenant_role.VIEWER]
                  }
                }
              }
            },
            {
              created_by: user.userId
            }
          ]
        },
        select: {
          organization_id: true
        }
      });

      // Get unique organization IDs (filter out nulls)
      const orgIds = [...new Set(userTenants.map(t => t.organization_id).filter((id): id is string => id !== null))];

      if (orgIds.length === 0) {
        // User is not a member of any organization
        return res.json([]);
      }

      organizations = await prisma.organizations_list.findMany({
        where: {
          id: { in: orgIds }
        },
        include: {
          tenants: {
            where: {
              OR: [
                {
                  user_tenants: {
                    some: {
                      user_id: user.userId,
                      role: {
                        in: [user_tenant_role.OWNER, user_tenant_role.ADMIN, user_tenant_role.MEMBER, user_tenant_role.VIEWER]
                      }
                    }
                  }
                },
                {
                  created_by: user.userId
                }
              ]
            },
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  inventory_items: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    }

    // Calculate stats for each organization
    const orgsWithStats = organizations.map(org => {
      const totalSKUs = org.tenants.reduce((sum, t) => sum + t._count.inventory_items, 0);
      return {
        ...org,
        stats: {
          totalLocations: org.tenants.length,
          totalSKUs,
          utilizationPercent: (totalSKUs / org.max_total_skus) * 100,
        },
      };
    });

    res.json(orgsWithStats);
  } catch (error: any) {
    // If the database is temporarily unreachable (e.g., Supabase paused), don't break the UI
    if (error?.code === 'P1001' || (typeof (error as any)?.message === 'string' && error.message.includes("Can't reach database server"))) {
      console.warn('[Organizations] DB unreachable (P1001). Returning empty list.');
      return res.json([]);
    }
    logger.error('[Organizations] List error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_list_organizations' });
  }
});

/**
 * GET /organizations/product-type-summary
 * Admin endpoint: Aggregates product type distribution across all organizations.
 * Returns per-org product mix (which product types they sell) for admin audit view.
 * NOTE: Must be defined before /:id to avoid the parameterized route swallowing this path.
 */
router.get('/product-type-summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPlatformAdminUser = isPlatformAdmin(user) || canPerformSupportActions(user);
    if (!isPlatformAdminUser) {
      return res.status(403).json({ error: 'forbidden', message: 'Platform admin access required' });
    }

    const orgs = await prisma.organizations_list.findMany({
      select: {
        id: true,
        name: true,
        tenants: { select: { id: true } },
      },
    });

    const summary = await Promise.all(
      orgs.map(async (org) => {
        const tenantIds = org.tenants.map((t) => t.id);
        if (tenantIds.length === 0) {
          return { orgId: org.id, orgName: org.name, productTypes: [], totalItems: 0 };
        }

        const grouped = await prisma.inventory_items.groupBy({
          by: ['product_type'],
          where: { tenant_id: { in: tenantIds } },
          _count: { id: true },
        });

        const totalItems = grouped.reduce((sum, g) => sum + g._count.id, 0);
        const productTypes = grouped.map((g) => ({
          type: g.product_type || 'unknown',
          count: g._count.id,
        }));

        return {
          orgId: org.id,
          orgName: org.name,
          productTypes,
          totalItems,
        };
      })
    );

    res.json({
      success: true,
      organizations: summary.filter((s) => s.totalItems > 0),
    });
  } catch (error: any) {
    logger.error('[Organizations] Product type summary error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch product type summary' });
  }
});

// GET /organizations/:id - Get single organization
// Permission: Organization members can read their own organization data
// Supports both organization IDs and tenant IDs (with fallback)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = req.params.id;
    
    let organization = null;
    let isTenantLookup = false;

    // First try to find as organization ID (traditional approach)
    organization = await prisma.organizations_list.findUnique({
      where: { id: id },
      include: {
        tenants: true
      }
    });

    // If not found as organization, try as tenant ID
    if (!organization) {
      isTenantLookup = true;
      
      // Platform admins can access any tenant's organization
      if (!isPlatformAdmin(user)) {
        // For non-admin users, verify access to this tenant
        const tenant = await prisma.tenants.findFirst({
          where: {
            id: id,
            OR: [
              {
                user_tenants: {
                  some: {
                    user_id: user.userId,
                    role: {
                      in: [user_tenant_role.OWNER, user_tenant_role.ADMIN, user_tenant_role.MEMBER, user_tenant_role.VIEWER]
                    }
                  }
                }
              },
              {
                created_by: user.userId
              }
            ]
          },
          select: {
            id: true,
            name: true,
            organization_id: true
          }
        });

        if (!tenant) {
          return res.status(404).json({ 
            error: 'not_found',
            message: 'Organization or tenant not found, or access denied' 
          });
        }

        // If tenant has no organization, return appropriate response
        if (!tenant.organization_id) {
          return res.json({
            message: 'Tenant is not part of an organization',
            tenant: {
              id: tenant.id,
              name: tenant.name
            },
            organization: null
          });
        }

        // Get the organization using the tenant's organization_id
        organization = await prisma.organizations_list.findUnique({
          where: { id: tenant.organization_id },
          include: {
            tenants: {
              where: {
                user_tenants: {
                  some: {
                    user_id: user.userId,
                    role: {
                      in: [user_tenant_role.OWNER, user_tenant_role.ADMIN, user_tenant_role.MEMBER, user_tenant_role.VIEWER]
                    }
                  }
                }
              }
            }
          }
        });
      } else {
        // Platform admin: get tenant directly and lookup organization
        const tenant = await prisma.tenants.findFirst({
          where: { id: id },
          select: {
            id: true,
            name: true,
            organization_id: true
          }
        });

        if (!tenant) {
          return res.status(404).json({ 
            error: 'not_found',
            message: 'Tenant not found' 
          });
        }

        // If tenant has no organization, return appropriate response
        if (!tenant.organization_id) {
          return res.json({
            message: 'Tenant is not part of an organization',
            tenant: {
              id: tenant.id,
              name: tenant.name
            },
            organization: null
          });
        }

        // Get the organization using the tenant's organization_id (no access restrictions for admins)
        organization = await prisma.organizations_list.findUnique({
          where: { id: tenant.organization_id },
          include: {
            tenants: true // Include all tenants for platform admin
          }
        });
      }
    }

    if (!organization) {
      return res.status(404).json({ 
        error: 'organization_not_found',
        message: 'Organization not found'
      });
    }

    // Verify user access (skip for tenant lookup since we already verified)
    if (!isTenantLookup) {
      // Verify user is a member of this organization
      const userTenants = await prisma.tenants.findMany({
        where: {
          organization_id: organization.id,
          user_tenants: {
            some: {
              user_id: user.userId,
              role: {
                in: [user_tenant_role.OWNER, user_tenant_role.ADMIN, user_tenant_role.MEMBER, user_tenant_role.VIEWER]
              }
            }
          }
        },
        select: { id: true }
      });

      // Also check if user created any tenants in this organization
      const userCreatedTenants = await prisma.tenants.findMany({
        where: {
          organization_id: organization.id,
          created_by: user.userId
        },
        select: { id: true }
      });

      if (userTenants.length === 0 && userCreatedTenants.length === 0 && !isPlatformAdmin(user)) {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'You must be a member of this organization to view its data' 
        });
      }
    }

    // Add context about how the organization was found
    const response = {
      ...organization,
      _lookup: {
        type: isTenantLookup ? 'tenant_id' : 'organization_id',
        originalId: id
      }
    };

    res.json(response);
  } catch (error: any) {
    // If the database is temporarily unreachable (e.g., Supabase paused), return a helpful error
    if (error?.code === 'P1001' || (typeof (error as any)?.message === 'string' && error.message.includes("Can't reach database server"))) {
      console.warn('[Organizations] DB unreachable (P1001). Organization:', req.params.id);
      return res.status(503).json({ error: 'database_unavailable', message: 'Database is temporarily unavailable' });
    }
    logger.error('[Organizations] Get error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_get_organization', message: error.message });
  }
});

// POST /organizations - Create organization
const createOrgSchema = z.object({
  name: z.string().min(1),
  ownerId: z.string().min(1).optional(), // Optional - defaults to authenticated user
  subscriptionTier: z.string().min(1).default('chain_starter'), // Validated by middleware against database
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).default('trial'),
  maxLocations: z.number().int().positive().default(5),
  maxTotalSKUs: z.number().int().positive().default(2500),
});

// POST /organizations - Create organization
// Permission: Platform admin only (creates org structure)
router.post('/', requirePlatformAdmin, validateOrganizationTier, validateOrganizationLimits, async (req, res) => {
  try {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const user = (req as any).user;
    const ownerId = parsed.data.ownerId || user?.userId;

    if (!ownerId) {
      return res.status(400).json({ error: 'owner_id_required', message: 'ownerId must be provided or user must be authenticated' });
    }

    const organization = await prisma.organizations_list.create({
      data: {
        id: generateOrganizationId(ownerId),
        name: parsed.data.name,
        owner_id: ownerId,
        subscription_tier: parsed.data.subscriptionTier,
        subscription_status: parsed.data.subscriptionStatus,
        max_locations: parsed.data.maxLocations,
        max_total_skus: parsed.data.maxTotalSKUs,
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        updated_at: new Date(),
      },
    });

    res.status(201).json(organization);
  } catch (error: any) {
    logger.error('[Organizations] Create error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_create_organization', message: error.message });
  }
});

// PUT /organizations/:id - Update organization
const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  maxLocations: z.number().int().positive().optional(),
  max_locations: z.number().int().positive().optional(),
  maxTotalSKUs: z.number().int().positive().optional(),
  max_total_skus: z.number().int().positive().optional(),
  subscriptionTier: z.string().min(1).optional(), // Validated by middleware against database
  subscription_tier: z.string().min(1).optional(), // Validated by middleware against database
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
  subscription_status: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
});

// PUT /organizations/:id - Update organization
// Permission: Platform admin only (modifies org structure)
router.put('/:id', requirePlatformAdmin, validateOrganizationTier, validateOrganizationLimits, validateOrganizationTierChange, async (req, res) => {
  try {
    const parsed = updateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    // Transform camelCase input to snake_case for Prisma
    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.maxLocations !== undefined) updateData.max_locations = parsed.data.maxLocations;
    if (parsed.data.maxTotalSKUs !== undefined) updateData.max_total_skus = parsed.data.maxTotalSKUs;
    if (parsed.data.subscriptionTier !== undefined) updateData.subscription_tier = parsed.data.subscriptionTier;
    if (parsed.data.subscriptionStatus !== undefined) updateData.subscription_status = parsed.data.subscriptionStatus;
    updateData.updated_at = new Date();

    const organization = await prisma.organizations_list.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(organization);
  } catch (error: any) {
    logger.error('[Organizations] Update error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_update_organization' });
  }
});

// PUT /organizations/:id/self-update - Update own organization
// Permission: Organization owner can update their own organization settings
router.put('/:id/self-update', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const parsed = updateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    // Verify user owns this organization
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
    });

    if (!organization) {
      return res.status(404).json({ error: 'organization_not_found', message: 'Organization not found' });
    }

    // Check if user is the owner or a platform admin
    const userId = req.user?.userId || req.user?.user_id;
    const isOwner = organization.owner_id === userId;
    const isPlatformAdmin = req.user?.role === 'PLATFORM_ADMIN' || req.user?.role === 'ADMIN';

    if (!isOwner && !isPlatformAdmin) {
      return res.status(403).json({ 
        error: 'access_denied', 
        message: 'Only organization owners can update organization settings' 
      });
    }

    // Transform camelCase input to snake_case for Prisma
    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.maxLocations !== undefined) updateData.max_locations = parsed.data.maxLocations;
    if (parsed.data.max_locations !== undefined) updateData.max_locations = parsed.data.max_locations;
    if (parsed.data.maxTotalSKUs !== undefined) updateData.max_total_skus = parsed.data.maxTotalSKUs;
    if (parsed.data.max_total_skus !== undefined) updateData.max_total_skus = parsed.data.max_total_skus;
    if (parsed.data.subscriptionTier !== undefined) updateData.subscription_tier = parsed.data.subscriptionTier;
    if (parsed.data.subscription_tier !== undefined) updateData.subscription_tier = parsed.data.subscription_tier;
    if (parsed.data.subscriptionStatus !== undefined) updateData.subscription_status = parsed.data.subscriptionStatus;
    if (parsed.data.subscription_status !== undefined) updateData.subscription_status = parsed.data.subscription_status;
    updateData.updated_at = new Date();

    const updatedOrganization = await prisma.organizations_list.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updatedOrganization);
  } catch (error: any) {
    logger.error('[Organizations] Self-update error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_update_organization' });
  }
});

// DELETE /organizations/:id - Delete organization
// Permission: Platform admin only (destructive operation)
router.delete('/:id', requirePlatformAdmin, async (req, res) => {
  try {
    // First, unlink all tenants from this organization
    await prisma.tenants.updateMany({
      where: { organization_id: req.params.id },
      data: { organization_id: null},
    });

    // Then delete the organization
    await prisma.organizations_list.delete({
      where: { id: req.params.id },
    });

    res.status(204).end();
  } catch (error: any) {
    logger.error('[Organizations] Delete error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_delete_organization' });
  }
});

// POST /organizations/:id/tenants - Add tenant to organization
const addTenantSchema = z.object({
  tenantId: z.string().min(1),
});

// POST /organizations/:id/tenants - Add tenant to organization
// Permission: Platform admin only (modifies org structure)
router.post('/:id/tenants', requirePlatformAdmin, async (req, res) => {
  try {
    const parsed = addTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const tenant = await prisma.tenants.update({
      where: { id: parsed.data.tenantId },
      data: {
        organizations_list: {
          connect: { id: req.params.id },
        },
      },
    });

    res.json(tenant);
  } catch (error: any) {
    logger.error('[Organizations] Add tenant error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_add_tenant' });
  }
});

// DELETE /organizations/:id/tenants/:tenantId - Remove tenant from organization
// Permission: Platform admin only (modifies org structure)
router.delete('/:id/tenants/:tenantId', requirePlatformAdmin, async (req, res) => {
  try {
    const tenant = await prisma.tenants.update({
      where: { id: req.params.tenantId },
      data: { organization_id: null },
    });

    res.json(tenant);
  } catch (error: any) {
    logger.error('[Organizations] Remove tenant error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_remove_tenant' });
  }
});

// GET /organizations/:id/available-tenants - List tenants the user owns/admins that are NOT in any organization
// Permission: Org admin or platform admin
router.get('/:id/available-tenants', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user.userId || user.user_id;
    const isPlatformAdminUser = isPlatformAdmin(user);

    let whereClause: any;

    if (isPlatformAdminUser) {
      whereClause = {
        organization_id: null,
      };
    } else {
      whereClause = {
        organization_id: null,
        user_tenants: {
          some: {
            user_id: userId,
            role: { in: [user_tenant_role.OWNER, user_tenant_role.ADMIN] },
          },
        },
      };
    }

    const availableTenants = await prisma.tenants.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        created_at: true,
        _count: {
          select: {
            inventory_items: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(availableTenants);
  } catch (error: any) {
    logger.error('[Organizations] Available tenants error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_fetch_available_tenants' });
  }
});

// POST /organizations/:id/tenants/self - Self-service add tenant to organization
// Permission: Org admin + must be owner/admin of the tenant being added
const selfAddTenantSchema = z.object({
  tenantId: z.string().min(1),
});

router.post('/:id/tenants/self', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const parsed = selfAddTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const user = (req as any).user;
    const userId = user.userId || user.user_id;
    const { tenantId } = parsed.data;

    // 1. Verify the user is owner/admin of the tenant being added
    if (!isPlatformAdmin(user)) {
      const tenantRole = await getUserTenantRole(userId, tenantId);
      if (!tenantRole || (tenantRole !== user_tenant_role.OWNER && tenantRole !== user_tenant_role.ADMIN)) {
        return res.status(403).json({
          error: 'tenant_ownership_required',
          message: 'You must be an owner or admin of this location to add it to an organization',
        });
      }
    }

    // 2. Check the tenant isn't already in another organization
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, organization_id: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found', message: 'Location not found' });
    }

    if (tenant.organization_id && tenant.organization_id !== req.params.id) {
      return res.status(409).json({
        error: 'tenant_already_in_org',
        message: 'This location is already part of another organization',
      });
    }

    if (tenant.organization_id === req.params.id) {
      return res.status(409).json({
        error: 'tenant_already_in_this_org',
        message: 'This location is already in this organization',
      });
    }

    // 3. Check organization max_locations limit
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        max_locations: true,
        _count: { select: { tenants: true } },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'organization_not_found' });
    }

    if (organization._count.tenants >= organization.max_locations) {
      return res.status(400).json({
        error: 'max_locations_reached',
        message: `This organization has reached its maximum of ${organization.max_locations} locations`,
        maxLocations: organization.max_locations,
        currentLocations: organization._count.tenants,
      });
    }

    // 4. Add tenant to organization
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        organizations_list: {
          connect: { id: req.params.id },
        },
      },
    });

    res.json({
      id: tenant.id,
      name: tenant.name,
      message: `Successfully added "${tenant.name}" to "${organization.name}"`,
    });
  } catch (error: any) {
    logger.error('[Organizations] Self-service add tenant error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_add_tenant' });
  }
});

// DELETE /organizations/:id/tenants/:tenantId/self - Self-service remove tenant from organization
// Permission: Org admin + must be owner/admin of the tenant being removed
router.delete('/:id/tenants/:tenantId/self', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const user = (req as any).user;
    const userId = user.userId || user.user_id;
    const { tenantId } = req.params;

    // 1. Verify the user is owner/admin of the tenant being removed
    if (!isPlatformAdmin(user)) {
      const tenantRole = await getUserTenantRole(userId, tenantId);
      if (!tenantRole || (tenantRole !== user_tenant_role.OWNER && tenantRole !== user_tenant_role.ADMIN)) {
        return res.status(403).json({
          error: 'tenant_ownership_required',
          message: 'You must be an owner or admin of this location to remove it from an organization',
        });
      }
    }

    // 2. Verify tenant is in this organization
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, organization_id: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found', message: 'Location not found' });
    }

    if (tenant.organization_id !== req.params.id) {
      return res.status(400).json({
        error: 'tenant_not_in_org',
        message: 'This location is not part of this organization',
      });
    }

    // 3. Check if this is the hero location (don't allow removing hero)
    const tenantWithMetadata = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    if (tenantWithMetadata?.metadata && (tenantWithMetadata.metadata as any).isHeroLocation) {
      return res.status(400).json({
        error: 'cannot_remove_hero_location',
        message: 'Cannot remove the hero (primary) location. Set another location as hero first.',
      });
    }

    // 4. Check if this is the last tenant (don't allow removing the last one)
    const orgTenantCount = await prisma.tenants.count({
      where: { organization_id: req.params.id },
    });

    if (orgTenantCount <= 1) {
      return res.status(400).json({
        error: 'cannot_remove_last_location',
        message: 'Cannot remove the last location from an organization',
      });
    }

    // 5. Remove tenant from organization
    await prisma.tenants.update({
      where: { id: tenantId },
      data: { organization_id: null },
    });

    res.json({
      id: tenant.id,
      name: tenant.name,
      message: `Successfully removed "${tenant.name}" from the organization`,
    });
  } catch (error: any) {
    logger.error('[Organizations] Self-service remove tenant error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_remove_tenant' });
  }
});

// PATCH /organizations/:id/tenants/:tenantId/standing-mode - Update tenant standing mode
// Permission: Org admin — controls whether tenant inherits good standing from org or is independently billed
const updateStandingModeSchema = z.object({
  standingMode: z.enum(['independent', 'inherited']),
});

router.patch('/:id/tenants/:tenantId/standing-mode', authenticateToken, requireOrgAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = updateStandingModeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { tenantId } = req.params;
    const { standingMode } = parsed.data;

    // Verify tenant is in this organization
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, organization_id: true, org_standing_mode: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found', message: 'Location not found' });
    }

    if (tenant.organization_id !== req.params.id) {
      return res.status(400).json({
        error: 'tenant_not_in_org',
        message: 'This location is not part of this organization',
      });
    }

    // Update standing mode
    const updated = await prisma.tenants.update({
      where: { id: tenantId },
      data: { org_standing_mode: standingMode },
      select: {
        id: true,
        name: true,
        org_standing_mode: true,
        subscription_status: true,
        subscription_tier: true,
      },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      org_standing_mode: updated.org_standing_mode,
      message: `Standing mode for "${updated.name}" set to ${standingMode}.`,
    });
  } catch (error: any) {
    logger.error('[Organizations] Update standing mode error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_update_standing_mode' });
  }
});

// POST /organizations/:id/items/propagate - Propagate a single item to multiple tenants
const propagateSchema = z.object({
  sourceItemId: z.string().min(1),
  targetTenantIds: z.array(z.string()).min(1),
  mode: z.enum(['create_only', 'update_only', 'create_or_update']).optional().default('create_only'),
  overrides: z.object({
    price: z.number().optional(),
    stock: z.number().int().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    itemStatus: z.enum(['active', 'inactive']).optional(),
  }).optional(),
});

// POST /organizations/:id/items/propagate - Propagate item to tenants
// Permission: Tenant admin (Starter tier+, 2+ locations required)
router.post('/:id/items/propagate', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const parsed = propagateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { sourceItemId, targetTenantIds, mode, overrides } = parsed.data;

    // Verify organization exists and get tier info
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
      include: {
        tenants: {
          select: { id: true },
        },
      },
    });

    if (!organization) {
      return res.status(400).json({ 
        error: 'organization_not_found',
        message: 'Organization not found'
      });
    }

    // Check if organization has required tier for propagation (dynamic validation)
    const orgTier = organization.subscription_tier || 'chain_starter';
    const minTierForPropagation = await TierService.getMinimumTierForFeature('propagation');
    if (!minTierForPropagation) {
      return res.status(403).json({
        error: 'feature_not_available',
        message: 'Propagation feature is not available in current configuration',
        currentTier: orgTier
      });
    }

    // Get all valid tiers and check if current tier meets or exceeds minimum requirement
    const allTiers = await TierService.getAllTiers();
    const validTiers = allTiers
      .filter(tier => tier.is_active)
      .map(tier => tier.tier_key)
      .filter(tierKey => {
        // Check if this tier is equal to or higher than the minimum tier
        const tier = allTiers.find(t => t.tier_key === tierKey);
        const minTier = allTiers.find(t => t.tier_key === minTierForPropagation);
        if (!minTier) return false;
        
        // Compare by sort_order (lower number = higher tier)
        return (tier?.sort_order || 999) <= (minTier?.sort_order || 999);
      });

    if (!validTiers.includes(orgTier)) {
      return res.status(403).json({
        error: 'insufficient_tier',
        message: `Propagation requires ${minTierForPropagation} tier or higher`,
        currentTier: orgTier,
        minimumTier: minTierForPropagation,
        availableTiers: validTiers
      });
    }

    // Check if organization has 2+ locations
    if (organization.tenants.length < 2) {
      return res.status(403).json({
        error: 'insufficient_locations',
        message: 'Propagation requires 2 or more locations',
        currentLocations: organization.tenants.length,
        requiredLocations: 2
      });
    }

    // Verify all target tenants belong to this organization
    const orgTenantIds = organization.tenants.map(t => t.id);
    const invalidTenants = targetTenantIds.filter(id => !orgTenantIds.includes(id));
    if (invalidTenants.length > 0) {
      return res.status(400).json({ 
        error: 'invalid_target_tenants',
        message: 'Some target tenants do not belong to this organization',
        invalidTenants,
      });
    }

    // Get source item with slug registry
    const sourceItem = await prisma.inventory_items.findUnique({
      where: { id: sourceItemId },
      include: {
        photo_assets: true,
      },
    });

    // Get source item's slug registry entry if exists
    const sourceSlugRegistry = sourceItem ? await prisma.product_slug_registry.findFirst({
      where: {
        tenant_id: sourceItem.tenant_id,
        original_sku: sourceItem.sku,
      },
    }) : null;

    if (!sourceItem) {
      return res.status(400).json({ 
        error: 'source_item_not_found',
        message: 'Source item not found'
      });
    }

    // Verify source item's tenant is in this organization
    if (!orgTenantIds.includes(sourceItem.tenant_id)) {
      return res.status(400).json({ 
        error: 'source_item_not_in_organization',
        message: 'Source item does not belong to this organization',
      });
    }

    // Propagate to each target tenant
    const results = {
      created: [] as string[],
      updated: [] as string[],
      skipped: [] as Array<{ tenantId: string; reason: string }>,
      errors: [] as Array<{ tenantId: string; error: string }>,
    };

    for (const tenantId of targetTenantIds) {
      try {
        // Skip if it's the source tenant
        if (tenantId === sourceItem.tenant_id) {
          results.skipped.push({ tenantId, reason: 'source_tenant' });
          continue;
        }

        // Check if target tenant's tier allows the source item's product type
        const sourceProductType = sourceItem.product_type || 'physical';
        try {
          const productTypeService = ProductTypeService.getInstance();
          const allowed = await productTypeService.isProductTypeAllowed(tenantId, sourceProductType as any);
          if (!allowed) {
            results.skipped.push({ tenantId, reason: `product_type_not_allowed: ${sourceProductType}` });
            continue;
          }
        } catch (capError) {
          logger.error(`[Organizations] Product type capability check failed for tenant ${tenantId}:`, undefined, { error: { name: (capError as any)?.name || 'Error', message: (capError as any)?.message || String(capError), stack: (capError as any)?.stack } });
        }

        // Check if SKU already exists for this tenant
        const existing = await prisma.inventory_items.findFirst({
          where: {
            tenant_id: tenantId,
            sku: sourceItem.sku,
          },
        });

        // Handle based on mode
        if (existing) {
          console.log(`[Organizations] Found existing item: ${existing.id}, has_variants=${existing.has_variants}, sku=${existing.sku}`);
          console.log(`[Organizations] Source item has_variants=${sourceItem.has_variants} vs existing has_variants=${existing.has_variants}`);
          if (mode === 'create_only') {
            results.skipped.push({ tenantId, reason: 'sku_already_exists' });
            continue;
          }
          
          // Ensure category exists for target tenant before updating
          const targetCategoryId = await ensureCategoryForTargetTenant(
            sourceItem.directory_category_id,
            tenantId
          );
          
          // Update mode - update existing item
          const updatedItem = await prisma.inventory_items.update({
            where: { id: existing.id },
            data: {
              name: sourceItem.name,
              price_cents: overrides?.price !== undefined ? Math.round(overrides.price * 100) : sourceItem.price_cents,
              stock: overrides?.stock !== undefined ? overrides.stock : sourceItem.stock,
              image_url: sourceItem.image_url, 
              metadata: sourceItem.metadata as any,
              marketing_description: sourceItem.marketing_description,
              image_gallery: sourceItem.image_gallery,
              custom_cta: sourceItem.custom_cta as any,
              social_links: sourceItem.social_links as any,
              custom_branding: sourceItem.custom_branding as any,
              custom_sections: sourceItem.custom_sections as any,
              landing_page_theme: sourceItem.landing_page_theme,
              audit_log_id: sourceItem.audit_log_id,
              availability: sourceItem.availability,
              brand: sourceItem.brand,
              category_path: sourceItem.category_path,
              directory_category_id: targetCategoryId,
              condition: sourceItem.condition,
              currency: sourceItem.currency,
              description: sourceItem.description,
              eligibility_reason: sourceItem.eligibility_reason,
              gtin: sourceItem.gtin,
              item_status: overrides?.itemStatus || sourceItem.item_status,
              location_id: sourceItem.location_id,
              merchant_name: sourceItem.merchant_name,
              mpn: sourceItem.mpn,
              price: overrides?.price !== undefined ? overrides.price : sourceItem.price,
              quantity: overrides?.stock !== undefined ? overrides.stock : sourceItem.quantity,
              sync_status: sourceItem.sync_status,
              synced_at: sourceItem.synced_at,
              title: sourceItem.title,
              visibility: overrides?.visibility || sourceItem.visibility,
              manufacturer: sourceItem.manufacturer,
              source: sourceItem.source,
              enrichment_status: sourceItem.enrichment_status,
              enriched_at: sourceItem.enriched_at,
              enriched_by: sourceItem.enriched_by,
              enriched_from_barcode: sourceItem.enriched_from_barcode,
              missing_images: sourceItem.missing_images,
              missing_description: sourceItem.missing_description,
              missing_specs: sourceItem.missing_specs,
              missing_brand: sourceItem.missing_brand,
              sale_price_cents: sourceItem.sale_price_cents,
              payment_gateway_type: sourceItem.payment_gateway_type,
              payment_gateway_id: sourceItem.payment_gateway_id,
              product_type: sourceItem.product_type,
              digital_delivery_method: sourceItem.digital_delivery_method,
              digital_assets: sourceItem.digital_assets as any,
              access_duration_days: sourceItem.access_duration_days,
              download_limit: sourceItem.download_limit,
              license_type: sourceItem.license_type,
              // Add enriched content fields
              features: sourceItem.features,
              specifications: sourceItem.specifications as any,
              enhanced_description: sourceItem.enhanced_description,
              has_variants: sourceItem.has_variants,
              is_featured: sourceItem.is_featured,
              featured_at: sourceItem.featured_at,
              featured_until: sourceItem.featured_until,
              featured_priority: sourceItem.featured_priority,
              featured_type: sourceItem.featured_type,
            },
          });

          // Update slug registry entry if exists
          if (sourceSlugRegistry) {
            await prisma.product_slug_registry.upsert({
              where: {
                product_slug: sourceSlugRegistry.product_slug,
              },
              update: {
                tenant_id: tenantId,
                original_sku: sourceItem.sku,
              },
              create: {
                id: `psr-${generateTenantItemId(tenantId)}`,
                product_slug: sourceSlugRegistry.product_slug,
                universal_sku: sourceSlugRegistry.universal_sku,
                slug_hash: sourceSlugRegistry.slug_hash,
                tenant_id: tenantId,
                original_sku: sourceItem.sku,
                created_at: new Date(),
              },
            });
          }

          // Delete old photos and copy new ones
          await prisma.photo_assets.deleteMany({
            where: { inventoryItemId: existing.id },
          });

          if (sourceItem.photo_assets && sourceItem.photo_assets.length > 0) {
            await prisma.photo_assets.createMany({
              data: sourceItem.photo_assets.map((photo: any, index: number) => ({
                id: generatePhotoId(tenantId,updatedItem.id),
                tenantId: tenantId,
                inventoryItemId: updatedItem.id,
                url: photo.url,
                width: photo.width,
                height: photo.height,
                contentType: photo.contentType,
                bytes: photo.bytes,
                position: photo.position !== undefined ? photo.position : index,
                alt: photo.alt,
                caption: photo.caption,
              })),
            });
          }

          // Ensure global catalog entry exists for availability system
          try {
            const hasGlobalEntry = await hasGlobalCatalogEntry(sourceItem.sku);
            if (!hasGlobalEntry) {
              console.log(`[Organizations] Creating global catalog entry for SKU: ${sourceItem.sku}`);
              
              // Fetch variants if source item has them
              let variants: Array<{
                sku: string;
                variant_name: string;
                price_cents: number | null;
                attributes: Record<string, any> | null;
              }> = [];
              if (sourceItem.has_variants) {
                const rawVariants = await prisma.product_variants.findMany({
                  where: { parent_item_id: sourceItem.id },
                  select: {
                    sku: true,
                    variant_name: true,
                    price_cents: true,
                    attributes: true
                  },
                  orderBy: [
                    { sort_order: 'asc' },
                    { created_at: 'asc' }
                  ]
                });
                  
                // Cast JsonValue to expected type
                variants = rawVariants.map(v => ({
                  sku: v.sku,
                  variant_name: v.variant_name,
                  price_cents: v.price_cents,
                  attributes: (v.attributes as Record<string, any>) || null
                }));
              }
              
              await ensureGlobalCatalogEntry({
                id: existing.id,
                tenant_id: tenantId,
                sku: sourceItem.sku,
                name: sourceItem.name,
                description: sourceItem.description || undefined,
                brand: sourceItem.brand || undefined,
                category_path: sourceItem.category_path || undefined,
                gtin: sourceItem.gtin || undefined,
                price_cents: sourceItem.price_cents || undefined,
                image_url: sourceItem.image_url || undefined,
                has_variants: sourceItem.has_variants || false,
                variants: variants.map(v => ({
                  sku: v.sku,
                  name: v.variant_name,
                  price_cents: v.price_cents,
                  attributes: (v.attributes as Record<string, any>) || {}
                }))
              });
              console.log(`[Organizations] Global catalog entry created for SKU: ${sourceItem.sku} with ${variants.length} variants`);
            } else {
              console.log(`[Organizations] Global catalog entry already exists for SKU: ${sourceItem.sku}`);
            }
          } catch (error) {
            logger.error(`[Organizations] Failed to create global catalog entry for SKU ${sourceItem.sku}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
            // Don't fail the propagation, just log the error
          }

          // Propagate variants if source item has them
          if (sourceItem.has_variants) {
            console.log(`[Organizations] UPDATE MODE: Propagating variants for source ${sourceItem.id} -> existing ${existing.id} (tenant: ${tenantId})`);
            console.log(`[Organizations] UPDATE MODE: Source item has_variants: ${sourceItem.has_variants}`);
            console.log(`[Organizations] UPDATE MODE: Existing parent item ID: ${existing.id}`);
            
            const variantResult = await propagateVariants(
              sourceItem.id,
              tenantId,
              undefined, // newItemId is not provided for update mode
              existing.id,
              sourceItem.directory_category_id,
              'update'
            );
            
            console.log(`[Organizations] UPDATE MODE: Variant propagation result: created=${variantResult.created}, errors=${variantResult.errors.length}`);
            
            if (variantResult.errors.length > 0) {
              logger.error(`[Organizations] Variant propagation errors for ${updatedItem.id}:`, undefined, { error: { name: 'Error', message: String(variantResult.errors) } });
            }
            
            // Verify the parent item still has has_variants set correctly after update
            const verifyParent = await prisma.inventory_items.findUnique({
              where: { id: existing.id },
              select: { id: true, has_variants: true, sku: true }
            });
            console.log(`[Organizations] UPDATE MODE: Parent item verification: ${verifyParent?.id}, has_variants=${verifyParent?.has_variants}`);
          }

          results.updated.push(tenantId);
          continue;
        }

        // Item doesn't exist
        if (mode === 'update_only') {
          results.skipped.push({ tenantId, reason: 'sku_does_not_exist' });
          continue;
        }

        // Ensure category exists for target tenant before creating
        const targetCategoryId = await ensureCategoryForTargetTenant(
          sourceItem.directory_category_id,
          tenantId
        );

        // Create mode - create new item
        const newItem = await prisma.inventory_items.create({
          data: {
            id: generateTenantItemId(tenantId),
            tenant_id: tenantId,
            sku: sourceItem.sku,
            name: sourceItem.name,
            price_cents: overrides?.price !== undefined ? Math.round(overrides.price * 100) : sourceItem.price_cents,
            stock: overrides?.stock !== undefined ? overrides.stock : sourceItem.stock,
            image_url: sourceItem.image_url,
            metadata: sourceItem.metadata as any,
            updated_at: new Date(),
            marketing_description: sourceItem.marketing_description,
            image_gallery: sourceItem.image_gallery, 
            custom_cta: sourceItem.custom_cta as any,
            social_links: sourceItem.social_links as any,
            custom_branding: sourceItem.custom_branding as any,
            custom_sections: sourceItem.custom_sections as any,
            landing_page_theme: sourceItem.landing_page_theme,
            audit_log_id: sourceItem.audit_log_id,
            availability: sourceItem.availability,
            brand: sourceItem.brand,
            category_path: sourceItem.category_path,
            directory_category_id: targetCategoryId,            
            condition: sourceItem.condition,
            currency: sourceItem.currency,
            description: sourceItem.description,
            eligibility_reason: sourceItem.eligibility_reason,
            gtin: sourceItem.gtin,
            item_status: overrides?.itemStatus || sourceItem.item_status,
            location_id: sourceItem.location_id,
            merchant_name: sourceItem.merchant_name,
            mpn: sourceItem.mpn,
            price: overrides?.price !== undefined ? overrides.price : sourceItem.price,
            quantity: overrides?.stock !== undefined ? overrides.stock : sourceItem.quantity,
            sync_status: sourceItem.sync_status,
            synced_at: sourceItem.synced_at,
            title: sourceItem.title,
            visibility: overrides?.visibility || sourceItem.visibility,
            manufacturer: sourceItem.manufacturer,
            source: sourceItem.source,
            enrichment_status: sourceItem.enrichment_status,
            enriched_at: sourceItem.enriched_at,
            enriched_by: sourceItem.enriched_by,
            enriched_from_barcode: sourceItem.enriched_from_barcode,
            missing_images: sourceItem.missing_images,
            missing_description: sourceItem.missing_description,
            missing_specs: sourceItem.missing_specs,
            missing_brand: sourceItem.missing_brand,
            sale_price_cents: sourceItem.sale_price_cents,
            payment_gateway_type: sourceItem.payment_gateway_type,
            payment_gateway_id: sourceItem.payment_gateway_id,
            product_type: sourceItem.product_type,
            digital_delivery_method: sourceItem.digital_delivery_method,
            digital_assets: sourceItem.digital_assets as any,
            access_duration_days: sourceItem.access_duration_days,
            download_limit: sourceItem.download_limit,
            license_type: sourceItem.license_type,
            // Add enriched content fields
            features: sourceItem.features,
            specifications: sourceItem.specifications as any,
            enhanced_description: sourceItem.enhanced_description,
            has_variants: sourceItem.has_variants,
            is_featured: sourceItem.is_featured,
            featured_at: sourceItem.featured_at,
            featured_until: sourceItem.featured_until,
            featured_priority: sourceItem.featured_priority,
            featured_type: sourceItem.featured_type,
          },
        });

        // Create slug registry entry if source has one
        if (sourceSlugRegistry) {
          await prisma.product_slug_registry.upsert({
            where: {
              product_slug: sourceSlugRegistry.product_slug,
            },
            update: {
              universal_sku: sourceSlugRegistry.universal_sku,
              slug_hash: sourceSlugRegistry.slug_hash,
              tenant_id: tenantId,
              original_sku: sourceItem.sku,
            },
            create: {
              id: `psr-${generateTenantItemId(tenantId)}`,
              product_slug: sourceSlugRegistry.product_slug,
              universal_sku: sourceSlugRegistry.universal_sku,
              slug_hash: sourceSlugRegistry.slug_hash,
              tenant_id: tenantId,
              original_sku: sourceItem.sku,
              created_at: new Date(),
            },
          });
        }

        // Copy photos if any
        if (sourceItem.photo_assets && sourceItem.photo_assets.length > 0) {
          await prisma.photo_assets.createMany({
            data: sourceItem.photo_assets.map((photo: any, index: number) => ({
              id: generatePhotoId(tenantId,newItem.id),
              tenantId: tenantId,
              inventoryItemId: newItem.id,
              url: photo.url,
              width: photo.width,
              height: photo.height,
              contentType: photo.contentType,
              bytes: photo.bytes,
              position: photo.position !== undefined ? photo.position : index,
              alt: photo.alt,
              caption: photo.caption,
            })),
          });
        }

        // Propagate variants if source item has them
        if (sourceItem.has_variants) {
          console.log(`[Organizations] Propagating variants for source ${sourceItem.id} -> target ${newItem.id} (tenant: ${tenantId})`);
          console.log(`[Organizations] Source item has_variants: ${sourceItem.has_variants}`);
          console.log(`[Organizations] Target parent item ID: ${newItem.id}`);
          
          const variantResult = await propagateVariants(
            sourceItem.id,
            tenantId,
            newItem.id,
            undefined, // newItemId is provided for create mode
            sourceItem.directory_category_id,
            'create'
          );
          
          console.log(`[Organizations] Variant propagation result: created=${variantResult.created}, errors=${variantResult.errors.length}`);
          
          if (variantResult.errors.length > 0) {
            logger.error(`[Organizations] Variant propagation errors for ${newItem.id}:`, undefined, { error: { name: 'Error', message: String(variantResult.errors) } });
          }
          
          // Verify the parent item still has has_variants set correctly
          const verifyParent = await prisma.inventory_items.findUnique({
            where: { id: newItem.id },
            select: { id: true, has_variants: true, sku: true }
          });
          console.log(`[Organizations] Parent item verification: ${verifyParent?.id}, has_variants=${verifyParent?.has_variants}`);
        }

        results.created.push(tenantId);
      } catch (error: any) {
        logger.error(`[Organizations] Error propagating to tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        results.errors.push({ tenantId, error: error.message });
      }
    }

    res.json({
      success: true,
      sourceItemId,
      results,
      summary: {
        total: targetTenantIds.length,
        created: results.created.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
    });
  } catch (error: any) {
    logger.error('[Organizations] Propagate item error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_propagate_item', message: error.message });
  }
});

// POST /organizations/:id/items/propagate-bulk - Bulk propagate multiple items
const propagateBulkSchema = z.object({
  sourceItemIds: z.array(z.string()).min(1),
  targetTenantIds: z.array(z.string()).min(1),
  mode: z.enum(['create_only', 'update_only', 'create_or_update']).optional().default('create_only'),
  overrides: z.object({
    price: z.number().optional(),
    stock: z.number().int().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    itemStatus: z.enum(['active', 'inactive']).optional(),
  }).optional(),
});

// POST /organizations/:id/items/propagate-bulk - Bulk propagate items
// Permission: Authenticated user with propagation rights (tier validation done inline)
router.post('/:id/items/propagate-bulk', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const parsed = propagateBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { sourceItemIds, targetTenantIds, mode, overrides } = parsed.data;

    // Verify organization exists and get tier info
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
      include: {
        tenants: {
          select: { id: true },
        },
      },
    });

    if (!organization) {
      return res.status(400).json({ 
        error: 'organization_not_found',
        message: 'Organization not found'
      });
    }

    // Check if organization has required tier for propagation (dynamic validation)
    const orgTier = organization.subscription_tier || 'chain_starter';
    const minTierForPropagation = await TierService.getMinimumTierForFeature('propagation');
    if (!minTierForPropagation) {
      return res.status(403).json({
        error: 'feature_not_available',
        message: 'Propagation feature is not available in current configuration',
        currentTier: orgTier
      });
    }

    // Get all valid tiers and check if current tier meets or exceeds minimum requirement
    const allTiers = await TierService.getAllTiers();
    const validTiers = allTiers
      .filter(tier => tier.is_active)
      .map(tier => tier.tier_key)
      .filter(tierKey => {
        // Check if this tier is equal to or higher than the minimum tier
        const tier = allTiers.find(t => t.tier_key === tierKey);
        const minTier = allTiers.find(t => t.tier_key === minTierForPropagation);
        if (!minTier) return false;
        
        // Compare by sort_order (lower number = higher tier)
        return (tier?.sort_order || 999) <= (minTier?.sort_order || 999);
      });

    if (!validTiers.includes(orgTier)) {
      return res.status(403).json({
        error: 'insufficient_tier',
        message: `Propagation requires ${minTierForPropagation} tier or higher`,
        currentTier: orgTier,
        minimumTier: minTierForPropagation,
        availableTiers: validTiers
      });
    }

    // Check if organization has 2+ locations
    if (organization.tenants.length < 2) {
      return res.status(403).json({
        error: 'insufficient_locations',
        message: 'Propagation requires 2 or more locations',
        currentLocations: organization.tenants.length,
        requiredLocations: 2
      });
    }

    // Verify all target tenants belong to this organization
    const orgTenantIds = organization.tenants.map(t => t.id);
    const invalidTenants = targetTenantIds.filter(id => !orgTenantIds.includes(id));
    if (invalidTenants.length > 0) {
      return res.status(400).json({ 
        error: 'invalid_target_tenants',
        message: 'Some target tenants do not belong to this organization',
        invalidTenants,
      });
    }

    // Get all source items
    const sourceItems = await prisma.inventory_items.findMany({
      where: { 
        id: { in: sourceItemIds },
      },
      select: {
        id: true,
        tenant_id: true,
        sku: true,
        name: true,
        price_cents: true,
        stock: true,
        image_url: true,
        metadata: true,
        marketing_description: true,
        image_gallery: true,
        custom_cta: true,
        social_links: true,
        custom_branding: true,
        custom_sections: true,
        landing_page_theme: true,
        audit_log_id: true,
        availability: true,
        brand: true,
        category_path: true,
        directory_category_id: true,
        condition: true,
        currency: true,
        description: true,
        eligibility_reason: true,
        gtin: true,
        item_status: true,
        location_id: true,
        merchant_name: true,
        mpn: true,
        price: true,
        quantity: true,
        sync_status: true,
        synced_at: true,
        title: true,
        visibility: true,
        manufacturer: true,
        source: true,
        enrichment_status: true,
        enriched_at: true,
        enriched_by: true,
        enriched_from_barcode: true,
        missing_images: true,
        missing_description: true,
        missing_specs: true,
        missing_brand: true,
        sale_price_cents: true,
        payment_gateway_type: true,
        payment_gateway_id: true,
        product_type: true,
        digital_delivery_method: true,
        digital_assets: true,
        access_duration_days: true,
        download_limit: true,
        license_type: true,
        // Add enriched content fields
        features: true,
        specifications: true,
        enhanced_description: true,
        has_variants: true,
        is_featured: true,
        featured_at: true,
        featured_until: true,
        featured_priority: true,
        featured_type: true,
        photo_assets: {
          select: {
            id: true,
            url: true,
            width: true,
            height: true,
            contentType: true,
            bytes: true,
            position: true,
            alt: true,
            caption: true,
          },
        },
      },
    });

    // Get all source slug registry entries
    const sourceSlugRegistries = await prisma.product_slug_registry.findMany({
      where: {
        tenant_id: { in: sourceItems.map(item => item.tenant_id) },
        original_sku: { in: sourceItems.map(item => item.sku) },
      },
    });

    // Create a map for quick lookup
    const slugRegistryMap = new Map(
      sourceSlugRegistries.map(registry => [`${registry.tenant_id}-${registry.original_sku}`, registry])
    );

    if (sourceItems.length === 0) {
      return res.status(400).json({ 
        error: 'no_source_items_found',
        message: 'No source items found'
      });
    }

    // Verify all source items belong to this organization
    const invalidSourceItems = sourceItems.filter(item => !orgTenantIds.includes(item.tenant_id));
    if (invalidSourceItems.length > 0) {
      return res.status(400).json({ 
        error: 'source_items_not_in_organization',
        message: 'Some source items do not belong to this organization',
      });
    }

    // Propagate each item to each target tenant
    const results = {
      created: [] as Array<{ item_id: string; tenantId: string; sku: string }>,
      updated: [] as Array<{ item_id: string; tenantId: string; sku: string }>,
      skipped: [] as Array<{ item_id: string; tenantId: string; sku: string; reason: string }>,
      errors: [] as Array<{ item_id: string; tenantId: string; sku: string; error: string }>,
    };

    for (const sourceItem of sourceItems) {
      for (const tenantId of targetTenantIds) {
        try {
          // Skip if it's the source tenant
          if (tenantId === sourceItem.tenant_id) {
            results.skipped.push({ 
              item_id: sourceItem.id, 
              tenantId, 
              sku: sourceItem.sku,
              reason: 'source_tenant' 
            });
            continue;
          }

          // Check if target tenant's tier allows the source item's product type
          const sourceProductType = sourceItem.product_type || 'physical';
          try {
            const productTypeService = ProductTypeService.getInstance();
            const allowed = await productTypeService.isProductTypeAllowed(tenantId, sourceProductType as any);
            if (!allowed) {
              results.skipped.push({ 
                item_id: sourceItem.id, 
                tenantId, 
                sku: sourceItem.sku,
                reason: `product_type_not_allowed: ${sourceProductType}` 
              });
              continue;
            }
          } catch (capError) {
            logger.error(`[Organizations] Product type capability check failed for tenant ${tenantId}:`, undefined, { error: { name: (capError as any)?.name || 'Error', message: (capError as any)?.message || String(capError), stack: (capError as any)?.stack } });
          }

          // Check if SKU already exists for this tenant
          const existing = await prisma.inventory_items.findFirst({
            where: {
              tenant_id: tenantId,
              sku: sourceItem.sku,
            },
          });

          // Handle based on mode
          if (existing) {
            if (mode === 'create_only') {
              results.skipped.push({ 
                item_id: sourceItem.id, 
                tenantId, 
                sku: sourceItem.sku,
                reason: 'sku_already_exists' 
              });
              continue;
            }
            
            // Ensure category exists for target tenant before updating
            const targetCategoryId = await ensureCategoryForTargetTenant(
              sourceItem.directory_category_id,
              tenantId
            );

            // Update slug registry entry if exists
            const sourceSlugRegistry = slugRegistryMap.get(`${sourceItem.tenant_id}-${sourceItem.sku}`);
            if (sourceSlugRegistry) {
              await prisma.product_slug_registry.upsert({
                where: {
                  product_slug: sourceSlugRegistry.product_slug,
                },
                update: {
                  tenant_id: tenantId,
                  original_sku: sourceItem.sku,
                },
                create: {
                  id: `psr-${generateTenantItemId(tenantId)}`,
                  product_slug: sourceSlugRegistry.product_slug,
                  universal_sku: sourceSlugRegistry.universal_sku,
                  slug_hash: sourceSlugRegistry.slug_hash,
                  tenant_id: tenantId,
                  original_sku: sourceItem.sku,
                  created_at: new Date(),
                },
              });
            }
            
            // Update mode - update existing item
            const updatedItem = await prisma.inventory_items.update({
              where: { id: existing.id },
              data: {
                name: sourceItem.name,
                price_cents: overrides?.price !== undefined ? Math.round(overrides.price * 100) : sourceItem.price_cents,
                stock: overrides?.stock !== undefined ? overrides.stock : sourceItem.stock,
                image_url: sourceItem.image_url, 
                metadata: sourceItem.metadata as any,
                marketing_description: sourceItem.marketing_description,
                image_gallery: sourceItem.image_gallery,
                custom_cta: sourceItem.custom_cta as any,
                social_links: sourceItem.social_links as any,
                custom_branding: sourceItem.custom_branding as any,
                custom_sections: sourceItem.custom_sections as any,
                landing_page_theme: sourceItem.landing_page_theme,
                audit_log_id: sourceItem.audit_log_id,
                availability: sourceItem.availability,
                brand: sourceItem.brand,
                category_path: sourceItem.category_path,
                directory_category_id: targetCategoryId,
                condition: sourceItem.condition,
                currency: sourceItem.currency,
                description: sourceItem.description,
                eligibility_reason: sourceItem.eligibility_reason,
                gtin: sourceItem.gtin,
                item_status: overrides?.itemStatus || sourceItem.item_status,
                location_id: sourceItem.location_id,
                merchant_name: sourceItem.merchant_name,
                mpn: sourceItem.mpn,
                price: overrides?.price !== undefined ? overrides.price : sourceItem.price,
                quantity: overrides?.stock !== undefined ? overrides.stock : sourceItem.quantity,
                sync_status: sourceItem.sync_status,
                synced_at: sourceItem.synced_at,
                title: sourceItem.title,
                visibility: overrides?.visibility || sourceItem.visibility,
                manufacturer: sourceItem.manufacturer,
                source: sourceItem.source,
                enrichment_status: sourceItem.enrichment_status,
                enriched_at: sourceItem.enriched_at,
                enriched_by: sourceItem.enriched_by,
                enriched_from_barcode: sourceItem.enriched_from_barcode,
                missing_images: sourceItem.missing_images,
                missing_description: sourceItem.missing_description,
                missing_specs: sourceItem.missing_specs,
                missing_brand: sourceItem.missing_brand,
                sale_price_cents: sourceItem.sale_price_cents,
                payment_gateway_type: sourceItem.payment_gateway_type,
                payment_gateway_id: sourceItem.payment_gateway_id,
                product_type: sourceItem.product_type,
                digital_delivery_method: sourceItem.digital_delivery_method,
                digital_assets: sourceItem.digital_assets as any,
                access_duration_days: sourceItem.access_duration_days,
                download_limit: sourceItem.download_limit,
                license_type: sourceItem.license_type,
                // Add enriched content fields for propagation
                features: sourceItem.features,
                specifications: sourceItem.specifications as any,
                enhanced_description: sourceItem.enhanced_description,
                has_variants: sourceItem.has_variants,
                is_featured: sourceItem.is_featured,
                featured_at: sourceItem.featured_at,
                featured_until: sourceItem.featured_until,
                featured_priority: sourceItem.featured_priority,
                featured_type: sourceItem.featured_type,
                updated_at: new Date(),
              },
            });

            // Delete old photos and copy new ones
            await prisma.photo_assets.deleteMany({
              where: { inventoryItemId: existing.id },
            });

            if (sourceItem.photo_assets && sourceItem.photo_assets.length > 0) {
              await prisma.photo_assets.createMany({
                data: sourceItem.photo_assets.map((photo: any, index: number) => ({
                  id: generatePhotoId(tenantId, updatedItem.id),
                  tenantId: tenantId,
                  inventoryItemId: updatedItem.id,
                  url: photo.url,
                  width: photo.width,
                  height: photo.height,
                  contentType: photo.contentType,
                  bytes: photo.bytes,
                  position: photo.position !== undefined ? photo.position : index,
                  alt: photo.alt,
                  caption: photo.caption,
                })),
              });
            }

            // Ensure global catalog entry exists for availability system
            try {
              const hasGlobalEntry = await hasGlobalCatalogEntry(sourceItem.sku);
              if (!hasGlobalEntry) {
                console.log(`[Organizations] Creating global catalog entry for SKU: ${sourceItem.sku}`);
                
                // Fetch variants if source item has them
                let variants: Array<{
                  sku: string;
                  variant_name: string;
                  price_cents: number | null;
                  attributes: Record<string, any> | null;
                }> = [];
                if (sourceItem.has_variants) {
                  const rawVariants = await prisma.product_variants.findMany({
                    where: { parent_item_id: sourceItem.id },
                    select: {
                      sku: true,
                      variant_name: true,
                      price_cents: true,
                      attributes: true
                    },
                    orderBy: [
                      { sort_order: 'asc' },
                      { created_at: 'asc' }
                    ]
                  });
                  
                  // Cast JsonValue to expected type
                  variants = rawVariants.map(v => ({
                    sku: v.sku,
                    variant_name: v.variant_name,
                    price_cents: v.price_cents,
                    attributes: (v.attributes as Record<string, any>) || null
                  }));
                }
                
                await ensureGlobalCatalogEntry({
                  id: existing.id,
                  tenant_id: tenantId,
                  sku: sourceItem.sku,
                  name: sourceItem.name,
                  description: sourceItem.description || undefined,
                  brand: sourceItem.brand || undefined,
                  category_path: sourceItem.category_path || undefined,
                  gtin: sourceItem.gtin || undefined,
                  price_cents: sourceItem.price_cents || undefined,
                  image_url: sourceItem.image_url || undefined,
                  has_variants: sourceItem.has_variants || false,
                  variants: variants.map(v => ({
                    sku: v.sku,
                    name: v.variant_name,
                    price_cents: v.price_cents,
                    attributes: (v.attributes as Record<string, any>) || {}
                  }))
                });
                console.log(`[Organizations] Global catalog entry created for SKU: ${sourceItem.sku} with ${variants.length} variants`);
              } else {
                console.log(`[Organizations] Global catalog entry already exists for SKU: ${sourceItem.sku}`);
              }
            } catch (error) {
              logger.error(`[Organizations] Failed to create global catalog entry for SKU ${sourceItem.sku}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
              // Don't fail the propagation, just log the error
            }

            // Propagate variants if source item has them (MISSING IN BULK UPDATE!)
            if (sourceItem.has_variants) {
              console.log(`[Organizations] BULK UPDATE MODE: Propagating variants for source ${sourceItem.id} -> existing ${existing.id} (tenant: ${tenantId})`);
              console.log(`[Organizations] BULK UPDATE MODE: Source item has_variants: ${sourceItem.has_variants}`);
              console.log(`[Organizations] BULK UPDATE MODE: Existing parent item ID: ${existing.id}`);
              
              const variantResult = await propagateVariants(
                sourceItem.id,
                tenantId,
                undefined, // newItemId is not provided for update mode
                existing.id,
                sourceItem.directory_category_id,
                'update'
              );
              
              console.log(`[Organizations] BULK UPDATE MODE: Variant propagation result: created=${variantResult.created}, errors=${variantResult.errors.length}`);
              
              if (variantResult.errors.length > 0) {
                logger.error(`[Organizations] BULK UPDATE MODE: Variant propagation errors for ${existing.id}:`, undefined, { error: { name: 'Error', message: String(variantResult.errors) } });
              }
              
              // Verify the parent item still has has_variants set correctly after update
              const verifyParent = await prisma.inventory_items.findUnique({
                where: { id: existing.id },
                select: { id: true, has_variants: true, sku: true }
              });
              console.log(`[Organizations] BULK UPDATE MODE: Parent item verification: ${verifyParent?.id}, has_variants=${verifyParent?.has_variants}`);
            }

            results.updated.push({ 
              item_id: sourceItem.id, 
              tenantId, 
              sku: sourceItem.sku
            });
            continue;
          }

          // Item doesn't exist - check if mode allows creation
          if (mode === 'update_only') {
            results.skipped.push({ 
              item_id: sourceItem.id, 
              tenantId, 
              sku: sourceItem.sku,
              reason: 'item_not_found' 
            });
            continue;
          }

          // Ensure category exists for target tenant before creating
          const targetCategoryId = await ensureCategoryForTargetTenant(
            sourceItem.directory_category_id,
            tenantId
          );

          // Create the item for this tenant
          const newItem = await prisma.inventory_items.create({
            data: {
              id: generateTenantItemId(tenantId),
              tenant_id: tenantId,
            sku: sourceItem.sku,
            name: sourceItem.name,
            price_cents: overrides?.price !== undefined ? Math.round(overrides.price * 100) : sourceItem.price_cents,
            stock: overrides?.stock !== undefined ? overrides.stock : sourceItem.stock,
            image_url: sourceItem.image_url,
            metadata: sourceItem.metadata as any,
            updated_at: new Date(),
            marketing_description: sourceItem.marketing_description,
            image_gallery: sourceItem.image_gallery, 
            custom_cta: sourceItem.custom_cta as any,
            social_links: sourceItem.social_links as any,
            custom_branding: sourceItem.custom_branding as any,
            custom_sections: sourceItem.custom_sections as any,
            landing_page_theme: sourceItem.landing_page_theme,
            audit_log_id: sourceItem.audit_log_id,
            availability: sourceItem.availability,
            brand: sourceItem.brand,
            category_path: sourceItem.category_path,
            directory_category_id: targetCategoryId,            
            condition: sourceItem.condition,
            currency: sourceItem.currency,
            description: sourceItem.description,
            eligibility_reason: sourceItem.eligibility_reason,
            gtin: sourceItem.gtin,
            item_status: overrides?.itemStatus || sourceItem.item_status,
            location_id: sourceItem.location_id,
            merchant_name: sourceItem.merchant_name,
            mpn: sourceItem.mpn,
            price: overrides?.price !== undefined ? overrides.price : sourceItem.price,
            quantity: overrides?.stock !== undefined ? overrides.stock : sourceItem.quantity,
            sync_status: sourceItem.sync_status,
            synced_at: sourceItem.synced_at,
            title: sourceItem.title,
            visibility: overrides?.visibility || sourceItem.visibility,
            manufacturer: sourceItem.manufacturer,
            source: sourceItem.source,
            enrichment_status: sourceItem.enrichment_status,
            enriched_at: sourceItem.enriched_at,
            enriched_by: sourceItem.enriched_by,
            enriched_from_barcode: sourceItem.enriched_from_barcode,
            missing_images: sourceItem.missing_images,
            missing_description: sourceItem.missing_description,
            missing_specs: sourceItem.missing_specs,
            missing_brand: sourceItem.missing_brand,
            sale_price_cents: sourceItem.sale_price_cents,
            payment_gateway_type: sourceItem.payment_gateway_type,
            payment_gateway_id: sourceItem.payment_gateway_id,
            product_type: sourceItem.product_type,
            digital_delivery_method: sourceItem.digital_delivery_method,
            digital_assets: sourceItem.digital_assets as any,
            access_duration_days: sourceItem.access_duration_days,
            download_limit: sourceItem.download_limit,
            license_type: sourceItem.license_type,
            features: sourceItem.features,
            specifications: sourceItem.specifications as any,
            enhanced_description: sourceItem.enhanced_description,
            has_variants: sourceItem.has_variants,
            is_featured: sourceItem.is_featured,
            featured_at: sourceItem.featured_at,
            featured_until: sourceItem.featured_until,
            featured_priority: sourceItem.featured_priority,
            featured_type: sourceItem.featured_type,
            } as any,
          });

          // Create slug registry entry if source has one
          const sourceSlugRegistry = slugRegistryMap.get(`${sourceItem.tenant_id}-${sourceItem.sku}`);
          if (sourceSlugRegistry) {
            await prisma.product_slug_registry.upsert({
              where: {
                product_slug: sourceSlugRegistry.product_slug,
              },
              update: {
                universal_sku: sourceSlugRegistry.universal_sku,
                slug_hash: sourceSlugRegistry.slug_hash,
                tenant_id: tenantId,
                original_sku: sourceItem.sku,
              },
              create: {
                id: `psr-${generateTenantItemId(tenantId)}`,
                product_slug: sourceSlugRegistry.product_slug,
                universal_sku: sourceSlugRegistry.universal_sku,
                slug_hash: sourceSlugRegistry.slug_hash,
                tenant_id: tenantId,
                original_sku: sourceItem.sku,
                created_at: new Date(),
              },
            });
          }

          // Copy photos if any
          if (sourceItem.photo_assets && sourceItem.photo_assets.length > 0) {
            await prisma.photo_assets.createMany({
              data: sourceItem.photo_assets.map((photo: any, index: number) => ({
                 id: generatePhotoId(tenantId,newItem.id),
                tenantId: tenantId,
                inventoryItemId: newItem.id,
                url: photo.url,
                width: photo.width,
                height: photo.height,
                contentType: photo.contentType,
                bytes: photo.bytes,
                position: photo.position !== undefined ? photo.position : index,
                alt: photo.alt,
                caption: photo.caption,
              })),
            });
          }

          // Propagate variants if source item has them
          if (sourceItem.has_variants) {
            console.log(`[Organizations] BULK CREATE MODE: Propagating variants for source ${sourceItem.id} -> target ${newItem.id} (tenant: ${tenantId})`);
            console.log(`[Organizations] BULK CREATE MODE: Source item has_variants: ${sourceItem.has_variants}`);
            console.log(`[Organizations] BULK CREATE MODE: Target parent item ID: ${newItem.id}`);
            
            const variantResult = await propagateVariants(
              sourceItem.id,
              tenantId,
              newItem.id,
              undefined, // newItemId is provided for bulk create mode
              sourceItem.directory_category_id,
              'create'
            );
            
            console.log(`[Organizations] BULK CREATE MODE: Variant propagation result: created=${variantResult.created}, errors=${variantResult.errors.length}`);
            
            if (variantResult.errors.length > 0) {
              logger.error(`[Organizations] BULK CREATE MODE: Variant propagation errors for ${newItem.id}:`, undefined, { error: { name: 'Error', message: String(variantResult.errors) } });
            }
            
            // Verify the parent item still has has_variants set correctly
            const verifyParent = await prisma.inventory_items.findUnique({
              where: { id: newItem.id },
              select: { id: true, has_variants: true, sku: true }
            });
            console.log(`[Organizations] BULK CREATE MODE: Parent item verification: ${verifyParent?.id}, has_variants=${verifyParent?.has_variants}`);
          }

          results.created.push({ 
            item_id: newItem.id, 
            tenantId, 
            sku: sourceItem.sku 
          });
        } catch (error: any) {
          logger.error(`[Organizations] Error propagating ${sourceItem.sku} to tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
          results.errors.push({ 
            item_id: sourceItem.id, 
            tenantId, 
            sku: sourceItem.sku,
            error: error.message 
          });
        }
      }
    }

    res.json({
      success: true,
      sourceItemCount: sourceItems.length,
      results,
      summary: {
        totalOperations: sourceItems.length * targetTenantIds.length,
        created: results.created.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
    });
  } catch (error: any) {
    logger.error('[Organizations] Bulk propagate error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_bulk_propagate', message: error.message });
  }
});

// PUT /organizations/:id/hero-location - Set hero location for organization
const setHeroLocationSchema = z.object({
  tenantId: z.string().min(1),
});

// PUT /organizations/:id/hero-location - Set hero location
// Permission: Organization member (can manage their own organization settings)
router.put('/:id/hero-location', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const parsed = setHeroLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { tenantId } = parsed.data;

    // Verify organization exists
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
      include: {
        tenants: true,
      },
    });

    if (!organization) {
      return res.status(400).json({ 
        error: 'organization_not_found',
        message: 'Organization not found'
      });
    }

    // Verify tenant belongs to this organization
    const tenant = organization.tenants.find(t => t.id === tenantId);
    if (!tenant) {
      return res.status(400).json({ 
        error: 'tenant_not_in_organization',
        message: 'Selected tenant does not belong to this organization',
      });
    }

    // Update all tenants in a single transaction - clear all hero flags and set the new one
    // Note: Use basePrisma for transactions to avoid retry wrapper issues
    await basePrisma.$transaction(
      organization.tenants.map(t => 
        basePrisma.tenants.update({
          where: { id: t.id },
          data: {
            metadata: {
              ...(t.metadata as any || {}),
              isHeroLocation: t.id === tenantId, // Set true only for the selected tenant
            },
          },
        })
      )
    );

    // Get the updated tenant for response
    const updatedTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    res.json({
      success: true,
      heroTenantId: tenantId,
      heroTenantName: updatedTenant?.name || tenant.name,
    });
  } catch (error: any) {
    logger.error('[Organizations] Set hero location error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_set_hero_location', message: error.message });
  }
});

// POST /organizations/:id/sync-from-hero - Sync all items from hero location
// Permission: Platform support (helping customers sync inventory)
router.post('/:id/sync-from-hero', requireSupportActions, async (req, res) => {
  try {
    // Verify organization exists
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
      include: {
        tenants: true,
      },
    });

    if (!organization) {
      return res.status(400).json({ 
        error: 'organization_not_found',
        message: 'Organization not found'
      });
    }

    // Find hero location
    const heroTenant = organization.tenants.find(t => {
      const metadata = t.metadata as any;
      return metadata?.isHeroLocation === true;
    });

    if (!heroTenant) {
      return res.status(400).json({ 
        error: 'no_hero_location',
        message: 'No hero location has been set for this organization. Please set a hero location first.',
      });
    }

    // Get all items from hero location
    const heroItems = await prisma.inventory_items.findMany({
      where: { tenant_id: heroTenant.id },
      include: { photo_assets: true },
    });

    if (heroItems.length === 0) {
      return res.status(400).json({ 
        error: 'no_items_at_hero',
        message: 'Hero location has no items to propagate.',
      });
    }

    // Get all other tenants (excluding hero)
    const targetTenants = organization.tenants.filter(t => t.id !== heroTenant.id);

    if (targetTenants.length === 0) {
      return res.status(400).json({ 
        error: 'no_target_locations',
        message: 'No other locations found in this organization.',
      });
    }

    // Propagate each item to each target tenant
    const results = {
      created: [] as Array<{ item_id: string; tenantId: string; sku: string }>,
      skipped: [] as Array<{ item_id: string; tenantId: string; sku: string; reason: string }>,
      errors: [] as Array<{ item_id: string; tenantId: string; sku: string; error: string }>,
    };

    for (const sourceItem of heroItems) {
      for (const targetTenant of targetTenants) {
        try {
          // Check if target tenant's tier allows the source item's product type
          const sourceProductType = sourceItem.product_type || 'physical';
          try {
            const productTypeService = ProductTypeService.getInstance();
            const allowed = await productTypeService.isProductTypeAllowed(targetTenant.id, sourceProductType as any);
            if (!allowed) {
              results.skipped.push({
                item_id: sourceItem.id,
                tenantId: targetTenant.id,
                sku: sourceItem.sku,
                reason: `product_type_not_allowed: ${sourceProductType}`,
              });
              continue;
            }
          } catch (capError) {
            logger.error(`[Organizations] Product type capability check failed for tenant ${targetTenant.id}:`, undefined, { error: { name: (capError as any)?.name || 'Error', message: (capError as any)?.message || String(capError), stack: (capError as any)?.stack } });
          }

          // Check if SKU already exists for this tenant
          const existing = await prisma.inventory_items.findFirst({
            where: {
              tenant_id: targetTenant.id,
              sku: sourceItem.sku,
            },
          });

          if (existing) {
            results.skipped.push({ 
              item_id: sourceItem.id, 
              tenantId: targetTenant.id, 
              sku: sourceItem.sku,
              reason: 'sku_already_exists' 
            });
            continue;
          }

          // Create the item for this tenant
          const newItem = await prisma.inventory_items.create({
            data: {
              id: generateTenantItemId(targetTenant.id),
              tenant_id: targetTenant.id,
            sku: sourceItem.sku,
            name: sourceItem.name,
            price_cents: sourceItem.price_cents,
            stock: sourceItem.stock,
            image_url: sourceItem.image_url,
            metadata: sourceItem.metadata as any,
            updated_at: new Date(),
            marketing_description: sourceItem.marketing_description,
            image_gallery: sourceItem.image_gallery, 
            custom_cta: sourceItem.custom_cta as any,
            social_links: sourceItem.social_links as any,
            custom_branding: sourceItem.custom_branding as any,
            custom_sections: sourceItem.custom_sections as any,
            landing_page_theme: sourceItem.landing_page_theme,
            audit_log_id: sourceItem.audit_log_id,
            availability: sourceItem.availability,
            brand: sourceItem.brand,
            category_path: sourceItem.category_path,
            directory_category_id: sourceItem.directory_category_id,            
            condition: sourceItem.condition,
            currency: sourceItem.currency,
            description: sourceItem.description,
            eligibility_reason: sourceItem.eligibility_reason,
            gtin: sourceItem.gtin,
            item_status:  sourceItem.item_status,
            location_id: sourceItem.location_id,
            merchant_name: sourceItem.merchant_name,
            mpn: sourceItem.mpn,
            price:sourceItem.price,
            quantity: sourceItem.quantity,
            sync_status: sourceItem.sync_status,
            synced_at: sourceItem.synced_at,
            title: sourceItem.title,
            visibility: sourceItem.visibility,
            manufacturer: sourceItem.manufacturer,
            source: sourceItem.source,
            enrichment_status: sourceItem.enrichment_status,
            enriched_at: sourceItem.enriched_at,
            enriched_by: sourceItem.enriched_by,
            enriched_from_barcode: sourceItem.enriched_from_barcode,
            missing_images: sourceItem.missing_images,
            missing_description: sourceItem.missing_description,
            missing_specs: sourceItem.missing_specs,
            missing_brand: sourceItem.missing_brand,
            sale_price_cents: sourceItem.sale_price_cents,
            payment_gateway_type: sourceItem.payment_gateway_type,
            payment_gateway_id: sourceItem.payment_gateway_id,
            product_type: sourceItem.product_type,
            digital_delivery_method: sourceItem.digital_delivery_method,
            digital_assets: sourceItem.digital_assets as any,
            access_duration_days: sourceItem.access_duration_days,
            download_limit: sourceItem.download_limit,
            license_type: sourceItem.license_type,
            features: sourceItem.features,
            specifications: sourceItem.specifications as any,
            enhanced_description: sourceItem.enhanced_description,
            has_variants: sourceItem.has_variants,
            is_featured: sourceItem.is_featured,
            featured_at: sourceItem.featured_at,
            featured_until: sourceItem.featured_until,
            featured_priority: sourceItem.featured_priority,
            featured_type: sourceItem.featured_type,
            },
          });

          // Copy photos if any
          if (sourceItem.photo_assets && sourceItem.photo_assets.length > 0) {
            await prisma.photo_assets.createMany({
              data: sourceItem.photo_assets.map((photo: any, index: number) => ({
                id: generatePhotoId(targetTenant.id,newItem.id),
                tenantId: targetTenant.id,
                inventoryItemId: newItem.id,
                url: photo.url,
                width: photo.width,
                height: photo.height,
                contentType: photo.contentType,
                bytes: photo.bytes,
                position: photo.position !== undefined ? photo.position : index,
                alt: photo.alt,
                caption: photo.caption,
              })),
            });
          }

          // Propagate slug registry entry if source has one
          try {
            const heroSlugRegistry = await prisma.product_slug_registry.findFirst({
              where: {
                tenant_id: heroTenant.id,
                original_sku: sourceItem.sku,
              },
            });
            if (heroSlugRegistry) {
              await prisma.product_slug_registry.upsert({
                where: {
                  product_slug: heroSlugRegistry.product_slug,
                },
                update: {
                  universal_sku: heroSlugRegistry.universal_sku,
                  slug_hash: heroSlugRegistry.slug_hash,
                  tenant_id: targetTenant.id,
                  original_sku: sourceItem.sku,
                },
                create: {
                  id: `psr-${generateTenantItemId(targetTenant.id)}`,
                  product_slug: heroSlugRegistry.product_slug,
                  universal_sku: heroSlugRegistry.universal_sku,
                  slug_hash: heroSlugRegistry.slug_hash,
                  tenant_id: targetTenant.id,
                  original_sku: sourceItem.sku,
                  created_at: new Date(),
                },
              });
            }
          } catch (slugError) {
            logger.error(`[Organizations] Failed to propagate slug registry for SKU ${sourceItem.sku}:`, undefined, { error: { name: (slugError as any)?.name || 'Error', message: (slugError as any)?.message || String(slugError), stack: (slugError as any)?.stack } });
          }

          // Ensure global catalog entry exists
          try {
            const hasGlobalEntry = await hasGlobalCatalogEntry(sourceItem.sku);
            if (!hasGlobalEntry) {
              let variants: Array<{
                sku: string;
                variant_name: string;
                price_cents: number | null;
                attributes: Record<string, any> | null;
              }> = [];
              if (sourceItem.has_variants) {
                const rawVariants = await prisma.product_variants.findMany({
                  where: { parent_item_id: sourceItem.id },
                  select: { sku: true, variant_name: true, price_cents: true, attributes: true },
                  orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
                });
                variants = rawVariants.map(v => ({
                  sku: v.sku,
                  variant_name: v.variant_name,
                  price_cents: v.price_cents,
                  attributes: (v.attributes as Record<string, any>) || null,
                }));
              }
              await ensureGlobalCatalogEntry({
                id: newItem.id,
                tenant_id: targetTenant.id,
                sku: sourceItem.sku,
                name: sourceItem.name,
                description: sourceItem.description || undefined,
                brand: sourceItem.brand || undefined,
                category_path: sourceItem.category_path || undefined,
                gtin: sourceItem.gtin || undefined,
                price_cents: sourceItem.price_cents || undefined,
                image_url: sourceItem.image_url || undefined,
                has_variants: sourceItem.has_variants || false,
                variants: variants.map(v => ({
                  sku: v.sku,
                  name: v.variant_name,
                  price_cents: v.price_cents,
                  attributes: (v.attributes as Record<string, any>) || {},
                })),
              });
            }
          } catch (catalogError) {
            logger.error(`[Organizations] Failed to create global catalog entry for SKU ${sourceItem.sku}:`, undefined, { error: { name: (catalogError as any)?.name || 'Error', message: (catalogError as any)?.message || String(catalogError), stack: (catalogError as any)?.stack } });
          }

          // Propagate variants if source item has them
          if (sourceItem.has_variants) {
            console.log(`[Organizations] SYNC-FROM-HERO: Propagating variants for source ${sourceItem.id} -> target ${newItem.id} (tenant: ${targetTenant.id})`);
            const variantResult = await propagateVariants(
              sourceItem.id,
              targetTenant.id,
              newItem.id,
              undefined,
              sourceItem.directory_category_id,
              'create'
            );
            if (variantResult.errors.length > 0) {
              logger.error(`[Organizations] SYNC-FROM-HERO: Variant propagation errors for ${newItem.id}:`, undefined, { error: { name: 'Error', message: String(variantResult.errors) } });
            }
          }

          results.created.push({ 
            item_id: newItem.id, 
            tenantId: targetTenant.id, 
            sku: sourceItem.sku 
          });
        } catch (error: any) {
          logger.error(`[Organizations] Error syncing ${sourceItem.sku} to tenant ${targetTenant.id}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
          results.errors.push({ 
            item_id: sourceItem.id,
            tenantId: targetTenant.id, 
            sku: sourceItem.sku,
            error: error.message 
          });
        }
      }
    }

    res.json({
      success: true,
      hero_location: {
        tenantId: heroTenant.id,
        tenantName: heroTenant.name,
        itemCount: heroItems.length,
      },
      target_locations: targetTenants.length,
      results,
      summary: {
        totalOperations: heroItems.length * targetTenants.length,
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
    });
  } catch (error: any) {
    logger.error('[Organizations] Sync from hero error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_sync_from_hero', message: error.message });
  }
});

export default router;

