/**
 * Tier Management API Routes
 * 
 * Platform admin endpoints for managing tenant subscription tiers.
 * Includes tier assignment, upgrade/downgrade, and audit logging.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAdmin } from '../../middleware/auth';
import { audit } from '../../audit';

const router = Router();

// All routes require platform admin access
router.use(requireAdmin);

/**
 * GET /api/admin/tiers
 * List all available subscription tiers with their configurations
 */
router.get('/tiers', async (req, res) => {
  try {
    // Return tier definitions from the system
    const tiers = {
      individual: [
        {
          id: 'google_only',
          name: 'Google-Only',
          display_name: 'Google-Only',
          price: 29,
          maxSKUs: 250,
          description: 'Get discovered on Google',
          type: 'individual',
          features: [
            'google_shopping',
            'google_merchant_center',
            'basic_product_pages',
            'qr_codes_512',
            'performance_analytics',
            'quick_start_wizard', // Limited
          ],
        },
        {
          id: 'starter',
          name: 'Starter',
          display_name: 'Starter',
          price: 49,
          maxSKUs: 500,
          description: 'Get started with the basics',
          type: 'individual',
          features: [
            'storefront',
            'product_search',
            'mobile_responsive',
            'enhanced_seo',
            'basic_categories',
          ],
        },
        {
          id: 'professional',
          name: 'Professional',
          display_name: 'Professional',
          price: 499,
          maxSKUs: 5000,
          description: 'For established retail businesses',
          type: 'individual',
          features: [
            'quick_start_wizard',
            'product_scanning',
            'gbp_integration',
            'custom_branding',
            'business_logo',
            'qr_codes_1024',
            'image_gallery_5',
            'interactive_maps',
            'privacy_mode',
            'custom_marketing_copy',
            'priority_support',
          ],
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          display_name: 'Enterprise',
          price: 999,
          maxSKUs: Infinity,
          description: 'For large single-location operations',
          type: 'individual',
          features: [
            'unlimited_skus',
            'white_label',
            'custom_domain',
            'qr_codes_2048',
            'image_gallery_10',
            'api_access',
            'advanced_analytics',
            'dedicated_account_manager',
            'sla_guarantee',
            'custom_integrations',
          ],
        },
      ],
      organization: [
        {
          id: 'organization',
          name: 'Organization',
          display_name: 'Organization',
          price: 999,
          maxSKUs: 10000,
          description: 'For franchise chains & multi-location businesses',
          type: 'organization',
          features: [
            'propagation_products',
            'propagation_categories',
            'propagation_gbp_sync',
            'propagation_hours',
            'propagation_profile',
            'propagation_flags',
            'propagation_roles',
            'propagation_brand',
            'organization_dashboard',
            'hero_location',
            'strategic_testing',
            'unlimited_locations',
            'shared_sku_pool',
            'centralized_control',
            'api_access',
          ],
        },
        {
          id: 'chain_starter',
          name: 'Chain Starter',
          display_name: 'Chain Starter',
          price: 199,
          maxLocations: 5,
          maxSKUs: 2500,
          description: 'For small chains (2-5 locations)',
          type: 'chain',
          features: [
            'storefront',
            'product_search',
            'mobile_responsive',
            'enhanced_seo',
            'multi_location_5',
          ],
        },
        {
          id: 'chain_professional',
          name: 'Chain Professional',
          display_name: 'Chain Professional',
          price: 1999,
          maxLocations: 25,
          maxSKUs: 25000,
          description: 'For medium chains (6-25 locations)',
          type: 'chain',
          features: [
            'quick_start_wizard',
            'product_scanning',
            'gbp_integration',
            'custom_branding',
            'qr_codes_1024',
            'image_gallery_5',
            'multi_location_25',
            'basic_propagation',
          ],
        },
        {
          id: 'chain_enterprise',
          name: 'Chain Enterprise',
          display_name: 'Chain Enterprise',
          price: 4999,
          maxLocations: Infinity,
          maxSKUs: Infinity,
          description: 'For large chains (26+ locations)',
          type: 'chain',
          features: [
            'unlimited_skus',
            'white_label',
            'custom_domain',
            'qr_codes_2048',
            'image_gallery_10',
            'api_access',
            'unlimited_locations',
            'advanced_propagation',
            'dedicated_account_manager',
          ],
        },
      ],
    };

    res.json(tiers);
  } catch (error) {
    console.error('[GET /api/admin/tiers] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tiers' });
  }
});

/**
 * GET /api/admin/tiers/tenants
 * List all tenants with their current tier information
 */
router.get('/tenants', async (req, res) => {
  try {
    const { tier, status, search, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (tier) {
      where.subscriptionTier = tier;
    }

    if (status) {
      where.subscriptionStatus = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { id: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Fetch tenants with pagination
    const [tenants, totalCount] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
          createdAt: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              subscriptionTier: true,
            },
          },
          _count: {
            select: {
              userTenants: true,
              inventoryItems: true,
            },
          },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({
      tenants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasMore: skip + tenants.length < totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/tiers/tenants] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tenants' });
  }
});

/**
 * GET /api/admin/tiers/tenants/:tenantId
 * Get detailed tier information for a specific tenant
 */
router.get('/tenants/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true, 
            subscriptionStatus: true,
          },
        },
        tenantFeatureOverrides: {
          where: {
            OR: [
              { expiresAt: null }, 
              { expiresAt: { gt: new Date() } }, 
            ],
          },
        },
        _count: {
          select: {
            tenantFeatureOverrides: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('[GET /api/admin/tiers/tenants/:tenantId] Error:', error);
    res.status(500).json({ error: 'failed_to_get_tenant' });
  }
});

/**
 * PATCH /api/admin/tiers/tenants/:tenantId
 * Update tenant tier and subscription status
 */
const updateTenantTierSchema = z.object({
  subscriptionTier: z.enum([
    'google_only',
    'starter',
    'professional',
    'enterprise',
    'organization',
    'chain_starter',
    'chain_professional',
    'chain_enterprise',
  ]).optional(),
  subscription_status: z.enum([
    'trial',
    'active',
    'past_due',
    'canceled',
    'expired',
  ]).optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
  trialEndsAt: z.string().datetime().optional(),
  subscription_ends_at: z.string().datetime().optional(),
});

router.patch('/tenants/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const parsed = updateTenantTierSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { reason, ...updateData } = parsed.data;

    // Get current tenant state for audit
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        _count: {
          select: {
            inventoryItems: true,
          },
        },
      },
    });

    if (!currentTenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check SKU limits if changing tier
    if (updateData.subscriptionTier && updateData.subscriptionTier !== currentTenant.subscriptionTier) {
      const tierLimits: Record<string, number> = {
        google_only: 250,
        starter: 500,
        professional: 5000,
        enterprise: Infinity,
        organization: 10000,
        chain_starter: 2500,
        chain_professional: 25000,
        chain_enterprise: Infinity,
      };

      const newLimit = tierLimits[updateData.subscriptionTier];
      const currentSKUs = currentTenant._count.inventoryItems;

      if (newLimit !== Infinity && currentSKUs > newLimit) {
        return res.status(400).json({
          error: 'sku_limit_exceeded',
          message: `Tenant has ${currentSKUs} SKUs but ${updateData.subscriptionTier} tier allows only ${newLimit} SKUs`,
          currentSKUs,
          newLimit,
        });
      }
    }

    // Convert date strings to Date objects
    const updatePayload: any = {};
    if (updateData.subscriptionTier) updatePayload.subscriptionTier = updateData.subscriptionTier;
    if (updateData.subscription_status) updatePayload.subscriptionStatus = updateData.subscription_status;
    if (updateData.trialEndsAt) updatePayload.trialEndsAt = new Date(updateData.trialEndsAt);
    if (updateData.subscription_ends_at) updatePayload.subscriptionEndsAt = new Date(updateData.subscription_ends_at);

    // Update tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updatePayload,
    });

    // Create audit log
    await audit({
      tenantId,
      actor: req.user?.userId || 'system',
      action: 'tier.update',
      payload: {
        reason,
        before: {
          subscriptionTier: currentTenant.subscriptionTier,
          subscriptionStatus: currentTenant.subscriptionStatus,
          trialEndsAt: currentTenant.trialEndsAt,
          subscriptionEndsAt: currentTenant.subscriptionEndsAt,
        },
        after: {
          subscriptionTier: updatedTenant.subscriptionTier,
          subscriptionStatus: updatedTenant.subscriptionStatus,
          trialEndsAt: updatedTenant.trialEndsAt,
          subscriptionEndsAt: updatedTenant.subscriptionEndsAt,
        },
        adminUserId: req.user?.userId,
        adminEmail: req.user?.email,
      },
    });

    console.log(`[Tier Management] Tenant ${tenantId} tier updated by ${req.user?.email}:`, {
      from: currentTenant.subscriptionTier,
      to: updatedTenant.subscriptionTier,
      reason,
    });

    res.json({
      success: true,
      tenant: updatedTenant,
      changes: {
        before: {
          subscriptionTier: currentTenant.subscriptionTier,
          subscriptionStatus: currentTenant.subscriptionStatus,
        },
        after: {
          subscriptionTier: updatedTenant.subscriptionTier,
          subscriptionStatus: updatedTenant.subscriptionStatus,
        },
      },
    });
  } catch (error) {
    console.error('[PATCH /api/admin/tiers/tenants/:tenantId] Error:', error);
    res.status(500).json({ error: 'failed_to_update_tenant_tier' });
  }
});

/**
 * GET /api/admin/tiers/stats
 * Get tier distribution statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get tier distribution
    const tierDistribution = await prisma.tenant.groupBy({
      by: ['subscriptionTier'],
      _count: {
        id: true,
      },
    });

    // Get status distribution
    const statusDistribution = await prisma.tenant.groupBy({
      by: ['subscriptionStatus'],
      _count: {
        id: true,
      },
    });

    // Get total counts
    const [totalTenants, totalOrganizations, totalTrialTenants, totalActiveTenants] = await Promise.all([
      prisma.tenant.count(),
      prisma.organization.count(),
      prisma.tenant.count({ where: { subscriptionStatus: 'trial' } }),
      prisma.tenant.count({ where: { subscriptionStatus: 'active' } }),
    ]);

    // Calculate MRR (Monthly Recurring Revenue) estimate
    const tierPricing: Record<string, number> = {
      google_only: 29,
      starter: 49,
      professional: 499,
      enterprise: 999,
      organization: 999,
      chain_starter: 199,
      chain_professional: 1999,
      chain_enterprise: 4999,
    };

    const activeTenants = await prisma.tenant.findMany({
      where: { subscriptionStatus: 'active' },
      select: { subscriptionTier: true },
    });

    const estimatedMRR = activeTenants.reduce((sum, tenant) => {
      const tier = tenant.subscriptionTier || 'starter';
      return sum + (tierPricing[tier] || 0);
    }, 0);

    res.json({
      totalTenants,
      totalOrganizations,
      totalTrialTenants,
      totalActiveTenants,
      estimatedMRR,
      tierDistribution: tierDistribution.map(t => ({
        tier: t.subscriptionTier,
        count: t._count.id,
      })),
      statusDistribution: statusDistribution.map(s => ({
        status: s.subscriptionStatus,
        count: s._count.id,
      })),
    });
  } catch (error) {
    console.error('[GET /api/admin/tiers/stats] Error:', error);
    res.status(500).json({ error: 'failed_to_get_stats' });
  }
});

/**
 * POST /api/admin/tiers/bulk-update
 * Bulk update tiers for multiple tenants
 */
const bulkUpdateSchema = z.object({
  tenantIds: z.array(z.string()).min(1, 'At least one tenant ID required'),
  subscriptionTier: z.enum([
    'google_only',
    'starter',
    'professional',
    'enterprise',
    'organization',
    'chain_starter',
    'chain_professional',
    'chain_enterprise',
  ]).optional(),
  subscriptionStatus: z.enum([
    'trial',
    'active',
    'past_due',
    'canceled',
    'expired',
  ]).optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
});

router.post('/bulk-update', async (req, res) => {
  try {
    const parsed = bulkUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const { tenantIds, reason, ...updateData } = parsed.data;

    // Validate all tenants exist
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    if (tenants.length !== tenantIds.length) {
      return res.status(404).json({
        error: 'some_tenants_not_found',
        found: tenants.length,
        requested: tenantIds.length,
      });
    }

    // Update all tenants
    const updatePayload: any = {};
    if (updateData.subscriptionTier) updatePayload.subscriptionTier = updateData.subscriptionTier;
    if (updateData.subscriptionStatus) updatePayload.subscriptionStatus = updateData.subscriptionStatus;

    await prisma.tenant.updateMany({
      where: { id: { in: tenantIds } },
      data: updatePayload,
    });

    // Create audit logs for each tenant
    for (const tenant of tenants) {
      await audit({
        tenantId: tenant.id,
        actor: req.user?.userId || 'system',
        action: 'tier.bulk_update',
        payload: {
          reason,
          before: {
            subscriptionTier: tenant.subscriptionTier,
            subscriptionStatus: tenant.subscriptionStatus,
          },
          after: updateData,
          adminUserId: req.user?.userId,
          adminEmail: req.user?.email,
          bulkOperation: true,
        },
      });
    }

    console.log(`[Tier Management] Bulk update completed by ${req.user?.email}:`, {
      tenantCount: tenants.length,
      changes: updateData,
      reason,
    });

    res.json({
      success: true,
      updatedCount: tenants.length,
      tenant: tenants.map(t => t.id),
    });
  } catch (error) {
    console.error('[POST /api/admin/tiers/bulk-update] Error:', error);
    res.status(500).json({ error: 'failed_to_bulk_update' });
  }
});

export default router;
