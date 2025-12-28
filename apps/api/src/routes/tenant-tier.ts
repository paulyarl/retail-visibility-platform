import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import TierService from '../services/TierService';

const router = Router();

/**
 * GET /tenants/:id/tier/public
 * Get public tier information for a specific tenant (no auth required)
 * Used by storefront for QR code features
 */
router.get('/tenants/:id/tier/public', async (req, res) => {
  try {
    const { id: tenantId } = req.params;

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subscription_tier: true,
        organization_id: true,
        organizations_list: {
          select: {
            subscription_tier: true,
            _count: {
              select: { tenants: true }
            }
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Determine effective tier (org tier can override tenant tier for chains)
    const effectiveTier = tenant.organizations_list?.subscription_tier || tenant.subscription_tier || 'starter';
    const isChain = tenant.organizations_list ? tenant.organizations_list._count.tenants > 1 : false;

    // Fetch tier details from database (with features) - with fallback
    let tenantTierData = null;
    let orgTierData = null;
    
    try {
      if (tenant.subscription_tier) {
        tenantTierData = await TierService.getTierByKey(tenant.subscription_tier);
      }
      if (tenant.organizations_list?.subscription_tier) {
        orgTierData = await TierService.getTierByKey(tenant.organizations_list.subscription_tier);
      }
    } catch (error) {
      console.warn('[Public Tier API] TierService failed, using fallback data:', error);
    }
    
    // Fallback tier data if TierService fails
    if (!tenantTierData && tenant.subscription_tier) {
      tenantTierData = {
        tierKey: tenant.subscription_tier,
        id: tenant.subscription_tier,
        name: tenant.subscription_tier,
        displayName: tenant.subscription_tier.charAt(0).toUpperCase() + tenant.subscription_tier.slice(1),
        features: [],
        limits: {}
      };
    }
    
    if (!orgTierData && tenant.organizations_list?.subscription_tier) {
      orgTierData = {
        tierKey: tenant.organizations_list.subscription_tier,
        id: tenant.organizations_list.subscription_tier,
        name: tenant.organizations_list.subscription_tier,
        displayName: tenant.organizations_list.subscription_tier.charAt(0).toUpperCase() + tenant.organizations_list.subscription_tier.slice(1),
        features: [],
        limits: {}
      };
    }

    res.json({
      tenantId: tenant.id,
      tier: effectiveTier,
      isChain,
      organizationTier: orgTierData,
      tenantTier: tenantTierData,
      effective: orgTierData || tenantTierData,
    });
  } catch (error) {
    console.error('[GET /tenants/:id/tier/public] Error:', error);
    res.status(500).json({ error: 'Failed to fetch tier information' });
  }
});

/**
 * GET /tenants/:id/tier
 * Get tier information for a specific tenant
 */
router.get('/tenants/:id/tier', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id: tenantId } = req.params;

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        organization_id: true,
        organizations_list: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            _count: {
              select: { tenants: true }
            }
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Determine effective tier (org tier can override tenant tier for chains)
    const effectiveTier = tenant.organizations_list?.subscription_tier || tenant.subscription_tier || 'starter';
    const isChain = tenant.organizations_list ? tenant.organizations_list._count.tenants > 1 : false;

    // Fetch tier details from database (with features) - with fallback
    let tenantTierData = null;
    let orgTierData = null;
    
    try {
      if (tenant.subscription_tier) {
        tenantTierData = await TierService.getTierByKey(tenant.subscription_tier);
      }
      if (tenant.organizations_list?.subscription_tier) {
        orgTierData = await TierService.getTierByKey(tenant.organizations_list.subscription_tier);
      }
    } catch (error) {
      console.warn('[Tier API] TierService failed, using fallback data:', error);
    }
    
    // Fallback tier data if TierService fails
    if (!tenantTierData && tenant.subscription_tier) {
      tenantTierData = {
        tierKey: tenant.subscription_tier,
        name: tenant.subscription_tier,
        displayName: tenant.subscription_tier.charAt(0).toUpperCase() + tenant.subscription_tier.slice(1),
        features: [],
        limits: {
          maxSkus: tenant.subscription_tier === 'starter' ? 500 : 
                   tenant.subscription_tier === 'professional' ? 5000 : 
                   tenant.subscription_tier === 'enterprise' ? null : 
                   tenant.subscription_tier === 'organization' ? null : 250
        }
      };
    }
    
    if (!orgTierData && tenant.organizations_list?.subscription_tier) {
      orgTierData = {
        tierKey: tenant.organizations_list.subscription_tier,
        name: tenant.organizations_list.subscription_tier,
        displayName: tenant.organizations_list.subscription_tier.charAt(0).toUpperCase() + tenant.organizations_list.subscription_tier.slice(1),
        features: [],
        limits: {
          maxSkus: tenant.organizations_list.subscription_tier === 'chain_starter' ? 500 : 
                   tenant.organizations_list.subscription_tier === 'chain_professional' ? 5000 : 
                   tenant.organizations_list.subscription_tier === 'chain_enterprise' ? null : 
                   tenant.organizations_list.subscription_tier === 'chain_organization' ? null : 250
        }
      };
    }

    res.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tier: effectiveTier,
      subscriptionStatus: tenant.subscription_status,
      trialEndsAt: tenant.trial_ends_at,
      subscriptionEndsAt: tenant.subscription_ends_at,
      isChain,
      organizationId: tenant.organizations_list?.id,
      organizationName: tenant.organizations_list?.name,
      organizationTier: orgTierData, // Frontend expects this property name
      tenantTier: tenantTierData,    // Frontend expects this property name
      // Legacy compatibility
      organizationTierData: orgTierData,
    });
  } catch (error) {
    console.error('[GET /tenants/:id/tier] Error:', error);
    res.status(500).json({ error: 'Failed to fetch tier information' });
  }
});

/**
 * GET /tenants/:id/usage
 * Get usage statistics for a specific tenant
 */
router.get('/tenants/:id/usage', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id: tenantId } = req.params;

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        monthly_sku_quota: true,
        skus_added_this_month: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Count current items
    const itemCount = await prisma.inventory_items.count({
      where: { tenant_id:tenantId }
    });

    // Count active items
    const activeItemCount = await prisma.inventory_items.count({
      where: {
        tenant_id:tenantId,
        availability: 'in_stock',
      }
    });

    res.json({
      tenantId: tenant.id,
      currentItems: itemCount,
      activeItems: activeItemCount,
      monthlySkuQuota: tenant.monthly_sku_quota ,
      skusAddedThisMonth: tenant.skus_added_this_month || 0,
      quotaRemaining: tenant.monthly_sku_quota ? tenant.monthly_sku_quota - (tenant.skus_added_this_month || 0) : null,
    });
  } catch (error) {
    console.error('[GET /tenants/:id/usage] Error:', error);
    res.status(500).json({ error: 'Failed to fetch usage information' });
  }
});

export default router;

/**
 * GET /tenants/:id/complete
 * Consolidated endpoint that combines tenant info, tier data, and usage statistics
 * Reduces 3 separate API calls to 1 consolidated call
 */
router.get('/tenants/:id/complete', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id: tenantId } = req.params;

    console.log(`[GET /tenants/:id/complete] Fetching consolidated data for tenant: ${tenantId}`);

    // Execute all queries in parallel for maximum performance
    const [tenant, itemCount, activeItemCount, stats] = await Promise.all([
      // Tenant info with organization data
      prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          organization_id: true,
          subscription_tier: true,
          subscription_status: true,
          trial_ends_at: true,
          subscription_ends_at: true,
          location_status: true,
          subdomain: true,
          created_at: true,
          monthly_sku_quota: true,
          skus_added_this_month: true,
          organizations_list: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
              _count: {
                select: { tenants: true }
              }
            }
          }
        }
      }),

      // Item count
      prisma.inventory_items.count({
        where: { tenant_id: tenantId }
      }),

      // Active item count
      prisma.inventory_items.count({
        where: {
          tenant_id: tenantId,
          availability: 'in_stock',
        }
      }),

      // Stats query
      Promise.resolve().then(async () => {
        const [total, active, inactive, syncing, publicItems, privateItems, lowStock] = await Promise.all([
          prisma.inventory_items.count({
            where: { tenant_id: tenantId, item_status: { not: 'trashed' } }
          }),
          prisma.inventory_items.count({
            where: { tenant_id: tenantId, item_status: 'active', visibility: { not: 'private' } }
          }),
          prisma.inventory_items.count({
            where: { tenant_id: tenantId, item_status: 'inactive', visibility: { not: 'private' } }
          }),
          prisma.inventory_items.count({
            where: { tenant_id: tenantId, item_status: 'active', visibility: { not: 'private' } }
          }),
          prisma.inventory_items.count({
            where: { tenant_id: tenantId, item_status: { not: 'trashed' }, visibility: 'public' }
          }),
          prisma.inventory_items.count({
            where: { tenant_id: tenantId, item_status: { not: 'trashed' }, visibility: 'private' }
          }),
          prisma.inventory_items.count({
            where: { tenant_id: tenantId, item_status: { not: 'trashed' }, stock: { lt: 10 } }
          })
        ]);

        return {
          total,
          active: Math.max(0, active),
          inactive: Math.max(0, inactive),
          syncing: Math.max(0, syncing),
          public: Math.max(0, publicItems),
          private: Math.max(0, privateItems),
          lowStock: Math.max(0, lowStock)
        };
      })
    ]);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get location status info
    const { getLocationStatusInfo } = await import('../utils/location-status');
    const statusInfo = getLocationStatusInfo(tenant.location_status);

    // Determine effective tier (org tier can override tenant tier for chains)
    const effectiveTier = tenant.organizations_list?.subscription_tier || tenant.subscription_tier || 'starter';
    const isChain = tenant.organizations_list ? tenant.organizations_list._count.tenants > 1 : false;

    // Fetch tier details from database (with features) - with fallback
    let tenantTierData = null;
    let orgTierData = null;

    try {
      if (tenant.subscription_tier) {
        tenantTierData = await TierService.getTierByKey(tenant.subscription_tier);
      }
      if (tenant.organizations_list?.subscription_tier) {
        orgTierData = await TierService.getTierByKey(tenant.organizations_list.subscription_tier);
      }
    } catch (error) {
      console.warn('[Complete API] TierService failed, using fallback data:', error);
    }

    // Fallback tier data if TierService fails
    if (!tenantTierData && tenant.subscription_tier) {
      tenantTierData = {
        tierKey: tenant.subscription_tier,
        name: tenant.subscription_tier,
        displayName: tenant.subscription_tier.charAt(0).toUpperCase() + tenant.subscription_tier.slice(1),
        features: [],
        limits: {
          maxSkus: tenant.subscription_tier === 'starter' ? 500 :
                   tenant.subscription_tier === 'professional' ? 5000 :
                   tenant.subscription_tier === 'enterprise' ? null :
                   tenant.subscription_tier === 'organization' ? null : 250
        }
      };
    }

    if (!orgTierData && tenant.organizations_list?.subscription_tier) {
      orgTierData = {
        tierKey: tenant.organizations_list.subscription_tier,
        name: tenant.organizations_list.subscription_tier,
        displayName: tenant.organizations_list.subscription_tier.charAt(0).toUpperCase() + tenant.organizations_list.subscription_tier.slice(1),
        features: [],
        limits: {
          maxSkus: tenant.organizations_list.subscription_tier === 'chain_starter' ? 500 :
                   tenant.organizations_list.subscription_tier === 'chain_professional' ? 5000 :
                   tenant.organizations_list.subscription_tier === 'chain_enterprise' ? null :
                   tenant.organizations_list.subscription_tier === 'chain_organization' ? null : 250
        }
      };
    }

    // Build usage data
    const usage = {
      products: itemCount,
      activeProducts: activeItemCount,
      monthlySkuQuota: tenant.monthly_sku_quota,
      skusAddedThisMonth: tenant.skus_added_this_month || 0,
      quotaRemaining: tenant.monthly_sku_quota ? tenant.monthly_sku_quota - (tenant.skus_added_this_month || 0) : null,
      locations: 1, // Current tenant location
      users: 1, // Placeholder - would need user count query
      apiCalls: 0, // Placeholder
      storageGB: 0 // Placeholder
    };

    // Build tier data
    const tier = {
      tier: effectiveTier,
      status: tenant.subscription_status,
      subscriptionStatus: tenant.subscription_status,
      trialEndsAt: tenant.trial_ends_at,
      subscriptionEndsAt: tenant.subscription_ends_at,
      isChain,
      organizationId: tenant.organizations_list?.id,
      organizationName: tenant.organizations_list?.name,
      organizationTier: orgTierData,
      tenantTier: tenantTierData,
      effective: orgTierData || tenantTierData,
    };

    // Build tenant data
    const tenantData = {
      id: tenant.id,
      name: tenant.name,
      organizationId: tenant.organization_id,
      subscriptionTier: tenant.subscription_tier,
      subscriptionStatus: tenant.subscription_status,
      locationStatus: tenant.location_status,
      subdomain: tenant.subdomain,
      createdAt: tenant.created_at,
      statusInfo,
      stats: {
        productCount: itemCount,
        userCount: 1, // Placeholder
      }
    };

    const response = {
      tenant: tenantData,
      tier,
      usage,
      _timestamp: new Date().toISOString()
    };

    console.log(`[GET /tenants/:id/complete] Returning consolidated data for tenant ${tenantId}`);

    // Cache for 30 seconds (tenant data changes moderately frequently)
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.setHeader('Vary', 'Authorization');

    res.json(response);
  } catch (error) {
    console.error('[GET /tenants/:id/complete] Error:', error);
    res.status(500).json({ error: 'Failed to fetch complete tenant data' });
  }
});
