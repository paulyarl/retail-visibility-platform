/**
 * Organization Validation Middleware
 * 
 * Centralized organization tier validation to ensure:
 * 1. Only valid organization tiers can be assigned
 * 2. Organization limits are validated
 * 3. Consistent with tenant tier system
 * 
 * Fix once, apply everywhere!
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { isValidTier, getAllTiers } from '../services/TierService';
import { logger } from '../logger';

/**
 * Validate organization tier assignment
 * Uses dynamic tier data from subscription_tiers_list table
 */
export async function validateOrganizationTier(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier, subscription_tier } = req.body;
    const tier = subscriptionTier || subscription_tier;

    // Skip if no tier being set
    if (!tier) {
      return next();
    }

    // Get all tiers and filter for organization type
    const allTiers = await getAllTiers();
    const orgTiers = allTiers.filter(t => t.tier_type === 'organization');
    const validTierKeys = orgTiers.map(t => t.tier_key);

    // Validate tier exists and is organization type
    if (!validTierKeys.includes(tier)) {
      return res.status(400).json({
        error: 'invalid_organization_tier',
        message: `Invalid organization tier: ${tier}`,
        validTiers: validTierKeys,
      });
    }

    console.log(`[Organization Validation] Tier ${tier} validated successfully`);
    next();
  } catch (error) {
    logger.error('[validateOrganizationTier] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'organization_tier_validation_failed',
      message: 'Failed to validate organization tier',
    });
  }
}

/**
 * Validate organization limits are within tier constraints
 * Uses dynamic tier data from subscription_tiers_list table
 */
export async function validateOrganizationLimits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier, subscription_tier, maxLocations, maxTotalSKUs } = req.body;
    const tier = subscriptionTier || subscription_tier;

    if (!tier) {
      return next();
    }

    // Get tier limits from database
    const allTiers = await getAllTiers();
    const tierData = allTiers.find(t => t.tier_key === tier);

    if (!tierData) {
      return next(); // Already validated by validateOrganizationTier
    }

    const limits = {
      maxLocations: tierData.max_locations ?? Infinity,
      maxTotalSKUs: tierData.max_skus ?? Infinity,
    };

    // Validate maxLocations
    if (maxLocations !== undefined) {
      if (limits.maxLocations !== Infinity && maxLocations > limits.maxLocations) {
        return res.status(400).json({
          error: 'max_locations_exceeded',
          message: `${tier} tier allows maximum ${limits.maxLocations} locations`,
          requested: maxLocations,
          limit: limits.maxLocations,
        });
      }
    }

    // Validate maxTotalSKUs
    if (maxTotalSKUs !== undefined) {
      if (limits.maxTotalSKUs !== Infinity && maxTotalSKUs > limits.maxTotalSKUs) {
        return res.status(400).json({
          error: 'max_skus_exceeded',
          message: `${tier} tier allows maximum ${limits.maxTotalSKUs} total SKUs`,
          requested: maxTotalSKUs,
          limit: limits.maxTotalSKUs,
        });
      }
    }

    console.log(`[Organization Validation] Limits validated for ${tier}`);
    next();
  } catch (error) {
    logger.error('[validateOrganizationLimits] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'organization_limits_validation_failed',
      message: 'Failed to validate organization limits',
    });
  }
}

/**
 * Validate organization tier change doesn't violate current usage
 * Uses dynamic tier data from subscription_tiers_list table
 */
export async function validateOrganizationTierChange(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier, subscription_tier } = req.body;
    const tier = subscriptionTier || subscription_tier;
    const { id: organizationId } = req.params;

    if (!tier || !organizationId) {
      return next();
    }

    // Get organization's current state
    const org = await prisma.organizations_list.findUnique({
      where: { id: organizationId },
      select: {
        subscription_tier: true,
        max_locations: true,
        max_total_skus: true,
        tenants: {
          select: {
            id: true,
            _count: {
              select: { inventory_items: true },
            },
          },
        },
      },
    });

    if (!org) {
      return res.status(404).json({
        error: 'organization_not_found',
        message: 'Organization does not exist',
      });
    }

    // Get tier limits from database
    const allTiers = await getAllTiers();
    const tierData = allTiers.find(t => t.tier_key === tier);

    if (!tierData) {
      return next(); // Already validated by validateOrganizationTier
    }

    const newLimits = {
      maxLocations: tierData.max_locations ?? Infinity,
      maxTotalSKUs: tierData.max_skus ?? Infinity,
    };

    // Check current location count
    const currentLocationCount = org.tenants.length;
    if (newLimits.maxLocations !== Infinity && currentLocationCount > newLimits.maxLocations) {
      return res.status(403).json({
        error: 'tier_change_blocked',
        message: `Cannot change to ${tier}: organization has ${currentLocationCount} locations, new tier limit is ${newLimits.maxLocations}`,
        currentLocations: currentLocationCount,
        newLimit: newLimits.maxLocations,
        hint: 'Remove locations before downgrading tier',
      });
    }

    // Check total SKU count
    const totalSKUs = org.tenants.reduce((sum: number, tenants) => sum + tenants._count.inventory_items, 0);
    if (newLimits.maxTotalSKUs !== Infinity && totalSKUs > newLimits.maxTotalSKUs) {
      return res.status(403).json({
        error: 'tier_change_blocked',
        message: `Cannot change to ${tier}: organization has ${totalSKUs} total SKUs, new tier limit is ${newLimits.maxTotalSKUs}`,
        currentSKUs: totalSKUs,
        newLimit: newLimits.maxTotalSKUs,
        hint: 'Reduce SKU count before downgrading tier',
      });
    }

    console.log(`[Organization Validation] Tier change validated: ${currentLocationCount} locations, ${totalSKUs} SKUs fits in ${tier}`);
    next();
  } catch (error) {
    logger.error('[validateOrganizationTierChange] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'organization_tier_change_validation_failed',
      message: 'Failed to validate organization tier change',
    });
  }
}
