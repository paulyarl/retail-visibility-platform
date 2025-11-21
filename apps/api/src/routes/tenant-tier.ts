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
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            subscription_tier: true,
            _count: {
              select: { tenant: true }
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
    const isChain = tenant.organization ? tenant.organization._count.tenants > 1 : false;

    // Fetch tier details from database (with features)
    const tenantTierData = tenant.subscriptionTier ? await TierService.getTierByKey(tenant.subscriptionTier) : null;
    const orgTierData = tenant.organization?.subscriptionTier ? await TierService.getTierByKey(tenant.organization.subscriptionTier) : null;

    res.json({
      tenant_id: tenant.id,
      tenantName: tenant.name,
      tier: effectiveTier,
      subscription_status: tenant.subscription_status,
      trial_ends_at: tenant.trialEndsAt,
      subscription_ends_at: tenant.subscriptionEndsAt,
      isChain,
      organizationId: tenant.organizationId,
      organizationName: tenant.organization?.name,
      organizationTier: tenant.organization?.subscriptionTier,
      // Include full tier data with features from database
      tenantTier: tenantTierData,
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
    const itemCount = await prisma.inventoryItem.count({
      where: { tenantId }
    });

    // Count active items
    const activeItemCount = await prisma.inventoryItem.count({
      where: {
        tenantId,
        availability: 'in_stock'
      }
    });

    res.json({
      tenant_id: tenant.id,
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
