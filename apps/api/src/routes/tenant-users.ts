// Tenant User Management Routes
// Allows Tenant Owners/Admins to manage users within their tenants
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { UserTenantRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /tenants/:tenantId/users - List all users in a tenant
 * Requires: Tenant access (platform users bypass) using checkTenantAccess
 */
router.get('/:tenantId/users', checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Get all users in this tenant
    const userTenants = await prisma.userTenant.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLogin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform data for frontend
    const users = userTenants.map(ut => ({
      id: ut.user.id,
      email: ut.user.email,
      name: `${ut.user.firstName || ''} ${ut.user.lastName || ''}`.trim() || ut.user.email,
      platformRole: ut.user.role,
      tenantRole: ut.role,
      isActive: ut.user.isActive,
      lastLogin: ut.user.lastLogin ? ut.user.lastLogin.toISOString() : 'Never',
      addedAt: ut.createdAt.toISOString(),
    }));

    res.json(users);
  } catch (error) {
    console.error('[GET /tenants/:tenantId/users] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_tenant_users' });
  }
});

/**
 * POST /tenants/:tenantId/users - Add user to tenant
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
const addUserToTenantSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (!user) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'No user found with this email address',
      });
    }

    // Check if user is already in tenant
    const existing = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId,
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
    const userTenant = await prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        role: parsed.data.role as UserTenantRole,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json({
      id: userTenant.user.id,
      email: userTenant.user.email,
      name: `${userTenant.user.firstName || ''} ${userTenant.user.lastName || ''}`.trim() || userTenant.user.email,
      platformRole: userTenant.user.role,
      tenantRole: userTenant.role,
      addedAt: userTenant.createdAt.toISOString(),
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
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
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

    // Prevent users from changing their own role
    if (req.user?.userId === userId) {
      return res.status(400).json({
        error: 'cannot_modify_own_role',
        message: 'You cannot change your own role',
      });
    }

    // Update user's role
    const userTenant = await prisma.userTenant.update({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      data: {
        role: parsed.data.role as UserTenantRole,
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

/**
 * DELETE /tenants/:tenantId/users/:userId - Remove user from tenant
 * Requires: TENANT_OWNER or TENANT_ADMIN role
 */
router.delete('/:tenantId/users/:userId', requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId, userId } = req.params;

    // Prevent users from removing themselves
    if (req.user?.userId === userId) {
      return res.status(400).json({
        error: 'cannot_remove_self',
        message: 'You cannot remove yourself from the tenant',
      });
    }

    // Remove user from tenant
    await prisma.userTenant.delete({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
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

export default router;
