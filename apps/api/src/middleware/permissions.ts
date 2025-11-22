// Tenant-level permission middleware
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { isPlatformAdmin } from '../utils/platform-admin';
import { getTenantLimit, getTenantLimitConfig, canCreateTenant, getPlatformSupportLimit } from '../config/tenant-limits';
// Type extensions are automatically loaded from src/types/express.d.ts

import { UserTenantRole } from '@prisma/client';

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
        userId: userId,
        tenantId: tenantId,
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
          error: 'tenantId_required',
          message: 'Tenant ID is required',
        });
      }

      if (!req.user.userId && !req.user.user_id) {
        return res.status(401).json({
          error: 'authentication_required',
          message: 'User ID is required',
        });
      }

      const userId = req.user.userId || req.user.user_id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'authentication_required',
          message: 'User ID is required',
        });
      }

      const userRole = await getUserTenantRole(userId, tenantId!);

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
 * 
 * PLATFORM ROLES:
 * - PLATFORM_ADMIN: Unlimited (bypass all checks)
 * - PLATFORM_SUPPORT: Limited to 3 tenants per owner (regardless of owner's tier)
 * - PLATFORM_VIEWER: Cannot create tenants (read-only)
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

    // Platform support can create tenants BUT is limited to 3 tenants per owner
    // This limit applies regardless of the owner's actual subscription tier
    if (req.user.role === 'PLATFORM_SUPPORT') {
      // Determine who will own the tenant being created
      // Check if ownerId is provided in request body (for creating on behalf of others)
      const requestBody = req.body as { ownerId?: string };
      const ownerId = requestBody.ownerId || req.user.userId;
      
      // Count tenants created by THIS support user FOR this owner
      // First get all tenant IDs created by this support user
      const tenantsCreatedBySupport = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM user_tenants ut
        JOIN tenant t ON ut.tenantId = t.id
        WHERE ut.userId = ${ownerId}
        AND ut.role = 'OWNER'
        AND t.createdBy = ${req.user.userId}
      `;
      
      const supportCount = (tenantsCreatedBySupport as any)[0]?.count || 0;
      
      const supportLimit = getPlatformSupportLimit(); // 3
      
      if (supportCount >= supportLimit) {
        return res.status(403).json({
          error: 'platform_support_limit_reached',
          message: `Platform support users can only create up to ${supportLimit} tenants per owner. You have already created ${supportCount} locations for this owner.`,
          current: supportCount,
          limit: supportLimit,
          role: 'PLATFORM_SUPPORT',
          creatorId: req.user.userId,
          ownerId: ownerId,
        });
      }
      
      return next();
    }

    // Platform viewers cannot create tenants
    if (req.user.role === 'PLATFORM_VIEWER') {
      return res.status(403).json({
        error: 'platform_viewer_cannot_create',
        message: 'Platform viewers have read-only access and cannot create tenants.',
        role: 'PLATFORM_VIEWER',
      });
    }

    if (!req.user.userId && !req.user.user_id) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User ID is required',
      });
    }

    // Count user's owned tenants
    const userId = req.user.userId || req.user.user_id;
    const ownedTenants = await prisma.userTenant.findMany({
      where: {
        userId: userId,
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
        error: 'tenantId_required',
        message: 'Tenant ID is required',
      });
    }

    if (!req.user.userId && !req.user.user_id) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User ID is required',
      });
    }

    const userId = req.user.userId || req.user.user_id;

    const userRole = await getUserTenantRole(userId, tenantId!);

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
