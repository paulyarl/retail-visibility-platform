/**
 * Tenant Organization Membership Validation
 * 
 * Enforces good standing requirements for organization membership
 * to protect organization tier value and encourage upgrades.
 */

import { prisma } from '../prisma';

/**
 * Check if tenant is in good standing for organization membership
 * 
 * Good Standing Requirements:
 * - Valid tier (not google_only - maintenance tier)
 * - Valid status (active, past_due, or trial)
 * - Not canceled, expired, or frozen
 */
export async function isTenantInGoodStanding(tenantId: string): Promise<{
  valid: boolean;
  reason?: string;
  tenant?: {
    subscription_tier: string;
    subscription_status: string;
    trial_ends_at?: Date | null;
  };
}> {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
      },
    });

    if (!tenant) {
      return { valid: false, reason: 'tenant_not_found' };
    }

    // Handle null values with defaults
    const tier = tenant.subscription_tier || 'starter';
    const status = tenant.subscription_status || 'active';

    // 1. Check tier - exclude google_only (maintenance tier)
    const validTiers = [
      'starter', 'professional', 'enterprise',
      'chain_starter', 'chain_professional', 'chain_enterprise'
    ];
    
    if (!validTiers.includes(tier)) {
      return { 
        valid: false, 
        reason: 'invalid_tier',
        tenant: {
          subscription_tier: tier,
          subscription_status: status,
          trial_ends_at: tenant.trial_ends_at,
        }
      };
    }

    // 2. Check status - allow active, past_due, trial
    const validStatuses = ['active', 'past_due', 'trial'];
    
    if (!validStatuses.includes(status)) {
      return { 
        valid: false, 
        reason: 'invalid_status',
        tenant: {
          subscription_tier: tier,
          subscription_status: status,
          trial_ends_at: tenant.trial_ends_at,
        }
      };
    }

    // 3. For trial status, check if trial is still valid
    if (status === 'trial' && tenant.trial_ends_at) {
      const now = new Date();
      if (now > tenant.trial_ends_at) {
        return { 
          valid: false, 
          reason: 'trial_expired',
          tenant: {
            subscription_tier: tier,
            subscription_status: status,
            trial_ends_at: tenant.trial_ends_at,
          }
        };
      }
    }

    return { 
      valid: true, 
      tenant: {
        subscription_tier: tier,
        subscription_status: status,
        trial_ends_at: tenant.trial_ends_at,
      }
    };

  } catch (error) {
    console.error('[isTenantInGoodStanding] Error:', error);
    return { valid: false, reason: 'validation_error' };
  }
}

/**
 * Validate tenant can join/update organization membership
 */
export async function validateTenantOrganizationMembership(
  tenantId: string,
  organizationId?: string | null
): Promise<{
  valid: boolean;
  reason?: string;
  message?: string;
}> {
  // If no organization_id being set, no validation needed
  if (!organizationId) {
    return { valid: true };
  }

  // Check tenant good standing
  const standingCheck = await isTenantInGoodStanding(tenantId);
  
  if (!standingCheck.valid) {
    const messages = {
      tenant_not_found: 'Tenant not found',
      invalid_tier: 'Tenant must be on a paid tier to join an organization. Google-only tier is not eligible for organization membership.',
      invalid_status: 'Tenant subscription must be active, past due, or in trial to join an organization.',
      trial_expired: 'Tenant trial has expired. Please upgrade to a paid plan to join an organization.',
      validation_error: 'Unable to validate tenant status. Please try again.',
    };

    return {
      valid: false,
      reason: standingCheck.reason,
      message: messages[standingCheck.reason as keyof typeof messages] || 'Tenant does not meet organization membership requirements.'
    };
  }

  return { valid: true };
}

/**
 * Middleware function to validate organization membership
 */
export function requireGoodStandingForOrganization() {
  return async (req: any, res: any, next: any) => {
    const { organizationId } = req.body;
    const { id: tenantId } = req.params;

    // Only validate if organization_id is being set
    if (!organizationId) {
      return next();
    }

    const validation = await validateTenantOrganizationMembership(tenantId, organizationId);
    
    if (!validation.valid) {
      return res.status(403).json({
        error: 'organization_membership_denied',
        message: validation.message,
        reason: validation.reason,
      });
    }

    next();
  };
}
