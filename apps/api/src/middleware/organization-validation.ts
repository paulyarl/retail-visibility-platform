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

type OrganizationTier = 'chain_starter' | 'chain_professional' | 'chain_enterprise';

const VALID_ORG_TIERS: OrganizationTier[] = [
  'chain_starter',
  'chain_professional',
  'chain_enterprise',
];

/**
 * Validate organization tier assignment
 */
export async function validateOrganizationTier(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier } = req.body;

    // Skip if no tier being set
    if (!subscriptionTier) {
      return next();
    }

    // Validate tier exists
    if (!VALID_ORG_TIERS.includes(subscriptionTier)) {
      return res.status(400).json({
        error: 'invalid_organization_tier',
        message: `Invalid organization tier: ${subscriptionTier}`,
        validTiers: VALID_ORG_TIERS,
      });
    }

    console.log(`[Organization Validation] Tier ${subscriptionTier} validated successfully`);
    next();
  } catch (error) {
    console.error('[validateOrganizationTier] Error:', error);
    return res.status(500).json({
      error: 'organization_tier_validation_failed',
      message: 'Failed to validate organization tier',
    });
  }
}

/**
 * Validate organization limits are within tier constraints
 */
export async function validateOrganizationLimits(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier, maxLocations, maxTotalSKUs } = req.body;

    if (!subscriptionTier) {
      return next();
    }

    // Define tier limits
    const tierLimits: Record<OrganizationTier, { maxLocations: number; maxTotalSKUs: number }> = {
      chain_starter: {
        maxLocations: 5,
        maxTotalSKUs: 2500,
      },
      chain_professional: {
        maxLocations: 25,
        maxTotalSKUs: 12500,
      },
      chain_enterprise: {
        maxLocations: Infinity,
        maxTotalSKUs: Infinity,
      },
    };

    const limits = tierLimits[subscriptionTier as OrganizationTier];
    if (!limits) {
      return next(); // Already validated by validateOrganizationTier
    }

    // Validate maxLocations
    if (maxLocations !== undefined) {
      if (limits.maxLocations !== Infinity && maxLocations > limits.maxLocations) {
        return res.status(400).json({
          error: 'max_locations_exceeded',
          message: `${subscriptionTier} tier allows maximum ${limits.maxLocations} locations`,
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
          message: `${subscriptionTier} tier allows maximum ${limits.maxTotalSKUs} total SKUs`,
          requested: maxTotalSKUs,
          limit: limits.maxTotalSKUs,
        });
      }
    }

    console.log(`[Organization Validation] Limits validated for ${subscriptionTier}`);
    next();
  } catch (error) {
    console.error('[validateOrganizationLimits] Error:', error);
    return res.status(500).json({
      error: 'organization_limits_validation_failed',
      message: 'Failed to validate organization limits',
    });
  }
}

/**
 * Validate organization tier change doesn't violate current usage
 */
export async function validateOrganizationTierChange(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier } = req.body;
    const { id: organizationId } = req.params;

    if (!subscriptionTier || !organizationId) {
      return next();
    }

    // Get organization's current state
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionTier: true,
        maxLocations: true,
        maxTotalSKUs: true,
        tenants: {
          select: {
            id: true,
            _count: {
              select: { items: true },
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

    // Define tier limits
    const tierLimits: Record<OrganizationTier, { maxLocations: number; maxTotalSKUs: number }> = {
      chain_starter: {
        maxLocations: 5,
        maxTotalSKUs: 2500,
      },
      chain_professional: {
        maxLocations: 25,
        maxTotalSKUs: 12500,
      },
      chain_enterprise: {
        maxLocations: Infinity,
        maxTotalSKUs: Infinity,
      },
    };

    const newLimits = tierLimits[subscriptionTier as OrganizationTier];
    if (!newLimits) {
      return next(); // Already validated by validateOrganizationTier
    }

    // Check current location count
    const currentLocationCount = org.tenants.length;
    if (newLimits.maxLocations !== Infinity && currentLocationCount > newLimits.maxLocations) {
      return res.status(403).json({
        error: 'tier_change_blocked',
        message: `Cannot change to ${subscriptionTier}: organization has ${currentLocationCount} locations, new tier limit is ${newLimits.maxLocations}`,
        currentLocations: currentLocationCount,
        newLimit: newLimits.maxLocations,
        hint: 'Remove locations before downgrading tier',
      });
    }

    // Check total SKU count
    const totalSKUs = org.tenants.reduce((sum, tenant) => sum + tenant._count.items, 0);
    if (newLimits.maxTotalSKUs !== Infinity && totalSKUs > newLimits.maxTotalSKUs) {
      return res.status(403).json({
        error: 'tier_change_blocked',
        message: `Cannot change to ${subscriptionTier}: organization has ${totalSKUs} total SKUs, new tier limit is ${newLimits.maxTotalSKUs}`,
        currentSKUs: totalSKUs,
        newLimit: newLimits.maxTotalSKUs,
        hint: 'Reduce SKU count before downgrading tier',
      });
    }

    console.log(`[Organization Validation] Tier change validated: ${currentLocationCount} locations, ${totalSKUs} SKUs fits in ${subscriptionTier}`);
    next();
  } catch (error) {
    console.error('[validateOrganizationTierChange] Error:', error);
    return res.status(500).json({
      error: 'organization_tier_change_validation_failed',
      message: 'Failed to validate organization tier change',
    });
  }
}
