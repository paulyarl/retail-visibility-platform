// User Management Routes
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /user/profile - Get current user's profile
 * Returns comprehensive profile data including roles, permissions, and tenant access
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    // Fetch user with all related data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                organizationId: true,
                organization: {
                  select: {
                    id: true,
                    name: true,
                    _count: {
                      select: { tenants: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Determine role context
    const isPlatformAdmin = user.role === 'PLATFORM_ADMIN' || user.role === 'ADMIN';
    const primaryTenant = user.tenants[0];
    const organization = primaryTenant?.tenant.organization;
    
    // Check if user is org admin (has OWNER/ADMIN role in any tenant of an org)
    const isOrgAdmin = user.tenants.some(ut => 
      (ut.role === 'OWNER' || ut.role === 'ADMIN') && 
      ut.tenant.organizationId
    );

    // Calculate permissions
    const canManageOrganization = isPlatformAdmin || isOrgAdmin;
    const canManageTenants = isPlatformAdmin || isOrgAdmin || 
      user.tenants.some(ut => ut.role === 'OWNER' || ut.role === 'ADMIN');
    const canManageUsers = canManageTenants;

    // Build profile response
    const profile = {
      id: user.id,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      
      // Platform context
      isPlatformAdmin,
      
      // Organization context
      organizationId: organization?.id,
      organizationName: organization?.name,
      isOrgAdmin,
      
      // Tenant context
      tenantsCount: user.tenants.length,
      locationsServed: organization?._count.tenants || user.tenants.length,
      primaryTenantId: primaryTenant?.tenantId,
      primaryTenantName: primaryTenant?.tenant.name,
      
      // Tenant memberships
      tenantMemberships: user.tenants.map(ut => ({
        tenantId: ut.tenantId,
        tenantName: ut.tenant.name,
        role: ut.role,
        organizationId: ut.tenant.organizationId,
        organizationName: ut.tenant.organization?.name
      })),
      
      // Permissions
      canManageOrganization,
      canManageTenants,
      canManageUsers,
      
      // Activity
      lastActive: user.lastLogin,
      memberSince: user.createdAt,
      emailVerified: user.emailVerified,
      isActive: user.isActive
    };

    res.json(profile);
  } catch (error) {
    console.error('[GET /user/profile] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_profile' });
  }
});

/**
 * GET /users - List all users (admin only)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform data for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      role: user.role,
      status: user.isActive ? (user.emailVerified ? 'active' : 'pending') : 'inactive',
      lastActive: user.lastLogin ? user.lastLogin.toISOString() : 'Never',
      tenants: user.tenants.length,
      tenantRoles: user.tenants.map(ut => ({
        tenantId: ut.tenant.id,
        tenantName: ut.tenant.name,
        role: ut.role,
      })),
    }));

    res.json(transformedUsers);
  } catch (error) {
    console.error('[GET /users] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_users' });
  }
});

/**
 * GET /users/:id - Get single user (admin only)
 */
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    res.json(user);
  } catch (error) {
    console.error('[GET /users/:id] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_user' });
  }
});

/**
 * PUT /users/:id - Update user (admin only)
 */
const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'OWNER', 'USER']).optional(),
  isActive: z.boolean().optional(),
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        role: parsed.data.role as UserRole,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('[PUT /users/:id] Error:', error);
    res.status(500).json({ error: 'failed_to_update_user' });
  }
});

/**
 * DELETE /users/:id - Delete user (admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Prevent deleting yourself
    if (req.user?.userId === req.params.id) {
      return res.status(400).json({
        error: 'cannot_delete_self',
        message: 'You cannot delete your own account',
      });
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('[DELETE /users/:id] Error:', error);
    res.status(500).json({ error: 'failed_to_delete_user' });
  }
});

/**
 * POST /users/:id/tenants - Add user to tenant (admin only)
 */
const addUserToTenantSchema = z.object({
  tenantId: z.string(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

router.post('/:id/tenants', requireAdmin, async (req, res) => {
  try {
    const parsed = addUserToTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: parsed.data.tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Create user-tenant relationship
    const userTenant = await prisma.userTenant.create({
      data: {
        userId: req.params.id,
        tenantId: parsed.data.tenantId,
        role: parsed.data.role,
      },
    });

    res.status(201).json(userTenant);
  } catch (error: any) {
    console.error('[POST /users/:id/tenants] Error:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'user_already_in_tenant',
        message: 'User is already a member of this tenant',
      });
    }

    res.status(500).json({ error: 'failed_to_add_user_to_tenant' });
  }
});

/**
 * DELETE /users/:id/tenants/:tenantId - Remove user from tenant (admin only)
 */
router.delete('/:id/tenants/:tenantId', requireAdmin, async (req, res) => {
  try {
    // Find the user-tenant relationship
    const userTenant = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: req.params.id,
          tenantId: req.params.tenantId,
        },
      },
    });

    if (!userTenant) {
      return res.status(404).json({ error: 'user_tenant_not_found' });
    }

    // Delete the relationship
    await prisma.userTenant.delete({
      where: {
        userId_tenantId: {
          userId: req.params.id,
          tenantId: req.params.tenantId,
        },
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error('[DELETE /users/:id/tenants/:tenantId] Error:', error);
    res.status(500).json({ error: 'failed_to_remove_user_from_tenant' });
  }
});

/**
 * GET /users/stats - Get user statistics (admin only)
 */
router.get('/stats/summary', requireAdmin, async (req, res) => {
  try {
    const [total, active, pending, inactive, admins] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true, emailVerified: true } }),
      prisma.user.count({ where: { isActive: true, emailVerified: false } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
    ]);

    res.json({
      total,
      active,
      pending,
      inactive,
      admins,
    });
  } catch (error) {
    console.error('[GET /users/stats/summary] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_stats' });
  }
});

export default router;
