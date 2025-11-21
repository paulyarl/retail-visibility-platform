/**
 * Tier Validation Middleware
 * 
 * Centralized tier validation to ensure:
 * 1. Only valid tiers can be assigned (now database-driven)
 * 2. Organization tier requires an organization
 * 3. Organization exists and is valid
 * 
 * Fix once, apply everywhere!
 * 
 * MIGRATION NOTE: Now uses TierService for database-driven tier validation.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import TierService from '../services/TierService';

type SubscriptionTier = 'trial' | 'google_only' | 'starter' | 'professional' | 'enterprise' | 'organization';

// LEGACY: Kept for fallback only
const VALID_TIERS: SubscriptionTier[] = [
  'trial',
  'google_only',
  'starter',
  'professional',
  'enterprise',
  'organization',
];

/**
 * Validate tier assignment for tenant creation or update
 */
export async function validateTierAssignment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { subscriptionTier, organizationId } = req.body;
    const tenantId = req.params.id;

    // Skip if no tier being set
    if (!subscriptionTier) {
      return next();
    }

    // Validate tier exists (database-driven with fallback)
    const isValid = await TierService.isValidTier(subscriptionTier).catch(() => 
      VALID_TIERS.includes(subscriptionTier)
    );
    
    if (!isValid) {
      const validTiers = await TierService.getValidTierKeys().catch(() => VALID_TIERS);
      return res.status(400).json({
        error: 'invalid_tier',
        message: `Invalid subscription tier: ${subscriptionTier}`,
        validTiers,
      });
    }

    // Organization tier requires organization
    if (subscriptionTier === 'organization') {
      // Check for organizationId in body or existing tenant link
      let orgId = organizationId;

      // If updating existing tenant, check if already linked to org
      if (tenantId && !orgId) {
        const existingTenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { organizationId: true },
        });
        orgId = existingTenant?.organizationId;
      }

      if (!orgId) {
        return res.status(400).json({
          error: 'organization_required',
          message: 'Organization tier requires tenant to belong to an organization',
          hint: 'Provide organizationId or link tenant to organization first',
        });
      }

      // Validate organization exists
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!org) {
        return res.status(404).json({
          error: 'organization_not_found',
          message: `Organization ${orgId} does not exist`,
        });
      }

      console.log(`[Tier Validation] Organization tier validated for org: ${org.name}`);
    }

    console.log(`[Tier Validation] Tier ${subscriptionTier} validated successfully`);
    next();
  } catch (error) {
    console.error('[validateTierAssignment] Error:', error);
    return res.status(500).json({
      error: 'tier_validation_failed',
      message: 'Failed to validate tier assignment',
    });
  }
}

/**
 * Validate tier is compatible with tenant's current state
 * Used for updates to ensure tier change is safe
 */
export async function validateTierCompatibility(
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

    // Get tenant's current state
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionTier: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'tenant_not_found',
        message: 'Tenant does not exist',
      });
    }

    // If changing TO organization tier, must have organization
    if (subscriptionTier === 'organization') {
      const tenantWithOrg = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { organizationId: true },
      });
      
      if (!tenantWithOrg?.organizationId) {
        return res.status(400).json({
          error: 'organization_required',
          message: 'Cannot set organization tier: tenant not linked to any organization',
          hint: 'Link tenant to organization first',
        });
      }
    }

    // If changing FROM organization tier, warn about losing features
    if (tenant.subscriptionTier === 'organization' && subscriptionTier !== 'organization') {
      console.warn(`[Tier Validation] WARNING: Changing tenant ${tenantId} from organization tier to ${subscriptionTier}`);
      // Allow but log warning - admin may be intentionally removing from org
    }

    next();
  } catch (error) {
    console.error('[validateTierCompatibility] Error:', error);
    return res.status(500).json({
      error: 'tier_compatibility_check_failed',
      message: 'Failed to validate tier compatibility',
    });
  }
}

/**
 * Middleware to check if tenant has required tier for propagation
 * Returns a middleware function that validates tier access for specific propagation types
 */
export function requirePropagationTier(
  propagationType: 'products' | 'user_roles' | 'hours' | 'profile' | 'categories' | 'gbp' | 'flags' | 'brand_assets'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.params.tenantId || req.params.id;
      
      if (!tenantId) {
        return res.status(400).json({
          error: 'tenantId_required',
          message: 'Tenant ID is required'
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          organization: {
            select: {
              id: true,
              subscriptionTier: true,
              _count: { select: { Tenant: true }
              }
            }
          }
        }
      });

      if (!tenant) {
        return res.status(404).json({ 
          error: 'tenant_not_found',
          message: 'Tenant not found'
        });
      }

      // Get effective tier (org tier overrides tenant tier)
      const effectiveTier = tenant.organization?.subscriptionTier || tenant.subscriptionTier || 'starter';
      
      // Check if user has 2+ locations
      const locationCount = tenant.organization?._count.tenant || 1;
      if (locationCount < 2) {
        return res.status(403).json({
          error: 'insufficient_locations',
          message: 'Propagation requires 2 or more locations. Upgrade your plan to add more locations.',
          currentLocations: locationCount,
          requiredLocations: 2,
          propagationType
        });
      }

      // Define tier requirements for each propagation type
      const tierRequirements: Record<string, string[]> = {
        products: ['starter', 'professional', 'enterprise', 'organization'],
        user_roles: ['starter', 'professional', 'enterprise', 'organization'],
        hours: ['professional', 'enterprise', 'organization'],
        profile: ['professional', 'enterprise', 'organization'],
        categories: ['professional', 'enterprise', 'organization'],
        gbp: ['professional', 'enterprise', 'organization'],
        flags: ['professional', 'enterprise', 'organization'],
        brand_assets: ['organization']
      };

      const allowedTiers = tierRequirements[propagationType] || [];
      if (!allowedTiers.includes(effectiveTier)) {
        const requiredTier = allowedTiers[0];
        return res.status(403).json({
          error: 'tier_upgrade_required',
          message: `${propagationType.replace('_', ' ')} propagation requires ${requiredTier} tier or higher`,
          currentTier: effectiveTier,
          requiredTier,
          propagationType,
          upgradeUrl: '/settings/subscription'
        });
      }

      next();
    } catch (error) {
      console.error('[requirePropagationTier] Error:', error);
      return res.status(500).json({
        error: 'tier_validation_failed',
        message: 'Failed to validate tier requirements'
      });
    }
  };
}
