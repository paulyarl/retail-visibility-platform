// User Management Routes
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { user_role } from '@prisma/client';
import { getUserTenantRole } from '../middleware/permissions';
import { generateUserId, generateUserTenantId } from '../lib/id-generator';

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
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        email_verified: true,
        last_login: true,
        created_at: true,
        user_tenants: {
          include: {
            tenants: {
              select: {
                id: true,
                name: true,
                organization_id: true,
                organizations_list: {
                  select: {
                    id: true,
                    name: true,
                    _count: {
                      select: { 
                        tenants: true
                      }
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
    const primaryTenant = user.user_tenants[0];
    const organization = primaryTenant?.tenants.organizations_list;
    
    // Check if user is org admin (has OWNER/ADMIN role in any tenant of an org)
    const isOrgAdmin = user.user_tenants.some((ut: any) => 
      (ut.role === 'OWNER' || ut.role === 'ADMIN') && 
      ut.tenants.organization_id
    );

    // Calculate permissions
    const canManageOrganization = isPlatformAdmin || isOrgAdmin;
    const canManageTenants = isPlatformAdmin || isOrgAdmin || 
      user.user_tenants.some((ut: any) => ut.role === 'OWNER' || ut.role === 'ADMIN');
    const canManageUsers = canManageTenants;

    // Build profile response
    const profile = {
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      
      // Platform context
      isPlatformAdmin,
      
      // Organization context
      organizationId: organization?.id,
      organizationName: organization?.name,
      isOrgAdmin,
      
      // Tenant context
      tenantsCount: user.user_tenants.length,
      locationsServed: organization?._count.tenants || user.user_tenants.length,
      primaryTenantId: primaryTenant?.tenant_id,
      primaryTenantName: primaryTenant?.tenants.name,
      
      // Tenant memberships
      tenantMemberships: user.user_tenants.map(ut => ({
        tenantId: ut.tenant_id,
        tenantName: ut.tenants.name,
        role: ut.role,
        organizationId: ut.tenants.organizations_list?.id,
        organizationName: ut.tenants.organizations_list?.name
      })),
      
      // Permissions
      canManageOrganization,
      canManageTenants,
      canManageUsers,
      
      // Activity
      lastActive: user.last_login,
      memberSince: user.created_at,
      emailVerified: user.email_verified,
      isActive: user.is_active
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
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        email_verified: true,
        last_login: true,
        created_at: true,
        user_tenants: {
          include: {
            tenants: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Transform data for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      role: user.role,
      status: user.is_active ? (user.email_verified ? 'active' : 'pending') : 'inactive',
      lastActive: user.last_login ? user.last_login.toISOString() : 'Never',
      tenant: user.user_tenants.length,
      tenantRoles: user.user_tenants.map(ut => ({
        tenantId: ut.tenants.id,
        tenantName: ut.tenants.name,
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
    const user = await prisma.users.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        email_verified: true,
        last_login: true,
        created_at: true,
        user_tenants: {
          include: {
            tenants: {
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
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER', 'ADMIN', 'OWNER', 'USER']).optional(),
  is_active: z.boolean().optional(),
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
    const existingUser = await prisma.users.findUnique({
      where: { id: req.params.id },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Update user
    const updatedUser = await prisma.users.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        role: parsed.data.role as user_role,
      },
      select: {
        id: true,
        email: true,
        first_name: true, 
        last_name: true,
        role: true,
        is_active: true,
        email_verified: true,
        last_login: true,
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
    const existingUser = await prisma.users.findUnique({
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
    await prisma.users.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('[DELETE /users/:id] Error:', error);
    res.status(500).json({ error: 'failed_to_delete_user' });
  }
});

/**
 * GET /users/:id/tenants/:tenantId - Get user's role for a specific tenant
 */
router.get('/:id/tenants/:tenantId', async (req, res) => {
  try {
    const requesterId = req.user?.userId;
    const { id, tenantId } = req.params;

    if (!requesterId || requesterId !== id) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You can only view your own tenant membership',
      });
    }

    const role = await getUserTenantRole(id, tenantId);

    if (!role) {
      return res.status(404).json({
        error: 'user_tenant_not_found',
        message: 'User is not a member of this tenant',
      });
    }

    return res.json({
      userId: id,
      tenantId,
      role,
    });
  } catch (error) {
    console.error('[GET /users/:id/tenants/:tenantId] Error:', error);
    return res.status(500).json({
      error: 'failed_to_fetch_user_tenant',
    });
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
    const user = await prisma.users.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Check if tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: parsed.data.tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Create user-tenant relationship
    const userTenant = await prisma.user_tenants.create({
      data: {
        id: generateUserTenantId(req.params.id,parsed.data.tenantId),
        user_id: req.params.id,
        tenant_id: parsed.data.tenantId,
        role: parsed.data.role,
        updated_at: new Date(),
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
    const userTenant = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: req.params.id,
          tenant_id: req.params.tenantId,
        },
      },
    });

    if (!userTenant) {
      return res.status(404).json({ error: 'user_tenant_not_found' });
    }

    // Delete the relationship
    await prisma.user_tenants.delete({
      where: {
        user_id_tenant_id: {
          user_id: req.params.id,
          tenant_id: req.params.tenantId,
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
      prisma.users.count(),
      prisma.users.count({ where: { is_active: true, email_verified: true } }),
      prisma.users.count({ where: { is_active: true, email_verified: false } }),
      prisma.users.count({ where: { is_active: false } }),
      prisma.users.count({ where: { role: user_role.ADMIN } }),
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

