/**
 * SKU Limit Validation Middleware
 * 
 * Centralized SKU limit enforcement to ensure:
 * 1. Product creation respects tier limits
 * 2. Bulk operations don't exceed limits
 * 3. Tier changes validate current SKU count
 * 
 * Fix once, apply everywhere!
 * 
 * MIGRATION NOTE: Now uses TierService for database-driven SKU limits.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { getSKULimit } from '../utils/tier-limits';
import TierService from '../services/TierService';
import { getMaintenanceState } from '../utils/subscription-status';

/**
 * Validate SKU limits for product creation/import
 */
export async function validateSKULimits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { tenantId, productCount } = req.body;
    const { tenant_id: paramTenantId } = req.params;
    
    const actualTenantId = tenantId || paramTenantId;
    
    if (!actualTenantId || !productCount || productCount === 0) {
      return next();
    }

    // Get tenant with tier, status, and current SKU count
    const tenant = await prisma.tenant.findUnique({
      where: { id: actualTenantId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        _count: {
          select: { inventoryItems: true },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'tenant_not_found',
        message: 'Tenant does not exist',
      });
    }

    const tier = tenant.subscriptionTier || 'starter';
    const status = tenant.subscriptionStatus || 'active';

    const maintenanceState = getMaintenanceState({
      tier,
      status,
      trialEndsAt: tenant.trialEndsAt ?? undefined,
    });

    // In maintenance mode, block growth (bulk product creation) even if numeric limits not reached
    if (maintenanceState === 'maintenance') {
      return res.status(403).json({
        error: 'maintenance_no_growth',
        message:
          'Your account is in maintenance mode. You can update existing products, but cannot add new products until you upgrade.',
        subscription_tier: tier,
        subscription_status: status,
        maintenanceState,
        requested: productCount,
        upgradeUrl: '/settings/subscription',
      });
    }

    // Try database-driven limit first, fallback to utility function
    const skuLimit = await TierService.getTierSKULimit(tier).catch(() => getSKULimit(tier));
    const currentCount = tenant._count.inventoryItems;
    const totalAfter = currentCount + productCount;

    // Check if adding products would exceed limit
    if (skuLimit !== Infinity && totalAfter > skuLimit) {
      return res.status(403).json({
        error: 'sku_limit_exceeded',
        message: `Adding ${productCount} products would exceed ${tier} tier limit of ${skuLimit} SKUs`,
        current: currentCount,
        limit: skuLimit,
        requested: productCount,
        totalAfter,
        availableSlots: skuLimit - currentCount,
      });
    }

    console.log(`[SKU Limits] Validated: ${currentCount} + ${productCount} = ${totalAfter} / ${skuLimit} for tier ${tier}`);
    next();
  } catch (error) {
    console.error('[validateSKULimits] Error:', error);
    return res.status(500).json({
      error: 'sku_validation_failed',
      message: 'Failed to validate SKU limits',
    });
  }
}

/**
 * Validate tier change doesn't violate current SKU count
 */
export async function validateTierSKUCompatibility(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier } = req.body;
    const { id: tenantId } = req.params;
    
    if (!subscriptionTier || !tenantId) {
      return next();
    }

    // Get tenant's current SKU count
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionTier: true,
        _count: {
          select: { inventoryItems: true },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'tenant_not_found',
        message: 'Tenant does not exist',
      });
    }

    // Try database-driven limit first, fallback to utility function
    const newLimit = await TierService.getTierSKULimit(subscriptionTier).catch(() => getSKULimit(subscriptionTier));
    const currentCount = tenant._count.inventoryItems; 

    // Check if current SKU count exceeds new tier limit
    if (newLimit !== Infinity && currentCount > newLimit) {
      return res.status(403).json({
        error: 'tier_change_blocked',
        message: `Cannot change to ${subscriptionTier} tier: tenant has ${currentCount} SKUs, new tier limit is ${newLimit}`,
        current: currentCount,
        newLimit,
        currentTier: tenant.subscriptionTier,
        requestedTier: subscriptionTier,
        excessSKUs: currentCount - newLimit,
        hint: 'Reduce SKU count before changing tier, or choose a higher tier',
      });
    }

    console.log(`[SKU Limits] Tier change validated: ${currentCount} SKUs fits in ${subscriptionTier} limit of ${newLimit}`);
    next();
  } catch (error) {
    console.error('[validateTierSKUCompatibility] Error:', error);
    return res.status(500).json({
      error: 'tier_sku_compatibility_check_failed',
      message: 'Failed to validate tier SKU compatibility',
    });
  }
}
