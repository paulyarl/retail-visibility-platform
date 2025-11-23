import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import TierService from '../services/TierService';

const router = Router();

/**
 * GET /tenants/:id/tier
 * Get tier information for a specific tenant
 */
router.get('/tenants/:id/tier', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id: tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            _count: {
              select: { Tenant: true }
            }
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Determine effective tier (org tier can override tenant tier for chains)
    const effectiveTier = tenant.organization?.subscriptionTier || tenant.subscriptionTier || 'starter';
    const isChain = tenant.organization ? tenant.organization._count.Tenant > 1 : false;

    // Fetch tier details from database (with features) - with fallback
    let tenantTierData = null;
    let orgTierData = null;
    
    try {
      if (tenant.subscriptionTier) {
        tenantTierData = await TierService.getTierByKey(tenant.subscriptionTier);
      }
      if (tenant.organization?.subscriptionTier) {
        orgTierData = await TierService.getTierByKey(tenant.organization.subscriptionTier);
      }
    } catch (error) {
      console.warn('[Tier API] TierService failed, using fallback data:', error);
    }
    
    // Fallback tier data if TierService fails
    if (!tenantTierData && tenant.subscriptionTier) {
      tenantTierData = {
        tierKey: tenant.subscriptionTier,
        name: tenant.subscriptionTier,
        display_name: tenant.subscriptionTier.charAt(0).toUpperCase() + tenant.subscriptionTier.slice(1),
        features: [],
        limits: {
          maxSKUs: tenant.subscriptionTier === 'starter' ? 500 : 
                   tenant.subscriptionTier === 'professional' ? 5000 : 
                   tenant.subscriptionTier === 'enterprise' ? null : 
                   tenant.subscriptionTier === 'organization' ? null : 250
        }
      };
    }
    
    if (!orgTierData && tenant.organization?.subscriptionTier) {
      orgTierData = {
        tierKey: tenant.organization.subscriptionTier,
        name: tenant.organization.subscriptionTier,
        display_name: tenant.organization.subscriptionTier.charAt(0).toUpperCase() + tenant.organization.subscriptionTier.slice(1),
        features: [],
        limits: {
          maxSKUs: tenant.organization.subscriptionTier === 'starter' ? 500 : 
                   tenant.organization.subscriptionTier === 'professional' ? 5000 : 
                   tenant.organization.subscriptionTier === 'enterprise' ? null : 
                   tenant.organization.subscriptionTier === 'organization' ? null : 250
        }
      };
    }

    res.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tier: effectiveTier,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      subscriptionEndsAt: tenant.subscriptionEndsAt,
      isChain,
      organizationId: tenant.organizationId,
      organizationName: tenant.organization?.name,
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

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        monthlySkuQuota: true,
        skusAddedThisMonth: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Count current items
    const itemCount = await prisma.InventoryItem.count({
      where: { tenantId }
    });

    // Count active items
    const activeItemCount = await prisma.InventoryItem.count({
      where: {
        tenantId,
        availability: 'inStock'
      }
    });

    res.json({
      tenantId: tenant.id,
      currentItems: itemCount,
      activeItems: activeItemCount,
      monthlySkuQuota: tenant.monthlySkuQuota,
      skusAddedThisMonth: tenant.skusAddedThisMonth || 0,
      quotaRemaining: tenant.monthlySkuQuota ? tenant.monthlySkuQuota - (tenant.skusAddedThisMonth || 0) : null,
    });
  } catch (error) {
    console.error('[GET /tenants/:id/usage] Error:', error);
    res.status(500).json({ error: 'Failed to fetch usage information' });
  }
});

export default router;
