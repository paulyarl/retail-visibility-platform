// Tenant-level permission middleware
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { isPlatformAdmin } from '../utils/platform-admin';
import { getTenantLimit, getTenantLimitConfig, canCreateTenant, getPlatformSupportLimit } from '../config/tenant-limits';
// Type extensions are automatically loaded from src/types/express.d.ts

import { user_tenant_role } from '@prisma/client';
import { logger } from '../logger';

/**
 * Get organization ID from request (params or body)
 */
function getOrganizationIdFromRequest(req: Request): string | null {
  return (
    req.params.organizationId ||
    req.params.orgId ||
    req.params.id ||
    req.body.organizationId ||
    req.body.orgId ||
    null
  );
}

/**
 * Fetch organization with its tenants and identify the hero tenant.
 * The hero tenant is the one with metadata.isHeroLocation === true.
 * Falls back to the first tenant if no hero is marked.
 */
async function getOrgWithHeroTenant(orgId: string) {
  const organization = await prisma.organizations_list.findUnique({
    where: { id: orgId },
    include: {
      tenants: {
        select: { id: true, metadata: true },
      },
    },
  });

  if (!organization) return null;

  const heroTenant = organization.tenants.find(
    (t: any) => t.metadata && (t.metadata as any).isHeroLocation === true
  );

  const heroTenantId = heroTenant?.id || organization.tenants[0]?.id || null;

  return { organization, heroTenantId, tenantIds: organization.tenants.map((t: any) => t.id) };
}

/**
 * Check if user has an explicit org role in user_organizations.
 * Returns the role string or null if no explicit role exists.
 */
async function getExplicitOrgRole(userId: string, orgId: string): Promise<string | null> {
  try {
    const userOrg = await prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: userId,
          organization_id: orgId,
        },
      },
      select: { role: true },
    });
    return userOrg?.role || null;
  } catch {
    return null;
  }
}

/**
 * Middleware to check if user is an organization admin.
 * Checks explicit org role (ORG_OWNER, ORG_ADMIN) first, then falls back to hero tenant admin.
 * Platform admins always bypass.
 */
export async function requireOrgAdmin(
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

    // Platform admins bypass org checks
    if (isPlatformAdmin(req.user)) {
      return next();
    }

    const orgId = getOrganizationIdFromRequest(req);
    if (!orgId) {
      return res.status(400).json({
        error: 'organizationId_required',
        message: 'Organization ID is required',
      });
    }

    const userId = req.user.userId || req.user.user_id;
    if (!userId) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User ID is required',
      });
    }

    // Check explicit org role first
    const explicitRole = await getExplicitOrgRole(userId, orgId);
    if (explicitRole === 'ORG_OWNER' || explicitRole === 'ORG_ADMIN') {
      return next();
    }

    // Fallback: hero tenant admin derivation for backward compat
    if (!explicitRole) {
      const orgData = await getOrgWithHeroTenant(orgId);
      if (!orgData) {
        return res.status(404).json({
          error: 'organization_not_found',
          message: 'Organization not found',
        });
      }

      if (!orgData.heroTenantId) {
        return res.status(400).json({
          error: 'no_hero_tenant',
          message: 'Organization has no tenants',
        });
      }

      const userRole = await getUserTenantRole(userId, orgData.heroTenantId);

      if (!userRole || (userRole !== user_tenant_role.OWNER && userRole !== user_tenant_role.ADMIN)) {
        return res.status(403).json({
          error: 'org_admin_required',
          message: 'Only organization administrators can perform this action',
          requiredRole: 'ORG_ADMIN, ORG_OWNER, or admin of the primary location',
        });
      }
    } else {
      // User has explicit role but not admin-level
      return res.status(403).json({
        error: 'org_admin_required',
        message: 'Only organization administrators can perform this action',
        requiredRole: 'ORG_ADMIN or ORG_OWNER',
      });
    }

    next();
  } catch (error) {
    logger.error('[requireOrgAdmin] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'permission_check_failed',
      message: 'Failed to verify organization admin permissions',
    });
  }
}

/**
 * Middleware to check if user is an organization member.
 * Checks explicit org role (any role in user_organizations) first, then falls back to tenant admin.
 * Platform admins always bypass.
 */
export async function requireOrgMember(
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

    // Platform admins bypass org checks
    if (isPlatformAdmin(req.user)) {
      return next();
    }

    const orgId = getOrganizationIdFromRequest(req);
    if (!orgId) {
      return res.status(400).json({
        error: 'organizationId_required',
        message: 'Organization ID is required',
      });
    }

    const userId = req.user.userId || req.user.user_id;
    if (!userId) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User ID is required',
      });
    }

    // Check explicit org role first — any role means member
    const explicitRole = await getExplicitOrgRole(userId, orgId);
    if (explicitRole !== null) {
      return next();
    }

    // Fallback: any tenant admin in org for backward compat
    const orgData = await getOrgWithHeroTenant(orgId);
    if (!orgData) {
      return res.status(404).json({
        error: 'organization_not_found',
        message: 'Organization not found',
      });
    }

    if (orgData.tenantIds.length === 0) {
      return res.status(400).json({
        error: 'no_tenants',
        message: 'Organization has no tenants',
      });
    }

    const userTenants = await prisma.user_tenants.findMany({
      where: {
        user_id: userId,
        tenant_id: { in: orgData.tenantIds },
        role: { in: [user_tenant_role.OWNER, user_tenant_role.ADMIN] },
      },
    });

    if (userTenants.length === 0) {
      return res.status(403).json({
        error: 'org_member_required',
        message: 'You must be a member of this organization to perform this action',
      });
    }

    next();
  } catch (error) {
    logger.error('[requireOrgMember] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'permission_check_failed',
      message: 'Failed to verify organization member permissions',
    });
  }
}

/**
 * Middleware to check if user is an organization admin for a specific org request.
 * Fetches the organization_requests_list record by req.params.id to get the org ID,
 * then checks explicit org role first, falls back to hero tenant admin.
 * Use this for routes where :id is the request ID, not the org ID.
 */
export async function requireOrgAdminForRequest(
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

    if (isPlatformAdmin(req.user)) {
      return next();
    }

    const requestId = req.params.id;
    if (!requestId) {
      return res.status(400).json({
        error: 'requestId_required',
        message: 'Request ID is required',
      });
    }

    const userId = req.user.userId || req.user.user_id;
    if (!userId) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User ID is required',
      });
    }

    const orgRequest = await prisma.organization_requests_list.findUnique({
      where: { id: requestId },
      select: { organization_id: true },
    });

    if (!orgRequest) {
      return res.status(404).json({
        error: 'request_not_found',
        message: 'Organization request not found',
      });
    }

    const orgId = orgRequest.organization_id;

    // Check explicit org role first
    const explicitRole = await getExplicitOrgRole(userId, orgId);
    if (explicitRole === 'ORG_OWNER' || explicitRole === 'ORG_ADMIN') {
      return next();
    }

    // Fallback: hero tenant admin derivation for backward compat
    if (!explicitRole) {
      const orgData = await getOrgWithHeroTenant(orgId);
      if (!orgData) {
        return res.status(404).json({
          error: 'organization_not_found',
          message: 'Organization not found',
        });
      }

      if (!orgData.heroTenantId) {
        return res.status(400).json({
          error: 'no_hero_tenant',
          message: 'Organization has no tenants',
        });
      }

      const userRole = await getUserTenantRole(userId, orgData.heroTenantId);

      if (!userRole || (userRole !== user_tenant_role.OWNER && userRole !== user_tenant_role.ADMIN)) {
        return res.status(403).json({
          error: 'org_admin_required',
          message: 'Only organization administrators can perform this action',
        });
      }
    } else {
      return res.status(403).json({
        error: 'org_admin_required',
        message: 'Only organization administrators can perform this action',
      });
    }

    next();
  } catch (error) {
    logger.error('[requireOrgAdminForRequest] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'permission_check_failed',
      message: 'Failed to verify organization admin permissions',
    });
  }
}

/**
 * Middleware to check if user is an organization owner.
 * Only ORG_OWNER or platform admin can pass. No fallback — explicit role required.
 * Used for sensitive operations like changing other users' roles or removing users.
 */
export async function requireOrgOwner(
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

    if (isPlatformAdmin(req.user)) {
      return next();
    }

    const orgId = getOrganizationIdFromRequest(req);
    if (!orgId) {
      return res.status(400).json({
        error: 'organizationId_required',
        message: 'Organization ID is required',
      });
    }

    const userId = req.user.userId || req.user.user_id;
    if (!userId) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User ID is required',
      });
    }

    const explicitRole = await getExplicitOrgRole(userId, orgId);
    if (explicitRole !== 'ORG_OWNER') {
      return res.status(403).json({
        error: 'org_owner_required',
        message: 'Only organization owners can perform this action',
        requiredRole: 'ORG_OWNER',
      });
    }

    next();
  } catch (error) {
    logger.error('[requireOrgOwner] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'permission_check_failed',
      message: 'Failed to verify organization owner permissions',
    });
  }
}

/**
 * Get tenant ID from request
 */
function getTenantIdFromRequest(req: Request): string | null {
  return (
    req.params.tenantId ||
    req.params.id ||
    (req.query.tenantId as string) ||
    req.body.tenantId ||
    (req.headers['x-tenant-id'] as string) ||
    null
  );
}

/**
 * Get user's role for a specific tenant
 */
export async function getUserTenantRole(
  userId: string,
  tenant_id: string
): Promise<user_tenant_role | null> {
  const userTenant = await prisma.user_tenants.findUnique({
    where: {
      user_id_tenant_id: {
        user_id: userId,
        tenant_id: tenant_id,
      },
    },
  });

  return userTenant?.role || null;
}

/**
 * Middleware to check if user has required tenant-level role
 */
export function requireTenantRole(...allowedRoles: user_tenant_role[]) {
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
      logger.error('[requireTenantRole] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
  user_tenant_role.OWNER,
  user_tenant_role.ADMIN
);

/**
 * Middleware to check if user can manage inventory (all except VIEWER)
 */
export const requireInventoryAccess = requireTenantRole(
  user_tenant_role.OWNER,
  user_tenant_role.ADMIN,
  user_tenant_role.MEMBER
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
    const ownedTenants = await prisma.user_tenants.findMany({
      where: {
        user_id: userId,
        role: user_tenant_role.OWNER,
      },
      include: {
        tenants: {
          select: {
            subscription_tier: true,
            subscription_status: true,
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
      commitment: 3,
      storefront: 2,
      starter: 2,
      discovery: 1,
      google_only: 1,
    };

    let effectiveTier = 'discovery';
    let effectiveStatus = 'trial';
    let highestPriority = 0;

    for (const ut of ownedTenants) {
      const tier = ut.tenants.subscription_tier || 'discovery';
      const status = ut.tenants.subscription_status || 'trial';
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
    logger.error('[checkTenantCreationLimit] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const userRole = await getUserTenantRole(userId, tenantId!);

    if (userRole !== user_tenant_role.OWNER) {
      return res.status(403).json({
        error: 'owner_required',
        message: 'Only the tenant owner can perform this action',
      });
    }

    next();
  } catch (error) {
    logger.error('[requireTenantOwner] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      error: 'permission_check_failed',
      message: 'Failed to verify ownership',
    });
  }
}
