/**
 * Tier Management API Routes
 * 
 * Platform admin endpoints for managing tenant subscription tiers.
 * Includes tier assignment, upgrade/downgrade, and audit logging.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { audit } from '../../audit';

const router = Router();

// All routes require platform admin access
router.use(authenticateToken);

/**
 * GET /api/admin/tiers
 * List all available subscription tiers with their configurations from database
 */
router.get('/tiers', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    
    // Fetch tiers from database
    const whereClause: any = {};
    if (includeInactive !== 'true') {
      whereClause.is_active = true;
    }
    
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: whereClause,
      include: {
        tier_features_list: {
          where: { is_enabled: true },
          select: {
            id: true,
            feature_key: true,
            feature_name: true,
            is_enabled: true,
            is_inherited: true,
            is_highlighted: true,
            highlight_order: true,
            highlight_description: true,
            marketing_name: true,
          },
        },
      },
      orderBy: { sort_order: 'asc' },
    });

    // Group tiers by type with proxy pattern for trial tiers
    const groupedTiers = await Promise.all(tiers.map(async (tier) => {
      let features: any[] = [];
      
      // Use TierService proxy pattern for trial tiers
      if (tier.tier_key.startsWith('trial_')) {
        try {
          const { getTierFeatures } = await import('../../services/TierService');
          const featureKeys = await getTierFeatures(tier.tier_key);
          // Map to feature objects for consistency
          features = featureKeys.map((featureKey: string, index: number) => ({
            id: `proxy-${index}`,
            featureKey: featureKey,
            featureName: featureKey,
            isEnabled: true,
            isInherited: true,
            isHighlighted: false,
            highlightOrder: 0,
            highlightDescription: null,
            marketingName: null,
          }));
        } catch (error) {
          console.warn(`[Tier Management] Failed to get proxy features for trial tier ${tier.tier_key}:`, error);
          features = [];
        }
      } else {
        // Non-trial tiers: use stored features with highlight fields
        features = tier.tier_features_list.map((f: any) => ({
          id: f.id,
          featureKey: f.feature_key,
          featureName: f.feature_name,
          isEnabled: f.is_enabled,
          isInherited: f.is_inherited || false,
          isHighlighted: f.is_highlighted || false,
          highlightOrder: f.highlight_order || 0,
          highlightDescription: f.highlight_description || null,
          marketingName: f.marketing_name || null,
        }));
      }
      
      return {
        tier,
        tierData: {
          id: tier.tier_key,
          name: tier.name,
          displayName: tier.display_name,
          price: tier.price_monthly, // Already stored as dollars (DECIMAL)
          maxSkus: tier.max_skus,
          maxLocations: tier.max_locations,
          description: tier.description || '',
          type: tier.tier_type,
          features,
          sortOrder: tier.sort_order,
          isActive: tier.is_active,
        }
      };
    })).then(tierResults => {
      return tierResults.reduce((acc, { tier, tierData }) => {
        if (!acc[tier.tier_type]) {
          acc[tier.tier_type] = [];
        }
        acc[tier.tier_type].push(tierData);
        return acc;
      }, {} as Record<string, any[]>);
    });

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
          ...(true as any && {
            manual_subscription_control: true,
            manual_subscription_expires_at: true,
            manual_subscription_reason: true,
          }),
        },
      }),
      prisma.tenants.count({ where }),
    ]);

    // Transform tenants data with effective expiration calculation
    const transformedTenants = tenants.map((tenant: any) => {
      // Calculate effective expiration for each tenant
      const effectiveExpiration = (tenant as any).manual_subscription_control 
        ? {
            expiresAt: (tenant as any).manual_subscription_expires_at,
            type: 'manual' as const,
            source: 'manual_override' as const
          }
        : tenant.subscription_status === 'trial' && tenant.trial_ends_at
          ? {
              expiresAt: tenant.trial_ends_at,
              type: 'trial' as const,
              source: 'automatic_trial' as const
            }
          : tenant.subscription_ends_at
            ? {
                expiresAt: tenant.subscription_ends_at,
                type: 'subscription' as const,
                source: 'automatic_subscription' as const
              }
            : null;

      return {
        ...tenant,
        effectiveExpiresAt: effectiveExpiration?.expiresAt,
        effectiveExpiresType: effectiveExpiration?.type,
        effectiveExpiresSource: effectiveExpiration?.source,
      };
    });

    res.json({
      tenants: transformedTenants,
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
      return res.status(400).json({ error: 'tenant_not_found' });
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
    'discovery',
    'starter',
    'storefront',
    'commitment',
    'professional',
    'enterprise',
    'organization',
    'chain_starter',
    'chain_professional',
    'chain_enterprise',
    'trial_google_only',
    'trial_starter',
    'trial_discovery',
    'trial_storefront',
    'trial_commitment',
    'trial_professional',
    'trial_chain_starter',
    'expired_trial',
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
        ...(true as any && {
          manual_subscription_control: true,
          manual_subscription_expires_at: true,
          manual_subscription_reason: true,
        }),
        _count: {
          select: {
            inventory_items: true,
          },
        },
      },
    });

    if (!currentTenant) {
      return res.status(400).json({ error: 'tenant_not_found' });
    }

    // Check SKU limits if changing tier
    if (updateData.subscriptionTier && updateData.subscriptionTier !== (currentTenant as any).subscription_tier) {
      const tierLimits: Record<string, number> = {
        google_only: 250,
        discovery: 100,
        starter: 500,
        storefront: 2500,
        commitment: 5000,
        professional: 5000,
        enterprise: Infinity,
        organization: 10000,
        chain_starter: 2500,
        chain_professional: 25000,
        chain_enterprise: Infinity,
      };

      const newLimit = tierLimits[updateData.subscriptionTier];
      const currentSKUs = (currentTenant as any)._count.inventory_items;

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

    // Auto-handle trial expiration for trial tiers
    if (updateData.subscriptionTier?.startsWith('trial_')) {
      // Check if manual subscription control is active
      if ((currentTenant as any).manual_subscription_control) {
        console.log(`[Tier Management] Manual subscription control active - skipping auto trial expiration for tenant ${tenantId}:`, {
          trialTier: updateData.subscriptionTier,
          manualControl: true,
          manualExpiresAt: (currentTenant as any).manual_subscription_expires_at,
        });
        
        // Don't override manual expiration - only update status if needed
        if (updateData.subscriptionStatus) {
          updatePayload.subscription_status = updateData.subscriptionStatus;
        }
      } else {
        // Only set trial expiration if manual control is NOT active
        const now = new Date();
        const trialEndsAt = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days from now
        const graceEndsAt = new Date(now.getTime() + (28 * 24 * 60 * 60 * 1000)); // 28 days from now (14 + 14 grace)
        
        updatePayload.trial_ends_at = trialEndsAt;
        updatePayload.subscription_status = updateData.subscriptionStatus || 'trial';
        
        console.log(`[Tier Management] Auto-set trial expiration for tenant ${tenantId}:`, {
          trialTier: updateData.subscriptionTier,
          trialEndsAt: trialEndsAt.toISOString(),
          graceEndsAt: graceEndsAt.toISOString(),
          manualControl: false,
        });
      }
    } else if (updateData.subscriptionTier === 'expired_trial') {
      // Handle expired trial tier
      updatePayload.trial_ends_at = null;
      updatePayload.subscription_status = 'expired';
      
      console.log(`[Tier Management] Set tenant ${tenantId} to expired_trial status`);
    } else if (updateData.subscriptionTier && !updateData.subscriptionTier.startsWith('trial_')) {
      // Moving from trial to paid tier - clear trial dates
      if ((currentTenant as any).subscription_tier?.startsWith('trial_')) {
        updatePayload.trial_ends_at = null;
        updatePayload.subscription_status = updateData.subscriptionStatus || 'active';
        
        console.log(`[Tier Management] Converted tenant ${tenantId} from trial to paid tier:`, {
          fromTier: (currentTenant as any).subscription_tier,
          toTier: updateData.subscriptionTier,
        });
      }
    }

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
          subscriptionTier: (currentTenant as any).subscription_tier,
          subscriptionStatus: (currentTenant as any).subscription_status,
          trialEndsAt: (currentTenant as any).trial_ends_at?.toISOString(),
          subscriptionEndsAt: (currentTenant as any).subscription_ends_at?.toISOString(),
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

    // Calculate effective expiration for response
    const effectiveExpiration = (updatedTenant as any).manual_subscription_control 
      ? {
          expiresAt: (updatedTenant as any).manual_subscription_expires_at,
          type: 'manual' as const,
          source: 'manual_override' as const
        }
      : updatedTenant.subscription_status === 'trial' && updatedTenant.trial_ends_at
        ? {
            expiresAt: updatedTenant.trial_ends_at,
            type: 'trial' as const,
            source: 'automatic_trial' as const
          }
        : updatedTenant.subscription_ends_at
          ? {
              expiresAt: updatedTenant.subscription_ends_at,
              type: 'subscription' as const,
              source: 'automatic_subscription' as const
            }
          : null;

    res.json({
      success: true,
      tenant: updatedTenant,
      changes: {
        before: {
          subscriptionTier: currentTenant.subscription_tier,
          subscriptionStatus: currentTenant.subscription_status,
          manualSubscriptionControl: (currentTenant as any).manual_subscription_control,
          manualSubscriptionExpiresAt: (currentTenant as any).manual_subscription_expires_at,
          manualSubscriptionReason: (currentTenant as any).manual_subscription_reason,
        },
        after: {
          subscriptionTier: updatedTenant.subscription_tier,
          subscriptionStatus: updatedTenant.subscription_status,
          manualSubscriptionControl: (updatedTenant as any).manual_subscription_control,
          manualSubscriptionExpiresAt: (updatedTenant as any).manual_subscription_expires_at,
          manualSubscriptionReason: (updatedTenant as any).manual_subscription_reason,
          effectiveExpiresAt: effectiveExpiration?.expiresAt,
          effectiveExpiresType: effectiveExpiration?.type,
          effectiveExpiresSource: effectiveExpiration?.source,
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
      discovery: 29,
      starter: 49,
      storefront: 59,
      commitment: 79,  // V2 pricing
      ecommerce: 99,   // V2 new tier
      omnichannel: 149, // V2 new tier
      professional: 199,
      enterprise: 499,  // V2 pricing
      organization: 399, // V2 pricing
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
    'discovery',
    'starter',
    'storefront',
    'commitment',
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
