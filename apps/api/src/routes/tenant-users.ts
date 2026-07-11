// Tenant User Management Routes
// Allows Tenant Owners/Admins to manage user within their tenants
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { checkTenantAccess } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { user_tenant_role } from '@prisma/client';
import { isPlatformAdmin, isPlatformUser } from '../utils/platform-admin';
import { getTenantLimitConfig, canCreateTenant, getUserLimit, TenantLimitTier } from '../config/tenant-limits';
import { generateUserTenantId } from '../lib/id-generator';
import { audit } from '../audit';

const router = Router();

// Auth is applied per-route via checkTenantAccess / requireTenantAdmin
// (both check req.user and return 401 if not authenticated)

/**
 * Check if a tenant can add more users (seat limit enforcement)
 * Reads tier's max_users from subscription_tiers_list first, falls back to config
 */
async function checkTenantUserLimit(tenantId: string): Promise<{ allowed: boolean; limit: number; current: number; config: ReturnType<typeof getUserLimit> }> {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { subscription_tier: true, subscription_status: true },
  });

  // Resolve limit: DB tier record first, then config fallback
  const tierRecord = tenant?.subscription_tier
    ? await prisma.subscription_tiers_list.findUnique({
        where: { tier_key: tenant.subscription_tier },
        select: { max_users: true },
      })
    : null;

  const config = getUserLimit(tenant?.subscription_tier as TenantLimitTier);
  const effectiveMaxUsers = tierRecord?.max_users !== null && tierRecord?.max_users !== undefined
    ? tierRecord.max_users
    : config.maxUsers;

  // During trial, limit to 1 user (owner only)
  if (tenant?.subscription_status === 'trial') {
    const currentUsers = await prisma.user_tenants.count({ where: { tenant_id: tenantId } });
    return { allowed: currentUsers < 1, limit: 1, current: currentUsers, config };
  }

  if (effectiveMaxUsers === 0) {
    return { allowed: true, limit: 0, current: 0, config };
  }

  const currentUsers = await prisma.user_tenants.count({ where: { tenant_id: tenantId } });
  const pendingInvites = await prisma.invitations.count({
    where: { tenant_id: tenantId, accepted_at: null },
  });

  const total = currentUsers + pendingInvites;
  return { allowed: total < effectiveMaxUsers, limit: effectiveMaxUsers, current: total, config };
}

/**
 * GET /tenants/:tenantId/users - List all users in a tenant
 * Requires: Tenant access (platform users bypass) using checkTenantAccess
 */
router.get('/:tenantId/users', checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Get all users in this tenant from user_tenants table
    const userTenants = await prisma.user_tenants.findMany({
      where: { tenant_id:tenantId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true,
            is_active: true,
            last_login: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Also check if there's a platform admin who owns this tenant (via created_by field)
    // This handles cases where platform admins own tenants but don't have explicit user_tenants entries
    let additionalUsers = [];
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        created_by: true,
        created_at: true,
      },
    });

    // If there's a created_by user, fetch their details and check if they're a platform admin
    if (tenant?.created_by) {
      const creator = await prisma.users.findUnique({
        where: { id: tenant.created_by },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          is_active: true,
          last_login: true,
        },
      });

      if (creator) {
        const isPlatformAdmin = creator.role === 'PLATFORM_ADMIN' || creator.role === 'ADMIN';
        const alreadyInList = userTenants.some(ut => ut.users.id === creator.id);

        if (isPlatformAdmin && !alreadyInList) {
          additionalUsers.push({
            id: creator.id,
            email: creator.email,
            name: `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || creator.email,
            platformRole: creator.role,
            tenantRole: user_tenant_role.OWNER, // Use enum value instead of string
            isActive: creator.is_active,
            lastLogin: creator.last_login ? creator.last_login.toISOString() : 'Never',
            addedAt: tenant.created_at?.toISOString() || new Date().toISOString(),
          });
        }
      }
    }

    // Transform data for frontend
    const users = userTenants.map(ut => ({
      id: ut.users.id,
      email: ut.users.email,
      name: `${ut.users.first_name || ''} ${ut.users.last_name || ''}`.trim() || ut.users.email,
      platformRole: ut.users.role,
      tenantRole: ut.role,
      isActive: ut.users.is_active,
      lastLogin: ut.users.last_login ? ut.users.last_login.toISOString() : 'Never',
      addedAt: ut.created_at.toISOString(),
    }));

    // Add any additional users (like platform admin owners)
    users.push(...additionalUsers);

    // Include seat limit info for the merchant UI
    const seatInfo = await checkTenantUserLimit(tenantId);

    res.json({
      success: true,
      users,
      data: users, // Generic data field for compatibility
      items: users, // Items field for compatibility
      results: users, // Results field for compatibility
      total: users.length,
      seatInfo: {
        limit: seatInfo.limit,
        current: seatInfo.current,
        allowed: seatInfo.allowed,
        displayName: seatInfo.config.displayName,
        upgradeMessage: seatInfo.config.upgradeMessage,
      }
    });
  } catch (error) {
    console.error('[GET /tenants/:tenantId/user] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_tenant_user' });
  }
});

/**
 * POST /tenants/:tenantId/users - Add user to tenant
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
const addUserToTenantSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'SUPPORT']),
});

router.post('/:tenantId/users', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const parsed = addUserToTenantSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    // 1. Seat gate check
    const seatCheck = await checkTenantUserLimit(tenantId);
    if (!seatCheck.allowed) {
      return res.status(403).json({
        error: 'seat_limit_reached',
        message: seatCheck.config.upgradeMessage || `This tenant has reached its team limit of ${seatCheck.limit} members.`,
        limit: seatCheck.limit,
        current: seatCheck.current,
      });
    }

    // Find user by email
    const user = await prisma.users.findUnique({
      where: { email: parsed.data.email },
    });

    if (!user) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'No user found with this email address',
      });
    }

    // Check if user is already in tenant
    const existing = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: user.id,
          tenant_id:tenantId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        error: 'user_already_in_tenant',
        message: 'This user is already a member of this tenant',
      });
    }

    // Add user to tenant
    const userTenant = await prisma.user_tenants.create({
      data: {
        //id: `ut_${tenantId}_${user.id}`,
        id: generateUserTenantId(user.id,tenantId),
        users: {
          connect: {
            id: user.id
          }
        },
        tenants: {
          connect: {
            id: tenantId
          }
        },
        role: parsed.data.role as user_tenant_role,
        updated_at: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      platformRole: user.role,
      tenantRole: userTenant.role,
      addedAt: userTenant.created_at.toISOString(),
    });
  } catch (error: any) {
    console.error('[POST /tenants/:tenantId/users] Error:', error);
    res.status(500).json({ error: 'failed_to_add_user_to_tenant' });
  }
});

/**
 * PUT /tenants/:tenantId/users/:userId - Update user's role in tenant
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
const updateUserRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'SUPPORT']),
});

router.put('/:tenantId/users/:userId', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId, userId } = req.params;
    const parsed = updateUserRoleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    // Prevent user from changing their own role
    if (req.user?.userId === userId) {
      return res.status(400).json({
        error: 'cannot_modify_own_role',
        message: 'You cannot change your own role',
      });
    }

    // CRITICAL: Check if changing TO OWNER role (ownership transfer)
    if (parsed.data.role === 'OWNER') {
      // Get the target user to check if they're a platform user
      const targetUser = await prisma.users.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!targetUser) {
        return res.status(404).json({
          error: 'user_not_found',
          message: 'Target user not found',
        });
      }

      // Platform user (except PLATFORM_VIEWER) can receive unlimited tenants
      const isPlatformUserRole = isPlatformUser({ role: targetUser.role } as any);
      
      if (!isPlatformUserRole || targetUser.role === 'PLATFORM_VIEWER') {
        // Regular user or platform viewer - check their tenant limits
        
        // Count target user's current owned tenants
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

        // Determine target user's effective tier
        const tierPriority: Record<string, number> = {
          organization: 5,
          enterprise: 4,
          professional: 3,
          commitment: 3,
          storefront: 2,
          starter: 2,
          discovery: 1,
          google_only: 0,
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

        // Check if target user can accept another tenant
        if (!canCreateTenant(ownedTenantCount, effectiveTier, effectiveStatus)) {
          const limitConfig = getTenantLimitConfig(effectiveTier, effectiveStatus);
          const limit = limitConfig.limit;
          
          return res.status(403).json({
            error: 'tenant_limit_reached',
            message: `Cannot transfer ownership: Target user has reached their limit. ${limitConfig.upgradeMessage || `Their ${effectiveTier} plan allows ${limit === Infinity ? 'unlimited' : limit} location(s). They currently have ${ownedTenantCount}.`}`,
            current: ownedTenantCount,
            limit: limit === Infinity ? 'unlimited' : limit,
            tier: effectiveTier,
            status: effectiveStatus,
            upgradeToTier: limitConfig.upgradeToTier,
            upgradeMessage: limitConfig.upgradeMessage,
          });
        }
      }
    }

    // Update user's role
    const userTenant = await prisma.user_tenants.update({
      where: {
        user_id_tenant_id: {
          user_id:userId,
          tenant_id:tenantId,
        },
      },
      data: {
        role: parsed.data.role as user_tenant_role,
      },
    });

    res.json(userTenant);
  } catch (error: any) {
    console.error('[PUT /tenants/:tenantId/users/:userId] Error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'user_not_in_tenant',
        message: 'This user is not a member of this tenant',
      });
    }

    res.status(500).json({ error: 'failed_to_update_user_role' });
  }
});

// PATCH alias for the same role update (frontend TenantUserService uses PATCH)
router.patch('/:tenantId/users/:userId', requireTenantAdmin, async (req, res) => {
  // Forward to the same handler logic by reusing the request
  try {
    const { tenantId, userId } = req.params;
    const parsed = updateUserRoleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    // Prevent user from changing their own role
    if (req.user?.userId === userId) {
      return res.status(400).json({
        error: 'cannot_modify_own_role',
        message: 'You cannot change your own role',
      });
    }

    // CRITICAL: Check if changing TO OWNER role (ownership transfer)
    if (parsed.data.role === 'OWNER') {
      const targetUser = await prisma.users.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!targetUser) {
        return res.status(404).json({
          error: 'user_not_found',
          message: 'Target user not found',
        });
      }

      const isPlatformUserRole = isPlatformUser({ role: targetUser.role } as any);

      if (!isPlatformUserRole || targetUser.role === 'PLATFORM_VIEWER') {
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

        const tierPriority: Record<string, number> = {
          organization: 5,
          enterprise: 4,
          professional: 3,
          commitment: 3,
          storefront: 2,
          starter: 2,
          discovery: 1,
          google_only: 0,
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

        if (!canCreateTenant(ownedTenantCount, effectiveTier, effectiveStatus)) {
          const limitConfig = getTenantLimitConfig(effectiveTier, effectiveStatus);
          const limit = limitConfig.limit;

          return res.status(403).json({
            error: 'tenant_limit_reached',
            message: `Cannot transfer ownership: Target user has reached their limit. ${limitConfig.upgradeMessage || `Their ${effectiveTier} plan allows ${limit === Infinity ? 'unlimited' : limit} location(s). They currently have ${ownedTenantCount}.`}`,
            current: ownedTenantCount,
            limit: limit === Infinity ? 'unlimited' : limit,
            tier: effectiveTier,
            status: effectiveStatus,
            upgradeToTier: limitConfig.upgradeToTier,
            upgradeMessage: limitConfig.upgradeMessage,
          });
        }
      }
    }

    const userTenant = await prisma.user_tenants.update({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
      data: {
        role: parsed.data.role as user_tenant_role,
      },
    });

    res.json(userTenant);
  } catch (error: any) {
    console.error('[PATCH /tenants/:tenantId/users/:userId] Error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'user_not_in_tenant',
        message: 'This user is not a member of this tenant',
      });
    }

    res.status(500).json({ error: 'failed_to_update_user_role' });
  }
});

/**
 * DELETE /tenants/:tenantId/users/:userId - Remove user from tenant
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
router.delete('/:tenantId/users/:userId', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId, userId } = req.params;

    // Prevent user from removing themselves
    if (req.user?.userId === userId) {
      return res.status(400).json({
        error: 'cannot_remove_self',
        message: 'You cannot remove yourself from the tenant',
      });
    }

    // Check if target is the last owner
    const targetUser = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
    });

    if (targetUser?.role === 'OWNER') {
      const ownerCount = await prisma.user_tenants.count({
        where: { tenant_id: tenantId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        return res.status(403).json({
          error: 'cannot_remove_last_owner',
          message: 'Cannot remove the last owner. Transfer ownership first.',
        });
      }
    }

    // Remove user from tenant
    await prisma.user_tenants.delete({
      where: {
        user_id_tenant_id: {
          user_id:userId,
          tenant_id:tenantId,
        },
      },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('[DELETE /tenants/:tenantId/users/:userId] Error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'user_not_in_tenant',
        message: 'This user is not a member of this tenant',
      });
    }

    res.status(500).json({ error: 'failed_to_remove_user_from_tenant' });
  }
});

/**
 * POST /tenants/:tenantId/users/invite
 * Invite a user by email to join this tenant.
 * - If user exists -> create user_tenants row directly
 * - If user does not exist -> create invitations row for later acceptance
 * - Enforces seat limit
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'SUPPORT']).default('MEMBER'),
});

router.post('/:tenantId/users/invite', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const parsed = inviteUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    // 1. Seat gate check
    const seatCheck = await checkTenantUserLimit(tenantId);
    if (!seatCheck.allowed) {
      return res.status(403).json({
        error: 'seat_limit_reached',
        message: seatCheck.config.upgradeMessage || `This tenant has reached its team limit of ${seatCheck.limit} members.`,
        limit: seatCheck.limit,
        current: seatCheck.current,
      });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    // 2. Check if user already exists in the platform
    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    if (user) {
      // Check if already in this tenant
      const existing = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: user.id,
            tenant_id: tenantId,
          },
        },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'user_already_in_tenant',
          currentRole: existing.role,
        });
      }

      // Add directly to tenant
      await prisma.user_tenants.create({
        data: {
          id: generateUserTenantId(user.id, tenantId),
          user_id: user.id,
          tenant_id: tenantId,
          role: parsed.data.role as user_tenant_role,
          updated_at: new Date(),
        },
      });

      await audit({
        tenantId,
        actor: req.user?.userId || 'system',
        action: 'create',
        payload: { entity_type: 'other', assignedUserId: user.id, email: user.email, role: parsed.data.role, method: 'email_invitation' },
      });

      return res.json({
        success: true,
        status: 'added',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        },
      });
    }

    // 3. User does not exist -> create invitation
    // Check for duplicate pending invitation
    const existingInvite = await prisma.invitations.findFirst({
      where: { email: normalizedEmail, tenant_id: tenantId, accepted_at: null },
    });
    if (existingInvite) {
      return res.status(409).json({
        success: false,
        error: 'invitation_already_pending',
        message: 'An invitation is already pending for this email.',
      });
    }

    await prisma.invitations.create({
      data: {
        email: normalizedEmail,
        tenant_id: tenantId,
        role: parsed.data.role as user_tenant_role,
        invited_by: req.user?.userId || 'system',
      },
    });

    await audit({
      tenantId,
      actor: req.user?.userId || 'system',
      action: 'create',
      payload: { entity_type: 'other', email: normalizedEmail, role: parsed.data.role, method: 'invitation_token' },
    });

    // TODO: Trigger email send (queue or direct)
    // await emailQueue.sendInvitation(normalizedEmail, tenantId, token);

    return res.json({
      success: true,
      status: 'invited',
      email: normalizedEmail,
    });
  } catch (error: any) {
    console.error('[POST /tenants/:tenantId/users/invite] Error:', error);
    res.status(500).json({ error: 'failed_to_invite_user', message: error.message });
  }
});

/**
 * GET /tenants/:tenantId/invitations
 * List pending invitations for this tenant
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
router.get('/:tenantId/invitations', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const invitations = await prisma.invitations.findMany({
      where: { tenant_id: tenantId, accepted_at: null },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        expires_at: true,
      },
    });

    res.json({ success: true, invitations });
  } catch (error: any) {
    console.error('[GET /tenants/:tenantId/invitations] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_invitations' });
  }
});

/**
 * DELETE /tenants/:tenantId/invitations/:id
 * Cancel a pending invitation
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
router.delete('/:tenantId/invitations/:id', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    await prisma.invitations.deleteMany({
      where: { id, tenant_id: tenantId },
    });

    res.json({ success: true, message: 'Invitation cancelled' });
  } catch (error: any) {
    console.error('[DELETE /tenants/:tenantId/invitations/:id] Error:', error);
    res.status(500).json({ error: 'failed_to_cancel_invitation' });
  }
});

export default router;
