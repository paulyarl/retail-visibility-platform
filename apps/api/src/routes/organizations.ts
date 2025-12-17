// Organization Management API Routes
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, basePrisma } from '../prisma';
import { validateOrganizationTier, validateOrganizationLimits, validateOrganizationTierChange } from '../middleware/organization-validation';
import { isPlatformAdmin, canPerformSupportActions } from '../utils/platform-admin';
import { requireTenantAdmin } from '../middleware/auth';
import { requirePropagationTier } from '../middleware/tier-validation';
import { generateItemId, generateOrganizationId, generatePhotoId } from '../lib/id-generator';
import { authenticateToken } from '../middleware/auth';
import { user_tenant_role } from '@prisma/client';

const router = Router();

/**
 * Middleware to check if user can perform support actions (admin/support)
 * Used for organization management operations
 */
function requireSupportActions(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  console.log('[requireSupportActions] Checking user:', {
    userId: user?.userId,
    role: user?.role,
    tenantIds: user?.tenantIds,
    hasUser: !!user
  });

  if (!user || !canPerformSupportActions(user)) {
    console.log('[requireSupportActions] Access denied for user:', {
      userId: user?.userId,
      role: user?.role,
      canPerform: canPerformSupportActions(user)
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Platform admin or support access required for organization management',
    });
  }

  console.log('[requireSupportActions] Access granted for user:', {
    userId: user?.userId,
    role: user?.role
  });
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
// Permission: Platform support (view-only operation)
router.get('/', authenticateToken, requireSupportActions, async (req, res) => {
  try {
    const organizations = await prisma.organizations_list.findMany({
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
    if (error?.code === 'P1001' || (typeof error?.message === 'string' && error.message.includes("Can't reach database server"))) {
      console.warn('[Organizations] DB unreachable (P1001). Returning empty list.');
      return res.json([]);
    }
    console.error('[Organizations] List error:', error);
    res.status(500).json({ error: 'failed_to_list_organizations' });
  }
});

// GET /organizations/:id - Get single organization
// Permission: Organization members can read their own organization data
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const organizationId = req.params.id;

    // Verify user is a member of this organization
    const userTenants = await prisma.tenants.findMany({
      where: {
        organization_id: organizationId,
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
        organization_id: organizationId,
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

    const organization = await prisma.organizations_list.findUnique({
      where: { id: organizationId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            metadata: true,
            _count: {
              select: {
                inventory_items: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'organization_not_found' });
    }

    res.json(organization);
  } catch (error: any) {
    // If the database is temporarily unreachable (e.g., Supabase paused), return a helpful error
    if (error?.code === 'P1001' || (typeof error?.message === 'string' && error.message.includes("Can't reach database server"))) {
      console.warn('[Organizations] DB unreachable (P1001). Organization:', req.params.id);
      return res.status(503).json({ error: 'database_unavailable', message: 'Database is temporarily unavailable' });
    }
    console.error('[Organizations] Get error:', error);
    res.status(500).json({ error: 'failed_to_get_organization', message: error.message });
  }
});

// POST /organizations - Create organization
const createOrgSchema = z.object({
  name: z.string().min(1),
  ownerId: z.string().min(1).optional(), // Optional - defaults to authenticated user
  subscriptionTier: z.enum(['chain_starter', 'chain_professional', 'chain_enterprise']).default('chain_starter'),
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
    console.error('[Organizations] Create error:', error);
    res.status(500).json({ error: 'failed_to_create_organization', message: error.message });
  }
});

// PUT /organizations/:id - Update organization
const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  maxLocations: z.number().int().positive().optional(),
  maxTotalSKUs: z.number().int().positive().optional(),
  subscriptionTier: z.enum(['chain_starter', 'chain_professional', 'chain_enterprise']).optional(),
  subscriptionStatus: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
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
    console.error('[Organizations] Update error:', error);
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
    console.error('[Organizations] Delete error:', error);
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
    console.error('[Organizations] Add tenant error:', error);
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
    console.error('[Organizations] Remove tenant error:', error);
    res.status(500).json({ error: 'failed_to_remove_tenant' });
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
router.post('/:id/items/propagate', requireTenantAdmin, requirePropagationTier('products'), async (req, res) => {
  try {
    const parsed = propagateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { sourceItemId, targetTenantIds, mode, overrides } = parsed.data;

    // Verify organization exists
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
      include: {
        tenants: {
          select: { id: true },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'organization_not_found' });
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

    // Get source item
    const sourceItem = await prisma.inventory_items.findUnique({
      where: { id: sourceItemId },
      include: {
        photo_assets: true,
      },
    });

    if (!sourceItem) {
      return res.status(404).json({ error: 'source_item_not_found' });
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
            results.skipped.push({ tenantId, reason: 'sku_already_exists' });
            continue;
          }
          
          // Update mode - update existing item
          const updatedItem = await prisma.inventory_items.update({
            where: { id: existing.id },
            data: {
              name: sourceItem.name,
              title: sourceItem.title,
              brand: sourceItem.brand,
              description: sourceItem.description,
              price: overrides?.price !== undefined ? overrides.price : sourceItem.price,
              price_cents: overrides?.price !== undefined ? Math.round(overrides.price * 100) : sourceItem.price_cents,
              stock: overrides?.stock !== undefined ? overrides.stock : sourceItem.stock,
              quantity: overrides?.stock !== undefined ? overrides.stock : sourceItem.quantity,
              image_url: sourceItem.image_url, 
              image_gallery: sourceItem.image_gallery,
              marketing_description: sourceItem.marketing_description,
              metadata: sourceItem.metadata as any,
              availability: sourceItem.availability,
              category_path: sourceItem.category_path,
              condition: sourceItem.condition,
              currency: sourceItem.currency,
              gtin: sourceItem.gtin,
              item_status: overrides?.itemStatus || sourceItem.item_status,
              mpn: sourceItem.mpn,
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
            },
          });

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

          results.updated.push(tenantId);
          continue;
        }

        // Item doesn't exist
        if (mode === 'update_only') {
          results.skipped.push({ tenantId, reason: 'sku_does_not_exist' });
          continue;
        }

        // Create mode - create new item
        const newItem = await prisma.inventory_items.create({
          data: {
            id: generateItemId(),
            updated_at: new Date(),
            tenant_id: tenantId,
            sku: sourceItem.sku,
            name: sourceItem.name,
            title: sourceItem.title,
            brand: sourceItem.brand,
            description: sourceItem.description,
            price: overrides?.price !== undefined ? overrides.price : sourceItem.price,
            price_cents: overrides?.price !== undefined ? Math.round(overrides.price * 100) : sourceItem.price_cents,
            stock: overrides?.stock !== undefined ? overrides.stock : sourceItem.stock,
            quantity: overrides?.stock !== undefined ? overrides.stock : sourceItem.quantity,
            image_url: sourceItem.image_url,
            image_gallery: sourceItem.image_gallery,
            marketing_description: sourceItem.marketing_description,
            metadata: sourceItem.metadata as any,
            availability: sourceItem.availability,
            category_path: sourceItem.category_path,
            condition: sourceItem.condition,
            currency: sourceItem.currency,
            gtin: sourceItem.gtin,
            item_status: overrides?.itemStatus || sourceItem.item_status,
            mpn: sourceItem.mpn,
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
          },
        });

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

        results.created.push(tenantId);
      } catch (error: any) {
        console.error(`[Organizations] Error propagating to tenant ${tenantId}:`, error);
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
    console.error('[Organizations] Propagate item error:', error);
    res.status(500).json({ error: 'failed_to_propagate_item', message: error.message });
  }
});

// POST /organizations/:id/items/propagate-bulk - Bulk propagate multiple items
const propagateBulkSchema = z.object({
  sourceItemIds: z.array(z.string()).min(1),
  targetTenantIds: z.array(z.string()).min(1),
  overrides: z.object({
    price: z.number().optional(),
    stock: z.number().int().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    itemStatus: z.enum(['active', 'inactive']).optional(),
  }).optional(),
});

// POST /organizations/:id/items/propagate-bulk - Bulk propagate items
// Permission: Tenant admin (Starter tier+, 2+ locations required)
router.post('/:id/items/propagate-bulk', requireTenantAdmin, requirePropagationTier('products'), async (req, res) => {
  try {
    const parsed = propagateBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { sourceItemIds, targetTenantIds, overrides } = parsed.data;

    // Verify organization exists
    const organization = await prisma.organizations_list.findUnique({
      where: { id: req.params.id },
      include: {
        tenants: {
          select: { id: true },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'organization_not_found' });
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
      include: {
        photo_assets: true,
      },
    });

    if (sourceItems.length === 0) {
      return res.status(404).json({ error: 'no_source_items_found' });
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

          // Check if SKU already exists for this tenant
          const existing = await prisma.inventory_items.findFirst({
            where: {
              tenant_id: tenantId,
              sku: sourceItem.sku,
            },
          });

          if (existing) {
            results.skipped.push({ 
              item_id: sourceItem.id, 
              tenantId, 
              sku: sourceItem.sku,
              reason: 'sku_already_exists' 
            });
            continue;
          }

          // Create the item for this tenant
          const newItem = await prisma.inventory_items.create({
            data: {
              id: generateItemId(),
              tenant_id: tenantId,
              sku: sourceItem.sku,
              name: sourceItem.name,
              title: sourceItem.title,
              brand: sourceItem.brand,
              description: sourceItem.description,
              price: overrides?.price !== undefined ? overrides.price : sourceItem.price,
              priceCents: overrides?.price !== undefined ? Math.round(overrides.price * 100) : sourceItem.price_cents,
              stock: overrides?.stock !== undefined ? overrides.stock : sourceItem.stock,
              quantity: overrides?.stock !== undefined ? overrides.stock : sourceItem.quantity,
              imageUrl: sourceItem.image_url,
              imageGallery: sourceItem.image_gallery,
              marketingDescription: sourceItem.marketing_description,
              metadata: sourceItem.metadata as any,
              availability: sourceItem.availability,
              categoryPath: sourceItem.category_path,
              condition: sourceItem.condition,
              currency: sourceItem.currency,
              gtin: sourceItem.gtin,
              itemStatus: overrides?.itemStatus || sourceItem.item_status,
              mpn: sourceItem.mpn,
              visibility: overrides?.visibility || sourceItem.visibility,
              manufacturer: sourceItem.manufacturer,
              source: sourceItem.source,
              enrichmentStatus: sourceItem.enrichment_status,
              enrichedAt: sourceItem.enriched_at,
              enrichedBy: sourceItem.enriched_by,
              enrichedFromBarcode: sourceItem.enriched_from_barcode,
              missingImages: sourceItem.missing_images,
              missingDescription: sourceItem.missing_description,
              missingSpecs: sourceItem.missing_specs,
              missingBrand: sourceItem.missing_brand,
            } as any,
          });

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

          results.created.push({ 
            item_id: newItem.id, 
            tenantId, 
            sku: sourceItem.sku 
          });
        } catch (error: any) {
          console.error(`[Organizations] Error propagating ${sourceItem.sku} to tenant ${tenantId}:`, error);
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
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
    });
  } catch (error: any) {
    console.error('[Organizations] Bulk propagate error:', error);
    res.status(500).json({ error: 'failed_to_bulk_propagate', message: error.message });
  }
});

// PUT /organizations/:id/hero-location - Set hero location for organization
const setHeroLocationSchema = z.object({
  tenantId: z.string().min(1),
});

// PUT /organizations/:id/hero-location - Set hero location
// Permission: Organization member (can manage their own organization settings)
router.put('/:id/hero-location', authenticateToken, requireSupportActions, async (req, res) => {
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
      return res.status(404).json({ error: 'organization_not_found' });
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
    console.error('[Organizations] Set hero location error:', error);
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
      return res.status(404).json({ error: 'organization_not_found' });
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
              id: generateItemId(),
              tenant_id: targetTenant.id,
              sku: sourceItem.sku,
              name: sourceItem.name,
              title: sourceItem.title,
              brand: sourceItem.brand,
              description: sourceItem.description,
              price: sourceItem.price,
              price_cents: sourceItem.price_cents,
              stock: sourceItem.stock,
              quantity: sourceItem.quantity,
              image_url: sourceItem.image_url, 
              image_gallery: sourceItem.image_gallery,
              marketing_description: sourceItem.marketing_description,
              metadata: sourceItem.metadata as any,
              availability: sourceItem.availability,
              category_path: sourceItem.category_path,
              condition: sourceItem.condition,
              currency: sourceItem.currency,
              gtin: sourceItem.gtin,
              item_status: sourceItem.item_status,
              mpn: sourceItem.mpn,
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
              updated_at: new Date(),
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

          results.created.push({ 
            item_id: newItem.id, 
            tenantId: targetTenant.id, 
            sku: sourceItem.sku 
          });
        } catch (error: any) {
          console.error(`[Organizations] Error syncing ${sourceItem.sku} to tenant ${targetTenant.id}:`, error);
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
    console.error('[Organizations] Sync from hero error:', error);
    res.status(500).json({ error: 'failed_to_sync_from_hero', message: error.message });
  }
});

export default router;

