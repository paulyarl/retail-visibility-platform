// Tenant-level permission middleware
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { UserRole, UserTenantRole } from '@prisma/client';
import { isPlatformAdmin } from '../utils/platform-admin';
import { getTenantLimit, getTenantLimitConfig, canCreateTenant } from '../config/tenant-limits';

/**
 * Get tenant ID from request
 */
function getTenantIdFromRequest(req: Request): string | null {
  return (
    req.params.tenantId ||
    req.params.id ||
    (req.query.tenantId as string) ||
    req.body.tenantId ||
    null
  );
}

/**
 * Get user's role for a specific tenant
 */
export async function getUserTenantRole(
  userId: string,
  tenantId: string
): Promise<UserTenantRole | null> {
  const userTenant = await prisma.userTenant.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  return userTenant?.role || null;
}

/**
 * Middleware to check if user has required tenant-level role
 */
export function requireTenantRole(...allowedRoles: UserTenantRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'authentication_required',
          message: 'Not authenticated',
        });
      }

      // Platform admins bypass tenant role checks
      if (isPlatformAdmin(req.user)) {
        return next();
      }

      const tenantId = getTenantIdFromRequest(req);
      if (!tenantId) {
        return res.status(400).json({
          error: 'tenant_id_required',
          message: 'Tenant ID is required',
        });
      }

      const userRole = await getUserTenantRole(req.user.userId, tenantId);

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'insufficient_tenant_permissions',
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          required: allowedRoles,
          current: userRole,
        });
      }

      next();
    } catch (error) {
      console.error('[requireTenantRole] Error:', error);
      return res.status(500).json({
        error: 'permission_check_failed',
        message: 'Failed to verify permissions',
      });
    }
  };
}

/**
 * Middleware to check if user can manage tenant (OWNER or ADMIN only)
 */
export const requireTenantAdmin = requireTenantRole(
  UserTenantRole.OWNER,
  UserTenantRole.ADMIN
);

/**
 * Middleware to check if user can manage inventory (all except VIEWER)
 */
export const requireInventoryAccess = requireTenantRole(
  UserTenantRole.OWNER,
  UserTenantRole.ADMIN,
  UserTenantRole.MEMBER
);

/**
 * Check if user can create tenants based on their subscription tier
 * 
 * This checks the user's highest tier across all their owned tenants
 * and enforces location limits accordingly.
 */
export async function checkTenantCreationLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Not authenticated',
      });
    }

    // Platform admins can create unlimited tenants
    if (isPlatformAdmin(req.user)) {
      return next();
    }

    // Count user's owned tenants
    const ownedTenants = await prisma.userTenant.findMany({
      where: {
        userId: req.user.userId,
        role: UserTenantRole.OWNER,
      },
      include: {
        tenant: {
          select: {
            subscriptionTier: true,
            subscriptionStatus: true,
          },
        },
      },
    });

    const ownedTenantCount = ownedTenants.length;

    // Determine user's effective tier (highest tier they own)
    // Tier hierarchy: organization > enterprise > professional > starter > google_only
    const tierPriority: Record<string, number> = {
      organization: 5,
      enterprise: 4,
      professional: 3,
      starter: 2,
      google_only: 1,
    };

    let effectiveTier = 'starter';
    let effectiveStatus = 'trial';
    let highestPriority = 0;

    for (const ut of ownedTenants) {
      const tier = ut.tenant.subscriptionTier || 'starter';
      const status = ut.tenant.subscriptionStatus || 'trial';
      const priority = tierPriority[tier] || 0;
      
      if (priority > highestPriority) {
        highestPriority = priority;
        effectiveTier = tier;
        effectiveStatus = status;
      }
    }

    // Get limit for effective tier and status
    // CRITICAL: Trial status overrides tier limits (always 1 location)
    const limitConfig = getTenantLimitConfig(effectiveTier, effectiveStatus);
    const limit = limitConfig.limit;

    // Check if user can create more tenants
    if (!canCreateTenant(ownedTenantCount, effectiveTier, effectiveStatus)) {
      return res.status(403).json({
        error: 'tenant_limit_reached',
        message: limitConfig.upgradeMessage || `Your ${effectiveTier} plan allows ${limit === Infinity ? 'unlimited' : limit} location(s). You currently have ${ownedTenantCount}.`,
        current: ownedTenantCount,
        limit: limit === Infinity ? 'unlimited' : limit,
        tier: effectiveTier,
        status: effectiveStatus,
        upgradeToTier: limitConfig.upgradeToTier,
        upgradeMessage: limitConfig.upgradeMessage,
      });
    }

    next();
  } catch (error) {
    console.error('[checkTenantCreationLimit] Error:', error);
    return res.status(500).json({
      error: 'limit_check_failed',
      message: 'Failed to verify tenant creation limit',
    });
  }
}

/**
 * Check if user can delete a tenant (must be OWNER)
 */
export async function requireTenantOwner(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Not authenticated',
      });
    }

    // Platform admins can delete any tenant
    if (isPlatformAdmin(req.user)) {
      return next();
    }

    const tenantId = getTenantIdFromRequest(req);
    if (!tenantId) {
      return res.status(400).json({
        error: 'tenant_id_required',
        message: 'Tenant ID is required',
      });
    }

    const userRole = await getUserTenantRole(req.user.userId, tenantId);

    if (userRole !== UserTenantRole.OWNER) {
      return res.status(403).json({
        error: 'owner_required',
        message: 'Only the tenant owner can perform this action',
      });
    }

    next();
  } catch (error) {
    console.error('[requireTenantOwner] Error:', error);
    return res.status(500).json({
      error: 'permission_check_failed',
      message: 'Failed to verify ownership',
    });
  }
}
