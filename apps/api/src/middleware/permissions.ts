// Tenant-level permission middleware
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { UserRole, UserTenantRole } from '@prisma/client';
import { isPlatformAdmin } from '../utils/platform-admin';

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
    const ownedTenantCount = await prisma.userTenant.count({
      where: {
        userId: req.user.userId,
        role: UserTenantRole.OWNER,
      },
    });

    // Get user's tenant limit from their subscription
    // For now, default limits by role:
    // PLATFORM_ADMIN: Unlimited
    // PLATFORM_SUPPORT: Unlimited (can view all, but typically don't create)
    // PLATFORM_VIEWER: Unlimited (read-only, but typically don't create)
    // ADMIN: Unlimited (legacy)
    // OWNER: 10 tenants
    // USER: 3 tenants
    const limits: Record<UserRole, number> = {
      [UserRole.PLATFORM_ADMIN]: Infinity,
      [UserRole.PLATFORM_SUPPORT]: Infinity,
      [UserRole.PLATFORM_VIEWER]: Infinity,
      [UserRole.ADMIN]: Infinity,
      [UserRole.OWNER]: 10,
      [UserRole.USER]: 3,
    };

    const limit = limits[req.user.role] || 1;

    if (ownedTenantCount >= limit) {
      return res.status(403).json({
        error: 'tenant_limit_reached',
        message: `Your plan allows ${limit} tenant(s). You currently have ${ownedTenantCount}. Upgrade to create more.`,
        current: ownedTenantCount,
        limit,
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
