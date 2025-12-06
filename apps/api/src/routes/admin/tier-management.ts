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
 * List all available subscription tiers with their configurations from database
 */
router.get('/tiers', async (req, res) => {
  try {
    // Fetch tiers from database
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { is_active: true },
      include: {
        tier_features_list: {
          where: { is_enabled: true },
          select: {
            feature_key: true,
            feature_name: true,
          },
        },
      },
      orderBy: { sort_order: 'asc' },
    });

    // Group tiers by type
    const groupedTiers = tiers.reduce((acc, tier) => {
      const tierData = {
        id: tier.tier_key,
        name: tier.name,
        displayName: tier.display_name,
        price: tier.price_monthly / 100, // Convert from cents to dollars
        maxSkus: tier.max_skus,
        maxLocations: tier.max_locations,
        description: tier.description || '',
        type: tier.tier_type,
        features: tier.tier_features_list.map((f: { feature_key: string }) => f.feature_key),
        sortOrder: tier.sort_order,
      };

      if (!acc[tier.tier_type]) {
        acc[tier.tier_type] = [];
      }
      acc[tier.tier_type].push(tierData);
      return acc;
    }, {} as Record<string, any[]>);

    res.json(groupedTiers);
  } catch (error) {
    console.error('[GET /api/admin/tier-management/tiers] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_tiers' });
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
      where.subscription_tier = tier;
    }

    if (status) {
      where.subscription_status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { id: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Fetch tenants with pagination
    const [tenants, totalCount] = await Promise.all([
      prisma.tenants.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          subscription_status: true,
          trial_ends_at: true,
          subscription_ends_at: true,
          created_at: true,
          organization_id: true,
          organizations_list: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
            },
          },
          _count: {
            select: {
              user_tenants: true,
              inventory_items: true,
            },
          },
        },
      }),
      prisma.tenants.count({ where }),
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

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: {
        organizations_list: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            subscription_status: true,
          },
        },
        tenant_feature_overrides_list: {
          where: {
            OR: [
              { expires_at: null },
              { expires_at: { gt: new Date() } },
            ],
          },
        },
        _count: {
          select: {
            tenant_feature_overrides_list: true,
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
  subscriptionStatus: z.enum([
    'trial',
    'active',
    'past_due',
    'canceled',
    'expired',
  ]).optional(),
  reason: z.string().min(1, 'Reason is required for audit trail'),
  trialEndsAt: z.string().datetime().optional(),
  subscriptionEndsAt: z.string().datetime().optional(),
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
    const currentTenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        _count: {
          select: {
            inventory_items: true,
          },
        },
      },
    });

    if (!currentTenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check SKU limits if changing tier
    if (updateData.subscriptionTier && updateData.subscriptionTier !== currentTenant.subscription_tier) {
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
      const currentSKUs = currentTenant._count.inventory_items;

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
    if (updateData.subscriptionTier) updatePayload.subscription_tier = updateData.subscriptionTier;
    if (updateData.subscriptionStatus) updatePayload.subscription_status = updateData.subscriptionStatus;
    if (updateData.trialEndsAt) updatePayload.trial_ends_at = new Date(updateData.trialEndsAt);
    if (updateData.subscriptionEndsAt) updatePayload.subscription_ends_at = new Date(updateData.subscriptionEndsAt);

    // Update tenant
    const updatedTenant = await prisma.tenants.update({
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
          subscriptionTier: currentTenant.subscription_tier,
          subscriptionStatus: currentTenant.subscription_status,
          trialEndsAt: currentTenant.trial_ends_at?.toISOString(),
          subscriptionEndsAt: currentTenant.subscription_ends_at?.toISOString(),
        },
        after: {
          subscriptionTier: updatedTenant.subscription_tier,
          subscriptionStatus: updatedTenant.subscription_status,
          trialEndsAt: updatedTenant.trial_ends_at?.toISOString(),
          subscriptionEndsAt: updatedTenant.subscription_ends_at?.toISOString(),
        },
        adminUserId: req.user?.userId,
        adminEmail: req.user?.email,
      },
    });

    console.log(`[Tier Management] Tenant ${tenantId} tier updated by ${req.user?.email}:`, {
      from: currentTenant.subscription_tier,
      to: updatedTenant.subscription_tier,
      reason,
    });

    res.json({
      success: true,
      tenant: updatedTenant,
      changes: {
        before: {
          subscriptionTier: currentTenant.subscription_tier,
          subscriptionStatus: currentTenant.subscription_status,
        },
        after: {
          subscriptionTier: updatedTenant.subscription_tier,
          subscriptionStatus: updatedTenant.subscription_status,
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
    const tierDistribution = await prisma.tenants.groupBy({
      by: ['subscription_tier'],
      _count: {
        id: true,
      },
    });

    // Get status distribution
    const statusDistribution = await prisma.tenants.groupBy({
      by: ['subscription_status'],
      _count: {
        id: true,
      },
    }) as any;

    // Get total counts
    const [totalTenants, totalOrganizations, totalTrialTenants, totalActiveTenants] = await Promise.all([
      prisma.tenants.count(),
      prisma.organizations_list.count(),
      prisma.tenants.count({ where: { subscription_status: { equals: 'trial' } } }),
      prisma.tenants.count({ where: { subscription_status: { equals: 'active' } } }),
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

    const activeTenants = await prisma.tenants.findMany({
      where: { subscription_status: 'active' },
      select: { subscription_tier: true },
    });

    const estimatedMRR = activeTenants.reduce((sum, tenant) => {
      const tier = tenant.subscription_tier || 'starter';
      return sum + (tierPricing[tier] || 0);
    }, 0);

    res.json({
      totalTenants,
      totalOrganizations,
      totalTrialTenants,
      totalActiveTenants,
      estimatedMRR,
      tierDistribution: tierDistribution.map((t: any) => ({
        tier: t.subscription_tier,
        count: (t as any)._count?.id ?? 0,
      })),
      statusDistribution: statusDistribution.map((s: any) => ({
        status: s.subscription_status,
        count: (s as any)._count?.id ?? 0,
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
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
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
    if (updateData.subscriptionTier) updatePayload.subscription_tier = updateData.subscriptionTier;
    if (updateData.subscriptionStatus) updatePayload.subscription_status = updateData.subscriptionStatus;

    await prisma.tenants.updateMany({
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
            subscriptionTier: tenant.subscription_tier,
            subscriptionStatus: tenant.subscription_status,
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
