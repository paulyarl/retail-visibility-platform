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
